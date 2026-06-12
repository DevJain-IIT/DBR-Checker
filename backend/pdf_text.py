"""
pdf_text.py

Local PDF pre-processing for the extraction pipeline:

  1. classify(pdf_bytes) -> "text" | "scanned"
       Heuristic: open with PyMuPDF, measure how much real text the pages carry.
       Text-based DBRs (exported from Word/CAD) have a rich text layer; scanned
       (image-only) PDFs have little/none.

  2. to_markdown(pdf_bytes) -> str
       For text-based PDFs, render clean Markdown via pymupdf4llm (preserves
       tables, headings, reading order) to feed the model alongside the PDF.

Scanned PDFs are NOT processed here — they're routed to OpenRouter's OCR engine
in extract.py (no local OCR binary needed on Render).
"""
from __future__ import annotations

import os
import tempfile

# Minimum average characters of extractable text PER PAGE for a PDF to count as
# "text-based". A scanned page yields ~0; a real DBR page yields hundreds.
_MIN_CHARS_PER_PAGE = 100


def classify(pdf_bytes: bytes) -> str:
    """Return 'text' if the PDF has a usable text layer, else 'scanned'."""
    try:
        import pymupdf  # PyMuPDF
    except Exception:
        return "text"  # if PyMuPDF unavailable, fall back to sending the PDF as-is
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        n = doc.page_count or 1
        # sample up to the first 10 pages for speed
        sample = min(n, 10)
        total = 0
        for i in range(sample):
            total += len(doc[i].get_text("text").strip())
        doc.close()
        return "text" if (total / sample) >= _MIN_CHARS_PER_PAGE else "scanned"
    except Exception:
        return "text"


def to_markdown(pdf_bytes: bytes) -> str | None:
    """Extract the PDF as LLM-friendly Markdown (tables preserved). None on error."""
    try:
        import pymupdf4llm
        import pymupdf
    except Exception:
        return None
    tmp_path = None
    try:
        # pymupdf4llm wants a path or an opened Document; use a temp file.
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(pdf_bytes)
            tmp_path = tmp.name
        # pymupdf4llm prints a per-page progress bar to stdout; silence it so it
        # doesn't flood the server logs.
        import contextlib
        import io
        with contextlib.redirect_stdout(io.StringIO()):
            md = pymupdf4llm.to_markdown(tmp_path, show_progress=False)
        return (md or "").strip() or None
    except Exception:
        return None
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass

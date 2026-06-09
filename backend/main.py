"""
main.py — DBR Compliance Checker API (FastAPI)

Wraps the provided deterministic engine (checker_core + checks) in an extraction
pipeline + REST API. The engine is the source of truth for all verdicts; this
layer only extracts/normalizes input, enriches citations, and persists reports.

Endpoints:
  POST /api/analyze        multipart PDF -> extract -> normalize -> run_all ->
                           enrich -> save -> {report_id, extracted, findings, summary}
  POST /api/check          edited DBRData JSON -> run_all -> enrich (no re-extract);
                           ?report_id=... updates the saved report
  GET  /api/clause/{id}    full corpus clause/table object (citation drawer)
  GET  /api/reports        saved report history (list)
  GET  /api/reports/{id}   one saved report (full)
  GET  /api/health
"""
from __future__ import annotations

import os
from collections import Counter

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv()

from checks import run_all, report as build_report  # noqa: E402
from corpus_loader import UTF8Corpus  # noqa: E402
from db import Report, get_session, init_db  # noqa: E402
from enrich import enrich_report  # noqa: E402
from explain import explain_findings  # noqa: E402
from extract import ExtractionError, extract_dbr  # noqa: E402
from normalize import build_dbr, dbr_to_dict  # noqa: E402

CORPUS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "corpus")

app = FastAPI(title="DBR Compliance Checker", version="0.4.1")

# CORS — allow the Vercel frontend (comma-separated origins) + localhost dev.
_origins = [o.strip() for o in os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the corpus ONCE at startup (UTF-8 safe so every code's clause text loads).
corpus = UTF8Corpus(CORPUS_DIR)

# Ensure tables exist at import time (idempotent) so the app works whether or not
# the ASGI startup hook has fired (e.g. under TestClient without a context mgr).
init_db()


@app.on_event("startup")
def _startup() -> None:
    init_db()


# --------------------------------------------------------------------------- #
#  Helpers
# --------------------------------------------------------------------------- #
def _overall_status(summary: dict) -> str:
    """Roll a verdict-count summary into one headline status."""
    if summary.get("FLAW"):
        return "FLAW"
    if summary.get("MISSING"):
        return "MISSING"
    if summary.get("REVIEW"):
        return "REVIEW"
    return "PASS"


def _run_and_enrich(dbr) -> dict:
    rep = enrich_report(build_report(run_all(dbr, corpus)), corpus)
    rep["summary"] = dict(Counter(f["verdict"] for f in rep["findings"]))
    rep["overall_status"] = _overall_status(rep["summary"])
    return rep


def _persist(db: Session, *, filename, extracted, rep, model, report_id=None) -> Report:
    row = db.get(Report, report_id) if report_id else None
    if row is None:
        row = Report()
        db.add(row)
    row.filename = filename
    row.extraction_model = model
    row.extracted = extracted
    row.findings = rep["findings"]
    row.summary = rep["summary"]
    row.overall_status = rep["overall_status"]
    row.flaw_count = rep["summary"].get("FLAW", 0)
    row.check_count = len(rep["findings"])
    db.commit()
    db.refresh(row)
    return row


# --------------------------------------------------------------------------- #
#  Schemas
# --------------------------------------------------------------------------- #
class CheckRequest(BaseModel):
    extracted: dict           # a DBRData dict (possibly edited by the user)
    report_id: str | None = None
    filename: str | None = None


# --------------------------------------------------------------------------- #
#  Endpoints
# --------------------------------------------------------------------------- #
@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "corpus_files": len(corpus.files),
        "clauses_indexed": len(corpus.by_id),
        "extraction_configured": bool(os.getenv("OPENROUTER_API_KEY")),
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...), db: Session = Depends(get_session)) -> dict:
    if file.content_type not in ("application/pdf", "application/octet-stream") \
            and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(400, "Uploaded file is empty.")

    try:
        raw = await extract_dbr(pdf_bytes, file.filename or "dbr.pdf")
    except ExtractionError as e:
        raise HTTPException(502, f"Extraction failed: {e}")

    model = raw.pop("_extraction_model", None)
    provenance = raw.get("_provenance")
    dbr = build_dbr(raw)
    extracted = dbr_to_dict(dbr)
    if provenance:
        extracted["_provenance"] = provenance

    rep = _run_and_enrich(dbr)
    # Plain-English explanations for the findings that matter (best-effort).
    await explain_findings(rep["findings"])
    row = _persist(db, filename=file.filename, extracted=extracted, rep=rep, model=model)

    return {
        "report_id": row.id,
        "extracted": extracted,
        "findings": rep["findings"],
        "summary": rep["summary"],
        "overall_status": rep["overall_status"],
        "extraction_model": model,
    }


@app.post("/api/check")
def check(req: CheckRequest, db: Session = Depends(get_session)) -> dict:
    """Re-run checks on (edited) DBRData without re-extracting."""
    dbr = build_dbr(req.extracted)
    extracted = dbr_to_dict(dbr)
    rep = _run_and_enrich(dbr)

    report_id = req.report_id
    if report_id:
        row = _persist(db, filename=req.filename, extracted=extracted, rep=rep,
                       model=None, report_id=report_id)
        report_id = row.id

    return {
        "report_id": report_id,
        "extracted": extracted,
        "findings": rep["findings"],
        "summary": rep["summary"],
        "overall_status": rep["overall_status"],
    }


@app.get("/api/clause/{clause_id}")
def clause(clause_id: str) -> dict:
    obj = corpus.get(clause_id)
    if obj is None:
        raise HTTPException(404, f"No corpus object with id '{clause_id}'.")
    return obj


@app.get("/api/reports")
def list_reports(limit: int = 50, db: Session = Depends(get_session)) -> dict:
    rows = (db.query(Report)
              .order_by(Report.created_at.desc())
              .limit(min(limit, 200)).all())
    return {"reports": [r.list_item() for r in rows]}


@app.get("/api/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_session)) -> dict:
    row = db.get(Report, report_id)
    if row is None:
        raise HTTPException(404, "Report not found.")
    return row.full()


# --------------------------------------------------------------------------- #
#  Admin (passcode-gated stats dashboard)
# --------------------------------------------------------------------------- #
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "aiplanner04@gmail.com")
# In dev the passcode defaults to "admin"; set ADMIN_PASSCODE in prod.
ADMIN_PASSCODE = os.getenv("ADMIN_PASSCODE", "admin")


def _require_admin(x_admin_passcode: str | None) -> None:
    if not ADMIN_PASSCODE or x_admin_passcode != ADMIN_PASSCODE:
        raise HTTPException(401, "Invalid admin passcode.")


@app.get("/api/admin/stats")
def admin_stats(x_admin_passcode: str | None = Header(default=None),
                db: Session = Depends(get_session)) -> dict:
    """Aggregate stats over all saved reports. Passcode in X-Admin-Passcode header."""
    _require_admin(x_admin_passcode)

    rows = db.query(Report).order_by(Report.created_at.desc()).all()
    total = len(rows)

    # verdict totals across every finding of every report
    verdict_totals: dict[str, int] = {}
    status_totals: dict[str, int] = {}
    check_flaws: dict[str, int] = {}   # which D-checks fail most
    total_findings = 0
    total_flaws = 0
    reports_with_flaws = 0

    for r in rows:
        for v, n in (r.summary or {}).items():
            verdict_totals[v] = verdict_totals.get(v, 0) + n
            total_findings += n
        if r.overall_status:
            status_totals[r.overall_status] = status_totals.get(r.overall_status, 0) + 1
        if (r.flaw_count or 0) > 0:
            reports_with_flaws += 1
        total_flaws += r.flaw_count or 0
        for f in (r.findings or []):
            if f.get("verdict") in ("FLAW", "MISSING"):
                cid = f.get("check_id", "?")
                check_flaws[cid] = check_flaws.get(cid, 0) + 1

    top_flaws = sorted(check_flaws.items(), key=lambda kv: kv[1], reverse=True)[:8]

    recent = [{
        "id": r.id, "filename": r.filename,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "overall_status": r.overall_status, "flaw_count": r.flaw_count,
        "check_count": r.check_count,
    } for r in rows[:15]]

    return {
        "admin_email": ADMIN_EMAIL,
        "totals": {
            "reports": total,
            "findings": total_findings,
            "flaws": total_flaws,
            "reports_with_flaws": reports_with_flaws,
            "clean_reports": total - reports_with_flaws,
            "avg_flaws_per_report": round(total_flaws / total, 2) if total else 0,
        },
        "verdict_totals": verdict_totals,
        "status_totals": status_totals,
        "top_flagged_checks": [{"check_id": c, "count": n} for c, n in top_flaws],
        "recent_reports": recent,
        "extraction_model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6"),
    }

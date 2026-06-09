"""
enrich.py

Pipeline step [5]: after run_all, attach the actual IS-code clause/table text to
each finding so the UI citation drawer can show the real code, not just a label.

A finding's citation is a free string like:
    "IS 1893:2016 Tables 3, 8, 9"
    "IS 16700:2023, Cl 5.5.2, 6.3.4"
    "IS 456 Table 16"
We parse out (code, [clause/table refs]) and match against corpus objects by
their `code` + `clause` fields (and table id heuristics). Text is kept short;
the corpus remains the source of truth.

Adds finding["citations"] = [ {id, code, clause, content_type, title, statement,
                               page, missing?} ]
without mutating the engine's Finding objects (works on the report() dicts).
"""
from __future__ import annotations

import re
from typing import Any

from checker_core import Corpus

# "IS 16700:2023", "IS 875-3:2015", "IS 456", "NBC 2016 Part 4"
_CODE_RE = re.compile(r"(IS\s*\d+(?:[-\s]Part\s*\d+|\s*\(Part\s*\d+\))?(?:[-]\d+)?|NBC\s*\d{4}(?:\s*Part\s*\d+)?)",
                      re.IGNORECASE)
_YEAR_RE = re.compile(r":\s*(\d{4})")
_CLAUSE_RE = re.compile(r"Cl\.?\s*([\d.]+[A-Za-z]?)", re.IGNORECASE)
# Matches "Table 16", and the plural/list form "Tables 3, 8, 9" (captures the
# whole numeric tail so we can split it into individual table numbers).
_TABLE_RE = re.compile(r"Tables?\s*([\d]+[A-Za-z]?(?:\s*[,/&]\s*\d+[A-Za-z]?)*)", re.IGNORECASE)
_FIG_RE = re.compile(r"Fig\.?\s*([\d]+[A-Za-z]?)", re.IGNORECASE)

_MAX_STATEMENT = 600  # keep quoted code text short

# Several corpus files leave `code` null and encode it in the object id prefix
# (e.g. "IS1893-1-2016_6.1.5", "IS875-3-2015_6.3", "NBC-4-2016_3.1.1"). Map those
# id prefixes to the same normalised code space used in finding citations.
_ID_PREFIX_TO_CODE = [
    (re.compile(r"^IS1893-1-\d{4}"), "IS 1893"),
    (re.compile(r"^IS875-3-\d{4}"), "IS 875"),
    (re.compile(r"^IS875-5-\d{4}"), "IS 875"),
    (re.compile(r"^IS269-\d{4}"), "IS 269"),
    (re.compile(r"^IS1489"), "IS 1489"),
    (re.compile(r"^NBC-4-\d{4}"), "NBC 2016"),
    (re.compile(r"^NBC2005"), "NBC 2005"),
]


def _norm_code(s: str) -> str:
    """'IS  16700:2023' / 'IS 875-3:2015' -> loose 'IS 16700' / 'IS 875' for matching."""
    s = re.sub(r"\s+", " ", (s or "").strip())
    s = re.sub(r":\s*\d{4}.*$", "", s)          # drop year
    s = re.sub(r"[-\s]Part\s*\d+", "", s, flags=re.IGNORECASE)
    s = re.sub(r"\(Part\s*\d+\)", "", s, flags=re.IGNORECASE)
    s = re.sub(r"-\d+$", "", s)                 # 'IS 875-3' -> 'IS 875'
    return re.sub(r"\s+", " ", s).strip().upper()


def _clause_text(obj: dict) -> str:
    # Prose clauses
    txt = obj.get("text") or obj.get("statement") or obj.get("content")
    # Tables/figures keep their content in caption / nl_summary (+ rows).
    if not txt:
        parts = []
        if obj.get("caption"):
            parts.append(str(obj["caption"]))
        elif obj.get("nl_summary"):
            parts.append(str(obj["nl_summary"]))
        rows = obj.get("rows")
        headers = obj.get("headers")
        if isinstance(rows, list) and rows:
            if isinstance(headers, list) and headers:
                parts.append(" | ".join(str(h) for h in headers))
            for r in rows[:8]:
                if isinstance(r, list):
                    parts.append(" | ".join(str(c) for c in r))
        txt = "\n".join(parts)
    if isinstance(txt, (dict, list)):
        txt = str(txt)
    txt = str(txt or "").strip()
    return (txt[:_MAX_STATEMENT] + "…") if len(txt) > _MAX_STATEMENT else txt


def _obj_code(oid: str, obj: dict) -> str:
    """Normalised code from the `code` field, else inferred from the id prefix."""
    if obj.get("code"):
        return _norm_code(str(obj["code"]))
    for rx, code in _ID_PREFIX_TO_CODE:
        if rx.match(oid):
            return code
    return ""


def _match_clause(corpus: Corpus, code: str, clause: str) -> list[dict]:
    code_n = _norm_code(code)
    want = clause.strip()
    exact, prefixed = [], []
    for oid, obj in corpus.by_id.items():
        if not isinstance(obj, dict) or _obj_code(oid, obj) != code_n:
            continue
        cl = str(obj.get("clause", "")).strip()
        if cl == want:
            exact.append((oid, obj))
        elif cl.startswith(want + ".") or cl.startswith(want + "("):
            # cited parent (7.11.1) resolves to its sub-clauses (7.11.1.1, ...)
            prefixed.append((oid, obj))
    return exact or prefixed


def _match_table(corpus: Corpus, code: str, table_no: str) -> list[dict]:
    """
    Match a table across both corpus schemas:
      - IS 456 file: table objects with ids like 'table_16_nominal_cover_durability'
      - IS 1893/875/269 files: clause field is literally 'Table 16'
    """
    code_n = _norm_code(code)
    id_needle = re.compile(rf"table[_\s]*{re.escape(table_no)}(?:[_\b]|$)", re.IGNORECASE)
    clause_needle = re.compile(rf"^Table\s*{re.escape(table_no)}$", re.IGNORECASE)
    out = []
    for oid, obj in corpus.by_id.items():
        if not isinstance(obj, dict) or _obj_code(oid, obj) != code_n:
            continue
        if obj.get("content_type") == "table" and id_needle.search(oid):
            out.append((oid, obj))
        elif clause_needle.match(str(obj.get("clause", "")).strip()):
            out.append((oid, obj))
    return out


def _hit_to_dict(oid: str, obj: dict) -> dict:
    return {
        "id": oid,
        "code": obj.get("code"),
        "clause": obj.get("clause"),
        "content_type": obj.get("content_type", "clause"),
        "title": obj.get("title"),
        "statement": _clause_text(obj),
        "page": obj.get("page"),
    }


def resolve_citation(corpus: Corpus, citation: str) -> list[dict]:
    """Parse a finding citation string -> list of matched corpus objects."""
    if not citation:
        return []
    hits: list[dict] = []
    seen: set[str] = set()

    # split on ';' so multi-code citations resolve each segment to its own code
    segments = [s for s in re.split(r";", citation) if s.strip()] or [citation]
    for seg in segments:
        codes = _CODE_RE.findall(seg)
        code = _norm_code(codes[0]) if codes else None
        if not code:
            continue
        for cl in _CLAUSE_RE.findall(seg):
            for oid, obj in _match_clause(corpus, code, cl):
                if oid not in seen:
                    seen.add(oid); hits.append(_hit_to_dict(oid, obj))
        for tb_group in _TABLE_RE.findall(seg):
            for tb in re.split(r"\s*[,/&]\s*", tb_group):  # "3, 8, 9" -> 3,8,9
                tb = tb.strip()
                if not tb:
                    continue
                for oid, obj in _match_table(corpus, code, tb):
                    if oid not in seen:
                        seen.add(oid); hits.append(_hit_to_dict(oid, obj))

    # Record codes we recognised but found no clause text for (e.g. IS 16700 not
    # yet in the corpus) so the UI can show "clause text unavailable" honestly.
    if not hits:
        for code in {_norm_code(c) for c in _CODE_RE.findall(citation)}:
            hits.append({"id": None, "code": code, "clause": None,
                         "content_type": None, "title": None,
                         "statement": None, "page": None, "missing": True})
    return hits


def enrich_report(report: dict, corpus: Corpus) -> dict:
    """Attach `citations` (resolved corpus objects) to each finding dict."""
    for f in report.get("findings", []):
        f["citations"] = resolve_citation(corpus, f.get("citation") or "")
    return report

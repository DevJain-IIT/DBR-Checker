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
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

load_dotenv()

from auth import (decode_token, hash_password, make_token,  # noqa: E402
                  seed_first_admin, verify_password)
from checks import run_all, report as build_report  # noqa: E402
from corpus_loader import UTF8Corpus  # noqa: E402
from db import Admin, Report, SessionLocal, get_session, init_db  # noqa: E402
from enrich import enrich_report  # noqa: E402
from explain import explain_one_finding  # noqa: E402
from extract import ExtractionError, extract_dbr  # noqa: E402
from normalize import build_dbr, dbr_to_dict, location_status, lookup_district  # noqa: E402

import datetime as _dt  # noqa: E402
import re as _re  # noqa: E402

_EMAIL_RE = _re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _valid_email(email: str) -> bool:
    return bool(email and _EMAIL_RE.match(email))


def _now_utc() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


def _normalize_provenance(prov) -> dict:
    """Coerce the LLM's _provenance into a flat {field_path: page:int} map.

    The model is asked for {field: {page, snippet}}, but be liberal: also accept
    {field: page}, {field: "p.4"}, or a nested page under other keys. Anything we
    can't read a positive page number out of is dropped. The frontend uses this to
    show 'you stated this on p.X of your DBR' next to a flaw."""
    if not isinstance(prov, dict):
        return {}
    out: dict = {}
    for key, val in prov.items():
        page = None
        if isinstance(val, dict):
            page = val.get("page")
        else:
            page = val
        # accept ints, numeric strings, or "p.4"/"page 4"
        if isinstance(page, bool):
            continue
        if isinstance(page, (int, float)):
            page = int(page)
        elif isinstance(page, str):
            m = _re.search(r"\d+", page)
            page = int(m.group()) if m else None
        else:
            page = None
        if isinstance(page, int) and page > 0:
            out[str(key)] = page
    return out

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

import logging  # noqa: E402
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("dbr")

# Load the corpus ONCE at startup (UTF-8 safe so every code's clause text loads).
corpus = UTF8Corpus(CORPUS_DIR)

# Ensure tables exist at import time (idempotent). Wrapped so a transient DB
# blip at import time can't crash the whole process into a Render restart loop —
# the startup hook retries init_db() once the app is up.
try:
    init_db()
except Exception as e:  # noqa: BLE001
    log.warning("init_db at import time failed (will retry on startup): %s", e)


@app.on_event("startup")
def _startup() -> None:
    try:
        init_db()
    except Exception:
        log.exception("init_db failed on startup")
    # Seed the first admin from env if the admins table is empty.
    try:
        db = SessionLocal()
        try:
            seed_first_admin(db)
        finally:
            db.close()
    except Exception:
        log.exception("seed_first_admin failed")
    # Seed/refresh the district lookup from the CSV (idempotent upsert).
    try:
        from scripts.seed_districts import main as seed_districts
        seed_districts()
        from normalize import _reset_district_cache
        _reset_district_cache()  # ensure the lookup cache reflects seeded data
    except Exception:
        # never block startup on seeding, but log the full traceback so failures
        # are visible in Render logs (not silently swallowed).
        log.exception("district seeding skipped")


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


def _persist(db: Session, *, filename, extracted, rep, model, report_id=None, user_email=None) -> Report:
    row = db.get(Report, report_id) if report_id else None
    if row is None:
        row = Report()
        db.add(row)
    row.filename = filename
    if user_email is not None:
        row.user_email = user_email
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
    user_email: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class CreateAdminRequest(BaseModel):
    email: str
    password: str


class ChangePasswordRequest(BaseModel):
    password: str


class ExplainRequest(BaseModel):
    finding: dict            # a single enriched finding dict to explain on demand


# --------------------------------------------------------------------------- #
#  Endpoints
# --------------------------------------------------------------------------- #
@app.api_route("/api/health", methods=["GET", "HEAD"])
def health() -> dict:
    # HEAD is allowed so uptime monitors (UptimeRobot) get a clean 200 instead
    # of 405 — it's their HEAD pings that keep the free instance warm.
    return {
        "status": "ok",
        "corpus_files": len(corpus.files),
        "clauses_indexed": len(corpus.by_id),
        "extraction_configured": bool(os.getenv("OPENROUTER_API_KEY")),
    }


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...),
                  user_email: str = Form(...),
                  db: Session = Depends(get_session)) -> dict:
    email = (user_email or "").strip().lower()
    if not _valid_email(email):
        raise HTTPException(400, "A valid email is required to run an analysis.")
    if file.content_type not in ("application/pdf", "application/octet-stream") \
            and not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Please upload a PDF file.")
    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(400, "Uploaded file is empty.")

    try:
        raw = await extract_dbr(pdf_bytes, file.filename or "dbr.pdf")
    except ExtractionError as e:
        log.warning("extraction failed for %s: %s", file.filename, e)
        raise HTTPException(
            502,
            "Couldn't read this PDF. It may be image-only, corrupted, or in an "
            "unusual format. Try re-saving it (Print to PDF / flatten) and upload again.",
        )

    model = raw.pop("_extraction_model", None)
    pdf_kind = raw.pop("_pdf_kind", None)
    raw.pop("_used_markdown", None)
    provenance = _normalize_provenance(raw.get("_provenance"))
    try:
        dbr = build_dbr(raw)
        extracted = dbr_to_dict(dbr)
        if provenance:
            extracted["_provenance"] = provenance
        rep = _run_and_enrich(dbr)
    except Exception as e:
        raise HTTPException(422, f"Could not interpret the extracted data: {e}")

    # NOTE: we no longer auto-generate AI explanations here. That used to fire
    # one model call per FLAW/MISSING finding on EVERY upload (slow + costly even
    # if never read). Explanations are now strictly on-demand via the per-check
    # "Explain with AI" button -> /api/explain. So each upload is just 1 model
    # call (extraction). explain_findings() remains available but is unused here.
    row = _persist(db, filename=file.filename, extracted=extracted, rep=rep,
                   model=model, user_email=email)

    return {
        "report_id": row.id,
        "extracted": extracted,
        "findings": rep["findings"],
        "summary": rep["summary"],
        "overall_status": rep["overall_status"],
        "extraction_model": model,
        "pdf_kind": pdf_kind,
        "user_email": email,
        "location": location_status(dbr.profile),
    }


@app.post("/api/check")
def check(req: CheckRequest, db: Session = Depends(get_session)) -> dict:
    """Re-run checks on (edited) DBRData without re-extracting."""
    if not isinstance(req.extracted, dict) or not isinstance(req.extracted.get("profile", {}), dict):
        raise HTTPException(422, "Invalid extracted data: 'profile' must be an object.")
    try:
        dbr = build_dbr(req.extracted)
        extracted = dbr_to_dict(dbr)
        # carry the DBR-page provenance through a recheck (build_dbr drops it),
        # so "you stated this on p.X" survives editing.
        provenance = _normalize_provenance(req.extracted.get("_provenance"))
        if provenance:
            extracted["_provenance"] = provenance
        rep = _run_and_enrich(dbr)
    except Exception as e:
        raise HTTPException(422, f"Could not interpret the edited data: {e}")

    report_id = req.report_id
    if report_id:
        row = _persist(db, filename=req.filename, extracted=extracted, rep=rep,
                       model=None, report_id=report_id, user_email=req.user_email)
        report_id = row.id

    return {
        "report_id": report_id,
        "extracted": extracted,
        "findings": rep["findings"],
        "summary": rep["summary"],
        "overall_status": rep["overall_status"],
        "location": location_status(dbr.profile),
    }


@app.post("/api/explain")
async def explain(req: ExplainRequest) -> dict:
    """On-demand plain-English explanation for a single finding (the 'Explain
    with AI' button). Returns {explanation} or 503 if AI is unavailable."""
    if not isinstance(req.finding, dict) or not req.finding.get("check_id"):
        raise HTTPException(422, "A finding object with a check_id is required.")
    text = await explain_one_finding(req.finding)
    if not text:
        raise HTTPException(503, "AI explanation is unavailable right now.")
    return {"explanation": text}


@app.get("/api/clause/{clause_id}")
def clause(clause_id: str) -> dict:
    obj = corpus.get(clause_id)
    if obj is None:
        raise HTTPException(404, f"No corpus object with id '{clause_id}'.")
    return obj


@app.get("/api/location")
def location(district: str, state: str | None = None) -> dict:
    """
    District -> seismic zone (+ Vb where known) from the lookup table.
    Straddler districts return both zones + needs_coordinates=true (precise
    lat/long resolution is upcoming). Returns matched=false if not found.
    """
    row = lookup_district(district, state)
    if not row:
        return {"district": district, "matched": False,
                "message": f"District '{district}' not found in the lookup."}
    return {"matched": True, **row,
            "needs_coordinates": bool(row.get("is_straddler"))}


# India bounding box (generous, includes islands) for the coordinate lookup.
_LAT_MIN, _LAT_MAX = 6.0, 38.0
_LON_MIN, _LON_MAX = 68.0, 98.0


@app.get("/api/location/zone")
def location_zone(lat: float, lon: float) -> dict:
    """
    Precise lat/long -> IS 1893 seismic zone via point-in-polygon over the
    district x zone overlay. Resolver is loaded lazily on first call. Returns the
    exact zone, the district the point falls in, and a boundary_case flag (point
    near a zone line -> higher zone returned, conservative).
    """
    if not (_LAT_MIN <= lat <= _LAT_MAX and _LON_MIN <= lon <= _LON_MAX):
        raise HTTPException(400, f"Coordinates outside India "
                                 f"(lat {_LAT_MIN}-{_LAT_MAX}, lon {_LON_MIN}-{_LON_MAX}).")
    try:
        from zone_resolver import get_resolver
        res = get_resolver().lookup(lat, lon)
    except Exception as e:
        raise HTTPException(503, f"Zone resolver unavailable: {e}")
    if res is None:
        raise HTTPException(404, "No zone polygon at this point (sea, or outside the digitised boundary).")
    note = ("Point lies on/near a zone boundary; the higher (conservative) zone "
            "is returned per IS 1893 practice.") if res["boundary_case"] else None
    return {
        "lat": lat, "lon": lon,
        "seismic_zone": res["zone"],
        "district": res["district"],
        "state": res["state"],
        "msk_intensity": res["intensity"],
        "boundary_case": res["boundary_case"],
        "note": note,
        "citation": "IS 1893 (Part 1):2016, Fig. 1 / Annex E",
        "method": "point-in-polygon (district x zone overlay, EPSG:4326)",
    }


@app.get("/api/reports")
def list_reports(limit: int = 50, email: str | None = None,
                 db: Session = Depends(get_session)) -> dict:
    """List saved reports. Pass ?email=... to get only that user's reports."""
    q = db.query(Report)
    if email:
        q = q.filter(Report.user_email == email.strip().lower())
    rows = q.order_by(Report.created_at.desc()).limit(min(limit, 200)).all()
    return {"reports": [r.list_item() for r in rows]}


@app.get("/api/reports/{report_id}")
def get_report(report_id: str, db: Session = Depends(get_session)) -> dict:
    row = db.get(Report, report_id)
    if row is None:
        raise HTTPException(404, "Report not found.")
    return row.full()


# --------------------------------------------------------------------------- #
#  Admin (email + password login, JWT-token-gated)
# --------------------------------------------------------------------------- #
def _current_admin(authorization: str | None, db: Session) -> Admin:
    """Resolve the logged-in admin from the Authorization: Bearer <token> header."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Admin login required.")
    token = authorization.split(" ", 1)[1].strip()
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "Session expired — please sign in again.")
    admin = db.get(Admin, payload.get("sub"))
    if admin is None:
        raise HTTPException(401, "Admin no longer exists.")
    return admin


@app.post("/api/admin/login")
def admin_login(req: LoginRequest, db: Session = Depends(get_session)) -> dict:
    email = (req.email or "").strip().lower()
    admin = db.query(Admin).filter(Admin.email == email).first()
    if admin is None or not verify_password(req.password, admin.password_hash):
        raise HTTPException(401, "Invalid email or password.")
    admin.last_login_at = _now_utc()
    db.commit()
    return {"token": make_token(admin), "admin": admin.public()}


@app.get("/api/admin/me")
def admin_me(authorization: str | None = Header(default=None),
             db: Session = Depends(get_session)) -> dict:
    admin = _current_admin(authorization, db)
    return {"admin": admin.public()}


@app.get("/api/admin/admins")
def list_admins(authorization: str | None = Header(default=None),
                db: Session = Depends(get_session)) -> dict:
    _current_admin(authorization, db)
    rows = db.query(Admin).order_by(Admin.created_at.asc()).all()
    return {"admins": [a.public() for a in rows]}


@app.post("/api/admin/admins")
def create_admin(req: CreateAdminRequest, authorization: str | None = Header(default=None),
                 db: Session = Depends(get_session)) -> dict:
    _current_admin(authorization, db)
    email = (req.email or "").strip().lower()
    if not _valid_email(email):
        raise HTTPException(400, "A valid email is required.")
    if len(req.password or "") < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    if db.query(Admin).filter(Admin.email == email).first():
        raise HTTPException(409, "An admin with that email already exists.")
    admin = Admin(email=email, password_hash=hash_password(req.password))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return {"admin": admin.public()}


@app.delete("/api/admin/admins/{admin_id}")
def delete_admin(admin_id: str, authorization: str | None = Header(default=None),
                 db: Session = Depends(get_session)) -> dict:
    me = _current_admin(authorization, db)
    if admin_id == me.id:
        raise HTTPException(400, "You can't remove your own admin account while signed in.")
    target = db.get(Admin, admin_id)
    if target is None:
        raise HTTPException(404, "Admin not found.")
    if db.query(Admin).count() <= 1:
        raise HTTPException(400, "Can't remove the last admin.")
    db.delete(target)
    db.commit()
    return {"ok": True}


@app.post("/api/admin/admins/{admin_id}/password")
def change_admin_password(admin_id: str, req: ChangePasswordRequest,
                          authorization: str | None = Header(default=None),
                          db: Session = Depends(get_session)) -> dict:
    _current_admin(authorization, db)
    if len(req.password or "") < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")
    target = db.get(Admin, admin_id)
    if target is None:
        raise HTTPException(404, "Admin not found.")
    target.password_hash = hash_password(req.password)
    db.commit()
    return {"ok": True}


@app.get("/api/admin/stats")
def admin_stats(authorization: str | None = Header(default=None),
                db: Session = Depends(get_session)) -> dict:
    """Aggregate stats over all saved reports. Requires a valid admin token."""
    admin = _current_admin(authorization, db)

    rows = db.query(Report).order_by(Report.created_at.desc()).all()
    total = len(rows)

    verdict_totals: dict[str, int] = {}
    status_totals: dict[str, int] = {}
    check_flaws: dict[str, int] = {}
    user_counts: dict[str, int] = {}
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
        if r.user_email:
            user_counts[r.user_email] = user_counts.get(r.user_email, 0) + 1
        for f in (r.findings or []):
            if f.get("verdict") in ("FLAW", "MISSING"):
                cid = f.get("check_id", "?")
                check_flaws[cid] = check_flaws.get(cid, 0) + 1

    top_flaws = sorted(check_flaws.items(), key=lambda kv: kv[1], reverse=True)[:8]
    top_users = sorted(user_counts.items(), key=lambda kv: kv[1], reverse=True)[:10]

    recent = [{
        "id": r.id, "filename": r.filename, "user_email": r.user_email,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "overall_status": r.overall_status, "flaw_count": r.flaw_count,
        "check_count": r.check_count,
    } for r in rows[:15]]

    return {
        "admin_email": admin.email,
        "totals": {
            "reports": total,
            "findings": total_findings,
            "flaws": total_flaws,
            "reports_with_flaws": reports_with_flaws,
            "clean_reports": total - reports_with_flaws,
            "avg_flaws_per_report": round(total_flaws / total, 2) if total else 0,
            "unique_users": len(user_counts),
        },
        "verdict_totals": verdict_totals,
        "status_totals": status_totals,
        "top_flagged_checks": [{"check_id": c, "count": n} for c, n in top_flaws],
        "top_users": [{"email": e, "count": n} for e, n in top_users],
        "recent_reports": recent,
        "extraction_model": os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6"),
    }

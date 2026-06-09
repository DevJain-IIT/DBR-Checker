# DBR Compliance Checker

A web tool where a structural engineer uploads a **Design Basis Report (DBR)** as a PDF and gets back a **findings report**: 25 checks (D1–D25) against Indian Standard structural codes, each with a verdict (PASS / FLAW / REVIEW / MISSING / NOT_APPLICABLE), an expected-vs-found comparison, and the exact IS-code clause citation.

A feature of **CivilSpace**; sibling to **Claused**. Built as a standalone, deployable site.

> The compliance logic is **deterministic and provided** (`backend/checks.py` + `backend/checker_core.py`). This app wraps it in an extraction pipeline + API + UI. The IS-code corpus (`backend/corpus/*.json`) is the single source of truth for citations and numeric tables. **The check logic, thresholds, and verdicts are not modified.**

---

## Architecture

```
PDF upload (Next.js, Vercel)
   │  POST /api/analyze (multipart)
   ▼
FastAPI (Render)
   [1] Extract    → OpenRouter (OpenAI-compatible), reads the PDF → structured JSON
   [2] Normalize  → normalize.py: canonical enums/units, M30→30, Zone-IV→IV, ...
   [3] Build      → DBRData + BuildingProfile dataclasses
   [4] Run checks → run_all(dbr, corpus)   # the 25 checks, unchanged
   [5] Enrich     → attach real IS-clause text from the corpus; roll up summary
   [6] Persist    → save report to Postgres (history)
   ▼
{ report_id, extracted, findings, summary, overall_status }
```

| Layer | Tech | Host |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind | Vercel |
| Backend | FastAPI (Python 3.12) | Render |
| Database | Postgres (SQLAlchemy + Alembic) | Render |
| Extraction | OpenRouter API (default `anthropic/claude-3.5-sonnet`) | — |
| Corpus | IS-code JSON, loaded in-memory at startup | — |

---

## Repository layout

```
backend/
  main.py            FastAPI app: endpoints, pipeline, enrichment, persistence
  checker_core.py    PROVIDED — contracts, Corpus, lookup tables (not modified)
  checks.py          PROVIDED — the 25 checks D1–D25, run_all, report (not modified)
  corpus_loader.py   UTF8Corpus: UTF-8-safe corpus loader (Windows-safe)
  normalize.py       raw extraction dict → DBRData/BuildingProfile
  extract.py         OpenRouter PDF → structured JSON (Section 7 prompt verbatim)
  enrich.py          finding citation strings → real corpus clause/table text
  db.py              Postgres models (reports table); SQLite fallback in dev
  alembic/           migrations (initial: create reports table)
  scripts/repair_corpus.py   one-time fix for file_for_DBR.json (runs on deploy)
  corpus/            the IS-code *.json files
  requirements.txt
  render.yaml        Render blueprint (web service + Postgres)
frontend/
  app/               landing (/), upload (/upload), report (/report/[id]), history (/history)
  components/        SummaryBar, ExtractedPanel, FindingCard (+ CitationDrawer, CategorySection)
  lib/               types.ts (contract mirror), api.ts, design.tsx (tokens/icons), format.ts
  tailwind.config.ts design tokens from the provided mockups
```

---

## Run locally

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Windows
# source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
python scripts/repair_corpus.py   # one-time corpus fix (idempotent)

cp .env.example .env              # then edit .env
# Minimum to run extraction:  OPENROUTER_API_KEY=sk-or-...
# DATABASE_URL unset → uses local SQLite (./dbr_reports.db)

uvicorn main:app --reload --port 8000
```

Verify: <http://localhost:8000/api/health> →
`{"status":"ok","corpus_files":9,"clauses_indexed":244,"extraction_configured":true}`

Smoke-test the engine (prints 3 demo summaries, unchanged):
```bash
python -c "from corpus_loader import UTF8Corpus; from checks import run_all, report; ..."
# or simply confirm health shows 244 clauses indexed
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local  # NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev                       # http://localhost:3000
```

Open <http://localhost:3000>, click **Upload a DBR**, drop a PDF, and you get the report.

---

## Environment variables

### Backend (`backend/.env`)
| Var | Required | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` | yes (for extraction) | from <https://openrouter.ai> |
| `OPENROUTER_MODEL` | no | default `anthropic/claude-3.5-sonnet` |
| `OPENROUTER_FALLBACK_MODELS` | no | comma-separated; default Opus 4.8 + Gemini 2.5 Flash |
| `OPENROUTER_EXPLAIN_MODEL` | no | model for AI explanations; default `anthropic/claude-haiku-4.5` |
| `DATABASE_URL` | prod | Render Postgres URL; unset → local SQLite |
| `CORS_ORIGINS` | prod | your Vercel URL(s); any `*.vercel.app` is allowed automatically |
| `ADMIN_EMAIL` | no | shown on the admin page; default `aiplanner04@gmail.com` |
| `ADMIN_PASSCODE` | prod | secret to unlock `/admin`; default `admin` in dev — **set this in prod** |

### Frontend (Vercel env)
| Var | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | yes | the Render backend URL, e.g. `https://dbr-checker-api.onrender.com` |

---

## Deploy

### Backend + DB → Render
1. Push this repo to GitHub.
2. Render → **New → Blueprint**, pick the repo. `backend/render.yaml` provisions the web service **and** a Postgres database, wiring `DATABASE_URL` automatically.
3. In the service's **Environment**, set `OPENROUTER_API_KEY` and `CORS_ORIGINS` (your Vercel URL).
4. Migrations: the app auto-creates tables on startup. For controlled schema changes use `alembic upgrade head`.
5. Health check path is `/api/health`.

> Manual alternative: create a Python web service, root `backend/`, build `pip install -r requirements.txt && python scripts/repair_corpus.py`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`, and attach a Render Postgres instance.

### Frontend → Vercel
1. Vercel → **New Project**, import the repo, set **Root Directory** to `frontend/`.
2. Add env var `NEXT_PUBLIC_API_URL` = your Render backend URL.
3. Deploy. Framework preset is auto-detected (Next.js).

---

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/analyze` | multipart PDF → full pipeline (incl. AI explanations for FLAW/MISSING) → `{report_id, extracted, findings, summary, overall_status}` |
| `POST` | `/api/check` | edited `DBRData` JSON → re-run checks (no re-extract); `report_id` updates the saved report |
| `GET`  | `/api/clause/{id}` | full corpus clause/table object (citation drawer) |
| `GET`  | `/api/reports` | saved report history (list) |
| `GET`  | `/api/reports/{id}` | one saved report (full) |
| `GET`  | `/api/admin/stats` | aggregated usage stats; requires `X-Admin-Passcode` header |
| `GET`  | `/api/health` | status + corpus stats |

## Pages
- `/` landing · `/upload` upload+processing · `/report/[id]` findings (editable, re-run, **Export → print-to-PDF**) · `/history` saved reports · `/admin` passcode-gated stats dashboard.

## Features
- **AI explanations** — for each FLAW/MISSING finding, `/api/analyze` calls a small model (`OPENROUTER_EXPLAIN_MODEL`, default `claude-haiku-4.5`) to phrase a plain-English explanation of *why* the verdict holds and the next step. Shown in the citation drawer. **Never changes the verdict** — the engine stays authoritative. No-op without an API key.
- **Export** — the report's **Export** button opens the browser print dialog with a print-styled layout (cover header + verdict counts, page-break-safe finding cards). Save as PDF.
- **Admin dashboard** (`/admin`) — enter `ADMIN_PASSCODE` to see totals, verdict breakdown, most-flagged checks, and recent activity across all saved reports. "Users" = activity (the app has no login system yet).

---

## The 25 checks

D1 Title block · D2 Code-list currency · D3 Exposure & cover · D4 Concrete grades · D5 Reinforcement ductility · D6 Cement spec · D7 Seismic params & method · D8 Period formula & cap · D9 Stiffness modifiers · D10 Seismic-weight LL % · D11 Drift · D12 Diaphragm · D13 Wind params · D14 Load combinations · D15 Foundation · D16 P-Δ / stability · D17 System classification & height · D18 Irregularity · D19 Location basis · D20 Temperature & shrinkage · D21 Dynamic / wind-tunnel · D22 Analysis software · D23 Fire-resistance · D24 Clear-cover philosophy · D25 NBC construction type.

Codes covered: IS 456, IS 1893, IS 13920, IS 875-3/5, IS 16700, IS 269, NBC 2016.

---

## Notes & known gaps

- **`scripts/repair_corpus.py`** fixes `file_for_DBR.json`, which shipped as comma-less concatenated objects without a `{"clauses": …}` wrapper — without it the engine silently drops all IS 456 + IS 13920 clauses. Runs automatically on Render build; run it once locally too.
- **`UTF8Corpus`** loads the corpus with explicit UTF-8 so engineering symbols (≤, →, β, °) don't break the loader on Windows (the provided `Corpus` uses the platform default encoding). The check engine itself is untouched.
- **Citation text for IS 16700 and IS 1893 Annexes is not in the corpus yet.** Those checks still produce correct verdicts (thresholds are coded into `checker_core.py`); the citation drawer shows "clause text not yet in the corpus." Drop `is16700_2023_clauses.json` (and `is875_part3_2015_forcecoeff.json`) into `backend/corpus/` to fill them in.
- The **district → {seismic zone, Vb} resolver** (`normalize.resolve_location`) is a stub; full BMTPC/IS-1893-Annex-E lookup is future work.

## Acceptance criteria (verified)
- ✅ Engine runs unchanged: 244 clauses indexed; 3 demo profiles produce the expected summaries.
- ✅ Low-rise (≤50 m) shows IS 16700 checks D9/D16/D17 as `NOT_APPLICABLE`, not FLAW.
- ✅ A cited withdrawn code (IS 8112) is flagged by D2.
- ✅ Editing an extracted field and hitting **Re-run** updates findings without re-extraction (e.g. D3 cover FLAW → PASS).
- ⏳ End-to-end PDF upload requires `OPENROUTER_API_KEY` (everything downstream of extraction is tested).

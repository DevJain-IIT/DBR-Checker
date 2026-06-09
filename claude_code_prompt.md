# Claude Code Prompt — DBR Compliance Checker (standalone web app)

Paste everything below into Claude Code.

---

## 0. What you're building

A **DBR Compliance Checker** — a web tool where a structural engineer uploads a **Design Basis Report (DBR)** as a PDF, and the system validates it against Indian Standard (IS) structural codes and produces a **findings report**: 25 checks (D1–D25), each with a verdict (PASS / FLAW / REVIEW / MISSING / NOT_APPLICABLE), an expected-vs-found comparison, and the exact IS-code clause citation.

This is a feature of **CivilSpace** (a civil-engineering platform). For now, build it as a **standalone, deployable website** (its own URL) so it can be demoed to people; it will later be embedded into the main CivilSpace site, so keep the app modular (a self-contained feature module, not hard-wired to a specific domain). A sibling feature called **"Claused"** (an IS-codes assistant) lives at `https://claused-nine.vercel.app/` — this tool should feel like it belongs to the same product family (see the separate Claude Design prompt for the visual language).

**The hard rule that makes this product correct:** the compliance logic is deterministic and already written (see Section 2). You are wrapping it in an extraction pipeline + API + UI. **Do not reinvent or "improve" the check logic, the thresholds, or the verdicts.** The IS-code corpus (JSON) is the single source of truth for all citations and numeric tables.

---

## 1. The pipeline (end to end)

```
PDF upload
   │
   ▼
[1] Extraction      → call the Anthropic API (Claude) with the DBR PDF (base64) and a
                       structured-extraction prompt; get back JSON matching the DBRData
                       contract (Section 3). Include a per-field confidence + the source
                       snippet/page where possible.
   │
   ▼
[2] Normalization   → clean extracted strings into canonical enums/units
                       ("M-30"→30, "Zone-IV"→"IV", "special RC shear wall"→structural_wall,
                       all units to SI). Resolve location→{zone, Vb} if not explicitly stated
                       (stub the resolver for now; full district lookup comes later).
   │
   ▼
[3] Build DBRData    → assemble BuildingProfile + DBRData dataclasses.
   │
   ▼
[4] Run checks       → findings = run_all(dbr, corpus)   # the 25 checks, already written
   │
   ▼
[5] Enrich + return  → attach full clause text (from the corpus JSON) to each finding's
                       citation, roll up the summary counts, return JSON to the frontend.
```

The user must be able to **review the extracted data, correct any field, and re-run** the checks (extraction is assistive, not authoritative).

---

## 2. What already exists (provided in the project folder — use as-is)

These files are dropped into the repo. They are the **engine**. Wrap them; don't rewrite them.

- **`checker_core.py`** — the contracts and shared machinery:
  - `Verdict` enum: `PASS, FLAW, REVIEW, MISSING, NOT_APPLICABLE`
  - `Finding` dataclass: `check_id, title, verdict, summary, expected, found, citation, severity, notes`, with `.to_dict()`
  - `BuildingProfile` dataclass (the generalisation driver) with derived `is16700_applies()` and `is16700_out_of_scope_reason()`
  - `DBRData` dataclass (the normalized input contract — Section 3)
  - `Corpus` class — loads every `*.json` in a directory and indexes clause/table objects by `id`; `corpus.get(id)` returns the clause object; `corpus.editions` returns the editions registry
  - Generalisation lookup tables (zone factor, importance, IS 16700 max-height/slenderness, min base shear, accel limits, system→category map) and gate helpers (`na`, `missing`, `review`, `canonical_system`)
- **`checks.py`** — all 25 check functions `D1_…(d, corpus) -> Finding`, the registry `ALL_CHECKS`, `run_all(d, corpus) -> list[Finding]`, and `report(findings) -> {"summary": {...}, "findings": [...]}`. It also has a `__main__` demo that runs three synthetic profiles (keep it; it's the smoke test).
- **IS-code corpus JSON files** (the digitized codes — citations + numeric tables):
  - `file_for_DBR.json` (IS 456:2000 + IS 13920:2016)
  - `is1893_part1_2016_clauses.json` and `is1893_part1_2016_clauses_missing.json` (IS 1893 Part 1:2016, full)
  - `is875_part3_2015_clauses.json` and `is875_part3_2015_forcecoeff.json` (IS 875 Part 3:2015 wind)
  - `is875_part5_1987_clauses.json` (IS 875 Part 5: temperature + load combinations)
  - `is16700_2023_clauses.json` (IS 16700:2023 tall buildings, full)
  - `nbc_part4_2016_clauses.json` (NBC 2016 Part 4 fire/occupancy)
  - `is269_2015_cement_clauses.json` (IS 269:2015 cement)
  - `is_code_editions_registry.json` (current/superseded/withdrawn editions — powers D2)

Verify the engine runs first: `python checks.py` should print three profile summaries (Park-Town, low-rise office, Zone-V tower). If that works, the engine is intact.

---

## 3. The data contract (must match `checker_core.py` exactly)

`BuildingProfile`: `material` ("RC"/"steel"/"composite"/"masonry"), `structural_system` (canonical), `height_m`, `num_storeys`, `occupancy` (NBC group "A".."J"), `seismic_zone` ("II".."V"), `basic_wind_speed` (Vb m/s), `soil_type` ("I"/"II"/"III"/"rock"), `foundation_type` ("raft"/"pile"/"piled_raft"/"isolated"), `district`, `near_fault` (bool), `occupants` (int).

`DBRData`: `profile`, `concrete_grades` (dict by element), `rebar_grade`, `cement_type`, `exposure_condition`, `nominal_cover_mm` (dict), `zone_factor_Z`, `importance_factor_I`, `response_reduction_R`, `fundamental_period_s`, `period_method`, `seismic_weight_LL_pct`, `drift_ratio`, `stability_coeff_theta`, `base_shear_coeff_pct`, `analysis_method`, `irregularities` (list), `wind_tunnel_done`, `wind_tunnel_decision_stated`, `lateral_accel_ms2`, `force_coefficient_Cf`, `load_combinations` (list), `foundation_depth_m`, `fos_overturning`, `fos_sliding`, `settlement_mm`, `cited_codes` (list of `{"code","year"}`), `software_used`, `title_block` (dict).

The frontend TypeScript types and the extraction JSON schema must mirror these field names exactly.

---

## 4. The 25 checks (what the report contains)

D1 Title block · D2 Code-list currency · D3 Exposure & nominal cover · D4 Concrete grades · D5 Reinforcement ductility · D6 Cement spec · D7 Seismic parameters & method · D8 Period formula & cap · D9 Stiffness (cracked-section) modifiers · D10 Seismic-weight imposed-load % · D11 Drift & deflection · D12 Diaphragm · D13 Wind parameters · D14 Load combinations · D15 Foundation & geotechnical · D16 P-Δ / stability coefficient · D17 System classification & height limit · D18 Irregularity · D19 Location basis · D20 Temperature & shrinkage · D21 Dynamic / wind-tunnel · D22 Analysis software · D23 Fire-resistance closure · D24 Clear-cover philosophy · D25 NBC construction type.

Group them in the UI as: **Identity/QA** (D1, D22), **Currency** (D2), **Materials** (D4, D5, D6), **Cover/Durability/Fire** (D3, D24, D23, D25), **Seismic** (D7–D12, D16–D18), **Wind** (D13, D21), **Loads/Temperature** (D14, D20), **Foundation** (D15), **Location** (D19).

---

## 5. Backend (FastAPI, Python)

- Single FastAPI app. Load the corpus **once** at startup: `corpus = Corpus(CORPUS_DIR)`.
- Endpoints:
  - `POST /api/analyze` — multipart PDF upload → runs the full pipeline → returns `{ extracted: DBRData, findings: [...], summary: {...} }`.
  - `POST /api/check` — accepts an (edited) `DBRData` JSON → runs `run_all` → returns findings (this powers "edit & re-run" without re-extracting).
  - `GET /api/clause/{id}` — returns the full clause/table object from the corpus (for the citation drawer).
  - `GET /api/health`.
- **Extraction step**: call the Anthropic Messages API with the PDF as a base64 `document` block and the system prompt in Section 7. Model: use `claude-opus-4-8` (best extraction) with a `claude-sonnet` fallback. Parse the returned JSON; attach per-field provenance if provided.
- **Citation enrichment**: after `run_all`, for each finding with a `citation`, look up matching corpus objects (by code+clause) and attach the clause `statement`/table so the UI can show the actual code text. Keep quoted code text short; the corpus is the source.
- `ANTHROPIC_API_KEY` from env. CORS enabled for the frontend origin.
- Every checker is already wrapped so one bad field can't crash the report; surface MISSING/REVIEW honestly in the response.

---

## 6. Frontend (Next.js App Router + TypeScript + Tailwind; deploy to Vercel)

Pages / states:

1. **Landing / hero** — one-line value prop ("Validate a Design Basis Report against IS codes in seconds"), a short "how it works" (upload → extract → 25 checks → cited report), and a primary "Upload a DBR" CTA. Mention the codes covered (IS 456, IS 1893, IS 13920, IS 875-3/5, IS 16700, IS 269, NBC 2016).
2. **Upload & analyze** — drag-drop PDF zone; on submit, show a **processing state** (extracting → normalizing → running 25 checks).
3. **Report** —
   - **Summary bar**: counts of PASS / FLAW / REVIEW / MISSING / NOT_APPLICABLE, with an overall status.
   - **Extracted-data panel**: shows what the model pulled (building profile + key values), each field **editable**, with a "Re-run checks" button (calls `/api/check`).
   - **Findings**: the 25 checks grouped by category (Section 4). Each finding is a card: verdict badge, title, one-line summary, expected-vs-found, severity, and an expandable **citation drawer** showing the IS clause text (from `/api/clause/{id}`). Filter chips by verdict. Sort FLAW/MISSING to the top.
   - **Export**: print-to-PDF / download the report.

Use the design system from the **Claude Design** prompt. Verdict color semantics: PASS = positive/green, FLAW = critical/red, REVIEW = caution/amber, MISSING = neutral-warn/grey, NOT_APPLICABLE = muted.

---

## 7. Extraction system prompt (use verbatim for the Anthropic API call)

```
You extract structured data from an Indian structural-engineering Design Basis Report (DBR).
Return ONLY a JSON object matching this schema (no prose, no markdown fences). Use null for
anything not stated in the document — never guess or fill defaults. Where possible include a
"_provenance" map giving the page/snippet for key fields.

Schema (field names are exact):
{
  "profile": { "material","structural_system","height_m","num_storeys","occupancy",
               "seismic_zone","basic_wind_speed","soil_type","foundation_type","district",
               "near_fault","occupants" },
  "concrete_grades": { "<element>": <MPa number> },
  "rebar_grade": "...", "cement_type": "...", "exposure_condition": "...",
  "nominal_cover_mm": { "<element>": <mm number> },
  "zone_factor_Z": <num>, "importance_factor_I": <num>, "response_reduction_R": <num>,
  "fundamental_period_s": <num>, "period_method": "...", "seismic_weight_LL_pct": <num>,
  "drift_ratio": <num>, "stability_coeff_theta": <num>, "base_shear_coeff_pct": <num>,
  "analysis_method": "...", "irregularities": ["..."],
  "wind_tunnel_done": <bool>, "wind_tunnel_decision_stated": <bool>,
  "lateral_accel_ms2": <num>, "force_coefficient_Cf": <num>,
  "load_combinations": ["..."],
  "foundation_depth_m": <num>, "fos_overturning": <num>, "fos_sliding": <num>, "settlement_mm": <num>,
  "cited_codes": [ { "code":"IS 456", "year":"2000" } ],
  "software_used": "...", "title_block": { "project","document_no","revision","date" }
}

Normalization rules:
- structural_system canonical values: moment_frame, structural_wall, wall_moment_frame,
  wall_perimeter_frame, wall_framed_tube (map SMRF/OMRF→moment_frame; shear/core wall→structural_wall;
  dual→wall_moment_frame; tube/tube-in-tube/outrigger→wall_framed_tube).
- seismic_zone as roman numerals II/III/IV/V. material as RC/steel/composite/masonry.
- occupancy as NBC group letter A–J. grades as plain MPa numbers (M30→30).
- Keep cited_codes exactly as written (so currency checking can flag old/withdrawn editions).
```

---

## 8. Tech stack, structure, deployment

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind → **Vercel**.
- **Backend:** FastAPI (Python 3.11+) hosting the engine → **Render** or **Railway** (a normal Python service is simplest because of the corpus + dataclass imports). Connect via `NEXT_PUBLIC_API_URL`.
  - Simpler all-in-one alternative for the demo: have FastAPI serve the built Next.js static export, single deploy. Pick whichever you can ship fastest; default to two services.
- **Env vars:** backend `ANTHROPIC_API_KEY`; frontend `NEXT_PUBLIC_API_URL`.
- **Suggested layout:**
  ```
  /backend
    main.py            # FastAPI app, endpoints, extraction call, enrichment
    checker_core.py    # provided — do not rewrite
    checks.py          # provided — do not rewrite
    normalize.py       # NEW: raw-extract → DBRData/BuildingProfile
    corpus/            # all the IS-code *.json files
    requirements.txt
  /frontend
    app/               # Next.js App Router pages
    components/        # UploadZone, SummaryBar, FindingCard, CitationDrawer, ExtractedDataPanel
    lib/types.ts       # TS mirror of DBRData/BuildingProfile/Finding
    lib/api.ts
  ```
- Provide a `README` with run + deploy steps and a sample DBR to test.

## 9. Acceptance / done criteria

- `python checks.py` prints the three demo summaries unchanged.
- Uploading a real DBR PDF returns a populated report with citations from the corpus.
- Editing an extracted field and hitting "Re-run" updates the findings without re-extraction.
- A low-rise (≤50 m) building shows IS 16700 checks (D9/D16/D17) as NOT_APPLICABLE, not FLAW.
- A cited withdrawn code (e.g. IS 8112) is flagged by D2.
- Deployed: frontend on a public URL, backend reachable, end-to-end demo works.

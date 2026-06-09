"""
extract.py

Pipeline step [1]: call OpenRouter (OpenAI-compatible /chat/completions) with the
DBR PDF and the verbatim extraction system prompt, get back JSON matching the
Section 7 schema.

OpenRouter accepts PDFs as a `file` content part (base64 data URL). We attach the
`file-parser` plugin so any chat model can read the document; native-PDF models
(Gemini, Claude) use it directly. Model + fallback are env-configurable.

Returns the RAW extraction dict (provenance preserved under "_provenance");
normalize.build_dbr() turns it into a validated DBRData afterwards.
"""
from __future__ import annotations

import base64
import json
import os
import re
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Vision/PDF-capable default; comma-separated fallbacks tried in order.
# Sonnet primary (balanced cost/quality); Opus + Gemini Flash as fallbacks.
# Slugs are current OpenRouter ids (verified against /api/v1/models).
DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4.6")
FALLBACK_MODELS = [
    m.strip() for m in os.getenv(
        "OPENROUTER_FALLBACK_MODELS",
        "anthropic/claude-opus-4.8,google/gemini-2.5-flash",
    ).split(",") if m.strip()
]

# Verbatim from the Claude Code prompt, Section 7.
SYSTEM_PROMPT = """You extract structured data from an Indian structural-engineering Design Basis Report (DBR).
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
  wall_perimeter_frame, wall_framed_tube (map SMRF/OMRF->moment_frame; shear/core wall->structural_wall;
  dual->wall_moment_frame; tube/tube-in-tube/outrigger->wall_framed_tube).
- seismic_zone as roman numerals II/III/IV/V. material as RC/steel/composite/masonry.
- occupancy as NBC group letter A-J. grades as plain MPa numbers (M30->30).
- Keep cited_codes exactly as written (so currency checking can flag old/withdrawn editions)."""


class ExtractionError(RuntimeError):
    pass


def _strip_fences(text: str) -> str:
    """Models sometimes wrap JSON in ```json fences despite instructions."""
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```[a-zA-Z]*\n?", "", t)
        t = re.sub(r"\n?```$", "", t).strip()
    return t


def _parse_json(text: str) -> dict:
    t = _strip_fences(text)
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        # salvage the outermost {...}
        m = re.search(r"\{.*\}", t, re.DOTALL)
        if m:
            return json.loads(m.group())
        raise ExtractionError("Model did not return parseable JSON.")


def _build_messages(pdf_b64: str, filename: str) -> list[dict]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": [
                {"type": "text",
                 "text": "Extract the DBR data from the attached PDF as the JSON object specified."},
                {"type": "file",
                 "file": {"filename": filename,
                          "file_data": f"data:application/pdf;base64,{pdf_b64}"}},
            ],
        },
    ]


async def extract_dbr(pdf_bytes: bytes, filename: str = "dbr.pdf") -> dict:
    """Send the PDF to OpenRouter and return the raw extraction dict."""
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise ExtractionError("OPENROUTER_API_KEY is not set.")

    pdf_b64 = base64.b64encode(pdf_bytes).decode("ascii")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://dbr-check.local"),
        "X-Title": "DBR Compliance Checker",
    }

    models = [DEFAULT_MODEL] + [m for m in FALLBACK_MODELS if m != DEFAULT_MODEL]
    last_err: Exception | None = None

    async with httpx.AsyncClient(timeout=120.0) as client:
        for model in models:
            payload = {
                "model": model,
                "messages": _build_messages(pdf_b64, filename),
                "temperature": 0,
                # Lets non-native-PDF chat models read the document.
                "plugins": [{"id": "file-parser",
                             "pdf": {"engine": "pdf-text"}}],
            }
            try:
                resp = await client.post(OPENROUTER_URL, headers=headers, json=payload)
                if resp.status_code >= 400:
                    last_err = ExtractionError(
                        f"OpenRouter {resp.status_code} for {model}: {resp.text[:300]}")
                    continue
                data = resp.json()
                content = data["choices"][0]["message"]["content"]
                if isinstance(content, list):  # some models return content parts
                    content = "".join(part.get("text", "") for part in content
                                      if isinstance(part, dict))
                raw = _parse_json(content)
                raw["_extraction_model"] = model
                return raw
            except (httpx.HTTPError, KeyError, ExtractionError) as e:
                last_err = e
                continue

    raise ExtractionError(f"All extraction models failed. Last error: {last_err}")

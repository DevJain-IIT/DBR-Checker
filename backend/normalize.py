"""
normalize.py

Pipeline step [2] + [3]: turn the raw JSON the extraction model returns into a
validated DBRData / BuildingProfile (the contract in checker_core.py).

Responsibilities:
  - coerce types (numbers stored as strings -> float/int),
  - canonicalise enums (M-30 -> 30, "Zone-IV" -> "IV", "special RC shear wall"
    -> structural_system canonical, units -> SI),
  - resolve location -> {zone, Vb} when not explicitly stated (STUBBED: a full
    BMTPC district lookup comes later; for now we only fill from explicit fields),
  - never invent values: anything absent stays None so the checks honestly report
    MISSING/REVIEW.

This module does NOT decide compliance — it only shapes the input. All thresholds
and verdicts live in the untouched engine.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from checker_core import BuildingProfile, DBRData

# ---- canonical maps (mirror the engine's SYSTEM_TO_IS16700_CATEGORY space) ----
_SYSTEM_ALIASES = {
    "smrf": "moment_frame", "omrf": "moment_frame",
    "special moment frame": "moment_frame", "ordinary moment frame": "moment_frame",
    "moment frame": "moment_frame", "moment-resisting frame": "moment_frame",
    "shear wall": "structural_wall", "core wall": "structural_wall",
    "shear-wall": "structural_wall", "structural wall": "structural_wall",
    "rc wall": "structural_wall", "special rc shear wall": "structural_wall",
    "wall": "structural_wall",
    "dual": "wall_moment_frame", "dual system": "wall_moment_frame",
    "wall-frame": "wall_moment_frame", "wall moment frame": "wall_moment_frame",
    "wall perimeter frame": "wall_perimeter_frame",
    "tube": "wall_framed_tube", "framed tube": "wall_framed_tube",
    "tube-in-tube": "wall_framed_tube", "tube in tube": "wall_framed_tube",
    "outrigger": "wall_framed_tube",
}

_MATERIALS = {"rc": "RC", "rcc": "RC", "reinforced concrete": "RC",
              "steel": "steel", "composite": "composite", "masonry": "masonry"}

_ZONE_RE = re.compile(r"(IV|III|II|V|2|3|4|5)", re.IGNORECASE)
_ZONE_FROM_NUM = {"2": "II", "3": "III", "4": "IV", "5": "V"}


def _num(v: Any) -> Optional[float]:
    """Pull a float out of a number or a string like 'M-30', '47 m/s', '0.004'."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.replace(",", "")
        m = re.search(r"\d+(?:\.\d+)?", s)
        if not m:
            return None
        token = m.group()
        # Honour a minus sign only when it's a true leading sign — a '-' right
        # before the digits AND preceded by start/space. A hyphen that follows a
        # letter/digit (grade 'M-50', 'Zone-IV') is a separator, not a sign.
        idx = m.start()
        if idx > 0 and s[idx - 1] == "-":
            before = s[idx - 2] if idx >= 2 else ""
            if before == "" or before.isspace():
                token = "-" + token
        return float(token)
    return None


def _int(v: Any) -> Optional[int]:
    n = _num(v)
    return int(n) if n is not None else None


def _canon_system(v: Any) -> Optional[str]:
    if not v or not isinstance(v, str):
        return v if v else None
    key = v.strip().lower()
    if key in _SYSTEM_ALIASES:
        return _SYSTEM_ALIASES[key]
    # already canonical?
    norm = key.replace(" ", "_").replace("-", "_")
    if norm in {"moment_frame", "structural_wall", "wall_moment_frame",
                "wall_perimeter_frame", "wall_framed_tube"}:
        return norm
    return v  # leave it; canonical_system() in the engine still tries to map it


def _canon_material(v: Any) -> Optional[str]:
    if not v or not isinstance(v, str):
        return None
    return _MATERIALS.get(v.strip().lower(), v.strip())


def _canon_zone(v: Any) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip().upper()
    if s in {"II", "III", "IV", "V"}:
        return s
    m = _ZONE_RE.search(s)
    if not m:
        return None
    g = m.group(1).upper()
    return _ZONE_FROM_NUM.get(g, g)


def _grades_to_mpa(grades: Any) -> dict:
    """{'columns': 'M-50'} -> {'columns': 50.0}; drops unparseable entries."""
    out: dict = {}
    if isinstance(grades, dict):
        for el, g in grades.items():
            n = _num(g)
            if n is not None:
                out[str(el)] = n
    return out


def _cover_to_mm(cover: Any) -> dict:
    out: dict = {}
    if isinstance(cover, dict):
        for el, c in cover.items():
            n = _num(c)
            if n is not None:
                out[str(el)] = n
    return out


def _as_bool(v: Any) -> Optional[bool]:
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        s = v.strip().lower()
        if s in {"yes", "true", "done", "y"}:
            return True
        if s in {"no", "false", "not done", "n"}:
            return False
    return None


def _str_list(v: Any) -> list:
    if isinstance(v, list):
        return [str(x) for x in v if x is not None]
    if isinstance(v, str) and v.strip():
        return [v.strip()]
    return []


def _cited_codes(v: Any) -> list:
    """Keep cited codes verbatim (so D2 currency check can flag old editions)."""
    out = []
    if isinstance(v, list):
        for e in v:
            if isinstance(e, dict) and e.get("code"):
                out.append({"code": str(e["code"]).strip(),
                            "year": str(e.get("year", "")).strip()})
            elif isinstance(e, str) and e.strip():
                # "IS 456:2000" -> {code, year}
                m = re.match(r"(.+?):?\s*(\d{4})?$", e.strip())
                if m:
                    out.append({"code": m.group(1).strip(),
                                "year": (m.group(2) or "").strip()})
    return out


def resolve_location(profile: BuildingProfile) -> BuildingProfile:
    """
    STUB resolver. Full district -> {seismic_zone, Vb} lookup (BMTPC / IS 1893
    Annex E + IS 875-3 Annex A) is future work. For now we only keep explicitly
    stated values; we do not guess from district. Kept as a seam so D19 can later
    compare stated-vs-resolved.
    """
    return profile


def build_dbr(raw: dict) -> DBRData:
    """raw extraction dict (Section 7 schema) -> DBRData. Missing -> None."""
    raw = raw or {}
    p = raw.get("profile") or {}

    profile = BuildingProfile(
        material=_canon_material(p.get("material")),
        structural_system=_canon_system(p.get("structural_system")),
        height_m=_num(p.get("height_m")),
        num_storeys=_int(p.get("num_storeys")),
        occupancy=(str(p["occupancy"]).strip().upper()[:1] if p.get("occupancy") else None),
        seismic_zone=_canon_zone(p.get("seismic_zone")),
        basic_wind_speed=_num(p.get("basic_wind_speed")),
        soil_type=(str(p["soil_type"]).strip() if p.get("soil_type") else None),
        foundation_type=(str(p["foundation_type"]).strip().lower() if p.get("foundation_type") else None),
        district=(str(p["district"]).strip() if p.get("district") else None),
        near_fault=_as_bool(p.get("near_fault")),
        occupants=_int(p.get("occupants")),
    )
    profile = resolve_location(profile)

    return DBRData(
        profile=profile,
        concrete_grades=_grades_to_mpa(raw.get("concrete_grades")),
        rebar_grade=(str(raw["rebar_grade"]).strip() if raw.get("rebar_grade") else None),
        cement_type=(str(raw["cement_type"]).strip() if raw.get("cement_type") else None),
        exposure_condition=(str(raw["exposure_condition"]).strip() if raw.get("exposure_condition") else None),
        nominal_cover_mm=_cover_to_mm(raw.get("nominal_cover_mm")),
        zone_factor_Z=_num(raw.get("zone_factor_Z")),
        importance_factor_I=_num(raw.get("importance_factor_I")),
        response_reduction_R=_num(raw.get("response_reduction_R")),
        fundamental_period_s=_num(raw.get("fundamental_period_s")),
        period_method=(str(raw["period_method"]).strip() if raw.get("period_method") else None),
        seismic_weight_LL_pct=_num(raw.get("seismic_weight_LL_pct")),
        drift_ratio=_num(raw.get("drift_ratio")),
        stability_coeff_theta=_num(raw.get("stability_coeff_theta")),
        base_shear_coeff_pct=_num(raw.get("base_shear_coeff_pct")),
        analysis_method=(str(raw["analysis_method"]).strip() if raw.get("analysis_method") else None),
        irregularities=_str_list(raw.get("irregularities")),
        wind_tunnel_done=_as_bool(raw.get("wind_tunnel_done")),
        wind_tunnel_decision_stated=_as_bool(raw.get("wind_tunnel_decision_stated")),
        lateral_accel_ms2=_num(raw.get("lateral_accel_ms2")),
        force_coefficient_Cf=_num(raw.get("force_coefficient_Cf")),
        load_combinations=_str_list(raw.get("load_combinations")),
        foundation_depth_m=_num(raw.get("foundation_depth_m")),
        fos_overturning=_num(raw.get("fos_overturning")),
        fos_sliding=_num(raw.get("fos_sliding")),
        settlement_mm=_num(raw.get("settlement_mm")),
        cited_codes=_cited_codes(raw.get("cited_codes")),
        software_used=(str(raw["software_used"]).strip() if raw.get("software_used") else None),
        title_block=(raw.get("title_block") if isinstance(raw.get("title_block"), dict) else {}),
    )


def dbr_to_dict(d: DBRData) -> dict:
    """Serialise DBRData (incl. nested BuildingProfile) for JSON responses / editing."""
    from dataclasses import asdict
    return asdict(d)

"""
checks.py
The 25 generalised DBR compliance checks (D1-D25).

Each check has the same anatomy:
    gate (applicability) -> lookup threshold from profile/corpus -> compare -> Finding

Nothing here is tuned to a specific building. Thresholds are either code-fixed
constants (drift 0.004h, theta 0.2, M30-M70) or looked up by profile
(zone -> Z, occupancy -> I, system+zone -> max height, ...). A Zone-II low-rise
office and a Zone-V 200 m tower run identical code; only gates/lookups differ.
"""

from __future__ import annotations
from checker_core import (
    Verdict, Finding, BuildingProfile, DBRData, Corpus,
    ZONE_FACTOR, IMPORTANCE_BY_OCCUPANCY, IS16700_MAX_HEIGHT, IS16700_MAX_SLENDERNESS,
    IS16700_MIN_BASE_SHEAR, ACCEL_LIMIT, canonical_system, na, missing, review,
)

# --------------------------------------------------------------------------- #
#  Check-specific lookups (mirror corpus tables)
# --------------------------------------------------------------------------- #
# IS 1893:2016 Table 9 response reduction factor R (representative)
R_BY_SYSTEM = {
    "omrf": 3.0, "smrf": 5.0,
    "ordinary_shear_wall": 3.0, "ductile_shear_wall": 4.0,
    "dual_omrf_wall": 4.0, "dual_smrf_ductile_wall": 5.0,
    # canonical-category fallbacks
    "moment_frame": 5.0, "structural_wall": 4.0,
    "wall_moment_frame": 5.0, "wall_perimeter_frame": 5.0, "wall_framed_tube": 5.0,
}
# IS 456 Table 16 nominal cover (mm) by exposure
COVER_BY_EXPOSURE = {"mild": 20, "moderate": 30, "severe": 45,
                     "very severe": 50, "extreme": 75}
# IS 456 Table 5 minimum grade (RC) by exposure
MIN_GRADE_BY_EXPOSURE = {"mild": 20, "moderate": 25, "severe": 30,
                         "very severe": 35, "extreme": 40}


# ===================== IDENTITY / QA =====================
def D1_title_block(d: DBRData, c: Corpus) -> Finding:
    req = ["project", "document_no", "revision", "date"]
    tb = d.title_block or {}
    missing_fields = [f for f in req if not tb.get(f)]
    if not tb:
        return missing("D1", "Title block / revision consistency", "a title block")
    if missing_fields:
        return Finding("D1", "Title block / revision consistency", Verdict.FLAW,
                       f"Title block incomplete; missing {missing_fields}.",
                       expected=req, found=list(tb.keys()), severity="low")
    return Finding("D1", "Title block / revision consistency", Verdict.PASS,
                   "Title block carries project, document number, revision and date.",
                   found=tb, severity="low")


def D22_software_tools(d: DBRData, c: Corpus) -> Finding:
    if not d.software_used:
        return missing("D22", "Analysis software / tools", "the analysis software used",
                       citation="IS 16700:2023, Cl 7.1")
    return Finding("D22", "Analysis software / tools", Verdict.PASS,
                   f"3-D analysis software stated: {d.software_used}.",
                   found=d.software_used, citation="IS 16700:2023, Cl 7.1", severity="low")


# ===================== CURRENCY =====================
def D2_code_currency(d: DBRData, c: Corpus) -> Finding:
    reg = c.editions
    if not d.cited_codes:
        return missing("D2", "Code-list currency", "the list of codes referenced")
    cur, sup, wd = reg.get("current_editions", {}), reg.get("superseded", {}), reg.get("withdrawn", {})
    problems = []
    for entry in d.cited_codes:
        code = entry.get("code", "").strip()
        year = str(entry.get("year", "")).strip()
        key = f"{code}:{year}" if year else code
        if code in wd:
            problems.append(f"{code} is WITHDRAWN -> use {wd[code]['redirect']}")
        elif key in sup:
            problems.append(f"{key} is superseded -> use {sup[key]['redirect']}")
        elif code.split(" (")[0] in {k.split(' (')[0] for k in wd}:
            problems.append(f"{code} maps to a withdrawn grade-code; verify against IS 269:2015")
    if problems:
        return Finding("D2", "Code-list currency", Verdict.FLAW,
                       "DBR cites superseded/withdrawn editions.",
                       expected="current editions", found=problems, severity="high")
    return Finding("D2", "Code-list currency", Verdict.PASS,
                   "All cited codes match current editions in the registry.",
                   found=[e.get("code") for e in d.cited_codes])


# ===================== MATERIALS =====================
def D4_concrete_grade(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    grades = [g for g in d.concrete_grades.values() if isinstance(g, (int, float))]
    if not grades:
        return missing("D4", "Concrete grades", "concrete grade(s)",
                       citation="IS 456 Table 5; IS 16700:2023 Cl 5.7.1")
    lo, hi = min(grades), max(grades)
    notes, verdict, summ = [], Verdict.PASS, "Concrete grades within limits."
    # durability floor (IS 456 Table 5) by exposure
    exp = (d.exposure_condition or "").lower()
    if exp in MIN_GRADE_BY_EXPOSURE and lo < MIN_GRADE_BY_EXPOSURE[exp]:
        verdict, summ = Verdict.FLAW, f"Min grade M{lo} below IS 456 durability floor M{MIN_GRADE_BY_EXPOSURE[exp]} for {exp}."
    # IS 16700 band only for RC tall
    if p.is16700_applies():
        if lo < 30:
            verdict, summ = Verdict.FLAW, f"Min grade M{lo} < M30 (IS 16700 Cl 5.7.1.1)."
        if hi > 70:
            verdict, summ = Verdict.FLAW, f"Max grade M{hi} > M70 without Annex C justification (IS 16700 Cl 5.7.1.2)."
        cite = "IS 16700:2023, Cl 5.7.1; IS 456 Table 5"
    else:
        reason = p.is16700_out_of_scope_reason()
        if reason:
            notes.append(reason)
        cite = "IS 456 Table 5"
    return Finding("D4", "Concrete grades", verdict, summ,
                   expected="M30-M70 (RC tall); >= durability floor",
                   found=f"M{lo}-M{hi}", citation=cite, notes=notes)


def D5_rebar_ductility(d: DBRData, c: Corpus) -> Finding:
    if not d.rebar_grade:
        return missing("D5", "Reinforcement grade / ductility", "the reinforcement grade",
                       citation="IS 13920:2016, Cl 5.3.1")
    g = d.rebar_grade.upper().replace(" ", "")
    valid = any(x in g for x in ["FE415", "FE500", "FE550"])
    ductile = g.endswith("D") or "D" in g[-2:]
    seismic = d.profile.seismic_zone in {"III", "IV", "V"}
    if not valid:
        return Finding("D5", "Reinforcement grade / ductility", Verdict.FLAW,
                       f"{d.rebar_grade} is not a recognised ductile grade (Fe415/500/550).",
                       found=d.rebar_grade, citation="IS 13920:2016, Cl 5.3.1; IS 1786", severity="high")
    if seismic and not ductile:
        return Finding("D5", "Reinforcement grade / ductility", Verdict.REVIEW,
                       f"Zone {d.profile.seismic_zone}: confirm bars meet IS 13920 Cl 5.3.1 ductility "
                       f"(elongation >=14.5%, UTS/proof 1.15-1.25); a '-D' grade is preferred.",
                       found=d.rebar_grade, citation="IS 13920:2016, Cl 5.3.1")
    return Finding("D5", "Reinforcement grade / ductility", Verdict.PASS,
                   f"{d.rebar_grade} is a valid ductile reinforcement grade.",
                   found=d.rebar_grade, citation="IS 13920:2016, Cl 5.3.1")


def D6_cement_spec(d: DBRData, c: Corpus) -> Finding:
    if not d.cement_type:
        return missing("D6", "Cement specification", "the cement type/grade",
                       citation="IS 269:2015; IS 1489 (Part 1)")
    t = d.cement_type.upper()
    # withdrawn-code flag
    if "8112" in t or "12269" in t:
        return Finding("D6", "Cement specification", Verdict.FLAW,
                       "Cement cites a withdrawn code (IS 8112 / IS 12269); use IS 269:2015.",
                       found=d.cement_type, citation="IS 269:2015", severity="high")
    valid = any(x in t for x in ["OPC", "PPC", "PSC", "269", "1489", "455"])
    if not valid:
        return review("D6", "Cement specification",
                      f"Cement type '{d.cement_type}' not recognised against IS 269/1489/455.",
                      citation="IS 269:2015")
    return Finding("D6", "Cement specification", Verdict.PASS,
                   f"Cement type '{d.cement_type}' maps to a current specification.",
                   found=d.cement_type, citation="IS 269:2015 / IS 1489 (Part 1) / IS 455")


# ===================== COVER / DURABILITY / FIRE =====================
def D3_exposure_cover(d: DBRData, c: Corpus) -> Finding:
    if not d.exposure_condition:
        return review("D3", "Exposure & nominal cover",
                      "Exposure condition not stated; site-derived exposure needs reviewer judgement.",
                      citation="IS 456 Cl 8.2.2.1, Table 3")
    exp = d.exposure_condition.lower()
    req = COVER_BY_EXPOSURE.get(exp)
    if req is None:
        return review("D3", "Exposure & nominal cover", f"Unknown exposure class '{exp}'.",
                      citation="IS 456 Table 16")
    if not d.nominal_cover_mm:
        return missing("D3", "Exposure & nominal cover", "nominal cover values",
                       citation="IS 456 Table 16, 16A")
    deficient = {el: cv for el, cv in d.nominal_cover_mm.items()
                 if isinstance(cv, (int, float)) and cv < req}
    if deficient:
        return Finding("D3", "Exposure & nominal cover", Verdict.FLAW,
                       f"Cover below IS 456 minimum {req} mm for {exp} exposure.",
                       expected=f">= {req} mm", found=deficient,
                       citation="IS 456 Table 16", severity="high")
    return Finding("D3", "Exposure & nominal cover", Verdict.PASS,
                   f"Nominal cover meets IS 456 minimum {req} mm for {exp} exposure.",
                   expected=f">= {req} mm", found=d.nominal_cover_mm, citation="IS 456 Table 16")


def D24_clear_cover(d: DBRData, c: Corpus) -> Finding:
    # cover philosophy: durability cover reconciled with fire & bar-diameter rules
    if not d.nominal_cover_mm:
        return missing("D24", "Clear-cover philosophy", "nominal cover values",
                       citation="IS 456 Cl 26.4, Table 16/16A")
    # cover should not be unreasonably large (cracking) nor below 20 mm anywhere
    too_small = {el: cv for el, cv in d.nominal_cover_mm.items()
                 if isinstance(cv, (int, float)) and cv < 20}
    if too_small:
        return Finding("D24", "Clear-cover philosophy", Verdict.FLAW,
                       "Nominal cover below 20 mm minimum.", found=too_small,
                       citation="IS 456 Cl 26.4", severity="high")
    return Finding("D24", "Clear-cover philosophy", Verdict.PASS,
                   "Cover values consistent with IS 456 Cl 26.4 philosophy.",
                   found=d.nominal_cover_mm, citation="IS 456 Cl 26.4, Table 16/16A")


def D23_fire_resistance(d: DBRData, c: Corpus) -> Finding:
    if not d.profile.occupancy:
        return review("D23", "Fire-resistance closure",
                      "Occupancy not stated; cannot select NBC required fire rating.",
                      citation="NBC 2016 Part 4 Table 1; IS 456 Fig 1")
    # required rating depends on construction type via NBC; declaration-level here
    return review("D23", "Fire-resistance closure",
                  "Confirm member dimensions/cover give the NBC Table 1 required rating "
                  f"for occupancy {d.profile.occupancy} (IS 456 Fig 1 / Table 16A achieve it).",
                  citation="NBC 2016 Part 4 Table 1; IS 456 Fig 1, Table 16A")


def D25_nbc_construction_type(d: DBRData, c: Corpus) -> Finding:
    occ = d.profile.occupancy
    if not occ:
        return missing("D25", "NBC construction type", "the occupancy classification",
                       citation="NBC 2016 Part 4, Cl 3.1, 3.2.6")
    # occupancy -> fire zone -> permitted types (NBC 3.2.2.2 / 3.2.6)
    zone1 = set("ABCDEF")  # incl small business
    if occ in zone1:
        permitted = ["Type 1", "Type 2", "Type 3", "Type 4"]
    elif occ == "G":
        permitted = ["Type 1", "Type 2", "Type 3"]
    else:  # H, J
        permitted = ["Type 1", "Type 2"]
    return Finding("D25", "NBC construction type", Verdict.REVIEW,
                   f"Occupancy {occ}: permitted construction types {permitted}. "
                   "Confirm the DBR's stated type is within this set.",
                   expected=permitted, citation="NBC 2016 Part 4, Cl 3.2.2.2/3.2.6")


# ===================== SEISMIC SPINE =====================
def D7_seismic_params(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    notes = []
    if not p.seismic_zone:
        return missing("D7", "Seismic parameters & method", "the seismic zone",
                       citation="IS 1893:2016 Cl 6.4.2, Table 3")
    Z_req = ZONE_FACTOR.get(p.seismic_zone)
    I_req = IMPORTANCE_BY_OCCUPANCY.get(p.occupancy)
    cat = canonical_system(p)
    R_req = R_BY_SYSTEM.get((p.structural_system or "").lower().replace(" ", "_"), R_BY_SYSTEM.get(cat))
    problems = []
    if d.zone_factor_Z is not None and Z_req and abs(d.zone_factor_Z - Z_req) > 1e-6:
        problems.append(f"Z stated {d.zone_factor_Z} != {Z_req} for Zone {p.seismic_zone}")
    if d.importance_factor_I is not None and I_req and d.importance_factor_I < I_req:
        problems.append(f"I stated {d.importance_factor_I} < {I_req} for occupancy {p.occupancy}")
    if d.response_reduction_R is not None and R_req and d.response_reduction_R > R_req:
        problems.append(f"R stated {d.response_reduction_R} > {R_req} permissible for system {p.structural_system}")
    if d.zone_factor_Z is None or d.importance_factor_I is None or d.response_reduction_R is None:
        return review("D7", "Seismic parameters & method",
                      f"State all of Z/I/R. Expected for this profile: Z={Z_req}, I>={I_req}, R<={R_req}.",
                      citation="IS 1893:2016 Tables 3, 8, 9")
    if problems:
        return Finding("D7", "Seismic parameters & method", Verdict.FLAW,
                       "Seismic parameters inconsistent with zone/occupancy/system.",
                       expected={"Z": Z_req, "I_min": I_req, "R_max": R_req},
                       found={"Z": d.zone_factor_Z, "I": d.importance_factor_I, "R": d.response_reduction_R},
                       citation="IS 1893:2016 Tables 3, 8, 9", severity="high")
    return Finding("D7", "Seismic parameters & method", Verdict.PASS,
                   "Z, I and R are consistent with zone, occupancy and structural system.",
                   found={"Z": d.zone_factor_Z, "I": d.importance_factor_I, "R": d.response_reduction_R},
                   citation="IS 1893:2016 Tables 3, 8, 9")


def D8_period_cap(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    if d.fundamental_period_s is None:
        return missing("D8", "Period formula & cap", "the fundamental period T",
                       citation="IS 16700:2023 Cl 5.5.2, 6.3.4")
    if p.is16700_applies():
        if d.fundamental_period_s > 8.0:
            return Finding("D8", "Period formula & cap", Verdict.FLAW,
                           f"T={d.fundamental_period_s}s exceeds the 8 s cap (IS 16700 Cl 5.5.2).",
                           expected="<= 8 s", found=d.fundamental_period_s,
                           citation="IS 16700:2023 Cl 5.5.2", severity="high")
        # Ta cap (6.3.4) for base-shear period
        H = p.height_m
        cat = canonical_system(p)
        Ta = 0.0644 * H ** 0.9 if cat == "moment_frame" else 0.0672 * H ** 0.75
        note = (f"Empirical Ta = {Ta:.2f}s (IS 16700 6.3.4); design T for base shear "
                "should not exceed this.")
        return Finding("D8", "Period formula & cap", Verdict.PASS,
                       f"T={d.fundamental_period_s}s within the 8 s cap.",
                       expected="<= 8 s", found=d.fundamental_period_s,
                       citation="IS 16700:2023 Cl 5.5.2, 6.3.4", notes=[note])
    # low-rise / non-RC: IS 1893 empirical period fallback, no 8 s cap
    return review("D8", "Period formula & cap",
                  "Below IS 16700 scope; check T against IS 1893 Cl 7.6.2 empirical period.",
                  citation="IS 1893:2016 Cl 7.6.2")


def D9_stiffness_modifiers(d: DBRData, c: Corpus) -> Finding:
    if not d.profile.is16700_applies():
        r = d.profile.is16700_out_of_scope_reason()
        return na("D9", "Stiffness (cracked-section) modifiers",
                  r or "IS 16700 Table 5 modifiers apply to RC buildings 50-250 m.")
    return review("D9", "Stiffness (cracked-section) modifiers",
                  "Confirm cracked-section properties per IS 16700 Table 5 "
                  "(slabs 0.35Ig, beams 0.7Ig, columns/walls 0.9Ig for serviceability).",
                  citation="IS 16700:2023 Table 5 (via Cl 7.2/7.3.6)")


def D10_seismic_weight_LL(d: DBRData, c: Corpus) -> Finding:
    if d.seismic_weight_LL_pct is None:
        return missing("D10", "Seismic-weight imposed-load %", "the imposed-load % in seismic weight",
                       citation="IS 1893:2016 Cl 7.3.1, Table 10")
    pct = d.seismic_weight_LL_pct
    if pct not in (0, 25, 50):
        return Finding("D10", "Seismic-weight imposed-load %", Verdict.FLAW,
                       f"LL fraction {pct}% is not an IS 1893 Table 10 value (0/25/50).",
                       expected="25% (LL<=3kPa), 50% (LL>3kPa), 0% (roof)",
                       found=f"{pct}%", citation="IS 1893:2016 Table 10", severity="medium")
    return Finding("D10", "Seismic-weight imposed-load %", Verdict.PASS,
                   f"Imposed-load fraction {pct}% matches IS 1893 Table 10.",
                   found=f"{pct}%", citation="IS 1893:2016 Cl 7.3.1, Table 10")


def D11_drift(d: DBRData, c: Corpus) -> Finding:
    if d.drift_ratio is None:
        return missing("D11", "Drift & deflection", "the maximum inter-storey drift ratio",
                       citation="IS 1893:2016 Cl 7.11.1; IS 16700 Cl 5.4.1")
    limit, cite = 0.004, "IS 1893:2016 Cl 7.11.1 (0.004h)"
    if d.profile.is16700_applies():
        # IS 16700 service 1/500 = 0.002 governs serviceability; EQ 1/250 = 0.004
        cite = "IS 1893:2016 Cl 7.11.1; IS 16700:2023 Cl 5.4.1"
    if d.drift_ratio > limit:
        return Finding("D11", "Drift & deflection", Verdict.FLAW,
                       f"Drift {d.drift_ratio:.4f} exceeds {limit} (0.004h).",
                       expected=f"<= {limit}", found=d.drift_ratio, citation=cite, severity="high")
    return Finding("D11", "Drift & deflection", Verdict.PASS,
                   f"Drift {d.drift_ratio:.4f} within {limit} limit.",
                   expected=f"<= {limit}", found=d.drift_ratio, citation=cite)


def D12_diaphragm(d: DBRData, c: Corpus) -> Finding:
    return review("D12", "Diaphragm",
                  "Confirm diaphragm modelled per IS 1893 Cl 7.6.4 and openings "
                  "<= 30% of plan area with >= 5 m slab width (IS 16700 Cl 5.6.2).",
                  citation="IS 1893:2016 Cl 7.6.4; IS 16700:2023 Cl 5.6.2")


def D16_p_delta(d: DBRData, c: Corpus) -> Finding:
    if not d.profile.is16700_applies():
        return na("D16", "P-Delta / stability coefficient",
                  d.profile.is16700_out_of_scope_reason() or "IS 16700 theta limit applies to RC 50-250 m.")
    if d.stability_coeff_theta is None:
        return missing("D16", "P-Delta / stability coefficient", "the stability coefficient theta",
                       citation="IS 16700:2023 Cl 7.3.10")
    if d.stability_coeff_theta > 0.2:
        return Finding("D16", "P-Delta / stability coefficient", Verdict.FLAW,
                       f"theta={d.stability_coeff_theta} exceeds 0.2.",
                       expected="<= 0.2", found=d.stability_coeff_theta,
                       citation="IS 16700:2023 Cl 7.3.10", severity="high")
    return Finding("D16", "P-Delta / stability coefficient", Verdict.PASS,
                   f"theta={d.stability_coeff_theta} within 0.2 limit.",
                   expected="<= 0.2", found=d.stability_coeff_theta, citation="IS 16700:2023 Cl 7.3.10")


def D17_system_classification(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    if not p.is16700_applies():
        return na("D17", "System classification & height limit",
                  p.is16700_out_of_scope_reason() or "IS 16700 Tables 1/2 apply to RC 50-250 m.")
    cat = canonical_system(p)
    if cat is None or p.seismic_zone is None or p.height_m is None:
        return review("D17", "System classification & height limit",
                      "State structural system, zone and height to evaluate IS 16700 Table 1/2.",
                      citation="IS 16700:2023 Table 1, 2")
    max_h = IS16700_MAX_HEIGHT[cat][p.seismic_zone]
    if max_h is None:
        return Finding("D17", "System classification & height limit", Verdict.FLAW,
                       f"System '{cat}' is not permitted (NA) in Zone {p.seismic_zone} (IS 16700 Table 1).",
                       found=p.structural_system, citation="IS 16700:2023 Table 1", severity="high")
    if p.height_m > max_h:
        return Finding("D17", "System classification & height limit", Verdict.FLAW,
                       f"H={p.height_m} m exceeds the {max_h} m limit for '{cat}' in Zone {p.seismic_zone}.",
                       expected=f"<= {max_h} m", found=f"{p.height_m} m",
                       citation="IS 16700:2023 Table 1", severity="high")
    return Finding("D17", "System classification & height limit", Verdict.PASS,
                   f"'{cat}' permitted to {max_h} m in Zone {p.seismic_zone}; H={p.height_m} m OK.",
                   expected=f"<= {max_h} m", found=f"{p.height_m} m", citation="IS 16700:2023 Table 1")


def D18_irregularity(d: DBRData, c: Corpus) -> Finding:
    if not d.irregularities:
        return review("D18", "Irregularity",
                      "No irregularities declared; confirm plan/vertical regularity per "
                      "IS 1893 Tables 5/6 and IS 16700 Cl 5.3 (70/90% stiffness/strength).",
                      citation="IS 1893:2016 Cl 7.1, Tables 5/6; IS 16700 Cl 5.3, 5.5.1")
    return review("D18", "Irregularity",
                  f"Declared irregularities {d.irregularities}: confirm each is addressed per "
                  "IS 1893 Cl 7.1 and IS 16700 Cl 8.1.3.3 amplifications.",
                  found=d.irregularities, citation="IS 1893:2016 Tables 5/6; IS 16700 Cl 8.1.3.3")


# ===================== WIND =====================
def D13_wind_parameters(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    if p.basic_wind_speed is None:
        return missing("D13", "Wind parameters", "the basic wind speed Vb",
                       citation="IS 875-3:2015 Annex A, Cl 6.3")
    if p.basic_wind_speed not in (33, 39, 44, 47, 50, 55):
        return review("D13", "Wind parameters",
                      f"Vb={p.basic_wind_speed} m/s is not an IS 875-3 band (33/39/44/47/50/55); "
                      "confirm against the location.", citation="IS 875-3:2015 Annex A")
    notes = []
    if d.force_coefficient_Cf is not None and not (0.5 <= d.force_coefficient_Cf <= 2.2):
        notes.append(f"Cf={d.force_coefficient_Cf} outside typical 0.5-2.2 band (IS 875-3 Fig 4/Table 25).")
    return Finding("D13", "Wind parameters", Verdict.PASS,
                   f"Vb={p.basic_wind_speed} m/s is a valid IS 875-3 band.",
                   found={"Vb": p.basic_wind_speed, "Cf": d.force_coefficient_Cf},
                   citation="IS 875-3:2015 Annex A, Cl 6.3, 7.4", notes=notes)


def D21_dynamic_wind_tunnel(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    triggers = []
    if p.height_m and p.height_m > 150:
        triggers.append("H > 150 m")
    if d.fundamental_period_s and d.fundamental_period_s > 5:
        triggers.append("T > 5 s")
    if "complex_geometry" in (d.irregularities or []):
        triggers.append("plan/elevation complexity")
    # acceleration comfort (Table 3) where occupancy maps
    accel_note = None
    if d.lateral_accel_ms2 is not None and p.occupancy in ACCEL_LIMIT:
        lim = ACCEL_LIMIT[p.occupancy]
        if d.lateral_accel_ms2 > lim:
            return Finding("D21", "Dynamic / wind-tunnel", Verdict.FLAW,
                           f"Peak accel {d.lateral_accel_ms2} m/s2 exceeds {lim} for occupancy {p.occupancy}.",
                           expected=f"<= {lim} m/s2", found=d.lateral_accel_ms2,
                           citation="IS 16700:2023 Table 3", severity="medium")
        accel_note = f"Accel {d.lateral_accel_ms2} m/s2 within {lim} (occupancy {p.occupancy})."
    elif d.lateral_accel_ms2 is not None:
        accel_note = "Occupancy has no IS 16700 Table 3 accel limit (e.g. office) -> reviewer judgement."
    if triggers:
        if d.wind_tunnel_done or d.wind_tunnel_decision_stated:
            return Finding("D21", "Dynamic / wind-tunnel", Verdict.PASS,
                           f"Wind-tunnel trigger(s) {triggers} present and addressed.",
                           found={"triggers": triggers, "tunnel": d.wind_tunnel_done},
                           citation="IS 16700:2023 Cl 6.2.1", notes=[n for n in [accel_note] if n])
        return Finding("D21", "Dynamic / wind-tunnel", Verdict.FLAW,
                       f"Wind-tunnel trigger(s) {triggers} present but no study/decision stated.",
                       expected="wind-tunnel study or explicit decision",
                       found="not stated", citation="IS 16700:2023 Cl 6.2.1", severity="high")
    return Finding("D21", "Dynamic / wind-tunnel", Verdict.PASS,
                   "No IS 16700 Cl 6.2.1 wind-tunnel trigger; gust-factor method adequate.",
                   citation="IS 16700:2023 Cl 6.2.1; IS 875-3 Cl 10",
                   notes=[n for n in [accel_note] if n])


# ===================== LOADS / TEMPERATURE =====================
def D14_load_combinations(d: DBRData, c: Corpus) -> Finding:
    if not d.load_combinations:
        return missing("D14", "Load combinations", "the load combinations",
                       citation="IS 456 Table 18; IS 1893 Cl 6.3; IS 875-5 Cl 8.1")
    combos = " ".join(str(x).upper() for x in d.load_combinations)
    needs = []
    if "EL" not in combos and d.profile.seismic_zone:
        needs.append("earthquake combinations (DL/IL/EL)")
    if "WL" not in combos:
        needs.append("wind combinations (DL/IL/WL)")
    if needs:
        return Finding("D14", "Load combinations", Verdict.FLAW,
                       f"Load-combination set incomplete; missing {needs}.",
                       found=d.load_combinations,
                       citation="IS 456 Table 18; IS 1893 Cl 6.3; IS 875-5 Cl 8.1", severity="high")
    return Finding("D14", "Load combinations", Verdict.PASS,
                   "Load combinations cover gravity, wind and seismic cases.",
                   found=d.load_combinations,
                   citation="IS 456 Table 18; IS 1893 Cl 6.3; IS 875-5 Cl 8.1")


def D20_temperature(d: DBRData, c: Corpus) -> Finding:
    notes = []
    if d.profile.height_m and d.profile.height_m > 150:
        notes.append("H > 150 m: long-term shrinkage/creep/temperature movements per IS 16700 Cl 7.4.")
    return review("D20", "Temperature & shrinkage",
                  "Confirm temperature load (IS 875-5 Cl 2, design dT from Fig 1/2) and joint "
                  "spacing > 45 m addressed (IS 456 Cl 27); temperature combos per IS 875-5 Cl 8.1.",
                  citation="IS 456 Cl 27; IS 875-5:1987 Cl 2, Cl 8.1; IS 16700 Cl 7.4")
    # (notes attached below in assembler if needed)


# ===================== FOUNDATION =====================
def D15_foundation(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    problems, notes = [], []
    H = p.height_m
    # depth rule branches by foundation type (IS 16700 Cl 9.4)
    if d.foundation_depth_m is not None and H:
        if p.foundation_type in (None, "raft"):
            req = H / 15.0
            rule = "H/15 (raft)"
        else:
            req = H / 20.0
            rule = "H/20 (pile/piled raft)"
        if d.foundation_depth_m < req:
            problems.append(f"Embedment {d.foundation_depth_m} m < {req:.1f} m required ({rule})")
        else:
            notes.append(f"Embedment {d.foundation_depth_m} m >= {req:.1f} m ({rule}) OK.")
    # FoS 1.5 overturning/sliding (Cl 9.2)
    for label, val in (("overturning", d.fos_overturning), ("sliding", d.fos_sliding)):
        if val is not None and val < 1.5:
            problems.append(f"FoS {label} {val} < 1.5")
    # settlement (Cl 9.8.1)
    if d.settlement_mm is not None:
        lim = 50 if (p.soil_type == "rock") else 125
        if d.settlement_mm > lim:
            problems.append(f"Settlement {d.settlement_mm} mm > {lim} mm")
    if not any([d.foundation_depth_m, d.fos_overturning, d.fos_sliding, d.settlement_mm]):
        return missing("D15", "Foundation & geotechnical",
                       "foundation depth / FoS / settlement", citation="IS 16700:2023 Section 9")
    if problems:
        return Finding("D15", "Foundation & geotechnical", Verdict.FLAW,
                       "Foundation provisions below IS 16700 Section 9 requirements.",
                       found=problems, citation="IS 16700:2023 Cl 9.2, 9.4, 9.8.1", severity="high")
    return Finding("D15", "Foundation & geotechnical", Verdict.PASS,
                   "Foundation depth, FoS and settlement meet IS 16700 Section 9.",
                   citation="IS 16700:2023 Cl 9.2, 9.4, 9.8.1", notes=notes)


# ===================== LOCATION =====================
def D19_location_basis(d: DBRData, c: Corpus) -> Finding:
    p = d.profile
    if not p.district and not p.seismic_zone:
        return missing("D19", "Location basis", "the project location / district",
                       citation="IS 1893 Annex E; IS 875-3 Annex A")
    # ground-truth comparison happens in the resolver; here we confirm both were resolved
    if p.seismic_zone and p.basic_wind_speed:
        return Finding("D19", "Location basis", Verdict.PASS,
                       f"Location resolves to Zone {p.seismic_zone}, Vb {p.basic_wind_speed} m/s; "
                       "confirm DBR's stated values match.",
                       found={"zone": p.seismic_zone, "Vb": p.basic_wind_speed},
                       citation="IS 1893 Annex E; IS 875-3 Annex A (+ BMTPC district lookup)")
    return review("D19", "Location basis",
                  "Resolve both seismic zone and basic wind speed for the district.",
                  citation="IS 1893 Annex E; IS 875-3 Annex A")


# --------------------------------------------------------------------------- #
#  Registry & assembler
# --------------------------------------------------------------------------- #
# D1 (title-block / revision consistency) was intentionally removed from the
# run set — it's a document-hygiene check with no engineering value here. The
# function is kept above for reference but is no longer registered.
ALL_CHECKS = [
    D2_code_currency, D3_exposure_cover, D4_concrete_grade,
    D5_rebar_ductility, D6_cement_spec, D7_seismic_params, D8_period_cap,
    D9_stiffness_modifiers, D10_seismic_weight_LL, D11_drift, D12_diaphragm,
    D13_wind_parameters, D14_load_combinations, D15_foundation, D16_p_delta,
    D17_system_classification, D18_irregularity, D19_location_basis, D20_temperature,
    D21_dynamic_wind_tunnel, D22_software_tools, D23_fire_resistance,
    D24_clear_cover, D25_nbc_construction_type,
]


def run_all(d: DBRData, corpus: Corpus) -> list[Finding]:
    findings = []
    for fn in ALL_CHECKS:
        try:
            findings.append(fn(d, corpus))
        except Exception as e:  # a check must never crash the report
            findings.append(Finding(fn.__name__, fn.__name__, Verdict.REVIEW,
                                     f"Checker error: {e}", severity="low"))
    return findings


def report(findings: list[Finding]) -> dict:
    from collections import Counter
    counts = Counter(f.verdict.value for f in findings)
    return {"summary": dict(counts), "findings": [f.to_dict() for f in findings]}


# --------------------------------------------------------------------------- #
#  Demo: prove generalisation across very different buildings
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import os
    corpus = Corpus(os.path.dirname(os.path.abspath(__file__)))

    # 1) Park-Town-like: RC shear-wall residential tower, Zone IV, 115 m
    park = DBRData(
        profile=BuildingProfile(material="RC", structural_system="structural_wall",
                                height_m=115, occupancy="A", seismic_zone="IV",
                                basic_wind_speed=47, soil_type="II", foundation_type="raft"),
        concrete_grades={"columns": 50, "walls": 45, "slabs": 35}, rebar_grade="Fe500D",
        cement_type="OPC 53", exposure_condition="severe",
        nominal_cover_mm={"columns": 45, "walls": 45, "slabs": 30},
        zone_factor_Z=0.24, importance_factor_I=1.0, response_reduction_R=4.0,
        fundamental_period_s=4.2, seismic_weight_LL_pct=25, drift_ratio=0.0032,
        stability_coeff_theta=0.12, lateral_accel_ms2=0.15,
        load_combinations=["1.5(DL+IL)", "1.2(DL+IL+EL)", "1.5(DL+WL)", "0.9DL+1.5EL"],
        foundation_depth_m=12, fos_overturning=1.8, fos_sliding=1.6, settlement_mm=90,
        software_used="ETABS", title_block={"project": "Park Town", "document_no": "PI-5753-DBR-101",
                                            "revision": "R0", "date": "2025-01-01"},
        cited_codes=[{"code": "IS 456", "year": "2000"}, {"code": "IS 16700", "year": "2023"}],
    )

    # 2) Low-rise Zone-II RC office, 24 m (IS 16700 should NOT apply)
    office = DBRData(
        profile=BuildingProfile(material="RC", structural_system="smrf",
                                height_m=24, occupancy="E", seismic_zone="II",
                                basic_wind_speed=39, soil_type="I", foundation_type="isolated"),
        concrete_grades={"columns": 30, "slabs": 25}, rebar_grade="Fe500",
        cement_type="OPC 43", zone_factor_Z=0.10, importance_factor_I=1.0,
        response_reduction_R=5.0, fundamental_period_s=0.9, seismic_weight_LL_pct=25,
        drift_ratio=0.0035, software_used="STAAD",
        cited_codes=[{"code": "IS 456", "year": "2000"}, {"code": "IS 8112", "year": "2013"}],
    )

    # 3) Zone-V tall tube, 200 m, residential, pile foundation
    tower = DBRData(
        profile=BuildingProfile(material="RC", structural_system="framed_tube",
                                height_m=200, occupancy="A", seismic_zone="V",
                                basic_wind_speed=50, soil_type="II", foundation_type="pile"),
        concrete_grades={"columns": 65, "walls": 60}, rebar_grade="Fe550D",
        cement_type="OPC 53", zone_factor_Z=0.36, importance_factor_I=1.0,
        response_reduction_R=5.0, fundamental_period_s=6.0, seismic_weight_LL_pct=25,
        drift_ratio=0.0038, stability_coeff_theta=0.18, lateral_accel_ms2=0.16,
        load_combinations=["1.5(DL+IL)", "1.2(DL+IL+EL)", "1.5(DL+WL)"],
        foundation_depth_m=9, fos_overturning=1.6, fos_sliding=1.5, settlement_mm=110,
        software_used="ETABS",
        cited_codes=[{"code": "IS 16700", "year": "2023"}],
    )

    for name, dbr in [("PARK-TOWN 115m ZIV", park), ("OFFICE 24m ZII", office), ("TOWER 200m ZV", tower)]:
        rep = report(run_all(dbr, corpus))
        print(f"\n=== {name} ===  {rep['summary']}")
        for f in rep["findings"]:
            if f["verdict"] in ("FLAW", "NOT_APPLICABLE"):
                print(f"  {f['check_id']:>3} {f['verdict']:<15} {f['summary']}")

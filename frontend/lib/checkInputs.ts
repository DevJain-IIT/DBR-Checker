// Maps each fixable check (D1..D25) to the input control(s) that let a user
// correct/provide the value(s) it validates. Pure data — FlawCard reads this to
// know which FixControl(s) to render. Paths are DBRData paths (dot for profile.*).
//
// Field<->check mapping is derived from backend checks.py (which fields each
// check reads). Checks not listed here render as a card with Ignore + Show-more
// only (no inline fix control — e.g. D9/D12/D20/D23/D25 are REVIEW-style, and
// D2 currency is not a simple value edit).

export type ControlKind =
  | "dropdown"
  | "stepper"
  | "dict-stepper"
  | "dict-dropdown"
  | "boolean"
  | "text";

export interface ControlDef {
  kind: ControlKind;
  path: string;            // DBRData path: "profile.basic_wind_speed", "zone_factor_Z", "nominal_cover_mm"
  label: string;
  optionsKey?: string;     // key into OPTIONS (dropdown / dict-dropdown)
  stepKey?: string;        // key into STEPS (stepper / dict-stepper)
  elementsKey?: "cover" | "grade";  // which canonical element list for dict controls
  derive?: string;         // key into DERIVE — offer a one-tap "correct value"
}

export interface CheckInput {
  hint?: string;           // short plain-language guidance shown on the card
  controls: ControlDef[];
}

export const CHECK_INPUTS: Record<string, CheckInput> = {
  // D1 (title-block / revision) was removed from the engine — no card for it.
  D3: {
    hint: "Set the exposure class and the nominal cover for each element.",
    controls: [
      { kind: "dropdown", path: "exposure_condition", label: "Exposure", optionsKey: "exposure_condition" },
      { kind: "dict-stepper", path: "nominal_cover_mm", label: "Nominal cover", stepKey: "nominal_cover_mm", elementsKey: "cover" },
    ],
  },
  D4: {
    hint: "Set the concrete grade for each element (M30–M70 for RC tall).",
    controls: [
      { kind: "dict-dropdown", path: "concrete_grades", label: "Concrete grade", optionsKey: "concrete_grade", elementsKey: "grade" },
    ],
  },
  D5: {
    hint: "Pick the reinforcement grade (a '-D' ductile grade is preferred in Zone III–V).",
    controls: [{ kind: "dropdown", path: "rebar_grade", label: "Rebar grade", optionsKey: "rebar_grade" }],
  },
  D6: {
    hint: "Pick the cement specification (IS 269 / IS 1489 / IS 455).",
    controls: [{ kind: "dropdown", path: "cement_type", label: "Cement", optionsKey: "cement_type" }],
  },
  D7: {
    hint: "Set Z, I and R consistent with the zone, occupancy and structural system.",
    controls: [
      { kind: "stepper", path: "zone_factor_Z", label: "Zone factor Z", stepKey: "zone_factor_Z", derive: "Z_from_zone" },
      { kind: "stepper", path: "importance_factor_I", label: "Importance I", stepKey: "importance_factor_I", derive: "I_from_occupancy" },
      { kind: "stepper", path: "response_reduction_R", label: "Reduction R", stepKey: "response_reduction_R", derive: "R_from_system" },
    ],
  },
  D8: {
    hint: "Set the fundamental period T (≤ 8 s for tall RC).",
    controls: [{ kind: "stepper", path: "fundamental_period_s", label: "Period T", stepKey: "fundamental_period_s" }],
  },
  D10: {
    hint: "Set the imposed-load fraction in seismic weight (IS 1893 Table 10).",
    controls: [{ kind: "dropdown", path: "seismic_weight_LL_pct", label: "Seismic LL %", optionsKey: "seismic_weight_LL_pct" }],
  },
  D11: {
    hint: "Set the max inter-storey drift ratio (≤ 0.004).",
    controls: [{ kind: "stepper", path: "drift_ratio", label: "Drift ratio", stepKey: "drift_ratio" }],
  },
  D13: {
    hint: "Set the basic wind speed Vb (IS 875-3 band).",
    controls: [
      { kind: "dropdown", path: "profile.basic_wind_speed", label: "Wind speed Vb", optionsKey: "basic_wind_speed" },
      { kind: "stepper", path: "force_coefficient_Cf", label: "Force coeff Cf", stepKey: "force_coefficient_Cf" },
    ],
  },
  D15: {
    hint: "Provide foundation depth, factors of safety and settlement.",
    controls: [
      { kind: "dropdown", path: "profile.foundation_type", label: "Foundation type", optionsKey: "foundation_type" },
      { kind: "stepper", path: "foundation_depth_m", label: "Foundation depth", stepKey: "foundation_depth_m" },
      { kind: "stepper", path: "fos_overturning", label: "FoS overturning", stepKey: "fos_overturning" },
      { kind: "stepper", path: "fos_sliding", label: "FoS sliding", stepKey: "fos_sliding" },
      { kind: "stepper", path: "settlement_mm", label: "Settlement", stepKey: "settlement_mm" },
    ],
  },
  D16: {
    hint: "Set the stability coefficient θ (≤ 0.2).",
    controls: [{ kind: "stepper", path: "stability_coeff_theta", label: "Stability θ", stepKey: "stability_coeff_theta" }],
  },
  D17: {
    hint: "Set the structural system, height and zone (IS 16700 Table 1 limits).",
    controls: [
      { kind: "dropdown", path: "profile.structural_system", label: "System", optionsKey: "structural_system" },
      { kind: "stepper", path: "profile.height_m", label: "Height", stepKey: "height_m" },
      { kind: "dropdown", path: "profile.seismic_zone", label: "Seismic zone", optionsKey: "seismic_zone" },
    ],
  },
  D19: {
    hint: "Provide the project district (resolves the seismic zone & wind speed).",
    controls: [
      { kind: "text", path: "profile.district", label: "District" },
      { kind: "dropdown", path: "profile.seismic_zone", label: "Seismic zone", optionsKey: "seismic_zone" },
      { kind: "dropdown", path: "profile.basic_wind_speed", label: "Wind speed Vb", optionsKey: "basic_wind_speed" },
    ],
  },
  D21: {
    hint: "Confirm the wind-tunnel decision and (if relevant) peak acceleration.",
    controls: [
      { kind: "boolean", path: "wind_tunnel_done", label: "Wind-tunnel study done" },
      { kind: "boolean", path: "wind_tunnel_decision_stated", label: "Decision stated" },
      { kind: "stepper", path: "lateral_accel_ms2", label: "Peak accel", stepKey: "lateral_accel_ms2" },
    ],
  },
  D22: {
    hint: "State the analysis software used.",
    controls: [{ kind: "text", path: "software_used", label: "Software" }],
  },
  D25: {
    hint: "Set the occupancy, then pick the construction type for your DBR.",
    controls: [
      { kind: "dropdown", path: "profile.occupancy", label: "Occupancy", optionsKey: "occupancy" },
    ],
  },
};

// The primary DBRData field path a check reads — used to look up the DBR page
// from _provenance ("you stated this on p.X"). Falls back to the first control's
// path. A few REVIEW/procedural checks not in CHECK_INPUTS get an explicit path.
const EXTRA_FIELD_PATHS: Record<string, string> = {
  D2: "cited_codes",
  D9: "stability_coeff_theta",
  D12: "analysis_method",
  D14: "load_combinations",
  D18: "irregularities",
  D20: "analysis_method",
  D23: "exposure_condition",
  D24: "nominal_cover_mm",
  D25: "profile.occupancy",
};

export function primaryFieldPath(checkId: string): string | null {
  const inp = CHECK_INPUTS[checkId];
  if (inp && inp.controls.length > 0) return inp.controls[0].path;
  return EXTRA_FIELD_PATHS[checkId] ?? null;
}

// Look up the DBR page where this check's value was stated, from the extraction
// _provenance map ({fieldPath: page}). Tries every control path the check reads
// and returns the first page found. null when the extractor didn't capture one.
export function dbrPageForCheck(
  checkId: string,
  provenance: Record<string, number> | null | undefined,
): number | null {
  if (!provenance) return null;
  const paths: string[] = [];
  const inp = CHECK_INPUTS[checkId];
  if (inp) for (const c of inp.controls) paths.push(c.path);
  const extra = EXTRA_FIELD_PATHS[checkId];
  if (extra) paths.push(extra);
  for (const p of paths) {
    const page = provenance[p];
    if (typeof page === "number" && page > 0) return page;
  }
  return null;
}

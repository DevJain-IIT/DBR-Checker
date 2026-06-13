// Control descriptor for each box in the "Extracted building basis" grid, keyed
// by DBRData path. Drives whether a box is a dropdown (categorical), a plain
// number input (numeric), or free text. Option/step keys reference the existing
// OPTIONS/STEPS in lib/fieldOptions.ts — no values invented here.

export interface FieldControl {
  path: string;
  label: string;
  kind: "dropdown" | "number" | "text";
  unit?: string;
  optionsKey?: string;  // -> OPTIONS[...] for dropdowns
  stepKey?: string;     // -> STEPS[...] for numeric bounds (soft validation)
}

export const FIELD_CONTROLS: FieldControl[] = [
  // ---- dropdowns (categorical, OPTIONS-backed) ----
  { path: "profile.material", label: "Material", kind: "dropdown", optionsKey: "material" },
  { path: "profile.structural_system", label: "System", kind: "dropdown", optionsKey: "structural_system" },
  { path: "profile.occupancy", label: "Occupancy", kind: "dropdown", optionsKey: "occupancy" },
  { path: "profile.seismic_zone", label: "Seismic zone", kind: "dropdown", optionsKey: "seismic_zone" },
  { path: "profile.basic_wind_speed", label: "Wind speed Vb", kind: "dropdown", optionsKey: "basic_wind_speed", unit: "m/s" },
  { path: "profile.soil_type", label: "Soil type", kind: "dropdown", optionsKey: "soil_type" },
  { path: "profile.foundation_type", label: "Foundation", kind: "dropdown", optionsKey: "foundation_type" },
  { path: "rebar_grade", label: "Rebar grade", kind: "dropdown", optionsKey: "rebar_grade" },
  { path: "cement_type", label: "Cement", kind: "dropdown", optionsKey: "cement_type" },
  { path: "exposure_condition", label: "Exposure", kind: "dropdown", optionsKey: "exposure_condition" },
  { path: "seismic_weight_LL_pct", label: "Seismic LL", kind: "dropdown", optionsKey: "seismic_weight_LL_pct", unit: "%" },

  // ---- number inputs (plain box + unit; STEPS for clamp/placeholder) ----
  { path: "profile.height_m", label: "Height", kind: "number", unit: "m", stepKey: "height_m" },
  { path: "profile.num_storeys", label: "Storeys", kind: "number", stepKey: "num_storeys" },
  { path: "zone_factor_Z", label: "Zone factor Z", kind: "number", stepKey: "zone_factor_Z" },
  { path: "importance_factor_I", label: "Importance I", kind: "number", stepKey: "importance_factor_I" },
  { path: "response_reduction_R", label: "Reduction R", kind: "number", stepKey: "response_reduction_R" },
  { path: "fundamental_period_s", label: "Period T", kind: "number", unit: "s", stepKey: "fundamental_period_s" },
  { path: "drift_ratio", label: "Drift ratio", kind: "number", stepKey: "drift_ratio" },
  { path: "stability_coeff_theta", label: "Stability θ", kind: "number", stepKey: "stability_coeff_theta" },
  { path: "foundation_depth_m", label: "Foundation depth", kind: "number", unit: "m", stepKey: "foundation_depth_m" },
  { path: "fos_overturning", label: "FoS overturn", kind: "number", stepKey: "fos_overturning" },
  { path: "fos_sliding", label: "FoS sliding", kind: "number", stepKey: "fos_sliding" },
  { path: "settlement_mm", label: "Settlement", kind: "number", unit: "mm", stepKey: "settlement_mm" },

  // ---- free text (no discrete values) ----
  { path: "software_used", label: "Software", kind: "text" },
];

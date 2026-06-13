// IS-code-derived valid values for the guided-fix inputs. Every option here is
// transcribed from the backend engine's accepted-value space (checker_core.py
// lookup tables, checks.py validation, normalize.py canonicalisation) — nothing
// is invented. Sending these values through /api/check produces a code-valid result.

export interface Option {
  value: string | number;
  label: string;
  note?: string;
}

export const OPTIONS: Record<string, Option[]> = {
  // ---- BuildingProfile enums (normalize.py canonicalises these) ----
  material: [
    { value: "RC", label: "RC (reinforced concrete)" },
    { value: "steel", label: "Steel" },
    { value: "composite", label: "Composite" },
    { value: "masonry", label: "Masonry" },
  ],
  structural_system: [
    { value: "moment_frame", label: "Moment frame", note: "SMRF / OMRF" },
    { value: "structural_wall", label: "Structural (shear) wall", note: "core / shear wall" },
    { value: "wall_moment_frame", label: "Wall + moment frame (dual)" },
    { value: "wall_perimeter_frame", label: "Wall + perimeter frame" },
    { value: "wall_framed_tube", label: "Framed tube / outrigger" },
  ],
  occupancy: [
    { value: "A", label: "A — Residential", note: "I = 1.0" },
    { value: "B", label: "B — Educational", note: "I = 1.5" },
    { value: "C", label: "C — Institutional", note: "I = 1.5" },
    { value: "D", label: "D — Assembly", note: "I = 1.5" },
    { value: "E", label: "E — Business", note: "I = 1.0" },
    { value: "F", label: "F — Mercantile", note: "I = 1.0" },
    { value: "G", label: "G — Industrial", note: "I = 1.0" },
    { value: "H", label: "H — Storage", note: "I = 1.0" },
    { value: "J", label: "J — Hazardous", note: "I = 1.5" },
  ],
  seismic_zone: [
    { value: "II", label: "Zone II", note: "Z = 0.10" },
    { value: "III", label: "Zone III", note: "Z = 0.16" },
    { value: "IV", label: "Zone IV", note: "Z = 0.24" },
    { value: "V", label: "Zone V", note: "Z = 0.36" },
  ],
  soil_type: [
    { value: "I", label: "Type I — Rock / hard" },
    { value: "II", label: "Type II — Medium" },
    { value: "III", label: "Type III — Soft" },
    { value: "rock", label: "Rock" },
  ],
  foundation_type: [
    { value: "raft", label: "Raft", note: "embedment ≥ H/15" },
    { value: "pile", label: "Pile", note: "embedment ≥ H/20" },
    { value: "piled_raft", label: "Piled raft", note: "embedment ≥ H/20" },
    { value: "isolated", label: "Isolated footings" },
  ],

  // ---- Durability / materials (IS 456, IS 13920, IS 269) ----
  // engine lowercases exposure before matching COVER_BY_EXPOSURE/MIN_GRADE_BY_EXPOSURE
  exposure_condition: [
    { value: "Mild", label: "Mild", note: "cover ≥ 20 mm" },
    { value: "Moderate", label: "Moderate", note: "cover ≥ 30 mm" },
    { value: "Severe", label: "Severe", note: "cover ≥ 45 mm" },
    { value: "Very Severe", label: "Very Severe", note: "cover ≥ 50 mm" },
    { value: "Extreme", label: "Extreme", note: "cover ≥ 75 mm" },
  ],
  rebar_grade: [
    { value: "Fe415", label: "Fe415" },
    { value: "Fe500", label: "Fe500" },
    { value: "Fe500D", label: "Fe500D", note: "ductile — preferred in Zone III–V" },
    { value: "Fe550", label: "Fe550" },
    { value: "Fe550D", label: "Fe550D", note: "ductile" },
  ],
  cement_type: [
    { value: "OPC 43", label: "OPC 43 (IS 269:2015)" },
    { value: "OPC 53", label: "OPC 53 (IS 269:2015)" },
    { value: "PPC", label: "PPC (IS 1489 Part 1)" },
    { value: "PSC", label: "PSC (IS 455)" },
  ],

  // ---- Seismic / wind numerics that have discrete code bands ----
  basic_wind_speed: [
    { value: 33, label: "33 m/s" },
    { value: 39, label: "39 m/s" },
    { value: 44, label: "44 m/s" },
    { value: 47, label: "47 m/s" },
    { value: 50, label: "50 m/s" },
    { value: 55, label: "55 m/s" },
  ],
  seismic_weight_LL_pct: [
    { value: 0, label: "0% (roof)", note: "IS 1893 Table 10" },
    { value: 25, label: "25% (LL ≤ 3 kPa)" },
    { value: 50, label: "50% (LL > 3 kPa)" },
  ],

  // ---- per-element dict-dropdown option set (concrete grades, MPa) ----
  concrete_grade: [
    { value: 25, label: "M25" },
    { value: 30, label: "M30" },
    { value: 35, label: "M35" },
    { value: 40, label: "M40" },
    { value: 45, label: "M45" },
    { value: 50, label: "M50" },
    { value: 55, label: "M55" },
    { value: 60, label: "M60" },
    { value: 65, label: "M65" },
    { value: 70, label: "M70" },
  ],
};

export interface Step {
  min: number;
  max: number;
  step: number;
  unit?: string;
  decimals?: number;
}

export const STEPS: Record<string, Step> = {
  height_m: { min: 0, max: 300, step: 1, unit: "m" },
  num_storeys: { min: 0, max: 150, step: 1 },
  fundamental_period_s: { min: 0, max: 8, step: 0.05, unit: "s", decimals: 2 },
  drift_ratio: { min: 0, max: 0.02, step: 0.0005, decimals: 4 },
  stability_coeff_theta: { min: 0, max: 0.4, step: 0.01, decimals: 2 },
  fos_overturning: { min: 0, max: 5, step: 0.1, decimals: 1 },
  fos_sliding: { min: 0, max: 5, step: 0.1, decimals: 1 },
  settlement_mm: { min: 0, max: 200, step: 1, unit: "mm" },
  foundation_depth_m: { min: 0, max: 50, step: 0.5, unit: "m", decimals: 1 },
  lateral_accel_ms2: { min: 0, max: 1, step: 0.01, unit: "m/s²", decimals: 2 },
  force_coefficient_Cf: { min: 0, max: 3, step: 0.1, decimals: 1 },
  zone_factor_Z: { min: 0, max: 0.4, step: 0.01, decimals: 2 },
  importance_factor_I: { min: 1, max: 1.5, step: 0.1, decimals: 1 },
  response_reduction_R: { min: 1, max: 5, step: 0.5, decimals: 1 },
  nominal_cover_mm: { min: 15, max: 100, step: 5, unit: "mm" },
};

// Derivations: the engine knows the "correct" value for Z (by zone), I (by
// occupancy) and R (max permissible, by system). These let a card offer a
// one-tap "use the correct value" suggestion. Mirrors ZONE_FACTOR,
// IMPORTANCE_BY_OCCUPANCY (checker_core.py) and R_BY_SYSTEM (checks.py).
const ZONE_FACTOR: Record<string, number> = { II: 0.1, III: 0.16, IV: 0.24, V: 0.36 };
const IMPORTANCE_BY_OCCUPANCY: Record<string, number> = {
  A: 1.0, E: 1.0, F: 1.0, B: 1.5, C: 1.5, D: 1.5, G: 1.0, H: 1.0, J: 1.5,
};
const R_BY_SYSTEM: Record<string, number> = {
  moment_frame: 5.0, structural_wall: 4.0, wall_moment_frame: 5.0,
  wall_perimeter_frame: 5.0, wall_framed_tube: 5.0,
};

export const DERIVE: Record<string, (profile: Record<string, unknown>) => number | null> = {
  Z_from_zone: (p) => ZONE_FACTOR[String(p.seismic_zone ?? "")] ?? null,
  I_from_occupancy: (p) => IMPORTANCE_BY_OCCUPANCY[String(p.occupancy ?? "").toUpperCase()] ?? null,
  R_from_system: (p) => R_BY_SYSTEM[String(p.structural_system ?? "")] ?? null,
};

// Common element keys so a missing-but-expected dict entry still shows an input.
export const COVER_ELEMENTS = ["columns", "walls", "beams", "slabs", "foundation"];
export const GRADE_ELEMENTS = ["columns", "walls", "beams", "slabs", "foundation"];

// TypeScript mirror of the backend contracts (checker_core.py dataclasses +
// the enriched finding/report shapes returned by the API). Field names match
// the Python side exactly.

export type Verdict = "PASS" | "FLAW" | "REVIEW" | "MISSING" | "NOT_APPLICABLE";

export interface BuildingProfile {
  material: string | null;
  structural_system: string | null;
  height_m: number | null;
  num_storeys: number | null;
  occupancy: string | null;
  seismic_zone: string | null;
  basic_wind_speed: number | null;
  soil_type: string | null;
  foundation_type: string | null;
  district: string | null;
  near_fault: boolean | null;
  occupants: number | null;
}

export interface DBRData {
  profile: BuildingProfile;
  concrete_grades: Record<string, number>;
  rebar_grade: string | null;
  cement_type: string | null;
  exposure_condition: string | null;
  nominal_cover_mm: Record<string, number>;
  zone_factor_Z: number | null;
  importance_factor_I: number | null;
  response_reduction_R: number | null;
  fundamental_period_s: number | null;
  period_method: string | null;
  seismic_weight_LL_pct: number | null;
  drift_ratio: number | null;
  stability_coeff_theta: number | null;
  base_shear_coeff_pct: number | null;
  analysis_method: string | null;
  irregularities: string[];
  wind_tunnel_done: boolean | null;
  wind_tunnel_decision_stated: boolean | null;
  lateral_accel_ms2: number | null;
  force_coefficient_Cf: number | null;
  load_combinations: string[];
  foundation_depth_m: number | null;
  fos_overturning: number | null;
  fos_sliding: number | null;
  settlement_mm: number | null;
  cited_codes: { code: string; year: string }[];
  software_used: string | null;
  title_block: Record<string, string>;
  _provenance?: Record<string, unknown>;
}

export interface Citation {
  id: string | null;
  code: string | null;
  clause: string | null;
  content_type: string | null;
  title: string | null;
  statement: string | null;
  page: number | string | null;
  missing?: boolean;
}

export interface Finding {
  check_id: string;
  title: string;
  verdict: Verdict;
  summary: string;
  expected: unknown;
  found: unknown;
  citation: string | null;
  severity: "low" | "medium" | "high" | string;
  notes: string[];
  citations: Citation[];
  ai_explanation?: string;
}

export interface AdminStats {
  admin_email: string;
  totals: {
    reports: number;
    findings: number;
    flaws: number;
    reports_with_flaws: number;
    clean_reports: number;
    avg_flaws_per_report: number;
  };
  verdict_totals: Partial<Record<Verdict, number>>;
  status_totals: Partial<Record<Verdict, number>>;
  top_flagged_checks: { check_id: string; count: number }[];
  recent_reports: {
    id: string; filename: string | null; created_at: string | null;
    overall_status: Verdict | null; flaw_count: number; check_count: number;
  }[];
  extraction_model: string;
}

export type Summary = Partial<Record<Verdict, number>>;

export interface AnalyzeResponse {
  report_id: string;
  extracted: DBRData;
  findings: Finding[];
  summary: Summary;
  overall_status: Verdict;
  extraction_model?: string | null;
}

export interface CheckResponse {
  report_id: string | null;
  extracted: DBRData;
  findings: Finding[];
  summary: Summary;
  overall_status: Verdict;
}

export interface ReportListItem {
  id: string;
  filename: string | null;
  created_at: string | null;
  updated_at: string | null;
  summary: Summary;
  overall_status: Verdict | null;
  flaw_count: number;
  check_count: number;
}

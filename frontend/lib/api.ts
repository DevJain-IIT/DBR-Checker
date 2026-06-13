// API client for the FastAPI backend. Base URL from NEXT_PUBLIC_API_URL
// (set in Vercel); falls back to localhost for dev.

import type {
  AdminStats,
  AdminUser,
  AnalyzeResponse,
  CheckResponse,
  Citation,
  DBRData,
  Finding,
  ReportListItem,
} from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Fire-and-forget warm-up: ping health so the backend is awake before the user
 * submits (matters if the instance was idle / just restarted). Never throws.
 */
export function warmup(): void {
  fetch(`${BASE}/api/health`, { cache: "no-store" }).catch(() => {});
}

// Hard ceiling so the upload can NEVER spin forever — if the backend hangs or
// dies mid-request, abort and surface a retry-able error instead of a frozen UI.
const ANALYZE_TIMEOUT_MS = 150_000;  // 150s > backend's 120s extraction budget

export async function analyzePdf(file: File, userEmail: string): Promise<AnalyzeResponse> {
  const doPost = async () => {
    const form = new FormData();
    form.append("file", file);
    form.append("user_email", userEmail);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ANALYZE_TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}/api/analyze`, { method: "POST", body: form, signal: ctrl.signal });
      return await jsonOrThrow<AnalyzeResponse>(res);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await doPost();
  } catch (e) {
    // Retry once on a transient network error or an abort/timeout (server was
    // mid-restart, cold-starting, or briefly unavailable). Don't retry real HTTP
    // errors (4xx/5xx carry a status and won't change on retry).
    const transient = e instanceof TypeError || (e instanceof DOMException && e.name === "AbortError");
    if (!transient) throw e;
    await new Promise((r) => setTimeout(r, 2000));
    return doPost();
  }
}

export async function recheck(
  extracted: DBRData,
  reportId?: string | null,
  filename?: string | null,
  userEmail?: string | null,
): Promise<CheckResponse> {
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extracted, report_id: reportId ?? null, filename: filename ?? null, user_email: userEmail ?? null }),
  });
  return jsonOrThrow<CheckResponse>(res);
}

export async function getClause(id: string): Promise<Citation & Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/clause/${encodeURIComponent(id)}`);
  return jsonOrThrow(res);
}

export async function listReports(limit = 50, email?: string | null): Promise<ReportListItem[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  if (email) q.set("email", email);
  const res = await fetch(`${BASE}/api/reports?${q.toString()}`, { cache: "no-store" });
  const data = await jsonOrThrow<{ reports: ReportListItem[] }>(res);
  return data.reports;
}

export async function getReport(id: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE}/api/reports/${encodeURIComponent(id)}`, { cache: "no-store" });
  return jsonOrThrow<AnalyzeResponse>(res);
}

// Persist the engineer's REVIEW-tab decisions on a saved report. The full map
// replaces what's stored server-side.
export async function saveReviewDecisions(
  reportId: string,
  decisions: Record<string, string>,
): Promise<Record<string, string>> {
  const res = await fetch(`${BASE}/api/reports/${encodeURIComponent(reportId)}/reviews`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decisions }),
  });
  const data = await jsonOrThrow<{ review_decisions: Record<string, string> }>(res);
  return data.review_decisions;
}

export async function explainFinding(finding: Finding): Promise<string> {
  const res = await fetch(`${BASE}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ finding }),
  });
  const data = await jsonOrThrow<{ explanation: string }>(res);
  return data.explanation;
}

export interface ZoneByCoords {
  lat: number; lon: number;
  seismic_zone: string | null;
  district: string | null;
  state: string | null;
  msk_intensity: string | null;
  boundary_case: boolean;
  note: string | null;
  citation: string;
  method: string;
}

export async function zoneByCoords(lat: number, lon: number): Promise<ZoneByCoords> {
  const res = await fetch(`${BASE}/api/location/zone?lat=${lat}&lon=${lon}`, { cache: "no-store" });
  return jsonOrThrow<ZoneByCoords>(res);
}

export async function health(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
  return jsonOrThrow(res);
}

// ---- Admin auth (email + password -> bearer token) ----
function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function adminLogin(email: string, password: string): Promise<{ token: string; admin: AdminUser }> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return jsonOrThrow(res);
}

export async function adminStats(token: string): Promise<AdminStats> {
  const res = await fetch(`${BASE}/api/admin/stats`, { cache: "no-store", headers: authHeader(token) });
  return jsonOrThrow<AdminStats>(res);
}

export async function listAdmins(token: string): Promise<AdminUser[]> {
  const res = await fetch(`${BASE}/api/admin/admins`, { cache: "no-store", headers: authHeader(token) });
  const data = await jsonOrThrow<{ admins: AdminUser[] }>(res);
  return data.admins;
}

export async function createAdmin(token: string, email: string, password: string): Promise<AdminUser> {
  const res = await fetch(`${BASE}/api/admin/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ email, password }),
  });
  const data = await jsonOrThrow<{ admin: AdminUser }>(res);
  return data.admin;
}

export async function deleteAdmin(token: string, adminId: string): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/admins/${adminId}`, { method: "DELETE", headers: authHeader(token) });
  await jsonOrThrow(res);
}

export async function changeAdminPassword(token: string, adminId: string, password: string): Promise<void> {
  const res = await fetch(`${BASE}/api/admin/admins/${adminId}/password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ password }),
  });
  await jsonOrThrow(res);
}

// API client for the FastAPI backend. Base URL from NEXT_PUBLIC_API_URL
// (set in Vercel); falls back to localhost for dev.

import type {
  AdminStats,
  AnalyzeResponse,
  CheckResponse,
  Citation,
  DBRData,
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

export async function analyzePdf(file: File): Promise<AnalyzeResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/api/analyze`, { method: "POST", body: form });
  return jsonOrThrow<AnalyzeResponse>(res);
}

export async function recheck(
  extracted: DBRData,
  reportId?: string | null,
  filename?: string | null,
): Promise<CheckResponse> {
  const res = await fetch(`${BASE}/api/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extracted, report_id: reportId ?? null, filename: filename ?? null }),
  });
  return jsonOrThrow<CheckResponse>(res);
}

export async function getClause(id: string): Promise<Citation & Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/clause/${encodeURIComponent(id)}`);
  return jsonOrThrow(res);
}

export async function listReports(limit = 50): Promise<ReportListItem[]> {
  const res = await fetch(`${BASE}/api/reports?limit=${limit}`, { cache: "no-store" });
  const data = await jsonOrThrow<{ reports: ReportListItem[] }>(res);
  return data.reports;
}

export async function getReport(id: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE}/api/reports/${encodeURIComponent(id)}`, { cache: "no-store" });
  return jsonOrThrow<AnalyzeResponse>(res);
}

export async function health(): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/health`, { cache: "no-store" });
  return jsonOrThrow(res);
}

export async function adminStats(passcode: string): Promise<AdminStats> {
  const res = await fetch(`${BASE}/api/admin/stats`, {
    cache: "no-store",
    headers: { "X-Admin-Passcode": passcode },
  });
  return jsonOrThrow<AdminStats>(res);
}

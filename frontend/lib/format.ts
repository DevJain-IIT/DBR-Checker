// Engine findings carry expected/found as scalars, lists, or dicts. These
// helpers render them compactly for the report cards.

export function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.map(fmtValue).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${fmtValue(val)}`)
      .join(" · ");
  }
  return String(v);
}

// Map engine severity -> the mockup's SevTag categories.
export function sevTag(severity: string, verdict: string): "critical" | "major" | "minor" | "info" {
  if (verdict === "FLAW" && severity === "high") return "critical";
  if (severity === "high") return "major";
  if (severity === "medium") return verdict === "REVIEW" ? "major" : "minor";
  return "info";
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

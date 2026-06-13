// Human-friendly phrasing for the front of a flaw card, keyed by check_id.
// Keeps the raw engine summary (Python-ish lists, code jargon) out of the
// user's face — the precise expected/found + citation still live behind
// "Show more". Any check without an override falls back to finding.summary.

import type { Finding } from "@/lib/types";

// D14 load combinations: the engine summary looks like
//   "Load-combination set incomplete; missing ['earthquake combinations
//    (DL/IL/EL)', 'wind combinations (DL/IL/WL)']."
// and `found` is the list of combos present. We don't parse the Python repr;
// we just detect which lateral cases are absent and say so plainly.
function loadCombosMessage(finding: Finding): string | null {
  const blob = `${finding.summary ?? ""} ${JSON.stringify(finding.found ?? "")} ${JSON.stringify(finding.expected ?? "")}`;
  const missesEQ = /earthquake|seismic|\bEL\b|\bEQ\b/i.test(finding.summary ?? "");
  const missesWind = /wind|\bWL\b/i.test(finding.summary ?? "");

  // Prefer the explicit "missing [...]" clause if present.
  const m = (finding.summary ?? "").match(/missing\s*(\[[^\]]*\]|.+)$/i);
  const missingClause = m ? m[1] : "";
  const eq = missesEQ || /earthquake|seismic|\bEL\b|\bEQ\b/i.test(missingClause);
  const wind = missesWind || /wind|\bWL\b/i.test(missingClause);

  if (eq && wind) return "You've missed the earthquake (EQ) and wind load combinations.";
  if (eq) return "You've missed the earthquake (EQ) load combinations.";
  if (wind) return "You've missed the wind load combinations.";
  // Incomplete but we couldn't tell which — keep it simple, not a list dump.
  if (/incomplete|missing/i.test(blob)) return "Your load-combination set is incomplete.";
  return null;
}

const OVERRIDES: Record<string, (f: Finding) => string | null> = {
  D14: loadCombosMessage,
};

// Which lateral cases D14 says are missing — drives the simplified bullet list
// and the "add to DBR" button. Returns { eq, wind } booleans.
export function missingCombos(finding: Finding): { eq: boolean; wind: boolean } {
  const s = finding.summary ?? "";
  return {
    eq: /earthquake|seismic|\bEL\b|\bEQ\b/i.test(s),
    wind: /wind|\bWL\b/i.test(s),
  };
}

// The standard IS load combinations we offer to add to the generated DBR, by
// case. Plain-language labels (no raw Python list). EQ per IS 1893 Cl 6.3.1.2,
// wind per IS 875-5 Cl 8.1 / IS 456 Table 18.
export const STANDARD_COMBOS = {
  eq: [
    "1.2 (DL + IL ± EL)",
    "1.5 (DL ± EL)",
    "0.9 DL ± 1.5 EL",
  ],
  wind: [
    "1.2 (DL + IL ± WL)",
    "1.5 (DL ± WL)",
    "0.9 DL ± 1.5 WL",
  ],
};

/** Front-of-card message for a finding — simplified where we have an override. */
export function flawMessage(finding: Finding): string {
  const fn = OVERRIDES[finding.check_id];
  if (fn) {
    const msg = fn(finding);
    if (msg) return msg;
  }
  return finding.summary;
}

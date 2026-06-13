"use client";

import React from "react";
import { saveReviewDecisions } from "./api";

/**
 * Per-report engineer decisions on REVIEW-verdict checks. The map is the source
 * of truth for the report and is PERSISTED server-side (so it shows in History
 * and the database). sessionStorage is kept as a local cache so a reload is
 * instant and decisions survive a transient network blip.
 *   "accepted" — looks correct, DBR is fine as stated
 *   "revise"   — needs a correction / something added (flagged for follow-up)
 *   "ignored"  — not relevant to this project, dismiss
 * Absent key = undecided (still needs review).
 *
 * Pass `initial` (from the saved report's review_decisions) to hydrate; once
 * hydrated, every change is written through to the backend (debounced).
 */
export type ReviewDecision = "accepted" | "revise" | "ignored";

export function useReviewDecisions(reportId: string, initial?: Record<string, ReviewDecision>) {
  const key = `dbr-review-${reportId}`;
  const [decisions, setDecisions] = React.useState<Record<string, ReviewDecision>>({});
  const hydrated = React.useRef(false);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate from the session cache immediately (instant on reload).
  React.useEffect(() => {
    if (hydrated.current) return;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setDecisions(JSON.parse(raw) as Record<string, ReviewDecision>);
    } catch { /* ignore */ }
    hydrated.current = true;
  }, [key]);

  // When the saved report's server value arrives (it loads async), reconcile to
  // it — the server is the source of truth across devices/sessions. Only do this
  // once, when a non-empty server map first appears.
  const serverApplied = React.useRef(false);
  React.useEffect(() => {
    if (serverApplied.current) return;
    if (initial && Object.keys(initial).length) {
      serverApplied.current = true;
      setDecisions(initial);
      try { sessionStorage.setItem(key, JSON.stringify(initial)); } catch { /* ignore */ }
    }
  }, [key, initial]);

  // Persist on change: session cache immediately, server debounced.
  const persist = React.useCallback((next: Record<string, ReviewDecision>) => {
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveReviewDecisions(reportId, next).catch(() => { /* keep local; retry on next change */ });
    }, 500);
  }, [key, reportId]);

  React.useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // Set a decision; passing the same decision again clears it (toggle to undecided).
  const decide = React.useCallback((checkId: string, decision: ReviewDecision) => {
    setDecisions((prev) => {
      const next = { ...prev };
      if (next[checkId] === decision) delete next[checkId];
      else next[checkId] = decision;
      persist(next);
      return next;
    });
  }, [persist]);

  const decisionOf = React.useCallback((checkId: string): ReviewDecision | null => decisions[checkId] ?? null, [decisions]);

  return { decisions, decisionOf, decide };
}

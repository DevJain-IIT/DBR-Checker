"use client";

import React from "react";

/**
 * Per-report engineer decisions on REVIEW-verdict checks, persisted to
 * sessionStorage (survives reload within the session). A REVIEW check is one the
 * deterministic engine can't pass/fail on its own — the engineer reads the clause
 * and their DBR, then records a judgement:
 *   "accepted" — looks correct, DBR is fine as stated
 *   "revise"   — needs a correction / something added (flagged for follow-up)
 *   "ignored"  — not relevant to this project, dismiss
 * Absent key = undecided (still needs review).
 */
export type ReviewDecision = "accepted" | "revise" | "ignored";

export function useReviewDecisions(reportId: string) {
  const key = `dbr-review-${reportId}`;
  const [decisions, setDecisions] = React.useState<Record<string, ReviewDecision>>({});

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      setDecisions(raw ? (JSON.parse(raw) as Record<string, ReviewDecision>) : {});
    } catch {
      setDecisions({});
    }
  }, [key]);

  const persist = React.useCallback((next: Record<string, ReviewDecision>) => {
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);

  // Set a decision; passing the same decision again clears it (toggle back to undecided).
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

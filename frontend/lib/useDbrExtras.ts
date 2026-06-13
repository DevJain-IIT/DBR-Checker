"use client";

import React from "react";

/**
 * Per-report "DBR extras" — engineer decisions that don't belong to the
 * checker's DBRData but WILL feed the generated DBR (next phase). Persisted to
 * sessionStorage now; the generator will consume them when it's built.
 *
 *  - constructionType: the NBC construction type the engineer chose (D25).
 *  - addCombos: include the standard EQ/wind load combinations in the DBR (D14).
 *  - flaggedFlaws: check_ids the engineer kept despite non-compliance, to be
 *    carried into the generated DBR as flagged flaws ("acknowledge as flaw").
 */
export interface DbrExtras {
  constructionType: string | null;
  addCombos: boolean;
  flaggedFlaws: string[];
}

const EMPTY: DbrExtras = { constructionType: null, addCombos: false, flaggedFlaws: [] };

export function useDbrExtras(reportId: string) {
  const key = `dbr-extras-${reportId}`;
  const [extras, setExtras] = React.useState<DbrExtras>(EMPTY);

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      setExtras(raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<DbrExtras>) } : EMPTY);
    } catch {
      setExtras(EMPTY);
    }
  }, [key]);

  const persist = React.useCallback((next: DbrExtras) => {
    setExtras(next);
    try { sessionStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore */ }
  }, [key]);

  const setConstructionType = React.useCallback((v: string | null) =>
    setExtras((prev) => { const n = { ...prev, constructionType: v }; try { sessionStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } return n; }), [key]);

  const setAddCombos = React.useCallback((v: boolean) =>
    setExtras((prev) => { const n = { ...prev, addCombos: v }; try { sessionStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } return n; }), [key]);

  // Toggle a check_id in/out of the flagged-as-flaw set.
  const toggleFlagged = React.useCallback((checkId: string) =>
    setExtras((prev) => {
      const has = prev.flaggedFlaws.includes(checkId);
      const flaggedFlaws = has ? prev.flaggedFlaws.filter((id) => id !== checkId) : [...prev.flaggedFlaws, checkId];
      const n = { ...prev, flaggedFlaws };
      try { sessionStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ }
      return n;
    }), [key]);

  const isFlagged = React.useCallback((checkId: string) => extras.flaggedFlaws.includes(checkId), [extras.flaggedFlaws]);

  return { extras, persist, setConstructionType, setAddCombos, toggleFlagged, isFlagged };
}

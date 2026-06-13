"use client";

import React from "react";

/**
 * Reversible, session-persisted "ignore" set for flaw cards, scoped per report.
 * Ignoring a check_id acknowledges it (turns the card green) without a network
 * call; toggling again reopens it. Backed by sessionStorage so it survives a
 * reload within the session.
 */
export function useIgnored(reportId: string) {
  const key = `dbr-ignored-${reportId}`;
  const [ignored, setIgnored] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) setIgnored(new Set(JSON.parse(raw) as string[]));
      else setIgnored(new Set());
    } catch {
      setIgnored(new Set());
    }
  }, [key]);

  const persist = React.useCallback((next: Set<string>) => {
    try { sessionStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore */ }
  }, [key]);

  const toggle = React.useCallback((checkId: string) => {
    setIgnored((prev) => {
      const next = new Set(prev);
      if (next.has(checkId)) next.delete(checkId);
      else next.add(checkId);
      persist(next);
      return next;
    });
  }, [persist]);

  const isIgnored = React.useCallback((checkId: string) => ignored.has(checkId), [ignored]);

  return { ignored, isIgnored, toggle };
}

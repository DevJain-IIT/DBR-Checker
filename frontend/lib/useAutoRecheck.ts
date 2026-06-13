"use client";

import React from "react";
import { recheck } from "./api";
import type { CheckResponse, DBRData } from "./types";

/**
 * Debounced auto-recheck. Call scheduleRecheck(working) whenever the user edits
 * a value; after `delayMs` of quiet it runs the existing /api/check and calls
 * onResult with the fresh findings. Rapid edits coalesce to one call. A
 * monotonic requestSeq discards superseded in-flight responses so an older,
 * slower response can't overwrite a newer one.
 */
export function useAutoRecheck({
  reportId,
  userEmail,
  hasServerExtract,
  onResult,
  onError,
  delayMs = 700,
}: {
  reportId: string;
  userEmail: string | null;
  hasServerExtract: boolean;
  onResult: (res: CheckResponse) => void;
  onError?: (e: unknown) => void;
  delayMs?: number;
}) {
  const [rechecking, setRechecking] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = React.useRef(0);
  const latestApplied = React.useRef(0);

  // keep the newest callbacks without re-creating scheduleRecheck
  const cbs = React.useRef({ onResult, onError });
  cbs.current = { onResult, onError };

  const scheduleRecheck = React.useCallback(
    (working: DBRData) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const mySeq = ++seq.current;
        setRechecking(true);
        try {
          const res = await recheck(working, reportId, hasServerExtract ? undefined : null, userEmail);
          // only apply if this is the newest issued request
          if (mySeq >= latestApplied.current) {
            latestApplied.current = mySeq;
            cbs.current.onResult(res);
          }
        } catch (e) {
          cbs.current.onError?.(e);
        } finally {
          // clear the spinner only when the newest request settles
          if (mySeq === seq.current) setRechecking(false);
        }
      }, delayMs);
    },
    [reportId, userEmail, hasServerExtract, delayMs],
  );

  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { scheduleRecheck, rechecking };
}

"use client";

import React from "react";
import type { Finding } from "@/lib/types";
import { Icon, T, VerdictBadge } from "@/lib/design";
import { CitationBody } from "@/components/FindingCard";

/**
 * Right-side slide-in detail for a single check: verdict, citation text,
 * expected-vs-found and on-demand AI explanation (reuses CitationBody).
 * One instance lives at page level; `finding` null = closed.
 */
export function SlideOverPanel({ finding, onClose }: { finding: Finding | null; onClose: () => void }) {
  // close on Escape
  React.useEffect(() => {
    if (!finding) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finding, onClose]);

  const open = !!finding;

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} className="no-print" style={{
        position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,22,40,0.35)",
        opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .25s",
      }} />
      {/* panel */}
      <aside className="no-print dbr-scroll" style={{
        position: "fixed", top: 0, right: 0, height: "100vh", width: "min(480px, 92vw)", zIndex: 51,
        background: T.paper, borderLeft: `1px solid ${T.border}`, boxShadow: "-24px 0 60px -30px rgba(10,22,40,0.5)",
        transform: open ? "translateX(0)" : "translateX(100%)", transition: `transform .3s ${T.spring}`,
        overflowY: "auto", display: "flex", flexDirection: "column",
      }}>
        {finding && (
          <>
            <div style={{ position: "sticky", top: 0, background: T.paper, borderBottom: `1px solid ${T.border}`, padding: "16px 18px", display: "flex", alignItems: "center", gap: 12, zIndex: 1 }}>
              <VerdictBadge verdict={finding.verdict} size="sm" animate={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{finding.check_id}</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{finding.title}</div>
              </div>
              <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon.Close size={15} color={T.muted} />
              </button>
            </div>
            <div style={{ padding: "4px 2px" }}>
              <CitationBody check={finding} />
            </div>
          </>
        )}
      </aside>
    </>
  );
}

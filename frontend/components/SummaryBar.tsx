"use client";

import React from "react";
import type { Summary, Verdict } from "@/lib/types";
import { Icon, T, VERDICTS, VERDICT_ORDER, VIcon, useCountUp } from "@/lib/design";

export function SummaryBar({ counts, total, filter, toggle, allOn }: {
  counts: Summary; total: number;
  filter: Set<Verdict>; toggle: (k: Verdict) => void; allOn: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  const flaw = counts.FLAW ?? 0;
  const missing = counts.MISSING ?? 0;
  const review = counts.REVIEW ?? 0;
  const pass = counts.PASS ?? 0;
  const flawTotal = flaw + missing;
  const passPct = total ? Math.round((pass / total) * 100) : 0;

  return (
    <div className="no-print" style={{ position: "sticky", top: 60, zIndex: 15, background: "rgba(250,247,242,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ position: "relative", width: 50, height: 50 }}>
            <Donut counts={counts} total={total} mounted={mounted} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontFamily: T.serif, fontSize: 25, lineHeight: 1 }}>{flawTotal > 0 ? `${flawTotal} need attention` : "All clear"}</span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 4, letterSpacing: "0.02em" }}>
              {passPct}% PASS · {flaw} FLAW · {review} REVIEW · {total} TOTAL
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 38, background: T.border }} />

        <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
          {VERDICT_ORDER.map((k, i) => (
            <StatChip key={k} vk={k} n={counts[k] ?? 0} active={filter.has(k)} dim={!allOn && !filter.has(k)} onClick={() => toggle(k)} mounted={mounted} />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: T.mono, fontSize: 10.5, color: T.subtle, letterSpacing: "0.04em" }}>
          <Icon.Filter size={13} color={T.subtle} />
          {allOn ? "TAP A CHIP TO FILTER" : "FILTERED"}
        </div>
      </div>
    </div>
  );
}

function StatChip({ vk, n, active, dim, onClick, mounted }: { vk: Verdict; n: number; active: boolean; dim: boolean; onClick: () => void; mounted: boolean }) {
  const v = VERDICTS[vk];
  const [hover, setHover] = React.useState(false);
  const val = useCountUp(n, { start: mounted, duration: 800 });
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "8px 13px 8px 11px", borderRadius: 11, cursor: "pointer", fontFamily: T.sans, background: active ? v.bg : T.panel, border: `1px solid ${active ? v.line : T.border}`, opacity: dim ? 0.45 : 1, transform: hover ? "translateY(-2px)" : mounted ? "none" : "scale(.9)", boxShadow: hover ? `0 10px 22px -14px ${v.solid}` : "none", transition: `all .2s ${T.spring}` }}>
      <VIcon name={v.icon} size={15} color={v.solid} />
      <span style={{ fontFamily: T.serif, fontSize: 22, color: v.fg, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{val}</span>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, letterSpacing: "0.08em" }}>{v.label.toUpperCase()}</span>
    </button>
  );
}

function Donut({ counts, total, mounted }: { counts: Summary; total: number; mounted: boolean }) {
  const R = 21, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = VERDICT_ORDER.map((k) => {
    const frac = total ? (counts[k] ?? 0) / total : 0;
    const seg = { k, dash: frac * C, off: offset, color: VERDICTS[k].solid };
    offset += frac * C;
    return seg;
  });
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="25" cy="25" r={R} fill="none" stroke={T.border} strokeWidth="7" />
      {segs.map((s, i) => (
        <circle key={s.k} cx="25" cy="25" r={R} fill="none" stroke={s.color} strokeWidth="7" strokeDasharray={`${mounted ? s.dash : 0} ${C}`} strokeDashoffset={-s.off} style={{ transition: `stroke-dasharray .8s ${0.2 + i * 0.1}s ${T.spring}` }} />
      ))}
    </svg>
  );
}

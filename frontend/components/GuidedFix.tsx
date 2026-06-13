"use client";

import React from "react";
import type { DBRData, Finding } from "@/lib/types";
import { Icon, T, VERDICTS } from "@/lib/design";
import { FlawCard } from "@/components/FlawCard";
import type { useDbrExtras } from "@/lib/useDbrExtras";

/**
 * Primary guided-fix view. Two streams of actionable cards:
 *   FLAW  -> "Correct it" cards
 *   MISSING -> "Provide the missing item" cards
 * Progress + a Generate-DBR button gated until every FLAW/MISSING is fixed or
 * acknowledged. REVIEW/PASS/N/A do not appear here (they live in Full report).
 */
export function GuidedFix({ findings, working, onChange, rechecking, rechckingId, isIgnored, onToggleIgnore, onShowMore, onGenerate, extras }: {
  findings: Finding[];
  working: DBRData;
  onChange: (next: DBRData, checkId?: string) => void;
  rechecking: boolean;
  rechckingId: string | null;
  isIgnored: (checkId: string) => boolean;
  onToggleIgnore: (checkId: string) => void;
  onShowMore: (f: Finding) => void;
  onGenerate: () => void;
  extras: ReturnType<typeof useDbrExtras>;
}) {
  // The set of checks that were FLAW/MISSING at first load is captured once and
  // becomes the fixed roster of cards. We keep rendering those same checks even
  // after a fix flips their verdict to PASS — the card stays put and turns green
  // ("FIXED") rather than vanishing, so progress is visible. New flaws that only
  // surface on a later re-check are folded in too (union), so nothing is hidden.
  const rosterRef = React.useRef<{ flaws: string[]; missing: string[] } | null>(null);
  if (rosterRef.current === null) {
    rosterRef.current = {
      flaws: findings.filter((f) => f.verdict === "FLAW").map((f) => f.check_id),
      missing: findings.filter((f) => f.verdict === "MISSING").map((f) => f.check_id),
    };
  }
  // Fold in any newly-surfaced FLAW/MISSING from later re-checks.
  for (const f of findings) {
    if (f.verdict === "FLAW" && !rosterRef.current.flaws.includes(f.check_id) && !rosterRef.current.missing.includes(f.check_id)) rosterRef.current.flaws.push(f.check_id);
    if (f.verdict === "MISSING" && !rosterRef.current.missing.includes(f.check_id) && !rosterRef.current.flaws.includes(f.check_id)) rosterRef.current.missing.push(f.check_id);
  }

  const byId = new Map(findings.map((f) => [f.check_id, f]));
  const flaws = rosterRef.current.flaws.map((id) => byId.get(id)).filter((f): f is Finding => !!f);
  const missing = rosterRef.current.missing.map((id) => byId.get(id)).filter((f): f is Finding => !!f);

  // A roster item is resolved when it's fixed (PASS/N/A/REVIEW), ignored,
  // kept-and-flagged (acknowledged as a flaw for the DBR), or — for D14 — the
  // standard combinations have been queued for the generated DBR.
  const isResolved = (f: Finding) =>
    isIgnored(f.check_id) ||
    extras.isFlagged(f.check_id) ||
    (f.check_id === "D14" && extras.extras.addCombos) ||
    (f.verdict !== "FLAW" && f.verdict !== "MISSING");
  const roster = [...flaws, ...missing];
  const total = roster.length;
  const resolvedCount = roster.filter(isResolved).length;
  const allClear = total > 0 && resolvedCount === total;
  const pct = total ? Math.round((resolvedCount / total) * 100) : 100;

  // stable numbering across both streams
  let n = 0;

  return (
    <div>
      {/* progress header */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 22px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, lineHeight: 1 }}>
              {allClear ? "All issues resolved 🎉" : `${resolvedCount} of ${total} resolved`}
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
              {allClear
                ? "Every flaw is fixed or acknowledged — your DBR is ready to generate."
                : "Correct or provide each item below. Fix one and watch it turn green."}
              {rechecking && <span style={{ marginLeft: 8, fontFamily: T.mono, fontSize: 11, color: T.cyanDeep }}>· re-checking…</span>}
            </div>
          </div>
          <button onClick={onGenerate} disabled={!allClear || rechecking} style={{
            display: "inline-flex", alignItems: "center", gap: 9, padding: "13px 22px", borderRadius: 12, border: "none",
            fontFamily: T.sans, fontSize: 15, fontWeight: 600,
            background: allClear ? VERDICTS.PASS.solid : T.sand, color: allClear ? "#fff" : T.subtle,
            cursor: allClear && !rechecking ? "pointer" : "not-allowed",
            boxShadow: allClear ? `0 12px 28px -14px ${VERDICTS.PASS.solid}` : "none", transition: `all .25s ${T.spring}`,
          }}>
            <Icon.File size={17} color={allClear ? "#fff" : T.subtle} /> Generate DBR
          </button>
        </div>
        {/* progress bar */}
        <div style={{ height: 8, background: T.sand, borderRadius: 999, overflow: "hidden", marginTop: 16 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: VERDICTS.PASS.solid, transition: `width .5s ${T.spring}` }} />
        </div>
      </div>

      {total === 0 && (
        <div style={{ textAlign: "center", padding: "50px 24px", color: T.muted }}>
          <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>No flaws found 🎉</div>
          <div style={{ fontSize: 14, marginTop: 8 }}>Nothing to correct — the DBR passed every required check.</div>
        </div>
      )}

      {/* FLAW stream */}
      {flaws.length > 0 && (
        <Section title="Correct these" subtitle="Values that don't meet the code or the DBR">
          {flaws.map((f) => {
            n += 1;
            return <FlawCard key={f.check_id} finding={f} index={n} working={working} onChange={onChange}
              ignored={isIgnored(f.check_id)} onToggleIgnore={() => onToggleIgnore(f.check_id)} onShowMore={() => onShowMore(f)}
              rechecking={rechecking && rechckingId === f.check_id} extras={extras} />;
          })}
        </Section>
      )}

      {/* MISSING stream */}
      {missing.length > 0 && (
        <Section title="Provide the missing items" subtitle="Required values not stated in the DBR">
          {missing.map((f) => {
            n += 1;
            return <FlawCard key={f.check_id} finding={f} index={n} working={working} onChange={onChange}
              ignored={isIgnored(f.check_id)} onToggleIgnore={() => onToggleIgnore(f.check_id)} onShowMore={() => onShowMore(f)}
              rechecking={rechecking && rechckingId === f.check_id} extras={extras} />;
          })}
        </Section>
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{ marginBottom: 12 }}>
        <h3 style={{ fontFamily: T.serif, fontSize: 21, color: T.ink, margin: 0, fontWeight: 400 }}>{title}</h3>
        <div style={{ fontSize: 12.5, color: T.subtle, marginTop: 2 }}>{subtitle}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
    </section>
  );
}

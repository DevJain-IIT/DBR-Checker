"use client";

import React from "react";
import type { DBRData, Finding } from "@/lib/types";
import { Icon, T, VERDICTS, VIcon } from "@/lib/design";
import { fmtValue } from "@/lib/format";
import { dbrPageForCheck } from "@/lib/checkInputs";
import { CitationBody } from "@/components/FindingCard";
import type { ReviewDecision } from "@/lib/useReviewDecisions";

/**
 * Review view: the REVIEW-verdict checks — ones the deterministic engine can't
 * pass/fail on its own, so a qualified engineer must judge them. For each, the
 * card shows what the DBR states (+ its page) and the cited clause, and lets the
 * engineer record a decision: looks correct / needs revision / ignore.
 * Decisions persist per report (useReviewDecisions) but make no engine call —
 * REVIEW items aren't auto-resolvable, they're human sign-offs.
 */
export function ReviewPanel({ findings, working, decisionOf, onDecide, onShowMore }: {
  findings: Finding[];
  working: DBRData;
  decisionOf: (checkId: string) => ReviewDecision | null;
  onDecide: (checkId: string, decision: ReviewDecision) => void;
  onShowMore: (f: Finding) => void;
}) {
  const reviews = findings.filter((f) => f.verdict === "REVIEW");
  const total = reviews.length;
  const decided = reviews.filter((f) => decisionOf(f.check_id) != null).length;
  const allDone = total > 0 && decided === total;
  const pct = total ? Math.round((decided / total) * 100) : 100;

  if (total === 0) {
    return (
      <div style={{ textAlign: "center", padding: "50px 24px", color: T.muted }}>
        <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>Nothing to review</div>
        <div style={{ fontSize: 14, marginTop: 8 }}>No check needs engineer judgement on this DBR.</div>
      </div>
    );
  }

  return (
    <div>
      {/* progress header */}
      <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "18px 22px", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, lineHeight: 1 }}>
              {allDone ? "Every review signed off ✓" : `${decided} of ${total} reviewed`}
            </div>
            <div style={{ fontSize: 13, color: T.muted, marginTop: 6 }}>
              These checks need your judgement. Read the clause and your DBR, then mark each one.
            </div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 10, background: VERDICTS.REVIEW.bg, border: `1px solid ${VERDICTS.REVIEW.line}`, fontFamily: T.mono, fontSize: 12, color: VERDICTS.REVIEW.fg }}>
            <VIcon name="eye" size={15} color={VERDICTS.REVIEW.solid} /> {total - decided} awaiting review
          </div>
        </div>
        <div style={{ height: 8, background: T.sand, borderRadius: 999, overflow: "hidden", marginTop: 16 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: VERDICTS.REVIEW.solid, transition: `width .5s ${T.spring}` }} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {reviews.map((f, i) => (
          <ReviewCard key={f.check_id} finding={f} index={i + 1} working={working}
            decision={decisionOf(f.check_id)} onDecide={(d) => onDecide(f.check_id, d)} onShowMore={() => onShowMore(f)} />
        ))}
      </div>
    </div>
  );
}

const DECISIONS: { key: ReviewDecision; label: string; icon: "check" | "alert" | "slash"; tone: typeof VERDICTS["PASS"] }[] = [
  { key: "accepted", label: "Looks correct", icon: "check", tone: VERDICTS.PASS },
  { key: "revise", label: "Needs revision", icon: "alert", tone: VERDICTS.FLAW },
  { key: "ignored", label: "Ignore", icon: "slash", tone: VERDICTS.NOT_APPLICABLE },
];

function ReviewCard({ finding, index, working, decision, onDecide, onShowMore }: {
  finding: Finding;
  index: number;
  working: DBRData;
  decision: ReviewDecision | null;
  onDecide: (d: ReviewDecision) => void;
  onShowMore: () => void;
}) {
  const [openClause, setOpenClause] = React.useState(false);
  const dbrPage = dbrPageForCheck(finding.check_id, (working as { _provenance?: Record<string, number> })._provenance);
  const decidedMeta = decision ? DECISIONS.find((d) => d.key === decision) : null;
  const tone = decidedMeta ? decidedMeta.tone : VERDICTS.REVIEW;

  return (
    <div style={{
      background: T.panel, borderRadius: 14, overflow: "hidden",
      border: `1px solid ${tone.line}`, borderLeft: `4px solid ${tone.solid}`,
      boxShadow: "0 1px 0 rgba(10,22,40,0.02)",
      transition: `border-color .35s ${T.spring}`,
      animation: `dbr-fade-up .4s ${Math.min(index * 0.03, 0.3)}s both`,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "15px 18px" }}>
        <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
          background: tone.bg, border: `1px solid ${tone.line}`, color: tone.fg, fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>
          {decidedMeta ? <VIcon name={decidedMeta.icon} size={16} color={tone.solid} /> : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: tone.fg, fontWeight: 600 }}>{finding.check_id}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{finding.title}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: tone.fg, background: tone.bg, border: `1px solid ${tone.line}`, borderRadius: 5, padding: "2px 7px", animation: decidedMeta ? `dbr-badge-pop .42s ${T.spring} both` : "none" }}>
              {decidedMeta ? decidedMeta.label.toUpperCase() : "NEEDS REVIEW"}
            </span>
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>{finding.summary}</div>

          {/* what the DBR states + page */}
          {(finding.found != null || finding.expected != null) && (
            <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontFamily: T.mono, fontSize: 12 }}>
              {finding.found != null && (
                <span style={{ color: T.muted }}>your DBR states <span style={{ color: T.ink, fontWeight: 600 }}>{fmtValue(finding.found)}</span></span>
              )}
              {finding.expected != null && (
                <span style={{ color: T.muted }}>code basis <span style={{ color: T.ink, fontWeight: 600 }}>{fmtValue(finding.expected)}</span></span>
              )}
            </div>
          )}
          {dbrPage != null && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, fontFamily: T.mono, fontSize: 11, color: T.subtle }}>
              <Icon.File size={12} color={T.subtle} /> stated on page {dbrPage} of your DBR
            </div>
          )}

          {/* inline clause toggle + full detail */}
          <div style={{ display: "flex", gap: 16, marginTop: 11 }}>
            <button onClick={() => setOpenClause((o) => !o)} className="no-print" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: T.cyanDeep, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
              <Icon.Book size={14} color={T.cyanDeep} /> {openClause ? "Hide the clause" : "Read the clause"}
            </button>
            <button onClick={onShowMore} className="no-print" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: T.muted, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
              Full detail →
            </button>
          </div>
        </div>
      </div>

      {/* inline clause body (reuses the citation drawer) */}
      {openClause && (
        <div style={{ borderTop: `1px solid ${T.border}`, background: T.paper }}>
          <CitationBody check={finding} />
        </div>
      )}

      {/* decision row */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "13px 18px 15px 61px", borderTop: `1px solid ${T.border}`, flexWrap: "wrap" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, letterSpacing: "0.06em", marginRight: 2 }}>YOUR CALL</span>
        {DECISIONS.map((d) => {
          const active = decision === d.key;
          return (
            <button key={d.key} onClick={() => onDecide(d.key)} className="no-print" style={{
              display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 9,
              border: `1px solid ${active ? d.tone.line : T.border}`, background: active ? d.tone.bg : T.panel,
              color: active ? d.tone.fg : T.muted, fontFamily: T.sans, fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: `all .18s ${T.spring}`,
            }}>
              <VIcon name={d.icon} size={14} color={active ? d.tone.solid : T.subtle} /> {d.label}
            </button>
          );
        })}
        {decision && (
          <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, marginLeft: 4 }}>click again to undo</span>
        )}
      </div>
    </div>
  );
}

"use client";

import React from "react";
import type { DBRData, Finding } from "@/lib/types";
import { T, VERDICTS, VIcon } from "@/lib/design";
import { CHECK_INPUTS } from "@/lib/checkInputs";
import { flawMessage } from "@/lib/flawMessages";
import { FixControl } from "@/components/FixControl";

/**
 * One numbered "flaw" in the guided-fix view. A FLAW is framed as "Correct it",
 * a MISSING as "Provide it". The card derives its own state from the live
 * finding: PASS/N/A => Fixed (green); ignored => Acknowledged (green); else open.
 * Editing a control emits the next DBRData up; the parent debounces a recheck.
 */
export function FlawCard({ finding, index, working, onChange, ignored, onToggleIgnore, onShowMore }: {
  finding: Finding;
  index: number;
  working: DBRData;
  onChange: (next: DBRData) => void;
  ignored: boolean;
  onToggleIgnore: () => void;
  onShowMore: () => void;
}) {
  const isMissing = finding.verdict === "MISSING";
  const fixed = finding.verdict === "PASS" || finding.verdict === "NOT_APPLICABLE";
  const underReview = finding.verdict === "REVIEW";
  const resolved = fixed || underReview || ignored;
  const green = fixed || ignored;

  const inputs = CHECK_INPUTS[finding.check_id];
  const tone = green ? VERDICTS.PASS : isMissing ? VERDICTS.MISSING : VERDICTS.FLAW;

  const statusLabel = fixed ? "FIXED" : ignored ? "ACKNOWLEDGED" : underReview ? "UNDER REVIEW" : isMissing ? "MISSING" : "TO FIX";
  const verb = isMissing ? "Provide" : "Correct";

  return (
    <div style={{
      background: T.panel, borderRadius: 14, overflow: "hidden",
      border: `1px solid ${green ? VERDICTS.PASS.line : tone.line}`,
      borderLeft: `4px solid ${tone.solid}`,
      boxShadow: green ? `0 0 0 1px ${VERDICTS.PASS.line}` : "0 1px 0 rgba(10,22,40,0.02)",
      transition: `border-color .4s ${T.spring}, box-shadow .4s ${T.spring}`,
      animation: `dbr-fade-up .4s ${Math.min(index * 0.03, 0.3)}s both`,
      opacity: resolved && !green ? 0.8 : 1,
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "15px 18px" }}>
        <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
          background: green ? VERDICTS.PASS.bg : tone.bg, border: `1px solid ${green ? VERDICTS.PASS.line : tone.line}`,
          color: green ? VERDICTS.PASS.fg : tone.fg, fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>
          {green ? <VIcon name="check" size={16} color={VERDICTS.PASS.solid} /> : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: tone.fg, fontWeight: 600 }}>{finding.check_id}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{finding.title}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: green ? VERDICTS.PASS.fg : tone.fg, background: green ? VERDICTS.PASS.bg : tone.bg, border: `1px solid ${green ? VERDICTS.PASS.line : tone.line}`, borderRadius: 5, padding: "2px 7px", animation: green ? `dbr-badge-pop .42s ${T.spring} both` : "none" }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>{green ? finding.summary : flawMessage(finding)}</div>
          {green ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: VERDICTS.PASS.fg }}>
              <VIcon name="check" size={14} color={VERDICTS.PASS.solid} />
              You&rsquo;ve entered the right value.
            </div>
          ) : (
            (finding.expected != null || finding.found != null) && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginTop: 8, fontSize: 12.5, color: T.muted }}>
                This value needs a correction.
                <button onClick={onShowMore} className="no-print" style={{ fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, color: T.cyanDeep, background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                  See what the code requires →
                </button>
              </div>
            )
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <button onClick={onToggleIgnore} className="no-print" style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: ignored ? T.cyanDeep : T.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
            {ignored ? "Reopen" : "Ignore"}
          </button>
          <button onClick={onShowMore} className="no-print" style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.04em" }}>
            Show more →
          </button>
        </div>
      </div>

      {/* fix controls — only while open (not green) and if we have inputs for this check */}
      {!green && inputs && (
        <div style={{ padding: "0 18px 16px 61px" }}>
          {inputs.hint && <div style={{ fontSize: 12, color: T.cyanDeep, marginBottom: 10 }}>{verb}: {inputs.hint}</div>}
          <div style={{ display: "grid", gridTemplateColumns: inputs.controls.length > 1 ? "repeat(auto-fit, minmax(180px, 1fr))" : "minmax(220px, 360px)", gap: 10 }}>
            {inputs.controls.map((def) => (
              <FixControl key={def.path} def={def} working={working} onChange={onChange} />
            ))}
          </div>
        </div>
      )}

      {/* open but no editable control (e.g. procedural check) */}
      {!green && !inputs && (
        <div style={{ padding: "0 18px 16px 61px", fontSize: 12.5, color: T.muted }}>
          This item needs engineer judgement — review it (Show more) and Ignore once addressed.
        </div>
      )}
    </div>
  );
}

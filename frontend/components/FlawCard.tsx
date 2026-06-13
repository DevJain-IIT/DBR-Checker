"use client";

import React from "react";
import type { DBRData, Finding } from "@/lib/types";
import { Icon, T, VERDICTS, VIcon } from "@/lib/design";
import { CHECK_INPUTS, dbrPageForCheck } from "@/lib/checkInputs";
import { OPTIONS } from "@/lib/fieldOptions";
import { flawMessage, missingCombos, STANDARD_COMBOS } from "@/lib/flawMessages";
import { FixControl } from "@/components/FixControl";
import type { useDbrExtras } from "@/lib/useDbrExtras";

/**
 * One numbered "flaw" in the guided-fix view. A FLAW is framed as "Correct it",
 * a MISSING as "Provide it". The card derives its own state from the live
 * finding: PASS/N/A => Fixed (green); ignored => Acknowledged (green); else open.
 * Editing a control emits the next DBRData up; the parent debounces a recheck.
 *
 * Extra resolutions (fed to the generated DBR, not the checker):
 *  - "Keep & flag": engineer keeps a non-compliant value; card goes AMBER and the
 *    flaw is carried into the generated DBR (extras.toggleFlagged).
 *  - D14 "Add combinations": queue the standard EQ/wind combos for the DBR
 *    (extras.setAddCombos) — resolves the card without editing checked data.
 *  - D25: pick the NBC construction type for the DBR (extras.setConstructionType).
 */
export function FlawCard({ finding, index, working, onChange, ignored, onToggleIgnore, onShowMore, rechecking, extras }: {
  finding: Finding;
  index: number;
  working: DBRData;
  onChange: (next: DBRData, checkId?: string) => void;
  ignored: boolean;
  onToggleIgnore: () => void;
  onShowMore: () => void;
  rechecking: boolean;
  extras: ReturnType<typeof useDbrExtras>;
}) {
  const isMissing = finding.verdict === "MISSING";
  const fixed = finding.verdict === "PASS" || finding.verdict === "NOT_APPLICABLE";
  const underReview = finding.verdict === "REVIEW";

  const flagged = extras.isFlagged(finding.check_id);                 // kept & flagged (amber)
  const combosAdded = finding.check_id === "D14" && extras.extras.addCombos;
  const green = fixed || ignored || combosAdded;                      // positive resolved (green)
  const resolved = green || flagged || underReview;

  const inputs = CHECK_INPUTS[finding.check_id];
  // A stated-but-wrong value (FLAW with both expected & found) can be "kept & flagged".
  const canFlag = finding.verdict === "FLAW" && finding.expected != null && finding.found != null;

  const tone = flagged ? VERDICTS.REVIEW : green ? VERDICTS.PASS : isMissing ? VERDICTS.MISSING : VERDICTS.FLAW;

  const statusLabel = flagged ? "FLAGGED IN DBR" : fixed ? "FIXED" : combosAdded ? "ADDED TO DBR" : ignored ? "ACKNOWLEDGED" : underReview ? "UNDER REVIEW" : isMissing ? "MISSING" : "TO FIX";
  const verb = isMissing ? "Provide" : "Correct";

  const dbrPage = dbrPageForCheck(finding.check_id, (working as { _provenance?: Record<string, number> })._provenance);

  // The fix controls edit a local draft; "Update" commits it (which triggers the
  // parent's debounced recheck). Reset the draft when the upstream value changes.
  const [draft, setDraft] = React.useState<DBRData>(working);
  React.useEffect(() => { setDraft(working); }, [working]);
  const dirty = draft !== working;

  const showControls = !green && !flagged;
  const isD14 = finding.check_id === "D14";
  const isD25 = finding.check_id === "D25";

  return (
    <div style={{
      background: T.panel, borderRadius: 14, overflow: "hidden",
      border: `1px solid ${tone.line}`,
      borderLeft: `4px solid ${tone.solid}`,
      boxShadow: green ? `0 0 0 1px ${VERDICTS.PASS.line}` : "0 1px 0 rgba(10,22,40,0.02)",
      transition: `border-color .4s ${T.spring}, box-shadow .4s ${T.spring}`,
      animation: `dbr-fade-up .4s ${Math.min(index * 0.03, 0.3)}s both`,
      opacity: resolved && !green && !flagged ? 0.8 : 1,
    }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "15px 18px" }}>
        <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center",
          background: tone.bg, border: `1px solid ${tone.line}`,
          color: tone.fg, fontFamily: T.mono, fontWeight: 700, fontSize: 13 }}>
          {green ? <VIcon name="check" size={16} color={VERDICTS.PASS.solid} /> : flagged ? <VIcon name="alert" size={15} color={VERDICTS.REVIEW.solid} /> : index}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.mono, fontSize: 11.5, color: tone.fg, fontWeight: 600 }}>{finding.check_id}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{finding.title}</span>
            <span style={{ fontFamily: T.mono, fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: tone.fg, background: tone.bg, border: `1px solid ${tone.line}`, borderRadius: 5, padding: "2px 7px", animation: (green || flagged) ? `dbr-badge-pop .42s ${T.spring} both` : "none" }}>{statusLabel}</span>
            {rechecking && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: T.mono, fontSize: 10, color: T.cyanDeep }}>
                <span style={{ display: "flex", animation: "spin .8s linear infinite" }}><Icon.Refresh size={12} color={T.cyanDeep} /></span> re-running…
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>{green ? finding.summary : flawMessage(finding)}</div>

          {green ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: VERDICTS.PASS.fg }}>
              <VIcon name="check" size={14} color={VERDICTS.PASS.solid} />
              {combosAdded ? "The standard combinations will be added to your DBR." : "You’ve entered the right value."}
            </div>
          ) : flagged ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12.5, fontWeight: 600, color: VERDICTS.REVIEW.fg }}>
              <VIcon name="alert" size={14} color={VERDICTS.REVIEW.solid} />
              This value is not in compliance with the IS code — it will be flagged in your DBR.
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
          {!green && !flagged && dbrPage != null && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, fontFamily: T.mono, fontSize: 11, color: T.subtle }}>
              <Icon.File size={12} color={T.subtle} />
              You stated this on page {dbrPage} of your DBR.
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          {canFlag && !green && (
            <button onClick={() => extras.toggleFlagged(finding.check_id)} className="no-print" style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8, border: `1px solid ${flagged ? VERDICTS.REVIEW.line : T.border}`, background: flagged ? VERDICTS.REVIEW.bg : T.panel, color: flagged ? VERDICTS.REVIEW.fg : T.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
              {flagged ? "Un-flag" : "Keep & flag"}
            </button>
          )}
          <button onClick={onToggleIgnore} className="no-print" style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, padding: "6px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: ignored ? T.cyanDeep : T.muted, cursor: "pointer", whiteSpace: "nowrap" }}>
            {ignored ? "Reopen" : "Ignore"}
          </button>
          <button onClick={onShowMore} className="no-print" style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, background: "transparent", border: "none", cursor: "pointer", letterSpacing: "0.04em" }}>
            Show more →
          </button>
        </div>
      </div>

      {/* D14: simplified missing-combos list + add-to-DBR button */}
      {showControls && isD14 && <D14Block finding={finding} extras={extras} />}

      {/* D25: occupancy fix control + construction-type dropdown for the DBR */}
      {showControls && isD25 && (
        <div style={{ padding: "0 18px 16px 61px" }}>
          {inputs?.hint && <div style={{ fontSize: 12, color: T.cyanDeep, marginBottom: 10 }}>{verb}: {inputs.hint}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {inputs?.controls.map((def) => (
              <FixControl key={def.path} def={def} working={draft} onChange={setDraft} />
            ))}
            <ConstructionTypePicker value={extras.extras.constructionType} onSet={extras.setConstructionType} />
          </div>
          <UpdateRow dirty={dirty} rechecking={rechecking} onUpdate={() => onChange(draft, finding.check_id)} />
        </div>
      )}

      {/* generic fix controls */}
      {showControls && !isD14 && !isD25 && inputs && (
        <div style={{ padding: "0 18px 16px 61px" }}>
          {inputs.hint && <div style={{ fontSize: 12, color: T.cyanDeep, marginBottom: 10 }}>{verb}: {inputs.hint}</div>}
          <div style={{ display: "grid", gridTemplateColumns: inputs.controls.length > 1 ? "repeat(auto-fit, minmax(180px, 1fr))" : "minmax(220px, 360px)", gap: 10 }}>
            {inputs.controls.map((def) => (
              <FixControl key={def.path} def={def} working={draft} onChange={setDraft} />
            ))}
          </div>
          <UpdateRow dirty={dirty} rechecking={rechecking} onUpdate={() => onChange(draft, finding.check_id)} />
        </div>
      )}

      {/* open but no editable control (e.g. procedural check) */}
      {showControls && !inputs && !isD14 && (
        <div style={{ padding: "0 18px 16px 61px", fontSize: 12.5, color: T.muted }}>
          This item needs engineer judgement — review it (Show more) and Ignore once addressed.
        </div>
      )}
    </div>
  );
}

// Update button + status, shared by the control blocks.
function UpdateRow({ dirty, rechecking, onUpdate }: { dirty: boolean; rechecking: boolean; onUpdate: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
      <button onClick={onUpdate} disabled={!dirty || rechecking} className="no-print" style={{
        display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, border: "none",
        fontFamily: T.sans, fontSize: 13, fontWeight: 600,
        background: dirty && !rechecking ? T.cyan : T.sand, color: dirty && !rechecking ? T.navy : T.subtle,
        cursor: dirty && !rechecking ? "pointer" : "not-allowed",
        boxShadow: dirty && !rechecking ? `0 10px 22px -14px ${T.cyan}` : "none", transition: `all .2s ${T.spring}`,
      }}>
        {rechecking
          ? <><span style={{ display: "flex", animation: "spin .8s linear infinite" }}><Icon.Refresh size={14} color={T.subtle} /></span> Re-running…</>
          : <><VIcon name="check" size={14} color={dirty ? T.navy : T.subtle} /> Update</>}
      </button>
      {dirty && !rechecking && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>Apply your change and re-run this check.</span>}
    </div>
  );
}

// D14: list which lateral combos are missing in plain language + a button that
// queues the standard combinations for the generated DBR.
function D14Block({ finding, extras }: { finding: Finding; extras: ReturnType<typeof useDbrExtras> }) {
  const { eq, wind } = missingCombos(finding);
  const items: { label: string; combos: string[] }[] = [];
  if (eq) items.push({ label: "Earthquake (EQ) combinations", combos: STANDARD_COMBOS.eq });
  if (wind) items.push({ label: "Wind combinations", combos: STANDARD_COMBOS.wind });
  return (
    <div style={{ padding: "0 18px 16px 61px" }}>
      <div style={{ fontSize: 12, color: T.cyanDeep, marginBottom: 10 }}>
        Your DBR is missing these load combinations:
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((it) => (
          <div key={it.label} style={{ background: T.sand, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>{it.label}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {it.combos.map((c) => (
                <span key={c} style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 7, padding: "4px 9px" }}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => extras.setAddCombos(true)} className="no-print" style={{
        display: "inline-flex", alignItems: "center", gap: 8, marginTop: 12, padding: "9px 18px", borderRadius: 9, border: "none",
        fontFamily: T.sans, fontSize: 13, fontWeight: 600, background: T.cyan, color: T.navy, cursor: "pointer",
        boxShadow: `0 10px 22px -14px ${T.cyan}`, transition: `all .2s ${T.spring}`,
      }}>
        <Icon.Download size={15} color={T.navy} /> Add these combinations to my generated DBR
      </button>
    </div>
  );
}

// Construction-type dropdown (NBC Type 1–4) — generator-only, stored in extras.
function ConstructionTypePicker({ value, onSet }: { value: string | null; onSet: (v: string | null) => void }) {
  const opts = OPTIONS.construction_type || [];
  return (
    <div style={{ background: T.sand, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" }}>
      <label style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.06em", marginBottom: 6, display: "block" }}>CONSTRUCTION TYPE</label>
      <select value={value ?? ""} onChange={(e) => onSet(e.target.value || null)}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.sans, fontSize: 14, color: value ? T.ink : T.subtle, cursor: "pointer" }}>
        <option value="">— select —</option>
        {opts.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
      </select>
    </div>
  );
}

"use client";

import React from "react";
import type { Citation, Finding } from "@/lib/types";
import { explainFinding } from "@/lib/api";
import { fmtValue } from "@/lib/format";
import { CATEGORIES, Icon, T, VERDICTS, VerdictBadge } from "@/lib/design";

export function FindingCard({ check, index }: { check: Finding; index: number }) {
  const [open, setOpen] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const v = VERDICTS[check.verdict];
  const flagged = check.verdict === "FLAW" || check.verdict === "MISSING";

  return (
    <div className="print-finding" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: T.panel, borderRadius: 14, overflow: "hidden",
        border: `1px solid ${open ? v.line : hover ? "#DAD4C8" : T.border}`,
        borderLeft: `3px solid ${v.solid}`,
        boxShadow: hover ? "0 18px 38px -26px rgba(10,22,40,0.4)" : "0 1px 0 rgba(10,22,40,0.02)",
        transform: hover && !open ? "translateY(-2px)" : "none",
        transition: `border-color .2s, box-shadow .25s, transform .2s ${T.spring}`,
        animation: `dbr-fade-up .4s ${Math.min(index * 0.03, 0.4)}s both`,
      }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 18px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: T.sans }}>
        <div style={{ flexShrink: 0, paddingTop: 1 }}>
          <VerdictBadge verdict={check.verdict} size="sm" animate={false} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: v.fg, fontWeight: 600 }}>{check.check_id}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{check.title}</span>
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.5, maxWidth: 760 }}>{check.summary}</div>
          {(check.expected != null || check.found != null) && (
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              {check.expected != null && <EvfCell label="EXPECTED" value={fmtValue(check.expected)} tone="neutral" />}
              {check.found != null && <EvfCell label="FOUND" value={fmtValue(check.found)} tone={flagged ? "bad" : check.verdict === "REVIEW" ? "warn" : "good"} />}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: open ? `${T.cyan}14` : "transparent", transform: open ? "rotate(180deg)" : "none", transition: `transform .25s ${T.spring}` }}>
            <Icon.Chevron size={16} color={open ? T.cyanDeep : T.subtle} />
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.subtle, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{open ? "HIDE" : "CITE"}</span>
        </div>
      </button>

      {open && <CitationDrawer check={check} />}
    </div>
  );
}

function EvfCell({ label, value, tone }: { label: string; value: string; tone: "neutral" | "good" | "bad" | "warn" }) {
  const map = {
    neutral: { c: T.ink, bg: T.sand, b: T.border },
    good: { c: VERDICTS.PASS.fg, bg: VERDICTS.PASS.bg, b: VERDICTS.PASS.line },
    bad: { c: VERDICTS.FLAW.fg, bg: VERDICTS.FLAW.bg, b: VERDICTS.FLAW.line },
    warn: { c: VERDICTS.REVIEW.fg, bg: VERDICTS.REVIEW.bg, b: VERDICTS.REVIEW.line },
  }[tone];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "6px 12px", background: map.bg, border: `1px solid ${map.b}`, borderRadius: 9, maxWidth: "100%" }}>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.1em", flexShrink: 0 }}>{label}</span>
      <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: map.c, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
    </div>
  );
}

function CitationDrawer({ check }: { check: Finding }) {
  return <CitationBody check={check} />;
}

// The drawer body, exported so SlideOverPanel can reuse it for a single check.
export function CitationBody({ check }: { check: Finding }) {
  // Prefer the enriched citations the API attached; the first with real text
  // anchors the "paper" sheet. Notes are shown beneath.
  const cites = check.citations || [];
  const primary: Citation | undefined = cites.find((c) => !c.missing && c.statement) || cites[0];

  // On-demand AI explanation for any check (nothing is auto-generated on upload).
  const [aiText, setAiText] = React.useState<string | null>(check.ai_explanation ?? null);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  // On-demand explanation is available on EVERY check (no auto-generation on
  // upload). Show the button whenever we don't already have an explanation.
  const canRequest = !aiText;

  const requestExplain = async () => {
    setAiBusy(true); setAiError(null);
    try {
      setAiText(await explainFinding(check));
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not generate an explanation.");
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div style={{ padding: "4px 18px 20px", animation: `dbr-drawer .3s ${T.spring} both` }}>
      {aiText && (
        <div style={{ display: "flex", gap: 11, padding: "13px 15px", marginBottom: 14, background: `${T.indigo}0c`, border: `1px solid ${T.indigo}33`, borderRadius: 10 }}>
          <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, background: `${T.indigo}1a`, border: `1px solid ${T.indigo}3a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon.Spark size={15} color={T.indigo} />
          </div>
          <div>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.indigo, letterSpacing: "0.1em", marginBottom: 5, fontWeight: 600 }}>AI EXPLANATION</div>
            <div style={{ fontSize: 13, color: T.ink, lineHeight: 1.6 }}>{aiText}</div>
          </div>
        </div>
      )}

      {canRequest && (
        <div style={{ marginBottom: 14 }}>
          <button onClick={requestExplain} disabled={aiBusy} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10, border: `1px solid ${T.indigo}44`, background: `${T.indigo}0c`, color: T.indigo, fontSize: 13, fontWeight: 600, cursor: aiBusy ? "default" : "pointer", fontFamily: T.sans }}>
            <span style={{ display: "flex", animation: aiBusy ? "spin .8s linear infinite" : "none" }}>
              {aiBusy ? <Icon.Refresh size={15} color={T.indigo} /> : <Icon.Spark size={15} color={T.indigo} />}
            </span>
            {aiBusy ? "Generating…" : "Explain with AI"}
          </button>
          {aiError && <div style={{ fontSize: 12, color: VERDICTS.FLAW.fg, marginTop: 8 }}>{aiError}</div>}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 0.85fr", gap: 16, borderTop: `1px dashed ${T.border}`, paddingTop: 16 }}>
        {/* clause text on paper */}
        <div style={{ position: "relative", background: "#FAF6EC", border: `1px solid ${T.border}`, borderRadius: 10, padding: "20px 22px", boxShadow: "0 12px 30px -22px rgba(10,22,40,0.4)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: T.mono, fontSize: 9.5, color: "#8a7a5a", letterSpacing: "0.08em", marginBottom: 14 }}>
            <span>{primary?.code || check.citation || "—"}</span>
            <span>{primary?.page != null ? `p.${primary.page}` : ""}</span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.06em", marginBottom: 8 }}>
            {primary?.title || primary?.clause || check.citation || ""}
          </div>
          {primary && !primary.missing && primary.statement ? (
            <div style={{ fontFamily: "Georgia, serif", fontSize: 13.5, color: "#2A2620", lineHeight: 1.75 }}>
              <span style={{ background: "rgba(252,211,77,0.4)", boxShadow: "0 0 0 3px rgba(252,211,77,0.4)", borderRadius: 2 }}>{primary.statement}</span>
            </div>
          ) : (
            <div style={{ fontFamily: "Georgia, serif", fontSize: 13.5, color: "#8a7a5a", lineHeight: 1.6, fontStyle: "italic" }}>
              {check.citation
                ? `Clause text for ${primary?.code || check.citation} is not yet in the corpus. The verdict still stands on the engine's rule.`
                : "This check is procedural — no single clause text to display."}
            </div>
          )}
        </div>

        {/* meta + notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ background: T.sand, border: `1px solid ${T.border}`, borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.12em", marginBottom: 10 }}>REFERENCE</div>
            {[["Citation", check.citation || "—"], ["Code", primary?.code || "—"], ["Clause", primary?.clause || primary?.content_type || "—"]].map(([k, val], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "6px 0", borderTop: i === 0 ? "none" : `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.muted, flexShrink: 0 }}>{k}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.ink, fontWeight: 600, textAlign: "right" }}>{val}</span>
              </div>
            ))}
          </div>
          {check.notes && check.notes.length > 0 && (
            <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.12em", marginBottom: 8 }}>NOTES</div>
              {check.notes.map((n, i) => (
                <div key={i} style={{ fontSize: 12.5, color: T.muted, lineHeight: 1.5, marginTop: i ? 6 : 0 }}>• {n}</div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function CategorySection({ cat, checks, startIndex }: { cat: string; checks: Finding[]; startIndex: number }) {
  const meta = CATEGORIES[cat] || { icon: "File" as const, hue: T.cyan };
  const IconC = Icon[meta.icon];
  const flaws = checks.filter((c) => c.verdict === "FLAW" || c.verdict === "MISSING").length;
  return (
    <section className="print-section" style={{ marginBottom: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.hue}14`, border: `1px solid ${meta.hue}3a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconC size={16} color={T.cyanDeep} />
        </div>
        <h3 style={{ fontFamily: T.serif, fontSize: 21, color: T.ink, margin: 0, fontWeight: 400 }}>{cat}</h3>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.subtle }}>{checks.length} check{checks.length > 1 ? "s" : ""}</span>
        {flaws > 0 && (
          <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, color: VERDICTS.FLAW.fg, background: VERDICTS.FLAW.bg, border: `1px solid ${VERDICTS.FLAW.line}`, borderRadius: 999, padding: "2px 9px" }}>{flaws} to fix</span>
        )}
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {checks.map((c, i) => <FindingCard key={c.check_id} check={c} index={startIndex + i} />)}
      </div>
    </section>
  );
}

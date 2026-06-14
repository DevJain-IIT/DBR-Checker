"use client";

import { useParams } from "next/navigation";
import React from "react";
import { getReport } from "@/lib/api";
import type { AnalyzeResponse, DbrSection, Finding } from "@/lib/types";
import { DBR_TEMPLATE, groupSections } from "@/lib/dbrSections";
import { STANDARD_COMBOS } from "@/lib/flawMessages";

// Fix common mojibake from PDF text encoding so the generated document reads
// cleanly. Uses explicit \uXXXX escapes (never literal mojibake bytes in source).
// The U+FFFD replacement char is unrecoverable, so we drop it rather than guess.
function cleanText(s: string | null | undefined): string {
  if (s == null) return "";
  return String(s)
    .replace(/[\u0096\u0097\u2013\u2014]/g, "\u2013")  // en/em-dash mojibake -> en dash
    .replace(/[\u0091\u0092\u2018\u2019]/g, "\u2019")  // curly single quotes
    .replace(/[\u0093\u0094\u201C\u201D]/g, "\u201D")  // curly double quotes
    .replace(/\u00a0/g, " ")                                  // non-breaking space -> space
    .replace(/\ufffd/g, "")                                   // unrecoverable char -> drop
    .trim();
}

// Normalise ASCII engineering math to proper symbols so formulas read like a
// real document instead of "0.075xh^0.75/sqrt(Aw) > 0.09xh/sqrt(d)".
function normalizeMath(s: string): string {
  return s
    .replace(/\bsqrt\s*\(/gi, "√(")
    .replace(/(\d)\s*[xX*]\s*(?=[a-zA-Z(])/g, "$1·")
    .replace(/(\d|\))\s*\^\s*/g, "$1^")
    .replace(/>=/g, "≥").replace(/<=/g, "≤")
    .replace(/\+\/-|\+-/g, "±").replace(/-\+/g, "∓")
    .replace(/!=/g, "≠")
    .replace(/\bdT\b/g, "ΔT")
    .replace(/\bdelta\b/gi, "Δ").replace(/\btheta\b/gi, "θ");
}

// Render a string with proper superscripts for `^exp` plus the normalised symbols.
function renderMath(s: string): React.ReactNode[] {
  const norm = normalizeMath(s);
  const out: React.ReactNode[] = [];
  const re = /\^(\{[^}]+\}|\([^)]+\)|-?\d+(?:\.\d+)?|[A-Za-z0-9]+)/g;
  let last = 0, m: RegExpExecArray | null, key = 0;
  while ((m = re.exec(norm)) !== null) {
    if (m.index > last) out.push(norm.slice(last, m.index));
    let exp = m[1];
    if ((exp.startsWith("{") && exp.endsWith("}")) || (exp.startsWith("(") && exp.endsWith(")"))) exp = exp.slice(1, -1);
    out.push(<sup key={`s${key++}`}>{exp}</sup>);
    last = m.index + m[0].length;
  }
  if (last < norm.length) out.push(norm.slice(last));
  return out;
}

// Last-resort guard: if any DBR's data shape makes a render throw, show a clear
// message instead of a blank screen — so an unusual PDF degrades gracefully.
class DbrErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 760, margin: "60px auto", padding: "0 32px", fontFamily: "Georgia, serif", color: "#1A1A1A" }}>
          <h1 style={{ fontSize: 24 }}>Couldn&rsquo;t render this DBR</h1>
          <p style={{ fontSize: 14, color: "#555", lineHeight: 1.6 }}>
            Something in this report&rsquo;s data couldn&rsquo;t be laid out. The compliance findings are
            unaffected — go back to the report and try again, or use “Export report” for the findings view.
          </p>
          <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "#999" }}>{String(this.state.error?.message || this.state.error)}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// The generated DBR. Follows the 13-section order of a real signed DBR, filled
// from our validated/corrected DBRData + findings + the captured original prose
// (extracted.document), plus an appendix for any original sections we couldn't
// map. Renders as a print-to-PDF document, mirroring the existing /print export.
// Does NOT touch the report/flaws pages.
export default function DbrGeneratorPage() {
  return <DbrErrorBoundary><DbrGeneratorInner /></DbrErrorBoundary>;
}

function DbrGeneratorInner() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = React.useState<AnalyzeResponse | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const editKey = `dbr-edit-${id}`;

  React.useEffect(() => {
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(`dbr-report-${id}`) : null;
    if (cached) { try { setData(JSON.parse(cached)); return; } catch { /* fall through */ } }
    getReport(id).then(setData).catch((e) => setErr(e instanceof Error ? e.message : "Could not load report."));
  }, [id]);

  // Restore saved manual edits ONCE after the template first paints. The body
  // subtree is frozen (FrozenBody never re-renders), so React can never reconcile
  // over / wipe the engineer's edits — only this one-time restore touches it.
  React.useEffect(() => {
    if (!data || !bodyRef.current) return;
    try {
      const saved = sessionStorage.getItem(editKey);
      if (saved) bodyRef.current.innerHTML = saved;
    } catch { /* ignore */ }
    // run once the document data is available; intentionally not keyed on `editing`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, editKey]);

  const saveEdits = React.useCallback(() => {
    if (!bodyRef.current) return;
    try { sessionStorage.setItem(editKey, bodyRef.current.innerHTML); } catch { /* ignore */ }
  }, [editKey]);

  const toggleEdit = () => {
    saveEdits();                 // capture the current DOM (incl. fresh edits)
    setEditing((e) => !e);       // only flips contentEditable on the wrapper; body DOM untouched
  };

  const resetEdits = () => {
    try { sessionStorage.removeItem(editKey); } catch { /* ignore */ }
    window.location.reload();
  };

  const onExport = () => { if (editing) { saveEdits(); setEditing(false); } setTimeout(() => window.print(), 120); };

  // session extras written by useDbrExtras
  const extras = React.useMemo(() => {
    if (typeof window === "undefined") return { constructionType: null as string | null, addCombos: false, flaggedFlaws: [] as string[] };
    try {
      const raw = sessionStorage.getItem(`dbr-extras-${id}`);
      const e = raw ? JSON.parse(raw) : {};
      return { constructionType: e.constructionType ?? null, addCombos: !!e.addCombos, flaggedFlaws: Array.isArray(e.flaggedFlaws) ? e.flaggedFlaws : [] };
    } catch { return { constructionType: null, addCombos: false, flaggedFlaws: [] }; }
  }, [id]);

  if (err) return <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>Couldn&rsquo;t load report: {err}</div>;
  if (!data) return <div style={{ padding: 40, fontFamily: "Georgia, serif" }}>Preparing your DBR…</div>;

  const ex = data.extracted;
  const p = ex.profile;
  const tb = ex.title_block || {};
  const findings = data.findings.filter((f) => f.verdict !== "NOT_APPLICABLE" && f.check_id !== "D1");
  const byCheck = new Map(findings.map((f) => [f.check_id, f]));
  const project = cleanText(tb.project) || "Untitled project";

  const { byKey, appendix } = groupSections(ex.document?.sections);
  // captured prose for a template key (joined)
  const prose = (key: string): string | null => {
    const secs = byKey[key];
    if (!secs || !secs.length) return null;
    return secs.map((s) => s.prose).filter(Boolean).join("\n\n") || null;
  };
  // methodology prose minus the load-combination run-on text — those are shown as
  // a proper numbered list (ComboList) from the structured load_combinations[].
  const methodologyProse = (): string | null => {
    const t = prose("methodology");
    if (!t) return null;
    return t
      .split(/\n{2,}/)
      .filter((para) => !isCombosParagraph(para))
      .join("\n\n") || null;
  };
  const tablesFor = (key: string): DbrSection[] => byKey[key] || [];

  const tbx = tb as Record<string, unknown>;
  const signoff = Array.isArray(tbx.signoff) ? (tbx.signoff as { role?: string; name?: string; designation?: string }[]) : [];
  const revisions = Array.isArray(tbx.revisions) ? (tbx.revisions as { rev?: string; date?: string; chapter?: string; details?: string }[]) : [];
  const location = cleanText((tbx.location as string) || p.district || "");
  const client = cleanText((tbx.client as string) || "");
  const consultant = cleanText((tbx.consultant as string) || "");

  return (
    <div className="doc">
      <DbrStyles />

      <div className="no-print toolbar">
        <button onClick={onExport}>Export PDF</button>
        <button onClick={toggleEdit} className={editing ? "" : "ghost"}>{editing ? "Done editing" : "Edit document"}</button>
        <button onClick={resetEdits} className="ghost">Reset</button>
        <button onClick={() => window.close()} className="ghost">Close</button>
        <span className="hint">
          {editing
            ? "Editing — click any text to change it. Click “Done editing”, then “Export PDF”."
            : "Click “Edit document” to change any text on our template, then “Export PDF”."}
        </span>
      </div>

      {editing && <div className="no-print edit-banner">✎ Edit mode — your changes are saved automatically and will appear in the exported PDF.</div>}

      {/* The whole document body is hand-editable in edit mode. The contentEditable
          flag lives on this wrapper (so toggling edit mode only changes the attribute).
          The body content is rendered inside FrozenBody, which NEVER re-renders — so
          React can't reconcile over and wipe the engineer's manual edits. */}
      <div ref={bodyRef} contentEditable={editing} suppressContentEditableWarning onInput={editing ? saveEdits : undefined} className={editing ? "editable-on" : undefined}>
      <FrozenBody>

      {/* running FOOTER band repeated on every printed page — logo space so the
          firm can personalise the document, + doc meta on the right. */}
      <div className="run-foot" aria-hidden>
        <div className="rf-logo">Your logo</div>
        <div className="rf-mid">{project}</div>
        <div className="rf-meta">{tb.document_no || ""}{tb.revision ? ` · Rev ${tb.revision}` : ""}</div>
      </div>

      {/* ===================== COVER PAGE ===================== */}
      <section className="cover">
        <div className="cover-banner">
          <div className="cb-cell cb-logo"><div className="logo-box">{consultant || "Consultant logo"}</div><div className="cb-sub">{consultant ? "Structural Engineering Consultants" : ""}</div></div>
          <div className="cb-cell cb-clientlogo"><div className="logo-box">{client || "Client logo"}</div></div>
          <div className="cb-cell cb-meta">
            <div className="cbm-row cbm-title">DESIGN BASIS REPORT</div>
            <div className="cbm-row">Document no. <b>{tb.document_no || "—"}</b></div>
            <div className="cbm-row">Rev — <b>{tb.revision || "—"}</b></div>
            <div className="cbm-row">{tb.date ? `Date ${tb.date}` : ""}</div>
          </div>
        </div>

        <div className="cover-title">
          <div className="ct-kicker">DESIGN BASIS REPORT</div>
          <div className="ct-for">For</div>
          <h1 className="ct-project">{project}</h1>
          {location && <><div className="ct-at">at</div><div className="ct-loc">{location}</div></>}
        </div>

        <table className="signoff">
          <tbody>
            {consultant && <tr><td className="so-role">Consultant</td><td className="so-name"><b>{consultant}</b></td></tr>}
            {signoff.length > 0 ? signoff.map((s, i) => (
              <tr key={i}><td className="so-role">{cleanText(s.role) || "—"}</td><td className="so-name">{cleanText(s.name)}{s.designation ? <div className="so-desig">{cleanText(s.designation)}</div> : null}</td></tr>
            )) : (
              <>
                <tr><td className="so-role">Prepared by</td><td className="so-name so-blank">[name &amp; designation]</td></tr>
                <tr><td className="so-role">Checked by</td><td className="so-name so-blank">[name &amp; designation]</td></tr>
                <tr><td className="so-role">Approved by</td><td className="so-name so-blank">[name &amp; designation]</td></tr>
              </>
            )}
            <tr><td className="so-role">Seal / stamp</td><td className="so-name so-stamp">&nbsp;</td></tr>
          </tbody>
        </table>

        {revisions.length > 0 && (
          <table className="rev-table">
            <thead><tr><th>Rev. No.</th><th>Date</th><th>Revised Chapter / Clause</th><th>Revision Details</th></tr></thead>
            <tbody>
              {revisions.map((r, i) => (
                <tr key={i}><td>{cleanText(r.rev)}</td><td>{cleanText(r.date)}</td><td>{cleanText(r.chapter)}</td><td>{cleanText(r.details)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="cover-foot">Generated by DBR Check (CivilSpace) — reviewed and signed by the responsible structural engineer.</div>
      </section>

      {/* ===================== TABLE OF CONTENTS ===================== */}
      <section className="toc">
        <h2 className="toc-title">Contents</h2>
        <ol className="toc-list">
          {DBR_TEMPLATE.map((s) => (
            <li key={s.key} className="toc-row">
              <span className="toc-num">{s.num}.</span>
              <span className="toc-name">{s.title}</span>
              <span className="toc-dots" />
            </li>
          ))}
        </ol>
      </section>

      {/* ===================== BODY ===================== */}
      {/* ---- The 13 template sections ---- */}
      <Section n={1} title="Introduction">
        <ValTable rows={[["Project", project], ["Location", p.district || "—"], ["Occupancy", p.occupancy ? `NBC Group ${p.occupancy}` : "—"]]} />
        <Prose text={prose("introduction")} />
      </Section>

      <Section n={2} title="Scope">
        <Prose text={prose("scope")} placeholder="Scope of the structural design — [to be completed by engineer]." />
      </Section>

      <Section n={3} title="Description of the Buildings">
        <ValTable rows={[["Structural system", labelOr(p.structural_system)], ["Height", p.height_m ? `${p.height_m} m` : "—"], ["No. of storeys", p.num_storeys != null ? String(p.num_storeys) : "—"], ["Material", labelOr(p.material)]]} />
        <CapturedTables secs={tablesFor("description")} />
        <Prose text={prose("description")} />
      </Section>

      <Section n={4} title="Seismic Classification">
        <ValTable rows={[
          ["Seismic zone", p.seismic_zone ? `Zone ${p.seismic_zone}` : "—"],
          ["Zone factor (Z)", ex.zone_factor_Z != null ? String(ex.zone_factor_Z) : "—"],
          ["Importance factor (I)", ex.importance_factor_I != null ? String(ex.importance_factor_I) : "—"],
          ["Response reduction (R)", ex.response_reduction_R != null ? String(ex.response_reduction_R) : "—"],
          ["Soil type", labelOr(p.soil_type)],
        ]} />
        <Prose text={prose("seismic")} />
        <ClauseFor f={byCheck.get("D7")} />
      </Section>

      <Section n={5} title="Meteorological Condition">
        <ValTable rows={[
          ["Exposure condition", labelOr(ex.exposure_condition)],
          ["Basic wind speed (Vb)", ex.profile.basic_wind_speed != null ? `${ex.profile.basic_wind_speed} m/s` : "—"],
          ["Force coefficient (Cf)", ex.force_coefficient_Cf != null ? String(ex.force_coefficient_Cf) : "—"],
        ]} />
        <Prose text={prose("meteorological")} />
        <ClauseFor f={byCheck.get("D13")} />
      </Section>

      <Section n={6} title="Fire Rating & Clear Cover">
        <ValTable rows={[
          ["NBC construction type", extras.constructionType || "[to be selected]"],
          ["Occupancy group", p.occupancy || "—"],
        ]} />
        <DictTable label="Nominal cover (mm)" dict={ex.nominal_cover_mm} unit="mm" />
        <Prose text={prose("fire_cover")} />
        <ClauseFor f={byCheck.get("D24")} />
      </Section>

      <Section n={7} title="Geotechnical Parameters">
        <ValTable rows={[
          ["Soil type", labelOr(p.soil_type)],
          ["Foundation type", labelOr(p.foundation_type)],
          ["Foundation depth", ex.foundation_depth_m != null ? `${ex.foundation_depth_m} m` : "—"],
          ["FoS overturning", ex.fos_overturning != null ? String(ex.fos_overturning) : "—"],
          ["FoS sliding", ex.fos_sliding != null ? String(ex.fos_sliding) : "—"],
          ["Settlement", ex.settlement_mm != null ? `${ex.settlement_mm} mm` : "—"],
        ]} />
        <CapturedTables secs={tablesFor("geotechnical")} />
        <Prose text={prose("geotechnical")} placeholder="Soil investigation summary, safe bearing capacity, water table — [to be completed by engineer]." />
      </Section>

      <Section n={8} title="Material Grades">
        <DictTable label="Concrete grade (MPa)" dict={ex.concrete_grades} prefix="M" />
        <ValTable rows={[["Rebar grade", labelOr(ex.rebar_grade)], ["Cement type", labelOr(ex.cement_type)]]} />
        <Prose text={prose("materials")} />
        <ClauseFor f={byCheck.get("D4")} />
      </Section>

      <Section n={9} title="Constructional Features">
        <Prose text={prose("construction")} placeholder="Structural system selection and constructional approach — [to be completed by engineer]." />
      </Section>

      <Section n={10} title="Analysis & Design Methodology">
        <ValTable rows={[
          ["Analysis method", labelOr(ex.analysis_method)],
          ["Fundamental period (T)", ex.fundamental_period_s != null ? `${ex.fundamental_period_s} s` : "—"],
          ["Period method", labelOr(ex.period_method)],
          ["Seismic weight (imposed %)", ex.seismic_weight_LL_pct != null ? `${ex.seismic_weight_LL_pct}%` : "—"],
          ["Drift ratio", ex.drift_ratio != null ? String(ex.drift_ratio) : "—"],
          ["Stability coefficient (θ)", ex.stability_coeff_theta != null ? String(ex.stability_coeff_theta) : "—"],
          ["Software", labelOr(ex.software_used)],
        ]} />
        <Prose text={methodologyProse()} />
        <h4 className="sub">10.1 Load Combinations</h4>
        <ComboList combos={ex.load_combinations} addCombos={extras.addCombos} />
        <ClauseFor f={byCheck.get("D14")} />
        <ClauseFor f={byCheck.get("D11")} />
      </Section>

      <Section n={11} title="Computer Programs">
        <ValTable rows={[["Software used", labelOr(ex.software_used)]]} />
        <Prose text={prose("software")} />
      </Section>

      <Section n={12} title="Applicable Codes">
        <CodesList ex={ex} findings={findings} />
      </Section>

      <Section n={13} title="Conclusion & Recommendations">
        <Prose text={prose("conclusion")} placeholder="Conclusion and recommendations — [to be completed by engineer]." />
      </Section>

      {/* ---- Appendix: any original sections we couldn't map ---- */}
      {appendix.length > 0 && (
        <>
          <h2 className="part">Appendix — Additional Sections from Your DBR</h2>
          {appendix.map((s, i) => (
            <div key={i} className="appx">
              <h4 className="sub">{s.heading || `Section ${s.order}`}{s.page ? ` (p.${s.page})` : ""}</h4>
              <CapturedTables secs={[s]} />
              <Prose text={s.prose} />
            </div>
          ))}
        </>
      )}

      <footer className="doc-foot">
        Generated by DBR Check (CivilSpace). Compliance verdicts are produced by a deterministic engine
        against IS 456, IS 1893, IS 13920, IS 875-3/5, IS 16700, IS 269 and NBC 2016. Captured narrative
        is from the uploaded DBR. This document is a design-basis summary and must be reviewed, completed
        and signed by the responsible structural engineer before use.
      </footer>
      </FrozenBody>
      </div>{/* end editable body */}
    </div>
  );
}

// Renders its children exactly once and then NEVER re-renders — so once the
// document is painted, edit-mode toggles and any parent re-render cannot make
// React reconcile (and wipe) the engineer's manual contentEditable edits.
const FrozenBody = React.memo(function FrozenBody({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}, () => true);

// --------------------------------------------------------------------------- //
function labelOr(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v).replace(/_/g, " ");
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  const meta = DBR_TEMPLATE.find((s) => s.num === n);
  return (
    <section className="sec">
      <h2 className="part">{n}. {meta?.title || title}</h2>
      {children}
    </section>
  );
}

function ValTable({ rows }: { rows: [string, string][] }) {
  return <table className="val-grid"><tbody>{rows.map(([k, v]) => <tr key={k}><td className="vk">{k}</td><td className="vv">{v}</td></tr>)}</tbody></table>;
}

// Coerce any value (incl. objects/arrays the LLM might emit) to a safe string.
function safe(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") { try { return Object.values(v as object).join(", "); } catch { return ""; } }
  return String(v);
}

function DictTable({ label, dict, unit, prefix }: { label: string; dict: Record<string, number> | null | undefined; unit?: string; prefix?: string }) {
  const entries = dict && typeof dict === "object" ? Object.entries(dict) : [];
  if (!entries.length) return <ValTable rows={[[label, "—"]]} />;
  return (
    <table className="val-grid"><tbody>
      <tr><td className="vk" colSpan={2} style={{ fontWeight: 700 }}>{label}</td></tr>
      {entries.map(([el, val]) => <tr key={el}><td className="vk" style={{ textTransform: "capitalize" }}>{safe(el).replace(/_/g, " ")}</td><td className="vv">{prefix || ""}{safe(val)}{unit ? ` ${unit}` : ""}</td></tr>)}
    </tbody></table>
  );
}

function Prose({ text, placeholder }: { text: string | null | undefined; placeholder?: string }) {
  const t = cleanText(text);
  if (!t.trim()) return placeholder ? <p className="prose placeholder">{placeholder}</p> : null;
  return <>{t.split(/\n{2,}/).map((para, i) => <p key={i} className="prose">{renderMath(para)}</p>)}</>;
}

function CapturedTables({ secs }: { secs: DbrSection[] }) {
  const tables = (secs || []).flatMap((s) => (Array.isArray(s?.tables) ? s.tables : []));
  if (!tables.length) return null;
  return (
    <>{tables.map((t, i) => {
      const headers = Array.isArray(t?.headers) ? t.headers : [];
      const rows = Array.isArray(t?.rows) ? t.rows : [];
      return (
        <table key={i} className="cap-grid">
          {t?.caption && <caption>{safe(t.caption)}</caption>}
          {headers.length > 0 && <thead><tr>{headers.map((h, j) => <th key={j}>{safe(h)}</th>)}</tr></thead>}
          <tbody>{rows.map((r, ri) => <tr key={ri}>{(Array.isArray(r) ? r : [r]).map((c, ci) => <td key={ci}>{safe(c)}</td>)}</tr>)}</tbody>
        </table>
      );
    })}</>
  );
}

// True when a paragraph is really a dump of load combinations (so we drop it from
// the methodology prose and show the structured numbered list instead). Heuristic:
// lots of load tokens (DL/LL/EL/WL/EqX/GWX/Spec/SP) and combo punctuation.
function isCombosParagraph(para: string): boolean {
  const tokens = (para.match(/\b(DL|LL|IL|EL|WL|TL|Eq[XYZ]|GW[XYZ]|Spec[XYZ]|SP[XYZ])\b/gi) || []).length;
  return tokens >= 6;
}

function ComboList({ combos, addCombos }: { combos: string[] | null | undefined; addCombos: boolean }) {
  const clean = (c: string) => safe(c).replace(/^\s*\d+\s*[.)]\s*/, "").trim(); // drop any leading "12." (the <ol> numbers)
  const list = (Array.isArray(combos) ? combos : []).map(clean).filter(Boolean);
  const added: string[] = addCombos ? [...STANDARD_COMBOS.eq, ...STANDARD_COMBOS.wind] : [];
  if (!list.length && !added.length) return <p className="prose placeholder">Load combinations — [to be completed by engineer].</p>;
  return (
    <ol className="combos">
      {list.map((c, i) => <li key={`o${i}`}>{c}</li>)}
      {added.map((c, i) => <li key={`a${i}`} className="added">{c} <span className="added-tag">added</span></li>)}
    </ol>
  );
}

function ClauseFor({ f }: { f: Finding | undefined }) {
  if (!f) return null;
  const c = (f.citations || []).find((x) => !x.missing && x.statement);
  if (!c) return null;
  return (
    <div className="clause">
      <div className="clause-h">{c.code} {c.clause ? `· ${c.clause}` : ""}{c.title ? ` — ${c.title}` : ""}{c.page ? ` (p.${c.page})` : ""}</div>
      <div className="clause-b">{c.statement}</div>
    </div>
  );
}

function CodesList({ ex, findings }: { ex: AnalyzeResponse["extracted"]; findings: Finding[] }) {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const cc of ex.cited_codes || []) { const s = `${cc.code}${cc.year ? `:${cc.year}` : ""}`; if (!seen.has(s)) { seen.add(s); codes.push(s); } }
  for (const f of findings) for (const c of f.citations || []) { if (c.code && !seen.has(c.code)) { seen.add(c.code); codes.push(c.code); } }
  if (!codes.length) return <p className="prose placeholder">Applicable codes — [to be completed by engineer].</p>;
  return <ul className="codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>;
}

function DbrStyles() {
  return (
    <style>{`
      /* Carlito = the open, metric-compatible clone of Calibri (the font most
         real DBRs use). Loads where Calibri isn't installed; Calibri wins where it is. */
      @import url('https://fonts.googleapis.com/css2?family=Carlito:ital,wght@0,400;0,700;1,400;1,700&display=swap');

      /* ---- Readable engineering-document look: Calibri body, justified prose,
            ruled tables, clear heading hierarchy. Not robotic. ---- */
      .doc { max-width: 820px; margin: 0 auto; padding: 26px 64px 80px; color: #1c1c1c;
        font-family: Calibri, Carlito, "Segoe UI", system-ui, sans-serif; font-size: 14.5px; line-height: 1.65; background: #fff; }

      /* running footer band — logo space on every printed page (screen: hidden;
         print: fixed to the bottom margin of every page) */
      .run-foot { display: none; }

      /* ===== table of contents — its own full page, generous spacing ===== */
      .toc { break-before: page; break-after: page; min-height: 86vh; padding-top: 40px; }
      .toc-title { font-size: 28px; font-weight: 700; text-align: center; letter-spacing: 0.04em; margin: 0 0 48px; }
      .toc-list { list-style: none; margin: 0 auto; padding: 0; max-width: 620px; }
      .toc-row { display: flex; align-items: baseline; margin: 22px 0; font-size: 16px; }
      .toc-num { width: 38px; flex: 0 0 auto; font-weight: 700; }
      .toc-name { flex: 0 0 auto; }
      .toc-dots { flex: 1 1 auto; margin: 0 8px; border-bottom: 1.5px dotted #aaa; transform: translateY(-4px); }

      /* ===== cover page ===== */
      .cover { min-height: 86vh; display: flex; flex-direction: column; }
      .cover-banner { display: grid; grid-template-columns: 1.1fr 1.2fr 1fr; border: 1.5px solid #333; margin-bottom: 30px; }
      .cb-cell { padding: 12px 14px; border-right: 1px solid #333; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
      .cb-cell:last-child { border-right: none; }
      .cb-meta { align-items: stretch; text-align: left; padding: 0; }
      .logo-box { min-height: 56px; min-width: 120px; display: flex; align-items: center; justify-content: center; border: 1px dashed #bbb; color: #aaa; font-size: 10px; font-style: italic; padding: 8px 14px; font-family: Arial, sans-serif; }
      .cb-sub { font-size: 9.5px; color: #555; margin-top: 6px; letter-spacing: 0.04em; text-transform: uppercase; }
      .cbm-row { border-bottom: 1px solid #333; padding: 7px 12px; font-size: 11px; }
      .cbm-row:last-child { border-bottom: none; }
      .cbm-title { font-weight: 700; text-align: center; letter-spacing: 0.04em; }
      .cover-title { text-align: center; margin: 38px 0 30px; }
      .ct-kicker { font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
      .ct-for, .ct-at { font-size: 13px; color: #444; margin: 14px 0; }
      .ct-project { font-size: 26px; font-weight: 700; margin: 6px 0; letter-spacing: 0.01em; }
      .ct-loc { font-size: 16px; }
      .signoff { width: 100%; border-collapse: collapse; margin: 8px auto 26px; border: 1px solid #333; }
      .signoff td { border: 1px solid #333; padding: 9px 14px; vertical-align: top; font-size: 13px; }
      .so-role { width: 180px; color: #333; }
      .so-name b { font-weight: 700; }
      .so-desig { font-size: 11.5px; color: #555; margin-top: 2px; }
      .so-blank, .so-stamp { color: #aaa; font-style: italic; }
      .so-stamp { height: 54px; }
      .rev-table { width: 100%; border-collapse: collapse; margin-top: auto; font-size: 11px; }
      .rev-table th, .rev-table td { border: 1px solid #333; padding: 5px 9px; text-align: left; vertical-align: top; }
      .rev-table th { background: #f3f1ec; font-weight: 700; font-size: 10.5px; }
      .cover-foot { text-align: center; font-size: 10px; color: #888; margin-top: 14px; font-style: italic; }

      /* ===== body sections ===== */
      .sec { break-inside: auto; margin-bottom: 20px; }
      .part { font-size: 16.5px; font-weight: 700; margin: 26px 0 12px; padding-bottom: 5px; border-bottom: 1.5px solid #333; break-after: avoid; letter-spacing: 0.01em; }
      .sub { font-size: 14px; font-weight: 700; margin: 16px 0 6px; color: #1c1c1c; break-after: avoid; }

      /* values: serif, clean two-column ruled rows (no robotic mono) */
      .val-grid { width: 100%; border-collapse: collapse; margin: 8px 0 14px; }
      .val-grid .vk { width: 280px; vertical-align: top; color: #333; padding: 5px 14px 5px 0; border-bottom: 1px solid #e4e4e4; }
      .val-grid .vv { padding: 5px 0; border-bottom: 1px solid #e4e4e4; }

      .cap-grid { width: 100%; border-collapse: collapse; margin: 10px 0 14px; font-size: 12.5px; }
      .cap-grid caption { text-align: left; font-style: italic; color: #555; margin-bottom: 5px; }
      .cap-grid th, .cap-grid td { border: 1px solid #ccc; padding: 6px 9px; text-align: left; vertical-align: top; }
      .cap-grid th { background: #f3f1ec; font-weight: 700; }

      .prose { font-size: 14px; margin: 9px 0; line-height: 1.75; text-align: justify; }
      .prose.placeholder { color: #9a948a; font-style: italic; text-align: left; }

      .combos { margin: 8px 0 12px; padding-left: 26px; font-size: 13px; }
      .combos li { margin: 3px 0; }
      .combos .added { color: #0E7490; }
      .added-tag { font-size: 9px; letter-spacing: 0.06em; background: #e0f3f7; border: 1px solid #b6e0ea; border-radius: 3px; padding: 0 5px; margin-left: 6px; font-family: Arial, sans-serif; }
      .codes { columns: 2; margin: 8px 0; padding-left: 22px; font-size: 13.5px; }
      .codes li { margin: 3px 0; break-inside: avoid; }

      /* clause quote — a softly tinted reference block, still serif */
      .clause { margin: 10px 0 14px; background: #FAF6EC; border-left: 3px solid #C9A24B; padding: 10px 16px; }
      .clause-h { font-size: 11px; color: #8a7a5a; margin-bottom: 5px; letter-spacing: 0.02em; }
      .clause-b { font-size: 13px; color: #2A2620; line-height: 1.7; font-style: italic; }

      .empty { font-size: 13px; color: #6B6860; font-style: italic; padding: 6px 0; }
      .appx { break-inside: avoid; margin-bottom: 12px; }
      .doc-foot { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10.5px; color: #777; line-height: 1.6; }

      .toolbar { position: sticky; top: 0; display: flex; align-items: center; gap: 12px; padding: 12px 0; margin-bottom: 8px; border-bottom: 1px solid #eee; background: #fff; z-index: 5; }
      .toolbar button { font-family: Inter, system-ui, sans-serif; font-size: 13px; font-weight: 600; padding: 9px 16px; border-radius: 8px; border: none; background: #0A1628; color: #fff; cursor: pointer; }
      .toolbar button.ghost { background: #fff; color: #0A1628; border: 1px solid #ddd; }
      .toolbar .hint { font-family: Inter, system-ui, sans-serif; font-size: 12px; color: #6B6860; }
      .edit-banner { font-family: Inter, system-ui, sans-serif; font-size: 12.5px; color: #0E7490; background: #ecfbff; border: 1px solid #b6e0ea; border-radius: 8px; padding: 8px 12px; margin: 0 0 14px; }

      /* edit mode: gentle highlight on hover so the engineer sees what's editable */
      .editable-on:focus { outline: none; }
      .editable-on .prose:hover, .editable-on .part:hover, .editable-on .sub:hover,
      .editable-on .vv:hover, .editable-on .ct-project:hover, .editable-on .so-name:hover,
      .editable-on .cap-grid td:hover, .editable-on .combos li:hover { background: #fff7e6; border-radius: 3px; }
      .editable-on [contenteditable] { cursor: text; }

      @media print {
        @page { margin: 16mm 16mm 24mm; size: A4; }
        .no-print { display: none !important; }
        .doc { max-width: none; padding: 0; font-size: 12pt; }
        .cover { min-height: auto; page-break-after: always; }
        .toc { break-before: page; }
        /* logo band fixed to the BOTTOM margin of EVERY printed page — the firm
           drops their logo into the left cell to personalise the document. */
        .run-foot { display: grid !important; grid-template-columns: 1fr 1.6fr 1fr; align-items: stretch;
          position: fixed; bottom: 0; left: 0; right: 0; height: 16mm; border-top: 1.5px solid #333; background: #fff; }
        .rf-logo, .rf-mid, .rf-meta { display: flex; align-items: center; justify-content: center; font-size: 8pt; color: #777; text-align: center; padding: 2px 8px; }
        .rf-logo { justify-content: flex-start; border: 1px dashed #bbb; color: #aaa; font-style: italic; margin: 3mm 0; }
        .rf-mid { font-weight: 700; color: #333; }
        .rf-meta { justify-content: flex-end; }
        .part, .sub { break-after: avoid; }
        .prose { orphans: 3; widows: 3; }
      }
    `}</style>
  );
}

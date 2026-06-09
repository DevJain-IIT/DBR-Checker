"use client";

import Link from "next/link";
import React from "react";
import { listReports } from "@/lib/api";
import type { ReportListItem } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { GridBg, Icon, T, VERDICTS, VERDICT_ORDER, VIcon, Wordmark } from "@/lib/design";

export default function HistoryPage() {
  const [reports, setReports] = React.useState<ReportListItem[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  const [activeEmail, setActiveEmail] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback((filterEmail: string | null) => {
    setError(null); setLoading(true);
    listReports(50, filterEmail || undefined)
      .then(setReports)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load history."))
      .finally(() => setLoading(false));
  }, []);

  // Default to the email used on upload (saved in localStorage).
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("dbr-user-email") : null;
    if (saved) { setEmail(saved); setActiveEmail(saved); load(saved); }
    else { setActiveEmail(null); load(null); }
  }, [load]);

  const applyFilter = () => { const e = email.trim().toLowerCase(); setActiveEmail(e || null); load(e || null); };
  const showAll = () => { setActiveEmail(null); load(null); };

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.sans, position: "relative" }}>
      <GridBg color="rgba(10,22,40,0.025)" step={36} />
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${T.border}` }}>
        <Link href="/" style={{ textDecoration: "none" }}><Wordmark tone="dark" size={20} /></Link>
        <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 10, background: T.cyan, color: T.navy, fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
          <Icon.Upload size={16} color={T.navy} /> New analysis
        </Link>
      </header>

      <div style={{ position: "relative", maxWidth: 920, margin: "0 auto", padding: "48px 32px 80px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.18em", marginBottom: 12 }}>SAVED REPORTS</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 40, margin: 0, fontWeight: 400, letterSpacing: "-0.02em" }}>Report history</h1>
          <p style={{ fontSize: 15, color: T.muted, marginTop: 12 }}>
            {activeEmail ? <>Reports saved under <b>{activeEmail}</b>.</> : "All saved reports."} Open one to revisit its findings and citations.
          </p>

          {/* email filter */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", alignItems: "center" }}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="filter by email"
              onKeyDown={(e) => { if (e.key === "Enter") applyFilter(); }}
              style={{ padding: "9px 13px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 13.5, fontFamily: T.sans, outline: "none", minWidth: 240 }} />
            <button onClick={applyFilter} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: T.ink, color: T.textD, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Filter</button>
            {activeEmail && <button onClick={showAll} style={{ padding: "9px 14px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.muted, fontSize: 13, cursor: "pointer" }}>Show all</button>}
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: VERDICTS.FLAW.bg, border: `1px solid ${VERDICTS.FLAW.line}`, borderRadius: 12, color: VERDICTS.FLAW.fg, fontSize: 13.5 }}>{error}</div>
        )}

        {!reports && !error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.muted, padding: "40px 0" }}>
            <span style={{ display: "flex", animation: "spin .8s linear infinite" }}><Icon.Refresh size={16} color={T.cyanDeep} /></span>
            Loading…
          </div>
        )}

        {reports && reports.length === 0 && !loading && (
          <div style={{ textAlign: "center", padding: "60px 24px", background: T.panel, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
            <div style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>No reports yet</div>
            <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>Upload a DBR to create your first analysis.</div>
            <Link href="/upload" style={{ display: "inline-flex", marginTop: 20, padding: "12px 22px", borderRadius: 10, background: T.cyan, color: T.navy, fontWeight: 600, textDecoration: "none" }}>Upload a DBR</Link>
          </div>
        )}

        {reports && reports.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: loading ? 0.5 : 1, transition: "opacity .2s" }}>
            {reports.map((r, i) => <ReportRow key={r.id} r={r} delay={i * 0.03} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportRow({ r, delay }: { r: ReportListItem; delay: number }) {
  const [hover, setHover] = React.useState(false);
  const total = r.check_count || Object.values(r.summary).reduce((a, b) => a + (b ?? 0), 0);
  const statusV = r.overall_status && VERDICTS[r.overall_status] ? VERDICTS[r.overall_status] : VERDICTS.REVIEW;

  return (
    <Link href={`/report/${r.id}`} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: "block", textDecoration: "none", background: T.panel, border: `1px solid ${hover ? `${T.cyan}55` : T.border}`, borderLeft: `3px solid ${statusV.solid}`, borderRadius: 14, padding: "16px 20px", transform: hover ? "translateY(-2px)" : "none", boxShadow: hover ? "0 18px 38px -26px rgba(10,22,40,0.4)" : "none", transition: `all .2s ${T.spring}`, animation: `dbr-fade-up .4s ${delay}s both` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: statusV.bg, border: `1px solid ${statusV.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <VIcon name={statusV.icon} size={18} color={statusV.solid} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.filename || "Untitled DBR"}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11.5, color: T.subtle, marginTop: 4 }}>{fmtDate(r.created_at)} · {total} checks</div>
        </div>
        {/* mini verdict bar */}
        <div style={{ display: "flex", height: 8, width: 180, borderRadius: 999, overflow: "hidden", border: `1px solid ${T.border}`, flexShrink: 0 }}>
          {VERDICT_ORDER.map((k) => {
            const n = r.summary[k] ?? 0;
            if (!n || !total) return null;
            return <div key={k} style={{ width: `${(n / total) * 100}%`, background: VERDICTS[k].solid }} />;
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, minWidth: 70, justifyContent: "flex-end" }}>
          {r.flaw_count > 0 ? (
            <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: VERDICTS.FLAW.fg }}>{r.flaw_count} flaw{r.flaw_count > 1 ? "s" : ""}</span>
          ) : (
            <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: VERDICTS.PASS.fg }}>clear</span>
          )}
          <Icon.Chevron size={15} color={T.subtle} style={{ transform: "rotate(-90deg)" }} />
        </div>
      </div>
    </Link>
  );
}

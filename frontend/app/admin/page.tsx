"use client";

import Link from "next/link";
import React from "react";
import { adminStats } from "@/lib/api";
import type { AdminStats, Verdict } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { GridBg, Icon, T, VERDICTS, VERDICT_ORDER, VIcon, Wordmark } from "@/lib/design";

export default function AdminPage() {
  const [passcode, setPasscode] = React.useState("");
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);

  // Remember the passcode for the session so a refresh doesn't re-prompt.
  React.useEffect(() => {
    const saved = sessionStorage.getItem("dbr-admin-pass");
    if (saved) { setPasscode(saved); void load(saved); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async (code: string) => {
    setLoading(true); setError(null);
    try {
      const s = await adminStats(code);
      setStats(s); setAuthed(true);
      sessionStorage.setItem("dbr-admin-pass", code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load admin stats.");
      setAuthed(false);
      sessionStorage.removeItem("dbr-admin-pass");
    } finally {
      setLoading(false);
    }
  };

  if (!authed) {
    return (
      <div style={{ minHeight: "100vh", background: T.navy, color: T.textD, fontFamily: T.sans, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <GridBg color="rgba(255,255,255,0.022)" step={38} />
        <div style={{ position: "relative", width: 380, background: T.surface, border: `1px solid ${T.borderD}`, borderRadius: 18, padding: "32px 30px", boxShadow: "0 40px 90px -40px rgba(0,0,0,0.8)" }}>
          <div style={{ marginBottom: 22 }}><Wordmark tone="light" size={20} /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: "0.16em", marginBottom: 14 }}>
            <Icon.Lock size={13} color={T.cyan} /> ADMIN ACCESS
          </div>
          <h1 style={{ fontFamily: T.serif, fontSize: 28, margin: "0 0 8px", fontWeight: 400 }}>Dashboard</h1>
          <p style={{ fontSize: 13.5, color: T.mutedD, margin: "0 0 20px", lineHeight: 1.5 }}>Enter the admin passcode to view usage statistics.</p>
          <form onSubmit={(e) => { e.preventDefault(); void load(passcode); }}>
            <input type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} placeholder="Passcode" autoFocus
              style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.borderD}`, background: T.navy, color: T.textD, fontSize: 14, fontFamily: T.mono, outline: "none", marginBottom: 12 }} />
            <button type="submit" disabled={loading || !passcode} style={{ width: "100%", padding: "12px", borderRadius: 10, background: T.cyan, color: T.navy, fontWeight: 600, fontSize: 14, border: "none", cursor: loading ? "default" : "pointer", fontFamily: T.sans, opacity: loading || !passcode ? 0.6 : 1 }}>
              {loading ? "Checking…" : "Unlock"}
            </button>
          </form>
          {error && <div style={{ marginTop: 14, fontSize: 13, color: "#FB7185", fontFamily: T.mono }}>{error}</div>}
          <Link href="/" style={{ display: "inline-block", marginTop: 18, fontSize: 12.5, color: T.mutedD, textDecoration: "none" }}>← Back to site</Link>
        </div>
      </div>
    );
  }

  if (!stats) return null;
  const t = stats.totals;

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.sans, position: "relative" }}>
      <GridBg color="rgba(10,22,40,0.025)" step={36} />
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${T.border}` }}>
        <Link href="/" style={{ textDecoration: "none" }}><Wordmark tone="dark" size={20} /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>{stats.admin_email}</span>
          <button onClick={() => { sessionStorage.removeItem("dbr-admin-pass"); setAuthed(false); setStats(null); }}
            style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 12.5, cursor: "pointer", fontFamily: T.sans }}>Sign out</button>
        </div>
      </header>

      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.18em", marginBottom: 12 }}>ADMIN · USAGE</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 40, margin: 0, fontWeight: 400, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontSize: 14.5, color: T.muted, marginTop: 10 }}>Aggregated across every saved report. Extraction model: <span style={{ fontFamily: T.mono, fontSize: 13 }}>{stats.extraction_model}</span></p>
        </div>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 30 }}>
          <Kpi label="Reports analyzed" value={t.reports} icon="File" />
          <Kpi label="Total checks run" value={t.findings} icon="Layers" />
          <Kpi label="Reports with flaws" value={t.reports_with_flaws} icon="Shield" accent={VERDICTS.FLAW.solid} />
          <Kpi label="Avg flaws / report" value={t.avg_flaws_per_report} icon="Spark" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 30 }}>
          {/* verdict breakdown */}
          <Panel title="Verdict breakdown" sub="Across all findings">
            {VERDICT_ORDER.map((k) => {
              const n = stats.verdict_totals[k] ?? 0;
              const pct = t.findings ? Math.round((n / t.findings) * 100) : 0;
              const v = VERDICTS[k];
              return (
                <div key={k} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <VIcon name={v.icon} size={13} color={v.solid} />
                    <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted, letterSpacing: "0.04em", flex: 1 }}>{v.label.toUpperCase()}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: v.fg }}>{n}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, width: 36, textAlign: "right" }}>{pct}%</span>
                  </div>
                  <div style={{ height: 7, background: T.sand, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: v.solid, transition: `width .6s ${T.spring}` }} />
                  </div>
                </div>
              );
            })}
          </Panel>

          {/* top flagged checks */}
          <Panel title="Most-flagged checks" sub="FLAW + MISSING by check ID">
            {stats.top_flagged_checks.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>No flagged checks yet.</div>
            ) : stats.top_flagged_checks.map((c) => {
              const max = stats.top_flagged_checks[0].count || 1;
              return (
                <div key={c.check_id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 600, color: T.ink, width: 36 }}>{c.check_id}</span>
                  <div style={{ flex: 1, height: 8, background: T.sand, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(c.count / max) * 100}%`, height: "100%", background: VERDICTS.FLAW.solid }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, width: 26, textAlign: "right" }}>{c.count}</span>
                </div>
              );
            })}
          </Panel>
        </div>

        {/* recent reports */}
        <Panel title="Recent activity" sub={`${stats.recent_reports.length} most recent reports`}>
          {stats.recent_reports.length === 0 ? (
            <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>No reports yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stats.recent_reports.map((r) => {
                const sv = r.overall_status && VERDICTS[r.overall_status as Verdict] ? VERDICTS[r.overall_status as Verdict] : VERDICTS.REVIEW;
                return (
                  <Link key={r.id} href={`/report/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 8px", borderRadius: 8, textDecoration: "none", color: "inherit", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: sv.solid, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13.5, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.filename || "Untitled DBR"}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, color: T.subtle }}>{fmtDate(r.created_at)}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 11, fontWeight: 600, color: r.flaw_count ? VERDICTS.FLAW.fg : VERDICTS.PASS.fg, width: 64, textAlign: "right" }}>
                      {r.flaw_count ? `${r.flaw_count} flaw${r.flaw_count > 1 ? "s" : ""}` : "clear"}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, accent }: { label: string; value: number; icon: keyof typeof Icon; accent?: string }) {
  const C = Icon[icon];
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: "18px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: T.mono, fontSize: 10, color: T.subtle, letterSpacing: "0.08em" }}>{label.toUpperCase()}</span>
        <C size={16} color={accent || T.cyanDeep} />
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 38, color: accent || T.ink, marginTop: 8, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, padding: "20px 22px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: T.serif, fontSize: 19, color: T.ink, fontWeight: 400 }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

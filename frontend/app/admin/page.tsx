"use client";

import Link from "next/link";
import React from "react";
import { adminLogin, adminStats, changeAdminPassword, createAdmin, deleteAdmin, listAdmins } from "@/lib/api";
import type { AdminStats, AdminUser, Verdict } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { GridBg, Icon, T, VERDICTS, VERDICT_ORDER, VIcon, Wordmark } from "@/lib/design";

const TOKEN_KEY = "dbr-admin-token";

export default function AdminPage() {
  const [token, setToken] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<AdminStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // login form
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY);
    if (saved) { setToken(saved); void loadStats(saved); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadStats = async (tok: string) => {
    try {
      setStats(await adminStats(tok));
      setToken(tok);
      sessionStorage.setItem(TOKEN_KEY, tok);
    } catch (e) {
      // token invalid/expired -> drop it
      sessionStorage.removeItem(TOKEN_KEY);
      setToken(null); setStats(null);
      setError(e instanceof Error ? e.message : "Session expired.");
    }
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const { token: tok } = await adminLogin(email.trim().toLowerCase(), password);
      await loadStats(tok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => { sessionStorage.removeItem(TOKEN_KEY); setToken(null); setStats(null); setPassword(""); };

  if (!token || !stats) {
    return (
      <div style={{ minHeight: "100vh", background: T.navy, color: T.textD, fontFamily: T.sans, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <GridBg color="rgba(255,255,255,0.022)" step={38} />
        <div style={{ position: "relative", width: 400, background: T.surface, border: `1px solid ${T.borderD}`, borderRadius: 18, padding: "32px 30px", boxShadow: "0 40px 90px -40px rgba(0,0,0,0.8)" }}>
          <div style={{ marginBottom: 22 }}><Wordmark tone="light" size={20} /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: "0.16em", marginBottom: 14 }}>
            <Icon.Lock size={13} color={T.cyan} /> ADMIN SIGN IN
          </div>
          <h1 style={{ fontFamily: T.serif, fontSize: 28, margin: "0 0 8px", fontWeight: 400 }}>Dashboard</h1>
          <p style={{ fontSize: 13.5, color: T.mutedD, margin: "0 0 20px", lineHeight: 1.5 }}>Sign in with your admin email and password.</p>
          <form onSubmit={doLogin}>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoFocus
              style={inputStyle} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password"
              style={{ ...inputStyle, marginTop: 10 }} />
            <button type="submit" disabled={loading || !email || !password} style={{ width: "100%", marginTop: 14, padding: "12px", borderRadius: 10, background: T.cyan, color: T.navy, fontWeight: 600, fontSize: 14, border: "none", cursor: loading ? "default" : "pointer", fontFamily: T.sans, opacity: loading || !email || !password ? 0.6 : 1 }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
          {error && <div style={{ marginTop: 14, fontSize: 13, color: "#FB7185", fontFamily: T.mono }}>{error}</div>}
          <Link href="/" style={{ display: "inline-block", marginTop: 18, fontSize: 12.5, color: T.mutedD, textDecoration: "none" }}>← Back to site</Link>
        </div>
      </div>
    );
  }

  const t = stats.totals;

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.sans, position: "relative" }}>
      <GridBg color="rgba(10,22,40,0.025)" step={36} />
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${T.border}` }}>
        <Link href="/" style={{ textDecoration: "none" }}><Wordmark tone="dark" size={20} /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>{stats.admin_email}</span>
          <button onClick={signOut} style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 12.5, cursor: "pointer", fontFamily: T.sans }}>Sign out</button>
        </div>
      </header>

      <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "40px 32px 80px" }}>
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.18em", marginBottom: 12 }}>ADMIN · USAGE</div>
          <h1 style={{ fontFamily: T.serif, fontSize: 40, margin: 0, fontWeight: 400, letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ fontSize: 14.5, color: T.muted, marginTop: 10 }}>Aggregated across every saved report. Extraction model: <span style={{ fontFamily: T.mono, fontSize: 13 }}>{stats.extraction_model}</span></p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 30 }}>
          <Kpi label="Reports analyzed" value={t.reports} icon="File" />
          <Kpi label="Unique users" value={t.unique_users} icon="Search" />
          <Kpi label="Reports with flaws" value={t.reports_with_flaws} icon="Shield" accent={VERDICTS.FLAW.solid} />
          <Kpi label="Avg flaws / report" value={t.avg_flaws_per_report} icon="Spark" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 30 }}>
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

          <Panel title="Top users" sub="Most reports by email">
            {stats.top_users.length === 0 ? (
              <div style={{ color: T.muted, fontSize: 13, padding: "20px 0" }}>No attributed reports yet.</div>
            ) : stats.top_users.map((u) => {
              const max = stats.top_users[0].count || 1;
              return (
                <div key={u.email} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12.5, color: T.ink, width: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
                  <div style={{ flex: 1, height: 8, background: T.sand, borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ width: `${(u.count / max) * 100}%`, height: "100%", background: T.indigo }} />
                  </div>
                  <span style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, width: 26, textAlign: "right" }}>{u.count}</span>
                </div>
              );
            })}
          </Panel>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 30 }}>
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

          <Panel title="Recent activity" sub={`${stats.recent_reports.length} most recent`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {stats.recent_reports.map((r) => {
                const sv = r.overall_status && VERDICTS[r.overall_status as Verdict] ? VERDICTS[r.overall_status as Verdict] : VERDICTS.REVIEW;
                return (
                  <Link key={r.id} href={`/report/${r.id}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 6px", borderRadius: 8, textDecoration: "none", color: "inherit", borderBottom: `1px solid ${T.border}` }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: sv.solid, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.user_email || r.filename || "Untitled"}</span>
                    <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle }}>{fmtDate(r.created_at)}</span>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </div>

        <ManageAdmins token={token} />
      </div>
    </div>
  );
}

function ManageAdmins({ token }: { token: string }) {
  const [admins, setAdmins] = React.useState<AdminUser[] | null>(null);
  const [newEmail, setNewEmail] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    listAdmins(token).then(setAdmins).catch((e) => setErr(e instanceof Error ? e.message : "Failed to load admins."));
  }, [token]);
  React.useEffect(() => { refresh(); }, [refresh]);

  const add = async () => {
    setErr(null); setMsg(null);
    try {
      await createAdmin(token, newEmail.trim().toLowerCase(), newPass);
      setNewEmail(""); setNewPass(""); setMsg("Admin added."); refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to add admin."); }
  };
  const remove = async (id: string, email: string) => {
    if (!confirm(`Remove admin ${email}?`)) return;
    setErr(null); setMsg(null);
    try { await deleteAdmin(token, id); refresh(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed to remove."); }
  };
  const changePw = async (id: string, email: string) => {
    const pw = prompt(`New password for ${email} (min 6 chars):`);
    if (!pw) return;
    setErr(null); setMsg(null);
    try { await changeAdminPassword(token, id, pw); setMsg(`Password updated for ${email}.`); } catch (e) { setErr(e instanceof Error ? e.message : "Failed to change password."); }
  };

  return (
    <Panel title="Manage admins" sub="Add or remove admins, change passwords">
      {err && <div style={{ fontSize: 13, color: VERDICTS.FLAW.fg, marginBottom: 10 }}>{err}</div>}
      {msg && <div style={{ fontSize: 13, color: VERDICTS.PASS.fg, marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
        {admins?.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 6px", borderBottom: `1px solid ${T.border}` }}>
            <Icon.Lock size={14} color={T.subtle} />
            <span style={{ flex: 1, fontSize: 13.5, color: T.ink }}>{a.email}</span>
            <span style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle }}>{a.last_login_at ? `last ${fmtDate(a.last_login_at)}` : "never signed in"}</span>
            <button onClick={() => changePw(a.id, a.email)} style={smallBtn}>Password</button>
            <button onClick={() => remove(a.id, a.email)} style={{ ...smallBtn, color: VERDICTS.FLAW.fg, borderColor: VERDICTS.FLAW.line }}>Remove</button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new admin email"
          style={{ ...adminInput, minWidth: 220 }} />
        <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="password (min 6)"
          style={{ ...adminInput, minWidth: 160 }} />
        <button onClick={add} disabled={!newEmail || newPass.length < 6} style={{ padding: "9px 16px", borderRadius: 9, border: "none", background: T.ink, color: T.textD, fontSize: 13, fontWeight: 600, cursor: !newEmail || newPass.length < 6 ? "not-allowed" : "pointer", opacity: !newEmail || newPass.length < 6 ? 0.5 : 1 }}>Add admin</button>
      </div>
    </Panel>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${T.borderD}`, background: T.navy, color: T.textD, fontSize: 14, fontFamily: T.sans, outline: "none" };
const adminInput: React.CSSProperties = { padding: "9px 13px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 13.5, fontFamily: T.sans, outline: "none" };
const smallBtn: React.CSSProperties = { padding: "5px 11px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, color: T.muted, fontSize: 12, cursor: "pointer", fontFamily: T.sans };

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

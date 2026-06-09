"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";
import { getReport, recheck } from "@/lib/api";
import type { AnalyzeResponse, DBRData, Finding, Verdict } from "@/lib/types";
import { CATEGORY_ORDER, CHECK_CATEGORY, Icon, T, VERDICTS, Wordmark } from "@/lib/design";
import { SummaryBar } from "@/components/SummaryBar";
import { ExtractedPanel } from "@/components/ExtractedPanel";
import { CategorySection } from "@/components/FindingCard";

const ALL_VERDICTS: Verdict[] = ["FLAW", "MISSING", "REVIEW", "PASS", "NOT_APPLICABLE"];

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [data, setData] = React.useState<AnalyzeResponse | null>(null);
  const [edited, setEdited] = React.useState<DBRData | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [rerunning, setRerunning] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Load: prefer the in-session handoff from the upload page; else fetch by id.
  React.useEffect(() => {
    const cached = typeof window !== "undefined" ? sessionStorage.getItem(`dbr-report-${id}`) : null;
    if (cached) {
      try { setData(JSON.parse(cached)); return; } catch { /* fall through */ }
    }
    getReport(id).then(setData).catch((e) => setLoadError(e instanceof Error ? e.message : "Could not load report."));
  }, [id]);

  const working = edited ?? data?.extracted ?? null;

  const onChange = (d: DBRData) => { setEdited(d); setDirty(true); };

  const onRerun = async () => {
    if (!working) return;
    setRerunning(true);
    try {
      const res = await recheck(working, id, data?.extracted ? undefined : null, data?.user_email ?? null);
      setData((prev) => prev ? { ...prev, extracted: res.extracted, findings: res.findings, summary: res.summary, overall_status: res.overall_status } : prev);
      setEdited(null); setDirty(false);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Re-run failed.");
    } finally {
      setRerunning(false);
    }
  };

  // Filter state
  const [filter, setFilter] = React.useState<Set<Verdict>>(() => new Set(ALL_VERDICTS));
  const allOn = filter.size === ALL_VERDICTS.length;
  const toggle = (k: Verdict) => setFilter((prev) => {
    const next = new Set(prev);
    if (allOn) { next.clear(); next.add(k); }
    else if (next.has(k)) { next.delete(k); if (next.size === 0) return new Set(ALL_VERDICTS); }
    else next.add(k);
    return next;
  });
  const resetFilter = () => setFilter(new Set(ALL_VERDICTS));

  if (loadError) return <CenterMsg title="Couldn't load this report" body={loadError} action={() => router.push("/upload")} actionLabel="Upload a DBR" />;
  if (!data || !working) return <CenterMsg title="Loading report…" body="" />;

  const findings = data.findings;
  const total = findings.length;
  const counts = data.summary;

  // sort flaw/missing first within each category, then group by category
  const visible = findings.filter((f) => filter.has(f.verdict));
  const groups = CATEGORY_ORDER
    .map((cat) => ({
      cat,
      items: visible
        .filter((f) => CHECK_CATEGORY[f.check_id] === cat)
        .sort((a, b) => VERDICTS[b.verdict].weight - VERDICTS[a.verdict].weight),
    }))
    .filter((g) => g.items.length > 0);

  let runningIndex = 0;
  const filename = data.extracted.title_block?.project || data.extraction_model || "DBR report";

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.sans }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, height: 60, background: "rgba(250,247,242,0.92)", backdropFilter: "blur(10px)", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }} className="no-print">
        <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
          <Link href="/" style={{ textDecoration: "none" }}><Wordmark tone="dark" size={19} showTag={false} /></Link>
          <span style={{ width: 1, height: 22, background: T.border }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Icon.File size={15} color={T.muted} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 320 }}>{filename}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/history" style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.panel, color: T.ink, fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
            <Icon.Clock size={15} color={T.muted} /> History
          </Link>
          <button onClick={() => window.open(`/report/${id}/print`, "_blank")} style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: T.sans, fontSize: 13.5, fontWeight: 600, background: T.ink, color: T.textD, boxShadow: "0 10px 24px -16px rgba(10,22,40,0.7)" }}>
            <Icon.Print size={16} color={T.textD} /> Export report
          </button>
        </div>
      </header>

      <SummaryBar counts={counts} total={total} filter={filter} toggle={toggle} allOn={allOn} />

      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 28px 90px" }}>
        {/* Print-only cover header */}
        <div className="print-only" style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${T.ink}` }}>
          <div style={{ fontFamily: T.serif, fontSize: 26 }}>DBR Compliance Report</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{String(filename)}</div>
          <div style={{ fontFamily: T.mono, fontSize: 11, marginTop: 8 }}>
            {ALL_VERDICTS.map((k) => `${VERDICTS[k].label.toUpperCase()} ${counts[k] ?? 0}`).join("  ·  ")}  ·  TOTAL {total}
          </div>
        </div>

        <ExtractedPanel data={working} onChange={onChange} onRerun={onRerun} rerunning={rerunning} dirty={dirty} />

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "28px 2px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, fontWeight: 400 }}>Findings</h2>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.subtle }}>{allOn ? `all ${total} checks` : `${visible.length} shown`}</span>
          </div>
          {!allOn && (
            <button onClick={resetFilter} className="no-print" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: "pointer", fontSize: 12.5, color: T.muted, fontFamily: T.sans }}>
              <Icon.Close size={13} color={T.muted} /> Clear filter
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: T.muted }}>No checks match this filter.</div>
        ) : groups.map((g) => {
          const start = runningIndex; runningIndex += g.items.length;
          return <CategorySection key={g.cat} cat={g.cat} checks={g.items} startIndex={start} />;
        })}

        <div style={{ textAlign: "center", fontFamily: T.mono, fontSize: 11, color: T.subtle, marginTop: 40, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
          DBR CHECK · {String(filename).toUpperCase()} · 25 CHECKS · 8 IS CODES{data.extraction_model ? ` · ${data.extraction_model}` : ""}
        </div>
      </main>
    </div>
  );
}

function CenterMsg({ title, body, action, actionLabel }: { title: string; body: string; action?: () => void; actionLabel?: string }) {
  return (
    <div style={{ minHeight: "100vh", background: T.paper, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.sans }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: T.serif, fontSize: 28, color: T.ink }}>{title}</div>
        {body && <div style={{ fontSize: 14, color: T.muted, marginTop: 10, maxWidth: 420 }}>{body}</div>}
        {action && (
          <button onClick={action} style={{ marginTop: 22, padding: "12px 22px", borderRadius: 10, background: T.cyan, color: T.navy, fontWeight: 600, border: "none", cursor: "pointer" }}>{actionLabel}</button>
        )}
      </div>
    </div>
  );
}

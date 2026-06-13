"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";
import { getReport, recheck, zoneByCoords, type ZoneByCoords } from "@/lib/api";
import type { AnalyzeResponse, CheckResponse, DBRData, Finding, LocationStatus, Verdict } from "@/lib/types";
import { CATEGORY_ORDER, CHECK_CATEGORY, Icon, T, VERDICTS, VIcon, Wordmark } from "@/lib/design";
import { SummaryBar } from "@/components/SummaryBar";
import { ExtractedPanel } from "@/components/ExtractedPanel";
import { CategorySection } from "@/components/FindingCard";
import { GuidedFix } from "@/components/GuidedFix";
import { ReviewPanel } from "@/components/ReviewPanel";
import { SlideOverPanel } from "@/components/SlideOverPanel";
import { useAutoRecheck } from "@/lib/useAutoRecheck";
import { useIgnored } from "@/lib/useIgnored";
import { useReviewDecisions } from "@/lib/useReviewDecisions";
import { useDbrExtras } from "@/lib/useDbrExtras";

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

  const [view, setView] = React.useState<"guided" | "review" | "full">("guided");
  const [detailFinding, setDetailFinding] = React.useState<Finding | null>(null);

  const working = edited ?? data?.extracted ?? null;
  const hasServerExtract = !!data?.extracted;
  const userEmail = data?.user_email ?? null;

  const onChange = (d: DBRData) => { setEdited(d); setDirty(true); };

  // Apply a fresh /api/check result (shared by manual re-run + auto-recheck).
  const applyResult = React.useCallback((res: CheckResponse) => {
    setData((prev) => prev ? { ...prev, extracted: res.extracted, findings: res.findings, summary: res.summary, overall_status: res.overall_status, location: res.location ?? prev.location } : prev);
    // sync working to the engine's normalised echo so further edits build on it
    setEdited(res.extracted);
    setDirty(false);
  }, []);

  // Guided view: auto re-run, debounced, on each fix.
  const { scheduleRecheck, rechecking } = useAutoRecheck({
    reportId: id, userEmail, hasServerExtract, onResult: applyResult,
    onError: (e) => setLoadError(e instanceof Error ? e.message : "Re-check failed."),
  });
  const { isIgnored, toggle: toggleIgnore } = useIgnored(id);
  const { decisionOf, decide } = useReviewDecisions(id, data?.review_decisions as Record<string, "accepted" | "revise" | "ignored"> | undefined);
  const dbrExtras = useDbrExtras(id);

  // Which check's Update was last clicked — drives the per-card "Re-running…"
  // spinner. Cleared when the in-flight recheck settles.
  const [rechckingId, setRechckingId] = React.useState<string | null>(null);
  React.useEffect(() => { if (!rechecking) setRechckingId(null); }, [rechecking]);

  // A fix from a guided control: update working immediately, then debounce a recheck.
  const onGuidedChange = (next: DBRData, checkId?: string) => { setEdited(next); setDirty(true); if (checkId) setRechckingId(checkId); scheduleRecheck(next); };

  const onGenerate = () => {
    alert("Generate DBR — branded document generation is coming soon (Phase 1).");
  };

  // Manual re-run (ExtractedPanel button, full view).
  const onRerun = async () => {
    if (!working) return;
    setRerunning(true);
    try {
      const res = await recheck(working, id, hasServerExtract ? undefined : null, userEmail);
      applyResult(res);
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

  // Hide N/A checks (not relevant to this building) and the removed D1 entirely.
  // The count the engineer sees is "checks that applied" — N/A excluded.
  const findings = data.findings.filter((f) => f.verdict !== "NOT_APPLICABLE" && f.check_id !== "D1");
  const total = findings.length;
  const counts = ALL_VERDICTS.reduce<Record<string, number>>((acc, v) => {
    acc[v] = findings.filter((f) => f.verdict === v).length;
    return acc;
  }, {});

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
            {ALL_VERDICTS.filter((k) => k !== "NOT_APPLICABLE").map((k) => `${VERDICTS[k].label.toUpperCase()} ${counts[k] ?? 0}`).join("  ·  ")}  ·  TOTAL {total}
          </div>
        </div>

        <ExtractedPanel data={working} onChange={onChange} onRerun={onRerun} rerunning={rerunning} dirty={dirty} />

        {data.location && <LocationBanner loc={data.location} />}

        {/* View switcher: Fix the flaws (default) · Review · Full report */}
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 6, margin: "28px 0 18px", background: T.sand, border: `1px solid ${T.border}`, borderRadius: 11, padding: 4, width: "fit-content" }}>
          {([["guided", "Fix the flaws"], ["review", "Review"], ["full", "Full report"]] as const).map(([k, lbl]) => {
            const reviewCount = k === "review" ? findings.filter((f) => f.verdict === "REVIEW").length : 0;
            return (
              <button key={k} onClick={() => setView(k)} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: T.sans, fontSize: 13.5, fontWeight: 600,
                background: view === k ? T.panel : "transparent", color: view === k ? T.ink : T.muted,
                boxShadow: view === k ? "0 1px 4px -2px rgba(10,22,40,0.3)" : "none",
              }}>
                {lbl}
                {k === "review" && reviewCount > 0 && (
                  <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 700, color: VERDICTS.REVIEW.fg, background: VERDICTS.REVIEW.bg, border: `1px solid ${VERDICTS.REVIEW.line}`, borderRadius: 999, padding: "1px 7px" }}>{reviewCount}</span>
                )}
              </button>
            );
          })}
        </div>

        {view === "guided" ? (
          <GuidedFix findings={findings} working={working} onChange={onGuidedChange} rechecking={rechecking} rechckingId={rechckingId}
            isIgnored={isIgnored} onToggleIgnore={toggleIgnore} onShowMore={setDetailFinding} onGenerate={onGenerate} extras={dbrExtras} />
        ) : view === "review" ? (
          <ReviewPanel findings={findings} working={working} decisionOf={decisionOf} onDecide={decide} onShowMore={setDetailFinding} />
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 16px" }}>
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
          </>
        )}

        <div style={{ textAlign: "center", fontFamily: T.mono, fontSize: 11, color: T.subtle, marginTop: 40, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
          DBR CHECK · {String(filename).toUpperCase()} · CODE CHECKS · 8 IS CODES{data.extraction_model ? ` · ${data.extraction_model}` : ""}
        </div>
      </main>

      <SlideOverPanel finding={detailFinding} onClose={() => setDetailFinding(null)} />
    </div>
  );
}

function LocationBanner({ loc }: { loc: LocationStatus }) {
  // Tone: straddler needs coords = amber; mismatch = amber; unmatched = grey; ok = cyan.
  const straddler = !!loc.needs_coordinates;
  const tone = straddler || (loc.matched === false) ? VERDICTS.REVIEW : VERDICTS.PASS;
  return (
    <div style={{ marginTop: 16, background: tone.bg, border: `1px solid ${tone.line}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 8, background: T.panel, border: `1px solid ${tone.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.Search size={16} color={tone.solid} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>Location basis</span>
            {loc.district && <span style={{ fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>{loc.district}{loc.state ? `, ${loc.state}` : ""}</span>}
            {straddler && <span style={{ fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: tone.fg, background: T.panel, border: `1px solid ${tone.line}`, borderRadius: 5, padding: "2px 7px" }}>STRADDLER · ZONES {loc.zone_span}</span>}
          </div>
          {loc.message && <div style={{ fontSize: 13, color: T.ink, marginTop: 7, lineHeight: 1.55 }}>{loc.message}</div>}

          {/* zones side by side for straddlers */}
          {straddler && (
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <ZoneChip label="Conservative" zone={loc.zone_conservative} emphasis />
              <ZoneChip label="Majority" zone={loc.zone_majority} />
            </div>
          )}

          {/* coordinate lookup: exact zone from precise lat/long */}
          <CoordinateLookup loc={loc} defaultOpen={!!loc.needs_coordinates} />

          {/* wind status */}
          {loc.matched && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>
              {loc.wind_known
                ? <><VIcon name="check" size={13} color={VERDICTS.PASS.solid} /> Vb {loc.basic_wind_speed_ms} m/s{loc.wind_source ? ` · ${loc.wind_source}` : ""}</>
                : <><VIcon name="dash" size={13} color={VERDICTS.MISSING.solid} /> {loc.wind_message || "Wind speed not in lookup yet."}</>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ZoneChip({ label, zone, emphasis }: { label: string; zone?: string | null; emphasis?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 13px", background: T.panel, border: `1px solid ${emphasis ? VERDICTS.REVIEW.line : T.border}`, borderRadius: 10 }}>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.08em" }}>{label.toUpperCase()}</span>
      <span style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, lineHeight: 1 }}>Zone {zone || "—"}</span>
    </div>
  );
}

function CoordinateLookup({ loc, defaultOpen }: { loc: LocationStatus; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [lat, setLat] = React.useState("");
  const [lon, setLon] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<ZoneByCoords | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const valid = (() => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    return !Number.isNaN(la) && !Number.isNaN(lo) && la >= 6 && la <= 38 && lo >= 68 && lo <= 98;
  })();

  const resolve = async () => {
    if (!valid) return;
    setBusy(true); setError(null); setResult(null);
    try {
      setResult(await zoneByCoords(parseFloat(lat), parseFloat(lon)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve coordinates.");
    } finally {
      setBusy(false);
    }
  };

  // Compare the resolved zone with what the DBR stated (mismatch detection).
  const stated = loc.stated_zone;
  const resolvedZone = result?.seismic_zone || null;
  const mismatch = stated && resolvedZone && stated !== resolvedZone;

  return (
    <div style={{ marginTop: 12 }}>
      {!open ? (
        <button onClick={() => setOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 13px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, cursor: "pointer", fontSize: 12.5, color: T.cyanDeep, fontWeight: 600, fontFamily: T.sans }}>
          <Icon.Search size={14} color={T.cyanDeep} /> Pinpoint exact zone from coordinates
        </button>
      ) : (
        <div style={{ padding: "12px 14px", background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10 }}>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 10 }}>
            Enter the precise site latitude &amp; longitude (decimal degrees, WGS84) to resolve the exact IS 1893 zone.
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat e.g. 19.0760" inputMode="decimal"
              onKeyDown={(e) => { if (e.key === "Enter" && valid) resolve(); }}
              style={{ width: 150, padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 13, outline: "none" }} />
            <input value={lon} onChange={(e) => setLon(e.target.value)} placeholder="lon e.g. 72.8777" inputMode="decimal"
              onKeyDown={(e) => { if (e.key === "Enter" && valid) resolve(); }}
              style={{ width: 150, padding: "9px 12px", borderRadius: 8, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 13, outline: "none" }} />
            <button onClick={resolve} disabled={!valid || busy} style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: valid ? T.ink : T.sand, color: valid ? T.textD : T.muted, fontSize: 13, fontWeight: 600, cursor: valid && !busy ? "pointer" : "not-allowed", fontFamily: T.sans }}>
              {busy ? "Resolving…" : "Resolve zone"}
            </button>
          </div>

          {error && <div style={{ fontSize: 12.5, color: VERDICTS.FLAW.fg, marginTop: 10 }}>{error}</div>}

          {result && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: (mismatch ? VERDICTS.FLAW : VERDICTS.PASS).bg, border: `1px solid ${(mismatch ? VERDICTS.FLAW : VERDICTS.PASS).line}`, borderRadius: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, lineHeight: 1 }}>Zone {result.seismic_zone || "—"}</span>
                <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>at {result.district}{result.state ? `, ${result.state}` : ""}</span>
                {result.boundary_case && <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, color: VERDICTS.REVIEW.fg, background: VERDICTS.REVIEW.bg, border: `1px solid ${VERDICTS.REVIEW.line}`, borderRadius: 5, padding: "2px 7px" }}>NEAR BOUNDARY</span>}
              </div>
              {mismatch && (
                <div style={{ fontSize: 12.5, color: VERDICTS.FLAW.fg, marginTop: 8, fontWeight: 600 }}>
                  ⚠ DBR states Zone {stated}, but these coordinates resolve to Zone {resolvedZone}. Verify the seismic zone basis.
                </div>
              )}
              {result.note && <div style={{ fontSize: 12, color: T.muted, marginTop: 8 }}>{result.note}</div>}
              <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.subtle, marginTop: 8 }}>{result.citation}</div>
            </div>
          )}
        </div>
      )}
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

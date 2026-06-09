"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import React from "react";
import { analyzePdf } from "@/lib/api";
import { GridBg, Icon, T, VERDICTS, VIcon, Wordmark, useCountUp } from "@/lib/design";

type Stage = "idle" | "drag" | "ready" | "processing" | "error";

export default function UploadPage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("idle");
  const [file, setFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [analysisDone, setAnalysisDone] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Prefill the email from a previous session so repeat users don't retype it.
  React.useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("dbr-user-email") : null;
    if (saved) setEmail(saved);
  }, []);

  const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const pick = (f: File | null) => {
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf") && f.type !== "application/pdf") {
      setError("Please choose a PDF file."); setStage("error"); return;
    }
    setError(null); setFile(f); setStage("ready");
  };

  const run = async () => {
    if (!file) return;
    if (!emailValid) { setError("Please enter a valid email to continue."); return; }
    localStorage.setItem("dbr-user-email", email.trim().toLowerCase());
    setAnalysisDone(false);
    setStage("processing");
    try {
      const res = await analyzePdf(file, email.trim().toLowerCase());
      // hand off via sessionStorage so the report page can render instantly,
      // then it also persists server-side and is reachable by id.
      sessionStorage.setItem(`dbr-report-${res.report_id}`, JSON.stringify(res));
      // Signal the loader that real work finished; let it play the final
      // "checks complete" beat briefly, then navigate.
      setAnalysisDone(true);
      setTimeout(() => router.push(`/report/${res.report_id}`), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
      setStage("error");
    }
  };

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.paper, color: T.ink, fontFamily: T.sans, position: "relative" }}>
      <GridBg color="rgba(10,22,40,0.025)" step={36} />
      <header style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 32px", borderBottom: `1px solid ${T.border}` }}>
        <Link href="/" style={{ textDecoration: "none" }}><Wordmark tone="dark" size={20} /></Link>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: T.mono, fontSize: 11, color: T.subtle }}>
          <Icon.Lock size={13} color={T.subtle} /> PRIVATE · NOT STORED UNENCRYPTED
        </div>
      </header>

      <div style={{ position: "relative", maxWidth: 760, margin: "0 auto", padding: "56px 32px 80px" }}>
        {stage !== "processing" ? (
          <>
            <div style={{ textAlign: "center", marginBottom: 36 }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.18em", marginBottom: 14 }}>STEP 1 · UPLOAD</div>
              <h1 style={{ fontFamily: T.serif, fontSize: 44, margin: 0, fontWeight: 400, letterSpacing: "-0.02em" }}>Drop your Design&nbsp;Basis Report</h1>
              <p style={{ fontSize: 16, color: T.muted, marginTop: 14, lineHeight: 1.55 }}>A single PDF — we&rsquo;ll extract the building basis and run 25 IS-code checks.</p>
            </div>

            <input ref={inputRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={(e) => pick(e.target.files?.[0] ?? null)} />

            <UploadZone stage={stage} setStage={setStage} file={file} onBrowse={() => inputRef.current?.click()} onDropFile={pick} onClear={() => { setFile(null); setStage("idle"); }} />

            {error && (
              <div style={{ marginTop: 18, padding: "12px 16px", background: VERDICTS.FLAW.bg, border: `1px solid ${VERDICTS.FLAW.line}`, borderRadius: 10, color: VERDICTS.FLAW.fg, fontSize: 13.5, display: "flex", gap: 10, alignItems: "center" }}>
                <VIcon name="alert" size={16} color={VERDICTS.FLAW.solid} /> {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginTop: 22 }}>
              {[
                { ic: "Lock" as const, t: "Stays private", d: "Processed in-session via the API." },
                { ic: "File" as const, t: "PDF up to 40 MB", d: "Multi-page DBRs accepted." },
                { ic: "Clock" as const, t: "Seconds", d: "Extraction + 25 checks." },
              ].map((x) => {
                const C = Icon[x.ic];
                return (
                  <div key={x.t} style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <C size={15} color={T.cyanDeep} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{x.t}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.45 }}>{x.d}</div>
                  </div>
                );
              })}
            </div>

            {stage === "ready" && (
              <div style={{ marginTop: 28, animation: "dbr-pop-in .4s both" }}>
                <div style={{ maxWidth: 420, margin: "0 auto" }}>
                  <label style={{ display: "block", fontFamily: T.mono, fontSize: 11, color: T.subtle, letterSpacing: "0.06em", marginBottom: 7 }}>
                    YOUR EMAIL <span style={{ color: VERDICTS.FLAW.fg }}>*</span>
                  </label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@firm.com"
                    onKeyDown={(e) => { if (e.key === "Enter" && emailValid) run(); }}
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${email && !emailValid ? VERDICTS.FLAW.line : T.border}`, background: T.panel, color: T.ink, fontSize: 14.5, fontFamily: T.sans, outline: "none" }} />
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>
                    Reports are saved under your email so you can find them later in History.
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
                  <button onClick={run} disabled={!emailValid} style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 30px", borderRadius: 12, background: emailValid ? T.ink : T.sand, color: emailValid ? T.textD : T.muted, fontWeight: 600, fontSize: 15.5, border: "none", cursor: emailValid ? "pointer" : "not-allowed", fontFamily: T.sans, boxShadow: emailValid ? "0 14px 32px -16px rgba(10,22,40,0.6)" : "none", transition: `all .2s ${T.spring}` }}>
                    Run 25 checks <Icon.Arrow size={17} color={emailValid ? T.textD : T.muted} />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <Processing fileName={file?.name ?? "your DBR"} done={analysisDone} />
        )}
      </div>
    </div>
  );
}

function UploadZone({ stage, setStage, file, onBrowse, onDropFile, onClear }: {
  stage: Stage; setStage: (s: Stage) => void; file: File | null;
  onBrowse: () => void; onDropFile: (f: File | null) => void; onClear: () => void;
}) {
  const dragging = stage === "drag";
  const ready = stage === "ready" && !!file;
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!ready) setStage("drag"); }}
      onDragLeave={(e) => { e.preventDefault(); if (!ready) setStage("idle"); }}
      onDrop={(e) => { e.preventDefault(); onDropFile(e.dataTransfer.files?.[0] ?? null); }}
      onClick={() => !ready && onBrowse()}
      style={{
        position: "relative", borderRadius: 20, cursor: ready ? "default" : "pointer",
        padding: "54px 32px", textAlign: "center",
        background: dragging ? `${T.cyan}10` : T.panel,
        border: `2px dashed ${dragging ? T.cyan : ready ? `${T.cyan}66` : "#D8D2C6"}`,
        transition: `all .22s ${T.spring}`, transform: dragging ? "scale(1.012)" : "none",
        boxShadow: dragging ? `0 24px 50px -28px ${T.cyan}` : "0 10px 30px -24px rgba(10,22,40,0.4)",
      }}>
      {!ready ? (
        <>
          <div style={{ width: 74, height: 74, margin: "0 auto 20px", borderRadius: 18, background: dragging ? T.cyan : `${T.cyan}14`, border: `1px solid ${T.cyan}3a`, display: "flex", alignItems: "center", justifyContent: "center", transition: `all .22s ${T.spring}`, transform: dragging ? "translateY(-6px) scale(1.06)" : "none" }}>
            <Icon.Upload size={32} color={dragging ? T.navy : T.cyanDeep} />
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 24, color: T.ink }}>{dragging ? "Release to upload" : "Drag a DBR here"}</div>
          <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>
            or <span style={{ color: T.cyanDeep, fontWeight: 600 }}>browse files</span> · PDF only
          </div>
        </>
      ) : (
        <div style={{ animation: "dbr-pop-in .4s both", display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
          <div style={{ width: 52, height: 60, borderRadius: 8, background: "#fff", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", flexShrink: 0, boxShadow: "0 8px 20px -12px rgba(10,22,40,0.4)" }}>
            <Icon.File size={26} color={T.cyanDeep} />
            <span style={{ position: "absolute", bottom: 6, fontFamily: T.mono, fontSize: 7, color: T.cyanDeep, fontWeight: 700, letterSpacing: "0.06em" }}>PDF</span>
          </div>
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{file!.name}</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 4 }}>{(file!.size / 1_048_576).toFixed(1)} MB · ready</div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClear(); }} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8 }}>
            <Icon.Close size={14} color={T.muted} />
          </button>
        </div>
      )}
    </div>
  );
}

function Processing({ fileName, done }: { fileName: string; done: boolean }) {
  // The real work is a single network call dominated by model EXTRACTION
  // (~15-20s); normalization + the 25 checks are near-instant server-side and
  // only run after extraction returns. So the loader DWELLS on "Extracting",
  // then completes normalize + checks for real when `done` flips true.
  const phases = [
    { key: "extract", label: "Extracting data", sub: "Reading the building basis from the PDF" },
    { key: "normalize", label: "Normalizing", sub: "Mapping values to IS-code parameters" },
    { key: "checks", label: "Running 25 checks", sub: "Comparing against clauses & tables" },
  ];
  // active = how many phases are fully done; we stay on phase 0 (extracting)
  // for the whole network wait, only nudging forward if it runs unusually long.
  const [active, setActive] = React.useState(0);

  // When done flips true, play a brief sequenced finish (normalize -> checks ->
  // complete) so even a fast analysis visibly shows all three phases instead of
  // snapping straight to done. finishStep: 0=extract done, 1=normalize done,
  // 2=checks done (all complete).
  const [finishStep, setFinishStep] = React.useState(-1);

  React.useEffect(() => {
    if (done) return;
    const timers = [
      setTimeout(() => setActive((a) => Math.max(a, 1)), 22000),
      setTimeout(() => setActive((a) => Math.max(a, 2)), 30000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);

  React.useEffect(() => {
    if (!done) return;
    setFinishStep(0);
    const timers = [
      setTimeout(() => setFinishStep(1), 350),
      setTimeout(() => setFinishStep(2), 750),
    ];
    return () => timers.forEach(clearTimeout);
  }, [done]);

  const allDone = finishStep >= 2;
  const checksRun = useCountUp(25, { start: done && finishStep >= 1, duration: 600 });

  const phaseState = (i: number): "done" | "active" | "wait" => {
    if (done) {
      // sequenced finish: phase i is done once finishStep passed it, active on the current one
      if (i < finishStep) return "done";
      if (i === finishStep) return finishStep >= 2 ? "done" : "active";
      return "done"; // remaining collapse to done at the end
    }
    if (i < active) return "done";
    if (i === active) return "active";
    return "wait";
  };

  return (
    <div style={{ textAlign: "center", paddingTop: 8, animation: "dbr-fade-in .4s both" }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: "0.18em", marginBottom: 20 }}>STEP 2 · ANALYZING</div>
      <ProcessingFrame done={allDone} />
      <h1 style={{ fontFamily: T.serif, fontSize: 36, margin: "26px 0 6px", fontWeight: 400 }}>
        {allDone ? "Report ready" : `Checking ${fileName}`}
      </h1>
      <p style={{ fontSize: 14.5, color: T.muted, margin: 0 }}>
        {allDone ? "Opening your findings…" : "Reading the PDF with the model — this is the slow part, hang tight."}
      </p>

      <div style={{ maxWidth: 460, margin: "34px auto 0", display: "flex", flexDirection: "column", gap: 12 }}>
        {phases.map((p, i) => {
          const state = phaseState(i);
          return (
            <div key={p.key} style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left", padding: "14px 18px", borderRadius: 13, background: state === "wait" ? "transparent" : T.panel, border: `1px solid ${state === "active" ? `${T.cyan}66` : state === "done" ? VERDICTS.PASS.line : T.border}`, opacity: state === "wait" ? 0.5 : 1, boxShadow: state === "active" ? `0 10px 26px -18px ${T.cyan}` : "none", transition: `all .3s ${T.spring}` }}>
              <PhaseDot state={state} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {p.key === "checks" && allDone
                    ? <>Running checks · <span style={{ fontFamily: T.mono, color: T.cyanDeep }}>{checksRun}/25</span></>
                    : p.label}
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                  {p.key === "extract" && state === "active"
                    ? <ElapsedHint />
                    : p.sub}
                </div>
              </div>
              {state === "done" && <VIcon name="check" size={18} color={VERDICTS.PASS.solid} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Shows a live "Xs" elapsed counter under the extraction phase so a long wait
// reads as progress, not a hang.
function ElapsedHint() {
  const [s, setS] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span>Reading the building basis from the PDF · <span style={{ fontFamily: T.mono, color: T.cyanDeep }}>{s}s</span></span>
  );
}

function PhaseDot({ state }: { state: "done" | "active" | "wait" }) {
  if (state === "done") return (
    <div style={{ width: 26, height: 26, borderRadius: 999, background: VERDICTS.PASS.bg, border: `1px solid ${VERDICTS.PASS.line}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <VIcon name="check" size={14} color={VERDICTS.PASS.solid} />
    </div>
  );
  if (state === "active") return (
    <div style={{ width: 26, height: 26, position: "relative", flexShrink: 0 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ animation: "spin 0.9s linear infinite" }}>
        <circle cx="13" cy="13" r="10" fill="none" stroke={`${T.cyan}33`} strokeWidth="3" />
        <circle cx="13" cy="13" r="10" fill="none" stroke={T.cyan} strokeWidth="3" strokeLinecap="round" strokeDasharray="16 60" />
      </svg>
    </div>
  );
  return <div style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${T.border}`, flexShrink: 0 }} />;
}

function ProcessingFrame({ done }: { done: boolean }) {
  const floors = 6;
  // Fill the building gradually over the expected extraction window (~18s) so
  // the long wait reads as steady progress; snap to full when actually done.
  const [filled, setFilled] = React.useState(1);
  React.useEffect(() => {
    if (done) { setFilled(floors); return; }
    const id = setInterval(() => setFilled((n) => (n < floors ? n + 1 : n)), 3000);
    return () => clearInterval(id);
  }, [done]);
  const litFloors = done ? floors : filled;
  return (
    <div style={{ width: 150, height: 150, margin: "0 auto", position: "relative" }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        {Array.from({ length: floors + 1 }).map((_, f) => {
          const y = 130 - f * 18;
          return <line key={"h" + f} x1="35" y1={y} x2="115" y2={y} stroke={T.border} strokeWidth="1" />;
        })}
        {[35, 75, 115].map((x, i) => <line key={"v" + i} x1={x} y1="22" x2={x} y2="130" stroke={T.border} strokeWidth="1" />)}
        {Array.from({ length: floors }).map((_, f) => {
          const y = 130 - (f + 1) * 18;
          const lit = f < litFloors;
          return <rect key={"r" + f} x="36" y={y + 1} width="78" height="16" rx="1.5" fill={lit ? `${T.cyan}22` : "transparent"} stroke={lit ? T.cyan : "transparent"} strokeWidth="1" style={{ transition: `all .4s ${T.spring} ${f * 0.04}s` }} />;
        })}
        {[35, 75, 115].map((x) => Array.from({ length: floors + 1 }).map((_, f) => (
          <circle key={x + "-" + f} cx={x} cy={130 - f * 18} r="2" fill={T.cyanDeep} opacity="0.7" />
        )))}
      </svg>
    </div>
  );
}

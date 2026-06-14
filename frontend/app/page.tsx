"use client";

import Link from "next/link";
import React from "react";
import {
  GridBg, Icon, StatusDot, T, VERDICTS, VERDICT_ORDER, VIcon, VerdictBadge,
  Wordmark, useCountUp,
} from "@/lib/design";
import { useTilt } from "@/lib/use3d";

const CODES = [
  { code: "IS 456", year: "2000", title: "Plain & Reinforced Concrete" },
  { code: "IS 1893", year: "2016", title: "Seismic design (Part 1)" },
  { code: "IS 13920", year: "2016", title: "Ductile detailing" },
  { code: "IS 875-3", year: "2015", title: "Wind loads" },
  { code: "IS 875-5", year: "1987", title: "Temperature & combos" },
  { code: "IS 16700", year: "2023", title: "Tall RC buildings" },
  { code: "IS 269", year: "2015", title: "Cement specification" },
  { code: "NBC 2016", year: "Part 4", title: "Fire & occupancy" },
];

export default function LandingPage() {
  // The hero card reports the pointer fraction; we drift the corner glow off it
  // for a subtle parallax. Resets to center when the pointer leaves the card.
  const [glow, setGlow] = React.useState({ x: 0, y: 0 });

  return (
    <div className="dbr-scroll" style={{ minHeight: "100vh", background: T.navy, color: T.textD, fontFamily: T.sans, position: "relative" }}>
      <GridBg color="rgba(255,255,255,0.022)" step={38} />
      <div style={{ position: "absolute", top: -160, right: -120, width: 560, height: 560, background: `radial-gradient(circle, ${T.cyan}1f, transparent 62%)`, pointerEvents: "none", transform: `translate(${glow.x * 26}px, ${glow.y * 26}px)`, transition: "transform .4s ease" }} />

      <div style={{ position: "relative", maxWidth: 1180, margin: "0 auto", padding: "0 40px" }}>
        {/* Nav */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "26px 0", borderBottom: `1px solid ${T.borderD}` }}>
          <Wordmark tone="light" size={22} />
          <nav style={{ display: "flex", alignItems: "center", gap: 30, fontSize: 13.5, color: T.mutedD }}>
            <a href="#how" style={{ color: T.mutedD, textDecoration: "none" }}>How it works</a>
            <a href="#codes" style={{ color: T.mutedD, textDecoration: "none" }}>Codes covered</a>
            <Link href="/history" style={{ color: T.mutedD, textDecoration: "none" }}>History</Link>
            <a href="/upload" style={ctaPill}>Upload a DBR</a>
          </nav>
        </header>

        {/* Hero */}
        <section style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 56, alignItems: "center", padding: "76px 0 88px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 13px", border: `1px solid ${T.borderD}`, borderRadius: 999, fontFamily: T.mono, fontSize: 11, color: T.mutedD, letterSpacing: "0.08em", marginBottom: 28 }}>
              <StatusDot color={T.cyan} /> CODE CHECKS · 8 IS CODES · WITH CITATIONS
            </div>
            <h1 style={{ fontFamily: T.serif, fontSize: 62, lineHeight: 1.06, letterSpacing: "-0.02em", margin: 0, fontWeight: 400 }}>
              Validate a Design&nbsp;Basis Report against IS&nbsp;codes —<br />
              <span style={{ color: T.cyan, fontStyle: "italic" }}>in seconds, with citations.</span>
            </h1>
            <p style={{ fontSize: 17, color: T.mutedD, lineHeight: 1.6, maxWidth: 480, marginTop: 26 }}>
              Upload a DBR. We extract the building basis, run the code checks, and return a findings report — each verdict backed by the exact IS clause, table and page.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 36 }}>
              <a href="/upload" style={ctaBig}>
                <Icon.Upload size={18} color={T.navy} /> Upload a DBR
              </a>
              <span style={{ fontFamily: T.mono, fontSize: 12, color: T.mutedD }}>PDF · ~few&nbsp;s · private</span>
            </div>
          </div>
          <HeroPreview onPointer={(x, y) => setGlow({ x, y })} />
        </section>

        {/* How it works */}
        <SectionLabel n="01" title="How it works" id="how" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 22, margin: "34px 0 96px" }}>
          {[
            { n: "01", t: "Upload", d: "Drop the Design Basis Report PDF. Processed in your session.", ic: "Upload" as const },
            { n: "02", t: "Extract", d: "We read the building basis — material, system, height, zone, foundation — fully editable.", ic: "Layers" as const },
            { n: "03", t: "Cited checks", d: "Each finding gets a verdict, expected-vs-found, and the exact IS clause to defend it.", ic: "Shield" as const },
          ].map((s, i) => <HiwCard key={s.n} {...s} delay={i * 0.08} />)}
        </div>

        {/* Codes covered */}
        <SectionLabel n="02" title="Codes covered" id="codes" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, margin: "34px 0 28px" }}>
          {CODES.map((c, i) => <CodeChip key={c.code} c={c} i={i} />)}
        </div>
        <p style={{ fontFamily: T.mono, fontSize: 12, color: T.mutedD, marginBottom: 96 }}>
          IS 456 · IS 1893 · IS 13920 · IS 875-3/5 · IS 16700 · IS 269 · NBC 2016 — and growing.
        </p>

        {/* CTA band */}
        <section style={{ position: "relative", borderRadius: 22, overflow: "hidden", border: `1px solid ${T.borderD}`, padding: "54px 48px", marginBottom: 64, background: `linear-gradient(120deg, ${T.surface}, ${T.navy})` }}>
          <GridBg color="rgba(255,255,255,0.03)" step={28} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontFamily: T.serif, fontSize: 38, margin: 0, fontWeight: 400, letterSpacing: "-0.01em" }}>
                Stop cross-checking PDFs by hand.
              </h2>
              <p style={{ color: T.mutedD, fontSize: 15.5, marginTop: 12, maxWidth: 520, lineHeight: 1.55 }}>
                A reviewer-ready report in the time it takes to make chai. Try it on a sample DBR.
              </p>
            </div>
            <a href="/upload" style={ctaBig}>
              Upload a DBR <Icon.Arrow size={17} color={T.navy} />
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: `1px solid ${T.borderD}`, padding: "30px 0 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Wordmark tone="light" size={18} />
          <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: T.mono, fontSize: 11, color: T.mutedD }}>
            <Link href="/admin" style={{ color: T.mutedD, textDecoration: "none" }}>Admin</Link>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><StatusDot color="#0E9F6E" /> A CivilSpace feature · v0.4.1</span>
          </div>
        </footer>
      </div>
    </div>
  );
}

// NOTE: these are used on <Link> (real <a href="/upload">) so the Upload CTAs work
// on plain click even before/without JS hydration — never a dead <button onClick>.
const ctaPill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", textDecoration: "none",
  padding: "9px 18px", borderRadius: 999, background: T.cyan, color: T.navy,
  fontWeight: 600, fontSize: 13.5, border: "none", cursor: "pointer", fontFamily: T.sans,
  boxShadow: `0 0 0 1px ${T.cyan}66, 0 10px 24px -10px ${T.cyan}`,
};
const ctaBig: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 10, padding: "15px 26px", textDecoration: "none",
  borderRadius: 12, background: T.cyan, color: T.navy, fontWeight: 600, fontSize: 15.5,
  border: "none", cursor: "pointer", fontFamily: T.sans, boxShadow: `0 14px 34px -14px ${T.cyan}`,
};

function SectionLabel({ n, title, id }: { n: string; title: string; id?: string }) {
  return (
    <div id={id} style={{ display: "flex", alignItems: "baseline", gap: 16, scrollMarginTop: 80 }}>
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.cyan, letterSpacing: "0.18em" }}>§{n}</span>
      <h2 style={{ fontFamily: T.serif, fontSize: 34, color: T.textD, margin: 0, fontWeight: 400, letterSpacing: "-0.01em" }}>{title}</h2>
    </div>
  );
}

function HiwCard({ n, t, d, ic, delay }: { n: string; t: string; d: string; ic: keyof typeof Icon; delay: number }) {
  const [h, setH] = React.useState(false);
  const IconC = Icon[ic];
  const tilt = useTilt({ max: 8, lift: 14, scale: 1.02 });
  return (
    <div ref={tilt.ref}
      onMouseMove={tilt.handlers.onMouseMove}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); tilt.handlers.onMouseLeave(); }}
      style={{ background: T.surface, border: `1px solid ${h ? `${T.cyan}55` : T.borderD}`, borderRadius: 16, padding: 26, position: "relative", boxShadow: h ? "0 24px 44px -22px rgba(0,0,0,0.6)" : "none", animation: `dbr-fade-up .5s ${delay}s both`, ...tilt.style }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: `${T.cyan}14`, border: `1px solid ${T.cyan}3a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <IconC size={20} color={T.cyan} />
        </div>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mutedD, letterSpacing: "0.18em" }}>STEP {n}</span>
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 23, color: T.textD, marginTop: 20 }}>{t}</div>
      <div style={{ fontSize: 13.5, color: T.mutedD, marginTop: 10, lineHeight: 1.55 }}>{d}</div>
    </div>
  );
}

function CodeChip({ c, i }: { c: { code: string; year: string; title: string }; i: number }) {
  const [h, setH] = React.useState(false);
  const tilt = useTilt({ max: 10, lift: 8 });
  return (
    <div ref={tilt.ref}
      onMouseMove={tilt.handlers.onMouseMove}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => { setH(false); tilt.handlers.onMouseLeave(); }}
      style={{ background: T.surface, border: `1px solid ${h ? `${T.cyan}55` : T.borderD}`, borderRadius: 12, padding: "16px 16px", cursor: "default", animation: `dbr-fade-up .45s ${i * 0.04}s both`, ...tilt.style }}>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.cyan, letterSpacing: "0.06em" }}>
        {c.code} <span style={{ color: T.mutedD }}>: {c.year}</span>
      </div>
      <div style={{ fontSize: 13.5, color: T.textD, marginTop: 8, lineHeight: 1.35 }}>{c.title}</div>
    </div>
  );
}

function HeroPreview({ onPointer }: { onPointer?: (x: number, y: number) => void }) {
  const counts = { FLAW: 3, MISSING: 4, REVIEW: 5, PASS: 11, NOT_APPLICABLE: 2 } as const;
  const [show, setShow] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setShow(true), 300); return () => clearTimeout(t); }, []);
  const total = useCountUp(25, { start: show, duration: 1100 });
  const tilt = useTilt({ max: 7, lift: 10 });
  // forward the pointer fraction to the parent for the glow parallax
  React.useEffect(() => { onPointer?.(tilt.px, tilt.py); }, [tilt.px, tilt.py, onPointer]);
  return (
    <div style={{ position: "relative", perspective: 1000, animation: "dbr-fade-up .6s .1s both" }}>
      <div ref={tilt.ref} {...tilt.handlers} style={{ background: T.surface, border: `1px solid ${T.borderD}`, borderRadius: 18, boxShadow: "0 40px 90px -40px rgba(0,0,0,0.8)", overflow: "hidden", ...tilt.style }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 16px", borderBottom: `1px solid ${T.borderD}`, fontFamily: T.mono, fontSize: 11, color: T.mutedD }}>
          <span style={{ width: 8, height: 8, borderRadius: 9, background: "#E11D48", opacity: 0.6 }} />
          <span style={{ width: 8, height: 8, borderRadius: 9, background: "#E08A00", opacity: 0.6 }} />
          <span style={{ width: 8, height: 8, borderRadius: 9, background: "#0E9F6E", opacity: 0.6 }} />
          <span style={{ marginLeft: 10 }}>findings · DBR-MH-TB-R2.pdf</span>
        </div>
        <div style={{ padding: "22px 22px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontFamily: T.serif, fontSize: 50, color: T.textD, lineHeight: 1 }}>{total}</span>
            <span style={{ fontSize: 13.5, color: T.mutedD }}>checks complete</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 6, fontFamily: T.mono, fontSize: 11.5, color: "#FB7185" }}>
            <VIcon name="alert" size={13} color="#FB7185" /> 3 flaws need your attention
          </div>
          <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden", marginTop: 20, border: `1px solid ${T.borderD}` }}>
            {VERDICT_ORDER.map((k, i) => (
              <div key={k} style={{ width: `${(counts[k] / 25) * 100}%`, background: VERDICTS[k].solid, opacity: show ? 1 : 0, transition: `opacity .5s ${0.4 + i * 0.1}s` }} />
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginTop: 18 }}>
            {VERDICT_ORDER.map((k, i) => <ChipMini key={k} vk={k} n={counts[k]} show={show} delay={0.5 + i * 0.09} />)}
          </div>
          <div style={{ marginTop: 18, padding: "13px 14px", background: "rgba(225,29,72,0.08)", border: `1px solid ${VERDICTS.FLAW.line}`, borderRadius: 12, animation: show ? "dbr-pop-in .5s 1s both" : "none", opacity: show ? 1 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <VerdictBadge verdict="FLAW" size="sm" animate={false} />
              <span style={{ fontFamily: T.mono, fontSize: 11, color: T.mutedD }}>D03</span>
              <span style={{ fontSize: 12.5, color: T.textD }}>Nominal cover, severe exposure</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 10, fontFamily: T.mono, fontSize: 12 }}>
              <span style={{ color: T.mutedD }}>exp <span style={{ color: T.textD }}>≥ 45 mm</span></span>
              <span style={{ color: "#FB7185" }}>found <span style={{ color: "#FB7185" }}>30 mm</span></span>
            </div>
          </div>
        </div>
      </div>
      {/* badge floats above the card on the Z axis (outer = depth, inner = bob,
          so the float animation's translateY doesn't clobber translateZ) */}
      <div style={{ position: "absolute", bottom: 16, right: -14, transform: "translateZ(60px)", transformStyle: "preserve-3d", pointerEvents: "none" }}>
        <div style={{ padding: "6px 12px", background: T.cyan, color: T.navy, borderRadius: 999, fontFamily: T.mono, fontSize: 11, fontWeight: 600, boxShadow: `0 10px 26px -10px ${T.cyan}`, animation: "float 4s ease-in-out infinite" }}>
          IS 456 · Table 16
        </div>
      </div>
    </div>
  );
}

function ChipMini({ vk, n, show, delay }: { vk: keyof typeof VERDICTS; n: number; show: boolean; delay: number }) {
  const v = VERDICTS[vk];
  const val = useCountUp(n, { start: show, duration: 800 });
  return (
    <div style={{ background: T.navy, border: `1px solid ${T.borderD}`, borderRadius: 10, padding: "10px 8px", textAlign: "center", animation: show ? `dbr-pop-in .45s ${delay}s both` : "none", opacity: show ? 1 : 0 }}>
      <div style={{ fontFamily: T.serif, fontSize: 24, color: v.solid, lineHeight: 1 }}>{val}</div>
      <div style={{ fontFamily: T.mono, fontSize: 8.5, color: T.mutedD, letterSpacing: "0.08em", marginTop: 5 }}>{v.label.toUpperCase()}</div>
    </div>
  );
}

"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { prefersReducedMotion } from "@/lib/use3d";

/**
 * A cyan "blueprint curtain" that wipes across the screen on every route change,
 * then reveals the new page underneath — the page-transition from the design
 * artifact. Pure CSS (scaleY wipe), no library. Mounted once in the root layout
 * as a standalone sibling overlay (it does NOT wrap the page content, so it can
 * never affect a page's hydration or intercept its clicks).
 *
 * This effect runs AFTER the new route has rendered, so the curtain plays as a
 * single reveal sweep: it appears fully covering the viewport (no transition),
 * then on the next frame lifts away (scaleY 1 -> 0 from the top) to reveal the
 * new page. Skipped under reduced-motion and on the very first load.
 */
export function RouteTransition() {
  const pathname = usePathname();
  // "cover" = fully over the page (instant), "lift" = animating away, "idle" = gone.
  const [phase, setPhase] = React.useState<"idle" | "cover" | "lift">("idle");
  const prev = React.useRef<string | null>(null);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);

  React.useEffect(() => {
    if (prev.current === null) { prev.current = pathname; return; }
    if (prev.current === pathname) return;
    prev.current = pathname;
    if (prefersReducedMotion()) return;

    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("cover");
    // next frame: start lifting the curtain away
    timers.current.push(setTimeout(() => setPhase("lift"), 60));
    // after the lift transition completes, hide the overlay
    timers.current.push(setTimeout(() => setPhase("idle"), 60 + 620));
    // hard safety net: whatever happens, force idle so the curtain can never
    // linger over the page (it's pointer-events:none anyway, but be safe).
    timers.current.push(setTimeout(() => setPhase("idle"), 1500));
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [pathname]);

  const curtain: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 90,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#0A1628",
    // The wipe is purely decorative — it must NEVER intercept clicks, so it stays
    // pointer-events:none in every phase. This guarantees it can't trap the page.
    pointerEvents: "none",
    transformOrigin: "top",
    transform: phase === "lift" ? "scaleY(0)" : "scaleY(1)",
    transition: phase === "lift" ? "transform .58s cubic-bezier(.76,0,.24,1)" : "none",
  };

  // Don't render anything until a navigation actually triggers the wipe — keeps
  // the overlay out of the DOM entirely on first paint.
  if (phase === "idle") return null;

  return (
    <div aria-hidden style={curtain}>
      {/* cyan blueprint grid + LOADING mark, matching the landing's dark theme */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(34,211,238,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.07) 1px,transparent 1px)", backgroundSize: "34px 34px" }} />
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M6 3 H14 L18 7 V21 H6 Z" stroke="#F1F5F9" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M14 3 V7 H18" stroke="#F1F5F9" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M9 16.2 l2 2 3.4 -4.4" stroke="#22D3EE" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 10, color: "#22D3EE", letterSpacing: "0.3em", animation: "dbr-blink 1s ease-in-out infinite" }}>LOADING</div>
      </div>
    </div>
  );
}

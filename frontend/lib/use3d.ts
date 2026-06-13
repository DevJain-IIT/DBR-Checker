"use client";

import React from "react";
import { T } from "@/lib/design";

/**
 * Lightweight CSS-3D helpers for the landing + upload pages. No 3D library —
 * pure transform/opacity so it stays GPU-friendly and SSR-safe. Nothing here is
 * imported by the report/flaws pages.
 */

// SSR-guarded check. The globals.css reduced-motion block only neutralises CSS
// *animations*, not JS-driven inline transforms — so JS tilt must opt out itself.
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface TiltOptions {
  max?: number;   // max rotation in degrees
  lift?: number;  // translateZ in px while pointer is over the element
  scale?: number; // scale while active
}

interface TiltState {
  rx: number;
  ry: number;
  px: number;   // pointer offset from center, [-0.5, 0.5] — useful for parallax
  py: number;
  active: boolean;
}

/**
 * Pointer-driven 3D tilt. Spread `style` onto the element, `handlers` for the
 * mouse events, and put `ref` on the same element. `px`/`py` expose the raw
 * pointer fraction so a caller can parallax a sibling (e.g. a glow).
 *
 *   const tilt = useTilt({ max: 8, lift: 14 });
 *   <div ref={tilt.ref} {...tilt.handlers} style={{ ...base, ...tilt.style }} />
 */
export function useTilt({ max = 8, lift = 12, scale = 1 }: TiltOptions = {}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const raf = React.useRef<number | null>(null);
  const [reduced, setReduced] = React.useState(false);
  const [t, setT] = React.useState<TiltState>({ rx: 0, ry: 0, px: 0, py: 0, active: false });

  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => {
      mq.removeEventListener?.("change", sync);
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  const onMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (reduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = Math.max(-0.5, Math.min(0.5, (e.clientX - (rect.left + rect.width / 2)) / rect.width));
    const py = Math.max(-0.5, Math.min(0.5, (e.clientY - (rect.top + rect.height / 2)) / rect.height));
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      setT({ rx: -(py * 2) * max, ry: (px * 2) * max, px, py, active: true });
    });
  }, [reduced, max]);

  const onMouseLeave = React.useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    setT({ rx: 0, ry: 0, px: 0, py: 0, active: false });
  }, []);

  const style: React.CSSProperties = reduced
    ? {}
    : {
        transform: `perspective(900px) rotateX(${t.rx}deg) rotateY(${t.ry}deg) translateZ(${t.active ? lift : 0}px) scale(${t.active ? scale : 1})`,
        transformStyle: "preserve-3d",
        transition: t.active ? "none" : `transform .5s ${T.spring}`,
        willChange: "transform",
      };

  return { ref, style, handlers: { onMouseMove, onMouseLeave }, px: t.px, py: t.py, reduced };
}

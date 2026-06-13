"use client";

import React from "react";
import type { DBRData } from "@/lib/types";
import { getPath, setPath } from "@/components/ExtractedPanel";
import { OPTIONS, STEPS, DERIVE, COVER_ELEMENTS, GRADE_ELEMENTS } from "@/lib/fieldOptions";
import type { ControlDef } from "@/lib/checkInputs";
import { T, VERDICTS } from "@/lib/design";

/**
 * One IS-code-valid input for a flaw card. Renders dropdown / stepper /
 * per-element dict / boolean / text per the descriptor, and emits the next
 * full DBRData via onChange (built with the shared setPath).
 */
export function FixControl({ def, working, onChange }: {
  def: ControlDef;
  working: DBRData;
  onChange: (next: DBRData) => void;
}) {
  const set = (value: unknown) => onChange(setPath(working, def.path, value));

  if (def.kind === "dropdown") {
    return <Dropdown label={def.label} options={OPTIONS[def.optionsKey || ""] || []}
      value={getPath(working, def.path)} onSet={set} />;
  }
  if (def.kind === "stepper") {
    const derived = def.derive ? DERIVE[def.derive]?.(working.profile as unknown as Record<string, unknown>) : null;
    return <Stepper label={def.label} step={STEPS[def.stepKey || ""]}
      value={getPath(working, def.path) as number | null} onSet={set} suggested={derived ?? undefined} />;
  }
  if (def.kind === "boolean") {
    return <BoolSeg label={def.label} value={getPath(working, def.path) as boolean | null} onSet={set} />;
  }
  if (def.kind === "text") {
    return <TextField label={def.label} value={getPath(working, def.path) as string | null} onSet={set} />;
  }
  if (def.kind === "dict-stepper" || def.kind === "dict-dropdown") {
    const elements = def.elementsKey === "grade" ? GRADE_ELEMENTS : COVER_ELEMENTS;
    return <DictControl def={def} working={working} onChange={onChange} elements={elements} />;
  }
  return null;
}

// --------------------------------------------------------------------------- //
const labelStyle: React.CSSProperties = { fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.06em", marginBottom: 6, display: "block" };
const wrap: React.CSSProperties = { background: T.sand, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 12px" };

function Dropdown({ label, options, value, onSet }: {
  label: string; options: { value: string | number; label: string; note?: string }[];
  value: unknown; onSet: (v: unknown) => void;
}) {
  const cur = value == null ? "" : String(value);
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <select value={cur} onChange={(e) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        onSet(opt ? opt.value : null);
      }} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.sans, fontSize: 14, color: cur ? T.ink : T.subtle, cursor: "pointer" }}>
        <option value="">— select —</option>
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>{o.label}{o.note ? `  (${o.note})` : ""}</option>
        ))}
      </select>
    </div>
  );
}

function Stepper({ label, step, value, onSet, suggested }: {
  label: string; step: { min: number; max: number; step: number; unit?: string; decimals?: number };
  value: number | null; onSet: (v: number | null) => void; suggested?: number;
}) {
  const s = step || { min: 0, max: 1e9, step: 1 };
  const fmt = (n: number) => (s.decimals != null ? n.toFixed(s.decimals) : String(n));
  const clamp = (n: number) => Math.min(s.max, Math.max(s.min, n));
  const bump = (dir: 1 | -1) => onSet(clamp(Number(((value ?? 0) + dir * s.step).toFixed(6))));
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label.toUpperCase()}{s.unit ? ` (${s.unit})` : ""}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => bump(-1)} style={stepBtn}>−</button>
        <input inputMode="decimal" value={value == null ? "" : fmt(value)} placeholder="—"
          onChange={(e) => { const n = parseFloat(e.target.value); onSet(e.target.value.trim() === "" || Number.isNaN(n) ? null : n); }}
          onBlur={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onSet(clamp(n)); }}
          style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "8px 6px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.mono, fontSize: 14, fontWeight: 600, color: T.ink }} />
        <button onClick={() => bump(1)} style={stepBtn}>+</button>
      </div>
      {suggested != null && value !== suggested && (
        <button onClick={() => onSet(suggested)} style={{ marginTop: 7, fontFamily: T.mono, fontSize: 10.5, color: T.cyanDeep, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
          use correct value: {fmt(suggested)}
        </button>
      )}
    </div>
  );
}
const stepBtn: React.CSSProperties = { width: 32, height: 32, flexShrink: 0, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: "pointer", fontSize: 18, lineHeight: 1, color: T.ink, fontWeight: 600 };

function BoolSeg({ label, value, onSet }: { label: string; value: boolean | null; onSet: (v: boolean | null) => void }) {
  const opts: [string, boolean | null][] = [["Yes", true], ["No", false], ["—", null]];
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <div style={{ display: "flex", gap: 6 }}>
        {opts.map(([lbl, v]) => {
          const active = value === v;
          return (
            <button key={lbl} onClick={() => onSet(v)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${active ? T.cyan : T.border}`, background: active ? `${T.cyan}18` : T.panel, color: active ? T.cyanDeep : T.muted, fontFamily: T.sans, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{lbl}</button>
          );
        })}
      </div>
    </div>
  );
}

function TextField({ label, value, onSet }: { label: string; value: string | null; onSet: (v: string | null) => void }) {
  return (
    <div style={wrap}>
      <label style={labelStyle}>{label.toUpperCase()}</label>
      <input value={value ?? ""} placeholder="—"
        onChange={(e) => onSet(e.target.value.trim() === "" ? null : e.target.value)}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.sans, fontSize: 14, color: T.ink }} />
    </div>
  );
}

// Per-element dict (concrete_grades / nominal_cover_mm): one row per element,
// editing one entry leaves the others intact.
function DictControl({ def, working, onChange, elements }: {
  def: ControlDef; working: DBRData; onChange: (next: DBRData) => void; elements: string[];
}) {
  const dict = (getPath(working, def.path) as Record<string, number> | null) || {};
  // union of present keys + canonical elements so missing-but-expected entries show
  const keys = Array.from(new Set([...Object.keys(dict), ...elements]));
  const options = def.kind === "dict-dropdown" ? (OPTIONS[def.optionsKey || ""] || []) : null;
  const step = def.kind === "dict-stepper" ? STEPS[def.stepKey || ""] : null;

  const setElem = (el: string, value: number | null) => {
    const next = { ...dict };
    if (value == null) delete next[el]; else next[el] = value;
    onChange(setPath(working, def.path, next));
  };

  return (
    <div style={wrap}>
      <label style={labelStyle}>{def.label.toUpperCase()} — BY ELEMENT</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {keys.map((el) => (
          <div key={el} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 92, fontSize: 12, color: T.muted, textTransform: "capitalize" }}>{el}</span>
            {options ? (
              <select value={dict[el] == null ? "" : String(dict[el])} onChange={(e) => setElem(el, e.target.value === "" ? null : Number(e.target.value))}
                style={{ flex: 1, padding: "6px 8px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.sans, fontSize: 13, color: dict[el] != null ? T.ink : T.subtle }}>
                <option value="">—</option>
                {options.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
              </select>
            ) : (
              <ElemStepper step={step!} value={dict[el] ?? null} onSet={(v) => setElem(el, v)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ElemStepper({ step, value, onSet }: { step: { min: number; max: number; step: number; unit?: string; decimals?: number }; value: number | null; onSet: (v: number | null) => void }) {
  const clamp = (n: number) => Math.min(step.max, Math.max(step.min, n));
  const fmt = (n: number) => (step.decimals != null ? n.toFixed(step.decimals) : String(n));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
      <button onClick={() => onSet(clamp(Number(((value ?? 0) - step.step).toFixed(6))))} style={{ ...stepBtn, width: 28, height: 28, fontSize: 16 }}>−</button>
      <input inputMode="decimal" value={value == null ? "" : fmt(value)} placeholder="—"
        onChange={(e) => { const n = parseFloat(e.target.value); onSet(e.target.value.trim() === "" || Number.isNaN(n) ? null : n); }}
        style={{ flex: 1, minWidth: 0, textAlign: "center", padding: "6px 4px", borderRadius: 7, border: `1px solid ${T.border}`, background: T.panel, fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: T.ink }} />
      <button onClick={() => onSet(clamp(Number(((value ?? 0) + step.step).toFixed(6))))} style={{ ...stepBtn, width: 28, height: 28, fontSize: 16 }}>+</button>
      {step.unit && <span style={{ fontFamily: T.mono, fontSize: 10, color: T.subtle }}>{step.unit}</span>}
    </div>
  );
}

"use client";

import React from "react";
import type { DBRData } from "@/lib/types";
import { Icon, T, VERDICTS } from "@/lib/design";
import { FIELD_CONTROLS, type FieldControl } from "@/lib/fieldControls";
import { OPTIONS, STEPS } from "@/lib/fieldOptions";

// Exported so the guided-fix controls (FixControl/FlawCard) reuse the exact
// same immutable path get/set logic.
export function getPath(obj: DBRData, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => (acc == null ? acc : (acc as Record<string, unknown>)[key]), obj);
}

export function setPath(obj: DBRData, path: string, value: unknown): DBRData {
  const next = structuredClone(obj);
  const keys = path.split(".");
  let cur: Record<string, unknown> = next as unknown as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    // create intermediate objects if missing (e.g. title_block.* when title_block is {})
    if (cur[keys[i]] == null || typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
    cur = cur[keys[i]] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return next;
}

export function ExtractedPanel({ data, onChange, onRerun, rerunning, dirty }: {
  data: DBRData; onChange: (d: DBRData) => void; onRerun: () => void; rerunning: boolean; dirty: boolean;
}) {
  const [open, setOpen] = React.useState(true);

  return (
    <div className="no-print" style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 0 rgba(10,22,40,0.02)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderBottom: open ? `1px solid ${T.border}` : "none" }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${T.indigo}14`, border: `1px solid ${T.indigo}3a`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon.Layers size={16} color={T.indigo} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Extracted building basis</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.cyanDeep, background: `${T.cyan}14`, border: `1px solid ${T.cyan}40`, borderRadius: 5, padding: "2px 7px", letterSpacing: "0.06em" }}>ASSISTIVE · EDITABLE</span>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>What we read from the DBR. Correct anything, then re-run the checks.</div>
        </div>
        {dirty && !rerunning && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: T.mono, fontSize: 11, color: VERDICTS.REVIEW.fg, animation: "dbr-fade-in .3s both" }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: VERDICTS.REVIEW.solid }} /> edited
          </span>
        )}
        <button onClick={onRerun} disabled={rerunning} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 15px", borderRadius: 10, border: "none", cursor: rerunning ? "default" : "pointer", fontFamily: T.sans, fontSize: 13, fontWeight: 600, background: dirty ? T.cyan : T.sand, color: dirty ? T.navy : T.muted, boxShadow: dirty ? `0 10px 24px -14px ${T.cyan}` : "none", transition: `all .2s ${T.spring}` }}>
          <span style={{ display: "flex", animation: rerunning ? "spin .8s linear infinite" : "none" }}>
            <Icon.Refresh size={15} color={dirty ? T.navy : T.muted} />
          </span>
          {rerunning ? "Re-running…" : "Re-run checks"}
        </button>
        <button onClick={() => setOpen((o) => !o)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transform: open ? "none" : "rotate(180deg)", transition: `transform .25s ${T.spring}` }}>
          <Icon.Chevron size={15} color={T.muted} />
        </button>
      </div>

      {open && (
        <div style={{ padding: "18px 20px", position: "relative", animation: "dbr-fade-in .3s both" }}>
          {rerunning && (
            <div style={{ position: "absolute", inset: 0, zIndex: 3, background: "rgba(255,255,255,0.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", background: T.panel, border: `1px solid ${T.cyan}55`, borderRadius: 12, boxShadow: `0 14px 30px -16px ${T.cyan}` }}>
                <span style={{ display: "flex", animation: "spin .8s linear infinite" }}><Icon.Refresh size={18} color={T.cyanDeep} /></span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Re-running checks…</span>
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {FIELD_CONTROLS.map((f) => (
              <FieldCell key={f.path} def={f} value={getPath(data, f.path)} onSet={(v) => onChange(setPath(data, f.path, v))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldCell({ def, value, onSet }: { def: FieldControl; value: unknown; onSet: (v: unknown) => void }) {
  const missing = value === null || value === undefined || value === "";
  const border = missing ? VERDICTS.MISSING.line : T.border;

  return (
    <div style={{ background: T.panel, border: `1px solid ${border}`, borderRadius: 11, padding: "10px 12px 11px", position: "relative", transition: "border-color .18s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.07em" }}>
          {def.label.toUpperCase()}{def.unit ? ` (${def.unit})` : ""}
        </span>
        {missing && <span title="not stated" style={{ width: 6, height: 6, borderRadius: 9, background: VERDICTS.MISSING.solid, flexShrink: 0 }} />}
      </div>

      {def.kind === "dropdown" ? (
        <DropdownInput def={def} value={value} onSet={onSet} missing={missing} />
      ) : def.kind === "number" ? (
        <NumberInput def={def} value={value} onSet={onSet} missing={missing} />
      ) : (
        <TextInput value={value} onSet={onSet} missing={missing} />
      )}
    </div>
  );
}

const fieldBase: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${T.border}`, borderRadius: 8,
  background: T.sand, padding: "8px 10px", fontFamily: T.mono, fontSize: 14, fontWeight: 600,
  color: T.ink, outline: "none",
};

function DropdownInput({ def, value, onSet, missing }: { def: FieldControl; value: unknown; onSet: (v: unknown) => void; missing: boolean }) {
  const opts = OPTIONS[def.optionsKey || ""] || [];
  const cur = missing ? "" : String(value);
  return (
    <select value={cur} onChange={(e) => {
      const o = opts.find((x) => String(x.value) === e.target.value);
      onSet(o ? o.value : null);
    }} style={{ ...fieldBase, fontFamily: T.sans, cursor: "pointer", color: missing ? T.subtle : T.ink }}>
      <option value="">— not stated —</option>
      {opts.map((o) => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
    </select>
  );
}

function NumberInput({ def, value, onSet, missing }: { def: FieldControl; value: unknown; onSet: (v: unknown) => void; missing: boolean }) {
  const step = def.stepKey ? STEPS[def.stepKey] : undefined;
  const commit = (raw: string) => {
    if (raw.trim() === "") { onSet(null); return; }
    let n = parseFloat(raw);
    if (Number.isNaN(n)) { onSet(null); return; }
    if (step) n = Math.min(step.max, Math.max(step.min, n));
    onSet(n);
  };
  return (
    <input type="number" inputMode="decimal" defaultValue={missing ? "" : String(value)} placeholder="—"
      step={step?.step} min={step?.min} max={step?.max}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={fieldBase} />
  );
}

function TextInput({ value, onSet, missing }: { value: unknown; onSet: (v: unknown) => void; missing: boolean }) {
  return (
    <input defaultValue={missing ? "" : String(value)} placeholder="—"
      onBlur={(e) => onSet(e.target.value.trim() === "" ? null : e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      style={{ ...fieldBase, fontFamily: T.sans }} />
  );
}

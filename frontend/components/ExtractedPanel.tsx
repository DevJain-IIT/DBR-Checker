"use client";

import React from "react";
import type { DBRData } from "@/lib/types";
import { Icon, T, VERDICTS } from "@/lib/design";

// Editable field definition: a path into the DBRData (dot for profile.*),
// a label, an optional unit, and how to coerce the edited string back.
interface FieldDef {
  path: string;
  label: string;
  unit?: string;
  type: "string" | "number";
}

const FIELDS: FieldDef[] = [
  { path: "profile.material", label: "Material", type: "string" },
  { path: "profile.structural_system", label: "System", type: "string" },
  { path: "profile.height_m", label: "Height", unit: "m", type: "number" },
  { path: "profile.num_storeys", label: "Storeys", type: "number" },
  { path: "profile.occupancy", label: "Occupancy", type: "string" },
  { path: "profile.seismic_zone", label: "Seismic zone", type: "string" },
  { path: "profile.basic_wind_speed", label: "Wind speed Vb", unit: "m/s", type: "number" },
  { path: "profile.soil_type", label: "Soil type", type: "string" },
  { path: "profile.foundation_type", label: "Foundation", type: "string" },
  { path: "rebar_grade", label: "Rebar grade", type: "string" },
  { path: "cement_type", label: "Cement", type: "string" },
  { path: "exposure_condition", label: "Exposure", type: "string" },
  { path: "zone_factor_Z", label: "Zone factor Z", type: "number" },
  { path: "importance_factor_I", label: "Importance I", type: "number" },
  { path: "response_reduction_R", label: "Reduction R", type: "number" },
  { path: "fundamental_period_s", label: "Period T", unit: "s", type: "number" },
  { path: "seismic_weight_LL_pct", label: "Seismic LL", unit: "%", type: "number" },
  { path: "drift_ratio", label: "Drift ratio", type: "number" },
  { path: "stability_coeff_theta", label: "Stability θ", type: "number" },
  { path: "foundation_depth_m", label: "Foundation depth", unit: "m", type: "number" },
  { path: "fos_overturning", label: "FoS overturn", type: "number" },
  { path: "fos_sliding", label: "FoS sliding", type: "number" },
  { path: "settlement_mm", label: "Settlement", unit: "mm", type: "number" },
  { path: "software_used", label: "Software", type: "string" },
];

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {FIELDS.map((f) => (
              <FieldCell key={f.path} def={f} value={getPath(data, f.path)} onSet={(v) => onChange(setPath(data, f.path, v))} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldCell({ def, value, onSet }: { def: FieldDef; value: unknown; onSet: (v: unknown) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const missing = value === null || value === undefined || value === "";
  const display = missing ? "—" : String(value);

  const commit = (raw: string) => {
    if (raw.trim() === "" || raw.trim() === "—") { onSet(null); return; }
    if (def.type === "number") {
      const n = parseFloat(raw);
      onSet(Number.isNaN(n) ? null : n);
    } else {
      onSet(raw);
    }
  };

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: T.sand, border: `1px solid ${editing ? T.cyan : missing ? VERDICTS.MISSING.line : T.border}`, borderRadius: 10, padding: "11px 13px", position: "relative", transition: "border-color .18s" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: "0.06em" }}>{def.label.toUpperCase()}</span>
        {missing && <span title="not stated" style={{ width: 6, height: 6, borderRadius: 9, background: VERDICTS.MISSING.solid }} />}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 7 }}>
        {editing ? (
          <input autoFocus defaultValue={missing ? "" : String(value)}
            onBlur={(e) => { commit(e.target.value); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { commit((e.target as HTMLInputElement).value); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
            style={{ width: "100%", fontFamily: T.mono, fontSize: 15, fontWeight: 600, color: T.ink, background: T.panel, border: `1px solid ${T.cyan}`, borderRadius: 6, padding: "2px 6px", outline: "none" }} />
        ) : (
          <button onClick={() => setEditing(true)} style={{ display: "inline-flex", alignItems: "baseline", gap: 5, background: "transparent", border: "none", padding: 0, cursor: "text", fontFamily: T.mono, fontSize: 16, fontWeight: 600, color: missing ? T.subtle : T.ink, fontVariantNumeric: "tabular-nums" }}>
            {display}
            {def.unit && !missing && <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>{def.unit}</span>}
            <span style={{ marginLeft: 4, opacity: hover ? 1 : 0, transition: "opacity .15s" }}><Icon.Pencil size={12} color={T.cyanDeep} /></span>
          </button>
        )}
      </div>
    </div>
  );
}

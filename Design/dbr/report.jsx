// ============================================================================
//  DBR Check — Report (the core screen)
//  Summary bar (counts + filters) · editable extracted-data panel ·
//  findings grouped by category · export.
// ============================================================================

function Report({ onBack }) {
  // counts
  const counts = React.useMemo(() => {
    const c = { PASS: 0, FLAW: 0, REVIEW: 0, MISSING: 0, NA: 0 };
    CHECKS.forEach(k => c[k.verdict]++);
    return c;
  }, []);
  const flawTotal = counts.FLAW + counts.MISSING;

  // filter: set of active verdicts (all on by default)
  const [filter, setFilter] = React.useState(() => new Set(Object.keys(VERDICTS)));
  const allOn = filter.size === Object.keys(VERDICTS).length;
  const toggle = (k) => setFilter(prev => {
    const next = new Set(prev);
    if (allOn) { next.clear(); next.add(k); }          // first click isolates
    else if (next.has(k)) { next.delete(k); if (next.size === 0) return new Set(Object.keys(VERDICTS)); }
    else next.add(k);
    return next;
  });
  const resetFilter = () => setFilter(new Set(Object.keys(VERDICTS)));

  // extracted data (editable)
  const [fields, setFields] = React.useState(() => EXTRACTED.map(f => ({ ...f })));
  const [dirty, setDirty] = React.useState(false);
  const [rerunning, setRerunning] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const setField = (id, value) => {
    setFields(fs => fs.map(f => f.id === id ? { ...f, value } : f));
    setDirty(true);
  };
  const rerun = () => {
    setRerunning(true);
    setTimeout(() => { setRerunning(false); setDirty(false); }, 1700);
  };

  // group filtered checks by category (preserve category order from data)
  const visible = CHECKS.filter(c => filter.has(c.verdict));
  const catOrder = [];
  CHECKS.forEach(c => { if (!catOrder.includes(c.cat)) catOrder.push(c.cat); });
  const groups = catOrder
    .map(cat => ({ cat, items: visible.filter(c => c.cat === cat) }))
    .filter(g => g.items.length > 0);

  let runningIndex = 0;

  return (
    <div data-screen-label="03 Report" className="dbr-scroll" style={{
      height: '100%', overflowY: 'auto', background: T.paper, color: T.ink, fontFamily: T.sans,
    }}>
      {/* ---- App chrome ---- */}
      <header style={{ position: 'sticky', top: 0, zIndex: 20, height: 60,
        background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
          <div onClick={onBack} style={{ cursor: 'pointer' }}><Wordmark tone="dark" size={19} showTag={false} /></div>
          <span style={{ width: 1, height: 22, background: T.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Icon.File size={15} color={T.muted} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis' }}>{DBR_META.doc}</span>
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.subtle }}>· {DBR_META.pages}pp</span>
          </div>
        </div>
        <ExportButton flawTotal={flawTotal} />
      </header>

      {/* ---- Summary bar (sticky) ---- */}
      <SummaryBar counts={counts} total={CHECKS.length} flawTotal={flawTotal}
        filter={filter} toggle={toggle} allOn={allOn} resetFilter={resetFilter} />

      {/* ---- Body ---- */}
      <main style={{ maxWidth: 1080, margin: '0 auto', padding: '26px 28px 90px' }}>
        <ExtractedPanel fields={fields} setField={setField} open={panelOpen} setOpen={setPanelOpen}
          dirty={dirty} rerun={rerun} rerunning={rerunning} />

        {/* result line */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          margin: '28px 2px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontFamily: T.serif, fontSize: 24, margin: 0, fontWeight: 400 }}>Findings</h2>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: T.subtle }}>
              {allOn ? `all 25 checks` : `${visible.length} shown`}
            </span>
          </div>
          {!allOn && (
            <button onClick={resetFilter} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 8, border: `1px solid ${T.border}`, background: T.panel, cursor: 'pointer',
              fontSize: 12.5, color: T.muted, fontFamily: T.sans }}>
              <Icon.Close size={13} color={T.muted} /> Clear filter
            </button>
          )}
        </div>

        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.muted }}>No checks match this filter.</div>
        ) : groups.map(g => {
          const start = runningIndex; runningIndex += g.items.length;
          return <CategorySection key={g.cat} cat={g.cat} checks={g.items} startIndex={start} />;
        })}

        <div style={{ textAlign: 'center', fontFamily: T.mono, fontSize: 11, color: T.subtle,
          marginTop: 40, paddingTop: 24, borderTop: `1px solid ${T.border}` }}>
          DBR CHECK · {DBR_META.project} · GENERATED {DBR_META.uploaded.toUpperCase()} · 25 CHECKS · 8 IS CODES
        </div>
      </main>
    </div>
  );
}

// ---- Summary bar -----------------------------------------------------------
function SummaryBar({ counts, total, flawTotal, filter, toggle, allOn, resetFilter }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);
  const passPct = Math.round((counts.PASS / total) * 100);

  return (
    <div style={{ position: 'sticky', top: 60, zIndex: 15,
      background: 'rgba(250,247,242,0.92)', backdropFilter: 'blur(10px)',
      borderBottom: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '16px 28px',
        display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>

        {/* overall status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 50, height: 50 }}>
            <Donut counts={counts} total={total} mounted={mounted} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: T.serif, fontSize: 25, lineHeight: 1 }}>
                {flawTotal > 0 ? `${flawTotal} need attention` : 'All clear'}
              </span>
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, marginTop: 4, letterSpacing: '0.02em' }}>
              {passPct}% PASS · {counts.FLAW} FLAW · {counts.REVIEW} REVIEW · {total} TOTAL
            </div>
          </div>
        </div>

        <div style={{ width: 1, height: 38, background: T.border }} />

        {/* verdict stat chips (also act as filters) */}
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          {VERDICT_ORDER.map((k, i) => (
            <StatChip key={k} vk={k} n={counts[k]} active={filter.has(k)} dim={!allOn && !filter.has(k)}
              onClick={() => toggle(k)} mounted={mounted} delay={i * 0.06} />
          ))}
        </div>

        {/* filter hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: T.mono,
          fontSize: 10.5, color: T.subtle, letterSpacing: '0.04em' }}>
          <Icon.Filter size={13} color={T.subtle} />
          {allOn ? 'TAP A CHIP TO FILTER' : 'FILTERED'}
        </div>
      </div>
    </div>
  );
}

function StatChip({ vk, n, active, dim, onClick, mounted, delay }) {
  const v = VERDICTS[vk];
  const [hover, setHover] = React.useState(false);
  const val = useCountUp(n, { start: mounted, duration: 800 });
  return (
    <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 9, padding: '8px 13px 8px 11px',
        borderRadius: 11, cursor: 'pointer', fontFamily: T.sans,
        background: active ? v.bg : T.panel,
        border: `1px solid ${active ? v.line : T.border}`,
        opacity: dim ? 0.45 : 1,
        transform: hover ? 'translateY(-2px)' : mounted ? 'none' : 'scale(.9)',
        boxShadow: hover ? `0 10px 22px -14px ${v.solid}` : 'none',
        transition: `all .2s ${T.spring}`,
      }}>
      <VIcon name={v.icon} size={15} color={v.solid} />
      <span style={{ fontFamily: T.serif, fontSize: 22, color: v.fg, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{val}</span>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.muted, letterSpacing: '0.08em' }}>{v.label.toUpperCase()}</span>
    </button>
  );
}

// ---- Donut summary ---------------------------------------------------------
function Donut({ counts, total, mounted }) {
  const R = 21, C = 2 * Math.PI * R;
  let offset = 0;
  const segs = VERDICT_ORDER.map(k => {
    const frac = counts[k] / total;
    const seg = { k, dash: frac * C, off: offset, color: VERDICTS[k].solid };
    offset += frac * C;
    return seg;
  });
  return (
    <svg width="50" height="50" viewBox="0 0 50 50" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="25" cy="25" r={R} fill="none" stroke={T.border} strokeWidth="7" />
      {segs.map((s, i) => (
        <circle key={s.k} cx="25" cy="25" r={R} fill="none" stroke={s.color} strokeWidth="7"
          strokeDasharray={`${mounted ? s.dash : 0} ${C}`} strokeDashoffset={-s.off}
          style={{ transition: `stroke-dasharray .8s ${0.2 + i * 0.1}s ${T.spring}` }} />
      ))}
    </svg>
  );
}

// ---- Editable extracted-data panel ----------------------------------------
function ExtractedPanel({ fields, setField, open, setOpen, dirty, rerun, rerunning }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: 16, overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(10,22,40,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
        borderBottom: open ? `1px solid ${T.border}` : 'none' }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${T.indigo}14`,
          border: `1px solid ${T.indigo}3a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.Layers size={16} color={T.indigo} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Extracted building basis</span>
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.cyanDeep, background: `${T.cyan}14`,
              border: `1px solid ${T.cyan}40`, borderRadius: 5, padding: '2px 7px', letterSpacing: '0.06em' }}>
              ASSISTIVE · EDITABLE
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>
            What we read from the DBR. Correct anything, then re-run the checks.
          </div>
        </div>
        {dirty && !rerunning && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: T.mono,
            fontSize: 11, color: VERDICTS.REVIEW.fg, animation: 'dbr-fade-in .3s both' }}>
            <span style={{ width: 7, height: 7, borderRadius: 9, background: VERDICTS.REVIEW.solid }} /> edited
          </span>
        )}
        <button onClick={rerun} disabled={rerunning} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 10,
          border: 'none', cursor: rerunning ? 'default' : 'pointer', fontFamily: T.sans,
          fontSize: 13, fontWeight: 600,
          background: dirty ? T.cyan : T.sand, color: dirty ? T.navy : T.muted,
          boxShadow: dirty ? `0 10px 24px -14px ${T.cyan}` : 'none',
          transition: `all .2s ${T.spring}` }}>
          <span style={{ display: 'flex', animation: rerunning ? 'dbr-spin .8s linear infinite' : 'none' }}>
            <Icon.Refresh size={15} color={dirty ? T.navy : T.muted} />
          </span>
          {rerunning ? 'Re-running…' : 'Re-run checks'}
        </button>
        <button onClick={() => setOpen(o => !o)} style={{ width: 30, height: 30, borderRadius: 8,
          border: `1px solid ${T.border}`, background: T.panel, cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transform: open ? 'none' : 'rotate(180deg)', transition: `transform .25s ${T.spring}` }}>
          <Icon.Chevron size={15} color={T.muted} />
        </button>
      </div>

      {open && (
        <div style={{ padding: '18px 20px', position: 'relative', animation: 'dbr-fade-in .3s both' }}>
          {rerunning && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px',
                background: T.panel, border: `1px solid ${T.cyan}55`, borderRadius: 12,
                boxShadow: `0 14px 30px -16px ${T.cyan}` }}>
                <span style={{ display: 'flex', animation: 'dbr-spin .8s linear infinite' }}>
                  <Icon.Refresh size={18} color={T.cyanDeep} />
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>Re-running 25 checks…</span>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {fields.map(f => <FieldCell key={f.id} f={f} setField={setField} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldCell({ f, setField }) {
  const [editing, setEditing] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const low = f.conf < 0.9;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: T.sand, border: `1px solid ${editing ? T.cyan : low ? VERDICTS.MISSING.line : T.border}`,
        borderRadius: 10, padding: '11px 13px', position: 'relative',
        transition: `border-color .18s` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: '0.06em' }}>
          {f.label.toUpperCase()}
        </span>
        {low && <span title="lower confidence" style={{ width: 6, height: 6, borderRadius: 9,
          background: VERDICTS.MISSING.solid }} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 7 }}>
        {editing ? (
          <input autoFocus value={f.value}
            onChange={e => setField(f.id, e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
            style={{ width: '100%', fontFamily: T.mono, fontSize: 15, fontWeight: 600, color: T.ink,
              background: T.panel, border: `1px solid ${T.cyan}`, borderRadius: 6, padding: '2px 6px',
              outline: 'none' }} />
        ) : (
          <button onClick={() => setEditing(true)} style={{
            display: 'inline-flex', alignItems: 'baseline', gap: 5, background: 'transparent',
            border: 'none', padding: 0, cursor: 'text', fontFamily: T.mono, fontSize: 16,
            fontWeight: 600, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>
            {f.value}
            {f.unit && <span style={{ fontSize: 11, fontWeight: 400, color: T.muted }}>{f.unit}</span>}
            <span style={{ marginLeft: 4, opacity: hover ? 1 : 0, transition: 'opacity .15s' }}>
              <Icon.Pencil size={12} color={T.cyanDeep} />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Export button + menu --------------------------------------------------
function ExportButton({ flawTotal }) {
  const [open, setOpen] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const fire = (label) => { setOpen(false); setToast(label); setTimeout(() => setToast(null), 2400); };
  const items = [
    { ic: 'Print', t: 'Print reviewer report', d: 'Summary + findings + citations' },
    { ic: 'Download', t: 'Download PDF', d: 'Formatted, paginated' },
    { ic: 'File', t: 'Export CSV', d: 'One row per check' },
  ];
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 9, padding: '10px 16px', borderRadius: 10,
        border: 'none', cursor: 'pointer', fontFamily: T.sans, fontSize: 13.5, fontWeight: 600,
        background: T.ink, color: T.textD, boxShadow: '0 10px 24px -16px rgba(10,22,40,0.7)',
        transition: `transform .18s ${T.spring}` }}
        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
        <Icon.Download size={16} color={T.textD} /> Export
        <Icon.Chevron size={13} color={T.mutedD} />
      </button>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 270, zIndex: 40,
          background: T.panel, border: `1px solid ${T.border}`, borderRadius: 14, padding: 8,
          boxShadow: '0 28px 60px -28px rgba(10,22,40,0.5)', animation: `dbr-pop-in .26s ${T.spring} both` }}>
          {items.map(it => {
            const C = Icon[it.ic];
            return (
              <button key={it.t} onClick={() => fire(it.t)} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
                borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer',
                textAlign: 'left', fontFamily: T.sans }}
                onMouseEnter={e => e.currentTarget.style.background = T.sand}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: T.sand, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <C size={16} color={T.cyanDeep} />
                </div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{it.t}</div>
                  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 1 }}>{it.d}</div>
                </div>
              </button>
            );
          })}
          <div style={{ padding: '9px 12px 6px', borderTop: `1px solid ${T.border}`, marginTop: 4,
            fontFamily: T.mono, fontSize: 10.5, color: T.subtle, letterSpacing: '0.04em' }}>
            {flawTotal} ITEM{flawTotal === 1 ? '' : 'S'} FLAGGED · INCLUDED IN REPORT
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', zIndex: 60,
          display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 18px',
          background: T.ink, color: T.textD, borderRadius: 12, fontSize: 13.5, fontWeight: 500,
          boxShadow: '0 20px 44px -20px rgba(10,22,40,0.7)', animation: `dbr-pop-in .3s ${T.spring} both`,
          whiteSpace: 'nowrap' }}>
          <VIcon name="check" size={16} color={T.cyan} /> {toast} — preparing…
        </div>
      )}
    </div>
  );
}

window.Report = Report;

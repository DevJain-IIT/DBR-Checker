// ============================================================================
//  DBR Check — Finding card + citation drawer + category section
// ============================================================================

function FindingCard({ check, index, defaultOpen }) {
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [hover, setHover] = React.useState(false);
  const v = VERDICTS[check.verdict];
  const flagged = check.verdict === 'FLAW' || check.verdict === 'MISSING';

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: T.panel, borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${open ? v.line : hover ? '#DAD4C8' : T.border}`,
        borderLeft: `3px solid ${v.solid}`,
        boxShadow: hover ? '0 18px 38px -26px rgba(10,22,40,0.4)' : '0 1px 0 rgba(10,22,40,0.02)',
        transform: hover && !open ? 'translateY(-2px)' : 'none',
        transition: `border-color .2s, box-shadow .25s, transform .2s ${T.spring}`,
        animation: `dbr-fade-up .4s ${Math.min(index * 0.03, 0.4)}s both`,
      }}>
      {/* header */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '16px 18px', background: 'transparent', border: 'none', cursor: 'pointer',
        textAlign: 'left', fontFamily: T.sans,
      }}>
        <div style={{ flexShrink: 0, paddingTop: 1 }}>
          <VerdictBadge verdict={check.verdict} size="sm" animate={false} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: T.mono, fontSize: 12, color: v.fg, fontWeight: 600 }}>{check.id}</span>
            <span style={{ fontSize: 14.5, fontWeight: 600, color: T.ink }}>{check.title}</span>
            <SevTag sev={check.sev} />
          </div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 6, lineHeight: 1.5, maxWidth: 760 }}>
            {check.summary}
          </div>
          {/* expected vs found */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <EvfCell label="EXPECTED" value={check.expected} tone="neutral" />
            <EvfCell label="FOUND" value={check.found} tone={flagged ? 'bad' : check.verdict === 'REVIEW' ? 'warn' : 'good'} />
          </div>
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: open ? `${T.cyan}14` : 'transparent',
            transform: open ? 'rotate(180deg)' : 'none', transition: `transform .25s ${T.spring}` }}>
            <Icon.Chevron size={16} color={open ? T.cyanDeep : T.subtle} />
          </div>
          <span style={{ fontFamily: T.mono, fontSize: 10, color: T.subtle, letterSpacing: '0.04em',
            whiteSpace: 'nowrap' }}>{open ? 'HIDE' : 'CITE'}</span>
        </div>
      </button>

      {/* citation drawer */}
      {open && <CitationDrawer check={check} />}
    </div>
  );
}

function EvfCell({ label, value, tone }) {
  const map = {
    neutral: { c: T.ink,            bg: T.sand,                 b: T.border },
    good:    { c: VERDICTS.PASS.fg, bg: VERDICTS.PASS.bg,       b: VERDICTS.PASS.line },
    bad:     { c: VERDICTS.FLAW.fg, bg: VERDICTS.FLAW.bg,       b: VERDICTS.FLAW.line },
    warn:    { c: VERDICTS.REVIEW.fg, bg: VERDICTS.REVIEW.bg,   b: VERDICTS.REVIEW.line },
  }[tone];
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 12px',
      background: map.bg, border: `1px solid ${map.b}`, borderRadius: 9 }}>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: '0.1em' }}>{label}</span>
      <span style={{ fontFamily: T.mono, fontSize: 13, fontWeight: 600, color: map.c, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  );
}

function SevTag({ sev }) {
  const map = {
    critical: { t: 'CRITICAL', c: VERDICTS.FLAW.fg, b: VERDICTS.FLAW.line, bg: VERDICTS.FLAW.bg },
    major:    { t: 'MAJOR',    c: VERDICTS.REVIEW.fg, b: VERDICTS.REVIEW.line, bg: VERDICTS.REVIEW.bg },
    minor:    { t: 'MINOR',    c: T.muted, b: T.border, bg: T.sand },
    info:     { t: 'INFO',     c: T.subtle, b: T.border, bg: 'transparent' },
  }[sev];
  if (sev === 'info') return null;
  return (
    <span style={{ fontFamily: T.mono, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em',
      color: map.c, background: map.bg, border: `1px solid ${map.b}`, borderRadius: 5, padding: '2px 6px' }}>
      {map.t}
    </span>
  );
}

// ---- Citation drawer: reveals the IS-clause text on a "paper" sheet -------
function CitationDrawer({ check }) {
  return (
    <div style={{ padding: '4px 18px 20px', animation: `dbr-drawer .3s ${T.spring} both` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 0.85fr', gap: 16,
        borderTop: `1px dashed ${T.border}`, paddingTop: 16 }}>
        {/* clause text on paper */}
        <div style={{ position: 'relative', background: '#FAF6EC', border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '20px 22px', boxShadow: '0 12px 30px -22px rgba(10,22,40,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: T.mono,
            fontSize: 9.5, color: '#8a7a5a', letterSpacing: '0.08em', marginBottom: 14 }}>
            <span>{check.code}</span>
            <span>{check.page}</span>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: '0.06em', marginBottom: 8 }}>
            {check.clause}
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 13.5, color: '#2A2620', lineHeight: 1.75 }}>
            <span style={{ background: 'rgba(252,211,77,0.4)', boxShadow: '0 0 0 3px rgba(252,211,77,0.4)',
              borderRadius: 2 }}>{check.clauseText}</span>
          </div>
        </div>

        {/* meta + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: T.sand, border: `1px solid ${T.border}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: T.subtle, letterSpacing: '0.12em', marginBottom: 10 }}>
              REFERENCE
            </div>
            {[['Code', check.code], ['Clause', check.clause], ['Location', check.page]].map(([k, val]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 0', borderTop: k === 'Code' ? 'none' : `1px solid ${T.border}` }}>
                <span style={{ fontSize: 12, color: T.muted }}>{k}</span>
                <span style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              gap: 7, padding: '10px 12px', borderRadius: 10, border: 'none', background: T.ink,
              color: T.textD, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: T.sans }}>
              <Icon.External size={13} color={T.textD} /> Open clause
            </button>
            <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '10px 14px', borderRadius: 10, border: `1px solid ${T.border}`, background: T.panel,
              color: T.ink, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', fontFamily: T.sans }}>
              <Icon.Quote size={13} color={T.ink} /> Cite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Category section ------------------------------------------------------
function CategorySection({ cat, checks, startIndex }) {
  const meta = CATEGORIES[cat] || { icon: 'File', hue: T.cyan };
  const IconC = Icon[meta.icon];
  const flaws = checks.filter(c => c.verdict === 'FLAW' || c.verdict === 'MISSING').length;
  return (
    <section style={{ marginBottom: 30 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
        position: 'sticky', top: 0, zIndex: 1 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: `${meta.hue}14`,
          border: `1px solid ${meta.hue}3a`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IconC size={16} color={T.cyanDeep} />
        </div>
        <h3 style={{ fontFamily: T.serif, fontSize: 21, color: T.ink, margin: 0, fontWeight: 400 }}>{cat}</h3>
        <span style={{ fontFamily: T.mono, fontSize: 11, color: T.subtle }}>
          {checks.length} check{checks.length > 1 ? 's' : ''}
        </span>
        {flaws > 0 && (
          <span style={{ fontFamily: T.mono, fontSize: 10.5, fontWeight: 600, color: VERDICTS.FLAW.fg,
            background: VERDICTS.FLAW.bg, border: `1px solid ${VERDICTS.FLAW.line}`,
            borderRadius: 999, padding: '2px 9px' }}>{flaws} to fix</span>
        )}
        <div style={{ flex: 1, height: 1, background: T.border }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {checks.map((c, i) => (
          <FindingCard key={c.id} check={c} index={startIndex + i}
            defaultOpen={false} />
        ))}
      </div>
    </section>
  );
}

window.FindingCard = FindingCard;
window.CategorySection = CategorySection;

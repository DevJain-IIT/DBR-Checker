// ============================================================================
//  DBR Check — shared foundation
//  Tokens, brand mark, verdict semantics, icon set, badge, count-up, keyframes.
//  Lifts Claused's exact palette / type / radii so the two read as one family.
// ============================================================================

// ---- Design tokens -------------------------------------------------------
const T = {
  // dark (landing / marketing — matches Claused)
  navy: '#0A1628', surface: '#14233D', borderD: '#1F3A5F',
  textD: '#F1F5F9', mutedD: '#94A3B8',
  // light (app — matches Claused chat)
  paper: '#FAF7F2', panel: '#FFFFFF', sand: '#F4EFE4', border: '#E8E4DC',
  ink: '#0A1628', muted: '#6B6860', subtle: '#94908A',
  // accents
  cyan: '#22D3EE', cyanDeep: '#0E7490', indigo: '#6366F1',
  // shared fonts
  serif: '"DM Serif Display", Georgia, serif',
  sans: 'Inter, -apple-system, system-ui, sans-serif',
  mono: '"JetBrains Mono", ui-monospace, monospace',
  // springy easing — the source of the "lively" feel
  spring: 'cubic-bezier(.34,1.56,.64,1)',
};

// ---- Verdict semantics ----------------------------------------------------
// Color is ALWAYS paired with an icon + label (colorblind-safe).
const VERDICTS = {
  PASS:    { key: 'PASS',    label: 'Pass',    icon: 'check',  weight: 2,
             solid: '#0E9F6E', fg: '#047857', bg: 'rgba(14,159,110,0.10)', line: 'rgba(14,159,110,0.34)' },
  FLAW:    { key: 'FLAW',    label: 'Flaw',    icon: 'alert',  weight: 5,
             solid: '#E11D48', fg: '#BE123C', bg: 'rgba(225,29,72,0.10)',  line: 'rgba(225,29,72,0.36)' },
  REVIEW:  { key: 'REVIEW',  label: 'Review',  icon: 'eye',    weight: 4,
             solid: '#E08A00', fg: '#B45309', bg: 'rgba(224,138,0,0.13)',  line: 'rgba(224,138,0,0.40)' },
  MISSING: { key: 'MISSING', label: 'Missing', icon: 'dash',   weight: 3,
             solid: '#5B7A99', fg: '#475C73', bg: 'rgba(91,122,153,0.11)', line: 'rgba(91,122,153,0.32)' },
  NA:      { key: 'NA',      label: 'N/A',     icon: 'slash',  weight: 1,
             solid: '#A8A29E', fg: '#78716C', bg: 'rgba(168,162,158,0.10)', line: 'rgba(168,162,158,0.30)' },
};
const VERDICT_ORDER = ['FLAW', 'MISSING', 'REVIEW', 'PASS', 'NA']; // surface FLAW + MISSING first

// ---- Brand mark -----------------------------------------------------------
// Original geometric mark: a report sheet with a plumb-line + a check tick.
// Pure geometry, sibling to Claused's balance scale.
function DbrMark({ size = 24, tone = 'light' }) {
  const ink = tone === 'light' ? '#F1F5F9' : '#0A1628';
  const cyan = '#22D3EE';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
      <path d="M6 3 H14 L18 7 V21 H6 Z" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 3 V7 H18" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9 16.2 l2 2 3.4 -4.4" stroke={cyan} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="3" r="0.9" fill={cyan} />
      <path d="M12 3.6 V8" stroke={cyan} strokeWidth="0.9" strokeDasharray="1.4 1.6" strokeLinecap="round" />
    </svg>
  );
}

function Wordmark({ tone = 'light', size = 22, showTag = true }) {
  const ink = tone === 'light' ? '#F1F5F9' : '#0A1628';
  const sub = tone === 'light' ? '#94A3B8' : '#6B6860';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <DbrMark size={size} tone={tone} />
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
        <span style={{ fontFamily: T.serif, fontSize: Math.round(size * 0.92), color: ink, letterSpacing: '-0.01em' }}>
          DBR&nbsp;Check
        </span>
        {showTag && (
          <span style={{ fontFamily: T.mono, fontSize: Math.round(size * 0.36), color: sub,
            letterSpacing: '0.18em', marginTop: 3 }}>BY CIVILSPACE</span>
        )}
      </div>
    </div>
  );
}

// ---- Graph-paper backdrop -------------------------------------------------
function GridBg({ color = 'rgba(255,255,255,0.025)', step = 36, style }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`,
      backgroundSize: `${step}px ${step}px`, ...style,
    }} />
  );
}

// ---- Pulsing status dot ---------------------------------------------------
function StatusDot({ color = '#0E9F6E', size = 8 }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size }}>
      <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: color, opacity: 0.4, animation: 'dbr-pulse 2s ease-out infinite' }} />
      <span style={{ position: 'absolute', inset: size * 0.25, borderRadius: 999, background: color }} />
    </span>
  );
}

// ---- Count-up number (drives the "lively" stat chips) ---------------------
function useCountUp(target, { duration = 900, start = true } = {}) {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (!start) { setVal(0); return; }
    let raf, t0;
    const tick = (t) => {
      if (!t0) t0 = t;
      const p = Math.min((t - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
}

// ---- Verdict badge --------------------------------------------------------
function VerdictBadge({ verdict, size = 'md', solid = false, animate = true }) {
  const v = VERDICTS[verdict];
  const dims = size === 'sm'
    ? { pad: '3px 8px 3px 7px', fs: 10.5, icon: 11, gap: 5 }
    : size === 'lg'
    ? { pad: '6px 14px 6px 11px', fs: 13, icon: 15, gap: 7 }
    : { pad: '4px 11px 4px 9px', fs: 11.5, icon: 13, gap: 6 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: dims.gap, padding: dims.pad,
      borderRadius: 999, fontFamily: T.mono, fontWeight: 600, fontSize: dims.fs,
      letterSpacing: '0.06em', whiteSpace: 'nowrap',
      background: solid ? v.solid : v.bg,
      color: solid ? '#fff' : v.fg,
      border: solid ? 'none' : `1px solid ${v.line}`,
      animation: animate ? 'dbr-badge-pop .42s var(--spring) both' : 'none',
    }}>
      <VIcon name={v.icon} size={dims.icon} color={solid ? '#fff' : v.solid} />
      {v.label.toUpperCase()}
    </span>
  );
}

// ---- Verdict icons (distinct silhouettes per verdict) ---------------------
function VIcon({ name, size = 14, color = 'currentColor' }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'check')  return <svg {...p}><path d="M20 6 L9 17 l-5 -5" /></svg>;
  if (name === 'alert')  return <svg {...p}><path d="M12 3 L22 20 H2 Z" /><path d="M12 10 v4" /><path d="M12 17 h.01" /></svg>;
  if (name === 'eye')    return <svg {...p}><path d="M2 12 s4 -7 10 -7 10 7 10 7 -4 7 -10 7 -10 -7 -10 -7Z" /><circle cx="12" cy="12" r="2.6" /></svg>;
  if (name === 'dash')   return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M8 12 h8" /></svg>;
  if (name === 'slash')  return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M6 18 L18 6" /></svg>;
  return null;
}

// ---- General UI icon set (line, 1.6 stroke) -------------------------------
const Icon = {
  Arrow:   (p={}) => <I {...p}><path d="M5 12 H19" /><path d="M13 6 l6 6 -6 6" /></I>,
  ArrowUp: (p={}) => <I {...p}><path d="M12 19 V5" /><path d="M5 12 l7-7 7 7" /></I>,
  Upload:  (p={}) => <I {...p}><path d="M12 16 V4" /><path d="M7 9 l5 -5 5 5" /><path d="M5 20 h14" /></I>,
  File:    (p={}) => <I {...p}><path d="M7 3 h7 l5 5 v13 H7 Z" /><path d="M14 3 v5 h5" /></I>,
  Download:(p={}) => <I {...p}><path d="M12 4 v12" /><path d="M7 11 l5 5 5 -5" /><path d="M5 20 h14" /></I>,
  Pencil:  (p={}) => <I {...p}><path d="M14 5 l5 5" /><path d="M4 20 l1 -4 11 -11 4 4 -11 11 -4 1Z" /></I>,
  Refresh: (p={}) => <I {...p}><path d="M20 11 a8 8 0 1 0 -2 6" /><path d="M20 5 v6 h-6" /></I>,
  Chevron: (p={}) => <I {...p}><path d="M6 9 l6 6 6 -6" /></I>,
  ChevR:   (p={}) => <I {...p}><path d="M9 6 l6 6 -6 6" /></I>,
  Filter:  (p={}) => <I {...p}><path d="M3 5 h18 l-7 8 v6 l-4 -2 v-4 Z" /></I>,
  Quote:   (p={}) => <I {...p}><path d="M6 9 h4 v4 a4 4 0 0 1 -4 4" /><path d="M14 9 h4 v4 a4 4 0 0 1 -4 4" /></I>,
  Book:    (p={}) => <I {...p}><path d="M5 4 h11 a3 3 0 0 1 3 3 v13 H8 a3 3 0 0 1 -3 -3 z" /><path d="M5 17 a3 3 0 0 1 3 -3 h11" /></I>,
  Shield:  (p={}) => <I {...p}><path d="M12 3 l8 3 v6 c0 5 -3.5 8 -8 9 -4.5 -1 -8 -4 -8 -9 V6 Z" /></I>,
  Lock:    (p={}) => <I {...p}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11 V8 a4 4 0 0 1 8 0 v3" /></I>,
  Clock:   (p={}) => <I {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7 v5 l3 2" /></I>,
  Close:   (p={}) => <I {...p}><path d="M6 6 L18 18" /><path d="M18 6 L6 18" /></I>,
  Search:  (p={}) => <I {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16 l4 4" /></I>,
  Spark:   (p={}) => <I {...p}><path d="M12 3 l1.8 5.2 5.2 1.8 -5.2 1.8 L12 17 l-1.8 -5.2 L5 10 l5.2 -1.8 Z" /></I>,
  Print:   (p={}) => <I {...p}><path d="M7 8 V3 h10 v5" /><rect x="5" y="8" width="14" height="8" rx="1.5" /><path d="M7 14 h10 v6 H7 Z" /></I>,
  Layers:  (p={}) => <I {...p}><path d="M12 4 L3 9 l9 5 9 -5 z" /><path d="M3 14 l9 5 9 -5" /></I>,
  Check:   (p={}) => <I {...p}><path d="M20 6 L9 17 l-5 -5" /></I>,
  External:(p={}) => <I {...p}><path d="M13 5 h6 v6" /><path d="M19 5 L11 13" /><path d="M19 14 v5 H5 V5 h5" /></I>,
};
function I({ size = 16, color = 'currentColor', children, style }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', ...style }}>{children}</svg>;
}

// ---- Category meta (icon glyph per finding category) ----------------------
const CATEGORIES = {
  'Identity / QA':            { icon: 'File',   hue: '#6366F1' },
  'Currency':                 { icon: 'Clock',  hue: '#22D3EE' },
  'Materials':                { icon: 'Layers', hue: '#6366F1' },
  'Cover / Durability / Fire':{ icon: 'Shield', hue: '#22D3EE' },
  'Seismic':                  { icon: 'Spark',  hue: '#6366F1' },
  'Wind':                     { icon: 'Refresh',hue: '#22D3EE' },
  'Loads / Temperature':      { icon: 'Book',   hue: '#6366F1' },
  'Foundation':               { icon: 'Lock',   hue: '#22D3EE' },
  'Location':                 { icon: 'Search', hue: '#6366F1' },
};

// ---- Citation pill (clickable) -------------------------------------------
function CitePill({ children, onClick, active }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
        padding: '4px 11px', borderRadius: 999,
        background: (hover || active) ? `${T.cyan}22` : `${T.cyan}14`,
        border: `1px solid ${(hover || active) ? T.cyan : `${T.cyan}55`}`,
        fontFamily: T.mono, fontSize: 11.5, color: T.cyanDeep, letterSpacing: '0.02em',
        transition: `all .18s ${T.spring}`,
        transform: hover ? 'translateY(-1px)' : 'none', whiteSpace: 'nowrap',
      }}>
      <Icon.Quote size={11} color={T.cyanDeep} />
      {children}
    </span>
  );
}

// ---- Keyframes ------------------------------------------------------------
if (typeof document !== 'undefined' && !document.getElementById('dbr-kf')) {
  const s = document.createElement('style');
  s.id = 'dbr-kf';
  s.textContent = `
    :root { --spring: cubic-bezier(.34,1.56,.64,1); }
    *{ box-sizing:border-box; }
    @keyframes dbr-pulse { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(2.6);opacity:0} }
    @keyframes dbr-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
    @keyframes dbr-fade-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes dbr-fade-in { from{opacity:0} to{opacity:1} }
    @keyframes dbr-badge-pop { 0%{opacity:0;transform:scale(.6)} 60%{transform:scale(1.08)} 100%{opacity:1;transform:scale(1)} }
    @keyframes dbr-pop-in { 0%{opacity:0;transform:scale(.92) translateY(8px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes dbr-spin { to{ transform:rotate(360deg) } }
    @keyframes dbr-shuffle { 0%,100%{transform:translate(0,0) rotate(0)} 50%{transform:translate(-2px,-4px) rotate(-3deg)} }
    @keyframes dbr-shimmer { 0%{background-position:-300px 0} 100%{background-position:300px 0} }
    @keyframes dbr-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes dbr-rise { from{height:0} }
    @keyframes dbr-drawer { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
    @keyframes dbr-confetti { 0%{transform:translateY(0) rotate(0);opacity:1} 100%{transform:translateY(640px) rotate(720deg);opacity:0} }
    @keyframes dbr-stamp { 0%{transform:scale(2.4) rotate(-18deg);opacity:0} 60%{transform:scale(.92) rotate(-12deg);opacity:1} 100%{transform:scale(1) rotate(-12deg);opacity:1} }
    @keyframes dbr-sweep { to{ stroke-dashoffset:0 } }
    @keyframes dbr-bar { from{ width:0 } }
    @media (prefers-reduced-motion: reduce){ *{ animation-duration:.001ms !important; animation-iteration-count:1 !important } }
    ::selection { background: #22D3EE40; }
    .dbr-scroll::-webkit-scrollbar{ width:10px; height:10px }
    .dbr-scroll::-webkit-scrollbar-thumb{ background:#d9d3c8; border-radius:99px; border:3px solid transparent; background-clip:content-box }
    .dbr-scroll::-webkit-scrollbar-thumb:hover{ background:#c4bdaf; background-clip:content-box }
  `;
  document.head.appendChild(s);
}

Object.assign(window, {
  T, VERDICTS, VERDICT_ORDER, CATEGORIES,
  DbrMark, Wordmark, GridBg, StatusDot, useCountUp,
  VerdictBadge, VIcon, Icon, CitePill,
});

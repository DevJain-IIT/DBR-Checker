// ============================================================================
//  DBR Check — Upload + Processing (warm light app surface)
// ============================================================================

function UploadScreen({ onComplete, onBack }) {
  const [stage, setStage] = React.useState('idle'); // idle | drag | ready | processing
  const fileName = 'DBR-MH-TB-R2.pdf';

  const start = () => setStage('processing');

  return (
    <div data-screen-label="02 Upload" className="dbr-scroll" style={{
      height: '100%', overflowY: 'auto', background: T.paper, color: T.ink,
      fontFamily: T.sans, position: 'relative',
    }}>
      <GridBg color="rgba(10,22,40,0.025)" step={36} />
      {/* App chrome */}
      <header style={{ position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '20px 32px', borderBottom: `1px solid ${T.border}` }}>
        <div onClick={onBack} style={{ cursor: 'pointer' }}><Wordmark tone="dark" size={20} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.mono,
          fontSize: 11, color: T.subtle }}>
          <Icon.Lock size={13} color={T.subtle} /> PRIVATE · NOT STORED
        </div>
      </header>

      <div style={{ position: 'relative', maxWidth: 760, margin: '0 auto', padding: '56px 32px 80px' }}>
        {stage !== 'processing' ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 36 }}>
              <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: '0.18em', marginBottom: 14 }}>
                STEP 1 · UPLOAD
              </div>
              <h1 style={{ fontFamily: T.serif, fontSize: 44, margin: 0, fontWeight: 400, letterSpacing: '-0.02em' }}>
                Drop your Design&nbsp;Basis Report
              </h1>
              <p style={{ fontSize: 16, color: T.muted, marginTop: 14, lineHeight: 1.55 }}>
                A single PDF — we’ll extract the building basis and run 25 IS-code checks.
              </p>
            </div>

            <UploadZone stage={stage} setStage={setStage} fileName={fileName} />

            {/* trust row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginTop: 22 }}>
              {[
                { ic: 'Lock',   t: 'Stays private', d: 'Processed in-session; not retained after.' },
                { ic: 'File',   t: 'PDF up to 40 MB', d: 'Multi-page DBRs and scans accepted.' },
                { ic: 'Clock',  t: '~3 seconds', d: 'Median time to a full findings report.' },
              ].map(x => {
                const C = Icon[x.ic];
                return (
                  <div key={x.t} style={{ background: T.panel, border: `1px solid ${T.border}`,
                    borderRadius: 12, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <C size={15} color={T.cyanDeep} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{x.t}</span>
                    </div>
                    <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.45 }}>{x.d}</div>
                  </div>
                );
              })}
            </div>

            {stage === 'ready' && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28,
                animation: 'dbr-pop-in .4s both' }}>
                <button onClick={start} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  padding: '15px 30px', borderRadius: 12, background: T.ink, color: T.textD,
                  fontWeight: 600, fontSize: 15.5, border: 'none', cursor: 'pointer', fontFamily: T.sans,
                  boxShadow: '0 14px 32px -16px rgba(10,22,40,0.6)', transition: `transform .2s ${T.spring}` }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                  Run 25 checks <Icon.Arrow size={17} color={T.textD} />
                </button>
              </div>
            )}
          </>
        ) : (
          <Processing onComplete={onComplete} fileName={fileName} />
        )}
      </div>
    </div>
  );
}

// ---- Drag & drop zone -----------------------------------------------------
function UploadZone({ stage, setStage, fileName }) {
  const dragging = stage === 'drag';
  const ready = stage === 'ready';
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!ready) setStage('drag'); }}
      onDragLeave={e => { e.preventDefault(); if (!ready) setStage('idle'); }}
      onDrop={e => { e.preventDefault(); setStage('ready'); }}
      onClick={() => !ready && setStage('ready')}
      style={{
        position: 'relative', borderRadius: 20, cursor: ready ? 'default' : 'pointer',
        padding: '54px 32px', textAlign: 'center',
        background: ready ? T.panel : dragging ? `${T.cyan}10` : T.panel,
        border: `2px dashed ${dragging ? T.cyan : ready ? `${T.cyan}66` : '#D8D2C6'}`,
        transition: `all .22s ${T.spring}`,
        transform: dragging ? 'scale(1.012)' : 'none',
        boxShadow: dragging ? `0 24px 50px -28px ${T.cyan}` : '0 10px 30px -24px rgba(10,22,40,0.4)',
      }}>
      {!ready ? (
        <>
          <div style={{ width: 74, height: 74, margin: '0 auto 20px', borderRadius: 18,
            background: dragging ? T.cyan : `${T.cyan}14`, border: `1px solid ${T.cyan}3a`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: `all .22s ${T.spring}`,
            transform: dragging ? 'translateY(-6px) scale(1.06)' : 'none' }}>
            <Icon.Upload size={32} color={dragging ? T.navy : T.cyanDeep} />
          </div>
          <div style={{ fontFamily: T.serif, fontSize: 24, color: T.ink }}>
            {dragging ? 'Release to upload' : 'Drag a DBR here'}
          </div>
          <div style={{ fontSize: 14, color: T.muted, marginTop: 8 }}>
            or <span style={{ color: T.cyanDeep, fontWeight: 600 }}>browse files</span> · PDF only
          </div>
        </>
      ) : (
        <div style={{ animation: 'dbr-pop-in .4s both', display: 'flex', alignItems: 'center',
          gap: 16, justifyContent: 'center' }}>
          <div style={{ width: 52, height: 60, borderRadius: 8, background: '#fff',
            border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center',
            justifyContent: 'center', position: 'relative', flexShrink: 0,
            boxShadow: '0 8px 20px -12px rgba(10,22,40,0.4)' }}>
            <Icon.File size={26} color={T.cyanDeep} />
            <span style={{ position: 'absolute', bottom: 6, fontFamily: T.mono, fontSize: 7,
              color: T.cyanDeep, fontWeight: 700, letterSpacing: '0.06em' }}>PDF</span>
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink }}>{fileName}</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.muted, marginTop: 4 }}>
              34 pages · 2.4 MB · ready
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); setStage('idle'); }} style={{
            width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.border}`,
            background: T.panel, cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', marginLeft: 8 }}>
            <Icon.Close size={14} color={T.muted} />
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Processing: three labelled phases ------------------------------------
function Processing({ onComplete, fileName }) {
  const phases = [
    { key: 'extract',   label: 'Extracting data',    sub: 'Reading the building basis from 34 pages' },
    { key: 'normalize', label: 'Normalizing',        sub: 'Mapping values to IS-code parameters' },
    { key: 'checks',    label: 'Running 25 checks',  sub: 'Comparing against clauses & tables' },
  ];
  const [active, setActive] = React.useState(0);
  const [done, setDone] = React.useState(false);
  const checksRun = useCountUp(25, { start: active >= 2, duration: 1600 });

  React.useEffect(() => {
    const timers = [
      setTimeout(() => setActive(1), 1500),
      setTimeout(() => setActive(2), 3000),
      setTimeout(() => setDone(true), 4900),
      setTimeout(() => onComplete && onComplete(), 5700),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div style={{ textAlign: 'center', paddingTop: 8, animation: 'dbr-fade-in .4s both' }}>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.cyanDeep, letterSpacing: '0.18em', marginBottom: 20 }}>
        STEP 2 · ANALYZING
      </div>

      {/* Animated building frame that "fills" with the checks */}
      <ProcessingFrame active={active} done={done} />

      <h1 style={{ fontFamily: T.serif, fontSize: 36, margin: '26px 0 6px', fontWeight: 400 }}>
        {done ? 'Report ready' : 'Checking ' + fileName}
      </h1>
      <p style={{ fontSize: 14.5, color: T.muted, margin: 0 }}>
        {done ? 'Opening your findings…' : 'This usually takes a few seconds — sit tight.'}
      </p>

      <div style={{ maxWidth: 460, margin: '34px auto 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {phases.map((p, i) => {
          const state = done || i < active ? 'done' : i === active ? 'active' : 'wait';
          return (
            <div key={p.key} style={{
              display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
              padding: '14px 18px', borderRadius: 13,
              background: state === 'wait' ? 'transparent' : T.panel,
              border: `1px solid ${state === 'active' ? `${T.cyan}66` : state === 'done' ? VERDICTS.PASS.line : T.border}`,
              opacity: state === 'wait' ? 0.5 : 1,
              boxShadow: state === 'active' ? `0 10px 26px -18px ${T.cyan}` : 'none',
              transition: `all .3s ${T.spring}` }}>
              <PhaseDot state={state} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
                  {p.key === 'checks' && state !== 'wait'
                    ? <>Running checks · <span style={{ fontFamily: T.mono, color: T.cyanDeep }}>{checksRun}/25</span></>
                    : p.label}
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>{p.sub}</div>
              </div>
              {state === 'done' && <VIcon name="check" size={18} color={VERDICTS.PASS.solid} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PhaseDot({ state }) {
  if (state === 'done') return (
    <div style={{ width: 26, height: 26, borderRadius: 999, background: VERDICTS.PASS.bg,
      border: `1px solid ${VERDICTS.PASS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <VIcon name="check" size={14} color={VERDICTS.PASS.solid} />
    </div>
  );
  if (state === 'active') return (
    <div style={{ width: 26, height: 26, position: 'relative', flexShrink: 0 }}>
      <svg width="26" height="26" viewBox="0 0 26 26" style={{ animation: 'dbr-spin 0.9s linear infinite' }}>
        <circle cx="13" cy="13" r="10" fill="none" stroke={`${T.cyan}33`} strokeWidth="3" />
        <circle cx="13" cy="13" r="10" fill="none" stroke={T.cyan} strokeWidth="3"
          strokeLinecap="round" strokeDasharray="16 60" />
      </svg>
    </div>
  );
  return <div style={{ width: 26, height: 26, borderRadius: 999, border: `2px solid ${T.border}`, flexShrink: 0 }} />;
}

// ---- Building wireframe that fills storey-by-storey ------------------------
function ProcessingFrame({ active, done }) {
  const floors = 6;
  const litFloors = done ? floors : Math.min(floors, Math.round((active / 3) * floors) + active + 1);
  return (
    <div style={{ width: 150, height: 150, margin: '0 auto', position: 'relative' }}>
      <svg width="150" height="150" viewBox="0 0 150 150">
        {/* frame grid */}
        {Array.from({ length: floors + 1 }).map((_, f) => {
          const y = 130 - f * 18;
          return <line key={'h' + f} x1="35" y1={y} x2="115" y2={y} stroke={T.border} strokeWidth="1" />;
        })}
        {[35, 75, 115].map((x, i) => (
          <line key={'v' + i} x1={x} y1="22" x2={x} y2="130" stroke={T.border} strokeWidth="1" />
        ))}
        {/* lit storeys */}
        {Array.from({ length: floors }).map((_, f) => {
          const y = 130 - (f + 1) * 18;
          const lit = f < litFloors;
          return (
            <rect key={'r' + f} x="36" y={y + 1} width="78" height="16" rx="1.5"
              fill={lit ? `${T.cyan}22` : 'transparent'}
              stroke={lit ? T.cyan : 'transparent'} strokeWidth="1"
              style={{ transition: `all .4s ${T.spring} ${f * 0.04}s` }} />
          );
        })}
        {/* nodes */}
        {[35, 75, 115].map(x => Array.from({ length: floors + 1 }).map((_, f) => (
          <circle key={x + '-' + f} cx={x} cy={130 - f * 18} r="2" fill={T.cyanDeep} opacity="0.7" />
        )))}
      </svg>
      {done && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: VERDICTS.PASS.solid,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 14px 30px -10px ${VERDICTS.PASS.solid}`, animation: 'dbr-stamp .5s var(--spring) both' }}>
            <VIcon name="check" size={30} color="#fff" />
          </div>
        </div>
      )}
    </div>
  );
}

window.UploadScreen = UploadScreen;

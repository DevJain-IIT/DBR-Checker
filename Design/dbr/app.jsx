// ============================================================================
//  DBR Check — App shell + screen router
// ============================================================================

const SCREENS = ['landing', 'upload', 'report'];

function App() {
  const [screen, setScreen] = React.useState(() => {
    try { const s = localStorage.getItem('dbr-screen'); return SCREENS.includes(s) ? s : 'landing'; }
    catch (e) { return 'landing'; }
  });
  const go = (s) => { setScreen(s); try { localStorage.setItem('dbr-screen', s); } catch (e) {} };

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      <div key={screen} style={{ height: '100%', animation: 'dbr-fade-in .35s both' }}>
        {screen === 'landing' && <Landing onStart={() => go('upload')} />}
        {screen === 'upload'  && <UploadScreen onComplete={() => go('report')} onBack={() => go('landing')} />}
        {screen === 'report'  && <Report onBack={() => go('landing')} />}
      </div>

      {/* demo screen-switcher (for reviewing the prototype) */}
      <ScreenSwitcher screen={screen} go={go} />
    </div>
  );
}

function ScreenSwitcher({ screen, go }) {
  const labels = [
    { k: 'landing', t: 'Landing' },
    { k: 'upload',  t: 'Upload' },
    { k: 'report',  t: 'Report' },
  ];
  return (
    <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 80,
      display: 'flex', alignItems: 'center', gap: 4, padding: 5,
      background: 'rgba(10,22,40,0.88)', backdropFilter: 'blur(12px)', borderRadius: 999,
      border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 18px 40px -18px rgba(0,0,0,0.6)' }}>
      <span style={{ fontFamily: T.mono, fontSize: 9.5, color: '#94A3B8', letterSpacing: '0.12em',
        padding: '0 8px 0 10px' }}>DEMO</span>
      {labels.map(l => (
        <button key={l.k} onClick={() => go(l.k)} style={{
          padding: '7px 15px', borderRadius: 999, border: 'none', cursor: 'pointer',
          fontFamily: T.mono, fontSize: 11.5, letterSpacing: '0.04em',
          background: screen === l.k ? T.cyan : 'transparent',
          color: screen === l.k ? T.navy : '#C7D2DE', fontWeight: screen === l.k ? 700 : 500,
          transition: `all .2s ${T.spring}` }}>
          {l.t}
        </button>
      ))}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

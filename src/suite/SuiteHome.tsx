// CREATIVE's home screen (CREATIVE.md §2): a grid of module tiles and a bottom
// navigation (Home · Library · Settings). PERSPECTIVE opens the PERSPECTIVE
// module; modules not built yet say "Coming soon".
import { useState } from 'react';
import { Home, LayoutGrid, MoreVertical, Settings as SettingsIcon } from 'lucide-react';
import { useUiStore } from '../state/uiStore';
import { MODULES, type SuiteModule } from './modules';

const soon = (what: string) => useUiStore.getState().showToast(`${what} — coming soon.`);

export function SuiteHome() {
  const [menu, setMenu] = useState(false);
  const ui = useUiStore.getState;
  const open = (m: SuiteModule) => {
    if (m.entry === 'perspective') ui().set({ screen: 'gallery' });
    else if (m.entry === 'cube') ui().set({ screen: 'cube' });
    else if (m.entry === 'sketch') ui().set({ screen: 'sketch' });
    else if (m.entry === 'publish') ui().set({ screen: 'publish' });
    else soon(m.title);
  };

  return (
    <div className="suite" onClick={() => setMenu(false)}>
      <header className="suite-head">
        <button className="suite-menu" aria-label="Menu" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>
          <MoreVertical size={22} />
        </button>
        {menu && (
          <div className="menu suite-more" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => ui().set({ screen: 'settings', back: 'home' })}>Settings</button>
            <div className="muted about">Version {__APP_VERSION__}</div>
          </div>
        )}
        <p className="eyebrow">Creative</p>
        <h1>Ideas to creation</h1>
        <p className="tagline">Sketch · Explore · Analyze · Publish</p>
      </header>

      <main className="suite-grid">
        {MODULES.map((m) => (
          <button key={m.id} className={m.entry ? 'tile' : 'tile soon'} onClick={() => open(m)} aria-label={m.entry ? m.title : `${m.title} (coming soon)`}>
            <img src={m.art} alt="" draggable={false} />
            <span>{m.title}</span>
          </button>
        ))}
      </main>

      <nav className="suite-nav">
        <button className="active" aria-current="page">
          <Home size={22} />
          <span>Home</span>
        </button>
        <button onClick={() => soon('Library')}>
          <LayoutGrid size={22} />
          <span>Library</span>
        </button>
        <button onClick={() => ui().set({ screen: 'settings', back: 'home' })}>
          <SettingsIcon size={22} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}

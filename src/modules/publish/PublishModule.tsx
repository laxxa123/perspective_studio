// The PUBLISH module (CREATIVE.md §3, PUBLISH §3): TILES · PUBLISH · WP ·
// SETTINGS. Phase 1 builds TILES; the other tabs say what is coming.
import { useEffect } from 'react';
import { ArrowLeft, Globe, LayoutGrid, Send, Settings } from 'lucide-react';
import '@fontsource-variable/roboto/wght.css';
import '@fontsource/ms-madi/400.css';
import { usePublishStore, type Tab } from './state/usePublishStore';
import { onPause } from '../../platform/lifecycle';
import { TilesTab } from './ui/TilesTab';
import { TileEditor } from './ui/TileEditor';
import { closeTile, saveNow } from './ui/session';
import { publishBack } from './index';
import './publish.css';

const st = usePublishStore.getState;

const TABS: [Tab, string, typeof Globe][] = [
  ['tiles', 'Tiles', LayoutGrid],
  ['publish', 'Publish', Send],
  ['wp', 'WP', Globe],
  ['settings', 'Settings', Settings],
];

const SOON: Record<Exclude<Tab, 'tiles'>, { title: string; text: string }> = {
  publish: { title: 'Publish', text: 'Pick tiles, arrange them into a post and publish it to WordPress.' },
  wp: { title: 'WP', text: 'Your latest 25 posts and 25 pictures from WordPress — search, pull back, edit, republish and reuse.' },
  settings: { title: 'Settings', text: 'Your WordPress site and login.' },
};

export default function PublishModule({ onExit }: { onExit: () => void }) {
  const tab = usePublishStore((s) => s.tab);
  const editing = usePublishStore((s) => s.tile !== null);
  const toast = usePublishStore((s) => s.toast);

  useEffect(() => {
    publishBack.current = () => {
      const s = st();
      if (s.tile) {
        if (s.overlay !== 'none') s.set({ overlay: 'none', fresh: null });
        else if (s.sheet !== 'none') s.set({ sheet: 'none' });
        else if (s.selected) s.set({ selected: null });
        else void closeTile();
        return true;
      }
      return false;
    };
    const off = onPause(() => void saveNow());
    return () => {
      publishBack.current = null;
      off();
      void closeTile();
    };
  }, []);

  return (
    <div className="pb-root">
      {editing ? (
        <TileEditor />
      ) : (
        <>
          <header className="pb-head">
            <button className="pb-icon" aria-label="CREATIVE home" onClick={onExit}>
              <ArrowLeft size={22} />
            </button>
            <h1>Publish</h1>
          </header>
          <main className="pb-main">
            {tab === 'tiles' ? (
              <TilesTab />
            ) : (
              <div className="pb-empty">
                <p className="pb-soon">Coming next</p>
                <h2>{SOON[tab].title}</h2>
                <p className="pb-hint">{SOON[tab].text}</p>
              </div>
            )}
          </main>
          <nav className="pb-tabs" aria-label="Publish sections">
            {TABS.map(([t, label, Icon]) => (
              <button key={t} className={tab === t ? 'on' : ''} aria-current={tab === t ? 'page' : undefined} onClick={() => st().set({ tab: t })}>
                <Icon size={22} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </>
      )}
      {toast && <div className="pb-toast">{toast}</div>}
    </div>
  );
}

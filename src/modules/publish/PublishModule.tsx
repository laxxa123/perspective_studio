// The PUBLISH module (CREATIVE.md §3, PUBLISH §3): TILES · PUBLISH · POSTS ·
// SETTINGS.
import { useEffect } from 'react';
import { ArrowLeft, LayoutGrid, LoaderCircle, Newspaper, Send, Settings } from 'lucide-react';
import '@fontsource-variable/roboto/wght.css';
import '@fontsource/ms-madi/400.css';
import { usePublishStore, type Tab } from './state/usePublishStore';
import { onPause } from '../../platform/lifecycle';
import { TilesTab } from './ui/TilesTab';
import { PublishTab } from './ui/PublishTab';
import { PostsTab } from './ui/PostsTab';
import { SettingsTab } from './ui/SettingsTab';
import { TileEditor } from './ui/TileEditor';
import { closeTile, saveNow } from './ui/session';
import { publishBack } from './index';
import './publish.css';

const st = usePublishStore.getState;

const TABS: [Tab, string, typeof Send][] = [
  ['tiles', 'Tiles', LayoutGrid],
  ['publish', 'Publish', Send],
  ['posts', 'Posts', Newspaper],
  ['settings', 'Settings', Settings],
];

export default function PublishModule({ onExit }: { onExit: () => void }) {
  const tab = usePublishStore((s) => s.tab);
  const editing = usePublishStore((s) => s.tile !== null);
  const busy = usePublishStore((s) => s.busy);
  const snack = usePublishStore((s) => s.snack);

  useEffect(() => {
    publishBack.current = () => {
      const s = st();
      if (s.busy) return true;
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
            <button className="pb-icon sm" aria-label="CREATIVE home" onClick={onExit}>
              <ArrowLeft size={18} />
            </button>
            <h1>Publish</h1>
          </header>
          <main className="pb-main">
            {tab === 'tiles' && <TilesTab />}
            {tab === 'publish' && <PublishTab />}
            {tab === 'posts' && <PostsTab />}
            {tab === 'settings' && <SettingsTab />}
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
      {busy && (
        <div className="pb-busy" role="status" aria-live="polite">
          <div>
            <LoaderCircle size={28} className="spin" />
            <p>{busy}</p>
          </div>
        </div>
      )}
      {snack && (
        <div className={`pb-snack${editing ? ' over-bar' : ''}`} role="status" key={snack.key}>
          <span>{snack.text}</span>
          {snack.action?.href ? (
            <a href={snack.action.href} target="_blank" rel="noreferrer" onClick={() => st().set({ snack: null })}>
              {snack.action.label}
            </a>
          ) : (
            snack.action && (
              <button
                onClick={() => {
                  st().set({ snack: null });
                  snack.action?.run?.();
                }}
              >
                {snack.action.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

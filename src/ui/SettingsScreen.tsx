// Settings (§10.8): theme, default snapping, toolbar handedness, about.
import { ArrowLeft } from 'lucide-react';
import { useSettingsStore, type Settings } from '../state/settingsStore';
import { useUiStore } from '../state/uiStore';

function Choice<K extends keyof Settings>({ k, options }: { k: K; options: [Settings[K], string][] }) {
  const value = useSettingsStore((s) => s[k]);
  return (
    <div className="seg-group">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'seg active' : 'seg'} onClick={() => useSettingsStore.getState().update({ [k]: v } as Partial<Settings>)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function SettingsScreen() {
  return (
    <div className="settings">
      <header className="gallery-head">
        <button className="icon" aria-label="Back" onClick={() => useUiStore.getState().set({ screen: useUiStore.getState().back })}>
          <ArrowLeft size={20} />
        </button>
        <h1>Settings</h1>
      </header>
      <section>
        <h2>Theme</h2>
        <Choice k="theme" options={[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]} />
      </section>
      <section>
        <h2>Object grid snap (0.1 u)</h2>
        <Choice k="gridSnap" options={[[true, 'On'], [false, 'Off']]} />
      </section>
      <section>
        <h2>After placing a box</h2>
        <Choice k="returnToSelect" options={[[true, 'Back to Select'], [false, 'Stay in Box']]} />
      </section>
      <section>
        <h2>Toolbar</h2>
        <Choice k="handedness" options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} />
      </section>
      <section>
        <h2>About</h2>
        <p className="muted">CREATIVE {__APP_VERSION__} · PERSPECTIVE module. Private, offline, single user.</p>
      </section>
    </div>
  );
}

// The SKETCH module (CREATIVE.md §3, SKETCH §1): opens straight onto the
// last sketch (or a new one) so drawing starts at once; the gallery and
// settings are a tap away. Settings open over the editor, which stays alive.
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSketchStore } from './state/useSketchStore';
import { projectStore } from './storage/ProjectStore';
import { Gallery } from './ui/Gallery';
import { SettingsScreen } from './ui/SettingsScreen';
import { SketchScreen } from './ui/SketchScreen';
import { engineRef, newProject } from './ui/session';
import { sketchBack } from './index';
import './sketch.css';

const st = useSketchStore.getState;

let boot: Promise<string> | null = null;
/** The latest sketch, or a new one (shared, so a double mount never creates two). */
const resume = () =>
  (boot ??= (async () => {
    const store = await projectStore();
    const latest = (await store.list())[0];
    return latest?.id ?? (await newProject());
  })().finally(() => {
    boot = null;
  }));

export default function SketchModule({ onExit }: { onExit: () => void }) {
  const page = useSketchStore((s) => s.page);
  const back = useSketchStore((s) => s.back);
  const projectId = useSketchStore((s) => s.projectId);
  const [booting, setBooting] = useState(() => !st().projectId && st().page === 'gallery');

  // Open → draw: resume the latest sketch, or start one.
  useEffect(() => {
    if (st().projectId || st().page !== 'gallery') return;
    let alive = true;
    void resume()
      .then((id) => alive && st().set({ page: 'editor', projectId: id }))
      .catch(() => st().set({ page: 'gallery' }))
      .finally(() => alive && setBooting(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    sketchBack.current = handleBack;
    return () => {
      sketchBack.current = null;
    };
  }, []);

  const editorAlive = projectId && (page === 'editor' || (page === 'settings' && back === 'editor'));
  return (
    <div className="sk-root">
      {editorAlive && <SketchScreen projectId={projectId} />}
      {page === 'gallery' && !booting && <Gallery onExit={onExit} />}
      {page === 'settings' && (
        <div className="sk-overlay">
          <SettingsScreen />
        </div>
      )}
      {booting && (
        <div className="sk-center">
          <Loader2 className="spin" size={28} />
        </div>
      )}
    </div>
  );
}

/** The Android back button inside SKETCH; returns false when SKETCH should close. */
function handleBack(): boolean {
  const s = st();
  if (s.page === 'settings') {
    s.set({ page: s.back });
    return true;
  }
  if (s.page === 'editor') {
    if (s.panel !== 'none') {
      s.set({ panel: 'none' });
      return true;
    }
    if (s.mode !== 'draw') {
      const e = engineRef.current;
      if (e) e.editingRef = null;
      e?.setDraft(null);
      s.set({ mode: 'draw' });
      return true;
    }
    s.set({ page: 'gallery', projectId: null });
    return true;
  }
  return false;
}

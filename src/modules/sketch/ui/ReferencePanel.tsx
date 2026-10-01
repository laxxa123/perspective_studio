// Reference images (SKETCH §14): import, move / scale (on the canvas),
// opacity, lock, hide. They sit under the artwork and are never exported.
import { Eye, EyeOff, ImagePlus, Lock, LockOpen, Move, Trash2 } from 'lucide-react';
import { pickFile } from '../../../platform/files';
import { newId } from '../core/document';
import { DOC_H, DOC_W, type ReferenceModel } from '../core/types';
import { projectStore } from '../storage/ProjectStore';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef, saveNow } from './session';

const st = useSketchStore.getState;
const MAX_SIDE = 2048;

async function decode(blob: Blob): Promise<ImageBitmap> {
  const bmp = await createImageBitmap(blob);
  const k = MAX_SIDE / Math.max(bmp.width, bmp.height);
  if (k >= 1) return bmp;
  bmp.close();
  const full = await createImageBitmap(blob);
  const small = await createImageBitmap(full, { resizeWidth: Math.round(full.width * k), resizeHeight: Math.round(full.height * k), resizeQuality: 'high' });
  full.close();
  return small;
}

export async function importReference() {
  const e = engineRef.current;
  if (!e) return;
  const file = await pickFile('image/*');
  if (!file) return;
  try {
    const bmp = await decode(file);
    const store = await projectStore();
    const assetId = await store.putAsset(e.doc.id, file);
    e.setReferenceImage(assetId, bmp);
    const aspect = bmp.width / bmp.height;
    const width = Math.min(DOC_W * 0.8, DOC_H * 0.6 * aspect);
    const ref: ReferenceModel = { id: newId('r'), assetId, x: DOC_W / 2, y: DOC_H / 2, width, aspect, rotation: 0, opacity: 0.5, locked: false, hidden: false };
    e.setReferences([...e.doc.references, ref]);
    e.editingRef = ref.id;
    st().set({ mode: 'reference', panel: 'none' });
  } catch (err) {
    st().showToast(`Could not open the image: ${err instanceof Error ? err.message : String(err)}`);
  }
}

export function ReferencePanel() {
  const refs = useSketchStore((s) => s.doc?.references ?? []);
  const patch = (id: string, p: Partial<ReferenceModel>) => {
    const e = engineRef.current;
    if (e) e.setReferences(e.doc.references.map((r) => (r.id === id ? { ...r, ...p } : r)));
  };
  const remove = async (id: string) => {
    const e = engineRef.current;
    if (!e) return;
    e.setReferences(e.doc.references.filter((r) => r.id !== id));
    if (e.editingRef === id) e.editingRef = null;
    await saveNow();
    await (await projectStore()).pruneAssets(e.doc);
  };
  return (
    <div className="sk-panel" role="dialog" aria-label="Reference image">
      <div className="sk-panel-head">
        <span className="sk-label">Reference</span>
        <button className="sk-chipbtn" onClick={() => void importReference()}>
          <ImagePlus size={18} /> Import
        </button>
      </div>
      {!refs.length && <p className="sk-hint">Import a photo to trace or study. It stays under your drawing and is never exported.</p>}
      {refs.map((r, i) => (
        <div key={r.id} className="sk-ref">
          <div className="sk-row">
            <span className="sk-label">Image {i + 1}</span>
            <input type="range" min={5} max={100} value={Math.round(r.opacity * 100)} aria-label="Reference opacity" onChange={(ev) => patch(r.id, { opacity: Number(ev.target.value) / 100 })} />
          </div>
          <div className="sk-blends">
            <button
              className="sk-mini"
              disabled={r.locked || r.hidden}
              onClick={() => {
                const e = engineRef.current;
                if (e) e.editingRef = r.id;
                st().set({ mode: 'reference', panel: 'none' });
              }}
            >
              <Move size={14} /> Move / scale
            </button>
            <button className="sk-mini" onClick={() => patch(r.id, { hidden: !r.hidden })}>
              {r.hidden ? <EyeOff size={14} /> : <Eye size={14} />} {r.hidden ? 'Hidden' : 'Shown'}
            </button>
            <button className="sk-mini" onClick={() => patch(r.id, { locked: !r.locked })}>
              {r.locked ? <Lock size={14} /> : <LockOpen size={14} />} {r.locked ? 'Locked' : 'Free'}
            </button>
            <button className="sk-mini danger" onClick={() => void remove(r.id)}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

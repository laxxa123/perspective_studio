// Media (PUBLISH §5): the library of reusable pictures. Tap one to place it;
// "From phone" imports (cleaned, deduplicated, canonically named); the info
// row renames the readable part of a name or deletes an unused picture.
import { useEffect, useState } from 'react';
import { Info, Plus, Trash2 } from 'lucide-react';
import { addElement, imageFor } from '../core/tile';
import type { MediaAsset } from '../core/types';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';
import { ensureImages } from '../render/images';
import { importPhotos } from './session';

const st = usePublishStore.getState;
const urls = new Map<string, string>();

export function MediaThumb({ m }: { m: MediaAsset }) {
  const [url, setUrl] = useState(() => urls.get(m.id) ?? null);
  useEffect(() => {
    if (url) return;
    let alive = true;
    void publishStore()
      .then((s) => s.blob(m.id))
      .then((b) => {
        if (!b || !alive) return;
        const u = URL.createObjectURL(b);
        urls.set(m.id, u);
        setUrl(u);
      });
    return () => {
      alive = false;
    };
  }, [m.id, url]);
  return <div className="pb-media-thumb">{url && <img src={url} alt="" />}</div>;
}

export function MediaSheet() {
  const [items, setItems] = useState<MediaAsset[] | null>(null);
  const [info, setInfo] = useState<MediaAsset | null>(null);
  const [name, setName] = useState('');
  const refresh = () => void publishStore().then((s) => s.listMedia().then(setItems));
  useEffect(refresh, []);

  const place = async (m: MediaAsset) => {
    await ensureImages([m.id]);
    const e = imageFor(m);
    st().apply(addElement(st().tile!, e));
    st().set({ selected: e.id, sheet: 'none' });
  };

  return (
    <section className="pb-sheet tall" role="dialog" aria-label="Media">
      <div className="pb-grab" />
      <div className="pb-row">
        <span className="pb-label">Media</span>
        <button
          className="pb-pill primary"
          onClick={async () => {
            const added = await importPhotos();
            refresh();
            if (added.length === 1) void place(added[0]);
          }}
        >
          <Plus size={18} /> From phone
        </button>
      </div>
      {items && !items.length && <p className="pb-hint">Your pictures live here and can be reused in any tile. Add some from your phone.</p>}
      {info ? (
        <div className="pb-media-info">
          <MediaThumb m={info} />
          {info.wpMediaId ? (
            <p className="pb-hint">On WordPress: its name stays fixed so every post keeps using the same file.</p>
          ) : (
            <label className="pb-field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <p className="pb-hint">
            {info.name} · {info.width} × {info.height} · {Math.round(info.bytes / 1024)} KB
          </p>
          <div className="pb-row">
            <button
              className="pb-pill danger"
              onClick={async () => {
                const used = await (await publishStore()).deleteMedia(info.id);
                if (used.length) st().showToast(`Used in ${used.join(', ')} — remove it there first.`);
                else {
                  setInfo(null);
                  refresh();
                }
              }}
            >
              <Trash2 size={16} /> Delete
            </button>
            <span className="pb-spacer" />
            <button className="pb-pill" onClick={() => setInfo(null)}>
              Cancel
            </button>
            <button
              className="pb-pill primary"
              disabled={!!info.wpMediaId}
              onClick={async () => {
                await (await publishStore()).renameMedia(info.id, name);
                setInfo(null);
                refresh();
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="pb-media-grid">
          {items?.map((m) => (
            <div key={m.id} className="pb-media">
              <button className="pb-media-pick" onClick={() => void place(m)} aria-label={`Place ${m.name}`}>
                <MediaThumb m={m} />
              </button>
              <button
                className="pb-media-name"
                onClick={() => {
                  setInfo(m);
                  setName(m.name.replace(/-(?:\d{8}|\d{2}(?:-drawing|-spiral)?)-[0-9a-f]{6}\.[a-z0-9]+$/, '').replace(/-/g, ' '));
                }}
              >
                <Info size={12} /> {m.name}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

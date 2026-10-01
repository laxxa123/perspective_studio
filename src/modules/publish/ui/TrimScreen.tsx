// Trim (PUBLISH §5.2): the whole picture with a crop frame — drag the corners
// or edges, drag inside to move; aspect presets; Reset. Done keeps the
// element's width and centre and lets the height follow (never distorted).
// Resizing happens on the tile with the handles.
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { boxForCrop, clampCrop, cropToAspect, type Crop } from '../core/layout';
import { updateElement } from '../core/tile';
import type { ImageElement, MediaAsset } from '../core/types';
import { publishStore } from '../storage/PublishStore';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;
const ASPECTS: [string, number | null | 'original'][] = [
  ['Free', null],
  ['Original', 'original'],
  ['1:1', 1],
  ['4:5', 4 / 5],
  ['3:4', 3 / 4],
  ['9:16', 9 / 16],
  ['16:9', 16 / 9],
];
type Handle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export function TrimScreen({ el }: { el: ImageElement }) {
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>(el.crop);
  const [aspectKey, setAspectKey] = useState('Free');
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 300, h: 400 });
  const drag = useRef<{ h: Handle; x: number; y: number; c: Crop } | null>(null);

  useEffect(() => {
    let u: string | null = null;
    void (async () => {
      const s = await publishStore();
      const m = await s.media(el.mediaId);
      const b = await s.blob(el.mediaId);
      if (!m || !b) return;
      u = URL.createObjectURL(b);
      setMedia(m);
      setUrl(u);
    })();
    const ro = new ResizeObserver(() => area.current && setSize({ w: area.current.clientWidth, h: area.current.clientHeight }));
    if (area.current) ro.observe(area.current);
    return () => {
      ro.disconnect();
      if (u) URL.revokeObjectURL(u);
    };
  }, [el.mediaId]);

  if (!media)
    return (
      <div className="pb-trim" role="dialog" aria-label="Trim">
        <header className="pb-top dark">
          <button className="pb-pill ghost" onClick={() => st().set({ overlay: 'none' })}>
            Cancel
          </button>
          <span className="pb-hint">Trim</span>
        </header>
        <div className="pb-trim-area" ref={area} />
      </div>
    );
  const ia = media.width / media.height;
  const fit = Math.min((size.w - 32) / media.width, (size.h - 32) / media.height);
  const dw = media.width * fit;
  const dh = media.height * fit;
  const dx = (size.w - dw) / 2;
  const dy = (size.h - dh) / 2;
  const aspect = ASPECTS.find(([k]) => k === aspectKey)?.[1] ?? null;
  const ratio = aspect === 'original' ? ia : aspect; // picture px w / h

  const down = (e: RPointerEvent<HTMLElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { h: (e.currentTarget.dataset.h ?? 'move') as Handle, x: e.clientX, y: e.clientY, c: crop };
  };
  const move = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const ddx = (e.clientX - d.x) / dw;
    const ddy = (e.clientY - d.y) / dh;
    const c = { ...d.c };
    if (d.h === 'move') {
      c.x += ddx;
      c.y += ddy;
      setCrop(clampCrop(c));
      return;
    }
    if (d.h.includes('w')) {
      c.x = d.c.x + ddx;
      c.w = d.c.w - ddx;
    }
    if (d.h.includes('e')) c.w = d.c.w + ddx;
    if (d.h.includes('n')) {
      c.y = d.c.y + ddy;
      c.h = d.c.h - ddy;
    }
    if (d.h.includes('s')) c.h = d.c.h + ddy;
    if (ratio) {
      // Keep the aspect: height follows width (normalised units differ by the picture's aspect).
      const h = (c.w * ia) / ratio;
      if (d.h.includes('n')) c.y = d.c.y + d.c.h - h;
      c.h = h;
    }
    const k = clampCrop(c);
    if (ratio && (k.w !== c.w || k.h !== c.h)) return;
    setCrop(k);
  };
  const up = () => (drag.current = null);

  const pick = (key: string, a: number | null | 'original') => {
    setAspectKey(key);
    const r = a === 'original' ? ia : a;
    if (r) setCrop(cropToAspect(crop, r, media));
  };
  const done = () => {
    st().apply(updateElement(st().tile!, el.id, boxForCrop(el, crop, media)));
    st().set({ overlay: 'none' });
  };

  const box = { left: dx + crop.x * dw, top: dy + crop.y * dh, width: crop.w * dw, height: crop.h * dh };
  const handles: Handle[] = ratio ? ['nw', 'ne', 'sw', 'se'] : ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div className="pb-trim" role="dialog" aria-label="Trim">
      <header className="pb-top dark">
        <button className="pb-pill ghost" onClick={() => st().set({ overlay: 'none' })}>
          Cancel
        </button>
        <span className="pb-hint">Trim</span>
        <button className="pb-pill primary" onClick={done}>
          Done
        </button>
      </header>
      <div className="pb-trim-area" ref={area} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        {url && <img src={url} alt="" style={{ left: dx, top: dy, width: dw, height: dh }} />}
        <div className="pb-crop" style={box} data-h="move" onPointerDown={down}>
          <i className="pb-thirds" />
          {handles.map((h) => (
            <span key={h} className={`pb-h ${h}`} data-h={h} onPointerDown={down} />
          ))}
        </div>
        <div className="pb-shade" style={{ clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${box.left}px ${box.top}px, ${box.left}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top + box.height}px, ${box.left + box.width}px ${box.top}px, ${box.left}px ${box.top}px)` }} />
      </div>
      <footer className="pb-trim-bar">
        {ASPECTS.map(([k, a]) => (
          <button key={k} className={k === aspectKey ? 'on' : ''} onClick={() => pick(k, a)}>
            {k}
          </button>
        ))}
        <button aria-label="Reset" onClick={() => (setCrop({ x: 0, y: 0, w: 1, h: 1 }), setAspectKey('Free'))}>
          <RotateCcw size={16} />
        </button>
      </footer>
    </div>
  );
}

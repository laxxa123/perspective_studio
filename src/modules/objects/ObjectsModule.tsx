// The OBJECTS module, M0 (OBJECTS §A.10): build a block object in a live 3D
// viewport and see it as the isometric line drawing every question will use.
// The block list is the only state; it is kept on the device as you work.
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Box, Eraser, Focus, Redo2, RotateCw, Trash2, Undo2 } from 'lucide-react';
import { add, cannotAdd, connected, readBlocks, remove, STARTER, turnAll, MAX_BLOCKS, MAX_EXTENT, type Axis, type Blocks, type Cell } from './core/blocks';
import { isoSvg } from './core/iso';
import type { Hit } from './render/BlockScene';
import { Viewport } from './ui/Viewport';
import './objects.css';

type Tool = 'add' | 'remove';
const KEY = 'creative.objects.draft.v0';
const REFUSED = {
  occupied: '',
  full: `At most ${MAX_BLOCKS} blocks`,
  'too-big': `At most ${MAX_EXTENT} blocks in each direction`,
  'below-floor': '',
  detached: 'Add next to a block',
} as const;

function loadDraft(): Blocks {
  try {
    return readBlocks(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? STARTER;
  } catch {
    return STARTER;
  }
}

const svgUrl = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export default function ObjectsModule({ onExit }: { onExit: () => void }) {
  const [hist, setHist] = useState<{ past: Blocks[]; now: Blocks; future: Blocks[] }>(() => ({ past: [], now: loadDraft(), future: [] }));
  const [tool, setTool] = useState<Tool>('add');
  const [frameKey, setFrameKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const blocks = hist.now;

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(blocks));
    } catch {
      // Storage blocked: the object stays for this session.
    }
  }, [blocks]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const commit = (next: Blocks) => setHist((h) => (next === h.now ? h : { past: [...h.past, h.now].slice(-100), now: next, future: [] }));
  const undo = () => setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now, ...h.future] } : h));
  const redo = () => setHist((h) => (h.future.length ? { past: [...h.past, h.now], now: h.future[0], future: h.future.slice(1) } : h));

  const onTap = (hit: Hit | null) => {
    if (!hit) return;
    if (tool === 'remove') {
      if (hit.kind === 'block') commit(remove(blocks, hit.cell));
      return;
    }
    const c: Cell = hit.kind === 'floor' ? hit.cell : [hit.cell[0] + hit.normal[0], hit.cell[1] + hit.normal[1], hit.cell[2] + hit.normal[2]];
    const why = cannotAdd(blocks, c);
    if (why) {
      if (REFUSED[why]) setToast(REFUSED[why]);
      return;
    }
    commit(add(blocks, c));
  };
  const turn = (a: Axis) => {
    commit(turnAll(blocks, a));
    setFrameKey((k) => k + 1);
  };

  const svg = useMemo(() => isoSvg(blocks, { size: 240 }), [blocks]);
  const small = useMemo(() => isoSvg(blocks, { size: 96, stroke: 1.2 }), [blocks]);
  const tiny = useMemo(() => isoSvg(blocks, { size: 64, stroke: 1 }), [blocks]);
  const onePiece = connected(blocks);

  return (
    <div className="ob-module">
      <header className="ob-head">
        <button className="icon" aria-label="Back to CREATIVE" onClick={onExit}>
          <ArrowLeft size={20} />
        </button>
        <h1>OBJECTS</h1>
        <span className="ob-badge">M0 · blocks</span>
      </header>

      <Viewport blocks={blocks} onTap={onTap} frameKey={frameKey} />

      <section className="ob-drawings" aria-label="Isometric drawing">
        <img src={svgUrl(svg)} width={120} height={120} alt="Isometric drawing (question size)" />
        <img src={svgUrl(small)} width={96} height={96} alt="Option size" />
        <img src={svgUrl(tiny)} width={64} height={64} alt="Small size" />
        <p className={onePiece ? 'ok' : 'bad'}>
          {blocks.length} block{blocks.length === 1 ? '' : 's'}
          <br />
          {blocks.length === 0 ? 'Tap the floor to add' : onePiece ? '✓ One piece' : '⚠ Not in one piece'}
        </p>
      </section>

      <nav className="ob-bar" aria-label="Build">
        <button className={tool === 'add' ? 'on' : ''} aria-label="Add blocks" aria-pressed={tool === 'add'} onClick={() => setTool('add')}>
          <Box size={18} />
        </button>
        <button className={tool === 'remove' ? 'on' : ''} aria-label="Remove blocks" aria-pressed={tool === 'remove'} onClick={() => setTool('remove')}>
          <Eraser size={18} />
        </button>
        <span className="ob-sep" />
        {(['x', 'y', 'z'] as Axis[]).map((a) => (
          <button key={a} aria-label={`Turn a quarter about ${a.toUpperCase()}`} onClick={() => turn(a)} disabled={!blocks.length}>
            <RotateCw size={18} />
            <span>{a.toUpperCase()}</span>
          </button>
        ))}
        <span className="ob-sep" />
        <button aria-label="Undo" onClick={undo} disabled={!hist.past.length}>
          <Undo2 size={18} />
        </button>
        <button aria-label="Redo" onClick={redo} disabled={!hist.future.length}>
          <Redo2 size={18} />
        </button>
        <button aria-label="Fit the view" onClick={() => setFrameKey((k) => k + 1)}>
          <Focus size={18} />
        </button>
        <button aria-label="Clear" onClick={() => (commit([]), setToast('Cleared · Undo brings it back'))} disabled={!blocks.length}>
          <Trash2 size={18} />
        </button>
      </nav>
      {toast && <div className="ob-toast">{toast}</div>}
    </div>
  );
}

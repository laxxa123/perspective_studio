// The settings of each question type (OBJECTS §A.5): axis and turn, side,
// layer, what to count, the 2D steps, the folds and holes.
import { Plus, Undo2 } from 'lucide-react';
import type { Axis } from '../core/blocks';
import { REFLECTIONS, TURNS, type Op } from '../core/figure';
import { canPunch, foldProblem, regions, type Fold, type FoldSpec } from '../core/fold';
import type { Family, Params as P } from '../core/questions';
import { foldedSvg } from '../core/sheet';
import { layers, SIDES } from '../core/space';
import { useObjects } from '../state/store';
import { GridTap } from './GridTap';

const st = useObjects.getState;
const AXES: [Axis, string][] = [
  ['y', 'Upright'],
  ['x', 'Left–right'],
  ['z', 'Front–back'],
];
const OP_LABEL: Record<Op, string> = { r90: '90° ↻', r180: '180°', r270: '90° ↺', fv: '│ line', fh: '— line', fd: '╲ line', fa: '╱ line' };

function Seg<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return (
    <div className="ob-param">
      <span>{label}</span>
      <div className="ob-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={String(v)} role="radio" aria-checked={v === value} className={v === value ? 'on' : ''} onClick={() => onPick(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Params({ family }: { family: Family }) {
  const p = useObjects((s) => s.params);
  const blocks = useObjects((s) => s.blocks);
  const fold = useObjects((s) => s.fold);
  const set = (patch: Partial<P>) => {
    st().set({ params: { ...p, ...patch } });
    st().generate();
  };
  const setFold = (f: FoldSpec) => {
    st().edit({ fold: f });
    st().generate();
  };
  switch (family) {
    case 'turn':
    case 'track':
      return (
        <>
          <Seg label="Axis" value={p.axis} options={AXES} onPick={(axis) => set({ axis })} />
          <Seg
            label="Turn"
            value={p.quarters}
            options={[
              [1, '90°'],
              [2, '180°'],
              [3, '90° back'],
            ]}
            onPick={(quarters) => set({ quarters })}
          />
        </>
      );
    case 'view':
      return <Seg label="From" value={p.side} options={SIDES.map((s) => [s, s[0].toUpperCase() + s.slice(1)])} onPick={(side) => set({ side })} />;
    case 'count':
      return (
        <Seg
          label="Count"
          value={p.count}
          options={[
            ['all', 'All blocks'],
            ['hidden', 'Hidden blocks'],
          ]}
          onPick={(count) => set({ count })}
        />
      );
    case 'section': {
      const n = layers(blocks, p.axis);
      return (
        <>
          <Seg label="Cut" value={p.axis} options={[['y', 'Level'], ['z', 'Front–back'], ['x', 'Left–right']]} onPick={(axis) => set({ axis, layer: 0 })} />
          <Seg label="Layer" value={Math.min(p.layer, n - 1)} options={Array.from({ length: n }, (_, i) => [i, String(i + 1)] as [number, string])} onPick={(layer) => set({ layer })} />
        </>
      );
    }
    case 'f-turn':
      return <Seg label="Turn" value={TURNS.includes(p.ops[0]) ? p.ops[0] : 'r90'} options={TURNS.map((o) => [o, OP_LABEL[o]])} onPick={(o) => set({ ops: [o] })} />;
    case 'f-reflect':
      return <Seg label="Mirror" value={REFLECTIONS.includes(p.ops[0]) ? p.ops[0] : 'fv'} options={REFLECTIONS.map((o) => [o, OP_LABEL[o]])} onPick={(o) => set({ ops: [o] })} />;
    case 'f-steps': {
      const [a, b] = [p.ops[0] ?? 'r90', p.ops[1] ?? 'fv'];
      const all = [...TURNS, ...REFLECTIONS].map((o) => [o, OP_LABEL[o]] as [Op, string]);
      return (
        <>
          <Seg label="First" value={a} options={all} onPick={(o) => set({ ops: [o, b] })} />
          <Seg label="Then" value={b} options={all} onPick={(o) => set({ ops: [a, o] })} />
        </>
      );
    }
    case 'fold': {
      const last = regions(fold).at(-1)!;
      const addFold = (f: Fold) => {
        const next = { ...fold, folds: [...fold.folds, f], holes: [] };
        if (foldProblem(next)) return st().showToast(foldProblem(next)!);
        setFold(next);
      };
      return (
        <>
          <Seg label="Sheet" value={fold.n} options={[[4, '4 × 4'], [6, '6 × 6'], [8, '8 × 8']]} onPick={(n) => setFold({ n, folds: [], holes: [] })} />
          <div className="ob-param">
            <span>Folds</span>
            <div className="ob-seg">
              <button aria-label="Fold the right half onto the left" onClick={() => addFold('v')}>
                <Plus size={13} /> ⇤ half
              </button>
              <button aria-label="Fold the bottom half onto the top" onClick={() => addFold('h')}>
                <Plus size={13} /> ⇡ half
              </button>
              <button aria-label="Fold along the diagonal" onClick={() => addFold('d')}>
                <Plus size={13} /> ◩ diagonal
              </button>
              <button aria-label="Undo the last fold" disabled={!fold.folds.length} onClick={() => setFold({ ...fold, folds: fold.folds.slice(0, -1), holes: [] })}>
                <Undo2 size={13} />
              </button>
            </div>
          </div>
          <div className="ob-param">
            <span>Punch</span>
            <div className="ob-punch">
              <GridTap
                svg={foldedSvg(fold, 160)}
                cols={last.w}
                rows={last.h}
                size={160}
                label="Folded sheet: tap to punch"
                onTap={(c, r) => {
                  if (!canPunch(fold, [c, r])) return;
                  const on = fold.holes.some((h) => h[0] === c && h[1] === r);
                  setFold({ ...fold, holes: on ? fold.holes.filter((h) => !(h[0] === c && h[1] === r)) : [...fold.holes, [c, r]] });
                }}
              />
            </div>
          </div>
        </>
      );
    }
    default:
      return null;
  }
}

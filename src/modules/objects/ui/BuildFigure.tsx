// Build · 2D figure (OBJECTS §A.4): tap squares to fill them; dots and
// arrows (tap an arrow again to turn it) make turns and mirror images
// tell apart.
import { ArrowUp, CircleDot, Eraser, Square, Trash2 } from 'lucide-react';
import { clearAt, emptyFigure, toggleCell, toggleMark } from '../core/figure';
import { figureSvg } from '../core/sheet';
import { useObjects, type FigureTool } from '../state/store';
import { GridTap } from './GridTap';

const st = useObjects.getState;
const TOOLS: [FigureTool, string, typeof Square][] = [
  ['fill', 'Fill squares', Square],
  ['dot', 'Dots', CircleDot],
  ['arrow', 'Arrows', ArrowUp],
  ['erase', 'Erase', Eraser],
];

export function BuildFigure() {
  const figure = useObjects((s) => s.figure);
  const tool = useObjects((s) => s.figureTool);
  const size = 320;
  const tap = (c: number, r: number) => {
    const f = tool === 'fill' ? toggleCell(figure, c, r) : tool === 'erase' ? clearAt(figure, c, r) : toggleMark(figure, c, r, tool === 'dot' ? 'dot' : 'arrow');
    st().edit({ figure: f });
  };
  return (
    <>
      <div className="ob-figure">
        <GridTap svg={figureSvg(figure, size)} cols={figure.n} rows={figure.n} size={size} onTap={tap} label="Figure grid" />
      </div>
      <section className="ob-strip">
        <div className="ob-seg" role="radiogroup" aria-label="Grid size">
          {[6, 8].map((n) => (
            <button key={n} role="radio" aria-checked={figure.n === n} className={figure.n === n ? 'on' : ''} onClick={() => figure.n !== n && st().edit({ figure: emptyFigure(n) })}>
              {n} × {n}
            </button>
          ))}
        </div>
        <p>
          <b>{figure.cells.length} squares</b>
          <br />
          {figure.marks.length ? `${figure.marks.length} mark${figure.marks.length > 1 ? 's' : ''}` : 'Add a dot or an arrow'}
        </p>
      </section>
      <nav className="ob-bar" aria-label="Draw">
        {TOOLS.map(([t, label, Icon]) => (
          <button key={t} className={tool === t ? 'on' : ''} aria-label={label} aria-pressed={tool === t} onClick={() => st().set({ figureTool: t })}>
            <Icon size={18} />
            <span>{label.split(' ')[0]}</span>
          </button>
        ))}
        <span className="ob-sep" />
        <button aria-label="Clear" disabled={!figure.cells.length && !figure.marks.length} onClick={() => (st().edit({ figure: emptyFigure(figure.n) }), st().showToast('Cleared · Undo brings it back'))}>
          <Trash2 size={18} />
        </button>
      </nav>
    </>
  );
}

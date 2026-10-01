// Tools (CUBE §13): select, net layout, drawing, text, stamps, images, eraser;
// undo / redo always at hand (CUBE §45 fast recovery).
import { ArrowUpRight, Circle, Eraser, Hexagon, Image as ImageIcon, LayoutGrid, Minus, MousePointer2, PenLine, Redo2, Square, Stamp, Type, Undo2 } from 'lucide-react';
import { useCubeStore, type Tool } from '../state/useCubeStore';

const TOOLS: { id: Tool; label: string; icon: typeof Square }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'net', label: 'Net', icon: LayoutGrid },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'line', label: 'Line', icon: Minus },
  { id: 'arrow', label: 'Arrow', icon: ArrowUpRight },
  { id: 'rect', label: 'Rect', icon: Square },
  { id: 'ellipse', label: 'Ellipse', icon: Circle },
  { id: 'polygon', label: 'Polygon', icon: Hexagon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stamp', label: 'Stamp', icon: Stamp },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];

export function ToolBar() {
  const tool = useCubeStore((s) => s.tool);
  const canUndo = useCubeStore((s) => s.past.length > 0);
  const canRedo = useCubeStore((s) => s.future.length > 0);
  const st = useCubeStore.getState;
  return (
    <nav className="cube-tools" aria-label="Tools">
      <button className="tool-btn" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}>
        <Undo2 size={20} />
        <span>Undo</span>
      </button>
      <button className="tool-btn" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}>
        <Redo2 size={20} />
        <span>Redo</span>
      </button>
      <span className="tool-sep" />
      {TOOLS.map((t) => (
        <button key={t.id} className={tool === t.id ? 'tool-btn active' : 'tool-btn'} aria-pressed={tool === t.id} onClick={() => st().set({ tool: t.id })}>
          <t.icon size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

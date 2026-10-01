// Tools (CUBE §13, v1.2): new, undo / redo, the 3D cube pop-up, then select,
// net layout, pen, shapes (one tool; the shape is chosen below the canvas),
// text, stamps, image, face fill and eraser.
import { Box, Eraser, FilePlus2, Image as ImageIcon, LayoutGrid, MousePointer2, PaintBucket, PenLine, Redo2, Shapes, Stamp, Type, Undo2 } from 'lucide-react';
import { useCubeStore, type Tool } from '../state/useCubeStore';
import { startModel } from '../services/CubeService';
import { startImageSkin } from './imageSkin';

const TOOLS: { id: Tool; label: string; icon: typeof Box }[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'net', label: 'Net', icon: LayoutGrid },
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'shape', label: 'Shape', icon: Shapes },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'stamp', label: 'Stamp', icon: Stamp },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'fill', label: 'Fill', icon: PaintBucket },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
];

const st = useCubeStore.getState;

/** Starts a blank cube; the work in progress stays one Undo away. */
export function newCube() {
  st().apply(startModel());
  st().set({ question: null, editing: null, selected: null, selectedFace: null, skin: null, tool: 'select', step: 'design' });
  st().showToast('New blank cube. Undo brings the previous one back.');
}

export function ToolBar() {
  const tool = useCubeStore((s) => s.tool);
  const canUndo = useCubeStore((s) => s.past.length > 0);
  const canRedo = useCubeStore((s) => s.future.length > 0);
  const placing = useCubeStore((s) => s.skin !== null);
  return (
    <nav className="cube-tools" aria-label="Tools">
      <button className="tool-btn" aria-label="New cube" disabled={placing} onClick={newCube}>
        <FilePlus2 size={20} />
        <span>New</span>
      </button>
      <button className="tool-btn" aria-label="Undo" disabled={!canUndo || placing} onClick={() => st().undo()}>
        <Undo2 size={20} />
        <span>Undo</span>
      </button>
      <button className="tool-btn" aria-label="Redo" disabled={!canRedo || placing} onClick={() => st().redo()}>
        <Redo2 size={20} />
        <span>Redo</span>
      </button>
      <button className="tool-btn" aria-label="3D cube" onClick={() => st().set({ show3d: true })}>
        <Box size={20} />
        <span>3D</span>
      </button>
      <span className="tool-sep" />
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={tool === t.id ? 'tool-btn active' : 'tool-btn'}
          aria-pressed={tool === t.id}
          disabled={placing && t.id !== 'image'}
          onClick={() => (t.id === 'image' ? void startImageSkin() : st().set({ tool: t.id, selected: t.id === 'select' ? st().selected : null }))}
        >
          <t.icon size={20} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

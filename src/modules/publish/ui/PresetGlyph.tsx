import { Blend, Brush, Eraser, Highlighter, Paintbrush, Pencil, PenTool, SprayCan } from 'lucide-react';

const ICONS = { pencil: Pencil, pen: PenTool, marker: Highlighter, brush: Brush, soft: Paintbrush, airbrush: SprayCan, blender: Blend, eraser: Eraser } as const;

/** The icon for a SKETCH brush preset. */
export function PresetGlyph({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = ICONS[id as keyof typeof ICONS] ?? Brush;
  return <Icon size={size} />;
}

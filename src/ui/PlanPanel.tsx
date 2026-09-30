// Plan view panel (CV-05, OD-10, OD-13): read-only top view; tap selects.
import { useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { hitPlan } from '../core/derive/plan';
import type { SceneDocument } from '../core/document/types';
import { fitRect, stageTransform, toPicture } from '../core/viewport/viewport';
import { PlanView } from '../render/konva/PlanView';
import { planModelOf } from '../state/derived';
import { useUiStore } from '../state/uiStore';
import type { Theme } from '../theme/theme';

export function PlanPanel({ doc, theme, width, height }: { doc: SceneDocument; theme: Theme; width: number; height: number }) {
  const selection = useUiStore((s) => s.selection);
  const model = planModelOf(doc);
  const sel = useMemo(() => new Set(selection), [selection]);
  // Auto-fits the eye, the origin and every object.
  const view = fitRect(model.bounds, width, height, { top: 14, right: 14, bottom: 14, left: 14 });
  const down = useRef<{ x: number; y: number } | null>(null);

  return (
    <aside className="panel plan" style={{ height: height + 40 }}>
      <header>
        <strong>Plan</strong>
        <span className="muted">eye at the bottom, looking up</span>
        <button className="icon" aria-label="Close plan" onClick={() => useUiStore.getState().set({ planOpen: false })}>
          <X size={18} />
        </button>
      </header>
      <div
        className="plan-surface"
        onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const d = down.current;
          down.current = null;
          if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return;
          const r = e.currentTarget.getBoundingClientRect();
          const p = toPicture(view, { x: e.clientX - r.left, y: e.clientY - r.top });
          const id = hitPlan(model, p, 8 / view.zoom);
          useUiStore.getState().select(id ? [id] : []);
        }}
      >
        <PlanView width={width} height={height} transform={stageTransform(view)} model={model} selection={sel} theme={theme} />
      </div>
    </aside>
  );
}

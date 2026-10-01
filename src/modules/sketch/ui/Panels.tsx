// One floating panel at a time, above the bar; tapping outside closes it.
import { useSketchStore } from '../state/useSketchStore';
import { BrushPanel } from './BrushPanel';
import { ColorPanel } from './ColorPanel';
import { GridPanel } from './GridPanel';
import { LayerPanel } from './LayerPanel';
import { MorePanel } from './MorePanel';
import { ReferencePanel } from './ReferencePanel';

export function Panels() {
  const panel = useSketchStore((s) => s.panel);
  const toast = useSketchStore((s) => s.toast);
  return (
    <>
      {panel !== 'none' && <div className="sk-scrim" onPointerDown={() => useSketchStore.getState().set({ panel: 'none' })} />}
      <div className={`sk-sheet${panel === 'more' ? ' right' : ''}`}>
        {panel === 'brush' && <BrushPanel />}
        {panel === 'color' && <ColorPanel />}
        {panel === 'layers' && <LayerPanel />}
        {panel === 'grid' && <GridPanel />}
        {panel === 'more' && <MorePanel />}
        {panel === 'reference' && <ReferencePanel />}
      </div>
      {toast && <div className="sk-toast">{toast}</div>}
    </>
  );
}

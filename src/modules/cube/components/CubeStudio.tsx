// CUBE Studio (CUBE §9, v1.2): 1 · Design — tools, the net board and
// contextual properties, the 3D cube in a pop-up; 2 · Question — the question
// builder over the full width.
import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { CubeModel } from '../model/CubeModel';
import { boardSize } from '../geometry/Board';
import { importImage } from '../services/CubeService';
import { useCubeStore } from '../state/useCubeStore';
import { Cube3DViewer } from './Cube3DViewer';
import { NetCanvas } from './NetCanvas';
import { PropertiesPanel } from './PropertiesPanel';
import { QuestionBuilder } from './QuestionBuilder';
import { ToolBar } from './ToolBar';

export function CubeStudio({ model }: { model: CubeModel }) {
  const step = useCubeStore((s) => s.step);
  const assets = useCubeStore((s) => s.assets);
  const selectedFace = useCubeStore((s) => s.selectedFace);
  const show3d = useCubeStore((s) => s.show3d);
  const st = useCubeStore.getState;

  // Paste a picture: it is laid over the board to place, like the Image tool.
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file || st().step !== 'design' || !st().model) return;
      e.preventDefault();
      const a = await importImage(file);
      st().addAsset(a.id, a.data);
      const size = boardSize(st().model!.net.cells);
      const w = Math.min(size.cols, size.rows * a.aspect);
      st().set({ tool: 'image', selected: null, skin: { assetId: a.id, x: size.cols / 2, y: size.rows / 2, w, h: w / a.aspect, rotation: 0 } });
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [st]);

  return (
    <div className="studio">
      <div className="steps">
        <button className={step === 'design' ? 'seg active' : 'seg'} onClick={() => st().set({ step: 'design' })}>
          1 · Design cube
        </button>
        <button className={step === 'question' ? 'seg active' : 'seg'} onClick={() => st().set({ step: 'question', selected: null, skin: null, show3d: false })}>
          2 · Question
        </button>
      </div>
      {step === 'design' ? (
        <div className="studio-grid">
          <ToolBar />
          <NetCanvas model={model} assets={assets} />
          <PropertiesPanel model={model} />
        </div>
      ) : (
        <div className="studio-question">
          <QuestionBuilder model={model} />
        </div>
      )}
      {show3d && step === 'design' && (
        <div className="cube-modal" role="dialog" aria-label="3D cube" onPointerDown={(e) => e.target === e.currentTarget && st().set({ show3d: false })}>
          <div className="cube-modal-card">
            <button className="icon cube-modal-close" aria-label="Close" onClick={() => st().set({ show3d: false })}>
              <X size={20} />
            </button>
            <Cube3DViewer model={model} assets={assets} selected={selectedFace} onSelect={(f) => st().set({ selectedFace: f, selected: null })} />
          </div>
        </div>
      )}
    </div>
  );
}

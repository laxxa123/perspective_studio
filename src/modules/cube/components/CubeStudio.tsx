// CUBE Studio (CUBE §9): tools, net canvas and live 3D cube, contextual
// properties below; then the question builder.
import { useEffect } from 'react';
import type { CubeModel } from '../model/CubeModel';
import { place } from '../model/edit';
import { imageElement } from '../canvas/Interaction';
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
  const st = useCubeStore.getState;

  // Paste an image onto the selected face (CUBE §13).
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (!file || st().step !== 'design') return;
      e.preventDefault();
      const a = await importImage(file);
      st().addAsset(a.id, a.data);
      const r = place(st().model!, st().selectedFace ?? 'A', imageElement(a.id, a.aspect));
      st().apply(r.model);
      st().set({ selected: r.ref, selectedFace: r.ref.face, tool: 'select' });
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
        <button className={step === 'question' ? 'seg active' : 'seg'} onClick={() => st().set({ step: 'question', selected: null })}>
          2 · Question
        </button>
      </div>
      {step === 'design' ? (
        <div className="studio-grid">
          <ToolBar />
          <NetCanvas model={model} assets={assets} />
          <Cube3DViewer model={model} assets={assets} selected={selectedFace} onSelect={(f) => st().set({ selectedFace: f, selected: null })} />
          <PropertiesPanel model={model} />
        </div>
      ) : (
        <div className="studio-question">
          <Cube3DViewer model={model} assets={assets} selected={selectedFace} onSelect={(f) => st().set({ selectedFace: f })} />
          <QuestionBuilder model={model} />
        </div>
      )}
    </div>
  );
}

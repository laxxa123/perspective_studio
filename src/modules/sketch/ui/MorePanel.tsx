// "More" (SKETCH §5, §20): view, export / share, reference image, settings.
import { Download, Image, Maximize, Scan, Settings, Share2 } from 'lucide-react';
import { useSketchStore } from '../state/useSketchStore';
import { engineRef, saveOpenPng, shareOpen } from './session';

const st = useSketchStore.getState;

export function MorePanel() {
  const run = async (what: () => Promise<unknown>, done?: string) => {
    st().set({ panel: 'none' });
    try {
      const r = await what();
      if (done) st().showToast(typeof r === 'string' ? `${done} ${r}` : done);
    } catch (e) {
      if (!/cancel/i.test(String(e))) st().showToast(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <div className="sk-panel sk-menu" role="dialog" aria-label="More">
      <button onClick={() => (engineRef.current?.fit(), st().set({ panel: 'none' }))}>
        <Maximize size={18} /> Fit to screen
      </button>
      <button onClick={() => (engineRef.current?.actualSize(), st().set({ panel: 'none' }))}>
        <Scan size={18} /> 100 %
      </button>
      <button onClick={() => void run(saveOpenPng, 'Saved to')}>
        <Download size={18} /> Save PNG
      </button>
      <button onClick={() => void run(shareOpen)}>
        <Share2 size={18} /> Share PNG
      </button>
      <button onClick={() => st().set({ panel: 'reference' })}>
        <Image size={18} /> Reference image
      </button>
      <button onClick={() => st().set({ page: 'settings', back: 'editor', panel: 'none' })}>
        <Settings size={18} /> Settings
      </button>
    </div>
  );
}

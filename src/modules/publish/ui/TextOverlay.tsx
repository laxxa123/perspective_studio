// Writing text (PUBLISH §6.2): a calm full-screen writer over the tile, in the
// element's own font and colour. Done keeps it; Cancel drops the changes (and a
// just-added element). Empty text removes the element.
import { useState } from 'react';
import { removeElement, updateElement } from '../core/tile';
import type { SpiralElement, TextElement } from '../core/types';
import { fittedTextHeight } from '../render/draw';
import { fontStack } from '../core/tile';
import { usePublishStore } from '../state/usePublishStore';

const st = usePublishStore.getState;

export function TextOverlay({ el }: { el: TextElement | SpiralElement }) {
  const [text, setText] = useState(el.text);
  const fresh = usePublishStore((s) => s.fresh === el.id);
  const close = () => st().set({ overlay: 'none', fresh: null });
  const done = () => {
    const t = text.replace(/\s+$/, '');
    const tile = st().tile!;
    if (!t.trim()) st().apply(removeElement(tile, el.id));
    else if (t !== el.text) {
      if (el.kind === 'text') {
        const h = fittedTextHeight({ ...el, text: t });
        st().apply(updateElement<TextElement>(tile, el.id, { text: t, h, y: el.y + el.h / 2 - h / 2 }));
      } else st().apply(updateElement<SpiralElement>(tile, el.id, { text: t }));
    }
    close();
  };
  const cancel = () => {
    if (fresh) st().apply(removeElement(st().tile!, el.id));
    close();
  };
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="pb-writer" role="dialog" aria-label={el.kind === 'text' ? 'Edit text' : 'Edit spiral text'}>
      <header className="pb-top">
        <button className="pb-pill ghost" onClick={cancel}>
          Cancel
        </button>
        <span className="pb-hint">{words === 1 ? '1 word' : `${words} words`}</span>
        <button className="pb-pill primary" onClick={done}>
          Done
        </button>
      </header>
      <textarea
        autoFocus
        value={text}
        placeholder={el.kind === 'text' ? 'Type something' : 'Words for the coil'}
        onChange={(e) => setText(e.target.value)}
        onFocus={(e) => fresh && e.currentTarget.select()}
        style={{ fontFamily: fontStack(el.font), fontWeight: el.font === 'Roboto' ? el.weight : 400, textAlign: el.kind === 'text' ? el.align : 'left' }}
      />
    </div>
  );
}

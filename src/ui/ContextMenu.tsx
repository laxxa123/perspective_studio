// Long-press context menu (§10.3): duplicate, delete, stack on top, bring forward.
import { addEntity, deleteEntities, duplicateEntities, reorderEntity } from '../core/commands/commands';
import { newId } from '../core/document/ids';
import type { BoxEntity, SceneDocument } from '../core/document/types';
import { useDocumentStore } from '../state/documentStore';
import { useUiStore } from '../state/uiStore';

export function ContextMenu({ doc }: { doc: SceneDocument }) {
  const menu = useUiStore((s) => s.contextMenu);
  if (!menu) return null;
  const e = doc.entities[menu.id];
  if (!e || 'unknown' in e) return null;
  const run = useDocumentStore.getState().run;
  const ui = useUiStore.getState();
  const close = () => ui.set({ contextMenu: null });
  const item = (label: string, fn: () => void, danger = false) => (
    <button className={danger ? 'danger' : undefined} onClick={() => { fn(); close(); }}>
      {label}
    </button>
  );
  return (
    <div className="ctx-backdrop" onPointerDown={close}>
      <div className="menu ctx" style={{ left: Math.min(menu.x, window.innerWidth - 190), top: Math.min(menu.y, window.innerHeight - 220) }} onPointerDown={(ev) => ev.stopPropagation()}>
        {item('Duplicate', () => {
          const out: string[] = [];
          run(duplicateEntities([e.id], out));
          ui.select(out);
        })}
        {e.kind === 'box' &&
          item('Stack on top', () => {
            const b = e as BoxEntity;
            const copy: BoxEntity = { ...b, id: newId(), position: { ...b.position, z: b.position.z + b.size.z } };
            run(addEntity(copy));
            ui.select([copy.id]);
          })}
        {item('Bring forward', () => run(reorderEntity(e.id, 1)))}
        {item('Delete', () => {
          run(deleteEntities([e.id]));
          ui.select([]);
        }, true)}
      </div>
    </div>
  );
}

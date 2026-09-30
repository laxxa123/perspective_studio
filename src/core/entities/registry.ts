// Entity-kind registry (§8.4): one line per kind.
import type { EntityBase } from '../document/types';
import { boxKind } from './box/box';
import { rectKind } from './rect/rect';
import { strokeKind } from './stroke/stroke';
import type { EntityKindDef } from './types';

const KINDS: EntityKindDef<EntityBase>[] = [
  boxKind as unknown as EntityKindDef<EntityBase>,
  rectKind as unknown as EntityKindDef<EntityBase>,
  strokeKind as unknown as EntityKindDef<EntityBase>,
];

const byKind = new Map(KINDS.map((k) => [k.kind, k]));

export const kindOf = (kind: string): EntityKindDef<EntityBase> | undefined => byKind.get(kind);
export const registeredKinds = (): string[] => [...byKind.keys()];

/** Every placeable shape, in menu order (UI-01): kind + option. */
export const shapeOptions = () =>
  KINDS.flatMap((k) => (k.shapes ?? []).map((o) => ({ kind: k.kind, ...o })));

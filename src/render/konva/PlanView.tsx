// Plan view renderer (CV-05): the plan model in plan units, styled from the theme.
import { memo } from 'react';
import { Arrow, Circle, Layer, Line, Stage } from 'react-konva';
import type { PlanItem, PlanModel } from '../../core/derive/plan';
import { withAlpha, type Theme } from '../../theme/theme';

interface Props {
  width: number;
  height: number;
  transform: { x: number; y: number; scale: number };
  model: PlanModel;
  selection: ReadonlySet<string>;
  theme: Theme;
}

function Item({ it, theme, s, selected }: { it: PlanItem; theme: Theme; s: number; selected: boolean }) {
  const fam = it.family ? theme.family[it.family] : theme.edge;
  switch (it.role) {
    case 'grid':
      return <Line points={it.points} stroke={withAlpha(fam, 0.16)} strokeWidth={0.6} strokeScaleEnabled={false} />;
    case 'axis':
      return <Arrow points={it.points} stroke={fam} fill={fam} strokeWidth={2} strokeScaleEnabled={false} pointerLength={7 / s} pointerWidth={6 / s} />;
    case 'footprint':
      return (
        <Line
          points={it.points}
          closed
          fill={selected ? withAlpha(theme.selection, 0.25) : withAlpha(theme.edge, 0.08)}
          stroke={selected ? theme.selection : theme.edge}
          strokeWidth={selected ? 2 : 1.3}
          strokeScaleEnabled={false}
        />
      );
    case 'wall':
      return <Line points={it.points} stroke={selected ? theme.selection : fam} strokeWidth={selected ? 3.5 : 2.5} strokeScaleEnabled={false} />;
    case 'wedge':
      return <Line points={it.points} stroke={theme.muted} strokeWidth={1} strokeScaleEnabled={false} dash={[5 / s, 4 / s]} />;
    case 'forward':
      return <Line points={it.points} stroke={withAlpha(theme.muted, 0.6)} strokeWidth={1} strokeScaleEnabled={false} />;
    case 'eye':
      return <Circle x={it.points[0]} y={it.points[1]} radius={6 / s} fill={theme.ink} />;
  }
}

function PlanViewImpl({ width, height, transform, model, selection, theme }: Props) {
  const s = transform.scale;
  return (
    <Stage width={width} height={height} x={transform.x} y={transform.y} scaleX={s} scaleY={s} listening={false}>
      <Layer listening={false}>
        {model.items.map((it) => (
          <Item key={it.key} it={it} theme={theme} s={s} selected={!!it.entityId && selection.has(it.entityId)} />
        ))}
      </Layer>
    </Stage>
  );
}

export const PlanView = memo(PlanViewImpl);

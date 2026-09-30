import { Circle, Layer, Line, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Vec2 } from '../math/geometry';
import { withHorizon, type PerspectiveSetup } from '../model/scene';

interface Props {
  width: number;
  height: number;
  setup: PerspectiveSetup;
  onChange: (setup: PerspectiveSetup) => void;
}

const GUIDE = '#9aa4b2';
const VP = '#d9480f';
const RAYS = 12;

/** Fan of guide rays from a vanishing point across the canvas. */
function rays(vp: Vec2, width: number, height: number) {
  const far = Math.hypot(width, height) * 2;
  return Array.from({ length: RAYS }, (_, i) => {
    const a = (i / RAYS) * Math.PI * 2;
    return [vp.x, vp.y, vp.x + Math.cos(a) * far, vp.y + Math.sin(a) * far];
  });
}

export function PerspectiveCanvas({ width, height, setup, onChange }: Props) {
  const dragPoint =
    (key: 'vpLeft' | 'vpRight' | 'vpVertical') => (e: KonvaEventObject<DragEvent>) => {
      const { x, y } = e.target.position();
      if (key === 'vpVertical') onChange({ ...setup, vpVertical: { x, y } });
      else onChange({ ...setup, [key]: { x, y: setup.horizonY } });
    };

  return (
    <Stage width={width} height={height}>
      <Layer listening={false}>
        {(['vpLeft', 'vpRight', 'vpVertical'] as const).flatMap((k) =>
          rays(setup[k], width, height).map((pts, i) => (
            <Line key={`${k}-${i}`} points={pts} stroke={GUIDE} strokeWidth={0.5} opacity={0.6} />
          )),
        )}
      </Layer>
      <Layer>
        <Line
          points={[-width, 0, width * 2, 0]}
          y={setup.horizonY}
          stroke="#1c7ed6"
          strokeWidth={2}
          hitStrokeWidth={24}
          draggable
          dragBoundFunc={(pos) => ({ x: 0, y: pos.y })}
          onDragMove={(e) => onChange(withHorizon(setup, e.target.y()))}
        />
        {(['vpLeft', 'vpRight', 'vpVertical'] as const).map((k) => (
          <Circle
            key={k}
            x={setup[k].x}
            y={setup[k].y}
            radius={10}
            fill={VP}
            hitStrokeWidth={20}
            draggable
            dragBoundFunc={k === 'vpVertical' ? undefined : (pos) => ({ x: pos.x, y: setup.horizonY })}
            onDragMove={dragPoint(k)}
          />
        ))}
      </Layer>
    </Stage>
  );
}

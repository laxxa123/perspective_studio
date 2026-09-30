// RenderModel → Konva nodes (§9). No math beyond placing things; no events
// (hit-testing is done by the tools against core, §9).
import { Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { Family, RenderItem, RenderModel } from '../../core/derive/renderModel';
import { FAMILY_COLOR, THEME } from './theme';

export interface OverlayHandle {
  id: string;
  label: string;
  family?: Family;
  x: number;
  y: number;
}

export interface Overlay {
  handles: OverlayHandle[];
  active: string | null;
  /** A forbidden horizontal band to shade, pp (PV-2 / PV-4 feedback). */
  band: { top: number; bottom: number } | null;
}

interface Props {
  width: number;
  height: number;
  transform: { x: number; y: number; scale: number };
  model: RenderModel;
  dimObjects: boolean;
  overlay: Overlay | null;
}

const FAR = 1e6;

export function SceneView({ width, height, transform, model, dimObjects, overlay }: Props) {
  const s = transform.scale;
  const byRole = (role: RenderItem['role']) => model.items.filter((i) => i.role === role);
  const colorOf = (i: RenderItem) => (i.family ? FAMILY_COLOR[i.family] : THEME.edge);

  return (
    <Stage width={width} height={height} x={transform.x} y={transform.y} scaleX={s} scaleY={s} listening={false}>
      <Layer listening={false}>
        {byRole('paper').map((i) => (
          <Line key={i.key} points={i.points} closed fill={THEME.paper} stroke={THEME.paperBorder} strokeWidth={1} strokeScaleEnabled={false} />
        ))}
      </Layer>

      <Layer listening={false}>
        {overlay?.band && (
          <Rect x={-FAR} y={overlay.band.top} width={2 * FAR} height={overlay.band.bottom - overlay.band.top} fill={THEME.forbidden} />
        )}
        {byRole('horizon').map((i) => (
          <Line
            key={i.key}
            points={i.points}
            stroke={THEME.horizon}
            strokeWidth={overlay?.active === 'horizon' ? THEME.guideWidth * 2 : THEME.guideWidth}
            strokeScaleEnabled={false}
          />
        ))}
        {byRole('vp').map((i) => (
          <Circle key={i.key} x={i.points[0]} y={i.points[1]} radius={THEME.vpRadius / s} fill={colorOf(i)} />
        ))}
        {byRole('anchor').map((i) => (
          <Group key={i.key} x={i.points[0]} y={i.points[1]} scaleX={1 / s} scaleY={1 / s}>
            <Line points={[-8, 0, 8, 0]} stroke={THEME.anchor} strokeWidth={1.5} />
            <Line points={[0, -8, 0, 8]} stroke={THEME.anchor} strokeWidth={1.5} />
          </Group>
        ))}
      </Layer>

      <Layer listening={false} opacity={dimObjects ? THEME.dimmedObjects : 1}>
        {byRole('edge').map((i) => (
          <Line key={i.key} points={i.points} stroke={THEME.edge} strokeWidth={THEME.edgeWidth} strokeScaleEnabled={false} lineCap="round" />
        ))}
      </Layer>

      {overlay && (
        <Layer listening={false}>
          {overlay.handles.map((h) => {
            const color = h.family ? FAMILY_COLOR[h.family] : THEME.anchor;
            const active = overlay.active === h.id;
            return (
              <Group key={h.id} x={h.x} y={h.y} scaleX={1 / s} scaleY={1 / s}>
                <Circle radius={THEME.handleRadius} fill={active ? color : '#fff'} stroke={color} strokeWidth={2.5} opacity={0.95} />
                <Text text={h.label} x={16} y={-22} fontSize={13} fontStyle="600" fill={color} />
              </Group>
            );
          })}
        </Layer>
      )}
    </Stage>
  );
}

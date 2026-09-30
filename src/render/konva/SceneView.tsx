// RenderModel → Konva nodes (§9). Styling by role + family from the theme;
// no geometry beyond placing things; no Konva events (tools hit-test in core).
import { memo } from 'react';
import { Arrow, Circle, Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { Family, RenderItem, RenderModel } from '../../core/derive/renderModel';
import { WEIGHTS, withAlpha, type Theme } from '../../theme/theme';

export interface OverlayHandle {
  id: string;
  label?: string;
  family?: Family;
  x: number;
  y: number;
  /** Perspective handles are larger and labelled. */
  big?: boolean;
  /** UI-03: the lift handle is drawn as a vertical double arrow. */
  glyph?: 'lift';
}

export interface Overlay {
  handles: OverlayHandle[];
  active: string | null;
  band: { top: number; bottom: number } | null;
  marquee: { x: number; y: number; width: number; height: number } | null;
  /** In-progress items (live stroke), pp. */
  live: RenderItem[];
}

interface Props {
  width: number;
  height: number;
  transform: { x: number; y: number; scale: number };
  model: RenderModel;
  selection: ReadonlySet<string>;
  dimObjects: boolean;
  overlay: Overlay;
  theme: Theme;
}

const FAR = 1e6;

function ItemNode({ it, theme, s, selected, dim }: { it: RenderItem; theme: Theme; s: number; selected: boolean; dim: boolean }) {
  const fam = it.family ? theme.family[it.family] : theme.edge;
  const layerOpacity = Number(it.data?.layerOpacity ?? 1) * (dim ? 0.4 : 1);
  switch (it.role) {
    case 'face':
      return (
        <Line
          points={it.points}
          closed
          fill={it.data?.filled ? withAlpha(fam, theme.faceAlpha * (selected ? 1.6 : 1)) : selected ? withAlpha(theme.selection, 0.06) : undefined}
          opacity={layerOpacity}
          listening={false}
        />
      );
    case 'edge':
      return (
        <Line
          points={it.points}
          stroke={selected ? theme.selection : theme.edge}
          strokeWidth={selected ? WEIGHTS.selectedEdge : WEIGHTS.edge}
          strokeScaleEnabled={false}
          lineCap="round"
          opacity={layerOpacity}
          listening={false}
        />
      );
    case 'hiddenEdge':
      return (
        <Line
          points={it.points}
          stroke={selected ? theme.selection : theme.hiddenEdge}
          strokeWidth={WEIGHTS.hiddenEdge}
          strokeScaleEnabled={false}
          dash={[6 / s, 5 / s]}
          opacity={layerOpacity}
          listening={false}
        />
      );
    case 'ray': {
      const fan = it.key.startsWith('fan:');
      return (
        <Line
          points={it.points}
          stroke={withAlpha(fam, fan ? theme.fanAlpha : theme.rayAlpha)}
          strokeWidth={fan ? WEIGHTS.fan : WEIGHTS.ray}
          strokeScaleEnabled={false}
          dash={it.data?.dashed ? [6 / s, 6 / s] : undefined}
          listening={false}
        />
      );
    }
    case 'grid':
      return (
        <Line
          points={it.points}
          stroke={it.data?.working ? withAlpha(theme.selection, 0.35) : withAlpha(fam, it.data?.major ? 0.35 : 0.14)}
          strokeWidth={it.data?.major ? 1 : 0.6}
          strokeScaleEnabled={false}
          listening={false}
        />
      );
    case 'cone':
      return <Line points={it.points} closed stroke={theme.muted} strokeWidth={1} strokeScaleEnabled={false} dash={[8 / s, 6 / s]} listening={false} />;
    case 'anchor':
      return (
        <Arrow
          points={it.points}
          stroke={fam}
          fill={fam}
          strokeWidth={2}
          strokeScaleEnabled={false}
          pointerLength={9 / s}
          pointerWidth={7 / s}
          listening={false}
        />
      );
    case 'stroke':
      return (
        <Line
          points={it.points}
          closed
          fill={String(it.data?.color ?? theme.ink)}
          opacity={Number(it.data?.opacity ?? 1) * layerOpacity}
          stroke={selected ? theme.selection : undefined}
          strokeWidth={selected ? 1.5 : 0}
          strokeScaleEnabled={false}
          listening={false}
          perfectDrawEnabled={false}
        />
      );
    default:
      return null;
  }
}

function SceneViewImpl({ width, height, transform, model, selection, dimObjects, overlay, theme }: Props) {
  const s = transform.scale;
  const guides = model.items.filter((i) => !i.entityId);
  const aids = guides.filter((i) => i.role === 'grid' || i.role === 'cone' || i.role === 'ray');
  const content = model.items.filter((i) => i.entityId);

  return (
    <Stage width={width} height={height} x={transform.x} y={transform.y} scaleX={s} scaleY={s} listening={false}>
      <Layer listening={false}>
        {guides
          .filter((i) => i.role === 'paper')
          .map((i) => (
            <Line key={i.key} points={i.points} closed fill={theme.paper} stroke={theme.paperBorder} strokeWidth={1} strokeScaleEnabled={false} />
          ))}
        {overlay.band && <Rect x={-FAR} y={overlay.band.top} width={2 * FAR} height={overlay.band.bottom - overlay.band.top} fill={theme.forbidden} />}
        {aids.map((i) => (
          <ItemNode key={i.key} it={i} theme={theme} s={s} selected={false} dim={false} />
        ))}
        {guides
          .filter((i) => i.role === 'horizon')
          .map((i) => (
            <Line
              key={i.key}
              points={i.points}
              stroke={theme.horizon}
              strokeWidth={overlay.active === 'horizon' ? WEIGHTS.guide * 2.2 : WEIGHTS.guide}
              strokeScaleEnabled={false}
            />
          ))}
        {guides
          .filter((i) => i.role === 'vp')
          .map((i) => (
            <Circle key={i.key} x={i.points[0]} y={i.points[1]} radius={WEIGHTS.vpRadius / s} fill={theme.family[i.family ?? 'L']} />
          ))}
        {guides
          .filter((i) => i.role === 'anchor')
          .map((i) => (
            <ItemNode key={i.key} it={i} theme={theme} s={s} selected={false} dim={false} />
          ))}
      </Layer>

      {/* Document layers in their order (objects and sketch interleave as the user orders them). */}
      <Layer listening={false}>
        {content.map((i) => (
          <ItemNode
            key={i.key}
            it={i}
            theme={theme}
            s={s}
            selected={selection.has(i.entityId!)}
            dim={dimObjects && i.role !== 'stroke'}
          />
        ))}
      </Layer>

      {/* sketchLive + overlay */}
      <Layer listening={false}>
        {overlay.live.map((i) => (
          <ItemNode key={i.key} it={i} theme={theme} s={s} selected={false} dim={false} />
        ))}
        {overlay.marquee && (
          <Rect {...overlay.marquee} fill={theme.marquee} stroke={theme.selection} strokeWidth={1} strokeScaleEnabled={false} dash={[4 / s, 4 / s]} />
        )}
        {overlay.handles.map((h) => {
          const color = h.family ? theme.family[h.family] : theme.anchor;
          const active = overlay.active === h.id;
          const r = h.big ? WEIGHTS.handleRadius : WEIGHTS.entityHandleRadius;
          if (h.glyph === 'lift') {
            return (
              <Group key={h.id} x={h.x} y={h.y} scaleX={1 / s} scaleY={1 / s}>
                <Rect x={-9} y={-15} width={18} height={30} cornerRadius={9} fill={theme.paper} stroke={color} strokeWidth={2} opacity={0.95} />
                <Arrow points={[0, 0, 0, -11]} stroke={color} fill={color} strokeWidth={2} pointerLength={5} pointerWidth={7} />
                <Arrow points={[0, 0, 0, 11]} stroke={color} fill={color} strokeWidth={2} pointerLength={5} pointerWidth={7} />
              </Group>
            );
          }
          return (
            <Group key={h.id} x={h.x} y={h.y} scaleX={1 / s} scaleY={1 / s}>
              <Circle radius={r} fill={active ? color : theme.paper} stroke={color} strokeWidth={2.5} opacity={0.95} />
              {h.label && <Text text={h.label} x={r + 3} y={-r - 9} fontSize={13} fontStyle="600" fill={color} />}
            </Group>
          );
        })}
      </Layer>
    </Stage>
  );
}

export const SceneView = memo(SceneViewImpl);

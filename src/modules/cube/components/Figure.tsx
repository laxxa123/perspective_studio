// A question figure (cube view or net) as an image, from the same SVG renderer
// as exports.
import { memo } from 'react';
import type { CubeModel } from '../model/CubeModel';
import type { Figure as Fig } from '../model/QuestionModel';
import { figureSvg } from '../render/Svg';
import { svgUrl } from '../render/rasterize';

export const FigureImg = memo(function FigureImg({ model, figure, assets, px = 220 }: { model: CubeModel; figure: Fig; assets: Record<string, string>; px?: number }) {
  return <img className="figure" src={svgUrl(figureSvg(model, figure, assets, px))} alt={figure.kind === 'cube' ? 'Cube' : 'Net'} draggable={false} />;
});

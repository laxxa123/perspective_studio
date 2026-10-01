// One renderer for tiles (PUBLISH §8): the editor (inside Konva shapes),
// thumbnails and published pictures all draw elements through these Canvas 2D
// functions, so what is edited is what is published.
import { layoutSpiral, wrapText } from '../core/layout';
import { fontStack } from '../core/tile';
import type { FontFamily, SpiralElement, TextElement, TileDocument, TileElement } from '../core/types';
import { TILE_H, TILE_W } from '../core/types';

/** Decoded pictures by media / asset id. */
export interface Images {
  get(id: string): CanvasImageSource | undefined;
}

export const fontCss = (font: FontFamily, weight: number, size: number) => `${font === 'Ms Madi' ? 400 : Math.round(weight)} ${size}px ${fontStack(font)}`;

let scratch: CanvasRenderingContext2D | null = null;
/** A context for measuring text outside a draw. */
export function measureContext(): CanvasRenderingContext2D {
  scratch ??= document.createElement('canvas').getContext('2d')!;
  return scratch;
}

const measurer = (ctx: CanvasRenderingContext2D, font: FontFamily, weight: number) => (s: string, size: number) => {
  ctx.font = fontCss(font, weight, size);
  return ctx.measureText(s).width;
};

/** The text's lines at its box width. */
export function textLines(e: Pick<TextElement, 'text' | 'font' | 'weight' | 'size' | 'letterSpacing' | 'w'>, ctx = measureContext()): string[] {
  return wrapText(e.text, e.w * TILE_W, e.size, e.letterSpacing, measurer(ctx, e.font, e.weight));
}

/** Height (normalised) that fits a text element's lines. */
export function fittedTextHeight(e: Pick<TextElement, 'text' | 'font' | 'weight' | 'size' | 'letterSpacing' | 'w' | 'lineHeight'>): number {
  return (Math.max(1, textLines(e).length) * e.size * e.lineHeight) / TILE_H;
}

function drawText(ctx: CanvasRenderingContext2D, e: TextElement, w: number) {
  ctx.fillStyle = e.color;
  ctx.font = fontCss(e.font, e.weight, e.size);
  ctx.textBaseline = 'middle';
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${e.letterSpacing}px`;
  const lh = e.size * e.lineHeight;
  textLines(e, ctx).forEach((line, i) => {
    const lw = ctx.measureText(line).width;
    const x = e.align === 'left' ? 0 : e.align === 'right' ? w - lw : (w - lw) / 2;
    ctx.fillText(line, x, i * lh + lh / 2);
  });
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
}

function drawSpiral(ctx: CanvasRenderingContext2D, e: SpiralElement, w: number, h: number) {
  ctx.fillStyle = e.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glyphs = layoutSpiral(e, w, h, measurer(ctx, e.font, e.weight));
  for (const g of glyphs) {
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(g.angle);
    ctx.font = fontCss(e.font, e.weight, g.size);
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  }
  ctx.textAlign = 'start';
}

/** Draws an element into its own box: origin at the box's top-left, `w × h` document px (the caller places and turns it). */
export function drawElement(ctx: CanvasRenderingContext2D, e: TileElement, images: Images, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha *= e.opacity;
  switch (e.kind) {
    case 'image': {
      const img = images.get(e.mediaId);
      if (img) {
        const iw = (img as { width: number }).width;
        const ih = (img as { height: number }).height;
        ctx.drawImage(img, e.crop.x * iw, e.crop.y * ih, e.crop.w * iw, e.crop.h * ih, 0, 0, w, h);
      } else {
        ctx.fillStyle = '#dee2e6';
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case 'paint': {
      const img = images.get(e.assetId);
      if (img) ctx.drawImage(img, 0, 0, w, h);
      break;
    }
    case 'text':
      drawText(ctx, e, w);
      break;
    case 'spiral':
      drawSpiral(ctx, e, w, h);
      break;
  }
  ctx.restore();
}

/** Places an element (translate + rotate about its centre) and draws it, in document px. */
export function drawPlaced(ctx: CanvasRenderingContext2D, e: TileElement, images: Images) {
  const w = e.w * TILE_W;
  const h = e.h * TILE_H;
  ctx.save();
  ctx.translate(e.x * TILE_W + w / 2, e.y * TILE_H + h / 2);
  ctx.rotate((e.rotation * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  drawElement(ctx, e, images, w, h);
  ctx.restore();
}

/** The whole tile at `scale` (1 = 1080 × 1920); elements can be left out (e.g. the paint being edited). */
export function renderTile(tile: TileDocument, images: Images, scale = 1, skip?: (e: TileElement) => boolean): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(TILE_W * scale);
  c.height = Math.round(TILE_H * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.fillStyle = tile.canvas.background;
  ctx.fillRect(0, 0, TILE_W, TILE_H);
  for (const e of tile.elements) if (!skip?.(e)) drawPlaced(ctx, e, images);
  return c;
}

export const canvasToBlob = (c: HTMLCanvasElement, type = 'image/png', q?: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode the image'))), type, q));

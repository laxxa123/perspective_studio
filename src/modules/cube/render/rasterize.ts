// SVG → canvas / PNG in the browser (textures for the 3D cube, PNG export).
export const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function svgToCanvas(svg: string, w: number, h: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, w, h);
      resolve(c);
    };
    img.onerror = () => reject(new Error('Could not draw the image.'));
    img.src = svgUrl(svg);
  });
}

export async function svgToPng(svg: string, w: number, h: number, scale = 2): Promise<Blob> {
  const c = await svgToCanvas(svg, w * scale, h * scale);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png'));
}

/** Width / height of an SVG document's root element. */
export function svgSize(svg: string): { w: number; h: number } {
  const w = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 800);
  const h = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 600);
  return { w, h };
}

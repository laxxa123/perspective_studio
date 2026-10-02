// A picture's permanent id inside the file (PUBLISH §5.3). JPEG: the
// standard EXIF tag ImageUniqueID (0xA420, 32 hex characters) in a minimal
// APP1 segment that carries nothing else; PNG: a `tEXt` chunk with the
// keyword `ImageUniqueID`. The id survives renaming, uploading and pulling
// back, so one picture is never stored twice. Pure byte work.

const KEYWORD = 'ImageUniqueID';

/** The id for a cleaned picture: the first 32 hex characters of its SHA-256 (before the id is written). */
export const uidFromHash = (sha256hex: string) => sha256hex.slice(0, 32);

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const isPng = (b: Uint8Array) => b.length > 8 && PNG_SIG.every((v, i) => b[i] === v);

// ----- JPEG -----

/** A minimal EXIF APP1 segment holding only ImageUniqueID (big-endian TIFF). */
function exifSegment(uid: string): Uint8Array {
  const id = uid.padEnd(32, '0').slice(0, 32);
  const tiff = new Uint8Array(77);
  const v = new DataView(tiff.buffer);
  tiff.set([0x4d, 0x4d], 0); // "MM"
  v.setUint16(2, 42);
  v.setUint32(4, 8); // IFD0
  v.setUint16(8, 1); // one entry: the Exif IFD pointer
  v.setUint16(10, 0x8769);
  v.setUint16(12, 4); // LONG
  v.setUint32(14, 1);
  v.setUint32(18, 26);
  v.setUint32(22, 0); // no next IFD
  v.setUint16(26, 1); // Exif IFD: one entry
  v.setUint16(28, 0xa420);
  v.setUint16(30, 2); // ASCII
  v.setUint32(32, 33);
  v.setUint32(36, 44);
  v.setUint32(40, 0);
  for (let i = 0; i < 32; i++) tiff[44 + i] = id.charCodeAt(i);
  tiff[76] = 0;
  const seg = new Uint8Array(4 + 6 + tiff.length);
  seg.set([0xff, 0xe1], 0);
  new DataView(seg.buffer).setUint16(2, seg.length - 2);
  seg.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); // "Exif\0\0"
  seg.set(tiff, 10);
  return seg;
}

/** JPEG segments before the image data: [start, end) of each marker segment. */
function jpegSegments(b: Uint8Array): { marker: number; start: number; end: number }[] {
  const out: { marker: number; start: number; end: number }[] = [];
  let p = 2;
  while (p + 4 <= b.length && b[p] === 0xff) {
    const marker = b[p + 1];
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end
    const len = (b[p + 2] << 8) | b[p + 3];
    out.push({ marker, start: p, end: p + 2 + len });
    p += 2 + len;
  }
  return out;
}

const isExifApp1 = (b: Uint8Array, s: { marker: number; start: number }) => s.marker === 0xe1 && b[s.start + 4] === 0x45 && b[s.start + 5] === 0x78 && b[s.start + 6] === 0x69 && b[s.start + 7] === 0x66;

function stampJpeg(b: Uint8Array, uid: string): Uint8Array {
  const segs = jpegSegments(b);
  // Drop any EXIF already there; insert ours after JFIF (APP0) when present, else after SOI.
  const drop = segs.filter((s) => isExifApp1(b, s));
  const app0 = segs.find((s) => s.marker === 0xe0);
  const at = app0 ? app0.end : 2;
  const parts: Uint8Array[] = [];
  let p = 0;
  const cut = (to: number) => {
    for (const d of drop) {
      if (d.start >= p && d.end <= to) {
        parts.push(b.subarray(p, d.start));
        p = d.end;
      }
    }
    parts.push(b.subarray(p, to));
    p = to;
  };
  cut(at);
  parts.push(exifSegment(uid));
  cut(b.length);
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

function readJpeg(b: Uint8Array): string | null {
  for (const s of jpegSegments(b)) {
    if (!isExifApp1(b, s)) continue;
    const t = s.start + 10;
    const le = b[t] === 0x49;
    const v = new DataView(b.buffer, b.byteOffset + t, s.end - t);
    const u16 = (o: number) => v.getUint16(o, le);
    const u32 = (o: number) => v.getUint32(o, le);
    try {
      const entry = (ifd: number, tag: number) => {
        const n = u16(ifd);
        for (let i = 0; i < n; i++) {
          const e = ifd + 2 + i * 12;
          if (u16(e) === tag) return e;
        }
        return -1;
      };
      const ptr = entry(u32(4), 0x8769);
      if (ptr < 0) continue;
      const e = entry(u32(ptr + 8), 0xa420);
      if (e < 0) continue;
      const count = u32(e + 4);
      const off = count > 4 ? u32(e + 8) : e + 8;
      let id = '';
      for (let i = 0; i < count; i++) {
        const c = v.getUint8(off + i);
        if (!c) break;
        id += String.fromCharCode(c);
      }
      return id || null;
    } catch {
      continue;
    }
  }
  return null;
}

// ----- PNG -----

let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const x of bytes) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunks(b: Uint8Array): { type: string; start: number; end: number; data: Uint8Array }[] {
  const out: { type: string; start: number; end: number; data: Uint8Array }[] = [];
  const v = new DataView(b.buffer, b.byteOffset, b.length);
  let p = 8;
  while (p + 12 <= b.length) {
    const len = v.getUint32(p);
    const type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]);
    out.push({ type, start: p, end: p + 12 + len, data: b.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
    if (type === 'IEND') break;
  }
  return out;
}

function textChunk(uid: string): Uint8Array {
  const body = new TextEncoder().encode(`${KEYWORD}\0${uid}`);
  const c = new Uint8Array(12 + body.length);
  const v = new DataView(c.buffer);
  v.setUint32(0, body.length);
  c.set([0x74, 0x45, 0x58, 0x74], 4); // tEXt
  c.set(body, 8);
  v.setUint32(8 + body.length, crc32(c.subarray(4, 8 + body.length)));
  return c;
}

const isIdChunk = (c: { type: string; data: Uint8Array }) => c.type === 'tEXt' && new TextDecoder().decode(c.data.subarray(0, KEYWORD.length + 1)) === `${KEYWORD}\0`;

function stampPng(b: Uint8Array, uid: string): Uint8Array {
  const chunks = pngChunks(b);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) return b;
  const parts: Uint8Array[] = [b.subarray(0, ihdr.end), textChunk(uid)];
  for (const c of chunks) if (c !== ihdr && !isIdChunk(c)) parts.push(b.subarray(c.start, c.end));
  const out = new Uint8Array(parts.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}

function readPng(b: Uint8Array): string | null {
  const c = pngChunks(b).find(isIdChunk);
  return c ? new TextDecoder().decode(c.data.subarray(KEYWORD.length + 1)) : null;
}

// ----- either -----

/** Writes (or replaces) the id; other formats come back unchanged. */
export function stampId(bytes: Uint8Array, uid: string): Uint8Array {
  if (isJpeg(bytes)) return stampJpeg(bytes, uid);
  if (isPng(bytes)) return stampPng(bytes, uid);
  return bytes;
}

/** The id written in a picture, if any. */
export function readId(bytes: Uint8Array): string | null {
  if (isJpeg(bytes)) return readJpeg(bytes);
  if (isPng(bytes)) return readPng(bytes);
  return null;
}

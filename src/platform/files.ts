// Files: exports go to the Android share sheet (Capacitor Filesystem + Share)
// or download in a browser; backups go to the device Documents folder;
// imports use the system file picker (DOC-03, DOC-05).
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const native = () => Capacitor.isNativePlatform();

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Share / download a file. */
export async function shareFile(name: string, blob: Blob): Promise<void> {
  if (!native()) return download(name, blob);
  const { uri } = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title: name, files: [uri] });
  } catch (e) {
    if (!/cancel/i.test(String(e))) throw e;
  }
}

/** Saves a text file to the device Documents folder (or downloads it). Returns where it went. */
export async function saveToDocuments(name: string, text: string): Promise<string> {
  if (!native()) {
    download(name, new Blob([text], { type: 'application/json' }));
    return 'Downloads';
  }
  await Filesystem.writeFile({ path: `PerspectiveStudio/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
  return `Documents/PerspectiveStudio/${name}`;
}

/** Saves an image (e.g. a PNG export) to Documents/CREATIVE (or downloads it). Returns where it went. */
export async function saveImageToDevice(name: string, blob: Blob): Promise<string> {
  if (!native()) {
    download(name, blob);
    return 'Downloads';
  }
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const file = name.replace(/(\.\w+)$/, `_${stamp}$1`);
  await Filesystem.writeFile({ path: `CREATIVE/${file}`, data: await blobToBase64(blob), directory: Directory.Documents, recursive: true });
  return `Documents/CREATIVE/${file}`;
}

/** Lets the user pick a file; resolves with its text, or null when cancelled. */
export function pickTextFile(accept: string): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return resolve(null);
      f.text().then(resolve, () => resolve(null));
    };
    input.click();
  });
}

/** Lets the user pick a file (e.g. an image from the gallery); null when cancelled. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

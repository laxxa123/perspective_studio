// Cube services (CUBE §40): what the UI calls. Picks the storage backend
// (SQLite on Android, IndexedDB in a browser), commits questions, autosaves
// drafts, imports images, builds variants and exports.
import { Capacitor } from '@capacitor/core';
import { FACE_IDS, newCubeModel, type CubeModel } from '../model/CubeModel';
import type { Question } from '../model/QuestionModel';
import { cubeModelSchema, parseQuestion } from '../model/QuestionSchema';
import { uid } from '../model/ids';
import { PRESETS, presetCells } from '../geometry/NetShapes';
import { validateQuestion, type QuestionIssue } from '../question/QuestionValidator';
import { refreshDerived } from '../question/QuestionEngine';
import { makeVariant } from '../question/VariantEngine';
import { SqliteTables, type CubeTables } from '../database/CubeDatabase';
import { IdbTables } from '../database/IdbTables';
import { AssetRepository, DraftRepository, QuestionRepository, type QuestionSummary } from '../database/QuestionRepository';

let tables: CubeTables | null = null;
let ready: Promise<void> | null = null;
export let questions: QuestionRepository;
export let assets: AssetRepository;
export let drafts: DraftRepository;

/** Opens CUBE storage once. */
export function initStorage(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      if (Capacitor.isNativePlatform()) {
        const { openNativeCubeDb } = await import('../database/NativeSqlite');
        tables = new SqliteTables(await openNativeCubeDb());
      } else {
        tables = new IdbTables();
      }
      await tables.init();
      questions = new QuestionRepository(tables);
      assets = new AssetRepository(tables);
      drafts = new DraftRepository(tables);
    })();
  }
  return ready;
}

export const startModel = (): CubeModel => newCubeModel({ cells: presetCells(PRESETS[0]) });

// ----- drafts (CUBE §42) -----

export interface Draft {
  model: CubeModel;
  question: Question | null;
  editing: { questionId: string; version: number } | null;
}

export async function saveDraft(d: Draft): Promise<void> {
  await initStorage();
  await drafts.save(JSON.stringify(d));
}

export async function loadDraft(): Promise<Draft | null> {
  await initStorage();
  const raw = await drafts.load();
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Draft;
    const model = cubeModelSchema.parse(d.model) as CubeModel;
    const question = d.question ? parseQuestion(d.question) : null;
    return { model, question, editing: d.editing ?? null };
  } catch {
    return null;
  }
}

// ----- assets (CUBE §19) -----

/** Stores an image under a stable id; scales very large photos down to 1024 px. */
export async function importImage(file: Blob): Promise<{ id: string; data: string; aspect: number }> {
  await initStorage();
  const data = await downscale(file, 1024);
  const id = uid('asset');
  await assets.put({ id, mime: data.mime, data: data.url });
  return { id, data: data.url, aspect: data.aspect };
}

async function downscale(file: Blob, max: number): Promise<{ url: string; mime: string; aspect: number }> {
  const url = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
  const img = await loadImage(url);
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  if (Math.max(img.naturalWidth, img.naturalHeight) <= max) return { url, mime: file.type || 'image/png', aspect };
  const s = max / Math.max(img.naturalWidth, img.naturalHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { url: c.toDataURL(mime, 0.9), mime, aspect };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Could not read the image.'));
    i.src = src;
  });
}

/** The data URLs of every asset a model uses. */
export async function assetsFor(m: CubeModel): Promise<Record<string, string>> {
  await initStorage();
  const ids = new Set<string>();
  for (const f of FACE_IDS) for (const e of m.faces[f].elements) if (e.assetId) ids.add(e.assetId);
  for (const p of m.patterns) if (p.element.assetId) ids.add(p.element.assetId);
  const out: Record<string, string> = {};
  for (const id of ids) {
    const a = await assets.get(id);
    if (a) out[id] = a.data;
  }
  return out;
}

const assetList = async (m: CubeModel) => {
  const out: { id: string; mime: string }[] = [];
  for (const id of Object.keys(await assetsFor(m))) out.push({ id, mime: (await assets.get(id))!.mime });
  return out;
};

// ----- commit (CUBE §31–§33) -----

export async function issuesOf(q: Question): Promise<QuestionIssue[]> {
  await initStorage();
  const withAssets = { ...q, assets: await assetList(q.spatialModel) };
  return validateQuestion(withAssets, await assets.ids());
}

/** Validates and stores: a new id, or a new version of the question being edited. */
export async function commit(q: Question, editing: { questionId: string } | null): Promise<Question> {
  await initStorage();
  const ready = refreshDerived({ ...q, assets: await assetList(q.spatialModel) });
  const problems = validateQuestion(ready, await assets.ids());
  if (problems.length) throw new Error(problems[0].message);
  return editing ? questions.update(editing.questionId, ready) : questions.create(ready);
}

// ----- bank (CUBE §37, §38) -----

export async function listBank(): Promise<QuestionSummary[]> {
  await initStorage();
  return questions.list();
}

export async function variantOf(q: Question, seed: number): Promise<Question> {
  return makeVariant(q, seed);
}

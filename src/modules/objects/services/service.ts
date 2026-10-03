// OBJECTS services (OBJECTS §49): what the UI calls. Picks the storage
// backend (SQLite on Android, IndexedDB in a browser), saves drafts, commits
// questions and exports.
import { questionRef } from '../../../shared/ids/questionId';
import { Capacitor } from '@capacitor/core';
import { shareFile } from '../../../platform/files';
import type { Question } from '../core/questions';
import { questionSheet } from '../core/sheet';
import { IdbTables } from '../database/idb';
import { DraftRepository, QuestionRepository } from '../database/repository';
import { SqliteTables, type ObjectsTables } from '../database/tables';

let ready: Promise<{ questions: QuestionRepository; drafts: DraftRepository }> | null = null;

/** Opens OBJECTS storage once. */
export function storage() {
  if (!ready)
    ready = (async () => {
      let t: ObjectsTables;
      if (Capacitor.isNativePlatform()) {
        const { openNativeObjectsDb } = await import('../database/native');
        t = new SqliteTables(await openNativeObjectsDb());
      } else t = new IdbTables();
      await t.init();
      return { questions: new QuestionRepository(t), drafts: new DraftRepository(t) };
    })();
  return ready;
}

/** Commits: a new question, or a new version of the one being edited. */
export async function commit(q: Question, editing: string | null): Promise<Question> {
  const { questions } = await storage();
  return editing ? questions.update(editing, q) : questions.create(q);
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

function svgToPng(svg: string, scale = 2): Promise<Blob> {
  const w = Number(/width="([\d.]+)"/.exec(svg)?.[1] ?? 720);
  const h = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 600);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = w * scale;
      c.height = h * scale;
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed.'))), 'image/png');
    };
    img.onerror = () => reject(new Error('Could not draw the sheet.'));
    img.src = svgUrl(svg);
  });
}

/** Export (OBJECTS §58): the canonical JSON, the sheet as SVG or PNG. */
export async function exportQuestion(q: Question, as: 'json' | 'svg' | 'png', author = false) {
  const name = q.questionId ? questionRef(q.questionId, q.version) : 'objects-question';
  if (as === 'json') return shareFile(`${name}.json`, new Blob([JSON.stringify(q, null, 2)], { type: 'application/json' }));
  const sheet = questionSheet(q, { author });
  if (as === 'svg') return shareFile(`${name}.svg`, new Blob([sheet], { type: 'image/svg+xml' }));
  return shareFile(`${name}.png`, await svgToPng(sheet));
}

export { svgUrl };

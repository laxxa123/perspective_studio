// Repositories (OBJECTS §49): the only way the module reads or writes stored
// questions and drafts. React components never touch storage.
import { questionId, questionRef } from '../../../shared/ids/questionId';
import { familyLabel, kindOf, type Family, type Kind, type Question } from '../core/questions';
import { parseQuestion } from '../core/schema';
import type { ObjectsTables } from './tables';

/** What the Question Bank lists, searches and filters on (OBJECTS §46). */
export interface QuestionSummary {
  id: string;
  version: number;
  family: Family;
  kind: Kind;
  label: string;
  stem: string;
  difficulty: number;
  size: number;
  distractors: string[];
  createdAt: string;
  updatedAt: string;
}

/** OBJECTS-Q-1, OBJECTS-Q-2 … (CREATIVE.md §3.1); a version reads OBJECTS-Q-1.1. */
export const formatId = (seq: number) => questionId('OBJECTS', seq);

const summaryOf = (q: Question, id: string, updatedAt: string): QuestionSummary => ({
  id,
  version: q.version,
  family: q.family,
  kind: kindOf(q.family),
  label: familyLabel(q.family),
  stem: q.stem,
  difficulty: q.profile.difficulty,
  size: q.profile.size,
  distractors: [...new Set(q.options.map((o) => o.rule).filter((r) => r !== 'correct'))],
  createdAt: q.createdAt,
  updatedAt,
});

export class QuestionRepository {
  constructor(private t: ObjectsTables) {}

  /** Commits a new question: permanent id, version 1. */
  async create(q: Question, now = new Date()): Promise<Question> {
    const seq = await this.t.nextSeq();
    const id = formatId(seq);
    const at = now.toISOString();
    const stored: Question = { ...q, questionId: id, version: 1, createdAt: at };
    await this.t.insertVersion({ questionId: id, version: 1, json: JSON.stringify(stored), createdAt: at });
    await this.t.putQuestion({ id, seq, latestVersion: 1, family: q.family, createdAt: at, updatedAt: at, summary: JSON.stringify(summaryOf(stored, id, at)) });
    return stored;
  }

  /** Commits an edit as a new version; earlier versions are never touched (OBJECTS §43). */
  async update(id: string, q: Question, now = new Date()): Promise<Question> {
    const row = await this.t.getQuestion(id);
    if (!row) throw new Error(`${id} does not exist.`);
    const version = row.latestVersion + 1;
    const at = now.toISOString();
    const stored: Question = { ...q, questionId: id, version, createdAt: row.createdAt };
    await this.t.insertVersion({ questionId: id, version, json: JSON.stringify(stored), createdAt: at });
    await this.t.putQuestion({ ...row, latestVersion: version, family: q.family, updatedAt: at, summary: JSON.stringify(summaryOf(stored, id, at)) });
    return stored;
  }

  /** The latest version, or a given one. */
  async get(id: string, version?: number): Promise<Question | null> {
    const row = await this.t.getQuestion(id);
    if (!row) return null;
    const v = await this.t.getVersion(id, version ?? row.latestVersion);
    return v ? parseQuestion(JSON.parse(v.json)) : null;
  }

  async list(): Promise<QuestionSummary[]> {
    return (await this.t.listQuestions()).map((r) => JSON.parse(r.summary) as QuestionSummary);
  }

  /** A new, independent question with the same content (OBJECTS §47). */
  async duplicate(id: string, now = new Date()): Promise<Question> {
    const q = await this.get(id);
    if (!q) throw new Error(`${id} does not exist.`);
    return this.create(q, now);
  }

  async versions(id: string): Promise<{ version: number; createdAt: string }[]> {
    return (await this.t.listVersions(id)).map((v) => ({ version: v.version, createdAt: v.createdAt }));
  }
}

export class DraftRepository {
  constructor(private t: ObjectsTables) {}
  async save(json: string, now = new Date()) {
    await this.t.putDraft({ id: 'studio', json, updatedAt: now.toISOString() });
  }
  async load(): Promise<string | null> {
    return (await this.t.getDraft('studio'))?.json ?? null;
  }
  async clear() {
    await this.t.deleteDraft('studio');
  }
}

/** Search and filters (OBJECTS §46): text matches the id, the type or the question; filters by kind and type. */
export function filterSummaries(list: QuestionSummary[], f: { text?: string; kind?: Kind | null; family?: Family | null }): QuestionSummary[] {
  const t = (f.text ?? '').trim().toLowerCase();
  return list.filter((s) => (!f.kind || s.kind === f.kind) && (!f.family || s.family === f.family) && (!t || `${s.id} ${questionRef(s.id, s.version)} ${s.label} ${s.stem}`.toLowerCase().includes(t)));
}

// Repositories (CUBE §40): the only way the module reads or writes stored
// questions, assets and drafts. React components never touch SQL.
import { questionId, questionSeq } from '../../../shared/ids/questionId';
import type { Question } from '../model/QuestionModel';
import { parseQuestion } from '../model/QuestionSchema';
import type { CubeTables } from './CubeDatabase';

/** What the Question Bank lists, searches and filters on (CUBE §37). */
export interface QuestionSummary {
  id: string;
  version: number;
  type: Question['presentation']['type'];
  title: string;
  createdAt: string;
  updatedAt: string;
  difficulty: Question['difficulty'];
  distractors: string[];
  patterns: number;
  netShape: number;
}

/** CUBE-Q-1, CUBE-Q-2 … (CREATIVE.md §3.1); a version reads CUBE-Q-1.1. */
export const formatId = (seq: number) => questionId('CUBE', seq);

const summaryOf = (q: Question, id: string, updatedAt: string): QuestionSummary => ({
  id,
  version: q.version,
  type: q.presentation.type,
  title: q.title,
  createdAt: q.createdAt,
  updatedAt,
  difficulty: q.difficulty,
  distractors: q.dna.distractors,
  patterns: q.dna.patterns,
  netShape: q.dna.netShape,
});

export class QuestionRepository {
  constructor(private t: CubeTables) {}

  /** Commits a new question: permanent id, version 1. */
  async create(q: Question, now = new Date()): Promise<Question> {
    const id = formatId(await this.t.nextSeq());
    const at = now.toISOString();
    const stored: Question = { ...q, questionId: id, version: 1, createdAt: at };
    await this.t.insertVersion({ questionId: id, version: 1, json: JSON.stringify(stored), createdAt: at });
    await this.t.putQuestion({ id, seq: questionSeq(id), latestVersion: 1, type: stored.presentation.type, title: stored.title, createdAt: at, updatedAt: at, summary: JSON.stringify(summaryOf(stored, id, at)) });
    return stored;
  }

  /** Commits an edit as a new version; earlier versions stay untouched (CUBE §33). */
  async update(id: string, q: Question, now = new Date()): Promise<Question> {
    const row = await this.t.getQuestion(id);
    if (!row) throw new Error(`${id} does not exist.`);
    const version = row.latestVersion + 1;
    const at = now.toISOString();
    const stored: Question = { ...q, questionId: id, version, createdAt: row.createdAt };
    await this.t.insertVersion({ questionId: id, version, json: JSON.stringify(stored), createdAt: at });
    await this.t.putQuestion({ ...row, latestVersion: version, type: stored.presentation.type, title: stored.title, updatedAt: at, summary: JSON.stringify(summaryOf(stored, id, at)) });
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

  /** A new, independent question with the same content (CUBE §38). */
  async duplicate(id: string, now = new Date()): Promise<Question> {
    const q = await this.get(id);
    if (!q) throw new Error(`${id} does not exist.`);
    return this.create({ ...q, title: q.title ? `${q.title} (copy)` : '' }, now);
  }

  async versions(id: string): Promise<{ version: number; createdAt: string }[]> {
    return (await this.t.listVersions(id)).map((v) => ({ version: v.version, createdAt: v.createdAt }));
  }
}

export interface StoredAsset {
  id: string;
  mime: string;
  data: string;
}

export class AssetRepository {
  constructor(private t: CubeTables) {}
  async put(a: StoredAsset, now = new Date()) {
    await this.t.putAsset({ ...a, createdAt: now.toISOString() });
  }
  async get(id: string): Promise<StoredAsset | null> {
    const r = await this.t.getAsset(id);
    return r ? { id: r.id, mime: r.mime, data: r.data } : null;
  }
  async ids(): Promise<Set<string>> {
    return new Set(await this.t.listAssetIds());
  }
}

export class DraftRepository {
  constructor(private t: CubeTables) {}
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

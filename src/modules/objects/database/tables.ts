// OBJECTS persistence (OBJECTS §48, §49, §73): the rows behind the
// repositories. SQLite (`objects` database via @capacitor-community/sqlite on
// Android) and IndexedDB (browser / desktop development) implement the same
// tables. Schema version 1.

export interface QuestionRow {
  id: string;
  seq: number;
  latestVersion: number;
  family: string;
  createdAt: string;
  updatedAt: string;
  /** JSON of QuestionSummary (search / filters). */
  summary: string;
}

export interface VersionRow {
  questionId: string;
  version: number;
  json: string;
  createdAt: string;
}

export interface DraftRow {
  id: string;
  json: string;
  updatedAt: string;
}

export interface ObjectsTables {
  init(): Promise<void>;
  /** The next question number (stored counter; never reused). */
  nextSeq(): Promise<number>;
  putQuestion(row: QuestionRow): Promise<void>;
  getQuestion(id: string): Promise<QuestionRow | null>;
  listQuestions(): Promise<QuestionRow[]>;
  /** Fails if the version exists: versions are never overwritten. */
  insertVersion(row: VersionRow): Promise<void>;
  getVersion(id: string, version: number): Promise<VersionRow | null>;
  listVersions(id: string): Promise<VersionRow[]>;
  putDraft(row: DraftRow): Promise<void>;
  getDraft(id: string): Promise<DraftRow | null>;
  deleteDraft(id: string): Promise<void>;
}

/** Minimal SQL access (the Capacitor plugin; node:sqlite in tests). */
export interface SqlDriver {
  execute(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS objects_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS objects_questions (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER UNIQUE NOT NULL,
  latest_version INTEGER NOT NULL,
  family TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS objects_question_versions (
  question_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (question_id, version)
);
CREATE TABLE IF NOT EXISTS objects_drafts (id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT OR IGNORE INTO objects_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO objects_meta (key, value) VALUES ('last_seq', '0');
`;

type Q = { id: string; seq: number; latest_version: number; family: string; created_at: string; updated_at: string; summary: string };
const toQuestion = (r: Q): QuestionRow => ({ id: r.id, seq: Number(r.seq), latestVersion: Number(r.latest_version), family: r.family, createdAt: r.created_at, updatedAt: r.updated_at, summary: r.summary });
type V = { question_id: string; version: number; json: string; created_at: string };
const toVersion = (r: V): VersionRow => ({ questionId: r.question_id, version: Number(r.version), json: r.json, createdAt: r.created_at });

export class SqliteTables implements ObjectsTables {
  constructor(private db: SqlDriver) {}

  async init() {
    await this.db.execute(SCHEMA_SQL);
  }

  async nextSeq() {
    await this.db.run(`UPDATE objects_meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'last_seq'`);
    const [r] = await this.db.query<{ value: string }>(`SELECT value FROM objects_meta WHERE key = 'last_seq'`);
    return Number(r.value);
  }

  async putQuestion(q: QuestionRow) {
    await this.db.run(
      `INSERT INTO objects_questions (id, seq, latest_version, family, created_at, updated_at, summary) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET latest_version = excluded.latest_version, family = excluded.family, updated_at = excluded.updated_at, summary = excluded.summary`,
      [q.id, q.seq, q.latestVersion, q.family, q.createdAt, q.updatedAt, q.summary],
    );
  }

  async getQuestion(id: string) {
    const [r] = await this.db.query<Q>(`SELECT * FROM objects_questions WHERE id = ?`, [id]);
    return r ? toQuestion(r) : null;
  }

  async listQuestions() {
    return (await this.db.query<Q>(`SELECT * FROM objects_questions ORDER BY seq`)).map(toQuestion);
  }

  async insertVersion(v: VersionRow) {
    await this.db.run(`INSERT INTO objects_question_versions (question_id, version, json, created_at) VALUES (?, ?, ?, ?)`, [v.questionId, v.version, v.json, v.createdAt]);
  }

  async getVersion(id: string, version: number) {
    const [r] = await this.db.query<V>(`SELECT * FROM objects_question_versions WHERE question_id = ? AND version = ?`, [id, version]);
    return r ? toVersion(r) : null;
  }

  async listVersions(id: string) {
    return (await this.db.query<V>(`SELECT * FROM objects_question_versions WHERE question_id = ? ORDER BY version`, [id])).map(toVersion);
  }

  async putDraft(d: DraftRow) {
    await this.db.run(`INSERT INTO objects_drafts (id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`, [d.id, d.json, d.updatedAt]);
  }

  async getDraft(id: string) {
    const [r] = await this.db.query<{ id: string; json: string; updated_at: string }>(`SELECT * FROM objects_drafts WHERE id = ?`, [id]);
    return r ? { id: r.id, json: r.json, updatedAt: r.updated_at } : null;
  }

  async deleteDraft(id: string) {
    await this.db.run(`DELETE FROM objects_drafts WHERE id = ?`, [id]);
  }
}

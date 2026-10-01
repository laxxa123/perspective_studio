// CUBE persistence (CUBE §39, §40): the tables behind the repositories. Two
// backends implement the same rows — SQLite (`cube` database via
// @capacitor-community/sqlite on Android) and IndexedDB (browser / desktop
// development, where the native plugin is not available).

export interface QuestionRow {
  id: string;
  seq: number;
  latestVersion: number;
  type: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** JSON of QuestionSummary fields used for search / filters. */
  summary: string;
}

export interface VersionRow {
  questionId: string;
  version: number;
  json: string;
  createdAt: string;
}

export interface AssetRow {
  id: string;
  mime: string;
  /** data: URL. */
  data: string;
  createdAt: string;
}

export interface DraftRow {
  id: string;
  json: string;
  updatedAt: string;
}

/** The storage operations the repositories need. */
export interface CubeTables {
  init(): Promise<void>;
  /** Allocates the next question sequence number (never reused). */
  nextSeq(): Promise<number>;
  putQuestion(row: QuestionRow): Promise<void>;
  getQuestion(id: string): Promise<QuestionRow | null>;
  listQuestions(): Promise<QuestionRow[]>;
  /** Fails if the version already exists (versions are never overwritten, CUBE §33). */
  insertVersion(row: VersionRow): Promise<void>;
  getVersion(id: string, version: number): Promise<VersionRow | null>;
  listVersions(id: string): Promise<VersionRow[]>;
  putAsset(row: AssetRow): Promise<void>;
  getAsset(id: string): Promise<AssetRow | null>;
  listAssetIds(): Promise<string[]>;
  putDraft(row: DraftRow): Promise<void>;
  getDraft(id: string): Promise<DraftRow | null>;
  deleteDraft(id: string): Promise<void>;
}

// ----- SQLite -----

/** Minimal SQL access, implemented by the Capacitor plugin (and node:sqlite in tests). */
export interface SqlDriver {
  execute(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<void>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS cube_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cube_questions (
  id TEXT PRIMARY KEY NOT NULL,
  seq INTEGER UNIQUE NOT NULL,
  latest_version INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cube_question_versions (
  question_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (question_id, version)
);
CREATE TABLE IF NOT EXISTS cube_assets (id TEXT PRIMARY KEY NOT NULL, mime TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cube_drafts (id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL);
INSERT OR IGNORE INTO cube_meta (key, value) VALUES ('schema_version', '1');
INSERT OR IGNORE INTO cube_meta (key, value) VALUES ('last_seq', '0');
`;

type Q = { id: string; seq: number; latest_version: number; type: string; title: string; created_at: string; updated_at: string; summary: string };
const toQuestion = (r: Q): QuestionRow => ({
  id: r.id,
  seq: Number(r.seq),
  latestVersion: Number(r.latest_version),
  type: r.type,
  title: r.title,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  summary: r.summary,
});
type V = { question_id: string; version: number; json: string; created_at: string };
const toVersion = (r: V): VersionRow => ({ questionId: r.question_id, version: Number(r.version), json: r.json, createdAt: r.created_at });

export class SqliteTables implements CubeTables {
  constructor(private db: SqlDriver) {}

  async init() {
    await this.db.execute(SCHEMA_SQL);
  }

  async nextSeq() {
    await this.db.run(`UPDATE cube_meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'last_seq'`);
    const [r] = await this.db.query<{ value: string }>(`SELECT value FROM cube_meta WHERE key = 'last_seq'`);
    return Number(r.value);
  }

  async putQuestion(q: QuestionRow) {
    await this.db.run(
      `INSERT INTO cube_questions (id, seq, latest_version, type, title, created_at, updated_at, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET latest_version = excluded.latest_version, type = excluded.type, title = excluded.title, updated_at = excluded.updated_at, summary = excluded.summary`,
      [q.id, q.seq, q.latestVersion, q.type, q.title, q.createdAt, q.updatedAt, q.summary],
    );
  }

  async getQuestion(id: string) {
    const [r] = await this.db.query<Q>(`SELECT * FROM cube_questions WHERE id = ?`, [id]);
    return r ? toQuestion(r) : null;
  }

  async listQuestions() {
    return (await this.db.query<Q>(`SELECT * FROM cube_questions ORDER BY seq`)).map(toQuestion);
  }

  async insertVersion(v: VersionRow) {
    await this.db.run(`INSERT INTO cube_question_versions (question_id, version, json, created_at) VALUES (?, ?, ?, ?)`, [v.questionId, v.version, v.json, v.createdAt]);
  }

  async getVersion(id: string, version: number) {
    const [r] = await this.db.query<V>(`SELECT * FROM cube_question_versions WHERE question_id = ? AND version = ?`, [id, version]);
    return r ? toVersion(r) : null;
  }

  async listVersions(id: string) {
    return (await this.db.query<V>(`SELECT * FROM cube_question_versions WHERE question_id = ? ORDER BY version`, [id])).map(toVersion);
  }

  async putAsset(a: AssetRow) {
    await this.db.run(`INSERT OR IGNORE INTO cube_assets (id, mime, data, created_at) VALUES (?, ?, ?, ?)`, [a.id, a.mime, a.data, a.createdAt]);
  }

  async getAsset(id: string) {
    const [r] = await this.db.query<{ id: string; mime: string; data: string; created_at: string }>(`SELECT * FROM cube_assets WHERE id = ?`, [id]);
    return r ? { id: r.id, mime: r.mime, data: r.data, createdAt: r.created_at } : null;
  }

  async listAssetIds() {
    return (await this.db.query<{ id: string }>(`SELECT id FROM cube_assets`)).map((r) => r.id);
  }

  async putDraft(d: DraftRow) {
    await this.db.run(`INSERT INTO cube_drafts (id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`, [d.id, d.json, d.updatedAt]);
  }

  async getDraft(id: string) {
    const [r] = await this.db.query<{ id: string; json: string; updated_at: string }>(`SELECT * FROM cube_drafts WHERE id = ?`, [id]);
    return r ? { id: r.id, json: r.json, updatedAt: r.updated_at } : null;
  }

  async deleteDraft(id: string) {
    await this.db.run(`DELETE FROM cube_drafts WHERE id = ?`, [id]);
  }
}

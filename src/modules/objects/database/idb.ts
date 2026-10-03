// IndexedDB backend for the OBJECTS tables (browser / desktop development;
// Android uses SQLite). Same rows, same guarantees.
import { openDB, type IDBPDatabase } from 'idb';
import type { DraftRow, ObjectsTables, QuestionRow, VersionRow } from './tables';

export class IdbTables implements ObjectsTables {
  private db: IDBPDatabase | null = null;
  constructor(private name = 'creative-objects') {}

  private get d() {
    if (!this.db) throw new Error('OBJECTS storage not initialised');
    return this.db;
  }

  async init() {
    this.db = await openDB(this.name, 1, {
      upgrade(db) {
        db.createObjectStore('meta');
        db.createObjectStore('questions', { keyPath: 'id' });
        db.createObjectStore('versions', { keyPath: ['questionId', 'version'] }).createIndex('byQuestion', 'questionId');
        db.createObjectStore('drafts', { keyPath: 'id' });
      },
    });
  }

  async nextSeq() {
    const tx = this.d.transaction('meta', 'readwrite');
    const last = ((await tx.store.get('last_seq')) as number | undefined) ?? 0;
    await tx.store.put(last + 1, 'last_seq');
    await tx.done;
    return last + 1;
  }
  async putQuestion(q: QuestionRow) {
    await this.d.put('questions', q);
  }
  async getQuestion(id: string) {
    return ((await this.d.get('questions', id)) as QuestionRow | undefined) ?? null;
  }
  async listQuestions() {
    return ((await this.d.getAll('questions')) as QuestionRow[]).sort((a, b) => a.seq - b.seq);
  }
  async insertVersion(v: VersionRow) {
    await this.d.add('versions', v);
  }
  async getVersion(id: string, version: number) {
    return ((await this.d.get('versions', [id, version])) as VersionRow | undefined) ?? null;
  }
  async listVersions(id: string) {
    return ((await this.d.getAllFromIndex('versions', 'byQuestion', id)) as VersionRow[]).sort((a, b) => a.version - b.version);
  }
  async putDraft(d: DraftRow) {
    await this.d.put('drafts', d);
  }
  async getDraft(id: string) {
    return ((await this.d.get('drafts', id)) as DraftRow | undefined) ?? null;
  }
  async deleteDraft(id: string) {
    await this.d.delete('drafts', id);
  }
}

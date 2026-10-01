// The SQLite driver on Android: @capacitor-community/sqlite, database `cube`.
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite';
import type { SqlDriver } from './CubeDatabase';

export const CUBE_DB_NAME = 'cube';

export async function openNativeCubeDb(): Promise<SqlDriver> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.checkConnectionsConsistency().catch(() => undefined);
  const exists = (await sqlite.isConnection(CUBE_DB_NAME, false)).result;
  const db: SQLiteDBConnection = exists
    ? await sqlite.retrieveConnection(CUBE_DB_NAME, false)
    : await sqlite.createConnection(CUBE_DB_NAME, false, 'no-encryption', 1, false);
  await db.open();
  return {
    async execute(sql) {
      await db.execute(sql);
    },
    async run(sql, params = []) {
      await db.run(sql, params as unknown[]);
    },
    async query<T>(sql: string, params: unknown[] = []) {
      return ((await db.query(sql, params as unknown[])).values ?? []) as T[];
    },
  };
}

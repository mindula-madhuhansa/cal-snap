/**
 * The narrow database port the data access layer talks to.
 *
 * `expo-sqlite`'s `SQLiteDatabase` satisfies this as it stands, so nothing at
 * the call sites changes. Depending on the small interface instead of the
 * concrete one is what lets the same functions run against a plain SQLite in
 * `npm run check:schema`, on a machine with no phone and no Expo runtime,
 * which is the point of keeping effects at the edges (root `AGENTS.md`).
 */

export type SqlValue = string | number | null;

export type SqlDatabase = {
  runAsync(sql: string, params: readonly SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: readonly SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: readonly SqlValue[]): Promise<T | null>;
  withTransactionAsync(work: () => Promise<void>): Promise<void>;
};

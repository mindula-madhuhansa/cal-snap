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
  /**
   * Note what this does **not** return: how many rows it changed. Callers that
   * need to know whether a conditional write matched have to read the row back
   * instead, which `pushChanges` does. Widening this would remove that extra
   * read, and would mean changing every implementation of the port.
   */
  runAsync(sql: string, params: readonly SqlValue[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params: readonly SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params: readonly SqlValue[]): Promise<T | null>;
  /**
   * Runs `work` inside one transaction.
   *
   * **An implementation must serialise every other writer on this database for
   * the duration**, so a read and a later write inside `work` cannot have
   * anything slip between them. Both implementations satisfy this because both
   * hold a single connection: `expo-sqlite` opens one native connection per
   * handle, and the test double wraps one `node:sqlite` `DatabaseSync`.
   *
   * This is load bearing, not incidental. `pushChanges` checks that a row is
   * unchanged and then writes it as two statements, and it is only safe
   * because of this guarantee (see `stillUnchanged` in `../remote/push.ts`).
   * An implementation that let two connections share one file would reopen
   * the race that guard exists to close, and nothing would fail to compile.
   */
  withTransactionAsync(work: () => Promise<void>): Promise<void>;
};

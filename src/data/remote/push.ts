import type { SqlDatabase, SqlValue } from '../local/database';
import { nowIso } from '../local/rows';

import { toLocalRow, toRemoteRow, type LocalRow } from './codec';
import { recordPush } from './sync-state';
import { syncedTables, type SyncTable } from './tables';
import type { SyncTransport, TransportFailure } from './transport';

/**
 * `pushChanges`: every row this device has changed and not yet sent
 * (spec 0002, API surface; spec 0004, AC-10; spec 0005, AC-2, AC-3, AC-5).
 *
 * Four rules hold it together:
 *
 * - **Upsert on the primary key**, so a push interrupted after the server
 *   wrote but before the device recorded the acknowledgement creates nothing
 *   on the retry (AC-14). The identifier was minted on the device, so there is
 *   nothing to renumber.
 * - **Dependency order**, so a meal reaches the server before its items and no
 *   foreign key is left pointing at a row that has not arrived.
 * - **Nothing is marked clean until the server said so.** A failure leaves
 *   `is_dirty` exactly as it was, which is why a lost connection costs a
 *   retry and never a meal.
 * - **The reply is the truth, not the request.** Spec 0005 gave Postgres the
 *   clock and the tombstone, so what comes back is not always what went out:
 *   `updated_at` is always the server's, and a push that tried to revive a
 *   deleted row comes back as the tombstone. This file used to keep only the
 *   returned `updated_at` and leave the local content alone, which after 0005
 *   would leave a deleted meal sitting on one phone forever, marked clean,
 *   with the watermark already past the tombstone that would have fixed it.
 *   So the whole returned row is written back.
 */

/** Rows per request. Small enough to retry cheaply on a bad connection. */
const BATCH = 200;

export type PushResult =
  | { readonly kind: 'pushed'; readonly rows: number }
  | {
      readonly kind: 'failed';
      readonly reason: TransportFailure;
      readonly message: string;
      /** What did land before it stopped. Those rows are already clean. */
      readonly rows: number;
    };

export type PushOptions = {
  readonly now?: () => string;
  readonly tables?: readonly SyncTable[];
};

/**
 * The `updated_at` this device sent for each row, by key.
 *
 * It has to be captured before the request, because the reply no longer
 * carries it: the server has already replaced it with its own. It is what the
 * write back is guarded on, so a row the person edited while the push was in
 * flight is left alone (spec 0005, AC-5).
 */
const stampsSent = (table: SyncTable, rows: readonly LocalRow[]): ReadonlyMap<string, SqlValue> =>
  new Map(
    rows.flatMap((row) => {
      const key = row[table.key];
      return typeof key === 'string' ? [[key, row['updated_at'] ?? null] as const] : [];
    }),
  );

/** Every shared column except the key, which identifies the row rather than moving. */
const writtenColumns = (table: SyncTable): readonly string[] =>
  table.columns.map((column) => column.name).filter((name) => name !== table.key);

/** The write back statement for a table. Built once per push, not once per row. */
const writeBackSql = (table: SyncTable): string =>
  `UPDATE ${table.name}
      SET ${writtenColumns(table)
        .map((name) => `${name} = ?`)
        .join(', ')}, synced_at = ?, is_dirty = 0
    WHERE ${table.key} = ?`;

/**
 * Whether the local row is still the one that was sent.
 *
 * `IS` rather than `=`, because a row that has never been pushed carries a
 * null `updated_at`, and `= NULL` is never true in SQL. Getting this wrong
 * would silently refuse every first push.
 *
 * **This rests on an invariant of the local write paths**: every write that
 * sets `is_dirty = 1` also moves `updated_at` (see `deleteMeal` and `saveMeal`
 * in `../local/meals.ts`). A future write that dirties a row without moving
 * the stamp would slip past this check and have its edit overwritten by the
 * reply, which is the exact bug this guard exists to prevent.
 *
 * **And on one from the port**: this check and the write that follows it are
 * two statements, so they are only safe because `withTransactionAsync`
 * serialises every other writer on the connection while they run. That is
 * documented on `SqlDatabase` in `../local/database.ts`. It is a separate
 * statement rather than a `WHERE updated_at IS ?` on the update itself only
 * because `runAsync` reports no affected row count, so a conditional update
 * could not say whether it matched.
 */
const stillUnchanged = async (
  db: SqlDatabase,
  table: SyncTable,
  key: string,
  sentStamp: SqlValue,
): Promise<boolean> =>
  (await db.getFirstAsync<{ key: string }>(
    `SELECT ${table.key} AS key FROM ${table.name}
      WHERE ${table.key} = ? AND updated_at IS ?`,
    [key, sentStamp],
  )) !== null;

const pushTable = async (
  db: SqlDatabase,
  transport: SyncTransport,
  table: SyncTable,
  now: () => string,
): Promise<PushResult> => {
  let confirmed = 0;

  for (;;) {
    const dirty = await db.getAllAsync<LocalRow>(
      `SELECT * FROM ${table.name} WHERE is_dirty = 1
        ORDER BY updated_at ASC, ${table.key} ASC LIMIT ${BATCH}`,
      [],
    );
    if (dirty.length === 0) return { kind: 'pushed', rows: confirmed };

    const sent = stampsSent(table, dirty);

    const result = await transport.upsert(
      table.name,
      table.key,
      dirty.map((row) => toRemoteRow(table, row)),
    );

    if (result.kind === 'failed') {
      return { kind: 'failed', reason: result.reason, message: result.message, rows: confirmed };
    }

    const at = now();
    let landed = 0;

    // The reply is the truth. Every returned column goes back into the file,
    // not just `updated_at`: after spec 0005 the server may hand back a
    // tombstone for a row this device pushed as live, and that is the only
    // moment the phone can learn it. Anything the server did not return stays
    // dirty and goes again next time.
    const sql = writeBackSql(table);
    const columns = writtenColumns(table);

    await db.withTransactionAsync(async () => {
      for (const remote of result.rows) {
        const local = toLocalRow(table, remote);
        const key = local[table.key];

        // A row this device did not send is not this push's business.
        if (typeof key !== 'string' || !sent.has(key)) continue;
        if (!(await stillUnchanged(db, table, key, sent.get(key) ?? null))) continue;

        await db.runAsync(sql, [...columns.map((name) => local[name] ?? null), at, key]);
        landed += 1;
      }
    });

    await recordPush(db, table.name, at);
    confirmed += landed;

    // Two ways to stop. A short page means nothing else was waiting. A page
    // that confirmed nothing means every row in it was edited while it was in
    // flight, and asking again immediately would send the very same page: the
    // next sync takes them instead.
    if (dirty.length < BATCH || landed === 0) return { kind: 'pushed', rows: confirmed };
  }
};

export const pushChanges = async (
  db: SqlDatabase,
  transport: SyncTransport,
  options: PushOptions = {},
): Promise<PushResult> => {
  const now = options.now ?? (() => nowIso());
  let total = 0;

  for (const table of options.tables ?? syncedTables) {
    const result = await pushTable(db, transport, table, now);
    total += result.rows;
    if (result.kind === 'failed') {
      return { kind: 'failed', reason: result.reason, message: result.message, rows: total };
    }
  }

  return { kind: 'pushed', rows: total };
};

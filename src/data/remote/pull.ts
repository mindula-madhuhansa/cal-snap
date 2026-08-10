import type { SqlDatabase, SqlValue } from '../local/database';
import { nowIso } from '../local/rows';

import { toLocalRow, type RemoteRow } from './codec';
import { readWatermark, writeWatermark } from './sync-state';
import { syncedTables, type SyncTable } from './tables';
import type { SyncTransport, TransportFailure } from './transport';

/**
 * `pullChanges`: everything that changed on the server since this device last
 * looked (spec 0002, API surface; spec 0004, AC-9).
 *
 * Resumes by keyset on `(updated_at asc, key asc)` from the watermark in
 * `sync_state`, and a table with no watermark starts at the beginning of time,
 * which is how a diary arrives on a new phone.
 *
 * Two rows are refused on the way in, and both refusals are the interesting
 * part of this file:
 *
 * - **A live row for something deleted here.** A tombstone is sticky and one
 *   way (spec 0002). Without this rule a device that was offline when the
 *   delete happened resurrects the meal, which is the bug a person notices
 *   most: a meal they deleted coming back.
 * - **Anything overwriting unpushed local work.** A row still `is_dirty` has
 *   not reached the server, so the server's copy is by definition older than
 *   what is on this phone. It is left alone and pushed on the next cycle.
 */

/** Rows per request. The watermark advances a page at a time. */
const PAGE = 500;

export type PullResult =
  | { readonly kind: 'pulled'; readonly rows: number }
  | {
      readonly kind: 'failed';
      readonly reason: TransportFailure;
      readonly message: string;
      readonly rows: number;
    };

export type PullOptions = {
  readonly now?: () => string;
  readonly tables?: readonly SyncTable[];
};

const upsertSql = (table: SyncTable): string => {
  const names = table.columns.map((column) => column.name);
  const placeholders = names.map(() => '?').join(', ');
  const assignments = names
    .filter((name) => name !== table.key)
    .map((name) => `${name} = excluded.${name}`);

  return `INSERT INTO ${table.name} (${names.join(', ')}, is_dirty, synced_at)
            VALUES (${placeholders}, 0, ?)
       ON CONFLICT(${table.key}) DO UPDATE SET
            ${[...assignments, 'is_dirty = 0', 'synced_at = excluded.synced_at'].join(',\n            ')}`;
};

type LocalState = { readonly is_dirty: number; readonly deleted_at: string | null };

/** Whether an incoming row may be written over what is already here. */
const mayApply = (local: LocalState | null, incomingDeletedAt: SqlValue): boolean => {
  if (local === null) return true;
  if (local.is_dirty === 1) return false;
  return !(local.deleted_at !== null && incomingDeletedAt === null);
};

const applyRow = async (
  db: SqlDatabase,
  table: SyncTable,
  row: RemoteRow,
  at: string,
): Promise<boolean> => {
  const local = toLocalRow(table, row);
  const key = local[table.key];
  if (typeof key !== 'string') return false;

  const existing = await db.getFirstAsync<LocalState>(
    // `deleted_at` is on every synced table except `profiles`, which has no
    // soft delete, so it is selected as a constant there rather than branching
    // at the call site.
    table.columns.some((column) => column.name === 'deleted_at')
      ? `SELECT is_dirty, deleted_at FROM ${table.name} WHERE ${table.key} = ?`
      : `SELECT is_dirty, NULL AS deleted_at FROM ${table.name} WHERE ${table.key} = ?`,
    [key],
  );

  if (!mayApply(existing, local['deleted_at'] ?? null)) return false;

  await db.runAsync(upsertSql(table), [
    ...table.columns.map((column) => local[column.name] ?? null),
    at,
  ]);
  return true;
};

const pullTable = async (
  db: SqlDatabase,
  transport: SyncTransport,
  table: SyncTable,
  now: () => string,
): Promise<PullResult> => {
  let applied = 0;
  let since = await readWatermark(db, table.name);

  for (;;) {
    // `since` is inclusive on purpose. The watermark stores an instant, not an
    // instant plus a key, so rows sharing the last instant would be skipped by
    // a strict comparison. Re-reading them costs one page and applying them
    // again changes nothing, because every apply is an upsert.
    const result = await transport.select(table.name, table.key, since, PAGE);

    if (result.kind === 'failed') {
      return { kind: 'failed', reason: result.reason, message: result.message, rows: applied };
    }
    if (result.rows.length === 0) return { kind: 'pulled', rows: applied };

    const at = now();

    await db.withTransactionAsync(async () => {
      for (const row of result.rows) {
        if (await applyRow(db, table, row, at)) applied += 1;
      }
    });

    const last = toLocalRow(table, result.rows[result.rows.length - 1] ?? {});
    const advanced = last['updated_at'];
    const nextSince = typeof advanced === 'string' ? advanced : since;

    // A full page that did not move the watermark means every row in it shares
    // the boundary instant. Asking again would return the same page forever,
    // so this stops instead; the rows are applied and the next change in that
    // table moves the watermark on.
    if (result.rows.length < PAGE || nextSince === since) {
      await writeWatermark(db, table.name, nextSince);
      return { kind: 'pulled', rows: applied };
    }

    since = nextSince;
    await writeWatermark(db, table.name, since);
  }
};

export const pullChanges = async (
  db: SqlDatabase,
  transport: SyncTransport,
  options: PullOptions = {},
): Promise<PullResult> => {
  const now = options.now ?? (() => nowIso());
  let total = 0;

  for (const table of options.tables ?? syncedTables) {
    const result = await pullTable(db, transport, table, now);
    total += result.rows;
    if (result.kind === 'failed') {
      return { kind: 'failed', reason: result.reason, message: result.message, rows: total };
    }
  }

  return { kind: 'pulled', rows: total };
};

import type { SqlDatabase } from '../local/database';
import { nowIso } from '../local/rows';

import { toRemoteRow, type LocalRow } from './codec';
import { recordPush } from './sync-state';
import { syncedTables, type SyncTable } from './tables';
import type { SyncTransport, TransportFailure } from './transport';

/**
 * `pushChanges`: every row this device has changed and not yet sent
 * (spec 0002, API surface; spec 0004, AC-10).
 *
 * Three rules hold it together:
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

/** The rows the server confirmed, keyed by identifier, with its `updated_at`. */
const acknowledged = (
  table: SyncTable,
  rows: readonly Readonly<Record<string, unknown>>[],
): readonly (readonly [string, string])[] =>
  rows.flatMap((row) => {
    const key = row[table.key];
    const updatedAt = row['updated_at'];
    return typeof key === 'string' && typeof updatedAt === 'string'
      ? [[key, updatedAt] as const]
      : [];
  });

const pushTable = async (
  db: SqlDatabase,
  transport: SyncTransport,
  table: SyncTable,
  now: () => string,
): Promise<PushResult> => {
  let sent = 0;

  for (;;) {
    const dirty = await db.getAllAsync<LocalRow>(
      `SELECT * FROM ${table.name} WHERE is_dirty = 1
        ORDER BY updated_at ASC, ${table.key} ASC LIMIT ${BATCH}`,
      [],
    );
    if (dirty.length === 0) return { kind: 'pushed', rows: sent };

    const result = await transport.upsert(
      table.name,
      table.key,
      dirty.map((row) => toRemoteRow(table, row)),
    );

    if (result.kind === 'failed') {
      return { kind: 'failed', reason: result.reason, message: result.message, rows: sent };
    }

    const at = now();

    // The server's `updated_at` is the one the device keeps (spec 0002: a
    // phone with a wrong clock must not win every conflict forever). Anything
    // the server did not acknowledge stays dirty and goes again next time.
    await db.withTransactionAsync(async () => {
      for (const [key, updatedAt] of acknowledged(table, result.rows)) {
        await db.runAsync(
          `UPDATE ${table.name} SET updated_at = ?, synced_at = ?, is_dirty = 0
            WHERE ${table.key} = ?`,
          [updatedAt, at, key],
        );
      }
    });

    await recordPush(db, table.name, at);
    sent += dirty.length;

    // A short page means there was nothing else waiting.
    if (dirty.length < BATCH) return { kind: 'pushed', rows: sent };
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

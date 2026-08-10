import type { SqlDatabase } from '../local/database';

import { BEGINNING_OF_TIME } from './transport';

/**
 * The pull watermark: how far this device got, per table.
 *
 * One row per table in `sync_state` (SQLite migration 3). A table with no row
 * here pulls from the beginning of time, which is exactly the fresh device
 * case (spec 0004, AC-9).
 */

export const readWatermark = async (db: SqlDatabase, table: string): Promise<string> => {
  const row = await db.getFirstAsync<{ last_pulled_at: string }>(
    'SELECT last_pulled_at FROM sync_state WHERE table_name = ?',
    [table],
  );
  return row?.last_pulled_at ?? BEGINNING_OF_TIME;
};

export const writeWatermark = async (
  db: SqlDatabase,
  table: string,
  pulledAt: string,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO sync_state (table_name, last_pulled_at) VALUES (?, ?)
       ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [table, pulledAt],
  );
};

/** Diagnostics only. Nothing reads it to make a decision. */
export const recordPush = async (
  db: SqlDatabase,
  table: string,
  pushedAt: string,
): Promise<void> => {
  await db.runAsync(
    `INSERT INTO sync_state (table_name, last_pulled_at, last_pushed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(table_name) DO UPDATE SET last_pushed_at = excluded.last_pushed_at`,
    [table, BEGINNING_OF_TIME, pushedAt],
  );
};

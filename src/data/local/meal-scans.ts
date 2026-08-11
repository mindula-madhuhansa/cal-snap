import { failed, ok, type DataResult } from '../types';

import type { SqlDatabase } from './database';

/**
 * The phone's copy of a scan the server already recorded (spec 0007, AC-9).
 *
 * **Written clean, never dirty.** The authoritative row is the one the edge
 * function wrote in Postgres, with its real `cost_cents` and `raw_response`, so
 * this copy goes in with `is_dirty = 0` and `synced_at` set to the `updated_at`
 * the function returned. That is what keeps `countPendingPushes` from counting
 * it and keeps the pull watermark behaving.
 *
 * The phone must never push over the server's `cost_cents` or `raw_response`.
 * Nothing here writes either: the columns are left to arrive on the next pull.
 *
 * `meal_scans` has no `deleted_at`, so there is no tombstone to respect and the
 * one update a scan ever takes (from `failed` to its real status) is not
 * fighting spec 0005's sticky delete rule. Adding `deleted_at` to this table
 * later would break that quietly.
 */

export type MirroredScan = {
  readonly id: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly status: 'ok' | 'low_confidence' | 'unrecognised' | 'failed';
  readonly confidence: 'high' | 'medium' | 'low' | null;
  readonly costCents: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/**
 * Upsert, not insert. The same scan reaches here twice in ordinary use: once
 * when the result comes back, and again on the next pull. A bare insert would
 * make the second one fail on the primary key.
 */
export const mirrorScan = async (
  db: SqlDatabase,
  userId: string,
  scan: MirroredScan,
): Promise<DataResult<undefined>> => {
  try {
    await db.runAsync(
      `INSERT INTO meal_scans
         (id, user_id, model, prompt_version, status, confidence, raw_response,
          cost_cents, created_at, updated_at, is_dirty, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, ?)
       ON CONFLICT(id) DO UPDATE SET
         status = excluded.status,
         confidence = excluded.confidence,
         cost_cents = excluded.cost_cents,
         updated_at = excluded.updated_at,
         is_dirty = 0,
         synced_at = excluded.synced_at`,
      [
        scan.id,
        userId,
        scan.model,
        scan.promptVersion,
        scan.status,
        scan.confidence,
        scan.costCents,
        scan.createdAt,
        scan.updatedAt,
        // Clean as of exactly the stamp the server returned, so the next pull
        // does not treat this row as behind.
        scan.updatedAt,
      ],
    );

    return ok(undefined);
  } catch (error) {
    // A scan the phone could not file locally is not worth stopping a person
    // over: the durable record is already in Postgres and will come back down
    // on the next pull. The caller reports nothing and carries on.
    return failed(error instanceof Error ? error.message : 'The scan could not be saved locally.');
  }
};

/** How many scans this account has recorded on a day, from the rows alone. */
export const countScansOnDay = async (
  db: SqlDatabase,
  query: { readonly userId: string; readonly day: string },
): Promise<DataResult<number>> => {
  try {
    const row = await db.getFirstAsync<{ n: number }>(
      `SELECT count(*) AS n FROM meal_scans
        WHERE user_id = ?
          AND created_at >= ?
          AND created_at < ?
          AND status <> 'failed'`,
      [query.userId, `${query.day}T00:00:00.000Z`, `${query.day}T23:59:59.999Z`],
    );

    return ok(row?.n ?? 0);
  } catch (error) {
    return failed(error instanceof Error ? error.message : 'Scan usage could not be read.');
  }
};

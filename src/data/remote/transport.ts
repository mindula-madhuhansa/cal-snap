import type { RemoteRow } from './codec';

/**
 * The narrow port sync talks to, in the same spirit as `SqlDatabase`.
 *
 * The Supabase client satisfies it through the adapter in
 * `src/account/supabase-transport.ts`, and a plain object satisfies it in the
 * tests, so the push and pull rules (a tombstone that sticks, a watermark that
 * resumes, a replay that creates nothing) are proven without a network.
 *
 * Everything here returns a result value rather than throwing. A phone with no
 * signal is an expected Tuesday, not an exceptional condition.
 */

export type TransportFailure =
  /** No signal, DNS, a timeout. The work is still here and will go later. */
  | 'offline'
  /** The token was refused. Spec 0004 AC-13: the session ended under us. */
  | 'session-ended'
  /** The server understood and said no. A bug, not a network condition. */
  | 'rejected';

export type TransportResult =
  | { readonly kind: 'ok'; readonly rows: readonly RemoteRow[] }
  | {
      readonly kind: 'failed';
      readonly reason: TransportFailure;
      /** A sentence a person could read. Never a raw provider string. */
      readonly message: string;
    };

export type SyncTransport = {
  /**
   * Upserts on the primary key, so pushing the same rows twice produces the
   * same result and no duplicates (spec 0002, AC-14). Returns the stored rows,
   * which is where the server's `updated_at` comes back from.
   */
  upsert(table: string, key: string, rows: readonly RemoteRow[]): Promise<TransportResult>;

  /**
   * Rows changed at or after `since`, tombstones included, ordered by
   * `(updated_at asc, key asc)` so a pull can resume by keyset.
   */
  select(table: string, key: string, since: string, limit: number): Promise<TransportResult>;
};

/**
 * Where a pull starts when this device has never pulled that table: the
 * beginning of time.
 *
 * Spec 0002 made `since` required but never named this default, and spec 0004
 * does: without it a fresh device pulls nothing and AC-9 cannot hold, because
 * the diary that is meant to arrive on a new phone never does.
 */
export const BEGINNING_OF_TIME = '1970-01-01T00:00:00.000Z';

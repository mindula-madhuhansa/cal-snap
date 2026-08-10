import type { RemoteRow } from '../../src/data/remote/codec';
import type {
  SyncTransport,
  TransportFailure,
  TransportResult,
} from '../../src/data/remote/transport';

/**
 * A server made of one Map per table, good enough to prove the rules and
 * nothing more.
 *
 * It is shared setup rather than part of one test file, because the push, the
 * pull, and the `runSync` tests all drive it, and because the rules it does
 * **not** implement are worth stating in one place:
 *
 * - It does **not** stamp `updated_at` unless a test asks it to, because the
 *   live Postgres does not either yet (there is no trigger). A test that wants
 *   to prove the device keeps the server's value says so explicitly.
 * - It does **not** arbitrate. Newest write wins on the server is spec 0002's
 *   design and is still owed; here the last write simply lands.
 *
 * It lives in `test/support/` rather than beside the source, so none of it
 * can ever be imported by the app.
 */

export type FakeServer = {
  readonly transport: SyncTransport;
  /** Every row the server holds for a table, in insertion order. */
  rowsIn: (table: string) => readonly RemoteRow[];
  /** Puts a row on the server as if another phone had pushed it. */
  put: (table: string, row: RemoteRow) => void;
  /** Fails every request from now on, the way a phone in a lift does. */
  goOffline: (reason?: TransportFailure) => void;
  goOnline: () => void;
  /** Rewrites `updated_at` on receipt, standing in for a server trigger. */
  stampUpdatedAt: (at: string) => void;
  /** How many requests of each kind were made. */
  readonly counts: { upserts: number; selects: number };
};

export const createFakeServer = (): FakeServer => {
  const tables = new Map<string, Map<string, RemoteRow>>();
  const counts = { upserts: 0, selects: 0 };
  let offline: TransportFailure | undefined = undefined;
  let stamp: string | undefined = undefined;

  const tableOf = (name: string): Map<string, RemoteRow> => {
    const existing = tables.get(name);
    if (existing !== undefined) return existing;

    const created = new Map<string, RemoteRow>();
    tables.set(name, created);
    return created;
  };

  const keyOf = (row: RemoteRow, key: string): string => String(row[key]);

  const failure = (): TransportResult => ({
    kind: 'failed',
    reason: offline ?? 'offline',
    message: 'The server could not be reached.',
  });

  const transport: SyncTransport = {
    upsert: async (table, key, rows) => {
      counts.upserts += 1;
      if (offline !== undefined) return failure();

      const stored = rows.map((row) => {
        const withStamp = stamp === undefined ? row : { ...row, updated_at: stamp };
        tableOf(table).set(keyOf(row, key), withStamp);
        return withStamp;
      });

      return { kind: 'ok', rows: stored };
    },

    select: async (table, key, since, limit) => {
      counts.selects += 1;
      if (offline !== undefined) return failure();

      const rows = [...tableOf(table).values()]
        .filter((row) => String(row['updated_at']) >= since)
        .sort((left, right) => {
          const byTime = String(left['updated_at']).localeCompare(String(right['updated_at']));
          return byTime !== 0 ? byTime : String(left[key]).localeCompare(String(right[key]));
        })
        .slice(0, limit);

      return { kind: 'ok', rows };
    },
  };

  return {
    transport,
    counts,
    rowsIn: (table) => [...tableOf(table).values()],
    put: (table, row) => {
      const key = 'id' in row ? 'id' : 'user_id';
      tableOf(table).set(String(row[key]), row);
    },
    goOffline: (reason = 'offline') => {
      offline = reason;
    },
    goOnline: () => {
      offline = undefined;
    },
    stampUpdatedAt: (at) => {
      stamp = at;
    },
  };
};

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
 * pull, and the `runSync` tests all drive it. It models the three rules the
 * real Postgres triggers enforce (spec 0005, `sync_stamp` and
 * `sync_stamp_sticky_delete`), because the client behaviour under test only
 * makes sense against a server that behaves that way:
 *
 * - **It stamps `updated_at` itself**, distinctly per row, the way
 *   `clock_timestamp()` does. `stampUpdatedAt` overrides it with a fixed value
 *   for a test that wants to pin the exact instant.
 * - **It freezes `created_at`** on a row it already holds.
 * - **It refuses to revive a tombstone**, returning the stored row untouched,
 *   which is how the pushing device learns it lost.
 *
 * What it still does not do is arbitrate on content: the last push wins, which
 * is exactly what spec 0005 decided, because a server owned clock makes newest
 * write and last push the same event.
 *
 * It lives in `test/support/` rather than beside the source, so none of it
 * can ever be imported by the app.
 */

/** Where the fake server's clock starts. Distinct per row, like the real one. */
const SERVER_EPOCH = Date.parse('2026-08-10T00:00:00.000Z');

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
  let tick = 0;

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

  const isSet = (value: RemoteRow[string] | undefined): boolean =>
    value !== null && value !== undefined;

  /** `clock_timestamp()`, near enough: a distinct instant for every row. */
  const serverStamp = (): string => {
    tick += 1;
    return new Date(SERVER_EPOCH + tick).toISOString();
  };

  /** What the trigger would store, given what is already there. */
  const arbitrate = (incoming: RemoteRow, existing: RemoteRow | undefined): RemoteRow => {
    // The sticky tombstone. The stored row wins whole, so an edit sent with
    // the revival is discarded with it.
    if (existing !== undefined && isSet(existing['deleted_at']) && !isSet(incoming['deleted_at'])) {
      return existing;
    }

    return {
      ...incoming,
      // Frozen once the server holds the row, never restamped.
      created_at:
        (existing === undefined ? incoming['created_at'] : existing['created_at']) ?? null,
      updated_at: stamp ?? serverStamp(),
    };
  };

  const transport: SyncTransport = {
    upsert: async (table, key, rows) => {
      counts.upserts += 1;
      if (offline !== undefined) return failure();

      const stored = rows.map((row) => {
        const identifier = keyOf(row, key);
        const settled = arbitrate(row, tableOf(table).get(identifier));
        tableOf(table).set(identifier, settled);
        return settled;
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

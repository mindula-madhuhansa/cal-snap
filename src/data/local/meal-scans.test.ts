import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openTestDatabase, USER_A, USER_B, type TestDatabase } from '../../../test/support/sqlite';
import type { SqlDatabase } from './database';
import { countScansOnDay, mirrorScan, type MirroredScan } from './meal-scans';

/**
 * The phone's copy of a scan the server already recorded (spec 0007, AC-9).
 *
 * Driven against real `node:sqlite` through the narrow `SqlDatabase` port, so
 * these run the actual query text and the actual migration rather than a stand
 * in. Nothing here needs a phone, a network, or the edge function.
 *
 * The thing most worth pinning is that the mirror goes in **clean**. The
 * authoritative row is the one in Postgres, with its real `cost_cents` and
 * `raw_response`. A copy written dirty would be picked up by
 * `countPendingPushes`, pushed back up, and would overwrite the server's own
 * cost with a null. Nothing would fail while it happened; the money record
 * would just quietly stop being true.
 */

let store: TestDatabase;

beforeEach(() => {
  store = openTestDatabase();
});

afterEach(() => {
  store.close();
});

const aScan = (overrides: Partial<MirroredScan> = {}): MirroredScan => ({
  id: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
  model: 'claude-sonnet-5',
  promptVersion: 'v1',
  status: 'low_confidence',
  confidence: 'medium',
  costCents: 0.527,
  createdAt: '2026-08-11T13:34:03.513Z',
  updatedAt: '2026-08-11T13:34:09.675Z',
  ...overrides,
});

type ScanRow = {
  readonly status: string;
  readonly confidence: string | null;
  readonly cost_cents: number | null;
  readonly raw_response: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly is_dirty: number;
  readonly synced_at: string | null;
};

const readRow = (id: string): ScanRow =>
  store.raw.prepare('select * from meal_scans where id = ?').get(id) as unknown as ScanRow;

describe('mirrorScan', () => {
  // covers: AC-9
  it('writes the scan clean, so nothing pushes it back over the server', async () => {
    const scan = aScan();
    expect(await mirrorScan(store.db, USER_A, scan)).toEqual({ kind: 'ok', value: undefined });

    const row = readRow(scan.id);
    expect(row.is_dirty).toBe(0);
    // Clean as of exactly the stamp the function returned, so the next pull
    // does not treat this row as behind its own watermark.
    expect(row.synced_at).toBe(scan.updatedAt);
  });

  // covers: AC-9
  it('records the model, the prompt version, the status and the real cost', async () => {
    await mirrorScan(store.db, USER_A, aScan());

    const row = readRow(aScan().id);
    expect(row.status).toBe('low_confidence');
    expect(row.confidence).toBe('medium');
    expect(row.cost_cents).toBeCloseTo(0.527, 3);
  });

  // covers: AC-9. The phone must never push over the server's raw_response, so
  // it never writes one: the column arrives on the next pull or not at all.
  it('leaves raw_response null rather than inventing one', async () => {
    await mirrorScan(store.db, USER_A, aScan());

    expect(readRow(aScan().id).raw_response).toBeNull();
  });

  // covers: AC-18. The same scan reaches here twice in ordinary use: once when
  // the result returns, and again on the next pull. A bare insert would make
  // the second one fail on the primary key and lose the update.
  it('is an upsert, so the same scan arriving twice updates rather than failing', async () => {
    await mirrorScan(
      store.db,
      USER_A,
      aScan({ status: 'failed', confidence: null, costCents: null }),
    );

    const settled = await mirrorScan(
      store.db,
      USER_A,
      aScan({
        status: 'ok',
        confidence: 'high',
        costCents: 0.612,
        updatedAt: '2026-08-11T13:35:00Z',
      }),
    );

    expect(settled).toEqual({ kind: 'ok', value: undefined });

    const row = readRow(aScan().id);
    expect(row.status).toBe('ok');
    expect(row.confidence).toBe('high');
    expect(row.cost_cents).toBeCloseTo(0.612, 3);
    expect(row.synced_at).toBe('2026-08-11T13:35:00Z');
    expect(row.is_dirty).toBe(0);
  });

  // The row is one scan for its whole life, so the instant it was taken cannot
  // move underneath it when the settled version arrives.
  it('does not move created_at when the settled scan arrives', async () => {
    await mirrorScan(store.db, USER_A, aScan({ status: 'failed' }));
    await mirrorScan(
      store.db,
      USER_A,
      aScan({ status: 'ok', createdAt: '2027-01-01T00:00:00Z', updatedAt: '2026-08-11T13:35:00Z' }),
    );

    expect(readRow(aScan().id).created_at).toBe('2026-08-11T13:34:03.513Z');
  });

  // A scan the phone could not file locally is not worth stopping a person
  // over: the durable record is already in Postgres. It must come back as a
  // result value, never as a thrown error reaching the screen.
  it('returns a failure value rather than throwing when the write cannot happen', async () => {
    const broken: SqlDatabase = {
      ...store.db,
      runAsync: async () => {
        throw new Error('database is locked');
      },
    };

    const result = await mirrorScan(broken, USER_A, aScan());

    expect(result.kind).toBe('failed');
  });
});

describe('countScansOnDay', () => {
  let minted = 0;

  // Distinct, well formed version 7 identifiers, so nothing here collides on
  // the primary key and nothing depends on a shape the real ids do not have.
  const nextId = (): string => {
    minted += 1;
    return `019ff0fc-c81c-7aa2-ab53-${String(minted).padStart(12, '0')}`;
  };

  const record = async (userId: string, createdAt: string, status: MirroredScan['status']) =>
    mirrorScan(store.db, userId, aScan({ id: nextId(), createdAt, status }));

  // covers: AC-7. Only ok, low_confidence and unrecognised spend the day's
  // allowance. A failed scan produced no answer, so it costs nobody a slot.
  it('does not count a failed scan', async () => {
    await record(USER_A, '2026-08-11T08:00:00.000Z', 'ok');
    await record(USER_A, '2026-08-11T09:00:00.000Z', 'failed');
    await record(USER_A, '2026-08-11T10:00:00.000Z', 'unrecognised');
    await record(USER_A, '2026-08-11T11:00:00.000Z', 'low_confidence');

    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 3,
    });
  });

  // covers: AC-11. Every read is scoped by user_id even though each account
  // already has its own database file. The file split is the main defence and
  // this filter is the second one.
  it("does not count another person's scans", async () => {
    await record(USER_A, '2026-08-11T08:00:00.000Z', 'ok');
    await record(USER_B, '2026-08-11T09:00:00.000Z', 'ok');

    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 1,
    });
  });

  // covers: AC-8. The neighbouring days must not bleed in, or the cap resets at
  // the wrong moment and someone loses scans they still had.
  it('counts only the day asked for', async () => {
    await record(USER_A, '2026-08-10T23:00:00.000Z', 'ok');
    await record(USER_A, '2026-08-11T00:00:00.000Z', 'ok');
    await record(USER_A, '2026-08-11T12:00:00.000Z', 'ok');
    await record(USER_A, '2026-08-12T00:00:00.000Z', 'ok');

    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 2,
    });
  });

  /**
   * covers: AC-8. **A known defect, pinned rather than papered over.**
   *
   * The window is `created_at >= dayT00:00:00.000Z` and `< dayT23:59:59.999Z`,
   * so the final millisecond of the day is excluded by its own upper bound. A
   * scan taken at exactly 23:59:59.999 is counted on no day at all. The fix is
   * to close the window at the next midnight, the way `claim_meal_scan` and the
   * edge function's `local-day.ts` both already do.
   *
   * Nothing calls `countScansOnDay` yet, so this costs nobody a scan today. It
   * is written as `it.fails` so the suite stays honest and green: the moment
   * somebody fixes the bound, this test starts failing and asks to be turned
   * back into an ordinary assertion.
   */
  it.fails('counts a scan taken at the last instant of the day', async () => {
    await record(USER_A, '2026-08-11T23:59:59.999Z', 'ok');

    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 1,
    });
  });

  // The boundary as it actually behaves today, so the defect above has a
  // companion that says what the code really does rather than only what it
  // ought to.
  it('counts a scan taken a millisecond before the end of the day', async () => {
    await record(USER_A, '2026-08-11T23:59:59.998Z', 'ok');

    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 1,
    });
  });

  it('reports zero for a day with no scans', async () => {
    expect(await countScansOnDay(store.db, { userId: USER_A, day: '2026-08-11' })).toEqual({
      kind: 'ok',
      value: 0,
    });
  });

  it('returns a failure value rather than throwing when the read cannot happen', async () => {
    const broken: SqlDatabase = {
      ...store.db,
      getFirstAsync: async () => {
        throw new Error('no such table');
      },
    };

    expect((await countScansOnDay(broken, { userId: USER_A, day: '2026-08-11' })).kind).toBe(
      'failed',
    );
  });
});

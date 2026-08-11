import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFakeServer, type FakeServer } from '../../../test/support/fake-server';
import {
  anItem,
  openTestDatabase,
  seedProfile,
  testIdSource,
  USER_A,
  type TestDatabase,
} from '../../../test/support/sqlite';
import type { IdSource } from '../ids/uuid';
import { deleteMeal, listMealsForDay, saveMeal } from '../local/meals';
import { countPendingPushes } from '../local/pending';

import type { RemoteRow } from './codec';
import { pullChanges } from './pull';
import { pushChanges } from './push';
import { runSync } from './sync';
import { readWatermark } from './sync-state';
import { syncedTables } from './tables';
import { BEGINNING_OF_TIME } from './transport';

/**
 * Sync, driven end to end against a real SQLite database and a server made of
 * Maps. The rules being pinned here are the ones that lose someone's diary
 * when they are wrong, so each names the criterion it belongs to.
 */

let store: TestDatabase;
let server: FakeServer;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  server = createFakeServer();
  ids = testIdSource();
  seedProfile(store.raw, USER_A);
});

afterEach(() => {
  store.close();
});

/** Saves one meal with `items` items and returns its identifier. */
const saveOneMeal = async (items = 1, at = '2026-08-09T12:00:00Z'): Promise<string> => {
  const result = await saveMeal(
    store.db,
    {
      userId: USER_A,
      eatenAt: new Date(at),
      timeZone: 'Asia/Colombo',
      items: Array.from({ length: items }, (_, index) => anItem({ name: `Item ${index}` })),
    },
    ids,
  );
  if (result.kind !== 'ok') throw new Error(`could not save a meal: ${String(result.message)}`);
  return result.value;
};

const dirtyCount = (table: string): number => {
  const row = store.raw.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE is_dirty = 1`).get() as {
    n: number;
  };
  return row.n;
};

describe('pushChanges', () => {
  // covers: AC-10
  it('sends every dirty row and marks it clean', async () => {
    await saveOneMeal(3);

    const result = await pushChanges(store.db, server.transport);

    expect(result.kind).toBe('pushed');
    expect(server.rowsIn('meals')).toHaveLength(1);
    expect(server.rowsIn('meal_items')).toHaveLength(3);
    expect(await countPendingPushes(store.db)).toBe(0);
  });

  // covers: AC-14
  it('creates no duplicates when the same push is replayed', async () => {
    await saveOneMeal(2);
    await pushChanges(store.db, server.transport);

    // As if the acknowledgement was lost: the rows go up again.
    store.raw.exec('UPDATE meals SET is_dirty = 1');
    store.raw.exec('UPDATE meal_items SET is_dirty = 1');
    await pushChanges(store.db, server.transport);

    expect(server.rowsIn('meals')).toHaveLength(1);
    expect(server.rowsIn('meal_items')).toHaveLength(2);
  });

  it('keeps the value the server returned for updated_at', async () => {
    await saveOneMeal();
    server.stampUpdatedAt('2030-01-01T00:00:00.000Z');

    await pushChanges(store.db, server.transport);

    const row = store.raw.prepare('SELECT updated_at, synced_at FROM meals').get() as {
      updated_at: string;
      synced_at: string;
    };
    expect(row.updated_at).toBe('2030-01-01T00:00:00.000Z');
    expect(row.synced_at).not.toBeNull();
  });

  // A lost connection costs a retry, never a meal.
  it('leaves every row dirty when the push fails', async () => {
    await saveOneMeal(2);
    server.goOffline();

    const result = await pushChanges(store.db, server.transport);

    expect(result.kind).toBe('failed');
    expect(await countPendingPushes(store.db)).toBeGreaterThan(0);
  });

  it('sends a deleted meal as a tombstone rather than forgetting it', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);
    await deleteMeal(store.db, USER_A, mealId);

    await pushChanges(store.db, server.transport);

    const [meal] = server.rowsIn('meals');
    expect(meal?.['deleted_at']).not.toBeNull();
  });
});

/**
 * Spec 0005. The server now owns the clock and the tombstone, so what comes
 * back from a push is not always what went out, and the push has to believe
 * the reply rather than its own request.
 */
describe('pushChanges, when the server disagrees', () => {
  /** Reads one meal row straight out of SQLite, past every filter. */
  const mealRow = (mealId: string): Record<string, string | number | null> =>
    store.raw.prepare('SELECT * FROM meals WHERE id = ?').get(mealId) as Record<
      string,
      string | number | null
    >;

  // covers: spec 0005 AC-2, AC-4. The reply is authoritative even for a column
  // the phone sent a different value for. `created_at` is the honest test of
  // it, because the server freezes that column, so what comes back genuinely
  // differs from what went out. Before this, push kept only the returned
  // `updated_at` and the phone stayed permanently out of step with the server.
  it('adopts a column the server refused to change, not just the timestamp', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);

    // This phone rewrites when the meal was created and pushes that.
    store.raw
      .prepare('UPDATE meals SET created_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?')
      .run('1999-01-01T00:00:00.000Z', '2026-08-09T23:00:00.000Z', mealId);

    await pushChanges(store.db, server.transport);

    // The server froze it, so the phone must end up holding the server's value
    // rather than its own rejected one.
    expect(mealRow(mealId)['created_at']).not.toBe('1999-01-01T00:00:00.000Z');
    expect(mealRow(mealId)['created_at']).toBe(server.rowsIn('meals')[0]?.['created_at']);
    expect(mealRow(mealId)['is_dirty']).toBe(0);
  });

  // covers: spec 0005 AC-2. Last push wins, which is the whole arbitration
  // rule now that the server owns the clock.
  it('lets the later push win over what another phone stored', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);

    const stored = server.rowsIn('meals')[0];
    if (stored === undefined) throw new Error('the server should hold the meal');
    server.put('meals', { ...stored, note: 'theirs' });

    store.raw
      .prepare("UPDATE meals SET note = 'mine', updated_at = ?, is_dirty = 1 WHERE id = ?")
      .run('2026-08-09T23:00:00.000Z', mealId);
    await pushChanges(store.db, server.transport);

    expect(server.rowsIn('meals')[0]?.['note']).toBe('mine');
    expect(mealRow(mealId)['note']).toBe('mine');
  });

  // covers: spec 0005 AC-3. The case that would otherwise strand a meal: the
  // server refuses the revival, and this is the only moment the phone can
  // learn it. Without the write back the meal stays visible here forever,
  // marked clean, with the watermark already past the tombstone.
  it('takes the tombstone back when the server refuses to revive a row', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);

    // The meal was deleted on another phone and that delete reached the server.
    const stored = server.rowsIn('meals')[0];
    if (stored === undefined) throw new Error('the server should hold the meal');
    server.put('meals', { ...stored, deleted_at: '2026-08-10T09:00:00.000Z' });

    // This phone never saw the delete and pushes it as live again.
    store.raw
      .prepare("UPDATE meals SET note = 'still here', is_dirty = 1 WHERE id = ?")
      .run(mealId);
    await pushChanges(store.db, server.transport);

    const row = mealRow(mealId);
    expect(row['deleted_at']).toBe('2026-08-10T09:00:00.000Z');
    expect(row['is_dirty']).toBe(0);
    // The whole stored row came back, so the edit sent with the revival went
    // with it. An edit to a deleted meal has nothing to apply to.
    expect(row['note']).toBeNull();
    expect(server.rowsIn('meals')[0]?.['deleted_at']).toBe('2026-08-10T09:00:00.000Z');
  });

  // covers: spec 0005 AC-3. The visible half of the rule above.
  it('stops showing a meal the server insists is deleted', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);

    const stored = server.rowsIn('meals')[0];
    if (stored === undefined) throw new Error('the server should hold the meal');
    server.put('meals', { ...stored, deleted_at: '2026-08-10T09:00:00.000Z' });
    store.raw.prepare('UPDATE meals SET is_dirty = 1 WHERE id = ?').run(mealId);

    await pushChanges(store.db, server.transport);

    const day = await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' });
    expect(day.kind).toBe('ok');
    if (day.kind === 'ok') expect(day.value.meals).toHaveLength(0);
  });

  // covers: spec 0005 AC-5. The hole that existed before 0005 too: a push
  // marked a row clean even if the person had edited it a moment earlier, so
  // the edit was never sent at all.
  it('leaves a row dirty when it changed while its own push was in flight', async () => {
    const mealId = await saveOneMeal();

    // The reply lands, and the person has already typed something new.
    const editing = {
      ...server.transport,
      upsert: async (table: string, key: string, rows: readonly RemoteRow[]) => {
        const result = await server.transport.upsert(table, key, rows);
        if (table === 'meals') {
          // Exactly what a real local write does: the content, a fresh
          // `updated_at`, and the dirty flag together. The guard reads the
          // stamp, so a write that moved only the content would slip past it.
          store.raw
            .prepare(
              "UPDATE meals SET note = 'typed just now', updated_at = ?, is_dirty = 1 WHERE id = ?",
            )
            .run('2026-08-09T23:59:59.000Z', mealId);
        }
        return result;
      },
    };

    await pushChanges(store.db, editing);

    const row = mealRow(mealId);
    expect(row['is_dirty']).toBe(1);
    expect(row['note']).toBe('typed just now');
  });

  // covers: spec 0005 AC-5. Rows are read in pages and the loop used to end
  // only on a short page. Now that a row can legitimately stay dirty, a full
  // page that confirms nothing would be read and sent again immediately.
  it('reports the rows the server confirmed, not the rows it sent', async () => {
    await saveOneMeal();

    const refusing = {
      ...server.transport,
      upsert: async (table: string, key: string, rows: readonly RemoteRow[]) => {
        await server.transport.upsert(table, key, rows);
        // As if every row had been edited mid flight: nothing may be confirmed.
        return { kind: 'ok' as const, rows: [] };
      },
    };

    const result = await pushChanges(store.db, refusing);

    expect(result.kind).toBe('pushed');
    if (result.kind === 'pushed') expect(result.rows).toBe(0);
    expect(await countPendingPushes(store.db)).toBeGreaterThan(0);
  });
});

describe('pullChanges', () => {
  // covers: AC-9
  it('pulls from the beginning of time when this device has no watermark', async () => {
    expect(await readWatermark(store.db, 'meals')).toBe(BEGINNING_OF_TIME);

    server.put('meals', {
      id: 'meal-from-another-phone',
      user_id: USER_A,
      eaten_on: '2026-08-01',
      eaten_at: '2026-08-01T08:00:00.000Z',
      tz_at_save: 'Asia/Colombo',
      meal_type: 'breakfast',
      meal_type_source: 'guessed',
      note: null,
      photo_local_uri: null,
      photo_remote_path: null,
      photo_synced_at: null,
      scan_id: null,
      created_at: '2026-08-01T08:00:00.000Z',
      updated_at: '2026-08-01T08:00:00.000Z',
      deleted_at: null,
    });

    const result = await pullChanges(store.db, server.transport);

    expect(result.kind).toBe('pulled');
    const day = await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-01' });
    expect(day.kind).toBe('ok');
    if (day.kind === 'ok') expect(day.value.meals).toHaveLength(1);
  });

  it('moves the watermark on so the next pull is not a full download', async () => {
    server.put('meals', {
      id: 'meal-1',
      user_id: USER_A,
      eaten_on: '2026-08-01',
      eaten_at: '2026-08-01T08:00:00.000Z',
      tz_at_save: 'Asia/Colombo',
      meal_type: 'breakfast',
      meal_type_source: 'guessed',
      note: null,
      photo_local_uri: null,
      photo_remote_path: null,
      photo_synced_at: null,
      scan_id: null,
      created_at: '2026-08-01T08:00:00.000Z',
      updated_at: '2026-08-01T08:00:00.000Z',
      deleted_at: null,
    });

    await pullChanges(store.db, server.transport);

    expect(await readWatermark(store.db, 'meals')).toBe('2026-08-01T08:00:00.000Z');
  });

  // covers: AC-5
  it('refuses a live row for a meal deleted here, so a delete is not undone', async () => {
    const mealId = await saveOneMeal();
    await pushChanges(store.db, server.transport);

    // The delete happens here, and the server still holds the live copy that
    // another phone last saw.
    await deleteMeal(store.db, USER_A, mealId);
    store.raw.exec('UPDATE meals SET is_dirty = 0');
    store.raw.exec('UPDATE meal_items SET is_dirty = 0');

    await pullChanges(store.db, server.transport);

    const row = store.raw.prepare('SELECT deleted_at FROM meals WHERE id = ?').get(mealId) as {
      deleted_at: string | null;
    };
    expect(row.deleted_at).not.toBeNull();
  });

  it('refuses to overwrite work this phone has not pushed yet', async () => {
    const mealId = await saveOneMeal();

    server.put('meals', {
      id: mealId,
      user_id: USER_A,
      eaten_on: '2026-08-09',
      eaten_at: '2026-08-09T12:00:00.000Z',
      tz_at_save: 'Asia/Colombo',
      meal_type: 'lunch',
      meal_type_source: 'guessed',
      note: 'from the server',
      photo_local_uri: null,
      photo_remote_path: null,
      photo_synced_at: null,
      scan_id: null,
      created_at: '2026-08-09T12:00:00.000Z',
      updated_at: '2026-08-09T12:00:00.000Z',
      deleted_at: null,
    });

    await pullChanges(store.db, server.transport);

    const row = store.raw.prepare('SELECT note, is_dirty FROM meals WHERE id = ?').get(mealId) as {
      note: string | null;
      is_dirty: number;
    };
    expect(row.note).toBeNull();
    expect(row.is_dirty).toBe(1);
  });
});

describe('runSync', () => {
  // covers: AC-10
  it('pushes before it pulls, so the server never answers with a stale copy', async () => {
    await saveOneMeal();

    const outcome = await runSync(store.db, server.transport, 'after-write');

    expect(outcome.kind).toBe('synced');
    expect(server.rowsIn('meals')).toHaveLength(1);
    expect(dirtyCount('meals')).toBe(0);
  });

  // covers: AC-11
  it('signing out pushes and does not pull a diary that is about to go', async () => {
    await saveOneMeal();
    const before = server.counts.selects;

    await runSync(store.db, server.transport, 'sign-out');

    expect(server.counts.selects).toBe(before);
    expect(await countPendingPushes(store.db)).toBe(0);
  });

  it('reports the failure and keeps the work when there is no signal', async () => {
    await saveOneMeal();
    server.goOffline();

    const outcome = await runSync(store.db, server.transport, 'foreground');

    expect(outcome.kind).toBe('failed');
    if (outcome.kind === 'failed') expect(outcome.failure).toBe('offline');
    expect(await countPendingPushes(store.db)).toBeGreaterThan(0);
  });

  it('sends a meal with several items as one push per table, not one per row', async () => {
    await saveOneMeal(4);
    const before = server.counts.upserts;

    await runSync(store.db, server.transport, 'after-write');

    // One request for `meals` and one for `meal_items`, and nothing at all for
    // the four tables with nothing to say. Four items is not four pushes,
    // which is the whole point of the debounce that triggers this (AC-10).
    expect(server.counts.upserts - before).toBe(2);
  });
});

describe('syncedTables', () => {
  it('covers every table both databases share, in dependency order', () => {
    expect(syncedTables.map((table) => table.name)).toEqual([
      'profiles',
      'meal_scans',
      'meals',
      'meal_items',
      'daily_targets',
      'weight_entries',
      'target_overrides',
    ]);
  });

  // covers: AC-13 (spec 0006). The draft is `presence: 'sqlite'`, so the
  // partial answers of an unfinished setup never leave the one device giving
  // them, and no push can carry them.
  it('never sends the onboarding draft', () => {
    expect(syncedTables.map((table) => table.name)).not.toContain('onboarding_draft');
  });

  it('never sends the two device only columns', () => {
    for (const table of syncedTables) {
      const names = table.columns.map((column) => column.name);
      expect(names).not.toContain('is_dirty');
      expect(names).not.toContain('synced_at');
    }
  });
});

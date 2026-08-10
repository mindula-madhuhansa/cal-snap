import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFakeServer } from '../../../test/support/fake-server';
import {
  openTestDatabase,
  seedProfile,
  seedWeight,
  testIdSource,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../../../test/support/sqlite';
import { dayScopedId } from '../ids/uuid';
import { pushChanges } from '../remote/push';
import { syncedTables } from '../remote/tables';

import { getOrCreateDailyTarget } from './daily-targets';
import { clearOverride, listOverridesOn, resolveOverride, setOverride } from './target-overrides';
import { calorieTargetFormula, MANUAL_VERSION } from './target-formula';

let store: TestDatabase;

beforeEach(() => {
  store = openTestDatabase();
});

afterEach(() => {
  store.close();
});

const ids = testIdSource();

const overrideTable = syncedTables.filter((table) => table.name === 'target_overrides');

describe('setOverride', () => {
  // covers: AC-10
  it('stores the number for the date it is effective from', async () => {
    const result = await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.calories).toBe(1800);
      expect(result.value.effectiveFrom).toBe('2026-08-11');
    }
  });

  // covers: AC-10b. The whole reason the identifier is version 7: a second
  // override for one date is a new row, never a revival of the first.
  it('gives every override a fresh identifier rather than reusing the date’s', async () => {
    const first = await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    const second = await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1900 },
      ids,
    );

    expect(first.kind).toBe('ok');
    expect(second.kind).toBe('ok');
    if (first.kind === 'ok' && second.kind === 'ok') {
      expect(second.value.id).not.toBe(first.value.id);
      expect(second.value.id).not.toBe(dayScopedId('target_overrides', USER_A, '2026-08-11'));
    }
  });

  // covers: AC-10b
  it('tombstones the previous override for the date rather than updating it', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1900 },
      ids,
    );

    const live = await listOverridesOn(store.db, {
      userId: USER_A,
      effectiveFrom: '2026-08-11',
    });
    const all = store.raw
      .prepare('select deleted_at from target_overrides where effective_from = ?')
      .all('2026-08-11');

    expect(live).toHaveLength(1);
    expect(live[0]?.calories).toBe(1900);
    expect(all).toHaveLength(2);
  });

  // covers: AC-10. Every dirtied row moves `updated_at` with it, or the push
  // reply would overwrite the person's edit.
  it('marks both the tombstone and the new row as needing a push', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1900 },
      ids,
    );

    const rows = store.raw.prepare('select is_dirty, updated_at from target_overrides').all();

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.is_dirty).toBe(1);
      expect(row.updated_at).toEqual(expect.any(String));
    }
  });

  it('refuses a target that is not a whole number above zero, with a message a person can read', async () => {
    for (const calories of [0, -100, 1800.5]) {
      const result = await setOverride(
        store.db,
        { userId: USER_A, effectiveFrom: '2026-08-11', calories },
        ids,
      );

      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.message).toContain('whole number');
      }
    }
  });
});

describe('resolveOverride', () => {
  // covers: AC-10
  it('finds the override that applies on a later date', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );

    const result = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-20' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value?.calories).toBe(1800);
  });

  // covers: AC-10
  it('finds nothing on a date before it takes effect', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );

    const result = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-10' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBeUndefined();
  });

  // covers: AC-10
  it('takes the newest of several overrides at or before the date', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-01', calories: 1700 },
      ids,
    );
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-09-01', calories: 1900 },
      ids,
    );

    const result = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-20' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value?.calories).toBe(1800);
  });

  // covers: AC-10b. Two offline devices can each set one for a date and both
  // rows are legal, so resolution orders instead of assuming there is one.
  it('picks deterministically when two live rows share a date', async () => {
    const at = '2026-08-10T09:00:00.000Z';
    for (const [id, calories] of [
      ['00000000-0000-7000-8000-00000000000a', 1700],
      ['00000000-0000-7000-8000-00000000000b', 1800],
    ] as const) {
      store.raw
        .prepare(
          `insert into target_overrides (id, user_id, effective_from, calories,
             created_at, updated_at, deleted_at, is_dirty, synced_at)
           values (?, ?, '2026-08-11', ?, ?, ?, null, 0, null)`,
        )
        .run(id, USER_A, calories, at, at);
    }

    const first = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-11' });
    const again = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-11' });

    // `updated_at` ties, so `id` decides, and it decides the same way twice.
    expect(first).toStrictEqual(again);
    if (first.kind === 'ok') expect(first.value?.calories).toBe(1800);
  });

  // covers: AC-13
  it('never returns another person’s override', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );

    const result = await resolveOverride(store.db, { userId: USER_B, onDate: '2026-08-20' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBeUndefined();
  });
});

describe('clearOverride', () => {
  // covers: AC-10
  it('returns later days to the computed number', async () => {
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    const cleared = await clearOverride(store.db, {
      userId: USER_A,
      effectiveFrom: '2026-08-11',
    });

    const after = await resolveOverride(store.db, { userId: USER_A, onDate: '2026-08-20' });

    expect(cleared.kind).toBe('ok');
    if (after.kind === 'ok') expect(after.value).toBeUndefined();
  });

  // covers: AC-10b. Clearing one and leaving the other would hand back a
  // number the person believes they removed.
  it('tombstones every live row for the date, not just one', async () => {
    const at = '2026-08-10T09:00:00.000Z';
    for (const id of [
      '00000000-0000-7000-8000-00000000000a',
      '00000000-0000-7000-8000-00000000000b',
    ]) {
      store.raw
        .prepare(
          `insert into target_overrides (id, user_id, effective_from, calories,
             created_at, updated_at, deleted_at, is_dirty, synced_at)
           values (?, ?, '2026-08-11', 1800, ?, ?, null, 0, null)`,
        )
        .run(id, USER_A, at, at);
    }

    const cleared = await clearOverride(store.db, {
      userId: USER_A,
      effectiveFrom: '2026-08-11',
    });

    expect(cleared.kind).toBe('ok');
    if (cleared.kind === 'ok') expect(cleared.value).toBe(2);
    expect(
      await listOverridesOn(store.db, { userId: USER_A, effectiveFrom: '2026-08-11' }),
    ).toHaveLength(0);
  });

  it('says so plainly when there was nothing set for that day', async () => {
    const result = await clearOverride(store.db, {
      userId: USER_A,
      effectiveFrom: '2026-08-11',
    });

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.message).toContain('no target of your own');
  });
});

/**
 * The failure spec 0006 was rewritten to avoid, driven end to end against the
 * fake server that models spec 0005's sticky tombstone. With a day scoped
 * identifier this test fails by losing the person's second override in
 * silence: the push comes back as the tombstone, `pushChanges` writes that row
 * into SQLite, and nothing reports an error.
 */
describe('set, clear, set again across a sync', () => {
  // covers: AC-10b
  it('keeps the second override, and what comes back is not a tombstone', async () => {
    const server = createFakeServer();

    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    await pushChanges(store.db, server.transport, { tables: overrideTable });

    await clearOverride(store.db, { userId: USER_A, effectiveFrom: '2026-08-11' });
    await pushChanges(store.db, server.transport, { tables: overrideTable });

    const second = await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1900 },
      ids,
    );
    const push = await pushChanges(store.db, server.transport, { tables: overrideTable });

    expect(push.kind).toBe('pushed');

    // The local row survived the reply being written back.
    const live = await listOverridesOn(store.db, {
      userId: USER_A,
      effectiveFrom: '2026-08-11',
    });
    expect(live).toHaveLength(1);
    expect(live[0]?.calories).toBe(1900);

    // And the server holds it as a live row, not a refused revival.
    if (second.kind === 'ok') {
      const onServer = server.rowsIn('target_overrides').find((row) => row.id === second.value.id);
      expect(onServer?.deleted_at ?? null).toBeNull();
      expect(onServer?.calories).toBe(1900);
    }
  });
});

describe('an override reaching the daily target', () => {
  const seedDay = (): void => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
  };

  // covers: AC-10
  it('makes a day that has not been created yet manual, with that number', async () => {
    seedDay();
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );

    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-11' },
      calorieTargetFormula,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.calories).toBe(1800);
      expect(result.value.source).toBe('manual');
      expect(result.value.formulaVersion).toBe(MANUAL_VERSION);
    }
  });

  // covers: AC-11. The override is read only when a day's row is first
  // created, which is what makes a backdated date harmless.
  it('leaves a day whose target already exists completely alone', async () => {
    seedDay();

    const before = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-10' },
      calorieTargetFormula,
    );
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-01', calories: 1800 },
      ids,
    );
    const after = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-10' },
      calorieTargetFormula,
    );

    expect(after).toStrictEqual(before);
    if (after.kind === 'ok') expect(after.value.source).toBe('computed');
  });

  // covers: AC-10
  it('returns a day after the override was cleared to the computed number', async () => {
    seedDay();
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1800 },
      ids,
    );
    await clearOverride(store.db, { userId: USER_A, effectiveFrom: '2026-08-11' });

    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-12' },
      calorieTargetFormula,
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value.source).toBe('computed');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  openTestDatabase,
  seedProfile,
  seedWeight,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../../../test/support/sqlite';
import { dayScopedId } from '../ids/uuid';

import { getOrCreateDailyTarget, type TargetFormula } from './daily-targets';

let store: TestDatabase;

beforeEach(() => {
  store = openTestDatabase();
});

afterEach(() => {
  store.close();
});

/**
 * The calorie formula belongs to scope feature 6. These tests use a stand in
 * and assert only what spec 0002 owns: that whatever formula arrives is asked
 * once, its answer is frozen, and the identifier is derived so two phones
 * agree.
 */
const aFormula = (): TargetFormula =>
  vi.fn((input) => ({
    calories: Math.round((input.weightKg ?? 60) * 28),
    formulaVersion: 'stub-v1',
  }));

describe('getOrCreateDailyTarget', () => {
  // covers: AC-9
  it('computes and stores the target the first time a day is used', async () => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70.5,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );

    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      aFormula(),
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.calories).toBe(1974);
      expect(result.value.formulaVersion).toBe('stub-v1');
      expect(result.value.source).toBe('computed');
    }
  });

  // covers: AC-9. Never recomputed. A past day keeps the target the person was
  // actually eating against.
  it('returns the stored target on every later call, without asking the formula again', async () => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70.5,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
    const formula = aFormula();

    const first = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      formula,
    );
    const second = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      formula,
    );

    expect(formula).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
    expect(store.raw.prepare('select count(*) as n from daily_targets').get()).toEqual({ n: 1 });
  });

  // covers: AC-9. Deliberate, not an oversight: backdating a weigh in must not
  // rewrite a target the person already ate against.
  it('does not change an existing target when a newer weigh in is added', async () => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70.5,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
    const formula = aFormula();

    const before = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      formula,
    );
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-08',
      60,
      dayScopedId('weight_entries', USER_A, '2026-08-08'),
    );
    const after = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      formula,
    );

    expect(after).toEqual(before);
    expect(formula).toHaveBeenCalledTimes(1);
  });

  // covers: AC-9
  it('derives the identifier from the user and the date, so two phones agree', async () => {
    seedProfile(store.raw, USER_A);
    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      aFormula(),
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.id).toBe(dayScopedId('daily_targets', USER_A, '2026-08-09'));
    }
  });

  it('uses the newest weigh in at or before the day', async () => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      80,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-05',
      70,
      dayScopedId('weight_entries', USER_A, '2026-08-05'),
    );
    // A weigh in after the day must not be used.
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-20',
      60,
      dayScopedId('weight_entries', USER_A, '2026-08-20'),
    );

    const formula = aFormula();
    await getOrCreateDailyTarget(store.db, { userId: USER_A, onDate: '2026-08-09' }, formula);

    expect(formula).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 70 }));
  });

  it('ignores a deleted weigh in', async () => {
    seedProfile(store.raw, USER_A);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      80,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-05',
      70,
      dayScopedId('weight_entries', USER_A, '2026-08-05'),
    );
    store.raw
      .prepare(
        "update weight_entries set deleted_at = '2026-08-06T00:00:00Z' where on_date = '2026-08-05'",
      )
      .run();

    const formula = aFormula();
    await getOrCreateDailyTarget(store.db, { userId: USER_A, onDate: '2026-08-09' }, formula);

    expect(formula).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 80 }));
  });

  it('calls the formula with no weight when the person has never weighed in', async () => {
    seedProfile(store.raw, USER_A);
    const formula = aFormula();
    await getOrCreateDailyTarget(store.db, { userId: USER_A, onDate: '2026-08-09' }, formula);

    expect(formula).toHaveBeenCalledWith(
      expect.not.objectContaining({ weightKg: expect.anything() }),
    );
  });

  it('refuses when the person has no profile yet', async () => {
    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_B, onDate: '2026-08-09' },
      aFormula(),
    );
    expect(result.kind).toBe('failed');
  });

  it('refuses when onboarding is unfinished', async () => {
    seedProfile(store.raw, USER_A, { onboarded: false });
    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      aFormula(),
    );

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.message).toContain('profile');
    expect(store.raw.prepare('select count(*) as n from daily_targets').get()).toEqual({ n: 0 });
  });

  it('refuses when the formula cannot produce a target', async () => {
    seedProfile(store.raw, USER_A);
    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      () => undefined,
    );

    expect(result.kind).toBe('failed');
    expect(store.raw.prepare('select count(*) as n from daily_targets').get()).toEqual({ n: 0 });
  });

  // covers: AC-9. If another device's row for this day arrived between the
  // read and the write, that row is the one that stands.
  it('keeps the row already there rather than overwriting it', async () => {
    seedProfile(store.raw, USER_A);
    const id = dayScopedId('daily_targets', USER_A, '2026-08-09');
    store.raw
      .prepare(
        `insert into daily_targets (id, user_id, on_date, calories, protein_g, carbs_g, fat_g,
           source, formula_version, created_at, updated_at, deleted_at, is_dirty, synced_at)
         values (?, ?, '2026-08-09', 1500, null, null, null, 'manual', 'from-other-device',
           '2026-08-09T00:00:00Z', '2026-08-09T00:00:00Z', null, 0, null)`,
      )
      .run(id, USER_A);

    const result = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      aFormula(),
    );

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value.calories).toBe(1500);
      expect(result.value.formulaVersion).toBe('from-other-device');
    }
  });

  // covers: AC-11
  it("does not read another user's target for the same day", async () => {
    seedProfile(store.raw, USER_A);
    seedProfile(store.raw, USER_B);
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      100,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );

    const forA = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-09' },
      aFormula(),
    );
    const forB = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_B, onDate: '2026-08-09' },
      aFormula(),
    );

    expect(forA.kind).toBe('ok');
    expect(forB.kind).toBe('ok');
    if (forA.kind === 'ok' && forB.kind === 'ok') {
      expect(forA.value.id).not.toBe(forB.value.id);
      expect(forA.value.calories).not.toBe(forB.value.calories);
    }
  });

  it('marks a newly written target as needing a push', async () => {
    seedProfile(store.raw, USER_A);
    await getOrCreateDailyTarget(store.db, { userId: USER_A, onDate: '2026-08-09' }, aFormula());

    expect(store.raw.prepare('select is_dirty from daily_targets').get()).toEqual({ is_dirty: 1 });
  });
});

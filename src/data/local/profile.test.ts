import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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

import { getOrCreateDailyTarget } from './daily-targets';
import { readProfile, updateProfileAnswers } from './profile';
import { calorieTargetFormula } from './target-formula';

let store: TestDatabase;

beforeEach(() => {
  store = openTestDatabase();
  seedProfile(store.raw, USER_A);
});

afterEach(() => {
  store.close();
});

const ids = testIdSource();

describe('updateProfileAnswers', () => {
  // covers: AC-12
  it('changes an answer and reads it back', async () => {
    const result = await updateProfileAnswers(store.db, USER_A, { activityLevel: 'very_active' });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value.activityLevel).toBe('very_active');
  });

  // covers: AC-12
  it('changes several answers at once and leaves the rest alone', async () => {
    const before = await readProfile(store.db, USER_A);

    await updateProfileAnswers(store.db, USER_A, {
      goalDirection: 'gain',
      goalRateKgPerWeek: 0.25,
    });

    const after = await readProfile(store.db, USER_A);

    if (before.kind === 'ok' && after.kind === 'ok') {
      expect(after.value?.goalDirection).toBe('gain');
      expect(after.value?.goalRateKgPerWeek).toBe(0.25);
      expect(after.value?.ageYears).toBe(before.value?.ageYears);
      expect(after.value?.heightCm).toBe(before.value?.heightCm);
      expect(after.value?.onboardedAt).toBe(before.value?.onboardedAt);
    }
  });

  // The rule nothing enforces: a dirtied row must move its stamp, or the reply
  // to its own push overwrites the person's edit.
  it('marks the row for a push and moves updated_at together', async () => {
    const before = store.raw
      .prepare('select updated_at from profiles where user_id = ?')
      .get(USER_A);

    await updateProfileAnswers(store.db, USER_A, { activityLevel: 'light' });

    const after = store.raw
      .prepare('select is_dirty, updated_at from profiles where user_id = ?')
      .get(USER_A);

    expect(after).toMatchObject({ is_dirty: 1 });
    expect(after?.updated_at).not.toBe(before?.updated_at);
  });

  // covers: AC-16. The screen stops these first; this is the second line, so a
  // check constraint violation is never what a person sees.
  it('refuses a value outside its column’s bounds with a message about that value', async () => {
    for (const [edit, words] of [
      [{ ageYears: 12 }, 'between 13 and 120'],
      [{ ageYears: 121 }, 'between 13 and 120'],
      [{ goalRateKgPerWeek: 1.6 }, 'between 0 and 1.5'],
      [{ heightCm: 0 }, 'above zero'],
    ] as const) {
      const result = await updateProfileAnswers(store.db, USER_A, edit);

      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') expect(result.message).toContain(words);
    }
  });

  // covers: AC-16. Both bounds are inclusive, and the screen offers them.
  it('accepts a value exactly on each bound', async () => {
    for (const edit of [{ ageYears: 13 }, { ageYears: 120 }, { goalRateKgPerWeek: 1.5 }]) {
      expect((await updateProfileAnswers(store.db, USER_A, edit)).kind).toBe('ok');
    }
  });

  it('says so plainly when there is no profile to change', async () => {
    const result = await updateProfileAnswers(store.db, USER_B, { activityLevel: 'light' });

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.message).toContain('could not find your profile');
  });

  it('refuses an edit that changes nothing', async () => {
    const result = await updateProfileAnswers(store.db, USER_A, {});

    expect(result.kind).toBe('failed');
  });
});

describe('a changed answer and the days around it', () => {
  beforeEach(() => {
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );
  });

  // covers: AC-11. The whole promise: a past day keeps the target it was
  // actually eaten against, so history stays honest with no special case.
  it('never rewrites a target that already exists', async () => {
    const today = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-10' },
      calorieTargetFormula,
    );

    await updateProfileAnswers(store.db, USER_A, { activityLevel: 'very_active' });

    const again = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-10' },
      calorieTargetFormula,
    );

    expect(again).toStrictEqual(today);
  });

  // covers: AC-11. Which is exactly why the change starts tomorrow, and why
  // the screen says so.
  it('reaches a day whose target has not been created yet', async () => {
    const before = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-10' },
      calorieTargetFormula,
    );

    await updateProfileAnswers(store.db, USER_A, { activityLevel: 'very_active' });

    const tomorrow = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-11' },
      calorieTargetFormula,
    );

    if (before.kind === 'ok' && tomorrow.kind === 'ok') {
      expect(tomorrow.value.calories).toBeGreaterThan(before.value.calories);
      expect(tomorrow.value.source).toBe('computed');
    }
  });
});

/** Kept so the override path and the answer path are known to coexist. */
describe('an override and a changed answer together', () => {
  it('lets the override win on a day both would reach', async () => {
    seedWeight(
      store.raw,
      USER_A,
      '2026-08-01',
      70,
      dayScopedId('weight_entries', USER_A, '2026-08-01'),
    );

    const { setOverride } = await import('./target-overrides');
    await setOverride(
      store.db,
      { userId: USER_A, effectiveFrom: '2026-08-11', calories: 1750 },
      ids,
    );
    await updateProfileAnswers(store.db, USER_A, { activityLevel: 'very_active' });

    const tomorrow = await getOrCreateDailyTarget(
      store.db,
      { userId: USER_A, onDate: '2026-08-11' },
      calorieTargetFormula,
    );

    if (tomorrow.kind === 'ok') {
      expect(tomorrow.value.calories).toBe(1750);
      expect(tomorrow.value.source).toBe('manual');
    }
  });
});

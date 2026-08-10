import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  anItem,
  openTestDatabase,
  seedProfile,
  testIdSource,
  USER_A,
  type TestDatabase,
} from '../../../test/support/sqlite';
import type { IdSource } from '../ids/uuid';

import { saveMeal } from './meals';
import { countPendingMeals, countPendingPushes } from './pending';

let store: TestDatabase;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  ids = testIdSource();
});

afterEach(() => {
  store.close();
});

const saveMealWith = async (itemCount: number): Promise<void> => {
  const result = await saveMeal(
    store.db,
    {
      userId: USER_A,
      eatenAt: new Date('2026-08-09T12:00:00Z'),
      timeZone: 'Asia/Colombo',
      items: Array.from({ length: itemCount }, (_, index) => anItem({ name: `Item ${index}` })),
    },
    ids,
  );
  if (result.kind !== 'ok') throw new Error(`could not seed a meal: ${String(result.message)}`);
};

describe('countPendingMeals', () => {
  it('counts nothing on an empty diary', async () => {
    expect(await countPendingMeals(store.db)).toBe(0);
  });

  // covers: AC-11. This is the whole reason the function exists. The sentence
  // a person reads on sign out has to say "3 meals", and a row count would
  // say "12" for the same three meals.
  it('counts three meals as three, not as their twelve dirty rows', async () => {
    await saveMealWith(3);
    await saveMealWith(3);
    await saveMealWith(3);

    expect(await countPendingMeals(store.db)).toBe(3);
    // Same data, the other count: rows, not meals. 3 meals + 9 items = 12.
    expect(await countPendingPushes(store.db)).toBe(12);
  });

  // covers: AC-11. A meal whose own row has landed but whose items have not is
  // still not fully pushed, so it must still be counted, exactly once.
  it('counts a meal whose items are dirty even when the meal row is clean', async () => {
    await saveMealWith(4);
    store.raw.exec('UPDATE meals SET is_dirty = 0');

    expect(await countPendingMeals(store.db)).toBe(1);
  });

  it('counts nothing once everything has been pushed', async () => {
    await saveMealWith(2);
    store.raw.exec('UPDATE meals SET is_dirty = 0');
    store.raw.exec('UPDATE meal_items SET is_dirty = 0');

    expect(await countPendingMeals(store.db)).toBe(0);
    expect(await countPendingPushes(store.db)).toBe(0);
  });
});

describe('countPendingPushes', () => {
  // covers: AC-11. This is the gate on removing a local file, so a dirty row
  // in any synced table has to hold the file, not just a dirty meal.
  it('sees a dirty profile even when no meal is pending', async () => {
    seedProfile(store.raw, USER_A);
    store.raw.exec('UPDATE profiles SET is_dirty = 1');

    expect(await countPendingMeals(store.db)).toBe(0);
    expect(await countPendingPushes(store.db)).toBe(1);
  });
});

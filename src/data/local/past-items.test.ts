import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  anItem,
  openTestDatabase,
  testIdSource,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../../../test/support/sqlite';
import type { IdSource } from '../ids/uuid';

import { saveMeal } from './meals';
import { searchPastItems, type PastItem } from './past-items';

let store: TestDatabase;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  ids = testIdSource();
});

afterEach(() => {
  store.close();
});

const log = async (
  userId: string,
  name: string,
  at: string,
  overrides: Parameters<typeof anItem>[0] = {},
): Promise<void> => {
  await saveMeal(
    store.db,
    {
      userId,
      eatenAt: new Date(at),
      timeZone: 'UTC',
      items: [anItem({ name, ...overrides })],
    },
    ids,
  );
};

const rowsOf = (result: Awaited<ReturnType<typeof searchPastItems>>): readonly PastItem[] => {
  if (result.kind === 'failed') throw new Error(result.message);
  return result.value.rows;
};

describe('searchPastItems', () => {
  it('finds a past item by part of its name', async () => {
    await log(USER_A, 'Chicken curry', '2026-08-01T12:00:00Z');
    expect(rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'curr' }))).toHaveLength(
      1,
    );
  });

  it('matches without caring about capitals', async () => {
    await log(USER_A, 'Chicken Curry', '2026-08-01T12:00:00Z');
    expect(
      rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'CHICKEN' })),
    ).toHaveLength(1);
  });

  it('returns each name once, however many times it was eaten', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z');
    await log(USER_A, 'Rice', '2026-08-02T12:00:00Z');
    await log(USER_A, 'Rice', '2026-08-03T12:00:00Z');

    expect(rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'rice' }))).toHaveLength(
      1,
    );
  });

  // Recency here means when the row was written, not when the meal was eaten,
  // which is what spec 0002 says. `saveMeal` reads the wall clock, so the two
  // rows below are stamped apart explicitly rather than by hoping the two
  // saves land in different milliseconds.
  const setCreatedAt = (calories: number, createdAt: string): void => {
    store.raw
      .prepare('update meal_items set created_at = ? where base_calories = ?')
      .run(createdAt, calories);
  };

  it('suggests the numbers from the most recently recorded time that item was eaten', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z', { baseCalories: 100 });
    await log(USER_A, 'Rice', '2026-08-03T12:00:00Z', { baseCalories: 175 });
    setCreatedAt(100, '2026-08-01T12:00:00.000Z');
    setCreatedAt(175, '2026-08-03T12:00:00.000Z');

    const rows = rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'rice' }));
    expect(rows[0]?.baseCalories).toBe(175);
  });

  // The regression. `saveMeal` stamps one `created_at` for a whole meal, so
  // two rows for the same food share an instant exactly whenever they are in
  // the same meal, and two meals saved in the same millisecond do too. The
  // earlier `MAX(created_at)` with bare columns let SQLite resolve that tie
  // arbitrarily, which passed on a slow machine and failed on a fast one.
  it('breaks a tie on created_at by the newer identifier, never arbitrarily', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z', { baseCalories: 100 });
    await log(USER_A, 'Rice', '2026-08-01T13:00:00Z', { baseCalories: 175 });
    store.raw.prepare("update meal_items set created_at = '2026-08-01T12:00:00.000Z'").run();

    const rows = rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'rice' }));
    expect(rows[0]?.baseCalories).toBe(175);
  });

  // The same tie, reached the way a real diary reaches it most often.
  it('picks the later item when one meal holds the same food twice', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-01T12:00:00Z'),
        timeZone: 'UTC',
        items: [
          anItem({ name: 'Rice', baseCalories: 100 }),
          anItem({ name: 'Rice', baseCalories: 175 }),
        ],
      },
      ids,
    );

    const shared = store.raw
      .prepare('select count(distinct created_at) as n from meal_items')
      .get() as { n: number };
    expect(shared.n).toBe(1);

    const rows = rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'rice' }));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.baseCalories).toBe(175);
  });

  // covers: AC-11
  it("never suggests another person's items", async () => {
    await log(USER_A, 'Chicken curry', '2026-08-01T12:00:00Z');
    expect(rowsOf(await searchPastItems(store.db, { userId: USER_B, query: 'curr' }))).toEqual([]);
  });

  // The empty first day. Spec 0002 flags that feature 8 owns what the screen
  // says here; the data layer's job is simply to return nothing, honestly.
  it('returns nothing on a brand new account', async () => {
    expect(rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'anything' }))).toEqual(
      [],
    );
  });

  it('returns nothing when nothing matches', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z');
    expect(rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'sushi' }))).toEqual([]);
  });

  it('does not suggest an item from a deleted meal', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z');
    store.raw.prepare("update meal_items set deleted_at = '2026-08-02T00:00:00Z'").run();

    expect(rowsOf(await searchPastItems(store.db, { userId: USER_A, query: 'rice' }))).toEqual([]);
  });

  it('orders results by name', async () => {
    await log(USER_A, 'Cucumber', '2026-08-01T12:00:00Z');
    await log(USER_A, 'Apple', '2026-08-01T13:00:00Z');
    await log(USER_A, 'Banana', '2026-08-01T14:00:00Z');

    const rows = rowsOf(await searchPastItems(store.db, { userId: USER_A, query: '' }));
    expect(rows.map((row) => row.name)).toEqual(['Apple', 'Banana', 'Cucumber']);
  });

  // covers: AC-16
  it('pages with a keyset, returning every name exactly once', async () => {
    for (const name of ['Apple', 'Banana', 'Cucumber', 'Date', 'Elderberry']) {
      await log(USER_A, name, '2026-08-01T12:00:00Z');
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const result = await searchPastItems(store.db, {
        userId: USER_A,
        query: '',
        limit: 2,
        ...(cursor === undefined ? {} : { cursor }),
      });
      if (result.kind === 'failed') throw new Error(result.message);
      seen.push(...result.value.rows.map((row) => row.name));
      cursor = result.value.nextCursor;
    } while (cursor !== undefined);

    expect(seen).toEqual(['Apple', 'Banana', 'Cucumber', 'Date', 'Elderberry']);
    expect(new Set(seen).size).toBe(5);
  });

  it('omits the next cursor on the last page', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z');
    const result = await searchPastItems(store.db, { userId: USER_A, query: '', limit: 10 });

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value.nextCursor).toBeUndefined();
  });

  it('trims the search term, so a stray space still matches', async () => {
    await log(USER_A, 'Rice', '2026-08-01T12:00:00Z');
    expect(
      rowsOf(await searchPastItems(store.db, { userId: USER_A, query: '  rice  ' })),
    ).toHaveLength(1);
  });
});

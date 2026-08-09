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

import { deleteMeal, listMealsForDay, saveMeal, totalsForDay } from './meals';

let store: TestDatabase;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  ids = testIdSource();
});

afterEach(() => {
  store.close();
});

const expectOk = <T>(result: { kind: string } & Record<string, unknown>): T => {
  if (result.kind !== 'ok') throw new Error(`expected ok, got ${String(result.message)}`);
  return result.value as T;
};

describe('saveMeal', () => {
  // covers: AC-3
  it('files a meal saved at 23:50 in Colombo under the local date', async () => {
    const result = await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T18:20:00Z'),
        timeZone: 'Asia/Colombo',
        items: [anItem()],
      },
      ids,
    );
    expect(result.kind).toBe('ok');

    const row = store.raw
      .prepare('select eaten_on, tz_at_save, eaten_at from meals')
      .get() as Record<string, string>;
    expect(row.eaten_on).toBe('2026-08-09');
    expect(row.tz_at_save).toBe('Asia/Colombo');
  });

  // covers: AC-3
  it('records the meal type as guessed when the caller did not choose one', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T18:20:00Z'),
        timeZone: 'Asia/Colombo',
        items: [anItem()],
      },
      ids,
    );
    const row = store.raw.prepare('select meal_type, meal_type_source from meals').get() as Record<
      string,
      string
    >;
    expect(row.meal_type).toBe('snack');
    expect(row.meal_type_source).toBe('guessed');
  });

  // covers: AC-3
  it('records the meal type as chosen when the caller supplied one', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T18:20:00Z'),
        timeZone: 'Asia/Colombo',
        mealType: 'dinner',
        items: [anItem()],
      },
      ids,
    );
    const row = store.raw.prepare('select meal_type, meal_type_source from meals').get() as Record<
      string,
      string
    >;
    expect(row.meal_type).toBe('dinner');
    expect(row.meal_type_source).toBe('chosen');
  });

  // covers: AC-6
  it('resolves each item from its base rate and the quantity', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T12:00:00Z'),
        timeZone: 'UTC',
        items: [anItem({ quantity: 200 })],
      },
      ids,
    );
    const row = store.raw
      .prepare('select calories, protein_g, carbs_g, fat_g from meal_items')
      .get() as Record<string, number>;
    expect(row).toEqual({ calories: 260, protein_g: 5.4, carbs_g: 56.4, fat_g: 0.6 });
  });

  // covers: AC-6, AC-8
  it('marks an edited scan as ai_edited and names the field that was typed', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T12:00:00Z'),
        timeZone: 'UTC',
        items: [anItem({ source: 'ai_scan', quantity: 200, typed: { calories: 400 } })],
      },
      ids,
    );
    const row = store.raw
      .prepare('select source, edited_fields, calories, protein_g from meal_items')
      .get() as Record<string, unknown>;
    expect(row.source).toBe('ai_edited');
    expect(row.edited_fields).toBe('calories');
    expect(row.calories).toBe(400);
    expect(row.protein_g).toBe(5.4);
  });

  // covers: AC-8
  it('leaves an untouched scan as ai_scan with no edited fields', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T12:00:00Z'),
        timeZone: 'UTC',
        items: [anItem({ source: 'ai_scan', confidence: 'low' })],
      },
      ids,
    );
    const row = store.raw
      .prepare('select source, edited_fields, confidence from meal_items')
      .get() as Record<string, unknown>;
    expect(row.source).toBe('ai_scan');
    expect(row.edited_fields).toBeNull();
    expect(row.confidence).toBe('low');
  });

  it('stores each item with its position on the plate', async () => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T12:00:00Z'),
        timeZone: 'UTC',
        items: [anItem({ name: 'First' }), anItem({ name: 'Second' }), anItem({ name: 'Third' })],
      },
      ids,
    );
    const rows = store.raw
      .prepare('select name, position from meal_items order by position')
      .all() as { name: string; position: number }[];
    expect(rows.map((row) => [row.name, row.position])).toEqual([
      ['First', 0],
      ['Second', 1],
      ['Third', 2],
    ]);
  });

  it('marks a new meal and its items as needing a push', async () => {
    await saveMeal(
      store.db,
      { userId: USER_A, eatenAt: new Date(), timeZone: 'UTC', items: [anItem()] },
      ids,
    );
    const meal = store.raw.prepare('select is_dirty, synced_at from meals').get() as Record<
      string,
      unknown
    >;
    expect(meal.is_dirty).toBe(1);
    expect(meal.synced_at).toBeNull();
  });

  it('refuses a meal with no items', async () => {
    const result = await saveMeal(store.db, { userId: USER_A, items: [] }, ids);
    expect(result.kind).toBe('failed');
    expect(store.raw.prepare('select count(*) as n from meals').get()).toEqual({ n: 0 });
  });

  it('refuses a meal with an invalid portion, and writes nothing at all', async () => {
    const result = await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date(),
        timeZone: 'UTC',
        items: [anItem({ name: 'Fine' }), anItem({ name: 'Broken', quantity: 0 })],
      },
      ids,
    );

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.message).toContain('Broken');
    // The whole save fails rather than leaving half a meal behind.
    expect(store.raw.prepare('select count(*) as n from meals').get()).toEqual({ n: 0 });
    expect(store.raw.prepare('select count(*) as n from meal_items').get()).toEqual({ n: 0 });
  });

  it('reports an unrecognised time zone rather than saving to the wrong day', async () => {
    const result = await saveMeal(
      store.db,
      { userId: USER_A, eatenAt: new Date(), timeZone: 'Nowhere/Real', items: [anItem()] },
      ids,
    );
    expect(result.kind).toBe('failed');
    expect(store.raw.prepare('select count(*) as n from meals').get()).toEqual({ n: 0 });
  });
});

describe('listMealsForDay', () => {
  const saveAt = async (iso: string, name: string, calories = 130): Promise<void> => {
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date(iso),
        timeZone: 'UTC',
        items: [anItem({ name, baseCalories: calories })],
      },
      ids,
    );
  };

  // covers: AC-7
  it("returns the day's meals with their items", async () => {
    await saveAt('2026-08-09T08:00:00Z', 'Breakfast');
    await saveAt('2026-08-09T13:00:00Z', 'Lunch');

    const page = expectOk<{ meals: { items: unknown[] }[] }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.meals).toHaveLength(2);
    expect(page.meals[0]?.items).toHaveLength(1);
  });

  it('returns the newest meal first', async () => {
    await saveAt('2026-08-09T08:00:00Z', 'Breakfast');
    await saveAt('2026-08-09T19:00:00Z', 'Dinner');

    const page = expectOk<{ meals: { items: { name: string }[] }[] }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.meals[0]?.items[0]?.name).toBe('Dinner');
  });

  // covers: AC-7
  it('totals the day as a sum over its live items', async () => {
    await saveAt('2026-08-09T08:00:00Z', 'Breakfast', 100);
    await saveAt('2026-08-09T13:00:00Z', 'Lunch', 250);

    const page = expectOk<{ totals: { calories: number } }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.totals.calories).toBe(350);
  });

  it('returns an empty day rather than failing', async () => {
    const page = expectOk<{ meals: unknown[]; totals: { calories: number } }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.meals).toEqual([]);
    expect(page.totals).toEqual({ calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("does not return another day's meals", async () => {
    await saveAt('2026-08-08T12:00:00Z', 'Yesterday');
    await saveAt('2026-08-09T12:00:00Z', 'Today');

    const page = expectOk<{ meals: { items: { name: string }[] }[] }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.meals).toHaveLength(1);
    expect(page.meals[0]?.items[0]?.name).toBe('Today');
  });

  // covers: AC-11. The file split is the main defence, and the query is scoped
  // as well, so a shared file could still not leak between accounts.
  it("does not return another user's meals or count them in the totals", async () => {
    await saveAt('2026-08-09T12:00:00Z', 'Mine');

    const page = expectOk<{ meals: unknown[]; totals: { calories: number } }>(
      await listMealsForDay(store.db, { userId: USER_B, onDate: '2026-08-09' }),
    );
    expect(page.meals).toEqual([]);
    expect(page.totals.calories).toBe(0);
  });

  // covers: AC-16
  it('pages with a keyset, returning every row exactly once', async () => {
    for (let hour = 0; hour < 5; hour += 1) {
      await saveAt(`2026-08-09T0${hour}:00:00Z`, `Meal ${hour}`);
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = expectOk<{ meals: { id: string }[]; nextCursor?: string }>(
        await listMealsForDay(store.db, {
          userId: USER_A,
          onDate: '2026-08-09',
          limit: 2,
          ...(cursor === undefined ? {} : { cursor }),
        }),
      );
      seen.push(...page.meals.map((meal) => meal.id));
      cursor = page.nextCursor;
    } while (cursor !== undefined);

    expect(seen).toHaveLength(5);
    expect(new Set(seen).size).toBe(5);
  });

  // covers: AC-16. The case an offset based page would get wrong.
  it('skips and repeats nothing when a row is inserted while paging', async () => {
    for (let hour = 0; hour < 5; hour += 1) {
      await saveAt(`2026-08-09T0${hour}:00:00Z`, `Meal ${hour}`);
    }

    const first = expectOk<{ meals: { id: string }[]; nextCursor?: string }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09', limit: 2 }),
    );
    // A newer meal lands ahead of the cursor, which is what shifts an offset.
    await saveAt('2026-08-09T09:00:00Z', 'Inserted mid paging');

    const seen = [...first.meals.map((meal) => meal.id)];
    let cursor = first.nextCursor;
    while (cursor !== undefined) {
      const page = expectOk<{ meals: { id: string }[]; nextCursor?: string }>(
        await listMealsForDay(store.db, {
          userId: USER_A,
          onDate: '2026-08-09',
          limit: 2,
          cursor,
        }),
      );
      seen.push(...page.meals.map((meal) => meal.id));
      cursor = page.nextCursor;
    }

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(5);
  });

  it('reports a page marker it did not produce rather than returning wrong rows', async () => {
    const result = await listMealsForDay(store.db, {
      userId: USER_A,
      onDate: '2026-08-09',
      cursor: 'nonsense',
    });
    expect(result.kind).toBe('failed');
  });

  it('omits the next cursor on the last page', async () => {
    await saveAt('2026-08-09T08:00:00Z', 'Only one');
    const page = expectOk<{ nextCursor?: string }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09', limit: 10 }),
    );
    expect(page.nextCursor).toBeUndefined();
  });
});

describe('deleteMeal', () => {
  const saveOne = async (): Promise<string> => {
    const result = await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T12:00:00Z'),
        timeZone: 'UTC',
        items: [anItem()],
      },
      ids,
    );
    return expectOk<string>(result);
  };

  // covers: AC-5
  it('sets a tombstone rather than removing the row', async () => {
    const mealId = await saveOne();
    expect((await deleteMeal(store.db, USER_A, mealId)).kind).toBe('ok');

    const row = store.raw.prepare('select deleted_at from meals where id = ?').get(mealId) as {
      deleted_at: string | null;
    };
    expect(row.deleted_at).not.toBeNull();
  });

  // covers: AC-5
  it('tombstones the items too, so the other phone learns about them as well', async () => {
    const mealId = await saveOne();
    await deleteMeal(store.db, USER_A, mealId);

    const live = store.raw
      .prepare('select count(*) as n from meal_items where deleted_at is null')
      .get();
    expect(live).toEqual({ n: 0 });
  });

  // covers: AC-5, AC-7
  it('drops the meal out of the day and out of the totals', async () => {
    const mealId = await saveOne();
    await deleteMeal(store.db, USER_A, mealId);

    const page = expectOk<{ meals: unknown[]; totals: { calories: number } }>(
      await listMealsForDay(store.db, { userId: USER_A, onDate: '2026-08-09' }),
    );
    expect(page.meals).toEqual([]);
    expect(page.totals.calories).toBe(0);
  });

  it('marks the tombstone as needing a push', async () => {
    const mealId = await saveOne();
    await deleteMeal(store.db, USER_A, mealId);

    const row = store.raw.prepare('select is_dirty from meals where id = ?').get(mealId);
    expect(row).toEqual({ is_dirty: 1 });
  });

  // covers: AC-5. A deleted row is never revived by any path.
  it('refuses to delete a meal that is already deleted', async () => {
    const mealId = await saveOne();
    await deleteMeal(store.db, USER_A, mealId);

    const second = await deleteMeal(store.db, USER_A, mealId);
    expect(second.kind).toBe('failed');
  });

  it('refuses a meal that does not exist', async () => {
    const result = await deleteMeal(store.db, USER_A, 'no-such-meal');
    expect(result.kind).toBe('failed');
  });

  // covers: AC-11
  it("refuses to delete another user's meal", async () => {
    const mealId = await saveOne();
    const result = await deleteMeal(store.db, USER_B, mealId);

    expect(result.kind).toBe('failed');
    const row = store.raw.prepare('select deleted_at from meals where id = ?').get(mealId) as {
      deleted_at: string | null;
    };
    expect(row.deleted_at).toBeNull();
  });
});

describe('totalsForDay', () => {
  // covers: AC-7
  it('sums the live items of live meals only', async () => {
    const first = expectOk<string>(
      await saveMeal(
        store.db,
        {
          userId: USER_A,
          eatenAt: new Date('2026-08-09T08:00:00Z'),
          timeZone: 'UTC',
          items: [anItem({ baseCalories: 100 })],
        },
        ids,
      ),
    );
    await saveMeal(
      store.db,
      {
        userId: USER_A,
        eatenAt: new Date('2026-08-09T13:00:00Z'),
        timeZone: 'UTC',
        items: [anItem({ baseCalories: 250 })],
      },
      ids,
    );

    expect((await totalsForDay(store.db, USER_A, '2026-08-09')).calories).toBe(350);
    await deleteMeal(store.db, USER_A, first);
    expect((await totalsForDay(store.db, USER_A, '2026-08-09')).calories).toBe(250);
  });

  // covers: AC-13
  it('rounds the macro totals to one decimal place', async () => {
    for (let index = 0; index < 3; index += 1) {
      await saveMeal(
        store.db,
        {
          userId: USER_A,
          eatenAt: new Date(`2026-08-09T0${index}:00:00Z`),
          timeZone: 'UTC',
          items: [anItem({ baseProteinG: 2.7, baseCarbsG: 28.2, baseFatG: 0.3 })],
        },
        ids,
      );
    }
    const totals = await totalsForDay(store.db, USER_A, '2026-08-09');
    expect(totals.proteinG).toBe(8.1);
    expect(totals.carbsG).toBe(84.6);
    expect(totals.fatG).toBe(0.9);
  });

  it('returns zeroes for a day with nothing logged', async () => {
    expect(await totalsForDay(store.db, USER_A, '2026-01-01')).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});

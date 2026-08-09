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

import { deleteMeal, saveMeal } from './meals';
import { computeStreak } from './streak';

let store: TestDatabase;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  ids = testIdSource();
});

afterEach(() => {
  store.close();
});

const logOn = async (day: string, userId = USER_A): Promise<string> => {
  const result = await saveMeal(
    store.db,
    { userId, eatenAt: new Date(`${day}T12:00:00Z`), timeZone: 'UTC', items: [anItem()] },
    ids,
  );
  if (result.kind === 'failed') throw new Error(result.message);
  return result.value;
};

const streakOn = async (today: string, userId = USER_A): Promise<number> => {
  const result = await computeStreak(store.db, { userId, today });
  if (result.kind === 'failed') throw new Error(result.message);
  return result.value;
};

describe('computeStreak', () => {
  it('is zero on a brand new account', async () => {
    expect(await streakOn('2026-08-09')).toBe(0);
  });

  it('counts today once today has a meal', async () => {
    await logOn('2026-08-09');
    expect(await streakOn('2026-08-09')).toBe(1);
  });

  it('counts a run of consecutive days ending today', async () => {
    for (const day of ['2026-08-07', '2026-08-08', '2026-08-09']) await logOn(day);
    expect(await streakOn('2026-08-09')).toBe(3);
  });

  // The definition spec 0002 settled: an unlogged morning must not read as a
  // broken streak before the day is over.
  it('still counts yesterday and back when today has nothing yet', async () => {
    for (const day of ['2026-08-06', '2026-08-07', '2026-08-08']) await logOn(day);
    expect(await streakOn('2026-08-09')).toBe(3);
  });

  it('stops at the first missed day', async () => {
    for (const day of ['2026-08-05', '2026-08-06', '2026-08-08', '2026-08-09']) await logOn(day);
    expect(await streakOn('2026-08-09')).toBe(2);
  });

  it('is zero when the last meal was two days ago', async () => {
    await logOn('2026-08-07');
    expect(await streakOn('2026-08-09')).toBe(0);
  });

  it('counts a day once however many meals it holds', async () => {
    await logOn('2026-08-09');
    await logOn('2026-08-09');
    await logOn('2026-08-09');
    expect(await streakOn('2026-08-09')).toBe(1);
  });

  it('counts across a month boundary', async () => {
    for (const day of ['2026-07-30', '2026-07-31', '2026-08-01']) await logOn(day);
    expect(await streakOn('2026-08-01')).toBe(3);
  });

  it('counts across a year boundary', async () => {
    for (const day of ['2025-12-30', '2025-12-31', '2026-01-01']) await logOn(day);
    expect(await streakOn('2026-01-01')).toBe(3);
  });

  it('ignores future days', async () => {
    await logOn('2026-08-09');
    await logOn('2026-08-20');
    expect(await streakOn('2026-08-09')).toBe(1);
  });

  // covers: AC-5
  it('does not count a day whose only meal was deleted', async () => {
    await logOn('2026-08-08');
    const removed = await logOn('2026-08-09');
    await deleteMeal(store.db, USER_A, removed);

    expect(await streakOn('2026-08-09')).toBe(1);
  });

  // covers: AC-11
  it("does not count another person's days", async () => {
    for (const day of ['2026-08-07', '2026-08-08', '2026-08-09']) await logOn(day, USER_B);
    expect(await streakOn('2026-08-09', USER_A)).toBe(0);
  });
});

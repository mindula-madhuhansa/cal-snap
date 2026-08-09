import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  testIdSource,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../../../test/support/sqlite';
import type { IdSource } from '../ids/uuid';

/**
 * AC-15: how many scans a person made on a given day must be answerable from
 * `meal_scans` alone, with no second table and no counter to keep in step.
 *
 * There is no data access function for this yet, because nothing reads it
 * until billing exists. What the data model owes now is the shape that makes
 * the question answerable, and the index that makes it cheap, so these tests
 * pin exactly that.
 */
let store: TestDatabase;
let ids: IdSource;

beforeEach(() => {
  store = openTestDatabase();
  ids = testIdSource();
});

afterEach(() => {
  store.close();
});

const recordScan = (userId: string, createdAt: string, status = 'ok'): void => {
  store.raw
    .prepare(
      `insert into meal_scans (id, user_id, model, prompt_version, status, confidence,
         raw_response, cost_cents, created_at, updated_at, is_dirty, synced_at)
       values (?, ?, 'claude-sonnet-5', 'v1', ?, 'high', null, 0.412, ?, ?, 1, null)`,
    )
    .run(ids.newId(), userId, status, createdAt, createdAt);
};

const scansOn = (userId: string, day: string): number => {
  const row = store.raw
    .prepare(
      `select count(*) as n from meal_scans
       where user_id = ? and created_at >= ? and created_at < ?`,
    )
    .get(userId, `${day}T00:00:00.000Z`, `${day}T23:59:59.999Z`) as { n: number };
  return row.n;
};

describe('scan usage', () => {
  // covers: AC-15
  it('counts a day of scans from meal_scans alone', () => {
    recordScan(USER_A, '2026-08-09T08:00:00.000Z');
    recordScan(USER_A, '2026-08-09T13:00:00.000Z');
    recordScan(USER_A, '2026-08-09T19:00:00.000Z');

    expect(scansOn(USER_A, '2026-08-09')).toBe(3);
  });

  // covers: AC-15
  it('does not count another day', () => {
    recordScan(USER_A, '2026-08-08T23:00:00.000Z');
    recordScan(USER_A, '2026-08-09T08:00:00.000Z');
    recordScan(USER_A, '2026-08-10T01:00:00.000Z');

    expect(scansOn(USER_A, '2026-08-09')).toBe(1);
  });

  // covers: AC-15, AC-11
  it("does not count another person's scans", () => {
    recordScan(USER_A, '2026-08-09T08:00:00.000Z');
    recordScan(USER_B, '2026-08-09T09:00:00.000Z');

    expect(scansOn(USER_A, '2026-08-09')).toBe(1);
  });

  it('reports zero for a day with no scans', () => {
    expect(scansOn(USER_A, '2026-08-09')).toBe(0);
  });

  // A scan the user discarded still leaves its record and its cost, so a
  // failed scan counts towards usage exactly like a successful one.
  it('counts a failed scan, because it still cost money', () => {
    recordScan(USER_A, '2026-08-09T08:00:00.000Z', 'ok');
    recordScan(USER_A, '2026-08-09T09:00:00.000Z', 'failed');
    recordScan(USER_A, '2026-08-09T10:00:00.000Z', 'unrecognised');

    expect(scansOn(USER_A, '2026-08-09')).toBe(3);
  });

  // covers: AC-15. The index is what makes the count cheap, and its absence is
  // what would push someone towards adding a counter column.
  it('has the index that makes the count cheap', () => {
    const indexes = store.raw
      .prepare("select name from sqlite_master where type = 'index' and tbl_name = 'meal_scans'")
      .all()
      .map((row) => String((row as { name: unknown }).name));

    expect(indexes).toContain('meal_scans_user_created_at_idx');
  });

  // covers: AC-15
  it('needs no counter column anywhere, because the rows are the count', () => {
    const columns = store.raw
      .prepare("select name from pragma_table_info('meal_scans')")
      .all()
      .map((row) => String((row as { name: unknown }).name));

    expect(columns.filter((name) => name.includes('count'))).toEqual([]);
  });

  // `meal_scans` has no tombstone: a scan record is not user facing content,
  // so nothing can quietly remove it from the usage figures.
  it('has no deleted_at, so a scan cannot be hidden from usage', () => {
    const columns = store.raw
      .prepare("select name from pragma_table_info('meal_scans')")
      .all()
      .map((row) => String((row as { name: unknown }).name));

    expect(columns).not.toContain('deleted_at');
  });
});

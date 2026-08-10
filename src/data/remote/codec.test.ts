import { describe, expect, it } from 'vitest';

import { normaliseInstant, toLocalRow, toRemoteRow } from './codec';
import { syncedTables } from './tables';

/**
 * The three quiet corruptions this file exists to stop. Every one of them
 * would store a wrong value rather than raise an error, which is why they are
 * tested at the edge rather than trusted to a review.
 */

const tableNamed = (name: string) => {
  const table = syncedTables.find((candidate) => candidate.name === name);
  if (table === undefined) throw new Error(`no synced table named ${name}`);
  return table;
};

describe('toRemoteRow', () => {
  it('sends a SQLite boolean as a real boolean', () => {
    const row = toRemoteRow(tableNamed('profiles'), { photo_sync_enabled: 1 });
    expect(row['photo_sync_enabled']).toBe(true);

    const off = toRemoteRow(tableNamed('profiles'), { photo_sync_enabled: 0 });
    expect(off['photo_sync_enabled']).toBe(false);
  });

  it('sends a json column as an object, not as text', () => {
    const row = toRemoteRow(tableNamed('meal_scans'), {
      raw_response: '{"items":[{"name":"rice"}]}',
    });
    expect(row['raw_response']).toEqual({ items: [{ name: 'rice' }] });
  });

  it('sends only the shared columns, never is_dirty or synced_at', () => {
    const row = toRemoteRow(tableNamed('meals'), {
      id: 'meal-1',
      user_id: 'user_2aBcDeFgHiJkLmNoPqRsTuVwX',
      is_dirty: 1,
      synced_at: '2026-08-09T00:00:00.000Z',
    });

    expect(row).not.toHaveProperty('is_dirty');
    expect(row).not.toHaveProperty('synced_at');
    expect(row['id']).toBe('meal-1');
  });
});

describe('toLocalRow', () => {
  it('stores a boolean as 0 or 1', () => {
    expect(
      toLocalRow(tableNamed('profiles'), { photo_sync_enabled: true })['photo_sync_enabled'],
    ).toBe(1);
    expect(
      toLocalRow(tableNamed('profiles'), { photo_sync_enabled: false })['photo_sync_enabled'],
    ).toBe(0);
  });

  it('stores a json column as text', () => {
    const row = toLocalRow(tableNamed('meal_scans'), { raw_response: { items: [] } });
    expect(row['raw_response']).toBe('{"items":[]}');
  });

  it('normalises an instant to the one format the watermark compares', () => {
    const row = toLocalRow(tableNamed('meals'), { updated_at: '2026-08-09T12:00:00+00:00' });
    expect(row['updated_at']).toBe('2026-08-09T12:00:00.000Z');
  });

  it('leaves a date alone, because a timezone can move the day', () => {
    const row = toLocalRow(tableNamed('meals'), { eaten_on: '2026-08-09' });
    expect(row['eaten_on']).toBe('2026-08-09');
  });

  it('reads a numeric handed back as a string as a number', () => {
    const row = toLocalRow(tableNamed('daily_targets'), { calories: '2290' });
    expect(row['calories']).toBe(2290);
  });
});

describe('normaliseInstant', () => {
  it('is stable, so a value that has been through it does not move again', () => {
    const once = normaliseInstant('2026-08-09T12:00:00+00:00');
    expect(normaliseInstant(once)).toBe(once);
  });

  it('hands back anything it cannot read rather than inventing a date', () => {
    expect(normaliseInstant('not a date')).toBe('not a date');
  });
});

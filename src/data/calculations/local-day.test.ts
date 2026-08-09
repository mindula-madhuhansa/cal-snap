import { describe, expect, it } from 'vitest';

import { resolveLocalDay, resolveLocalHour, shiftDay } from './local-day';

/**
 * AC-3 lives here. `eaten_on` is decided once from an instant and a zone, and
 * these tests pin the cases where getting it wrong moves a meal to the wrong
 * day: either side of local midnight, a zone ahead of UTC, a zone behind it,
 * a half hour offset, and a daylight saving change.
 */
describe('resolveLocalDay', () => {
  // covers: AC-3
  it('files a late night meal under the local date, not the UTC one', () => {
    // 18:20 UTC is 23:50 in Colombo, which is +05:30.
    const instant = new Date('2026-08-09T18:20:00Z');
    expect(resolveLocalDay(instant, 'Asia/Colombo')).toEqual({ kind: 'ok', value: '2026-08-09' });
  });

  // covers: AC-3. The same instant, read from two zones that disagree about
  // which day it is. This is the bug the stored `eaten_on` column prevents.
  it('gives different dates for the same instant in zones either side of midnight', () => {
    const instant = new Date('2026-08-09T19:30:00Z');
    expect(resolveLocalDay(instant, 'Asia/Colombo')).toEqual({ kind: 'ok', value: '2026-08-10' });
    expect(resolveLocalDay(instant, 'Europe/London')).toEqual({ kind: 'ok', value: '2026-08-09' });
    expect(resolveLocalDay(instant, 'America/Los_Angeles')).toEqual({
      kind: 'ok',
      value: '2026-08-09',
    });
  });

  // covers: AC-3
  it('handles a zone far behind UTC, where the local date is still the day before', () => {
    const instant = new Date('2026-08-10T05:00:00Z');
    expect(resolveLocalDay(instant, 'Pacific/Honolulu')).toEqual({
      kind: 'ok',
      value: '2026-08-09',
    });
  });

  // covers: AC-3
  it('handles a zone far ahead of UTC, where the local date is already the next day', () => {
    const instant = new Date('2026-08-09T13:00:00Z');
    expect(resolveLocalDay(instant, 'Pacific/Kiritimati')).toEqual({
      kind: 'ok',
      value: '2026-08-10',
    });
  });

  it('pads the month and day to two digits, so the value sorts as a string', () => {
    const instant = new Date('2026-01-05T12:00:00Z');
    expect(resolveLocalDay(instant, 'UTC')).toEqual({ kind: 'ok', value: '2026-01-05' });
  });

  it('reports an unrecognised zone as a value rather than throwing', () => {
    const result = resolveLocalDay(new Date('2026-08-09T12:00:00Z'), 'Mars/Olympus_Mons');
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') {
      expect(result.message).toContain('Mars/Olympus_Mons');
    }
  });
});

describe('resolveLocalHour', () => {
  // covers: AC-3. The meal type guess reads this, so midnight must be 0 and
  // never 24.
  it('reports midnight as hour 0, not 24', () => {
    expect(resolveLocalHour(new Date('2026-08-09T00:00:00Z'), 'UTC')).toBe(0);
  });

  it('reports the local hour in the zone given, not UTC', () => {
    const instant = new Date('2026-08-09T18:20:00Z');
    expect(resolveLocalHour(instant, 'Asia/Colombo')).toBe(23);
    expect(resolveLocalHour(instant, 'UTC')).toBe(18);
  });

  it('handles a half hour offset zone', () => {
    expect(resolveLocalHour(new Date('2026-08-09T12:00:00Z'), 'Asia/Kolkata')).toBe(17);
  });

  it('returns undefined for an unrecognised zone', () => {
    expect(resolveLocalHour(new Date('2026-08-09T12:00:00Z'), 'Nowhere/Real')).toBeUndefined();
  });
});

describe('shiftDay', () => {
  // covers: AC-9 and the streak. Walking back day by day must stay on calendar
  // dates and never drift by an hour across a daylight saving boundary.
  it('steps back one calendar day', () => {
    expect(shiftDay('2026-08-09', -1)).toBe('2026-08-08');
  });

  it('steps across a month boundary', () => {
    expect(shiftDay('2026-08-01', -1)).toBe('2026-07-31');
    expect(shiftDay('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('steps across a year boundary', () => {
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles a leap day', () => {
    expect(shiftDay('2028-03-01', -1)).toBe('2028-02-29');
  });

  // The dates are handled in UTC precisely so a zone that changes its offset
  // cannot make a day 23 or 25 hours long and skip or repeat a date.
  it('does not drift across a daylight saving change', () => {
    expect(shiftDay('2026-03-30', -1)).toBe('2026-03-29');
    expect(shiftDay('2026-10-26', -1)).toBe('2026-10-25');
  });

  it('returns the same day when the shift is zero', () => {
    expect(shiftDay('2026-08-09', 0)).toBe('2026-08-09');
  });
});

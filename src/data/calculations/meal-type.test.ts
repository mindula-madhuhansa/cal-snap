import { describe, expect, it } from 'vitest';

import { guessMealType, guessMealTypeFromHour } from './meal-type';

/**
 * The boundaries spec 0002 fixed. Every edge is pinned here because an off by
 * one hour would file a meal under the wrong heading on the Today screen, and
 * nothing else in the app would notice.
 */
describe('guessMealTypeFromHour', () => {
  const boundaries: readonly (readonly [number, string])[] = [
    [0, 'snack'],
    [3, 'snack'],
    [4, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [14, 'lunch'],
    [15, 'snack'],
    [16, 'snack'],
    [17, 'dinner'],
    [20, 'dinner'],
    [21, 'snack'],
    [23, 'snack'],
  ];

  // covers: AC-3
  it.each(boundaries)('guesses %i:00 as %s', (hour, expected) => {
    expect(guessMealTypeFromHour(hour)).toBe(expected);
  });

  // The gaps are deliberate, not an oversight: 15:00 to 17:00 and 21:00 to
  // 04:00 are snack hours, which is what a person eating then would call it.
  it('treats the mid afternoon gap as a snack rather than stretching lunch', () => {
    expect(guessMealTypeFromHour(15)).toBe('snack');
    expect(guessMealTypeFromHour(16)).toBe('snack');
  });

  it('treats the late evening as a snack rather than stretching dinner', () => {
    expect(guessMealTypeFromHour(21)).toBe('snack');
    expect(guessMealTypeFromHour(22)).toBe('snack');
  });

  it('covers all 24 hours with a valid meal type', () => {
    const all = Array.from({ length: 24 }, (_, hour) => guessMealTypeFromHour(hour));
    expect(all).toHaveLength(24);
    expect(all.every((type) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(type))).toBe(
      true,
    );
  });
});

describe('guessMealType', () => {
  // covers: AC-3
  it('guesses from the local hour in the zone given, not from UTC', () => {
    // 18:20 UTC is 23:50 in Colombo (a snack) and 19:20 in London (dinner).
    const instant = new Date('2026-08-09T18:20:00Z');
    expect(guessMealType(instant, 'Asia/Colombo')).toBe('snack');
    expect(guessMealType(instant, 'Europe/London')).toBe('dinner');
  });

  it('falls back to snack when the zone is unrecognised, so a meal can still be saved', () => {
    expect(guessMealType(new Date('2026-08-09T12:00:00Z'), 'Nowhere/Real')).toBe('snack');
  });
});

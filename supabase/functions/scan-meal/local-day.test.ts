import { describe, expect, it } from 'vitest';

import { localDayWindow, utcDayWindow } from './local-day';

/**
 * Spec 0007, AC-8 and AC-8b: the cap is counted over the person's own local
 * day, resolved server side from `profiles.timezone`. Get this wrong and the
 * allowance resets at the wrong hour, or somebody gets two days of scans.
 */

describe('localDayWindow', () => {
  // covers: AC-8. Colombo is UTC+5:30, so its day starts at 18:30 the previous
  // day in UTC. A half hour zone is the case an hours only implementation gets
  // silently wrong.
  it('resolves a half hour zone correctly', () => {
    const window = localDayWindow(new Date('2026-08-11T12:00:00.000Z'), 'Asia/Colombo');
    expect(window?.start.toISOString()).toBe('2026-08-10T18:30:00.000Z');
    expect(window?.end.toISOString()).toBe('2026-08-11T18:30:00.000Z');
  });

  // covers: AC-8. A moment just after local midnight belongs to the new day,
  // not the one that just ended.
  it('puts a moment just after local midnight in the new day', () => {
    const window = localDayWindow(new Date('2026-08-10T18:31:00.000Z'), 'Asia/Colombo');
    expect(window?.start.toISOString()).toBe('2026-08-10T18:30:00.000Z');
  });

  // covers: AC-8. And a moment just before it belongs to the old day, so a
  // scan at 23:59 does not quietly spend tomorrow's allowance.
  it('puts a moment just before local midnight in the old day', () => {
    const window = localDayWindow(new Date('2026-08-10T18:29:00.000Z'), 'Asia/Colombo');
    expect(window?.start.toISOString()).toBe('2026-08-09T18:30:00.000Z');
  });

  // covers: AC-8. A whole hour zone west of UTC, where the local day starts
  // *after* the UTC one rather than before it.
  it('resolves a zone behind UTC', () => {
    const window = localDayWindow(new Date('2026-08-11T12:00:00.000Z'), 'America/New_York');
    expect(window?.start.toISOString()).toBe('2026-08-11T04:00:00.000Z');
    expect(window?.end.toISOString()).toBe('2026-08-12T04:00:00.000Z');
  });

  it('resolves UTC itself', () => {
    const window = localDayWindow(new Date('2026-08-11T12:00:00.000Z'), 'UTC');
    expect(window?.start.toISOString()).toBe('2026-08-11T00:00:00.000Z');
    expect(window?.end.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });

  // covers: AC-8. The day daylight saving ends in New York is 25 hours long.
  // Computing the end from *this* day's offset would cut it an hour short and
  // reset somebody's cap early, twice a year.
  it('spans 25 hours on the day the clocks go back', () => {
    const window = localDayWindow(new Date('2026-11-01T12:00:00.000Z'), 'America/New_York');
    const hours = ((window?.end.getTime() ?? 0) - (window?.start.getTime() ?? 0)) / 3_600_000;
    expect(hours).toBe(25);
  });

  // And 23 hours the day they go forward.
  it('spans 23 hours on the day the clocks go forward', () => {
    const window = localDayWindow(new Date('2026-03-08T18:00:00.000Z'), 'America/New_York');
    const hours = ((window?.end.getTime() ?? 0) - (window?.start.getTime() ?? 0)) / 3_600_000;
    expect(hours).toBe(23);
  });

  // covers: AC-8b. The reset the person is told about is the same instant the
  // count ends at, so the sentence and the gate can never disagree.
  it('resets at exactly the moment the window ends', () => {
    const window = localDayWindow(new Date('2026-08-11T12:00:00.000Z'), 'Asia/Colombo');
    expect(window?.resetsAt.toISOString()).toBe(window?.end.toISOString());
  });

  // A stored zone this runtime's ICU does not carry is an expected failure, so
  // it comes back as a value and the caller falls back to UTC rather than
  // throwing somebody's scan away.
  it('returns nothing for an unrecognised zone', () => {
    expect(localDayWindow(new Date('2026-08-11T12:00:00.000Z'), 'Mars/Olympus')).toBeUndefined();
  });
});

describe('utcDayWindow', () => {
  // The fallback when the profile has no usable zone. Still a real 24 hour
  // window, so the cap is still enforced rather than skipped.
  it('is the UTC calendar day containing the instant', () => {
    const window = utcDayWindow(new Date('2026-08-11T23:59:59.999Z'));
    expect(window.start.toISOString()).toBe('2026-08-11T00:00:00.000Z');
    expect(window.end.toISOString()).toBe('2026-08-12T00:00:00.000Z');
  });
});

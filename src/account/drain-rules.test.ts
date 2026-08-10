import { describe, expect, it } from 'vitest';

import { deadlineFrom, decideSignOut, DRAINING_DAYS, hasExpired } from './drain-rules';

/**
 * The rules that decide whether a health record stays on a phone. Each one is
 * a sentence from spec 0004 turned into a check.
 */

describe('decideSignOut', () => {
  // covers: AC-11
  it('removes the file when nothing is owed', () => {
    expect(decideSignOut(0, false)).toEqual({ kind: 'remove' });
    expect(decideSignOut(0, true)).toEqual({ kind: 'remove' });
  });

  // covers: AC-11
  it('asks rather than removing when work has not reached the account', () => {
    expect(decideSignOut(12, false)).toEqual({ kind: 'ask' });
  });

  // covers: AC-11b
  it('drains when the person chose to sign out anyway', () => {
    expect(decideSignOut(12, true)).toEqual({ kind: 'drain' });
  });
});

describe('deadlineFrom', () => {
  // covers: AC-11b
  it('is seven days after the sign out', () => {
    expect(deadlineFrom('2026-08-09T12:00:00.000Z')).toBe('2026-08-16T12:00:00.000Z');
    expect(DRAINING_DAYS).toBe(7);
  });
});

describe('hasExpired', () => {
  const record = { userId: 'user_2aBcDeFgHiJkLmNoPqRsTuVwX', deadline: '2026-08-16T12:00:00.000Z' };

  // covers: AC-11b
  it('is false while there is still time to drain', () => {
    expect(hasExpired(record, '2026-08-15T23:59:59.000Z')).toBe(false);
  });

  // covers: AC-11b
  it('is true at the deadline, so the file goes even with rows owed', () => {
    expect(hasExpired(record, '2026-08-16T12:00:00.000Z')).toBe(true);
    expect(hasExpired(record, '2026-09-01T00:00:00.000Z')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { USER_A, USER_B } from '../../../test/support/sqlite';

import { databaseNameForUser, isClerkUserId } from './database-name';

describe('isClerkUserId', () => {
  // covers: AC-8
  it('accepts the identifiers Clerk actually issues', () => {
    expect(isClerkUserId(USER_A)).toBe(true);
    expect(isClerkUserId(USER_B)).toBe(true);
    expect(isClerkUserId('user_2abcdefghijklmnopqrst')).toBe(true);
  });

  // covers: AC-8. Spec 0004 widened this check from the old UUID pattern, and
  // the old shape must now be refused: a UUID here would mean identity came
  // from somewhere other than Clerk.
  it('refuses a UUID, which is what identifiers used to look like', () => {
    expect(isClerkUserId('11111111-2222-4333-8444-555555555555')).toBe(false);
  });

  // covers: AC-8. The point of the check: this value becomes a file path and
  // an argument to deleteDatabaseAsync, so nothing that can traverse or
  // collide may pass.
  it('refuses anything that could escape a filename', () => {
    for (const bad of [
      'user_../../etc/passwd',
      'user_2abc/def/ghijklmnopqrs',
      'user_2abc.def.ghijklmnopqr',
      'user_2abc def ghijklmnopqr',
      '../calsnap-user_2aBcDeFgHiJkLmNoPqRsTuVwX',
      '',
    ]) {
      expect(isClerkUserId(bad)).toBe(false);
    }
  });

  it('refuses an identifier that is too short or too long, or missing the prefix', () => {
    expect(isClerkUserId('user_2abc')).toBe(false);
    expect(isClerkUserId(`user_${'a'.repeat(33)}`)).toBe(false);
    expect(isClerkUserId('2aBcDeFgHiJkLmNoPqRsTuVwX')).toBe(false);
    expect(isClerkUserId('usr_2aBcDeFgHiJkLmNoPqRsTuVwX')).toBe(false);
  });
});

describe('databaseNameForUser', () => {
  // covers: AC-8. One file per identifier, and two accounts never collide.
  it('names a different file for each account', () => {
    expect(databaseNameForUser(USER_A)).toBe(`calsnap-${USER_A}.db`);
    expect(databaseNameForUser(USER_A)).not.toBe(databaseNameForUser(USER_B));
  });
});

import { describe, expect, it } from 'vitest';

import { looksLikeLostConnection } from './network-failure';

/**
 * The regression this module was extracted for (spec 0004, AC-12).
 *
 * The rule lived in two near copies that had drifted apart, and neither knew
 * what a timeout or a DNS failure actually says. Every message below is a real
 * shape from a runtime this app talks through, not an invented one, which is
 * the whole reason the original list was wrong: it was written from browser
 * `fetch` vocabulary plus the guessed word `timeout`.
 */

describe('looksLikeLostConnection, the messages that broke it', () => {
  // covers: AC-12. The exact five that came back as `rejected` before the fix.
  it.each([
    ['The request timed out', 'iOS, NSURLErrorTimedOut'],
    ['connect ETIMEDOUT 10.0.0.1:443', 'a socket that gave up'],
    ['socket hang up', 'the connection dropped mid request'],
    ['getaddrinfo ENOTFOUND kfzlocqwrzgkyqkzphfq.supabase.co', 'DNS, no such host'],
    ['getaddrinfo EAI_AGAIN kfzlocqwrzgkyqkzphfq.supabase.co', 'DNS, temporary failure'],
  ])('reads %s as a lost connection (%s)', (message) => {
    expect(looksLikeLostConnection(message)).toBe(true);
  });

  // covers: AC-12. "timed out" and "timeout" are different strings, and only
  // the second was ever matched. That one missing letter is the whole bug.
  it('matches both spellings of a timeout', () => {
    expect(looksLikeLostConnection('The operation timed out')).toBe(true);
    expect(looksLikeLostConnection('Request timeout')).toBe(true);
  });
});

describe('looksLikeLostConnection, what each old copy already knew', () => {
  /**
   * The two copies had each learned something the other had not, which is how
   * the drift showed itself. Both sides are asserted here so a future edit
   * cannot quietly drop one again.
   */
  // covers: AC-12. What the sync copy knew.
  it.each([
    'Network request failed',
    'fetch failed',
    'failed to fetch',
    'The operation was aborted',
  ])('still reads "%s" as a lost connection', (message) => {
    expect(looksLikeLostConnection(message)).toBe(true);
  });

  // covers: AC-12. What the sign in copy knew, and the sync copy did not.
  it('still reads a message about the internet as a lost connection', () => {
    expect(looksLikeLostConnection('No internet connection')).toBe(true);
  });
});

describe('looksLikeLostConnection, what it must not swallow', () => {
  /**
   * The counter direction matters as much. Reading a genuine refusal as
   * "offline" tells someone to check a connection that is fine, and hides a
   * real fault behind a reassuring sentence.
   */
  // covers: AC-12
  it.each([
    'duplicate key value violates unique constraint "meals_pkey"',
    'relation "public.meals" does not exist',
    'new row for relation "meals" violates check constraint',
    'invalid input syntax for type uuid',
    'permission denied for table meals',
  ])('does not read "%s" as a lost connection', (message) => {
    expect(looksLikeLostConnection(message)).toBe(false);
  });

  // covers: AC-12. Total on the empty string, which is what an error carrying
  // only a code arrives as.
  it('says no to an empty message rather than throwing', () => {
    expect(looksLikeLostConnection('')).toBe(false);
  });

  // covers: AC-12. Case is not a contract. Platforms shout their error codes
  // and write their sentences in mixed case.
  it('ignores case', () => {
    expect(looksLikeLostConnection('ETIMEDOUT')).toBe(true);
    expect(looksLikeLostConnection('NETWORK REQUEST FAILED')).toBe(true);
  });
});

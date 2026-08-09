import { describe, expect, it } from 'vitest';

import { sha1 } from './sha1';

/**
 * SHA-1 is written out by hand here so that deriving a day's identifier stays
 * a pure synchronous function. That makes it exactly the kind of code that
 * must be pinned against published vectors rather than against itself: a
 * subtly wrong implementation would still be perfectly deterministic, and
 * every device would agree on the wrong answer.
 *
 * The vectors below are from FIPS 180-1 and RFC 3174.
 */
const hex = (bytes: Uint8Array): string =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

const digestOf = (text: string): string => hex(sha1(new TextEncoder().encode(text)));

describe('sha1', () => {
  it('matches the published digest for the empty string', () => {
    expect(digestOf('')).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
  });

  it('matches the published digest for "abc"', () => {
    expect(digestOf('abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  // 56 bytes: the length that forces a second padding block, which is where a
  // hand written padding routine usually goes wrong.
  it('matches the published digest for a 56 byte message', () => {
    expect(digestOf('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    );
  });

  it('matches the published digest for a million repeats of "a"', () => {
    expect(digestOf('a'.repeat(1_000_000))).toBe('34aa973cd4c4daa4f61eeb2bdbad27316534016f');
  });

  it('matches the published digest for a 64 byte message, exactly one block', () => {
    expect(digestOf('a'.repeat(64))).toBe('0098ba824b5c16427bd7a1122a5a442a25ec644d');
  });

  it('matches the published digest for a 55 byte message, the last that fits one block', () => {
    expect(digestOf('a'.repeat(55))).toBe('c1c8bbdc22796e28c0e15163d20899b65621d65a');
  });

  it('always returns 20 bytes', () => {
    for (const length of [0, 1, 55, 56, 63, 64, 65, 119, 120, 1000]) {
      expect(sha1(new Uint8Array(length))).toHaveLength(20);
    }
  });

  it('produces a different digest for a one bit difference', () => {
    expect(digestOf('abc')).not.toBe(digestOf('abd'));
  });

  it('handles bytes above the ASCII range', () => {
    expect(digestOf('café ☕')).toHaveLength(40);
    expect(digestOf('café ☕')).not.toBe(digestOf('cafe ☕'));
  });

  it('does not mutate the message it was given', () => {
    const message = new TextEncoder().encode('abc');
    const copy = Uint8Array.from(message);
    sha1(message);
    expect(message).toEqual(copy);
  });
});

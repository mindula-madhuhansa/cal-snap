import { describe, expect, it } from 'vitest';

import { CALSNAP_NAMESPACE, createIdSource, dayScopedId, uuidV5, uuidV7From } from './uuid';

const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V5 = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const bytes = (seed: number, count = 10): Uint8Array =>
  Uint8Array.from({ length: count }, (_, index) => (seed * 31 + index) % 256);

describe('uuidV7From', () => {
  // covers: AC-4
  it('sets the version and variant bits RFC 9562 requires', () => {
    expect(uuidV7From(1_770_000_000_000, bytes(1))).toMatch(V7);
  });

  // covers: AC-4. The whole point of version 7: identifiers made later sort
  // later, so inserts stay at the end of the index instead of scattering.
  it('produces identifiers that sort in the order they were made', () => {
    const made = Array.from({ length: 200 }, (_, index) =>
      uuidV7From(1_770_000_000_000 + index, bytes(index)),
    );
    expect([...made].sort()).toEqual(made);
  });

  it('encodes the timestamp in the leading 48 bits', () => {
    const at = 1_770_000_000_000;
    const encoded = uuidV7From(at, bytes(1)).replace(/-/g, '').slice(0, 12);
    expect(Number.parseInt(encoded, 16)).toBe(at);
  });

  it('produces different identifiers for the same instant with different randomness', () => {
    const first = uuidV7From(1_770_000_000_000, bytes(1));
    const second = uuidV7From(1_770_000_000_000, bytes(2));
    expect(first).not.toBe(second);
  });

  it('is pure: the same clock and the same bytes give the same identifier', () => {
    expect(uuidV7From(1_770_000_000_000, bytes(7))).toBe(uuidV7From(1_770_000_000_000, bytes(7)));
  });

  it('handles a timestamp beyond 32 bits of milliseconds', () => {
    expect(uuidV7From(2_000_000_000_000, bytes(3))).toMatch(V7);
  });

  it('handles the zero timestamp without losing its shape', () => {
    expect(uuidV7From(0, bytes(4))).toMatch(V7);
  });
});

describe('createIdSource', () => {
  // covers: AC-4
  it('hands out well formed, unique identifiers', () => {
    let tick = 0;
    const ids = createIdSource(
      (count) => bytes(tick, count),
      () => 1_770_000_000_000 + (tick += 1),
    );
    const made = Array.from({ length: 500 }, () => ids.newId());

    expect(new Set(made).size).toBe(500);
    expect(made.every((id) => V7.test(id))).toBe(true);
  });
});

describe('uuidV5', () => {
  // The published vector. This is what proves the namespace bytes, the SHA-1,
  // and the version and variant stamping are all right, rather than merely
  // self consistent.
  it('matches the RFC 9562 test vector for the DNS namespace', () => {
    expect(uuidV5('www.example.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '74738ff5-5367-5958-9aee-98fffdcd1876',
    );
  });

  it('sets the version and variant bits', () => {
    expect(uuidV5('anything')).toMatch(V5);
  });

  it('gives a different identifier for a different namespace', () => {
    expect(uuidV5('same-name', CALSNAP_NAMESPACE)).not.toBe(
      uuidV5('same-name', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
    );
  });

  it('handles an empty name and a name with characters outside ASCII', () => {
    expect(uuidV5('')).toMatch(V5);
    expect(uuidV5('café ☕')).toMatch(V5);
    expect(uuidV5('café ☕')).not.toBe(uuidV5('cafe ☕'));
  });
});

describe('dayScopedId', () => {
  // covers: AC-9. Two offline phones deciding to create the same day's row
  // must produce the same identifier, so the clash lands on the primary key
  // where newest write wins can see it.
  it('derives the same identifier for the same table, user, and date', () => {
    expect(dayScopedId('daily_targets', 'user-1', '2026-08-09')).toBe(
      dayScopedId('daily_targets', 'user-1', '2026-08-09'),
    );
  });

  it('derives a different identifier for a different user', () => {
    expect(dayScopedId('daily_targets', 'user-1', '2026-08-09')).not.toBe(
      dayScopedId('daily_targets', 'user-2', '2026-08-09'),
    );
  });

  it('derives a different identifier for a different date', () => {
    expect(dayScopedId('daily_targets', 'user-1', '2026-08-09')).not.toBe(
      dayScopedId('daily_targets', 'user-1', '2026-08-10'),
    );
  });

  // The two day keyed tables must not collide with each other for the same
  // user and date.
  it('derives a different identifier for a different table', () => {
    expect(dayScopedId('daily_targets', 'user-1', '2026-08-09')).not.toBe(
      dayScopedId('weight_entries', 'user-1', '2026-08-09'),
    );
  });

  it('is a well formed version 5 identifier', () => {
    expect(dayScopedId('daily_targets', 'user-1', '2026-08-09')).toMatch(V5);
  });

  // Changing the namespace would rename every existing day keyed row on every
  // device, so it is frozen. This test is the tripwire.
  it('pins the project namespace, which must never change', () => {
    expect(CALSNAP_NAMESPACE).toBe('6f1a8c2e-9b47-5d3a-8e10-4c7b2f9a5d63');
  });
});

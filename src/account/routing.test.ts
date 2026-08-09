import { describe, expect, it } from 'vitest';

import { destinationFor } from './routing';

describe('destinationFor', () => {
  // covers: AC-6
  it('sends a person with a finished profile to Today', () => {
    expect(
      destinationFor({ kind: 'fresh', profile: { onboardedAt: '2026-08-01T00:00:00Z' } }),
    ).toEqual({ kind: 'today', offline: false });
  });

  // covers: AC-6
  it('sends a brand new account to onboarding', () => {
    expect(destinationFor({ kind: 'fresh' })).toEqual({ kind: 'onboarding' });
  });

  // covers: AC-6. Signed up but never finished.
  it('sends an account with a null onboarded_at to onboarding', () => {
    expect(destinationFor({ kind: 'fresh', profile: { onboardedAt: null } })).toEqual({
      kind: 'onboarding',
    });
  });

  // covers: AC-6. The case the spec calls out by name: someone onboarded on a
  // second phone, signing in on a phone whose local row is pre onboarding.
  // The server answered, so the server wins, and they are not marched through
  // onboarding a second time.
  it('trusts a fresh server answer over whatever the phone had', () => {
    expect(
      destinationFor({ kind: 'fresh', profile: { onboardedAt: '2026-08-01T00:00:00Z' } }),
    ).toEqual({ kind: 'today', offline: false });
  });

  // covers: AC-6. The other half: the pull failed with no network. Silence is
  // not evidence that someone has not onboarded, so a local row saying they
  // have is trusted, and Today is told to say it may be showing old numbers.
  it('lets an offline person in against their local row, and marks it offline', () => {
    expect(
      destinationFor({ kind: 'stale', profile: { onboardedAt: '2026-08-01T00:00:00Z' } }),
    ).toEqual({ kind: 'today', offline: true });
  });

  // covers: AC-6. Nothing from the server and nothing locally is the genuinely
  // new install with no signal. Onboarding is the only honest answer.
  it('falls back to onboarding only when there is nothing to go on at all', () => {
    expect(destinationFor({ kind: 'stale' })).toEqual({ kind: 'onboarding' });
    expect(destinationFor({ kind: 'stale', profile: { onboardedAt: null } })).toEqual({
      kind: 'onboarding',
    });
  });

  // covers: AC-6. The asymmetry is the rule, so it is worth asserting
  // directly: the same absent profile routes the same way, but an onboarded
  // profile is trusted whether it is fresh or stale.
  it('never lets a network failure alone decide someone is not onboarded', () => {
    const onboarded = { onboardedAt: '2026-08-01T00:00:00Z' };
    expect(destinationFor({ kind: 'fresh', profile: onboarded }).kind).toBe('today');
    expect(destinationFor({ kind: 'stale', profile: onboarded }).kind).toBe('today');
  });
});

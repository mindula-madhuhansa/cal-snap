import { describe, expect, it } from 'vitest';

import { actionForSignOut } from './sign-out-outcome';
import type { SignOutOutcome } from './sign-out';

/**
 * The regression this module was extracted for (spec 0004, AC-11, AC-11b).
 *
 * The decision used to be a chain of `if` statements inside the Settings
 * screen. `failed` matched none of them, fell through to the success path, and
 * its message was discarded: the person pressed sign out, watched the screen
 * re-render, and was still signed in with their diary on disk and nothing said.
 * A shared phone handed over at that moment carries the whole health record.
 *
 * It survived a fresh model review of everything else because it lived in a
 * component no test in this suite can reach. These tests exist so it cannot
 * come back the same way.
 */

const failed: SignOutOutcome = {
  kind: 'failed',
  message: 'Your local data could not be removed. EACCES: permission denied',
};

describe('actionForSignOut, the failure that used to be silent', () => {
  // covers: AC-11. The whole bug in one assertion.
  it('shows the person a sentence when the removal failed', () => {
    expect(actionForSignOut(failed).message).toBe(failed.message);
  });

  // covers: AC-11. `recheck` reopens the file, which is why the failure looked
  // like success: the app came straight back to Today as if nothing happened.
  it('does not re-run startup after a failure, because nothing changed', () => {
    expect(actionForSignOut(failed).recheck).toBe(false);
  });

  // covers: AC-11. Ending the Clerk session here would leave the diary on the
  // phone with no session able to push it and no way back in to retry.
  it('keeps the session after a failure, so the person can try again', () => {
    expect(actionForSignOut(failed).endClerkSession).toBe(false);
  });
});

describe('actionForSignOut, the three outcomes that already worked', () => {
  // covers: AC-11. Everything landed and the file is gone, so the session ends
  // and the app stops showing the diary.
  it('ends the session and re-runs startup once the file is removed', () => {
    expect(actionForSignOut({ kind: 'removed' })).toEqual({
      endClerkSession: true,
      recheck: true,
    });
  });

  // covers: AC-11. Nothing has happened yet: the person is being asked. The app
  // must not look signed out while it waits for an answer.
  it('asks about the owed meals without signing anybody out', () => {
    expect(actionForSignOut({ kind: 'pending', meals: 3 })).toEqual({
      endClerkSession: false,
      recheck: false,
      askAbout: 3,
    });
  });

  // covers: AC-11b. The one case where the app and Clerk disagree on purpose.
  // The phone must look signed out immediately, and the session must survive,
  // because it is the only thing that can still push those meals.
  it('looks signed out while draining, but keeps the session', () => {
    expect(
      actionForSignOut({ kind: 'draining', meals: 2, deadline: '2026-08-17T00:00:00.000Z' }),
    ).toEqual({ endClerkSession: false, recheck: true });
  });
});

describe('actionForSignOut, the invariants across every outcome', () => {
  const every: readonly SignOutOutcome[] = [
    { kind: 'removed' },
    { kind: 'pending', meals: 3 },
    { kind: 'draining', meals: 2, deadline: '2026-08-17T00:00:00.000Z' },
    failed,
  ];

  // covers: AC-11b. The session may end only when nothing of the account is
  // left on the phone. Ending it while a file survives strands the rows.
  it('only ends the session on the one outcome where the file is gone', () => {
    const ending = every.filter((outcome) => actionForSignOut(outcome).endClerkSession);

    expect(ending).toEqual([{ kind: 'removed' }]);
  });

  // covers: AC-11. Exactly one outcome is a failure, and it is the only one
  // carrying a sentence. A silent failure is the bug; a message on a success
  // would be alarming for no reason.
  it('carries a message on the failure and on nothing else', () => {
    const withMessage = every.filter((outcome) => actionForSignOut(outcome).message !== undefined);

    expect(withMessage).toEqual([failed]);
  });

  // covers: AC-11. Every outcome resolves to a real decision. If a fifth is
  // ever added, the exhaustive switch stops compiling before this can fail.
  it('answers for every outcome the sign out can produce', () => {
    for (const outcome of every) {
      expect(actionForSignOut(outcome)).toBeDefined();
    }
  });
});

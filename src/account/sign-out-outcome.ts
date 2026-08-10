import type { SignOutOutcome } from './sign-out';

/**
 * What the screen should do about a sign out result (spec 0004, AC-11, AC-11b).
 *
 * This is a decision, so it lives apart from the screen that acts on it. That
 * split is the actual fix for the bug this file was written for: the decision
 * used to be a chain of `if` statements inside the Settings component, where
 * two of the four outcomes quietly shared a branch and no test in the suite
 * could reach it. `failed` fell through to the success path, its message was
 * discarded, and the person was told nothing at all.
 *
 * A `switch` over the union with an exhaustiveness guard is what makes that
 * class of mistake impossible rather than unlikely: add a fifth outcome to
 * `SignOutOutcome` and this stops compiling until it is handled here.
 *
 * `SignOutOutcome` is imported as a **type only**, so this module pulls in no
 * Expo code and runs under plain Node like every other rule in this folder.
 */

export type SignOutAction = {
  /**
   * End the Clerk session. Only ever true when nothing of this account is left
   * on the phone, because a draining account needs its session to keep pushing.
   */
  readonly endClerkSession: boolean;
  /**
   * Re-run the startup sequence so the app stops showing this diary.
   *
   * False when nothing actually changed. Re-running it after a failed removal
   * would simply reopen the file that is still there and land the person back
   * on Today, which is what made the failure look like success.
   */
  readonly recheck: boolean;
  /** Unpushed meals to ask the person about, when there is a choice to offer. */
  readonly askAbout?: number;
  /** A sentence to show. Present only when something went wrong. */
  readonly message?: string;
};

export const actionForSignOut = (outcome: SignOutOutcome): SignOutAction => {
  switch (outcome.kind) {
    /** Pushed and removed. Nothing of this person is left, so the session ends. */
    case 'removed':
      return { endClerkSession: true, recheck: true };

    /**
     * Work is owed and they have not chosen yet. Nothing has happened, so the
     * app must not look signed out: it asks, and waits.
     */
    case 'pending':
      return { endClerkSession: false, recheck: false, askAbout: outcome.meals };

    /**
     * Signed out on the surface, still pushing underneath. The Clerk session is
     * deliberately kept, and it is the only thing that can finish the job.
     */
    case 'draining':
      return { endClerkSession: false, recheck: true };

    /**
     * The removal itself failed, most often a disk error inside
     * `deleteDatabaseAsync`. The file is still on the phone and the account is
     * **not** draining, so nothing will retry it on its own.
     *
     * On a shared phone this is the one outcome that must never be quiet: a
     * person who believes they signed out and hands the device over is still
     * exposing their diary. So the session stays, nothing is rechecked, and the
     * sentence goes on screen.
     */
    case 'failed':
      return { endClerkSession: false, recheck: false, message: outcome.message };

    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
};

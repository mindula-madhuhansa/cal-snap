/**
 * The sign out and draining rules, as pure functions (spec 0004, AC-11,
 * AC-11b).
 *
 * They sit apart from `draining.ts` and `sign-out.ts` because those two are
 * the effects: the secure store, the database file, the push. These are the
 * decisions, and the decisions are what a test can hold to account without a
 * phone. Get one of these wrong and a person either loses meals or leaves a
 * health record on a phone they handed back.
 */

export const DRAINING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export type DrainingRecord = {
  readonly userId: string;
  /** When the file goes regardless, as an ISO instant. */
  readonly deadline: string;
};

/**
 * Seven days from the moment sign out was forced.
 *
 * A judgement, not a derived number: long enough to cover a holiday with no
 * signal, short enough that a borrowed phone does not keep a health record.
 */
export const deadlineFrom = (at: string, days: number = DRAINING_DAYS): string =>
  new Date(new Date(at).getTime() + days * DAY_MS).toISOString();

/** Whether the ceiling has been reached, at which point the file goes anyway. */
export const hasExpired = (record: DrainingRecord, now: string): boolean =>
  new Date(now).getTime() >= new Date(record.deadline).getTime();

export type SignOutDecision =
  /** Nothing is owed: remove the file and end the session. */
  | { readonly kind: 'remove' }
  /** Work is owed and nobody has been asked yet. Ask, with a meal count. */
  | { readonly kind: 'ask' }
  /** Work is owed and they said go anyway. Look signed out, drain behind it. */
  | { readonly kind: 'drain' };

/**
 * What signing out should do, given what is still owed.
 *
 * `owed` is rows across every table and `force` is the person's answer. The
 * count of **meals** is a separate number and never appears here, because it
 * is what a person reads and not what the code decides on (spec 0004, value
 * sourcing).
 */
export const decideSignOut = (owed: number, force: boolean): SignOutDecision => {
  if (owed === 0) return { kind: 'remove' };
  return force ? { kind: 'drain' } : { kind: 'ask' };
};

/**
 * Where a signed in person lands, decided once per launch (spec 0004, AC-6).
 *
 * Pure, and separated from the effects around it, because the interesting
 * part is not fetching the profile but what to do when fetching it fails. Get
 * that wrong and someone who onboarded on another phone is marched through
 * onboarding a second time, overwriting the target they already have.
 */

/** The single `profiles` row, reduced to the only field routing cares about. */
export type ProfileSnapshot = {
  /** Null means signed up but never finished onboarding. */
  readonly onboardedAt: string | null;
};

/** What the startup profile pull produced. */
export type ProfileLookup =
  /** The server answered. `profile` absent means there is genuinely no row. */
  | { readonly kind: 'fresh'; readonly profile?: ProfileSnapshot }
  /** The server could not be reached, and this is the local copy, if any. */
  | { readonly kind: 'stale'; readonly profile?: ProfileSnapshot };

export type Destination =
  | { readonly kind: 'onboarding' }
  /** `offline` asks Today to say so, because it is showing possibly old data. */
  | { readonly kind: 'today'; readonly offline: boolean };

const isOnboarded = (profile: ProfileSnapshot | undefined): boolean =>
  profile !== undefined && profile.onboardedAt !== null;

/**
 * The routing decision.
 *
 * The asymmetry between the two branches is deliberate and is the whole rule:
 *
 * - On a **fresh** answer, no row (or a null `onboarded_at`) means onboarding.
 *   The server is the truth and it says this person has not finished.
 * - On a **stale** answer, the app has not heard from the server, so it must
 *   not conclude "not onboarded" from silence. It trusts a local row that
 *   says onboarded, and only falls back to onboarding when it has nothing at
 *   all to go on, which is the genuinely new install with no network.
 *
 * Erring this way costs someone at worst a repeated onboarding they can leave;
 * erring the other way overwrites a real target with a guess.
 */
export const destinationFor = (lookup: ProfileLookup): Destination => {
  if (lookup.kind === 'fresh') {
    return isOnboarded(lookup.profile) ? { kind: 'today', offline: false } : { kind: 'onboarding' };
  }

  return isOnboarded(lookup.profile) ? { kind: 'today', offline: true } : { kind: 'onboarding' };
};

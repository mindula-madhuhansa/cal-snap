/**
 * Which version of the privacy note a person agreed to (spec 0006, AC-3).
 *
 * A source constant rather than configuration, and that is deliberate: a
 * policy version has to be pinned in the build that displayed the policy. If
 * it came from the environment, a value could be changed after the fact and
 * the stored record would claim someone agreed to text they never saw.
 *
 * **Scope feature 10 must bump this when the real policy text lands.**
 * Replacing the copy without bumping the version would record everyone who
 * onboarded before it as having consented to words that did not exist yet.
 */
export const CONSENT_VERSION = 'v1-placeholder';

/**
 * The plain words shown at the consent step. Placeholder copy, honest about
 * being placeholder, until feature 10 writes the real privacy policy and
 * terms and makes them reachable from inside the app.
 */
export const CONSENT_SUMMARY = [
  'To work out your daily calorie target, CalSnap asks for your sex, age, height, weight, and how active you are.',
  'That information is health data. It is stored on this phone and, so it survives a new phone, in your own account in the cloud. Nobody else can read it.',
  'You can change any answer later, and deleting your account deletes all of it.',
] as const;

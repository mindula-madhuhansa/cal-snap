import { devWarn } from '@/config/dev-warning';

/**
 * Turning a failure into a sentence a person can act on (spec 0004, AC-12).
 *
 * No provider error string ever reaches the screen. Clerk's own messages are
 * written for developers ("Identifier is invalid"), they leak internal words,
 * and they change without notice, so every one the app can hit is mapped here
 * by code and everything else falls back to one honest sentence.
 *
 * Pure on purpose: this is the layer most worth testing, because a wrong
 * message here is a person stuck at the door with no idea why.
 */

/** What went wrong, in the app's own words rather than the provider's. */
export type FailureMessage = {
  /** The sentence shown on screen. */
  readonly message: string;
  /**
   * Whether trying the same thing again could work. A wrong password is worth
   * retrying; an unknown email is not, it needs a different email.
   */
  readonly retryable: boolean;
};

const NETWORK: FailureMessage = {
  message: 'CalSnap could not reach the internet. Check your connection and try again.',
  retryable: true,
};

/**
 * Clerk error codes to sentences. Keyed by Clerk's `code`, never by its
 * message text, which is not a stable contract.
 */
const BY_CODE: Readonly<Record<string, FailureMessage>> = {
  form_identifier_not_found: {
    message: 'No account uses that email address. Check the spelling, or sign up with it instead.',
    retryable: false,
  },
  form_password_incorrect: {
    message: 'That password is not right. Try again, or choose "Email me a code instead".',
    retryable: true,
  },
  form_password_pwned: {
    message:
      'That password has appeared in a known data breach, so it cannot be used. Please choose a different one.',
    retryable: false,
  },
  form_password_length_too_short: {
    message: 'That password is too short. Use at least eight characters.',
    retryable: false,
  },
  form_identifier_exists: {
    message: 'An account already uses that email address. Sign in with it instead.',
    retryable: false,
  },
  form_param_format_invalid: {
    message: 'That does not look like an email address. Check it and try again.',
    retryable: false,
  },
  form_code_incorrect: {
    message: 'That code is not right. Check the email again, or ask for a new code.',
    retryable: true,
  },
  verification_failed: {
    message: 'That code could not be verified. Ask for a new one and try again.',
    retryable: true,
  },
  verification_expired: {
    message: 'That code has expired. Ask for a new one.',
    retryable: false,
  },
  form_code_expired: {
    message: 'That code has expired. Ask for a new one.',
    retryable: false,
  },
  too_many_requests: {
    message: 'Too many attempts just now. Wait a minute, then try again.',
    retryable: true,
  },
  captcha_invalid: {
    message: 'CalSnap could not confirm you are a person. Try again in a moment.',
    retryable: true,
  },
  /**
   * Not a Clerk code. The email was verified but the sign up cannot complete,
   * because the Clerk instance demands a field this screen never asks for.
   *
   * This is a configuration mistake, not something the person did, and it is
   * given its own sentence so it never hides behind "something went wrong".
   * Spec 0004 AC-1 is explicit that no password stands between a new person
   * and the app, so the fix is always in the dashboard, never a password step
   * bolted onto this screen.
   */
  sign_up_incomplete: {
    message:
      'Your email is confirmed, but this account could not be finished. This is a problem on our side, not yours. Please try again shortly.',
    retryable: false,
  },
  /**
   * Not a Clerk code. The session ending mid use is its own case (AC-13): the
   * person did nothing wrong and nothing of theirs was lost, and the sentence
   * has to say both or it reads like data loss.
   */
  session_ended: {
    message: 'You were signed out. Your meals are safe on this phone. Please sign in again.',
    retryable: false,
  },
  /** The person backed out of the Google or Apple sheet. Not a failure. */
  sign_in_cancelled: {
    message: '',
    retryable: true,
  },
};

const UNKNOWN: FailureMessage = {
  message: 'Something went wrong signing you in. Please try again.',
  retryable: true,
};

/** The codes Clerk uses when a person dismisses a native sign in sheet. */
const CANCELLED_CODES: readonly string[] = [
  'sign_in_cancelled',
  'user_cancelled',
  'oauth_access_denied',
  'ERR_REQUEST_CANCELED',
];

/**
 * Whether the person simply backed out. Cancelling is not an error and must
 * show nothing at all: an error message after someone deliberately closed a
 * sheet reads as a bug (AC-12).
 */
export const isCancellation = (code: string): boolean => CANCELLED_CODES.includes(code);

/** The sentence for a Clerk error code. */
export const messageForCode = (code: string): FailureMessage =>
  BY_CODE[code] ?? (isCancellation(code) ? { message: '', retryable: true } : UNKNOWN);

/**
 * The shape Clerk's API errors arrive in. Narrowed here rather than imported,
 * so nothing outside this module has to know the provider's types.
 */
type ClerkLikeError = {
  readonly errors?: readonly { readonly code?: string }[];
  readonly code?: string;
  readonly message?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Whether a thrown value looks like a lost connection rather than a refusal. */
const looksLikeNetworkFailure = (error: ClerkLikeError): boolean => {
  const text = (error.message ?? '').toLowerCase();
  return (
    text.includes('network') ||
    text.includes('failed to fetch') ||
    text.includes('timeout') ||
    text.includes('internet')
  );
};

/**
 * The one entry point: any failure in, one written sentence out.
 *
 * Deliberately total. Every path through sign in ends here, so there is no
 * way for a raw provider string, or a silent failure, to reach a person.
 */
export const failureMessage = (error: unknown): FailureMessage => {
  if (!isRecord(error)) {
    reportUnmapped(error);
    return UNKNOWN;
  }

  const clerkError = error as ClerkLikeError;
  const code = clerkError.errors?.[0]?.code ?? clerkError.code;

  if (code !== undefined && code !== '') {
    if (isCancellation(code)) return { message: '', retryable: true };
    const known = BY_CODE[code];
    if (known !== undefined) return known;
  }

  if (looksLikeNetworkFailure(clerkError)) return NETWORK;

  reportUnmapped(error);
  return UNKNOWN;
};

/**
 * Tells the developer what the person could not be told.
 *
 * The person sees one calm sentence, which is right; but "Something went
 * wrong" with nothing in the console is undebuggable, and an unmapped code is
 * a gap in the mapping above that somebody should close. This is the only
 * place a provider string is allowed to exist, and it never reaches a screen.
 *
 * Development only: `__DEV__` is false in a release build, so no health value
 * and no token can ever be written to a device log (spec 0004, security
 * model).
 */
const reportUnmapped = (error: unknown): void => {
  devWarn('[account] unmapped sign in failure:', JSON.stringify(error, null, 2));
};

export { NETWORK as networkFailureMessage, UNKNOWN as unknownFailureMessage };

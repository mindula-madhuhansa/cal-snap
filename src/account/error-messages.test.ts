import { describe, expect, it } from 'vitest';

import {
  failureMessage,
  messageForCode,
  networkFailureMessage,
  unknownFailureMessage,
} from './error-messages';

describe('failureMessage', () => {
  // covers: AC-12. The four failures the spec names by hand, each a distinct
  // sentence, because "something went wrong" four times is the bug.
  it('gives a wrong password, an unknown email, a wrong code and an expired code four different sentences', () => {
    const sentences = [
      'form_password_incorrect',
      'form_identifier_not_found',
      'form_code_incorrect',
      'verification_expired',
    ].map((code) => failureMessage({ errors: [{ code }] }).message);

    expect(new Set(sentences).size).toBe(4);
    for (const sentence of sentences) {
      expect(sentence.length).toBeGreaterThan(0);
    }
  });

  // covers: AC-12. A person who cannot get in with a password must be told
  // the way in that always works, or they are stuck: there is no password
  // reset in this release on purpose.
  it('points a wrong password at the emailed code, which is the way nobody is locked out', () => {
    expect(failureMessage({ errors: [{ code: 'form_password_incorrect' }] }).message).toContain(
      'code',
    );
  });

  // covers: AC-12
  it('recognises a lost connection from a thrown network error', () => {
    expect(failureMessage({ message: 'Network request failed' })).toEqual(networkFailureMessage);
    expect(failureMessage({ message: 'Failed to fetch' })).toEqual(networkFailureMessage);
  });

  // covers: AC-1. The instance can demand a field this screen never collects
  // (a required password, most often). The email is verified by then, so the
  // sentence has to say the account is the problem and the person is not.
  it('names a blocked sign up instead of hiding it behind "something went wrong"', () => {
    const { message } = messageForCode('sign_up_incomplete');
    expect(message).not.toBe(unknownFailureMessage.message);
    expect(message).toContain('not yours');
  });

  // covers: AC-13. The session ending is the one message that has to reassure
  // as well as explain, because it looks exactly like data loss.
  it('promises nothing is lost when the session ended', () => {
    const { message } = messageForCode('session_ended');
    expect(message).toContain('safe');
    expect(message).toContain('sign in again');
  });

  // covers: AC-12. The guarantee: no provider string ever reaches a person.
  it('never leaks a provider message, whatever is thrown at it', () => {
    const leaky = {
      message: 'Identifier is invalid: param_ident_bad at clerk.internal.v1',
      errors: [{ code: 'some_code_we_have_never_seen' }],
    };
    const result = failureMessage(leaky);

    expect(result).toEqual(unknownFailureMessage);
    expect(result.message).not.toContain('param_ident_bad');
    expect(result.message).not.toContain('clerk');
  });

  // covers: AC-12. No failure is silent, including the ones that are not
  // shaped like errors at all.
  it('still produces a sentence for junk', () => {
    for (const junk of [undefined, null, 'a string', 42, {}, []]) {
      expect(failureMessage(junk).message.length).toBeGreaterThan(0);
    }
  });

  /**
   * The regression fixed on 10 August 2026, and the worse half of it.
   *
   * The sign in door had its own copy of the lost connection rule, and it knew
   * about neither timeouts nor DNS. Someone with no signal pressing Continue
   * was told "Something went wrong signing you in", which reads as the app
   * being broken and gives them nothing to act on, when the true answer was
   * simply that their phone could not reach anything.
   *
   * This is the criterion's actual wording: "a missing network connection"
   * must produce "a specific message a person can act on".
   */
  // covers: AC-12
  it.each([
    'The request timed out',
    'connect ETIMEDOUT 10.0.0.1:443',
    'getaddrinfo ENOTFOUND clerk.accounts.dev',
    'getaddrinfo EAI_AGAIN clerk.accounts.dev',
    'socket hang up',
    'fetch failed',
    'Network request failed',
  ])('tells someone their connection is down when sign in fails with "%s"', (message) => {
    expect(failureMessage({ message })).toEqual(networkFailureMessage);
  });

  // covers: AC-12. The other direction: a real refusal from Clerk must keep
  // its own sentence and never be softened into "check your connection".
  it('does not blame the network for a wrong password', () => {
    const result = failureMessage({ errors: [{ code: 'form_password_incorrect' }] });

    expect(result).not.toEqual(networkFailureMessage);
    expect(result.message).toContain('password');
  });
});

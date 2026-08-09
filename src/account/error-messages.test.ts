import { describe, expect, it } from 'vitest';

import {
  failureMessage,
  isCancellation,
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

  // covers: AC-12. Cancelling the Google sheet is not a failure, and showing
  // anything at all after it reads as a bug.
  it('says nothing at all when the person backed out of a native sheet', () => {
    for (const code of ['sign_in_cancelled', 'user_cancelled', 'oauth_access_denied']) {
      expect(failureMessage({ errors: [{ code }] }).message).toBe('');
    }
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
});

describe('isCancellation', () => {
  it('knows a dismissal from a refusal', () => {
    expect(isCancellation('user_cancelled')).toBe(true);
    expect(isCancellation('form_password_incorrect')).toBe(false);
  });
});

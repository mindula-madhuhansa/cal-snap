import { describe, expect, it } from 'vitest';

import type { SyncOutcome } from '@/data/remote/sync';

import { syncFailureMessage } from './error-messages';
import { endsSession, sessionEndedNotice } from './session-end';

const failed = (failure: 'offline' | 'session-ended' | 'rejected'): SyncOutcome => ({
  kind: 'failed',
  reason: 'foreground',
  failure,
  message: syncFailureMessage(failure).message,
  pushed: 0,
  pulled: 0,
});

describe('endsSession', () => {
  // covers: AC-13. The one failure that has to end the session, because every
  // request after it is refused and carrying on saves nothing.
  it('ends the session when the token was refused', () => {
    expect(endsSession(failed('session-ended'))).toBe(true);
  });

  // covers: AC-13. The rule has to be narrow or it becomes the opposite bug:
  // a tunnel, a lift, or a flat patch of signal throwing somebody back to the
  // door while their meals sit safely on the phone.
  it('does not end the session for a phone with no signal', () => {
    expect(endsSession(failed('offline'))).toBe(false);
  });

  // covers: AC-13. A server that understood and said no is a bug on our side.
  // Signing the person out neither fixes it nor tells them anything true.
  it('does not end the session when the server refused the rows', () => {
    expect(endsSession(failed('rejected'))).toBe(false);
  });

  // covers: AC-13. The ordinary case, asserted so a future change cannot make
  // a successful sync sign anybody out.
  it('leaves a successful sync alone', () => {
    const synced: SyncOutcome = {
      kind: 'synced',
      reason: 'after-write',
      pushed: 3,
      pulled: 0,
    };

    expect(endsSession(synced)).toBe(false);
  });
});

describe('sessionEndedNotice', () => {
  // covers: AC-13. The sentence has to say both halves. Returning somebody to
  // the sign in screen saying only "you were signed out" reads as data loss,
  // and the data was never lost.
  it('says the person was signed out and that their meals are safe', () => {
    const notice = sessionEndedNotice().toLowerCase();

    expect(notice).toContain('signed out');
    expect(notice).toContain('safe');
  });

  // covers: AC-12, AC-13. One event, one sentence. The sign in screen and the
  // sync layer must not describe the same thing two different ways.
  it('is the same sentence sync uses for the same event', () => {
    expect(sessionEndedNotice()).toBe(syncFailureMessage('session-ended').message);
  });
});

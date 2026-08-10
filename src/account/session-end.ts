import type { SyncOutcome } from '@/data/remote/sync';

import { messageForCode } from './error-messages';

/**
 * A session that stops being valid while the app is open (spec 0004, AC-13).
 *
 * This is the one failure the app cannot simply retry past. A token that has
 * been revoked, or that expired without a refresh, means every request from
 * here on is refused, and carrying on would leave someone tapping a screen
 * that quietly saves nothing to their account.
 *
 * Three rules, and the order of them is the whole criterion:
 *
 * 1. **The run in flight finishes first.** Nothing here interrupts a sync, and
 *    nothing here touches the local database. A save already on its way into
 *    the file lands in the file.
 * 2. **The file is kept.** Only a successful push, or the draining deadline,
 *    ever removes a diary from this phone. A session ending is neither, and
 *    the rows this phone still owes the account are the reason.
 * 3. **The person is told why.** Being returned to the sign in screen with no
 *    explanation reads as the app losing their data, which is exactly what did
 *    not happen.
 *
 * Pure, so the rule can be proven without a phone, a clock, or a session.
 */

/**
 * Whether this sync outcome means the session has ended under us.
 *
 * Deliberately narrow. `offline` is a phone in a lift and `rejected` is a bug
 * on our side; neither should sign anybody out, and treating them as if they
 * did would throw people back to the door every time a tunnel swallowed a
 * request.
 */
export const endsSession = (outcome: SyncOutcome): boolean =>
  outcome.kind === 'failed' && outcome.failure === 'session-ended';

/**
 * What the sign in screen says when it was reached this way rather than by
 * signing out.
 *
 * The same sentence the sync layer uses for the same event, read from the one
 * mapping in `error-messages.ts`, so a person is never told two different
 * things about one thing that happened (AC-12, AC-13).
 */
export const sessionEndedNotice = (): string => messageForCode('session_ended').message;

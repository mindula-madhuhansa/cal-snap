import type { SqlDatabase } from '../local/database';

import { pullChanges } from './pull';
import { pushChanges } from './push';
import type { SyncTable } from './tables';
import type { SyncTransport, TransportFailure } from './transport';

/**
 * `runSync`: push what this phone changed, then take what changed elsewhere
 * (spec 0004, API surface).
 *
 * Spec 0002 designed the two halves; this adds only *when* they run and what
 * happens around them. Push comes first on purpose: pulling first would meet
 * the server's older copy of a row this phone has already changed, and the
 * pull would have to refuse it (see `pull.ts`), which just delays the same
 * work by a cycle.
 *
 * Safe to call repeatedly and safe to overlap with a save. Everything it does
 * is an upsert on an identifier the device already minted, so the worst a
 * duplicate run costs is a duplicate request.
 */

/** Why this run happened. Every trigger spec 0004 names (AC-10). */
export type SyncReason = 'sign-in' | 'foreground' | 'after-write' | 'sign-out';

export type SyncOutcome =
  | {
      readonly kind: 'synced';
      readonly reason: SyncReason;
      readonly pushed: number;
      readonly pulled: number;
    }
  | {
      readonly kind: 'failed';
      readonly reason: SyncReason;
      readonly failure: TransportFailure;
      /** A sentence a person could read as it stands. */
      readonly message: string;
      readonly pushed: number;
      readonly pulled: number;
    };

export type SyncOptions = {
  readonly now?: () => string;
  readonly tables?: readonly SyncTable[];
};

export const runSync = async (
  db: SqlDatabase,
  transport: SyncTransport,
  reason: SyncReason,
  options: SyncOptions = {},
): Promise<SyncOutcome> => {
  const push = await pushChanges(db, transport, options);

  if (push.kind === 'failed') {
    return {
      kind: 'failed',
      reason,
      failure: push.reason,
      message: push.message,
      pushed: push.rows,
      pulled: 0,
    };
  }

  // Signing out only needs the work off this phone. Pulling a diary the app
  // is about to delete would be work for nothing.
  if (reason === 'sign-out') {
    return { kind: 'synced', reason, pushed: push.rows, pulled: 0 };
  }

  const pull = await pullChanges(db, transport, options);

  return pull.kind === 'failed'
    ? {
        kind: 'failed',
        reason,
        failure: pull.reason,
        message: pull.message,
        pushed: push.rows,
        pulled: pull.rows,
      }
    : { kind: 'synced', reason, pushed: push.rows, pulled: pull.rows };
};

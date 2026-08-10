import type { SyncStatus } from './sync';

/**
 * What the syncing marker says, seen and heard (spec 0004, AC-9, AC-16).
 *
 * Split out from the component the way the design system splits its decision
 * logic, so both rules can be proven under plain Node with no phone and no
 * renderer in the way.
 *
 * The rule they exist for is the project's rather than this feature's: a
 * health number that is uncertain says so, instead of being presented as fact.
 */

/** The seen label, or nothing at all when there is nothing to say. */
export const syncMarkerLabel = (status: SyncStatus): string | undefined => {
  switch (status.kind) {
    case 'syncing':
      return 'Syncing';
    case 'failed':
      return status.failure === 'offline' ? 'Offline · saved on this phone' : 'Not yet in sync';
    case 'idle':
    case 'settled':
      return undefined;
  }
};

/**
 * The same thing, said rather than shown.
 *
 * The seen label is set tight to sit beside a number. Read aloud it is worse
 * than useless: the middle dot is spoken as "middle dot" or skipped entirely,
 * and "not yet in sync" beside a calorie total does not say the thing a person
 * actually needs to know, which is whether the number in front of them is
 * final. These sentences do.
 */
export const syncMarkerSpokenLabel = (status: SyncStatus): string | undefined => {
  switch (status.kind) {
    case 'syncing':
      return 'Syncing with your account. These numbers may still change.';
    case 'failed':
      return status.failure === 'offline'
        ? 'Offline. These meals are saved on this phone and will reach your account later.'
        : 'Not yet in sync with your account. These numbers may still change.';
    case 'idle':
    case 'settled':
      return undefined;
  }
};

import { Tag } from '@/design-system/components/tag';

import { useSync } from './sync';

/**
 * The quiet marker a screen shows while its numbers may still change
 * (spec 0004, AC-9).
 *
 * The rule it exists for is the project's, not this feature's: a health number
 * that is uncertain says so rather than being presented as fact. A day total
 * with a pull still running is exactly that, and so is one from a phone that
 * could not reach the account at all.
 *
 * It clears on completion, and on failure becomes an offline marker rather
 * than disappearing, because "nothing is showing" reads as "this is settled".
 */

/** What the marker says, or nothing at all when there is nothing to say. */
export const syncMarkerLabel = (
  status: ReturnType<typeof useSync>['status'],
): string | undefined => {
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

export const SyncMarker = () => {
  const { status } = useSync();
  const label = syncMarkerLabel(status);

  return label === undefined ? null : <Tag label={label} tone="outline" testID="sync-marker" />;
};

import { Tag } from '@/design-system/components/tag';

import { useSync } from './sync';
import { syncMarkerLabel, syncMarkerSpokenLabel } from './sync-marker-label';

/**
 * The quiet marker a screen shows while its numbers may still change
 * (spec 0004, AC-9, AC-16).
 *
 * The rule it exists for is the project's, not this feature's: a health number
 * that is uncertain says so rather than being presented as fact. A day total
 * with a pull still running is exactly that, and so is one from a phone that
 * could not reach the account at all.
 *
 * It clears on completion, and on failure becomes an offline marker rather
 * than disappearing, because "nothing is showing" reads as "this is settled".
 *
 * What it says lives in `sync-marker-label.ts`, seen and spoken, so both are
 * pure and testable.
 */

export const SyncMarker = () => {
  const { status } = useSync();
  const label = syncMarkerLabel(status);

  return label === undefined ? null : (
    <Tag
      label={label}
      tone="outline"
      accessibilityLabel={syncMarkerSpokenLabel(status)}
      testID="sync-marker"
    />
  );
};

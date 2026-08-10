import { describe, expect, it } from 'vitest';

import { syncMarkerLabel, syncMarkerSpokenLabel } from './sync-marker-label';
import type { SyncStatus } from './sync';

const failed = (failure: 'offline' | 'session-ended' | 'rejected'): SyncStatus => ({
  kind: 'failed',
  failure,
  message: 'unused here',
});

describe('syncMarkerLabel', () => {
  // covers: AC-9. A number that may still change is never presented as
  // settled, so a run in flight has to be visible.
  it('marks a run in flight', () => {
    expect(syncMarkerLabel({ kind: 'syncing' })).toBe('Syncing');
  });

  // covers: AC-9. The failure case keeps a marker rather than dropping it.
  // Showing nothing reads as "this is settled", which is the opposite of true.
  it('keeps a marker when the run failed', () => {
    expect(syncMarkerLabel(failed('offline'))).toBeDefined();
    expect(syncMarkerLabel(failed('rejected'))).toBeDefined();
  });

  // covers: AC-9. Settled is the one state with nothing to say, and saying
  // nothing is the point: a permanent badge stops meaning anything.
  it('says nothing once the run has settled', () => {
    expect(syncMarkerLabel({ kind: 'settled', at: '2026-08-10T00:00:00.000Z' })).toBeUndefined();
    expect(syncMarkerLabel({ kind: 'idle' })).toBeUndefined();
  });
});

describe('syncMarkerSpokenLabel', () => {
  // covers: AC-16. The seen label carries a middle dot, which a screen reader
  // either names aloud or swallows. Neither is a sentence.
  it('speaks a full sentence rather than the tight visible label', () => {
    const seen = syncMarkerLabel(failed('offline'));
    const spoken = syncMarkerSpokenLabel(failed('offline'));

    expect(spoken).toBeDefined();
    expect(spoken).not.toBe(seen);
    expect(spoken).not.toContain('·');
  });

  // covers: AC-9, AC-16. Whatever a screen reader is told, it has to be told
  // the same thing the screen shows: something to say, or nothing.
  it('appears exactly when the visible marker does', () => {
    const states: readonly SyncStatus[] = [
      { kind: 'idle' },
      { kind: 'syncing' },
      { kind: 'settled', at: '2026-08-10T00:00:00.000Z' },
      failed('offline'),
      failed('session-ended'),
      failed('rejected'),
    ];

    for (const status of states) {
      expect(syncMarkerSpokenLabel(status) === undefined).toBe(
        syncMarkerLabel(status) === undefined,
      );
    }
  });
});

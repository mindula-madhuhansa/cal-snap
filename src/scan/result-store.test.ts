import { beforeEach, describe, expect, it } from 'vitest';

import { forgetScan, readScan, rememberScan } from './result-store';
import type { ScanResult } from './transport';

/**
 * The one piece of module level mutable state in this project (spec 0007,
 * AC-13), so it is worth pinning exactly what it promises and what it does not.
 *
 * Backgrounding the app or navigating away unmounts the capture screen while
 * the request keeps running. React state cannot outlive the component holding
 * it, so the answer goes here first and into state second. Returning shows the
 * result rather than an empty camera.
 *
 * Three promises are asserted below: it holds the last scan, it holds exactly
 * one (a replacement, never a growing cache), and discarding really clears it.
 * The third matters more than it looks: a stale entry left behind would make
 * the next capture open straight onto somebody's previous meal.
 */

const aResult = (kind: 'unrecognised' | 'failed'): ScanResult =>
  kind === 'failed'
    ? { kind: 'failed', reason: 'offline' }
    : {
        kind: 'unrecognised',
        scan: {
          id: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
          model: 'claude-sonnet-5',
          prompt_version: 'v1',
          status: 'unrecognised',
          confidence: null,
          cost_cents: 0.31,
          created_at: '2026-08-11T13:34:03.513Z',
          updated_at: '2026-08-11T13:34:09.675Z',
        },
      };

// The store is module level and really does outlive a test, which is the whole
// point of it. Clearing here is what keeps each test independent.
beforeEach(() => {
  forgetScan();
});

describe('the scan result store', () => {
  it('holds nothing before a scan has finished', () => {
    expect(readScan()).toBeUndefined();
  });

  // covers: AC-13. The answer is put here before the state is set, so it
  // survives a screen that has already gone.
  it('hands back the scan it was given, with the photo behind it', () => {
    const entry = {
      scanId: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
      result: aResult('unrecognised'),
      photoUri: 'file:///cache/scan-1.jpg',
    };

    rememberScan(entry);

    expect(readScan()).toEqual(entry);
  });

  // covers: AC-6, AC-18. A retry re-sends the same photo, so the uri has to
  // come back alongside the result rather than being thrown away with it.
  it('keeps the photo uri, which is what a retry re-sends', () => {
    rememberScan({
      scanId: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
      result: aResult('failed'),
      photoUri: 'file:///cache/scan-1.jpg',
    });

    expect(readScan()?.photoUri).toBe('file:///cache/scan-1.jpg');
  });

  // One entry, not a cache. That is what makes this safe without a lifetime to
  // manage: there is nothing here that can grow.
  it('replaces the older scan rather than accumulating', () => {
    rememberScan({
      scanId: 'first',
      result: aResult('failed'),
      photoUri: 'file:///cache/scan-1.jpg',
    });
    rememberScan({
      scanId: 'second',
      result: aResult('unrecognised'),
      photoUri: 'file:///cache/scan-2.jpg',
    });

    expect(readScan()?.scanId).toBe('second');
    expect(readScan()?.photoUri).toBe('file:///cache/scan-2.jpg');
  });

  // Called when the person discards a result or starts a fresh capture. A
  // stale entry surviving this would greet the next capture with the last meal.
  it('forgets the scan when it is discarded', () => {
    rememberScan({
      scanId: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
      result: aResult('unrecognised'),
      photoUri: 'file:///cache/scan-1.jpg',
    });

    forgetScan();

    expect(readScan()).toBeUndefined();
  });

  it('is safe to forget when there is nothing to forget', () => {
    expect(() => {
      forgetScan();
      forgetScan();
    }).not.toThrow();
    expect(readScan()).toBeUndefined();
  });
});

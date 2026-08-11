import { describe, expect, it } from 'vitest';

import { MAX_EDGE, resizeTarget } from './resize-target';

/**
 * Spec 0007, AC-16: 1024 px on the longest edge, whichever edge that is, and
 * the aspect ratio preserved by constraining only one of them.
 */
describe('resizeTarget', () => {
  // covers: AC-16
  it('constrains the width on a landscape photo', () => {
    expect(resizeTarget({ width: 4032, height: 3024 })).toEqual({ width: MAX_EDGE });
  });

  // covers: AC-16
  it('constrains the height on a portrait photo', () => {
    expect(resizeTarget({ width: 3024, height: 4032 })).toEqual({ height: MAX_EDGE });
  });

  // covers: AC-16. Only one edge is ever given, so the manipulator derives the
  // other and a plate never comes out stretched.
  it('never constrains both edges at once', () => {
    const target = resizeTarget({ width: 4032, height: 3024 });
    expect(Object.keys(target ?? {})).toHaveLength(1);
  });

  // covers: AC-16
  it('constrains the width on a square photo', () => {
    expect(resizeTarget({ width: 2000, height: 2000 })).toEqual({ width: MAX_EDGE });
  });

  // Enlarging adds no detail and costs bytes, so a small photo is left alone.
  it('leaves a photo already within the limit alone', () => {
    expect(resizeTarget({ width: 800, height: 600 })).toBeUndefined();
  });

  it('leaves a photo exactly at the limit alone', () => {
    expect(resizeTarget({ width: MAX_EDGE, height: 768 })).toBeUndefined();
  });

  // covers: AC-16. One pixel over is still over.
  it('resizes a photo one pixel past the limit', () => {
    expect(resizeTarget({ width: MAX_EDGE + 1, height: 10 })).toEqual({ width: MAX_EDGE });
  });

  // A dimension the device reported as nonsense must not become a resize to
  // nonsense. Leaving it alone means the photo still goes, just unshrunk.
  it.each([
    { width: 0, height: 100 },
    { width: 100, height: 0 },
    { width: -1, height: 100 },
    { width: Number.NaN, height: 100 },
    { width: Number.POSITIVE_INFINITY, height: 100 },
  ])('leaves an unusable size alone (%o)', (source) => {
    expect(resizeTarget(source)).toBeUndefined();
  });
});

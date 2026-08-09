import { describe, expect, it } from 'vitest';

import { motionDuration } from './motion-duration';
import { motion } from './theme';

describe('motionDuration', () => {
  it('runs an animation for its own duration when motion is allowed', () => {
    expect(motionDuration(motion.duration.base, false)).toBe(motion.duration.base);
    expect(motionDuration(motion.loop.sweep, false)).toBe(motion.loop.sweep);
  });

  // covers: AC-9. Every duration in the system, not a chosen few.
  it('collapses every duration to instant when motion is reduced', () => {
    const everyDuration = [
      ...Object.values(motion.duration),
      ...Object.values(motion.loop),
    ] as readonly number[];

    for (const duration of everyDuration) {
      expect(motionDuration(duration, true)).toBe(motion.duration.instant);
    }
  });

  it('leaves an already instant duration alone either way', () => {
    expect(motionDuration(motion.duration.instant, false)).toBe(motion.duration.instant);
    expect(motionDuration(motion.duration.instant, true)).toBe(motion.duration.instant);
  });
});

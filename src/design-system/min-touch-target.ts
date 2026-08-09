/**
 * The accessibility floor under every tappable thing (spec 0003, AC-3).
 *
 * The design draws some controls small on purpose: the stepper's minus and
 * plus are 30 by 28, the radio dot is 15 across. What a finger can hit is a
 * separate question from what the eye sees, so the drawn size stays as
 * designed and the hit area is grown around it to `minTouchTarget`.
 */

import { minTouchTarget, space } from './theme';

/** Extra tappable area around a control, in points on each edge. */
export type HitSlop = {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
};

/** Points, rounded to a hundredth: the space scale is 4.6 apart, so halves are not whole. */
const toPoints = (value: number): number => Math.round(value * 100) / 100;

/** The slop needed on each edge of one axis to reach `minTouchTarget`. */
const slopFor = (drawn: number): number => {
  if (!Number.isFinite(drawn) || drawn >= minTouchTarget) {
    return 0;
  }
  return toPoints(Math.max(minTouchTarget - drawn, 0) / 2);
};

/**
 * The hit area for a control drawn at `width` by `height`.
 *
 * Something already at or over 44 in an axis gets no slop in that axis, which
 * matters more than it sounds: slop is not clipped by the parent, so handing
 * it out freely is how two neighbouring controls end up stealing each other's
 * taps.
 */
export const withMinTouchTarget = (width: number, height: number): HitSlop => {
  const horizontal = slopFor(width);
  const vertical = slopFor(height);

  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
};

/**
 * The smallest gap two neighbouring tappables may sit at, so their grown hit
 * areas never overlap and no tap is captured by the wrong sibling.
 */
export const minTappableGap = space[2];

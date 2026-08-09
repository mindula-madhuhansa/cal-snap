import { describe, expect, it } from 'vitest';

import { minTappableGap, withMinTouchTarget } from './min-touch-target';
import { minTouchTarget, space } from './theme';

/** What the control plus its slop actually measures, in each axis. */
const measured = (width: number, height: number) => {
  const slop = withMinTouchTarget(width, height);

  return {
    width: width + slop.left + slop.right,
    height: height + slop.top + slop.bottom,
  };
};

describe('withMinTouchTarget', () => {
  // covers: AC-3. The three sizes the design actually draws small.
  it('grows the stepper button to the floor in both axes', () => {
    expect(measured(30, 28)).toEqual({ width: minTouchTarget, height: minTouchTarget });
  });

  it('grows a small square icon button to the floor', () => {
    expect(measured(26, 26)).toEqual({ width: minTouchTarget, height: minTouchTarget });
  });

  it('grows the radio dot to the floor', () => {
    expect(measured(15, 15)).toEqual({ width: minTouchTarget, height: minTouchTarget });
  });

  // covers: AC-3. Slop is not clipped by the parent, so handing it out to a
  // control that does not need it is how neighbours steal each other's taps.
  it('returns no slop for a control already at or over the floor', () => {
    expect(withMinTouchTarget(48, 48)).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    expect(withMinTouchTarget(minTouchTarget, minTouchTarget)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });

  it('grows only the axis that falls short', () => {
    expect(withMinTouchTarget(80, 20)).toEqual({ top: 12, bottom: 12, left: 0, right: 0 });
    expect(withMinTouchTarget(20, 80)).toEqual({ top: 0, bottom: 0, left: 12, right: 12 });
  });

  it('splits the slop evenly, so the drawn control stays centred in its target', () => {
    const slop = withMinTouchTarget(31, 27);

    expect(slop.left).toBe(slop.right);
    expect(slop.top).toBe(slop.bottom);
  });

  it('treats a nonsense size as needing no slop rather than producing NaN', () => {
    expect(withMinTouchTarget(Number.NaN, Number.NaN)).toEqual({
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    });
  });
});

describe('minTappableGap', () => {
  it('is a step of the space scale, not a number somebody picked', () => {
    expect(minTappableGap).toBe(space[2]);
  });
});

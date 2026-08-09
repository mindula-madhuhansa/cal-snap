/**
 * The one place the system font size setting is applied (spec 0003, AC-4).
 *
 * React Native would happily scale text a second time on its own, so every
 * `Text` in the design system sets `allowFontScaling={false}` and passes its
 * step through here instead. Scaling in one place is what makes the result
 * predictable: the size the function returns is the size that gets drawn.
 */

import { type } from './theme';

/** One step of the type scale, as `theme.type` stores them. */
export type TypeStep = {
  readonly fontFamily: string;
  readonly fontSize: number;
  readonly lineHeight: number;
  readonly letterSpacing?: number;
};

/** Points, rounded to a hundredth so binary floating point noise never lands in a style. */
const toPoints = (value: number): number => Math.round(value * 100) / 100;

/**
 * The multiplier `scaleTypeStep` will really use, given what the system
 * reports.
 *
 * Held between 1 and `type.fontScaleCap`:
 *
 * - The floor is 1 because the design already sits at the small end of the
 *   scale (a 10 point kicker), and shrinking it further makes it unreadable
 *   for everyone rather than more comfortable for anyone.
 * - The ceiling is `fontScaleCap` because past it the design's long headings
 *   clip on a small phone.
 *
 * A missing or nonsense value (`NaN`, infinity) reads as 1, so a bad number
 * from the platform can never blank a screen.
 */
export const resolveFontScale = (fontScale: number): number => {
  if (!Number.isFinite(fontScale)) {
    return 1;
  }
  return Math.min(Math.max(fontScale, 1), type.fontScaleCap);
};

/**
 * Grow a type step by the system font scale.
 *
 * `fontSize` and `lineHeight` scale together, so their ratio holds and a
 * paragraph stays as airy at 1.6 as it is at 1. `letterSpacing` scales with
 * them because the CSS the scale was ported from expressed tracking in `em`,
 * which is proportional to size by definition; leaving it fixed would make
 * large text look progressively tighter than the design.
 */
export const scaleTypeStep = (step: TypeStep, fontScale: number): TypeStep => {
  const multiplier = resolveFontScale(fontScale);

  return {
    fontFamily: step.fontFamily,
    fontSize: toPoints(step.fontSize * multiplier),
    lineHeight: toPoints(step.lineHeight * multiplier),
    ...(step.letterSpacing === undefined
      ? {}
      : { letterSpacing: toPoints(step.letterSpacing * multiplier) }),
  };
};

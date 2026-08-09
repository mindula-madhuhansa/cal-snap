import { describe, expect, it } from 'vitest';

import { MACRO_SCALE, roundCalories, roundMacro, roundToScale } from './rounding';

describe('roundToScale', () => {
  it('rounds to the number of decimal places asked for', () => {
    expect(roundToScale(12.34567, 1)).toBe(12.3);
    expect(roundToScale(12.34567, 2)).toBe(12.35);
    expect(roundToScale(12.34567, 0)).toBe(12);
  });

  // covers: AC-13. This is the case that makes the whole function necessary:
  // 2.675 * 100 is 267.49999999999997 in binary floating point, so a naive
  // Math.round sends it down to 2.67 instead of up to 2.68.
  it('rounds a value that binary floating point represents just below the halfway point', () => {
    expect(roundToScale(2.675, 2)).toBe(2.68);
    expect(roundToScale(1.005, 2)).toBe(1.01);
    expect(roundToScale(8.165, 2)).toBe(8.17);
  });

  it('leaves a value that already has fewer decimals untouched', () => {
    expect(roundToScale(45, 1)).toBe(45);
    expect(roundToScale(0.5, 1)).toBe(0.5);
  });

  it('handles zero and negative values', () => {
    expect(roundToScale(0, 1)).toBe(0);
    expect(roundToScale(-2.34, 1)).toBe(-2.3);
  });

  it('returns zero rather than NaN or Infinity, so a bad number never reaches a screen', () => {
    expect(roundToScale(Number.NaN, 1)).toBe(0);
    expect(roundToScale(Number.POSITIVE_INFINITY, 1)).toBe(0);
    expect(roundToScale(Number.NEGATIVE_INFINITY, 1)).toBe(0);
  });
});

describe('roundMacro', () => {
  // covers: AC-13
  it('rounds macro grams to one decimal place, the scale both databases use', () => {
    expect(MACRO_SCALE).toBe(1);
    expect(roundMacro(28.24)).toBe(28.2);
    expect(roundMacro(28.25)).toBe(28.3);
    expect(roundMacro(0.04)).toBe(0);
  });

  // covers: AC-13. numeric(6,1) tops out at 99999.9, so anything the app can
  // legitimately store must survive the round trip.
  it('keeps a value at the top of the numeric(6,1) range exact', () => {
    expect(roundMacro(99999.9)).toBe(99999.9);
  });
});

describe('roundCalories', () => {
  it('rounds calories to a whole number', () => {
    expect(roundCalories(233.4)).toBe(233);
    expect(roundCalories(233.5)).toBe(234);
    expect(roundCalories(0.4)).toBe(0);
  });

  it('rounds a value binary floating point puts just under the halfway point', () => {
    expect(roundCalories(0.1 + 0.2 + 233.2)).toBe(234);
  });
});

import { describe, expect, it } from 'vitest';

import { resolveFontScale, scaleTypeStep } from './scale-type-step';
import { type } from './theme';

describe('resolveFontScale', () => {
  it('passes a normal scale straight through', () => {
    expect(resolveFontScale(1)).toBe(1);
    expect(resolveFontScale(1.3)).toBe(1.3);
  });

  // covers: AC-4
  it('clamps at the cap, so a huge system setting cannot clip the design', () => {
    expect(resolveFontScale(1.6)).toBe(1.6);
    expect(resolveFontScale(3)).toBe(type.fontScaleCap);
    expect(resolveFontScale(10)).toBe(type.fontScaleCap);
  });

  it('never shrinks below the designed size', () => {
    expect(resolveFontScale(0.85)).toBe(1);
    expect(resolveFontScale(0)).toBe(1);
    expect(resolveFontScale(-2)).toBe(1);
  });

  it('reads a nonsense value as 1 rather than blanking a screen', () => {
    expect(resolveFontScale(Number.NaN)).toBe(1);
    expect(resolveFontScale(Number.POSITIVE_INFINITY)).toBe(1);
    expect(resolveFontScale(Number.NEGATIVE_INFINITY)).toBe(1);
  });
});

describe('scaleTypeStep', () => {
  it('leaves a step untouched at scale 1', () => {
    expect(scaleTypeStep(type.body, 1)).toEqual({
      fontFamily: type.body.fontFamily,
      fontSize: 15,
      lineHeight: 23,
    });
  });

  // covers: AC-4. The ratio is the whole point: text that grows without its
  // leading growing with it ends up overlapping the line beneath.
  it('scales size and line height together, so their ratio holds', () => {
    const base = type.body;
    const scaled = scaleTypeStep(base, 1.5);

    expect(scaled.fontSize).toBe(22.5);
    expect(scaled.lineHeight).toBe(34.5);
    expect(scaled.lineHeight / scaled.fontSize).toBeCloseTo(base.lineHeight / base.fontSize, 10);
  });

  // covers: AC-4
  it('stops growing at the cap', () => {
    expect(scaleTypeStep(type.h1, 1.6)).toEqual(scaleTypeStep(type.h1, 3));
    expect(scaleTypeStep(type.h1, 1.6).fontSize).toBe(48);
  });

  it('scales tracking with the size, because the scale expresses it in em', () => {
    const scaled = scaleTypeStep(type.h1, 1.6);

    expect(scaled.letterSpacing).toBe(-0.96);
  });

  it('leaves tracking off a step that has none', () => {
    expect(scaleTypeStep(type.body, 1.6).letterSpacing).toBeUndefined();
  });

  it('keeps the font family, so a step never loses its face on the way through', () => {
    expect(scaleTypeStep(type.h3, 1.4).fontFamily).toBe(type.h3.fontFamily);
    expect(scaleTypeStep(type.caption, 1.4).fontFamily).toBe(type.caption.fontFamily);
  });

  it('rounds to a hundredth, so floating point noise never reaches a style', () => {
    // 56 * 1.6 is 89.60000000000001 in binary floating point, and -1.6 * 1.6
    // is -2.5600000000000005. Both reach a style rounded.
    expect(scaleTypeStep(type.display, 1.6).fontSize).toBe(89.6);
    expect(scaleTypeStep(type.display, 1.6).letterSpacing).toBe(-2.56);
  });
});

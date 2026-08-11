import { describe, expect, it } from 'vitest';

import { colors, radii, space } from '../theme';
import {
  DISABLED_OPACITY,
  PRESSED_GRADIENT_OPACITY,
  buttonVariantStyle,
  type ButtonVariant,
} from './button-variant';

const ALL_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];

describe('buttonVariantStyle', () => {
  // A button's label is small text, so it owes 4.5:1. `textDim` is 3.83 on the
  // ground and is therefore never allowed to carry one.
  it('never sets a label in the one value that misses the small-text floor', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).text).not.toBe(colors.textDim);
      expect(buttonVariantStyle(variant, true).text).not.toBe(colors.textDim);
    }
  });

  // A control's visible boundary owes 3:1, and `border` is 1.25.
  it('never bounds a button in the decorative rule colour', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).border).not.toBe(colors.border);
    }
  });

  // The primary action is the design's one gradient. The flag is how the
  // component knows to draw it, since a gradient is not something a style
  // object can hold.
  it('marks primary as the gradient variant, and nothing else', () => {
    expect(buttonVariantStyle('primary', false).gradient).toBe(true);

    for (const variant of ALL_VARIANTS.filter((each) => each !== 'primary')) {
      expect(buttonVariantStyle(variant, false).gradient).toBe(false);
    }
  });

  // Words on the gradient are the ground itself, which is 11.75 on the cyan
  // end and 5.88 on the violet end.
  it('sets primary’s words in the ground, and leaves its own background clear', () => {
    const style = buttonVariantStyle('primary', false);

    expect(style.text).toBe(colors.textOnAccent);
    expect(style.border).toBe('transparent');
    expect(style.background).toBe('transparent');
  });

  it('draws secondary as plain text on a filled surface', () => {
    const style = buttonVariantStyle('secondary', false);

    expect(style.text).toBe(colors.text);
    expect(style.background).toBe(colors.surface);
    expect(style.border).toBe(colors.borderStrong);
  });

  it('gives ghost no border at all, and pulls its side padding in', () => {
    const ghost = buttonVariantStyle('ghost', false);
    const primary = buttonVariantStyle('primary', false);

    expect(ghost.border).toBe('transparent');
    expect(ghost.paddingHorizontal).toBeLessThan(primary.paddingHorizontal);
  });

  // The destructive variant is the one place red is a label rather than a
  // mark, so it is worth pinning that it really is the red.
  it('says a destructive action in red', () => {
    expect(buttonVariantStyle('danger', false).text).toBe(colors.red);
  });

  it('changes the ground when pressed, for every variant that has one', () => {
    for (const variant of ALL_VARIANTS) {
      const resting = buttonVariantStyle(variant, false);
      const held = buttonVariantStyle(variant, true);

      // Primary carries no background of its own: the gradient above it is
      // what fades, so its style object is the same either way.
      if (resting.gradient) {
        expect(held.background).toBe(resting.background);
      } else {
        expect(held.background).not.toBe(resting.background);
      }
    }
  });

  it('gives each variant the pressed tint that belongs to it', () => {
    expect(buttonVariantStyle('secondary', true).background).toBe(colors.pressed.surface);
    expect(buttonVariantStyle('ghost', true).background).toBe(colors.pressed.ghost);
    expect(buttonVariantStyle('danger', true).background).toBe(colors.wash.red);
  });

  it('takes its radius and padding from the scale rather than from a number', () => {
    for (const variant of ALL_VARIANTS) {
      const style = buttonVariantStyle(variant, false);

      expect(style.borderRadius).toBe(radii.full);
      expect(Object.values(space)).toContain(style.paddingHorizontal);
    }
  });

  it('dims a disabled button, and fades a held gradient, without hiding either', () => {
    expect(DISABLED_OPACITY).toBeGreaterThan(0);
    expect(DISABLED_OPACITY).toBeLessThan(1);
    expect(PRESSED_GRADIENT_OPACITY).toBeGreaterThan(DISABLED_OPACITY);
    expect(PRESSED_GRADIENT_OPACITY).toBeLessThan(1);
  });
});

import { describe, expect, it } from 'vitest';

import { colors, radii } from '../theme';
import { DISABLED_OPACITY, buttonVariantStyle, type ButtonVariant } from './button-variant';

const ALL_VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost'];

describe('buttonVariantStyle', () => {
  // covers: AC-2. A button's label is small text, so it owes 4.5:1. `accent`
  // gives 3.02 and is therefore never allowed to carry one.
  it('never sets a label in the brighter gold, whatever the variant or state', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).text).not.toBe(colors.accent);
      expect(buttonVariantStyle(variant, true).text).not.toBe(colors.accent);
    }
  });

  // covers: AC-2. A control's visible boundary owes 3:1, and `divider` is 1.38.
  it('never bounds a button in the decorative divider', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).border).not.toBe(colors.divider);
    }
  });

  it('draws primary as gold words inside a gold border', () => {
    const style = buttonVariantStyle('primary', false);

    expect(style.text).toBe(colors.accentText);
    expect(style.border).toBe(colors.accent);
    expect(style.background).toBe('transparent');
  });

  it('draws secondary as plain ink inside a bounded edge', () => {
    expect(buttonVariantStyle('secondary', false).text).toBe(colors.text);
  });

  it('gives ghost no border at all, and pulls its side padding in', () => {
    const ghost = buttonVariantStyle('ghost', false);
    const primary = buttonVariantStyle('primary', false);

    expect(ghost.border).toBe('transparent');
    expect(ghost.paddingHorizontal).toBeLessThan(primary.paddingHorizontal);
  });

  it('tints the ground when pressed, and only then', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).background).toBe('transparent');
      expect(buttonVariantStyle(variant, true).background).not.toBe('transparent');
    }
  });

  it('gives each variant the pressed tint that belongs to it', () => {
    expect(buttonVariantStyle('primary', true).background).toBe(colors.pressed.accent);
    expect(buttonVariantStyle('secondary', true).background).toBe(colors.pressed.neutral);
    expect(buttonVariantStyle('ghost', true).background).toBe(colors.pressed.ghost);
  });

  // covers: AC-14
  it('takes its radius from the scale rather than from a number', () => {
    for (const variant of ALL_VARIANTS) {
      expect(buttonVariantStyle(variant, false).borderRadius).toBe(radii.md);
    }
  });

  it('dims a disabled button exactly as the design does', () => {
    expect(DISABLED_OPACITY).toBe(0.45);
  });
});

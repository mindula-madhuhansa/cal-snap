import { describe, expect, it } from 'vitest';

import { caloriesLabel, itemSpoken, macroLine, portionLabel, totalCalories } from './format-item';
import type { ScannedItem } from './transport';

/**
 * Spec 0007, AC-1. The numbers a person reads, rounded exactly the way the rest
 * of the app rounds them, so nothing changes between seeing a figure and (in
 * feature 8) keeping it.
 */

const item = (over: Partial<ScannedItem> = {}): ScannedItem => ({
  name: 'Grilled chicken',
  quantity: 120,
  unit: 'g',
  calories: 198.4,
  protein_g: 37.24,
  carbs_g: 0,
  fat_g: 4.35,
  confidence: 'high',
  ...over,
});

describe('portionLabel', () => {
  // covers: AC-1. A quantity plus one of the three units.
  it('writes grams and millilitres with their unit', () => {
    expect(portionLabel(item({ quantity: 120, unit: 'g' }))).toBe('120 g');
    expect(portionLabel(item({ quantity: 250, unit: 'ml' }))).toBe('250 ml');
  });

  // "1 pieces" is the kind of small wrongness that makes an app feel machine
  // written, so the singular is spelled out.
  it('says one piece, and more than one pieces', () => {
    expect(portionLabel(item({ quantity: 1, unit: 'piece' }))).toBe('1 piece');
    expect(portionLabel(item({ quantity: 3, unit: 'piece' }))).toBe('3 pieces');
  });

  it('keeps a fractional quantity to one decimal', () => {
    expect(portionLabel(item({ quantity: 1.5, unit: 'piece' }))).toBe('1.5 pieces');
    expect(portionLabel(item({ quantity: 82.46, unit: 'g' }))).toBe('82.5 g');
  });

  // A whole number never grows a pointless `.0`.
  it('drops a trailing zero decimal', () => {
    expect(portionLabel(item({ quantity: 120.0, unit: 'g' }))).toBe('120 g');
  });
});

describe('macroLine and caloriesLabel', () => {
  // covers: AC-1. Macros to one decimal, calories whole, which is the rule
  // `calculations/rounding.ts` holds for both databases.
  it('rounds macros to one decimal and calories to a whole number', () => {
    expect(macroLine(item())).toBe('P37.2 C0.0 F4.4');
    expect(caloriesLabel(item())).toBe('198');
  });

  // The float rounding trap `roundToScale` exists to close: 2.675 must go up.
  it('rounds a value binary floating point would round down', () => {
    expect(macroLine(item({ protein_g: 2.675, carbs_g: 0, fat_g: 0 }))).toBe('P2.7 C0.0 F0.0');
  });
});

describe('totalCalories', () => {
  // covers: AC-1
  it('sums the plate to a whole number', () => {
    expect(totalCalories([item({ calories: 198.4 }), item({ calories: 121.7 })])).toBe(320);
  });

  it('is zero for an empty plate', () => {
    expect(totalCalories([])).toBe(0);
  });
});

describe('itemSpoken', () => {
  // The visible row is a dense mono line (`120 g · P37.2 C0.0 F4.4`), which
  // reads badly aloud, so the spoken version is a sentence instead.
  it('reads as a sentence rather than the dense line', () => {
    const spoken = itemSpoken(item());
    expect(spoken).toContain('Grilled chicken, 120 g, 198 calories');
    expect(spoken).toContain('grams protein');
    expect(spoken).not.toContain('P37.2');
  });
});

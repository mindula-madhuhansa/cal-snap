import { roundCalories, roundMacro } from '@/data/calculations/rounding';

import type { ScannedItem } from './transport';

/**
 * How a scanned item reads on screen (spec 0007, AC-1).
 *
 * Pure, and rounded exactly the way the rest of the app rounds: calories whole,
 * macros to one decimal, through `calculations/rounding.ts`. That matters even
 * though nothing is saved here, because feature 8 writes these same numbers and
 * a person must not watch the figure change between seeing it and keeping it.
 */

/** `120 g`, `1 piece`, `250 ml`. Quantity is rounded the way a macro is. */
export const portionLabel = (item: ScannedItem): string => {
  const quantity = roundMacro(item.quantity);
  const amount = Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);

  if (item.unit !== 'piece') return `${amount} ${item.unit}`;
  return quantity === 1 ? '1 piece' : `${amount} pieces`;
};

/** The dense mono line under a name: `P24.0 C58.0 F9.0`. */
export const macroLine = (item: ScannedItem): string =>
  `P${roundMacro(item.protein_g).toFixed(1)} C${roundMacro(item.carbs_g).toFixed(1)} F${roundMacro(item.fat_g).toFixed(1)}`;

export const caloriesLabel = (item: ScannedItem): string => String(roundCalories(item.calories));

/** What a screen reader says for one row, as a sentence rather than a code. */
export const itemSpoken = (item: ScannedItem): string =>
  `${item.name}, ${portionLabel(item)}, ${roundCalories(item.calories)} calories, ` +
  `${roundMacro(item.protein_g).toFixed(1)} grams protein, ` +
  `${roundMacro(item.carbs_g).toFixed(1)} grams carbs, ` +
  `${roundMacro(item.fat_g).toFixed(1)} grams fat`;

/** The day's running total for the scanned plate. */
export const totalCalories = (items: readonly ScannedItem[]): number =>
  roundCalories(items.reduce((sum, item) => sum + item.calories, 0));

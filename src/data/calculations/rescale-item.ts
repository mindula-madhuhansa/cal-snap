import { roundCalories, roundMacro } from './rounding';

/**
 * Portion rescaling. Pure, and the one place the resolved nutrition numbers
 * on a meal item are ever computed (AC-6).
 *
 * Every recompute starts from the stored `base*` rate, never from the last
 * resolved value, so 180g to 250g and back to 180g returns exactly the
 * original numbers with no compounding drift.
 */

/** The resolved fields a user can type over by hand. */
export const RESCALABLE_FIELDS = ['calories', 'protein_g', 'carbs_g', 'fat_g'] as const;

export type RescalableField = (typeof RESCALABLE_FIELDS)[number];

export type ItemRate = {
  /** The amount the base numbers describe, for example 100 (grams). */
  readonly basePer: number;
  readonly baseCalories: number;
  readonly baseProteinG: number;
  readonly baseCarbsG: number;
  readonly baseFatG: number;
};

export type ResolvedNutrition = {
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
};

export type RescaleResult =
  | { readonly kind: 'ok'; readonly nutrition: ResolvedNutrition }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * `edited_fields` is stored as a comma separated list because it is read far
 * more often than it is written and never queried against. Null and an empty
 * string both mean nothing was typed.
 */
export const parseEditedFields = (stored: string | null): readonly RescalableField[] => {
  if (stored === null || stored.trim() === '') return [];
  const named = stored.split(',').map((field) => field.trim());
  return RESCALABLE_FIELDS.filter((field) => named.includes(field));
};

export const serialiseEditedFields = (fields: readonly RescalableField[]): string | null => {
  const kept = RESCALABLE_FIELDS.filter((field) => fields.includes(field));
  return kept.length === 0 ? null : kept.join(',');
};

/** Records that the user typed one field by hand, so it stops rescaling. */
export const markFieldEdited = (stored: string | null, field: RescalableField): string | null =>
  serialiseEditedFields([...parseEditedFields(stored), field]);

/**
 * The resolved numbers for `quantity` of this item.
 *
 * `keep` names the fields the user typed by hand: those hold their current
 * value while everything else rescales. That is why `source` alone is not
 * enough, and why the item carries `edited_fields`.
 */
export const rescaleItem = (
  rate: ItemRate,
  quantity: number,
  current: ResolvedNutrition,
  keep: readonly RescalableField[] = [],
): RescaleResult => {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { kind: 'failed', message: 'A portion has to be greater than zero.' };
  }
  if (!Number.isFinite(rate.basePer) || rate.basePer <= 0) {
    return { kind: 'failed', message: 'This item has no usable base portion to scale from.' };
  }

  const factor = quantity / rate.basePer;
  const held = (field: RescalableField): boolean => keep.includes(field);

  return {
    kind: 'ok',
    nutrition: {
      calories: held('calories') ? current.calories : roundCalories(rate.baseCalories * factor),
      proteinG: held('protein_g') ? current.proteinG : roundMacro(rate.baseProteinG * factor),
      carbsG: held('carbs_g') ? current.carbsG : roundMacro(rate.baseCarbsG * factor),
      fatG: held('fat_g') ? current.fatG : roundMacro(rate.baseFatG * factor),
    },
  };
};

/**
 * The one way `source` moves. An item that came from a scan becomes
 * `ai_edited` the first time a value is typed over; a hand entered item stays
 * `manual` and never becomes a scan (spec 0002, state transitions).
 */
export type ItemSource = 'ai_scan' | 'manual' | 'ai_edited';

export const sourceAfterEdit = (source: ItemSource): ItemSource =>
  source === 'ai_scan' ? 'ai_edited' : source;

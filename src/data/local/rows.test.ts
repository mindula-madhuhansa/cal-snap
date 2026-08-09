import { describe, expect, it } from 'vitest';

import { nowIso, optional, toMealItem, type MealItemRow } from './rows';

const aRow = (overrides: Partial<MealItemRow> = {}): MealItemRow => ({
  id: 'item-1',
  meal_id: 'meal-1',
  user_id: 'user-1',
  name: 'Rice',
  position: 0,
  base_per: 100,
  base_unit: 'g',
  base_calories: 130,
  base_protein_g: 2.7,
  base_carbs_g: 28.2,
  base_fat_g: 0.3,
  quantity: 200,
  calories: 260,
  protein_g: 5.4,
  carbs_g: 56.4,
  fat_g: 0.6,
  source: 'ai_scan',
  edited_fields: null,
  confidence: 'high',
  ...overrides,
});

describe('toMealItem', () => {
  it('maps every column into its camel case field', () => {
    expect(toMealItem(aRow())).toEqual({
      id: 'item-1',
      mealId: 'meal-1',
      name: 'Rice',
      position: 0,
      basePer: 100,
      baseUnit: 'g',
      baseCalories: 130,
      baseProteinG: 2.7,
      baseCarbsG: 28.2,
      baseFatG: 0.3,
      quantity: 200,
      calories: 260,
      proteinG: 5.4,
      carbsG: 56.4,
      fatG: 0.6,
      source: 'ai_scan',
      editedFields: [],
      confidence: 'high',
    });
  });

  // The domain avoids null: an absent confidence is a missing key, not a null,
  // so nothing downstream has to guard against two kinds of empty.
  it('omits confidence entirely when the column is null', () => {
    const item = toMealItem(aRow({ confidence: null }));
    expect('confidence' in item).toBe(false);
  });

  // covers: AC-6
  it('reads the edited fields list into an array', () => {
    expect(toMealItem(aRow({ edited_fields: 'calories,fat_g' })).editedFields).toEqual([
      'calories',
      'fat_g',
    ]);
  });

  it('reads a null edited fields column as an empty array', () => {
    expect(toMealItem(aRow({ edited_fields: null })).editedFields).toEqual([]);
  });

  it('does not leak the user id into the domain shape', () => {
    expect('userId' in toMealItem(aRow())).toBe(false);
  });
});

describe('optional', () => {
  it('turns null into undefined', () => {
    expect(optional(null)).toBeUndefined();
  });

  it('leaves a value alone', () => {
    expect(optional('kept')).toBe('kept');
    expect(optional(0)).toBe(0);
  });
});

describe('nowIso', () => {
  it('writes an ISO 8601 instant in UTC', () => {
    expect(nowIso(new Date('2026-08-09T18:20:00Z'))).toBe('2026-08-09T18:20:00.000Z');
  });

  // Timestamps sort as text in SQLite, so the format has to be one that sorts
  // in the same order as time.
  it('produces values that sort chronologically as plain strings', () => {
    const earlier = nowIso(new Date('2026-08-09T08:00:00Z'));
    const later = nowIso(new Date('2026-08-09T19:00:00Z'));
    expect([later, earlier].sort()).toEqual([earlier, later]);
  });
});

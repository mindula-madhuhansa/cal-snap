import { describe, expect, it } from 'vitest';

import {
  markFieldEdited,
  parseEditedFields,
  rescaleItem,
  serialiseEditedFields,
  sourceAfterEdit,
  type ItemRate,
  type ResolvedNutrition,
} from './rescale-item';

const rate: ItemRate = {
  basePer: 100,
  baseCalories: 130,
  baseProteinG: 2.7,
  baseCarbsG: 28.2,
  baseFatG: 0.3,
};

const zero: ResolvedNutrition = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

const unwrap = (result: ReturnType<typeof rescaleItem>): ResolvedNutrition => {
  if (result.kind === 'failed') throw new Error(`expected ok, got: ${result.message}`);
  return result.nutrition;
};

describe('rescaleItem', () => {
  // covers: AC-6
  it('scales every value from the base rate', () => {
    expect(unwrap(rescaleItem(rate, 200, zero))).toEqual({
      calories: 260,
      proteinG: 5.4,
      carbsG: 56.4,
      fatG: 0.6,
    });
  });

  it('returns the base numbers unchanged when the quantity equals the base portion', () => {
    expect(unwrap(rescaleItem(rate, 100, zero))).toEqual({
      calories: 130,
      proteinG: 2.7,
      carbsG: 28.2,
      fatG: 0.3,
    });
  });

  // covers: AC-6. The whole reason the base rate is stored rather than the
  // last resolved value. If rescaling ever fed its own output back in, this
  // would drift.
  it('returns exactly the original numbers after changing the portion and changing it back', () => {
    const first = unwrap(rescaleItem(rate, 180, zero));
    const changed = unwrap(rescaleItem(rate, 250, zero));
    const back = unwrap(rescaleItem(rate, 180, zero));

    expect(back).toEqual(first);
    expect(changed).not.toEqual(first);
  });

  // covers: AC-6
  it('does not drift across many repeated changes', () => {
    const start = unwrap(rescaleItem(rate, 180, zero));
    for (const quantity of [250, 75, 1000, 33.3, 180, 900, 180]) {
      unwrap(rescaleItem(rate, quantity, zero));
    }
    expect(unwrap(rescaleItem(rate, 180, zero))).toEqual(start);
  });

  it('scales a piece based item, where the base portion is 1', () => {
    const perPiece: ItemRate = {
      basePer: 1,
      baseCalories: 37,
      baseProteinG: 1.6,
      baseCarbsG: 5.5,
      baseFatG: 0.9,
    };
    expect(unwrap(rescaleItem(perPiece, 3, zero))).toEqual({
      calories: 111,
      proteinG: 4.8,
      carbsG: 16.5,
      fatG: 2.7,
    });
  });

  it('handles a fractional portion', () => {
    expect(unwrap(rescaleItem(rate, 50, zero)).calories).toBe(65);
  });

  // covers: AC-6, AC-8
  it('keeps a hand typed field at its typed value while the rest rescale', () => {
    const current: ResolvedNutrition = { calories: 400, proteinG: 0, carbsG: 0, fatG: 0 };
    const result = unwrap(rescaleItem(rate, 250, current, ['calories']));

    expect(result.calories).toBe(400);
    expect(result.carbsG).toBe(70.5);
    expect(result.proteinG).toBe(6.8);
  });

  it('keeps several hand typed fields at once', () => {
    const current: ResolvedNutrition = { calories: 400, proteinG: 9, carbsG: 0, fatG: 0 };
    const result = unwrap(rescaleItem(rate, 250, current, ['calories', 'protein_g']));

    expect(result.calories).toBe(400);
    expect(result.proteinG).toBe(9);
    expect(result.carbsG).toBe(70.5);
  });

  it('rescales everything when no field was typed', () => {
    const current: ResolvedNutrition = { calories: 400, proteinG: 9, carbsG: 9, fatG: 9 };
    expect(unwrap(rescaleItem(rate, 100, current, []))).toEqual({
      calories: 130,
      proteinG: 2.7,
      carbsG: 28.2,
      fatG: 0.3,
    });
  });

  // covers: AC-13. Macros land on one decimal, calories on a whole number,
  // because that is what keeps SQLite REAL equal to Postgres numeric(6,1).
  it('rounds macros to one decimal and calories to a whole number', () => {
    const awkward: ItemRate = {
      basePer: 100,
      baseCalories: 133,
      baseProteinG: 2.77,
      baseCarbsG: 28.26,
      baseFatG: 0.35,
    };
    const result = unwrap(rescaleItem(awkward, 133, zero));

    expect(Number.isInteger(result.calories)).toBe(true);
    for (const macro of [result.proteinG, result.carbsG, result.fatG]) {
      expect(Number(macro.toFixed(1))).toBe(macro);
    }
  });

  it('refuses a portion of zero', () => {
    const result = rescaleItem(rate, 0, zero);
    expect(result.kind).toBe('failed');
  });

  it('refuses a negative portion', () => {
    expect(rescaleItem(rate, -5, zero).kind).toBe('failed');
  });

  it('refuses a portion that is not a number', () => {
    expect(rescaleItem(rate, Number.NaN, zero).kind).toBe('failed');
    expect(rescaleItem(rate, Number.POSITIVE_INFINITY, zero).kind).toBe('failed');
  });

  it('refuses an item whose base portion is zero, rather than dividing by it', () => {
    const broken: ItemRate = { ...rate, basePer: 0 };
    const result = rescaleItem(broken, 100, zero);
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') {
      expect(result.message).toContain('base portion');
    }
  });

  it('scales an item whose base values are all zero without producing NaN', () => {
    const empty: ItemRate = {
      basePer: 100,
      baseCalories: 0,
      baseProteinG: 0,
      baseCarbsG: 0,
      baseFatG: 0,
    };
    expect(unwrap(rescaleItem(empty, 250, zero))).toEqual(zero);
  });
});

describe('edited fields', () => {
  it('reads an empty list from null or an empty string', () => {
    expect(parseEditedFields(null)).toEqual([]);
    expect(parseEditedFields('')).toEqual([]);
    expect(parseEditedFields('   ')).toEqual([]);
  });

  it('reads a comma separated list, tolerating spaces', () => {
    expect(parseEditedFields('calories, fat_g')).toEqual(['calories', 'fat_g']);
  });

  // Anything not a real rescalable field is dropped rather than trusted, so a
  // stale or hand edited row cannot make the rescaler skip a field it owns.
  it('drops names that are not rescalable fields', () => {
    expect(parseEditedFields('calories,not_a_field,fat_g')).toEqual(['calories', 'fat_g']);
  });

  it('writes null when nothing was typed, so the column stays empty', () => {
    expect(serialiseEditedFields([])).toBeNull();
  });

  it('writes the fields in a stable order, whatever order they arrive in', () => {
    expect(serialiseEditedFields(['fat_g', 'calories'])).toBe('calories,fat_g');
    expect(serialiseEditedFields(['calories', 'fat_g'])).toBe('calories,fat_g');
  });

  it('round trips through write and read', () => {
    const written = serialiseEditedFields(['carbs_g', 'calories']);
    expect(parseEditedFields(written)).toEqual(['calories', 'carbs_g']);
  });

  it('adds a field without duplicating one already there', () => {
    expect(markFieldEdited('calories', 'fat_g')).toBe('calories,fat_g');
    expect(markFieldEdited('calories', 'calories')).toBe('calories');
  });

  it('adds the first field to an empty record', () => {
    expect(markFieldEdited(null, 'protein_g')).toBe('protein_g');
  });
});

describe('sourceAfterEdit', () => {
  // covers: AC-8. The one state machine, and it only goes one way.
  it('turns a scanned item into an edited one', () => {
    expect(sourceAfterEdit('ai_scan')).toBe('ai_edited');
  });

  it('leaves a hand entered item as manual, never turning it into a scan', () => {
    expect(sourceAfterEdit('manual')).toBe('manual');
  });

  it('leaves an already edited item as it is', () => {
    expect(sourceAfterEdit('ai_edited')).toBe('ai_edited');
  });
});

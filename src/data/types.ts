import type { MealType } from './calculations/meal-type';
import type { ItemSource, RescalableField } from './calculations/rescale-item';

/**
 * The shapes the app works in. Columns are `snake_case` in both databases and
 * these are `camelCase`, so the mapping lives in one place
 * (`src/data/local/rows.ts`) rather than being spelled out at every call.
 */

export type Confidence = 'high' | 'medium' | 'low';

export type MealItem = {
  readonly id: string;
  readonly mealId: string;
  readonly name: string;
  readonly position: number;
  readonly basePer: number;
  readonly baseUnit: 'g' | 'ml' | 'piece';
  readonly baseCalories: number;
  readonly baseProteinG: number;
  readonly baseCarbsG: number;
  readonly baseFatG: number;
  readonly quantity: number;
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
  readonly source: ItemSource;
  readonly editedFields: readonly RescalableField[];
  readonly confidence?: Confidence;
};

export type Meal = {
  readonly id: string;
  readonly eatenOn: string;
  readonly eatenAt: string;
  readonly tzAtSave: string;
  readonly mealType: MealType;
  readonly mealTypeSource: 'guessed' | 'chosen';
  readonly note?: string;
  readonly photoLocalUri?: string;
  readonly scanId?: string;
  readonly items: readonly MealItem[];
};

/**
 * Never stored. Always a sum over the live items at read time, so no total
 * can disagree with the parts above it (AC-7).
 */
export type Nutrition = {
  readonly calories: number;
  readonly proteinG: number;
  readonly carbsG: number;
  readonly fatG: number;
};

export type DailyTarget = {
  readonly id: string;
  readonly onDate: string;
  readonly calories: number;
  readonly proteinG?: number;
  readonly carbsG?: number;
  readonly fatG?: number;
  readonly source: 'computed' | 'manual';
  readonly formulaVersion: string;
};

/** A page of a keyset paginated list. `nextCursor` absent means the end. */
export type Page<T> = {
  readonly rows: readonly T[];
  readonly nextCursor?: string;
};

/**
 * Expected failures are values, not throws (root `AGENTS.md`). Every failure
 * carries a message a screen can show a person as it stands.
 */
export type DataResult<T> =
  | { readonly kind: 'ok'; readonly value: T }
  | { readonly kind: 'failed'; readonly message: string };

export const ok = <T>(value: T): DataResult<T> => ({ kind: 'ok', value });
export const failed = <T>(message: string): DataResult<T> => ({ kind: 'failed', message });

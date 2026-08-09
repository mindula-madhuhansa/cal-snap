import { parseEditedFields, type ItemSource } from '../calculations/rescale-item';
import type { Confidence, MealItem } from '../types';
import type { MealType } from '../calculations/meal-type';

/**
 * The database side of each row, exactly as SQLite returns it, plus the
 * mapping into the app's shapes. Keeping the two apart means the rest of the
 * code never sees a `snake_case` key or a 0 standing in for false.
 *
 * SQLite has no boolean and no null-free optional, so the row types carry
 * `number` and `| null` where the domain types carry `boolean` and `?`.
 */

export type MealRow = {
  readonly id: string;
  readonly user_id: string;
  readonly eaten_on: string;
  readonly eaten_at: string;
  readonly tz_at_save: string;
  readonly meal_type: MealType;
  readonly meal_type_source: 'guessed' | 'chosen';
  readonly note: string | null;
  readonly photo_local_uri: string | null;
  readonly photo_remote_path: string | null;
  readonly photo_synced_at: string | null;
  readonly scan_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly deleted_at: string | null;
};

export type MealItemRow = {
  readonly id: string;
  readonly meal_id: string;
  readonly user_id: string;
  readonly name: string;
  readonly position: number;
  readonly base_per: number;
  readonly base_unit: 'g' | 'ml' | 'piece';
  readonly base_calories: number;
  readonly base_protein_g: number;
  readonly base_carbs_g: number;
  readonly base_fat_g: number;
  readonly quantity: number;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  readonly source: ItemSource;
  readonly edited_fields: string | null;
  readonly confidence: Confidence | null;
};

export type DailyTargetRow = {
  readonly id: string;
  readonly on_date: string;
  readonly calories: number;
  readonly protein_g: number | null;
  readonly carbs_g: number | null;
  readonly fat_g: number | null;
  readonly source: 'computed' | 'manual';
  readonly formula_version: string;
};

/** `null` from SQLite becomes an absent optional, never a null in the domain. */
export const optional = <T>(value: T | null): T | undefined => value ?? undefined;

export const toMealItem = (row: MealItemRow): MealItem => ({
  id: row.id,
  mealId: row.meal_id,
  name: row.name,
  position: row.position,
  basePer: row.base_per,
  baseUnit: row.base_unit,
  baseCalories: row.base_calories,
  baseProteinG: row.base_protein_g,
  baseCarbsG: row.base_carbs_g,
  baseFatG: row.base_fat_g,
  quantity: row.quantity,
  calories: row.calories,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
  source: row.source,
  editedFields: parseEditedFields(row.edited_fields),
  ...(row.confidence === null ? {} : { confidence: row.confidence }),
});

/** An ISO 8601 instant in UTC, the one format every timestamp column stores. */
export const nowIso = (at: Date = new Date()): string => at.toISOString();

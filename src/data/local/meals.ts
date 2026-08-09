import { deviceTimeZone, resolveLocalDay } from '../calculations/local-day';
import { guessMealType, type MealType } from '../calculations/meal-type';
import {
  rescaleItem,
  serialiseEditedFields,
  sourceAfterEdit,
  type ItemSource,
  type RescalableField,
} from '../calculations/rescale-item';
import { roundMacro } from '../calculations/rounding';
import type { IdSource } from '../ids/uuid';
import {
  failed,
  ok,
  type Confidence,
  type DataResult,
  type Meal,
  type Nutrition,
  type Page,
} from '../types';

import type { SqlDatabase, SqlValue } from './database';
import { nowIso, optional, toMealItem, type MealItemRow, type MealRow } from './rows';

/** How many meals one page of a day holds unless the caller says otherwise. */
const DEFAULT_PAGE_SIZE = 25;

export type NewMealItem = {
  readonly name: string;
  /** The amount the base numbers describe. 100 grams unless stated. */
  readonly basePer?: number;
  readonly baseUnit: 'g' | 'ml' | 'piece';
  readonly baseCalories: number;
  readonly baseProteinG: number;
  readonly baseCarbsG: number;
  readonly baseFatG: number;
  readonly quantity: number;
  readonly source: ItemSource;
  readonly confidence?: Confidence;
  /**
   * Values the person typed over by hand. These are stored as given and stop
   * rescaling, and they are what `edited_fields` records (AC-6, AC-8).
   */
  readonly typed?: Partial<Record<RescalableField, number>>;
};

export type NewMeal = {
  readonly userId: string;
  /** Defaults to now. The instant decides both `eaten_on` and the meal type guess. */
  readonly eatenAt?: Date;
  /** Defaults to the zone the device is in right now. */
  readonly timeZone?: string;
  /** Given means the person chose it; absent means the app guesses. */
  readonly mealType?: MealType;
  readonly note?: string;
  readonly photoLocalUri?: string;
  readonly scanId?: string;
  readonly items: readonly NewMealItem[];
};

/**
 * Saves a meal and its items in one transaction.
 *
 * `eaten_on` is decided here, once, from the instant and the zone, and never
 * recomputed afterwards. That is the whole of AC-3: a meal saved at 23:50 in
 * Colombo stays on that date after the phone lands in London.
 */
export const saveMeal = async (
  db: SqlDatabase,
  meal: NewMeal,
  ids: IdSource,
): Promise<DataResult<string>> => {
  if (meal.items.length === 0) {
    return failed('A meal needs at least one item.');
  }

  const eatenAt = meal.eatenAt ?? new Date();
  const timeZone = meal.timeZone ?? deviceTimeZone();
  const day = resolveLocalDay(eatenAt, timeZone);
  if (day.kind === 'failed') return failed(day.message);

  // Resolve every item before writing anything, so an invalid portion fails
  // the whole save rather than leaving half a meal behind.
  const resolved: {
    readonly row: readonly SqlValue[];
  }[] = [];

  for (const [position, item] of meal.items.entries()) {
    const basePer = item.basePer ?? 100;
    const typed = item.typed ?? {};
    const typedFields = (Object.keys(typed) as RescalableField[]).filter(
      (field) => typeof typed[field] === 'number',
    );

    const current: Nutrition = {
      calories: typed.calories ?? 0,
      proteinG: typed.protein_g ?? 0,
      carbsG: typed.carbs_g ?? 0,
      fatG: typed.fat_g ?? 0,
    };

    const scaled = rescaleItem(
      {
        basePer,
        baseCalories: item.baseCalories,
        baseProteinG: item.baseProteinG,
        baseCarbsG: item.baseCarbsG,
        baseFatG: item.baseFatG,
      },
      item.quantity,
      current,
      typedFields,
    );
    if (scaled.kind === 'failed') return failed(`${item.name}: ${scaled.message}`);

    const source = typedFields.length > 0 ? sourceAfterEdit(item.source) : item.source;

    resolved.push({
      row: [
        ids.newId(),
        '', // meal id, filled in below once it is known
        meal.userId,
        item.name,
        position,
        basePer,
        item.baseUnit,
        item.baseCalories,
        roundMacro(item.baseProteinG),
        roundMacro(item.baseCarbsG),
        roundMacro(item.baseFatG),
        item.quantity,
        scaled.nutrition.calories,
        scaled.nutrition.proteinG,
        scaled.nutrition.carbsG,
        scaled.nutrition.fatG,
        source,
        serialiseEditedFields(typedFields),
        item.confidence ?? null,
      ],
    });
  }

  const mealId = ids.newId();
  const at = nowIso();
  const mealType = meal.mealType ?? guessMealType(eatenAt, timeZone);

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO meals (
           id, user_id, eaten_on, eaten_at, tz_at_save, meal_type, meal_type_source,
           note, photo_local_uri, photo_remote_path, photo_synced_at, scan_id,
           created_at, updated_at, deleted_at, is_dirty, synced_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, NULL, 1, NULL)`,
        [
          mealId,
          meal.userId,
          day.value,
          eatenAt.toISOString(),
          timeZone,
          mealType,
          meal.mealType === undefined ? 'guessed' : 'chosen',
          meal.note ?? null,
          meal.photoLocalUri ?? null,
          meal.scanId ?? null,
          at,
          at,
        ],
      );

      for (const item of resolved) {
        const row = [...item.row];
        row[1] = mealId;
        await db.runAsync(
          `INSERT INTO meal_items (
             id, meal_id, user_id, name, position, base_per, base_unit,
             base_calories, base_protein_g, base_carbs_g, base_fat_g, quantity,
             calories, protein_g, carbs_g, fat_g, source, edited_fields, confidence,
             created_at, updated_at, deleted_at, is_dirty, synced_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1, NULL)`,
          [...row, at, at],
        );
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return failed(`The meal could not be saved. ${detail}`);
  }

  return ok(mealId);
};

/**
 * Soft delete. The row stays with `deleted_at` set, so the other phone learns
 * the meal is gone instead of never hearing about it (AC-5). A deleted row is
 * never revived by any path.
 */
export const deleteMeal = async (
  db: SqlDatabase,
  userId: string,
  mealId: string,
): Promise<DataResult<null>> => {
  const existing = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM meals WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [mealId, userId],
  );
  if (existing === null) return failed('That meal is not there any more.');

  const at = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE meals SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
      [at, at, mealId],
    );
    await db.runAsync(
      'UPDATE meal_items SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE meal_id = ? AND deleted_at IS NULL',
      [at, at, mealId],
    );
  });

  return ok(null);
};

const MEAL_COLUMNS = `id, user_id, eaten_on, eaten_at, tz_at_save, meal_type, meal_type_source,
   note, photo_local_uri, photo_remote_path, photo_synced_at, scan_id,
   created_at, updated_at, deleted_at`;

const toCursor = (row: MealRow): string => `${row.eaten_at}|${row.id}`;

const fromCursor = (cursor: string): readonly [string, string] | undefined => {
  const at = cursor.indexOf('|');
  if (at <= 0) return undefined;
  return [cursor.slice(0, at), cursor.slice(at + 1)];
};

export type DayPage = {
  readonly meals: readonly Meal[];
  readonly totals: Nutrition;
  readonly nextCursor?: string;
};

export type ListMealsQuery = {
  readonly userId: string;
  readonly onDate: string;
  readonly limit?: number;
  readonly cursor?: string;
};

/**
 * One day's meals, newest first, paginated.
 *
 * The order is a keyset on `(eaten_at desc, id desc)` rather than an offset,
 * so a meal saved while the list is being paged cannot make a row skip or
 * repeat (AC-16). The totals are for the whole day, not the page, and are
 * summed over the live items at read time so no total can disagree with its
 * parts (AC-7).
 */
export const listMealsForDay = async (
  db: SqlDatabase,
  query: ListMealsQuery,
): Promise<DataResult<DayPage>> => {
  const limit = Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE);
  const after = query.cursor === undefined ? undefined : fromCursor(query.cursor);
  if (query.cursor !== undefined && after === undefined) {
    return failed('That page marker is not one this list produced.');
  }

  const keyset = after === undefined ? '' : 'AND (eaten_at < ? OR (eaten_at = ? AND id < ?))';
  const keysetParams: readonly SqlValue[] =
    after === undefined ? [] : [after[0], after[0], after[1]];

  // One extra row tells us whether another page exists without a second query.
  const mealRows = await db.getAllAsync<MealRow>(
    `SELECT ${MEAL_COLUMNS} FROM meals
     WHERE user_id = ? AND eaten_on = ? AND deleted_at IS NULL ${keyset}
     ORDER BY eaten_at DESC, id DESC
     LIMIT ?`,
    [query.userId, query.onDate, ...keysetParams, limit + 1],
  );

  const page = mealRows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = mealRows.length > limit && last !== undefined ? toCursor(last) : undefined;

  const items =
    page.length === 0
      ? []
      : await db.getAllAsync<MealItemRow>(
          `SELECT * FROM meal_items
           WHERE meal_id IN (${page.map(() => '?').join(', ')}) AND deleted_at IS NULL
           ORDER BY position ASC, id ASC`,
          page.map((row) => row.id),
        );

  const meals: readonly Meal[] = page.map((row) => ({
    id: row.id,
    eatenOn: row.eaten_on,
    eatenAt: row.eaten_at,
    tzAtSave: row.tz_at_save,
    mealType: row.meal_type,
    mealTypeSource: row.meal_type_source,
    ...(row.note === null ? {} : { note: row.note }),
    ...(row.photo_local_uri === null ? {} : { photoLocalUri: row.photo_local_uri }),
    ...(optional(row.scan_id) === undefined ? {} : { scanId: row.scan_id as string }),
    items: items.filter((item) => item.meal_id === row.id).map(toMealItem),
  }));

  return ok({
    meals,
    totals: await totalsForDay(db, query.userId, query.onDate),
    ...(nextCursor === undefined ? {} : { nextCursor }),
  });
};

/**
 * A day's totals, summed over the live items of live meals. Nothing is
 * stored, so nothing can drift (AC-7).
 */
export const totalsForDay = async (
  db: SqlDatabase,
  userId: string,
  onDate: string,
): Promise<Nutrition> => {
  const row = await db.getFirstAsync<{
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  }>(
    `SELECT SUM(i.calories) AS calories, SUM(i.protein_g) AS protein_g,
            SUM(i.carbs_g) AS carbs_g, SUM(i.fat_g) AS fat_g
     FROM meal_items i
     JOIN meals m ON m.id = i.meal_id
     WHERE i.user_id = ? AND m.eaten_on = ? AND i.deleted_at IS NULL AND m.deleted_at IS NULL`,
    [userId, onDate],
  );

  return {
    calories: Math.round(row?.calories ?? 0),
    proteinG: roundMacro(row?.protein_g ?? 0),
    carbsG: roundMacro(row?.carbs_g ?? 0),
    fatG: roundMacro(row?.fat_g ?? 0),
  };
};

export type { Page };

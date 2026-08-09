import { ok, type DataResult, type Page } from '../types';

import type { SqlDatabase, SqlValue } from './database';

/**
 * The "add by hand" search, sourced from the person's own past items.
 *
 * On a new account this is empty, which the screen has to say plainly rather
 * than showing a blank box. Spec 0002's follow up flags that feature 8 owns
 * what that screen says on day one, or the deferred food database moves
 * forward; nothing here guesses on its behalf.
 */

const DEFAULT_LIMIT = 20;

export type PastItem = {
  readonly name: string;
  readonly basePer: number;
  readonly baseUnit: 'g' | 'ml' | 'piece';
  readonly baseCalories: number;
  readonly baseProteinG: number;
  readonly baseCarbsG: number;
  readonly baseFatG: number;
  readonly lastQuantity: number;
  readonly lastUsedAt: string;
};

type PastItemRow = {
  readonly name: string;
  readonly key: string;
  readonly base_per: number;
  readonly base_unit: 'g' | 'ml' | 'piece';
  readonly base_calories: number;
  readonly base_protein_g: number;
  readonly base_carbs_g: number;
  readonly base_fat_g: number;
  readonly quantity: number;
  readonly last_used_at: string;
};

export type SearchPastItemsQuery = {
  readonly userId: string;
  readonly query: string;
  readonly limit?: number;
  readonly cursor?: string;
};

/**
 * Distinct past item names with the numbers they last carried, ordered by
 * name.
 *
 * Paging is a keyset on `(lower(name) asc)`, matching the
 * `meal_items_user_name_lower_idx` index, so a page cannot skip or repeat a
 * row when a new item is inserted mid paging (AC-16).
 *
 * Picking "the most recent numbers for this name" is done with an explicit
 * `ROW_NUMBER()` window rather than the `MAX(created_at)` with bare columns
 * trick. The trick reads more neatly and is real SQLite behaviour, but it
 * resolves a tie on the maximum **arbitrarily**, and ties are not rare here:
 * `saveMeal` stamps one `created_at` for a whole meal, so every item in a meal
 * carries the same instant, and two meals saved in the same millisecond do
 * too. That made the suggested numbers depend on which row SQLite happened to
 * pick. Ordering by `(created_at desc, id desc)` makes the answer the same
 * every time, on every machine.
 */
export const searchPastItems = async (
  db: SqlDatabase,
  search: SearchPastItemsQuery,
): Promise<DataResult<Page<PastItem>>> => {
  const limit = Math.max(1, search.limit ?? DEFAULT_LIMIT);
  const term = `%${search.query.trim().toLowerCase()}%`;
  const keyset = search.cursor === undefined ? '' : 'AND key > ?';
  const keysetParams: readonly SqlValue[] = search.cursor === undefined ? [] : [search.cursor];

  const rows = await db.getAllAsync<PastItemRow>(
    `SELECT name, key, base_per, base_unit, base_calories,
            base_protein_g, base_carbs_g, base_fat_g, quantity, last_used_at
     FROM (
       SELECT name,
              LOWER(name) AS key,
              base_per, base_unit, base_calories,
              base_protein_g, base_carbs_g, base_fat_g,
              quantity,
              created_at AS last_used_at,
              ROW_NUMBER() OVER (
                PARTITION BY LOWER(name)
                ORDER BY created_at DESC, id DESC
              ) AS newest_first
       FROM meal_items
       WHERE user_id = ? AND deleted_at IS NULL AND LOWER(name) LIKE ?
     )
     WHERE newest_first = 1 ${keyset}
     ORDER BY key ASC
     LIMIT ?`,
    [search.userId, term, ...keysetParams, limit + 1],
  );

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor = rows.length > limit && last !== undefined ? last.key : undefined;

  return ok({
    rows: page.map((row) => ({
      name: row.name,
      basePer: row.base_per,
      baseUnit: row.base_unit,
      baseCalories: row.base_calories,
      baseProteinG: row.base_protein_g,
      baseCarbsG: row.base_carbs_g,
      baseFatG: row.base_fat_g,
      lastQuantity: row.quantity,
      lastUsedAt: row.last_used_at,
    })),
    ...(nextCursor === undefined ? {} : { nextCursor }),
  });
};

import { dayScopedId } from '../ids/uuid';
import { failed, ok, type DailyTarget, type DataResult } from '../types';

import type { SqlDatabase } from './database';
import { nowIso, optional, type DailyTargetRow } from './rows';

/**
 * The profile fields a calorie formula needs. Named here so this module does
 * not depend on the whole profile shape.
 */
export type ProfileForTarget = {
  readonly age_years: number;
  readonly age_recorded_on: string;
  readonly sex: 'female' | 'male';
  readonly height_cm: number;
  readonly activity_level: string;
  readonly goal_direction: 'lose' | 'hold' | 'gain';
  readonly goal_rate_kg_per_week: number;
  readonly onboarded_at: string | null;
};

export type TargetInputs = {
  readonly profile: ProfileForTarget;
  /** The newest weigh in at or before the day, in kilograms. */
  readonly weightKg?: number;
  readonly onDate: string;
};

export type ComputedTarget = {
  readonly calories: number;
  readonly proteinG?: number;
  readonly carbsG?: number;
  readonly fatG?: number;
  /** Which calculation produced it, recorded so a past day stays explainable. */
  readonly formulaVersion: string;
};

/**
 * The calorie formula itself belongs to scope feature 6, which owns that
 * decision. Spec 0002 reserves `formula_version` for it and deliberately does
 * not choose the formula, so this module takes it as a parameter rather than
 * inventing one.
 */
export type TargetFormula = (inputs: TargetInputs) => ComputedTarget | undefined;

const toDailyTarget = (row: DailyTargetRow): DailyTarget => ({
  id: row.id,
  onDate: row.on_date,
  calories: row.calories,
  ...(optional(row.protein_g) === undefined ? {} : { proteinG: row.protein_g as number }),
  ...(optional(row.carbs_g) === undefined ? {} : { carbsG: row.carbs_g as number }),
  ...(optional(row.fat_g) === undefined ? {} : { fatG: row.fat_g as number }),
  source: row.source,
  formulaVersion: row.formula_version,
});

const TARGET_COLUMNS = 'id, on_date, calories, protein_g, carbs_g, fat_g, source, formula_version';

/**
 * The target that applies on one local date, written once and never
 * recomputed (AC-9).
 *
 * "Never recomputed" is deliberate, not an oversight. Backdating a weigh in
 * to a day whose target already exists leaves that target alone, because the
 * target that applied on a day is what the person was actually eating
 * against, and rewriting history would make a past day dishonest.
 *
 * The identifier is derived from the user and the date, so two offline phones
 * that each reach this function for the same day produce the same row and
 * collide on the primary key, where newest write wins can see it.
 */
export const getOrCreateDailyTarget = async (
  db: SqlDatabase,
  query: { readonly userId: string; readonly onDate: string },
  formula: TargetFormula,
): Promise<DataResult<DailyTarget>> => {
  const existing = await db.getFirstAsync<DailyTargetRow>(
    `SELECT ${TARGET_COLUMNS} FROM daily_targets
     WHERE user_id = ? AND on_date = ? AND deleted_at IS NULL`,
    [query.userId, query.onDate],
  );
  if (existing !== null) return ok(toDailyTarget(existing));

  const profile = await db.getFirstAsync<ProfileForTarget>(
    `SELECT age_years, age_recorded_on, sex, height_cm, activity_level,
            goal_direction, goal_rate_kg_per_week, onboarded_at
     FROM profiles WHERE user_id = ?`,
    [query.userId],
  );
  if (profile === null || profile.onboarded_at === null) {
    return failed('Finish setting up your profile before we can work out your daily target.');
  }

  const weight = await db.getFirstAsync<{ weight_kg: number }>(
    `SELECT weight_kg FROM weight_entries
     WHERE user_id = ? AND on_date <= ? AND deleted_at IS NULL
     ORDER BY on_date DESC, id DESC LIMIT 1`,
    [query.userId, query.onDate],
  );

  const computed = formula({
    profile,
    onDate: query.onDate,
    ...(weight === null ? {} : { weightKg: weight.weight_kg }),
  });
  if (computed === undefined) {
    return failed('We could not work out a daily target from your profile yet.');
  }

  const id = dayScopedId('daily_targets', query.userId, query.onDate);
  const at = nowIso();

  // `DO NOTHING` rather than an upsert: a row for this day may already have
  // arrived from another device between the read above and this write, and if
  // it did, it is the one that stands.
  await db.runAsync(
    `INSERT INTO daily_targets (
       id, user_id, on_date, calories, protein_g, carbs_g, fat_g, source, formula_version,
       created_at, updated_at, deleted_at, is_dirty, synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'computed', ?, ?, ?, NULL, 1, NULL)
     ON CONFLICT (id) DO NOTHING`,
    [
      id,
      query.userId,
      query.onDate,
      computed.calories,
      computed.proteinG ?? null,
      computed.carbsG ?? null,
      computed.fatG ?? null,
      computed.formulaVersion,
      at,
      at,
    ],
  );

  const written = await db.getFirstAsync<DailyTargetRow>(
    `SELECT ${TARGET_COLUMNS} FROM daily_targets WHERE id = ?`,
    [id],
  );
  if (written === null) return failed('The daily target could not be saved.');

  return ok(toDailyTarget(written));
};

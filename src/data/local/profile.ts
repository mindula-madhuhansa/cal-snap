import type { ActivityLevel, GoalDirection, Sex } from '../calculations/calorie-target';
import type { UnitPreference } from '../calculations/units';
import { failed, ok, type DataResult } from '../types';

import type { SqlDatabase, SqlValue } from './database';
import { nowIso } from './rows';

/**
 * Changing an answer after setup (spec 0006, AC-11 and AC-12).
 *
 * Writes straight to `profiles`, never back through `onboarding_draft`: the
 * draft exists to hold an *incomplete* answer set, and a profile that already
 * exists is complete by definition. Routing a single edit through it would
 * risk the startup gate seeing a draft and offering to resume a setup that
 * finished months ago.
 *
 * Nothing here recomputes a day. A `daily_targets` row is written once and
 * never rewritten, so a changed answer reaches tomorrow and leaves every day
 * the person already ate against exactly as it was.
 */

export type ProfileAnswers = {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly activityLevel: ActivityLevel;
  readonly goalDirection: GoalDirection;
  readonly goalRateKgPerWeek: number;
  readonly goalWeightKg?: number;
  readonly unitPreference: UnitPreference;
  readonly timezone: string;
  readonly onboardedAt: string | null;
};

type ProfileRow = {
  readonly sex: Sex;
  readonly age_years: number;
  readonly height_cm: number;
  readonly activity_level: ActivityLevel;
  readonly goal_direction: GoalDirection;
  readonly goal_rate_kg_per_week: number;
  readonly goal_weight_kg: number | null;
  readonly unit_preference: UnitPreference;
  readonly timezone: string;
  readonly onboarded_at: string | null;
};

const PROFILE_COLUMNS = `sex, age_years, height_cm, activity_level, goal_direction,
  goal_rate_kg_per_week, goal_weight_kg, unit_preference, timezone, onboarded_at`;

const toProfile = (row: ProfileRow): ProfileAnswers => ({
  sex: row.sex,
  ageYears: row.age_years,
  heightCm: row.height_cm,
  activityLevel: row.activity_level,
  goalDirection: row.goal_direction,
  goalRateKgPerWeek: row.goal_rate_kg_per_week,
  ...(row.goal_weight_kg === null ? {} : { goalWeightKg: row.goal_weight_kg }),
  unitPreference: row.unit_preference,
  timezone: row.timezone,
  onboardedAt: row.onboarded_at,
});

export const readProfile = async (
  db: SqlDatabase,
  userId: string,
): Promise<DataResult<ProfileAnswers | undefined>> => {
  const row = await db.getFirstAsync<ProfileRow>(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE user_id = ?`,
    [userId],
  );

  return ok(row === null ? undefined : toProfile(row));
};

/** The answers Settings can change, and the column each one lives in. */
const EDITABLE: Readonly<Record<string, string>> = {
  sex: 'sex',
  ageYears: 'age_years',
  heightCm: 'height_cm',
  activityLevel: 'activity_level',
  goalDirection: 'goal_direction',
  goalRateKgPerWeek: 'goal_rate_kg_per_week',
  goalWeightKg: 'goal_weight_kg',
  unitPreference: 'unit_preference',
};

export type ProfileEdit = {
  readonly sex?: Sex;
  readonly ageYears?: number;
  readonly heightCm?: number;
  readonly activityLevel?: ActivityLevel;
  readonly goalDirection?: GoalDirection;
  readonly goalRateKgPerWeek?: number;
  readonly goalWeightKg?: number;
  readonly unitPreference?: UnitPreference;
};

/** The bounds each column's check declares, so a violation is unreachable. */
const withinBounds = (edit: ProfileEdit): string | undefined => {
  if (edit.ageYears !== undefined && (edit.ageYears < 13 || edit.ageYears > 120)) {
    return 'Age has to be between 13 and 120.';
  }
  if (edit.heightCm !== undefined && edit.heightCm <= 0) {
    return 'Height has to be above zero.';
  }
  if (
    edit.goalRateKgPerWeek !== undefined &&
    (edit.goalRateKgPerWeek < 0 || edit.goalRateKgPerWeek > 1.5)
  ) {
    return 'A pace has to be between 0 and 1.5 kg a week.';
  }
  return undefined;
};

/**
 * Changes one or more answers on an existing profile.
 *
 * `is_dirty` and `updated_at` move together, which is not optional: a row
 * dirtied without its stamp moving would have the person's edit silently
 * overwritten by the reply to its own push (`src/data/AGENTS.md`).
 */
export const updateProfileAnswers = async (
  db: SqlDatabase,
  userId: string,
  edit: ProfileEdit,
): Promise<DataResult<ProfileAnswers>> => {
  const outOfBounds = withinBounds(edit);
  if (outOfBounds !== undefined) return failed(outOfBounds);

  const changed = Object.keys(EDITABLE).filter(
    (key) => edit[key as keyof ProfileEdit] !== undefined,
  );
  if (changed.length === 0) return failed('There was nothing to change.');

  const existing = await readProfile(db, userId);
  if (existing.kind === 'failed') return failed(existing.message);
  if (existing.value === undefined) {
    return failed('We could not find your profile. Try signing out and back in.');
  }

  const at = nowIso();
  // Column names come from `EDITABLE`, never from the caller's keys, so
  // nothing from outside this module reaches the statement text.
  const assignments = changed.map((key) => `${EDITABLE[key]} = ?`).join(', ');
  const values = changed.map((key) => edit[key as keyof ProfileEdit] as SqlValue);

  await db.runAsync(
    `UPDATE profiles SET ${assignments}, updated_at = ?, is_dirty = 1 WHERE user_id = ?`,
    [...values, at, userId],
  );

  const written = await readProfile(db, userId);
  if (written.kind === 'failed') return failed(written.message);
  if (written.value === undefined) return failed('Your change could not be saved.');

  return ok(written.value);
};

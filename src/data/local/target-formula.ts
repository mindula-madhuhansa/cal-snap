import {
  computeCalorieTarget,
  FORMULA_VERSION,
  type ActivityLevel,
  type Sex,
} from '../calculations/calorie-target';

import type { ComputedTarget, TargetFormula, TargetInputs } from './daily-targets';

/**
 * The one seam between the stored answers and the pure calculation.
 *
 * `getOrCreateDailyTarget` takes the formula as an argument rather than
 * importing one, which is what let spec 0002 ship the diary before the formula
 * was decided. This module is spec 0006 filling that argument in: it reads
 * nothing and writes nothing, it only shapes a database row into the pure
 * function's inputs and shapes the answer back.
 */

/**
 * What `formula_version` records when the person set the number themselves.
 *
 * A distinct value rather than the current formula's, because no formula
 * produced it. Recording `mifflin-st-jeor-v1` on a number somebody typed would
 * tell a later reader the equation made it, and a past day is supposed to stay
 * honest about where its target came from.
 */
export const MANUAL_VERSION = 'manual-v1';

/** The column's check allows exactly these, so a stored value is always one of them. */
const isActivityLevel = (value: string): value is ActivityLevel =>
  value === 'sedentary' ||
  value === 'light' ||
  value === 'moderate' ||
  value === 'active' ||
  value === 'very_active';

/**
 * An override wins outright, and it wins without needing a weigh in: the
 * person supplied the number, so there is nothing left to calculate. Otherwise
 * the formula runs, and it needs a weight, which is the one case this returns
 * nothing for.
 */
export const calorieTargetFormula: TargetFormula = (inputs: TargetInputs) => {
  const override = inputs.override;
  if (override !== undefined) {
    return {
      calories: override.calories,
      formulaVersion: MANUAL_VERSION,
      source: 'manual',
    } satisfies ComputedTarget;
  }

  const { profile, weightKg } = inputs;
  if (weightKg === undefined) return undefined;
  if (!isActivityLevel(profile.activity_level)) return undefined;

  const computed = computeCalorieTarget({
    sex: profile.sex satisfies Sex,
    ageYears: profile.age_years,
    heightCm: profile.height_cm,
    weightKg,
    activityLevel: profile.activity_level,
    goalDirection: profile.goal_direction,
    goalRateKgPerWeek: profile.goal_rate_kg_per_week,
  });

  return {
    calories: computed.calories,
    formulaVersion: FORMULA_VERSION,
    source: 'computed',
  } satisfies ComputedTarget;
};

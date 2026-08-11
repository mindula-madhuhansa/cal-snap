import { roundCalories } from './rounding';

/**
 * How many calories a day the app suggests, and where the number came from
 * (spec 0006, AC-7 and AC-8).
 *
 * Pure: no clock, no randomness, no storage, no phone. The same answers always
 * produce the same number, which is what lets a past day stay explainable and
 * what lets the whole calculation be proven at a desk.
 *
 * None of the constants here are invented. They are the published Mifflin-St
 * Jeor equation, the standard activity multiplier table, and the 7700 kcal per
 * kilogram figure, all pinned in spec 0006's "The calculation, in full".
 */

export type Sex = 'female' | 'male';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type GoalDirection = 'lose' | 'hold' | 'gain';

export type CalorieTargetInputs = {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly activityLevel: ActivityLevel;
  readonly goalDirection: GoalDirection;
  /** Kilograms per week. Zero for `hold`, by the column's own default. */
  readonly goalRateKgPerWeek: number;
};

export type CalorieTarget = {
  readonly calories: number;
  readonly formulaVersion: string;
  /**
   * The pace the number really applies, which is the requested one unless the
   * floor bound. AC-8 puts this on screen so nobody is told they are losing
   * faster than they are.
   *
   * Signed the way spec 0006 defines it: positive means losing, negative means
   * gaining. So a `gain` goal reports a negative rate, and so does a `lose`
   * goal whose floor bound so hard that the safe number is above maintenance,
   * which is the honest answer rather than a comfortable one.
   */
  readonly effectiveRateKgPerWeek: number;
  /** The pre clamp number, present only when the floor actually moved it. */
  readonly flooredFrom?: number;
};

/** Recorded on every row this produces, so a later formula never rewrites history. */
export const FORMULA_VERSION = 'mifflin-st-jeor-v1';

/**
 * The activity multiplier for each stored `activity_level`. Frozen, and keyed
 * by all five values the column's check allows, so there is no default branch
 * to fall through and no unhandled level.
 */
export const ACTIVITY_MULTIPLIERS: Readonly<Record<ActivityLevel, number>> = Object.freeze({
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
});

/**
 * The safety floor, below which a target is never shown whatever the pace
 * asks for (AC-8). Sex based because the equation is, and because these are
 * the figures the published guidance states.
 */
export const CALORIE_FLOORS: Readonly<Record<Sex, number>> = Object.freeze({
  female: 1200,
  male: 1500,
});

/** Kilocalories in a kilogram of body mass, the conversion the pace uses. */
export const KCAL_PER_KG = 7700;

/** Exported so a screen can show the daily change a weekly pace implies. */
export const DAYS_PER_WEEK = 7;

/** The sex constant of the Mifflin-St Jeor equation. */
const SEX_CONSTANT: Readonly<Record<Sex, number>> = Object.freeze({ female: -161, male: 5 });

/**
 * Resting metabolic rate: what a body burns doing nothing at all.
 *
 * `10 × kg + 6.25 × cm − 5 × years + s`, where `s` is +5 for a male profile
 * and −161 for a female one.
 */
export const restingMetabolicRate = (inputs: {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
}): number =>
  10 * inputs.weightKg + 6.25 * inputs.heightCm - 5 * inputs.ageYears + SEX_CONSTANT[inputs.sex];

/**
 * The daily calorie change a weekly pace implies. Zero for `hold` whatever the
 * rate says, which is what keeps a stale rate from quietly moving a held
 * target.
 */
const dailyChangeFor = (direction: GoalDirection, rateKgPerWeek: number): number => {
  if (direction === 'hold') return 0;
  const perDay = (rateKgPerWeek * KCAL_PER_KG) / DAYS_PER_WEEK;
  return direction === 'lose' ? -perDay : perDay;
};

/**
 * The whole calculation, in the order spec 0006 fixes. The order matters near
 * the floor: rounding happens *before* clamping, so a bound floor is exactly
 * 1200 or 1500 and never 1199 or 1201.
 *
 * Nothing here blocks, warns, or lectures about an unusual answer (AC-16). A
 * body that is unusual is still a body, and the floor is the only intervention
 * the app makes.
 */
export const computeCalorieTarget = (inputs: CalorieTargetInputs): CalorieTarget => {
  const maintenance = restingMetabolicRate(inputs) * ACTIVITY_MULTIPLIERS[inputs.activityLevel];
  const raw = maintenance + dailyChangeFor(inputs.goalDirection, inputs.goalRateKgPerWeek);

  const rounded = roundCalories(raw);
  const floor = CALORIE_FLOORS[inputs.sex];
  const calories = Math.max(rounded, floor);

  // Inverted from the number actually being applied rather than echoed back
  // from the request, so when the floor binds this is the slower pace the
  // person is really on and AC-8 can say so honestly.
  const effectiveRateKgPerWeek = ((maintenance - calories) * DAYS_PER_WEEK) / KCAL_PER_KG;

  return {
    calories,
    formulaVersion: FORMULA_VERSION,
    effectiveRateKgPerWeek,
    ...(calories === rounded ? {} : { flooredFrom: rounded }),
  };
};

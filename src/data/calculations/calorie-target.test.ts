import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_MULTIPLIERS,
  CALORIE_FLOORS,
  FORMULA_VERSION,
  computeCalorieTarget,
  restingMetabolicRate,
  type ActivityLevel,
  type CalorieTargetInputs,
} from './calorie-target';

/**
 * Spec 0006's calculation, held to the literal numbers the spec fixes rather
 * than to whatever the code happens to produce. A test that recomputed the
 * formula to check the formula would pass no matter what either one said.
 */

/** The reference profile spec 0006 pins: 35, female, 165 cm, 70 kg, moderate, losing 0.5 kg a week. */
const reference: CalorieTargetInputs = {
  sex: 'female',
  ageYears: 35,
  heightCm: 165,
  weightKg: 70,
  activityLevel: 'moderate',
  goalDirection: 'lose',
  goalRateKgPerWeek: 0.5,
};

const withAnswers = (overrides: Partial<CalorieTargetInputs> = {}): CalorieTargetInputs => ({
  ...reference,
  ...overrides,
});

describe('restingMetabolicRate', () => {
  // covers: AC-7
  it('is Mifflin-St Jeor with the female constant', () => {
    // 10×70 + 6.25×165 − 5×35 − 161
    expect(restingMetabolicRate(reference)).toBe(1395.25);
  });

  // covers: AC-7
  it('is Mifflin-St Jeor with the male constant', () => {
    // The same body, +5 instead of −161, so exactly 166 kcal apart.
    expect(restingMetabolicRate({ ...reference, sex: 'male' })).toBe(1561.25);
  });
});

describe('computeCalorieTarget', () => {
  // covers: AC-7
  it('produces the reference profile’s target exactly', () => {
    // rmr 1395.25 → maintenance 2162.6375 → less 550 a day → 1612.6375 → 1613.
    const result = computeCalorieTarget(reference);

    expect(result.calories).toBe(1613);
    expect(result.formulaVersion).toBe(FORMULA_VERSION);
    expect(result.flooredFrom).toBeUndefined();
  });

  // covers: AC-7
  it('records the formula version on every result, so a past day stays explainable', () => {
    expect(FORMULA_VERSION).toBe('mifflin-st-jeor-v1');
    expect(computeCalorieTarget(withAnswers({ goalDirection: 'hold' })).formulaVersion).toBe(
      'mifflin-st-jeor-v1',
    );
  });

  // covers: AC-7. The whole point of a pure function: no clock, no storage.
  it('gives the same answer every time for the same answers', () => {
    const once = computeCalorieTarget(reference);
    const twice = computeCalorieTarget({ ...reference });

    expect(twice).toStrictEqual(once);
  });

  // covers: AC-7
  it('holds at maintenance when the goal is hold, whatever rate is stored', () => {
    const held = computeCalorieTarget(withAnswers({ goalDirection: 'hold' }));
    const heldWithStaleRate = computeCalorieTarget(
      withAnswers({ goalDirection: 'hold', goalRateKgPerWeek: 1.5 }),
    );

    // maintenance 2162.6375, rounded
    expect(held.calories).toBe(2163);
    expect(heldWithStaleRate.calories).toBe(2163);
  });

  // covers: AC-7
  it('adds the pace for a gain goal and subtracts it for a lose goal', () => {
    const lose = computeCalorieTarget(reference);
    const gain = computeCalorieTarget(withAnswers({ goalDirection: 'gain' }));

    // 550 either side of maintenance, 1100 apart.
    expect(gain.calories - lose.calories).toBe(1100);
  });

  // covers: AC-7
  it('applies the multiplier for each of the five activity levels', () => {
    const rmr = 1395.25;
    const levels: readonly ActivityLevel[] = [
      'sedentary',
      'light',
      'moderate',
      'active',
      'very_active',
    ];

    for (const level of levels) {
      const result = computeCalorieTarget(
        withAnswers({ activityLevel: level, goalDirection: 'hold' }),
      );
      expect(result.calories).toBe(Math.round(rmr * ACTIVITY_MULTIPLIERS[level]));
    }

    expect(ACTIVITY_MULTIPLIERS).toStrictEqual({
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9,
    });
  });

  // covers: AC-7
  it('reports the requested pace back when the floor did not bind', () => {
    const result = computeCalorieTarget(reference);

    expect(result.effectiveRateKgPerWeek).toBeCloseTo(0.5, 3);
  });
});

describe('the safety floor', () => {
  /** Small, sedentary, and asking to lose a kilogram a week: the raw number is far under the floor. */
  const belowFloor: CalorieTargetInputs = {
    sex: 'female',
    ageYears: 30,
    heightCm: 160,
    weightKg: 55,
    activityLevel: 'sedentary',
    goalDirection: 'lose',
    goalRateKgPerWeek: 1,
  };

  // covers: AC-8
  it('never returns a female profile below 1200', () => {
    // rmr 1239 → maintenance 1486.8 → less 1100 a day → 386.8 → 387, floored.
    const result = computeCalorieTarget(belowFloor);

    expect(result.calories).toBe(1200);
    expect(CALORIE_FLOORS.female).toBe(1200);
  });

  // covers: AC-8
  it('never returns a male profile below 1500', () => {
    const result = computeCalorieTarget({ ...belowFloor, sex: 'male' });

    expect(result.calories).toBe(1500);
    expect(CALORIE_FLOORS.male).toBe(1500);
  });

  // covers: AC-8. The screen needs both halves to say what changed.
  it('reports the pre clamp number and the slower pace it actually applies', () => {
    const result = computeCalorieTarget(belowFloor);

    expect(result.flooredFrom).toBe(387);
    // (1486.8 − 1200) × 7 ÷ 7700
    expect(result.effectiveRateKgPerWeek).toBeCloseTo(0.2607, 4);
    expect(result.effectiveRateKgPerWeek).toBeLessThan(belowFloor.goalRateKgPerWeek);
  });

  // covers: AC-8
  it('leaves flooredFrom absent when the clamp did not move the number', () => {
    expect(computeCalorieTarget(reference).flooredFrom).toBeUndefined();
  });

  // covers: AC-8. Rounding before clamping is what makes this exact. Clamping
  // first would leave 1199.51 rounding to 1200 by luck and 1199.49 to 1199.
  it('lands exactly on the floor rather than a value beside it', () => {
    const result = computeCalorieTarget(belowFloor);

    expect(result.calories).toBe(CALORIE_FLOORS.female);
    expect(Number.isInteger(result.calories)).toBe(true);
  });

  // covers: AC-8. An honest answer rather than a comfortable one: eating the
  // safe minimum is above this person's maintenance, so they will gain, and
  // the reported pace says so instead of echoing the request.
  it('reports a negative pace when the safe number is above maintenance', () => {
    const tiny = computeCalorieTarget({
      sex: 'female',
      ageYears: 60,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'sedentary',
      goalDirection: 'lose',
      goalRateKgPerWeek: 1.5,
    });

    expect(tiny.calories).toBe(1200);
    // maintenance 1111.8, which is under the floor.
    expect(tiny.effectiveRateKgPerWeek).toBeLessThan(0);
  });
});

describe('unusual but valid answers', () => {
  // covers: AC-16. Nothing blocks, warns, or lectures. The floor is the only
  // intervention the app makes.
  it('accepts and calculates an answer at each column bound', () => {
    const youngest = computeCalorieTarget(withAnswers({ ageYears: 13 }));
    const oldest = computeCalorieTarget(withAnswers({ ageYears: 120 }));
    const noPace = computeCalorieTarget(withAnswers({ goalRateKgPerWeek: 0 }));
    const fastest = computeCalorieTarget(withAnswers({ goalRateKgPerWeek: 1.5 }));

    for (const result of [youngest, oldest, noPace, fastest]) {
      expect(Number.isInteger(result.calories)).toBe(true);
      expect(result.calories).toBeGreaterThanOrEqual(CALORIE_FLOORS.female);
    }

    // A rate of zero on a lose goal is maintenance, not an error.
    expect(noPace.calories).toBe(2163);
  });

  // covers: AC-16
  it('calculates for a very heavy and a very light body without special casing either', () => {
    const heaviest = computeCalorieTarget(withAnswers({ weightKg: 500, goalDirection: 'hold' }));
    const lightest = computeCalorieTarget(withAnswers({ weightKg: 20, goalDirection: 'hold' }));

    expect(heaviest.calories).toBeGreaterThan(lightest.calories);
    expect(Number.isInteger(heaviest.calories)).toBe(true);
    expect(Number.isInteger(lightest.calories)).toBe(true);
  });
});

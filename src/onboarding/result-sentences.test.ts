import { describe, expect, it } from 'vitest';

import { computeCalorieTarget } from '@/data/calculations/calorie-target';

import { detailSentences, floorSentence, targetSentence } from './result-sentences';

describe('targetSentence', () => {
  // covers: AC-9. One plain sentence, naming the goal it serves.
  it('states the number and the goal it is for', () => {
    expect(targetSentence(1613, 'lose')).toBe(
      'Eat about 1613 calories a day to lose weight steadily.',
    );
    expect(targetSentence(2163, 'hold')).toContain('stay about where you are');
    expect(targetSentence(2713, 'gain')).toContain('gain weight steadily');
  });

  // covers: AC-9. Never presented as fact: no "you must", no "your body needs".
  it('says about, not exactly', () => {
    expect(targetSentence(1613, 'lose')).toContain('about');
  });
});

describe('floorSentence', () => {
  const unfloored = computeCalorieTarget({
    sex: 'female',
    ageYears: 35,
    heightCm: 165,
    weightKg: 70,
    activityLevel: 'moderate',
    goalDirection: 'lose',
    goalRateKgPerWeek: 0.5,
  });

  const floored = computeCalorieTarget({
    sex: 'female',
    ageYears: 30,
    heightCm: 160,
    weightKg: 55,
    activityLevel: 'sedentary',
    goalDirection: 'lose',
    goalRateKgPerWeek: 1,
  });

  // covers: AC-8
  it('says nothing when the floor did not bind', () => {
    expect(floorSentence(unfloored, 'lose')).toBeUndefined();
  });

  // covers: AC-8. Both halves: that the pace was reduced to keep the target
  // safe, and the pace actually being applied.
  it('says the target was raised and names the slower pace', () => {
    const sentence = floorSentence(floored, 'lose');

    expect(sentence).toContain('below what is safe');
    expect(sentence).toContain('1200 calories');
    expect(sentence).toContain('0.26 kg');
    expect(sentence).toContain('rather than the pace you picked');
  });

  // covers: AC-8. The honest edge: the safe number is above maintenance, so
  // naming a losing pace would be a lie. It says so instead.
  it('does not claim a losing pace when the safe number is above maintenance', () => {
    const tiny = computeCalorieTarget({
      sex: 'female',
      ageYears: 60,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'sedentary',
      goalDirection: 'lose',
      goalRateKgPerWeek: 1.5,
    });

    const sentence = floorSentence(tiny, 'lose');

    expect(sentence).toContain('not expected to lose weight');
    expect(sentence).not.toContain('rather than the pace you picked');
  });
});

describe('detailSentences', () => {
  const target = computeCalorieTarget({
    sex: 'female',
    ageYears: 35,
    heightCm: 165,
    weightKg: 70,
    activityLevel: 'moderate',
    goalDirection: 'lose',
    goalRateKgPerWeek: 0.5,
  });

  // covers: AC-9. Names the formula and calls the number an estimate.
  it('names the formula and says plainly that it is an estimate', () => {
    const detail = detailSentences(target).join(' ');

    expect(detail).toContain('Mifflin-St Jeor');
    expect(detail).toContain('estimate');
    expect(detail).toContain('mifflin-st-jeor-v1');
  });

  // covers: AC-9. A health number shown to somebody who will act on it says
  // what to do when it turns out to be wrong.
  it('tells the person what to do if it does not match reality', () => {
    expect(detailSentences(target).join(' ')).toContain('change the number');
  });
});

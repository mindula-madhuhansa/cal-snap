import { describe, expect, it } from 'vitest';

import {
  FIRST_STEP,
  LAST_STEP,
  ONBOARDING_STEPS,
  isOnboardingStep,
  nextStep,
  previousStep,
  progressOf,
  type OnboardingStep,
} from './onboarding-steps';

describe('the step order', () => {
  // covers: AC-2. Exactly these questions, in this order, and nothing else.
  it('asks consent first and the eight questions the spec names', () => {
    expect(ONBOARDING_STEPS).toStrictEqual([
      'consent',
      'sex',
      'age',
      'height',
      'weight',
      'activity',
      'goal_direction',
      'goal_pace',
      'result',
    ]);
  });

  // covers: AC-3. Consent comes before any health question, so nothing is
  // collected before it is agreed to.
  it('puts consent ahead of every health question', () => {
    expect(FIRST_STEP).toBe('consent');
    expect(ONBOARDING_STEPS.indexOf('consent')).toBeLessThan(ONBOARDING_STEPS.indexOf('sex'));
  });

  it('recognises a stored step and rejects anything else', () => {
    expect(isOnboardingStep('height')).toBe(true);
    expect(isOnboardingStep('blood_type')).toBe(false);
    expect(isOnboardingStep('')).toBe(false);
  });
});

describe('moving through the flow', () => {
  // covers: AC-2
  it('walks forward from the first step to the last', () => {
    const walked: OnboardingStep[] = [FIRST_STEP];
    let step = nextStep(FIRST_STEP);
    while (step !== undefined) {
      walked.push(step);
      step = nextStep(step);
    }

    expect(walked).toStrictEqual([...ONBOARDING_STEPS]);
    expect(walked.at(-1)).toBe(LAST_STEP);
  });

  // covers: AC-2. The back step works everywhere except the very first screen,
  // where there is nothing behind it.
  it('goes back from every step but the first', () => {
    expect(previousStep('consent')).toBeUndefined();
    for (const step of ONBOARDING_STEPS.slice(1)) {
      expect(previousStep(step)).toBeDefined();
    }
    expect(previousStep('weight')).toBe('height');
  });

  it('has nothing after the result, which is where the flow ends', () => {
    expect(nextStep(LAST_STEP)).toBeUndefined();
  });
});

describe('progressOf', () => {
  // covers: AC-2. Visible progress, counting questions rather than screens, so
  // the result screen never reads as a question nobody answered.
  it('counts the eight questions and not the result', () => {
    expect(progressOf('consent')).toStrictEqual({ position: 1, total: 8 });
    expect(progressOf('goal_pace')).toStrictEqual({ position: 8, total: 8 });
    expect(progressOf('result')).toStrictEqual({ position: 8, total: 8 });
  });

  it('never reports a position past the total', () => {
    for (const step of ONBOARDING_STEPS) {
      const { position, total } = progressOf(step);
      expect(position).toBeGreaterThanOrEqual(1);
      expect(position).toBeLessThanOrEqual(total);
    }
  });
});

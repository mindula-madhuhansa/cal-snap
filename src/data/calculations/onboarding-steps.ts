/**
 * The order the setup questions are asked in, and the arithmetic of moving
 * through them (spec 0006, AC-2).
 *
 * Pure, and deliberately separate from the screens: the order is a rule, not a
 * layout, and `onboarding_draft.current_step` stores exactly these values. A
 * screen renders a step; it does not decide what comes next.
 */

export const ONBOARDING_STEPS = [
  'consent',
  'sex',
  'age',
  'height',
  'weight',
  'activity',
  'goal_direction',
  'goal_pace',
  'result',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** The first question anyone sees. Consent comes before any health question (AC-3). */
export const FIRST_STEP: OnboardingStep = 'consent';

/** Terminal: leaving it commits the answers and deletes the draft (AC-6). */
export const LAST_STEP: OnboardingStep = 'result';

export const isOnboardingStep = (value: string): value is OnboardingStep =>
  (ONBOARDING_STEPS as readonly string[]).includes(value);

const indexOf = (step: OnboardingStep): number => ONBOARDING_STEPS.indexOf(step);

/** The step after this one. `result` has none, because it is where the flow ends. */
export const nextStep = (step: OnboardingStep): OnboardingStep | undefined =>
  ONBOARDING_STEPS[indexOf(step) + 1];

/** The step before this one. `consent` has none, so the back step is absent there (AC-2). */
export const previousStep = (step: OnboardingStep): OnboardingStep | undefined =>
  indexOf(step) === 0 ? undefined : ONBOARDING_STEPS[indexOf(step) - 1];

export type Progress = {
  /** Which question this is, counting from 1. */
  readonly position: number;
  /** How many questions there are. `result` is not one of them. */
  readonly total: number;
};

/**
 * Where the person is, for the progress indicator. `result` is excluded from
 * the count because it is an answer and not a question, so the indicator never
 * reads "9 of 9" on a screen with nothing to answer.
 */
export const progressOf = (step: OnboardingStep): Progress => ({
  position: Math.min(indexOf(step) + 1, ONBOARDING_STEPS.length - 1),
  total: ONBOARDING_STEPS.length - 1,
});

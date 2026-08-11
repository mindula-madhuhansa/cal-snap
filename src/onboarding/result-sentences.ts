import type { CalorieTarget, GoalDirection } from '@/data/calculations/calorie-target';

/**
 * What the result screen says, as pure functions (spec 0006, AC-8 and AC-9).
 *
 * Separated from the screen because these sentences are the feature's promise
 * about honesty: the number is presented as an estimate, and when the safety
 * floor moved it, the screen says so and names the pace really being applied.
 * A sentence that can be tested at a desk is one that cannot quietly change.
 */

const GOAL_PHRASES: Readonly<Record<GoalDirection, string>> = {
  lose: 'to lose weight steadily',
  hold: 'to stay about where you are',
  gain: 'to gain weight steadily',
};

/** The one plain sentence, naming the goal the number serves. */
export const targetSentence = (calories: number, goal: GoalDirection): string =>
  `Eat about ${calories} calories a day ${GOAL_PHRASES[goal]}.`;

/** Rounded the way a person would say it, so 0.26 reads as a quarter kilo and not as noise. */
const sayRate = (kgPerWeek: number): string => {
  const rounded = Math.round(Math.abs(kgPerWeek) * 100) / 100;
  return `${rounded} kg`;
};

/**
 * What the screen says when the floor bound, or nothing when it did not.
 *
 * Naming the slower pace is the whole point. Telling someone their target was
 * raised for safety while still showing the pace they asked for would be a
 * more comfortable sentence and a false one, and they would wonder for weeks
 * why the weight was not coming off as fast as the app promised.
 */
export const floorSentence = (target: CalorieTarget, goal: GoalDirection): string | undefined => {
  if (target.flooredFrom === undefined) return undefined;

  const rate = target.effectiveRateKgPerWeek;

  if (goal === 'gain' || rate <= 0) {
    return `That pace would have put your target below what is safe to eat, so we raised it to ${target.calories} calories. At this number you are not expected to lose weight, so it is worth choosing a gentler goal or checking in with a doctor.`;
  }

  return `That pace would have put your target below what is safe to eat, so we raised it to ${target.calories} calories. That works out at about ${sayRate(rate)} a week rather than the pace you picked.`;
};

/** The expandable detail: what made the number, and that it is an estimate. */
export const detailSentences = (target: CalorieTarget): readonly string[] => [
  'This is an estimate, not a measurement. It comes from the Mifflin-St Jeor equation, which works out roughly what a body your size burns at rest, scaled by how active you said you are.',
  'Bodies vary, so treat it as a starting point. If the scale is not moving the way you expect after a few weeks, change the number rather than assuming it is right.',
  `Recorded as ${target.formulaVersion}, so this day keeps saying what produced it even after the formula changes.`,
];

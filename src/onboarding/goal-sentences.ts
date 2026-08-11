import { shiftDay } from '@/data/calculations/local-day';
import type { GoalDirection } from '@/data/calculations/calorie-target';
import type { UnitPreference } from '@/data/calculations/units';

/**
 * What the "Your goal" section says (spec 0006, AC-11 and AC-12).
 *
 * Pure, and separate from the screen, because one of these sentences is a
 * promise the data layer keeps: a change starts tomorrow and never touches a
 * day already written. Saying it wrongly would be worse than not saying it.
 */

/** The first day a change can reach, which is never today. */
export const startsOn = (today: string): string => shiftDay(today, 1);

/**
 * Why a change does not apply now. Said in full rather than as "starts
 * tomorrow" alone, because the reason is the reassuring part: today's number
 * is the one they have been eating against and it is not being moved under
 * them.
 */
export const startsTomorrowSentence = (today: string): string =>
  `This starts on ${startsOn(today)}. Today's target stays as it is, because it is the one you have been eating against.`;

const BASIS: Readonly<Record<'computed' | 'manual', string>> = {
  computed: 'Worked out from your answers',
  manual: 'A number you set yourself',
};

/** Where today's target came from, said plainly under the number. */
export const basisSentence = (source: 'computed' | 'manual'): string => BASIS[source];

const GOAL_SUMMARY: Readonly<Record<GoalDirection, string>> = {
  lose: 'Losing weight',
  hold: 'Staying where you are',
  gain: 'Gaining weight',
};

/** The one line summary of the goal, for the row above the answers. */
export const goalSummary = (goal: GoalDirection, rateKgPerWeek: number): string => {
  if (goal === 'hold') return GOAL_SUMMARY.hold;
  const rate = Math.round(rateKgPerWeek * 100) / 100;
  return `${GOAL_SUMMARY[goal]}, about ${rate} kg a week`;
};

/** An answer said back to the person in the units they chose. */
export const heightSummary = (heightCm: number, units: UnitPreference): string => {
  if (units === 'metric') return `${Math.round(heightCm)} cm`;
  const totalInches = Math.round(heightCm / 2.54);
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
};

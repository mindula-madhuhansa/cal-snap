import { resolveLocalHour } from './local-day';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

/**
 * The guess spec 0002 fixed, by the local hour of the meal:
 *
 *   04:00 up to 11:00  breakfast
 *   11:00 up to 15:00  lunch
 *   17:00 up to 21:00  dinner
 *   every other hour   snack
 *
 * The gaps are deliberate. 15:00 to 17:00 and 21:00 to 04:00 are snack hours,
 * which is what a person eating at four in the afternoon would call it.
 *
 * Always overridable, and `meal_type_source` records which of the two it was.
 */
export const guessMealTypeFromHour = (hour: number): MealType => {
  if (hour >= 4 && hour < 11) return 'breakfast';
  if (hour >= 11 && hour < 15) return 'lunch';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'snack';
};

/** The same guess from an instant and the zone the device was in. */
export const guessMealType = (instant: Date, timeZone: string): MealType => {
  const hour = resolveLocalHour(instant, timeZone);
  // An unrecognised zone should not stop a meal being saved. `snack` is the
  // honest fallback: it claims the least, and the user can change it.
  if (hour === undefined) return 'snack';
  return guessMealTypeFromHour(hour);
};

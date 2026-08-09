import type { Table } from '../types';

import { dailyTargets } from './daily-targets';
import { mealItems } from './meal-items';
import { mealScans } from './meal-scans';
import { meals } from './meals';
import { profiles } from './profiles';
import { weightEntries } from './weight-entries';

/**
 * The six tables release 1 creates, in dependency order: a table never
 * references one that comes after it. `meal_scans` is before `meals` because
 * `meals.scan_id` points at it, and `meals` is before `meal_items`.
 *
 * `exercise_entries` is designed in spec 0002 but built with release 2
 * (build plan step 11), and `subscriptions` is designed only. `sync_state`
 * arrives with the sync functions in build plan step 8.
 */
export const releaseOneTables: readonly Table[] = [
  profiles,
  mealScans,
  meals,
  mealItems,
  dailyTargets,
  weightEntries,
];

export { dailyTargets, mealItems, mealScans, meals, profiles, weightEntries };

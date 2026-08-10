import type { Table } from '../types';

import { dailyTargets } from './daily-targets';
import { mealItems } from './meal-items';
import { mealScans } from './meal-scans';
import { meals } from './meals';
import { onboardingDraft } from './onboarding-draft';
import { profiles } from './profiles';
import { targetOverrides } from './target-overrides';
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

/**
 * Spec 0006's two tables, which ship together in SQLite migration 4.
 *
 * They are a separate list rather than six more entries in `releaseOneTables`
 * because that list generates migration 2, which has shipped. Adding to it
 * would retroactively change what a phone already ran, and
 * `CORE_DATA_MODEL_FINGERPRINT` fails the suite if anything tries.
 */
export const onboardingTables: readonly Table[] = [targetOverrides, onboardingDraft];

/**
 * Every table that syncs, in dependency order, across all specs. `remote/` and
 * the parity check both read this rather than `releaseOneTables`, so a table
 * added by a later spec is pushed and pulled without an edit in either place.
 *
 * `onboarding_draft` is deliberately absent: it is `presence: 'sqlite'`, so it
 * never reaches Postgres and never enters a push (spec 0006, AC-13).
 */
export const syncedTableDeclarations: readonly Table[] = [...releaseOneTables, targetOverrides];

export {
  dailyTargets,
  mealItems,
  mealScans,
  meals,
  onboardingDraft,
  profiles,
  targetOverrides,
  weightEntries,
};

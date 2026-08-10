import {
  between,
  decimal,
  greaterThan,
  integer,
  oneOf,
  text,
  timestamptz,
  type Table,
} from '../types';

/**
 * The answers given so far during first run setup, one row per user (spec
 * 0006, AC-5). Force quitting halfway and reopening returns the person to the
 * question that was next with everything before it intact.
 *
 * **Every answer column is nullable, and that is the whole reason this table
 * exists.** `profiles` requires all of them, on purpose: a profile row means a
 * complete answer set. A half answered profile has no honest shape, so the
 * partial state lives here and moves across in one transaction at the end.
 *
 * `presence: 'sqlite'` keeps it off Postgres entirely (AC-13): it is never
 * generated into the Supabase migration and never enters a push. It lives
 * inside the per account database file, which is what makes AC-17 free.
 * Signing out removes the file and the unfinished draft with it.
 */
export const onboardingDraft: Table = {
  name: 'onboarding_draft',
  presence: 'sqlite',
  timestamps: true,
  softDelete: false,
  primaryKey: ['user_id'],
  columns: [
    { name: 'user_id', type: text, nullable: false },
    {
      name: 'current_step',
      type: text,
      nullable: false,
      checks: [
        oneOf(
          'consent',
          'sex',
          'age',
          'height',
          'weight',
          'activity',
          'goal_direction',
          'goal_pace',
          'result',
        ),
      ],
    },
    // Each of these mirrors its `profiles` or `weight_entries` column exactly,
    // same type and same bounds, differing only in being nullable. A check on
    // a null value passes in both dialects, so an unanswered question is not
    // an out of bounds one.
    { name: 'sex', type: text, nullable: true, checks: [oneOf('female', 'male')] },
    { name: 'age_years', type: integer, nullable: true, checks: [between(13, 120)] },
    { name: 'height_cm', type: decimal(5, 1), nullable: true, checks: [greaterThan(0)] },
    { name: 'weight_kg', type: decimal(5, 2), nullable: true, checks: [between(20, 500)] },
    {
      name: 'activity_level',
      type: text,
      nullable: true,
      checks: [oneOf('sedentary', 'light', 'moderate', 'active', 'very_active')],
    },
    { name: 'goal_direction', type: text, nullable: true, checks: [oneOf('lose', 'hold', 'gain')] },
    {
      name: 'goal_rate_kg_per_week',
      type: decimal(3, 2),
      nullable: true,
      checks: [between(0, 1.5)],
    },
    { name: 'goal_weight_kg', type: decimal(5, 2), nullable: true },
    {
      name: 'unit_preference',
      type: text,
      nullable: true,
      checks: [oneOf('metric', 'imperial')],
    },
    { name: 'consented_at', type: timestamptz, nullable: true },
  ],
};

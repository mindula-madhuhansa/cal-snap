import {
  between,
  boolean,
  date,
  decimal,
  greaterThan,
  integer,
  oneOf,
  text,
  timestamptz,
  uuid,
  type Table,
} from '../types';

/**
 * One row per user. No `deleted_at`: removing a profile means removing the
 * account, which the cascade from `auth.users` does.
 *
 * Age is the number given at onboarding plus the date it was given, because
 * the design asks for age and not a birthday. The app never invents a birth
 * date it was not told (spec 0002, Consequences).
 */
export const profiles: Table = {
  name: 'profiles',
  presence: 'both',
  timestamps: true,
  softDelete: false,
  primaryKey: ['user_id'],
  columns: [
    {
      name: 'user_id',
      type: uuid,
      nullable: false,
      references: {
        table: 'auth.users',
        column: 'id',
        onDelete: 'cascade',
        postgresOnly: true,
      },
    },
    { name: 'age_years', type: integer, nullable: false, checks: [between(13, 120)] },
    { name: 'age_recorded_on', type: date, nullable: false },
    { name: 'sex', type: text, nullable: false, checks: [oneOf('female', 'male')] },
    { name: 'height_cm', type: decimal(5, 1), nullable: false, checks: [greaterThan(0)] },
    {
      name: 'activity_level',
      type: text,
      nullable: false,
      checks: [oneOf('sedentary', 'light', 'moderate', 'active', 'very_active')],
    },
    {
      name: 'goal_direction',
      type: text,
      nullable: false,
      checks: [oneOf('lose', 'hold', 'gain')],
    },
    {
      name: 'goal_rate_kg_per_week',
      type: decimal(3, 2),
      nullable: false,
      default: 0,
      checks: [between(0, 1.5)],
    },
    { name: 'goal_weight_kg', type: decimal(5, 2), nullable: true },
    {
      name: 'unit_preference',
      type: text,
      nullable: false,
      default: 'metric',
      checks: [oneOf('metric', 'imperial')],
    },
    { name: 'timezone', type: text, nullable: false },
    {
      name: 'exercise_credit',
      type: text,
      nullable: false,
      default: 'full',
      checks: [oneOf('none', 'full', 'partial')],
    },
    {
      name: 'exercise_credit_factor',
      type: decimal(3, 2),
      nullable: false,
      default: 1,
      checks: [between(0, 1)],
    },
    { name: 'photo_sync_enabled', type: boolean, nullable: false, default: false },
    { name: 'consented_at', type: timestamptz, nullable: true },
    { name: 'consent_version', type: text, nullable: true },
    { name: 'onboarded_at', type: timestamptz, nullable: true },
  ],
};

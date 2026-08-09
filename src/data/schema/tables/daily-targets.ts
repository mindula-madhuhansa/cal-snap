import {
  date,
  decimal,
  greaterThan,
  integer,
  oneOf,
  text,
  userId,
  uuid,
  type Table,
} from '../types';

/**
 * The calorie target that applied on one local calendar date. Written once,
 * on first use of that day, and never recomputed: a past day keeps the target
 * the person was actually eating against (spec 0002, key invariants).
 *
 * The identifier is deterministic (UUID version 5 over the project namespace,
 * the `user_id`, and the `on_date`), so two offline devices that each decide
 * to create Tuesday's target produce the same row rather than colliding on
 * the unique index, where newest write wins cannot see the conflict.
 */
export const dailyTargets: Table = {
  name: 'daily_targets',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    userId,
    { name: 'on_date', type: date, nullable: false },
    { name: 'calories', type: integer, nullable: false, checks: [greaterThan(0)] },
    { name: 'protein_g', type: decimal(6, 1), nullable: true },
    { name: 'carbs_g', type: decimal(6, 1), nullable: true },
    { name: 'fat_g', type: decimal(6, 1), nullable: true },
    { name: 'source', type: text, nullable: false, checks: [oneOf('computed', 'manual')] },
    { name: 'formula_version', type: text, nullable: false },
  ],
  indexes: [
    { name: 'user_on_date_live', on: ['user_id', 'on_date'], unique: true, scope: 'live' },
    { name: 'user_on_date', on: ['user_id', 'on_date'] },
    { name: 'user_id', on: ['user_id'] },
  ],
};

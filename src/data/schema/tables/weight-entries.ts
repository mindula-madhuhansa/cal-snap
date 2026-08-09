import {
  between,
  date,
  decimal,
  oneOf,
  text,
  timestamptz,
  userId,
  uuid,
  type Table,
} from '../types';

/**
 * One weigh in. Kilograms only, everywhere: changing the unit preference
 * changes what is displayed and never what is stored (AC-12).
 *
 * Like `daily_targets`, this table is keyed by a day rather than by an event,
 * so its identifier is deterministic (UUID version 5 over the project
 * namespace, the `user_id`, and the `on_date`). One live weigh in per day; a
 * second replaces the first.
 */
export const weightEntries: Table = {
  name: 'weight_entries',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    userId,
    { name: 'on_date', type: date, nullable: false },
    { name: 'recorded_at', type: timestamptz, nullable: false },
    { name: 'weight_kg', type: decimal(5, 2), nullable: false, checks: [between(20, 500)] },
    { name: 'source', type: text, nullable: false, checks: [oneOf('onboarding', 'manual')] },
  ],
  indexes: [
    { name: 'user_on_date_live', on: ['user_id', 'on_date'], unique: true, scope: 'live' },
    { name: 'user_on_date', on: ['user_id', 'on_date'] },
    { name: 'user_id', on: ['user_id'] },
  ],
};

import { decimal, json, oneOf, text, userId, uuid, type Table } from '../types';

/**
 * One call to the vision model, kept whether or not it became a meal: a scan
 * the user discards still leaves its record and its cost.
 *
 * No `deleted_at`, because a scan record is not user facing content. The
 * `(user_id, created_at)` index is the scan counter: counting over a date
 * range answers usage with no separate table and no counter to keep in step
 * (AC-15).
 */
export const mealScans: Table = {
  name: 'meal_scans',
  presence: 'both',
  timestamps: true,
  softDelete: false,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    userId,
    { name: 'model', type: text, nullable: false },
    { name: 'prompt_version', type: text, nullable: false },
    {
      name: 'status',
      type: text,
      nullable: false,
      checks: [oneOf('ok', 'low_confidence', 'unrecognised', 'failed')],
    },
    { name: 'confidence', type: text, nullable: true, checks: [oneOf('high', 'medium', 'low')] },
    { name: 'raw_response', type: json, nullable: true },
    { name: 'cost_cents', type: decimal(6, 3), nullable: true },
  ],
  indexes: [
    { name: 'user_created_at', on: ['user_id', 'created_at'] },
    { name: 'user_id', on: ['user_id'] },
  ],
};

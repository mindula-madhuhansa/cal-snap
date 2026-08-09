import { date, oneOf, text, timestamptz, userId, uuid, type Table } from '../types';

/**
 * One eating occasion. `eaten_on` is decided once, at save time, from the
 * device's own clock and zone, and never recomputed: a meal saved at 23:50 in
 * Colombo stays on that date after the phone moves to London (AC-3).
 */
export const meals: Table = {
  name: 'meals',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    userId,
    { name: 'eaten_on', type: date, nullable: false },
    { name: 'eaten_at', type: timestamptz, nullable: false },
    { name: 'tz_at_save', type: text, nullable: false },
    {
      name: 'meal_type',
      type: text,
      nullable: false,
      checks: [oneOf('breakfast', 'lunch', 'dinner', 'snack')],
    },
    {
      name: 'meal_type_source',
      type: text,
      nullable: false,
      checks: [oneOf('guessed', 'chosen')],
    },
    { name: 'note', type: text, nullable: true },
    { name: 'photo_local_uri', type: text, nullable: true },
    { name: 'photo_remote_path', type: text, nullable: true },
    { name: 'photo_synced_at', type: timestamptz, nullable: true },
    {
      name: 'scan_id',
      type: uuid,
      nullable: true,
      references: { table: 'meal_scans', column: 'id', onDelete: 'set null' },
    },
  ],
  indexes: [
    { name: 'user_eaten_on_live', on: ['user_id', 'eaten_on'], scope: 'live' },
    { name: 'scan_id', on: ['scan_id'] },
    { name: 'user_id', on: ['user_id'] },
  ],
};

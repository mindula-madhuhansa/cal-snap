import { date, greaterThan, integer, userId, uuid, type Table } from '../types';

/**
 * A daily calorie target the person set themselves, applying from one local
 * date forward (spec 0006, AC-10). Setting one never rewrites a
 * `daily_targets` row that already exists; it changes what tomorrow's row is
 * created from.
 *
 * **The identifier is version 7, not the day scoped version 5 the other date
 * keyed tables use, and that is load bearing.** `daily_targets` and
 * `weight_entries` derive their identifier from the user and the date so two
 * offline devices creating the same day produce one row rather than colliding
 * on a unique index the conflict rule cannot see. Copying that here would be a
 * bug: setting an override, clearing it, and setting another for the same date
 * is an ordinary thing to do, and clearing is a tombstone. A deterministic
 * identifier would make the second set a revival of that exact row, which spec
 * 0005's sticky delete trigger refuses. The push would come back as the
 * tombstone, `pushChanges` would write that whole row into SQLite, and the
 * person's new override would vanish with nothing failing.
 *
 * There is no unique index for the same reason. Two offline devices each
 * setting an override for one date produce two live rows, which is legal here:
 * `resolveOverride` orders rather than assuming one, newest live row first.
 */
export const targetOverrides: Table = {
  name: 'target_overrides',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    userId,
    { name: 'effective_from', type: date, nullable: false },
    { name: 'calories', type: integer, nullable: false, checks: [greaterThan(0)] },
  ],
  indexes: [
    { name: 'user_effective_from', on: ['user_id', 'effective_from'] },
    { name: 'user_id', on: ['user_id'] },
  ],
};

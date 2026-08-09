import {
  atLeast,
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
 * One food on the plate. The `base_*` columns describe a rate (the numbers
 * for `base_per` of `base_unit`), and the resolved columns are that rate
 * applied to `quantity`. Rescaling always recomputes from the rate, never
 * from the last resolved value, so repeated changes cannot drift (AC-6).
 *
 * `edited_fields` is what makes AC-6 buildable: it names the resolved fields
 * the user typed by hand, and those keep their value while the rest rescale.
 * `source` alone cannot express this, because it says the item was edited
 * without saying which part.
 *
 * `user_id` is carried here rather than reached through `meal_id` so that no
 * row level security policy needs a join (spec 0002, security model).
 */
export const mealItems: Table = {
  name: 'meal_items',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    {
      name: 'meal_id',
      type: uuid,
      nullable: false,
      references: { table: 'meals', column: 'id', onDelete: 'cascade' },
    },
    userId,
    { name: 'name', type: text, nullable: false },
    { name: 'position', type: integer, nullable: false },
    { name: 'base_per', type: decimal(6, 1), nullable: false, default: 100 },
    { name: 'base_unit', type: text, nullable: false, checks: [oneOf('g', 'ml', 'piece')] },
    { name: 'base_calories', type: integer, nullable: false, checks: [atLeast(0)] },
    { name: 'base_protein_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    { name: 'base_carbs_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    { name: 'base_fat_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    { name: 'quantity', type: decimal(7, 1), nullable: false, checks: [greaterThan(0)] },
    { name: 'calories', type: integer, nullable: false, checks: [atLeast(0)] },
    { name: 'protein_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    { name: 'carbs_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    { name: 'fat_g', type: decimal(6, 1), nullable: false, checks: [atLeast(0)] },
    {
      name: 'source',
      type: text,
      nullable: false,
      checks: [oneOf('ai_scan', 'manual', 'ai_edited')],
    },
    { name: 'edited_fields', type: text, nullable: true },
    { name: 'confidence', type: text, nullable: true, checks: [oneOf('high', 'medium', 'low')] },
  ],
  indexes: [
    { name: 'meal_id', on: ['meal_id'] },
    { name: 'user_id', on: ['user_id'] },
    { name: 'user_name_lower', on: ['user_id', 'lower(name)'] },
  ],
};

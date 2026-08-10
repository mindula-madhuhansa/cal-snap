import { text, type Table } from '../types';

/**
 * The pull watermark, one row per synced table (spec 0002, data model sketch).
 *
 * SQLite only, and never synced: it describes how far *this* device got, not
 * the diary. It carries no `user_id` because the file already belongs to one
 * account, and no lifecycle columns because a watermark has no history worth
 * keeping.
 *
 * Without it the device has no memory of how far it got and every pull would
 * be a full download. A table with **no row here pulls from the beginning of
 * time**, which is the fresh device case and the only way spec 0004's AC-9 can
 * hold.
 *
 * Deliberately absent from `releaseOneTables`: that list is what SQLite
 * migration 2 shipped, and adding to it would rewrite a migration phones have
 * already run. This table arrives in migration 3 instead.
 */
export const syncState: Table = {
  name: 'sync_state',
  presence: 'sqlite',
  timestamps: false,
  softDelete: false,
  primaryKey: ['table_name'],
  columns: [
    { name: 'table_name', type: text, nullable: false },
    { name: 'last_pulled_at', type: text, nullable: false },
    { name: 'last_pushed_at', type: text, nullable: true },
  ],
};

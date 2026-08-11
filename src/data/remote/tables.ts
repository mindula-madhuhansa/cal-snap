import { sharedColumns } from '../schema/resolve';
import { syncedTableDeclarations } from '../schema/tables/all';
import type { Column, Table } from '../schema/types';

/**
 * What sync needs to know about a table, derived from the one declaration in
 * `src/data/schema/` rather than listed again here.
 *
 * That derivation is the point. A column added to a table file is pushed and
 * pulled from the next launch with no edit in this folder, so the two halves
 * of the app cannot drift apart the way a hand kept list always eventually
 * does.
 */

export type SyncTable = {
  readonly name: string;
  /** The single primary key column, which every push upserts on. */
  readonly key: string;
  /**
   * The columns both databases share, in declaration order. `is_dirty` and
   * `synced_at` are deliberately absent: they describe this device's
   * relationship to the server, and a second phone must never inherit them.
   */
  readonly columns: readonly Column[];
};

const asSyncTable = (table: Table): SyncTable => {
  const [key, ...rest] = table.primaryKey;

  // Every synced table has a single column key (`id`, or `user_id` on
  // `profiles`). A composite key would need a different upsert and a
  // different conflict target, so it fails here rather than silently pushing
  // half a key.
  if (key === undefined || rest.length > 0) {
    throw new Error(
      `${table.name} does not have a single column primary key, which sync requires.`,
    );
  }

  return { name: table.name, key, columns: sharedColumns(table) };
};

/**
 * Every synced table, in dependency order, so a pull inserts a meal before
 * its items and a push never sends a child whose parent the server has not
 * seen.
 */
export const syncedTables: readonly SyncTable[] = syncedTableDeclarations.map(asSyncTable);

export const syncTableNames: readonly string[] = syncedTables.map((table) => table.name);

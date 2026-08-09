import { timestamptz, type Column, type Table } from './types';

/** Which database the columns are being resolved for. */
export type Dialect = 'sqlite' | 'postgres';

/**
 * The columns every synced table carries in both databases. Declared here
 * once rather than repeated in six table files.
 */
const createdAt: Column = { name: 'created_at', type: timestamptz, nullable: false };
const updatedAt: Column = { name: 'updated_at', type: timestamptz, nullable: false };
const deletedAt: Column = { name: 'deleted_at', type: timestamptz, nullable: true };

/**
 * The two columns SQLite carries and Postgres deliberately does not. They
 * describe one device's relationship to the server, not the data, so a second
 * phone must not inherit them (spec 0002, data model sketch).
 *
 * The parity check asserts these are absent from Postgres rather than
 * ignoring them, so a generator that leaked them would fail loudly.
 */
export const SYNC_ONLY_COLUMNS: readonly string[] = ['is_dirty', 'synced_at'];

const isDirty: Column = {
  name: 'is_dirty',
  type: { kind: 'integer' },
  nullable: false,
  default: 0,
};
const syncedAt: Column = { name: 'synced_at', type: timestamptz, nullable: true };

/**
 * The full ordered column list for a table in one dialect: what the table
 * declared, then the lifecycle columns, then the device only sync columns.
 *
 * Order is part of the contract the parity check compares, so it is fixed
 * here rather than left to each generator.
 */
export const resolveColumns = (table: Table, dialect: Dialect): readonly Column[] => {
  const lifecycle: readonly Column[] = table.timestamps ? [createdAt, updatedAt] : [];
  const tombstone: readonly Column[] = table.softDelete ? [deletedAt] : [];
  const sync: readonly Column[] =
    dialect === 'sqlite' && table.presence === 'both' ? [isDirty, syncedAt] : [];

  return [...table.columns, ...lifecycle, ...tombstone, ...sync];
};

/** The columns both databases must agree on, ignoring the device only ones. */
export const sharedColumns = (table: Table): readonly Column[] =>
  resolveColumns(table, 'sqlite').filter((column) => !SYNC_ONLY_COLUMNS.includes(column.name));

/** `<table>_<index>_idx`, so no two tables can produce the same index name. */
export const indexName = (table: string, suffix: string): string => `${table}_${suffix}_idx`;

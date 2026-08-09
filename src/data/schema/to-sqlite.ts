import { renderCheck, renderDefault, sqliteTypeFor } from './checks';
import { indexName, resolveColumns } from './resolve';
import type { Column, Index, Table } from './types';

/**
 * The SQLite half of the generator. A pure function: a table declaration in,
 * SQL text out, no database and no clock.
 *
 * The emitted shape is deliberately rigid (one column per line, modifiers in
 * a fixed order) because the parity check reads this text back and compares
 * it against the Postgres text. Loosening the layout would weaken AC-1.
 */

const columnLine = (column: Column): string => {
  const parts: string[] = [column.name, sqliteTypeFor(column.type)];

  if (!column.nullable) parts.push('NOT NULL');
  if (column.default !== undefined)
    parts.push(`DEFAULT ${renderDefault(column.default, 'sqlite')}`);

  for (const check of column.checks ?? []) {
    parts.push(`CHECK (${renderCheck(column.name, check)})`);
  }

  // `auth.users` is a Postgres table. On the phone the file already belongs to
  // one user, so there is nothing to point the reference at.
  const reference = column.references;
  if (reference !== undefined && reference.postgresOnly !== true) {
    const onDelete = reference.onDelete === 'cascade' ? 'CASCADE' : 'SET NULL';
    parts.push(`REFERENCES ${reference.table}(${reference.column}) ON DELETE ${onDelete}`);
  }

  return `  ${parts.join(' ')}`;
};

const indexStatement = (table: Table, index: Index): string => {
  const unique = index.unique === true ? 'UNIQUE ' : '';
  const where = index.scope === 'live' ? ' WHERE deleted_at IS NULL' : '';
  return `CREATE ${unique}INDEX ${indexName(table.name, index.name)} ON ${table.name} (${index.on.join(', ')})${where};`;
};

/** `CREATE TABLE` plus every index for one table. */
export const tableToSqlite = (table: Table): string => {
  const columns = resolveColumns(table, 'sqlite').map(columnLine);
  const primaryKey = `  PRIMARY KEY (${table.primaryKey.join(', ')})`;
  const body = [...columns, primaryKey].join(',\n');
  const indexes = (table.indexes ?? []).map((index) => indexStatement(table, index));

  return [`CREATE TABLE ${table.name} (\n${body}\n);`, ...indexes].join('\n');
};

/** Every table in order, ready to hand to `db.execAsync` inside a migration. */
export const toSqlite = (tables: readonly Table[]): string =>
  tables.map(tableToSqlite).join('\n\n') + '\n';

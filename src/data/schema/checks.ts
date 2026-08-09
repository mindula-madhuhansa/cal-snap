import type { ColumnCheck, ColumnDefault, ColumnType } from './types';

/** SQL string literal quoting. Only ever applied to values declared in this folder. */
export const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;

/**
 * A check rendered as SQL. Both dialects accept exactly this text, which is
 * what lets the parity check compare the two outputs as strings rather than
 * having to understand two grammars.
 */
export const renderCheck = (column: string, check: ColumnCheck): string => {
  switch (check.check) {
    case 'oneOf':
      return `${column} in (${check.values.map(quote).join(', ')})`;
    case 'atLeast':
      return `${column} >= ${check.value}`;
    case 'greaterThan':
      return `${column} > ${check.value}`;
    case 'between':
      return `${column} between ${check.min} and ${check.max}`;
  }
};

/**
 * A default rendered as SQL. Booleans are the one value that differs by
 * dialect, because SQLite has no boolean type and stores 0 or 1.
 */
export const renderDefault = (value: ColumnDefault, dialect: 'sqlite' | 'postgres'): string => {
  if (typeof value === 'boolean') {
    if (dialect === 'sqlite') return value ? '1' : '0';
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') return String(value);
  return quote(value);
};

/**
 * The one type mapping table, used forward by both generators and again by
 * the parity check to prove that the SQLite type actually emitted is the one
 * this table says corresponds to the Postgres type actually emitted (AC-1).
 *
 * SQLite has no exact decimal type, so every `numeric(p,s)` becomes `REAL`.
 * Keeping the two equal to the declared scale is a rule the write path holds
 * (see `roundToScale` in the calculations), not something the database
 * enforces (AC-13, and spec 0002's stated tradeoff).
 */
export const postgresTypeFor = (type: ColumnType): string => {
  switch (type.kind) {
    case 'uuid':
      return 'uuid';
    case 'text':
      return 'text';
    case 'date':
      return 'date';
    case 'timestamptz':
      return 'timestamptz';
    case 'integer':
      return 'integer';
    case 'boolean':
      return 'boolean';
    case 'json':
      return 'jsonb';
    case 'decimal':
      return `numeric(${type.precision},${type.scale})`;
  }
};

export const sqliteTypeFor = (type: ColumnType): string => {
  switch (type.kind) {
    case 'uuid':
    case 'text':
    case 'date':
    case 'timestamptz':
    case 'json':
      return 'TEXT';
    case 'integer':
    case 'boolean':
      return 'INTEGER';
    case 'decimal':
      return 'REAL';
  }
};

/**
 * The same mapping read backwards, from an emitted Postgres type token to the
 * SQLite token that must sit opposite it. Used only by the parity check.
 */
export const expectedSqliteTypeForPostgres = (postgresType: string): string => {
  if (postgresType.startsWith('numeric(')) return 'REAL';
  switch (postgresType) {
    case 'uuid':
    case 'text':
    case 'date':
    case 'timestamptz':
      return 'TEXT';
    case 'jsonb':
      return 'TEXT';
    case 'integer':
    case 'boolean':
      return 'INTEGER';
    default:
      return `<unmapped: ${postgresType}>`;
  }
};

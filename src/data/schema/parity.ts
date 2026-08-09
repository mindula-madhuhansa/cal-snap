import { expectedSqliteTypeForPostgres } from './checks';
import { SYNC_ONLY_COLUMNS } from './resolve';
import { tableToPostgres } from './to-postgres';
import { tableToSqlite } from './to-sqlite';
import type { Table } from './types';

/**
 * AC-1 says a test must prove the column names, types, nullability, and
 * checks match on both sides. This module does that by reading the *emitted
 * SQL text* of each dialect back into a normalised description and comparing
 * those, rather than by comparing each generator against the declaration it
 * came from.
 *
 * The difference matters: comparing against the declaration twice would pass
 * even if both generators dropped the same clause. Reading the text back
 * catches a generator that loses a `not null`, forgets a check, reorders
 * columns, or maps `numeric(6,1)` to something that is not `REAL`.
 */

export type ParsedColumn = {
  readonly name: string;
  readonly type: string;
  readonly notNull: boolean;
  readonly checks: readonly string[];
};

export type ParityProblem = {
  readonly table: string;
  readonly column?: string;
  readonly detail: string;
};

const CREATE_TABLE = /create table (?:public\.)?(\w+) \(([\s\S]*?)\n\);/i;

/**
 * Both generators emit one column per line, modifiers in a fixed order, so a
 * line is: `name type [not null] [default x] [check (...)] [references ...]`.
 */
const parseColumnLine = (line: string): ParsedColumn | undefined => {
  const trimmed = line.trim().replace(/,$/, '');
  if (trimmed.length === 0) return undefined;
  if (/^primary key/i.test(trimmed)) return undefined;

  // `numeric(6,1)` carries a space-free argument list, so splitting on the
  // first space is safe for the name and the type token alike.
  const match = /^(\w+)\s+(\S+)\s*(.*)$/.exec(trimmed);
  if (match === null) return undefined;

  const [, name = '', type = '', rest = ''] = match;
  const checks = [...rest.matchAll(/check \(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi)].map((found) =>
    (found[1] ?? '').trim().toLowerCase(),
  );

  return {
    name,
    type,
    notNull: /\bnot null\b/i.test(rest),
    checks,
  };
};

/** Every column of one `create table` statement, in emitted order. */
export const parseTable = (sql: string): readonly ParsedColumn[] => {
  const match = CREATE_TABLE.exec(sql);
  if (match === null) return [];
  return (match[2] ?? '')
    .split('\n')
    .map(parseColumnLine)
    .filter((column): column is ParsedColumn => column !== undefined);
};

const compareTable = (table: Table): readonly ParityProblem[] => {
  const problems: ParityProblem[] = [];
  const sqlite = parseTable(tableToSqlite(table));
  const postgres = parseTable(tableToPostgres(table));

  const note = (detail: string, column?: string): void => {
    problems.push(
      column === undefined ? { table: table.name, detail } : { table: table.name, column, detail },
    );
  };

  if (sqlite.length === 0 || postgres.length === 0) {
    note('one or both generators produced no parseable columns');
    return problems;
  }

  // The device only columns exist in SQLite by design and must NOT appear in
  // Postgres. Asserting their absence keeps a leak from passing silently.
  for (const leaked of postgres.filter((column) => SYNC_ONLY_COLUMNS.includes(column.name))) {
    note(`${leaked.name} is a device only column and must not exist in Postgres`, leaked.name);
  }

  const sqliteShared = sqlite.filter((column) => !SYNC_ONLY_COLUMNS.includes(column.name));
  const postgresShared = postgres.filter((column) => !SYNC_ONLY_COLUMNS.includes(column.name));

  const sqliteNames = sqliteShared.map((column) => column.name).join(', ');
  const postgresNames = postgresShared.map((column) => column.name).join(', ');
  if (sqliteNames !== postgresNames) {
    note(
      `column names or order differ.\n    sqlite:   ${sqliteNames}\n    postgres: ${postgresNames}`,
    );
    return problems;
  }

  for (const [position, pg] of postgresShared.entries()) {
    const lite = sqliteShared[position];
    if (lite === undefined) continue;

    const expected = expectedSqliteTypeForPostgres(pg.type);
    if (lite.type !== expected) {
      note(`postgres ${pg.type} should map to SQLite ${expected}, got ${lite.type}`, pg.name);
    }

    if (lite.notNull !== pg.notNull) {
      note(
        `nullability differs: sqlite ${lite.notNull ? 'NOT NULL' : 'nullable'}, postgres ${pg.notNull ? 'not null' : 'nullable'}`,
        pg.name,
      );
    }

    const liteChecks = [...lite.checks].sort().join(' | ');
    const pgChecks = [...pg.checks].sort().join(' | ');
    if (liteChecks !== pgChecks) {
      note(
        `checks differ.\n    sqlite:   ${liteChecks || '(none)'}\n    postgres: ${pgChecks || '(none)'}`,
        pg.name,
      );
    }

    // AC-13: SQLite has no exact decimal type, so every decimal column must
    // land on REAL and its scale must be known, because keeping the two equal
    // to that scale is the write path's job, not the database's.
    if (pg.type.startsWith('numeric(') && lite.type !== 'REAL') {
      note(`decimal column must be REAL in SQLite, got ${lite.type}`, pg.name);
    }
  }

  return problems;
};

export type ParityResult =
  | { readonly kind: 'match'; readonly tablesCompared: number; readonly columnsCompared: number }
  | { readonly kind: 'mismatch'; readonly problems: readonly ParityProblem[] };

/** Compares every table's two generated schemas. The whole of AC-1. */
export const verifySchemaParity = (tables: readonly Table[]): ParityResult => {
  const synced = tables.filter((table) => table.presence === 'both');
  const problems = synced.flatMap(compareTable);

  if (problems.length > 0) return { kind: 'mismatch', problems };

  return {
    kind: 'match',
    tablesCompared: synced.length,
    columnsCompared: synced.reduce(
      (total, table) => total + parseTable(tableToPostgres(table)).length,
      0,
    ),
  };
};

import type { SqlValue } from '../local/database';
import type { Column } from '../schema/types';

import type { SyncTable } from './tables';

/**
 * The translation between a SQLite row and the JSON Supabase speaks.
 *
 * Three differences, and every one of them is a silent corruption if it is
 * missed rather than an error:
 *
 * - **Booleans.** SQLite has no boolean type and stores 0 or 1. Postgres
 *   wants `true`/`false`, and sending 0 into a `boolean` column fails.
 * - **JSON.** SQLite holds a `json` column as text. Postgres holds `jsonb`,
 *   so sending the text stores a JSON *string* rather than the object, and
 *   the value comes back a different shape than it went out.
 * - **Instants.** Postgres returns `2026-08-09T12:00:00+00:00`; the app
 *   stores `2026-08-09T12:00:00.000Z`. Both name the same moment, and the
 *   pull watermark compares them as **text**, so a mixed format would make
 *   the watermark jump or stall. Every instant is normalised on the way in.
 *
 * Dates (`YYYY-MM-DD`) are deliberately not normalised through `Date`, which
 * would drag them through a timezone and can move the day.
 *
 * Pure, and driven by the column declarations, so a new column of a known
 * type needs no edit here.
 */

export type RemoteValue = string | number | boolean | null | object;
export type RemoteRow = Readonly<Record<string, RemoteValue>>;
export type LocalRow = Readonly<Record<string, SqlValue>>;

/** An instant in the one format the app stores, whatever format it arrived in. */
export const normaliseInstant = (value: string): string => {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? value : at.toISOString();
};

const toRemoteValue = (column: Column, value: SqlValue): RemoteValue => {
  if (value === null) return null;

  switch (column.type.kind) {
    case 'boolean':
      return value !== 0 && value !== '0';
    case 'json':
      return typeof value === 'string' ? (JSON.parse(value) as object) : value;
    case 'timestamptz':
      return typeof value === 'string' ? normaliseInstant(value) : value;
    default:
      return value;
  }
};

const toLocalValue = (column: Column, value: RemoteValue | undefined): SqlValue => {
  if (value === null || value === undefined) return null;

  switch (column.type.kind) {
    case 'boolean':
      return value === true || value === 1 || value === '1' ? 1 : 0;
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'timestamptz':
      return typeof value === 'string' ? normaliseInstant(value) : Number(value);
    case 'integer':
    case 'decimal':
      // PostgREST can hand back a numeric as a string. Coercing here keeps
      // every number in the local file a real number.
      return typeof value === 'string' ? Number(value) : (value as number);
    default:
      return typeof value === 'boolean' ? (value ? 1 : 0) : (value as SqlValue);
  }
};

/** One local row, ready to send. Only the shared columns go, in a fixed order. */
export const toRemoteRow = (table: SyncTable, row: LocalRow): RemoteRow =>
  Object.fromEntries(
    table.columns.map((column) => [column.name, toRemoteValue(column, row[column.name] ?? null)]),
  );

/** One row as it came back, ready to write into the local file. */
export const toLocalRow = (table: SyncTable, row: RemoteRow): LocalRow =>
  Object.fromEntries(
    table.columns.map((column) => [column.name, toLocalValue(column, row[column.name])]),
  );

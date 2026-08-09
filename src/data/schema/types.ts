/**
 * The one place a table is described. Spec 0002 decided that each table is
 * declared once, here, as plain data, and that the SQLite statements, the
 * Postgres statements, and the TypeScript row type are all produced from that
 * declaration. Nothing in this folder imports a database driver.
 *
 * Adding a column means editing its table file and adding a *new* SQLite
 * migration. See `src/data/local/migrations.ts` for why editing a declaration
 * a shipped migration already covers is guarded against.
 */

/** The neutral column types. Each one maps to exactly one type per dialect. */
export type ColumnType =
  | { readonly kind: 'uuid' }
  | { readonly kind: 'text' }
  | { readonly kind: 'date' }
  | { readonly kind: 'timestamptz' }
  | { readonly kind: 'integer' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'json' }
  | { readonly kind: 'decimal'; readonly precision: number; readonly scale: number };

/**
 * The check kinds the spec's data model actually uses. Keeping the set small
 * and closed is what lets the parity check compare checks across two dialects
 * without parsing arbitrary SQL.
 */
export type ColumnCheck =
  | { readonly check: 'oneOf'; readonly values: readonly string[] }
  | { readonly check: 'atLeast'; readonly value: number }
  | { readonly check: 'greaterThan'; readonly value: number }
  | { readonly check: 'between'; readonly min: number; readonly max: number };

export type ColumnDefault = number | string | boolean;

export type ForeignKey = {
  readonly table: string;
  readonly column: string;
  readonly onDelete: 'cascade' | 'set null';
  /**
   * A table that exists in Postgres only. On the phone the file already
   * belongs to one user, so there is nothing to point at.
   */
  readonly postgresOnly?: boolean;
};

export type Column = {
  readonly name: string;
  readonly type: ColumnType;
  readonly nullable: boolean;
  readonly default?: ColumnDefault;
  readonly checks?: readonly ColumnCheck[];
  readonly references?: ForeignKey;
};

/**
 * An index entry is a column name or a SQL expression both dialects accept
 * (`lower(name)` is the only expression the spec asks for, and SQLite and
 * Postgres spell it the same way).
 */
export type Index = {
  /** Suffix only. The full name is `<table>_<name>_idx`. */
  readonly name: string;
  readonly on: readonly string[];
  readonly unique?: boolean;
  /** `live` adds `where deleted_at is null`, the partial index the spec asks for. */
  readonly scope?: 'live';
};

export type Table = {
  readonly name: string;
  /** `sqlite` means the table describes this device and is never synced. */
  readonly presence: 'both' | 'sqlite';
  /** Adds `created_at` and `updated_at`, both required. */
  readonly timestamps: boolean;
  /** Adds `deleted_at`, nullable. A row is never physically deleted by a user. */
  readonly softDelete: boolean;
  readonly columns: readonly Column[];
  readonly primaryKey: readonly string[];
  readonly indexes?: readonly Index[];
};

/** Terse constructors, so a table file reads as a table and not as a type. */
export const uuid: ColumnType = { kind: 'uuid' };
export const text: ColumnType = { kind: 'text' };
export const date: ColumnType = { kind: 'date' };
export const timestamptz: ColumnType = { kind: 'timestamptz' };
export const integer: ColumnType = { kind: 'integer' };
export const boolean: ColumnType = { kind: 'boolean' };
export const json: ColumnType = { kind: 'json' };
export const decimal = (precision: number, scale: number): ColumnType => ({
  kind: 'decimal',
  precision,
  scale,
});

export const oneOf = (...values: readonly string[]): ColumnCheck => ({ check: 'oneOf', values });
export const atLeast = (value: number): ColumnCheck => ({ check: 'atLeast', value });
export const greaterThan = (value: number): ColumnCheck => ({ check: 'greaterThan', value });
export const between = (min: number, max: number): ColumnCheck => ({
  check: 'between',
  min,
  max,
});

/**
 * The user this row belongs to. Every synced table carries it, because every
 * row level security policy tests it and no policy should need a join
 * (spec 0002, security model).
 *
 * It is `text`, not `uuid`, and it points at nothing. Spec 0004 moved identity
 * to Clerk, whose identifiers are strings like `user_2abc...`, so there is no
 * `auth.users` row to reference and no cascade to inherit. Deleting an account
 * is therefore explicit work, not a side effect of the foreign key: the Clerk
 * `user.deleted` webhook (scope feature 10) owns it.
 */
export const userId: Column = {
  name: 'user_id',
  type: text,
  nullable: false,
};

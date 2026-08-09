import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  expectedSqliteTypeForPostgres,
  postgresTypeFor,
  renderCheck,
  renderDefault,
  sqliteTypeFor,
} from './checks';
import { resolveColumns, sharedColumns, SYNC_ONLY_COLUMNS } from './resolve';
import { toPostgres } from './to-postgres';
import { toSqlite } from './to-sqlite';
import { meals, mealItems, profiles, releaseOneTables } from './tables/all';
import { boolean, decimal, integer, json, text, timestamptz, uuid } from './types';

describe('type mapping', () => {
  // covers: AC-1
  it('maps every neutral type to one Postgres type', () => {
    expect(postgresTypeFor(uuid)).toBe('uuid');
    expect(postgresTypeFor(text)).toBe('text');
    expect(postgresTypeFor(timestamptz)).toBe('timestamptz');
    expect(postgresTypeFor(integer)).toBe('integer');
    expect(postgresTypeFor(boolean)).toBe('boolean');
    expect(postgresTypeFor(json)).toBe('jsonb');
    expect(postgresTypeFor(decimal(6, 1))).toBe('numeric(6,1)');
  });

  // covers: AC-13. SQLite has no exact decimal type, so every decimal lands on
  // REAL and the write path keeps it equal to the declared scale.
  it('maps every decimal to REAL in SQLite, whatever its precision', () => {
    expect(sqliteTypeFor(decimal(6, 1))).toBe('REAL');
    expect(sqliteTypeFor(decimal(3, 2))).toBe('REAL');
    expect(sqliteTypeFor(decimal(6, 3))).toBe('REAL');
  });

  it('maps booleans to INTEGER, because SQLite has no boolean', () => {
    expect(sqliteTypeFor(boolean)).toBe('INTEGER');
  });

  // covers: AC-1. The reverse map is what parity compares against, so it must
  // agree with the forward map for every type the schema actually uses.
  it('agrees with the forward map for every type in the real schema', () => {
    const used = releaseOneTables.flatMap((table) =>
      resolveColumns(table, 'postgres').map((column) => column.type),
    );
    for (const type of used) {
      expect(expectedSqliteTypeForPostgres(postgresTypeFor(type))).toBe(sqliteTypeFor(type));
    }
  });

  it('flags an unmapped Postgres type rather than guessing', () => {
    expect(expectedSqliteTypeForPostgres('geography')).toContain('unmapped');
  });
});

describe('renderCheck', () => {
  // covers: AC-1. Both dialects must accept the identical text, which is what
  // lets parity compare the two as strings.
  it('renders each check kind the same way for both databases', () => {
    expect(renderCheck('sex', { check: 'oneOf', values: ['female', 'male'] })).toBe(
      "sex in ('female', 'male')",
    );
    expect(renderCheck('calories', { check: 'atLeast', value: 0 })).toBe('calories >= 0');
    expect(renderCheck('quantity', { check: 'greaterThan', value: 0 })).toBe('quantity > 0');
    expect(renderCheck('age_years', { check: 'between', min: 13, max: 120 })).toBe(
      'age_years between 13 and 120',
    );
  });

  it('escapes a single quote inside an allowed value', () => {
    expect(renderCheck('label', { check: 'oneOf', values: ["it's"] })).toBe("label in ('it''s')");
  });
});

describe('renderDefault', () => {
  // The one value that genuinely differs by dialect.
  it('writes a boolean as 0 or 1 for SQLite and true or false for Postgres', () => {
    expect(renderDefault(false, 'sqlite')).toBe('0');
    expect(renderDefault(true, 'sqlite')).toBe('1');
    expect(renderDefault(false, 'postgres')).toBe('false');
    expect(renderDefault(true, 'postgres')).toBe('true');
  });

  it('writes numbers bare and strings quoted in both', () => {
    expect(renderDefault(100, 'sqlite')).toBe('100');
    expect(renderDefault('metric', 'postgres')).toBe("'metric'");
  });
});

describe('resolveColumns', () => {
  // covers: AC-1
  it('appends the lifecycle columns after the declared ones', () => {
    const names = resolveColumns(meals, 'postgres').map((column) => column.name);
    expect(names.slice(-3)).toEqual(['created_at', 'updated_at', 'deleted_at']);
  });

  it('omits deleted_at from a table that has no tombstone', () => {
    const names = resolveColumns(profiles, 'postgres').map((column) => column.name);
    expect(names).not.toContain('deleted_at');
    expect(names).toContain('updated_at');
  });

  // covers: AC-1
  it('adds the device only sync columns to SQLite and not to Postgres', () => {
    const lite = resolveColumns(meals, 'sqlite').map((column) => column.name);
    const pg = resolveColumns(meals, 'postgres').map((column) => column.name);

    for (const column of SYNC_ONLY_COLUMNS) {
      expect(lite).toContain(column);
      expect(pg).not.toContain(column);
    }
  });

  it('reports the shared columns as the SQLite list minus the device only ones', () => {
    const shared = sharedColumns(meals).map((column) => column.name);
    expect(shared).toEqual(resolveColumns(meals, 'postgres').map((column) => column.name));
  });

  it('keeps the order stable, because parity compares position by position', () => {
    expect(resolveColumns(meals, 'postgres').map((c) => c.name)).toEqual(
      resolveColumns(meals, 'postgres').map((c) => c.name),
    );
  });
});

describe('toSqlite', () => {
  const sql = toSqlite(releaseOneTables);

  // covers: AC-1. The strongest available proof that the generated DDL is
  // valid: run it against a real SQLite engine.
  it('produces DDL a real SQLite database accepts', () => {
    const db = new DatabaseSync(':memory:');
    expect(() => db.exec(sql)).not.toThrow();
    db.close();
  });

  // covers: AC-1
  it('produces the declared columns, in order, on the live database', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(sql);

    for (const table of releaseOneTables) {
      const live = db
        .prepare(`PRAGMA table_info(${table.name})`)
        .all()
        .map((row) => String((row as { name: unknown }).name));
      expect(live).toEqual(resolveColumns(table, 'sqlite').map((column) => column.name));
    }
    db.close();
  });

  it('creates every declared index', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(sql);

    const live = db
      .prepare("select name from sqlite_master where type = 'index' and name like '%_idx'")
      .all()
      .map((row) => String((row as { name: unknown }).name));
    const expected = releaseOneTables.flatMap((table) =>
      (table.indexes ?? []).map((index) => `${table.name}_${index.name}_idx`),
    );

    expect(expected.length).toBe(14);
    for (const name of expected) expect(live).toContain(name);
    db.close();
  });

  it('makes the live database enforce a declared check', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(sql);

    expect(() =>
      db
        .prepare(
          `insert into meals (id, user_id, eaten_on, eaten_at, tz_at_save, meal_type,
             meal_type_source, created_at, updated_at, is_dirty)
           values ('a','b','2026-08-09','2026-08-09T00:00:00Z','UTC','brunch','guessed',
             '2026-08-09T00:00:00Z','2026-08-09T00:00:00Z',0)`,
        )
        .run(),
    ).toThrow();
    db.close();
  });

  it('writes the partial index only where a tombstone exists', () => {
    expect(sql).toContain('WHERE deleted_at IS NULL');
  });

  it('omits the auth.users reference, which exists only in Postgres', () => {
    expect(sql).not.toContain('auth.users');
  });
});

describe('toPostgres', () => {
  const sql = toPostgres(releaseOneTables);

  // covers: AC-2
  it('enables and forces row level security on every table', () => {
    for (const table of releaseOneTables) {
      expect(sql).toContain(`alter table public.${table.name} enable row level security;`);
      expect(sql).toContain(`alter table public.${table.name} force row level security;`);
    }
  });

  // covers: AC-2
  it('writes one own rows policy per table, testing user_id', () => {
    for (const table of releaseOneTables) {
      expect(sql).toContain(`create policy ${table.name}_own_rows on public.${table.name}`);
    }
    expect(sql).toContain('using      (user_id = (select auth.uid()))');
    expect(sql).toContain('with check (user_id = (select auth.uid()))');
  });

  // covers: AC-2. Wrapping auth.uid() in a select makes Postgres evaluate it
  // once per statement rather than once per row.
  it('never calls auth.uid() unwrapped', () => {
    expect(sql).not.toMatch(/=\s*auth\.uid\(\)/);
  });

  // covers: AC-2. Every policy tests user_id on every row it touches, so
  // user_id must be indexed everywhere. On `profiles` it already is, because
  // user_id is the primary key there, and adding a second index over the same
  // column would only cost writes.
  it('indexes user_id on every table, by a dedicated index or by the primary key', () => {
    for (const table of releaseOneTables) {
      const indexedByPrimaryKey = table.primaryKey.includes('user_id');
      const indexedDirectly = sql.includes(`${table.name}_user_id_idx`);
      expect(indexedByPrimaryKey || indexedDirectly).toBe(true);
    }
  });

  it('gives every table without user_id as its primary key a dedicated user_id index', () => {
    const needing = releaseOneTables.filter((table) => !table.primaryKey.includes('user_id'));
    expect(needing).toHaveLength(5);
    for (const table of needing) {
      expect(sql).toContain(`create index ${table.name}_user_id_idx`);
    }
  });

  it('indexes every foreign key column', () => {
    expect(sql).toContain('meal_items_meal_id_idx');
    expect(sql).toContain('meals_scan_id_idx');
  });

  // covers: AC-1
  it('does not create the device only sync columns', () => {
    for (const column of SYNC_ONLY_COLUMNS) {
      expect(sql).not.toContain(`  ${column} `);
    }
  });

  it('creates tables in dependency order, so a reference never points forward', () => {
    expect(sql.indexOf('create table public.meal_scans')).toBeLessThan(
      sql.indexOf('create table public.meals'),
    );
    expect(sql.indexOf('create table public.meals')).toBeLessThan(
      sql.indexOf('create table public.meal_items'),
    );
  });

  it('skips a SQLite only table entirely', () => {
    const localOnly = { ...mealItems, name: 'sync_state', presence: 'sqlite' as const };
    expect(toPostgres([localOnly])).toBe('\n');
  });
});

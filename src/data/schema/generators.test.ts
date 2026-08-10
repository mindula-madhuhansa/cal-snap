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
import { toPostgres, toPostgresSyncTriggers } from './to-postgres';
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

  // covers: AC-2, and spec 0004 AC-7. Identity is Clerk's, so a policy tests
  // the verified token's sub claim rather than auth.uid().
  it('writes one own rows policy per table, testing user_id', () => {
    for (const table of releaseOneTables) {
      expect(sql).toContain(`create policy ${table.name}_own_rows on public.${table.name}`);
    }
    expect(sql).toContain("using      (user_id = (select auth.jwt() ->> 'sub'))");
    expect(sql).toContain("with check (user_id = (select auth.jwt() ->> 'sub'))");
  });

  // covers: AC-2. Wrapping the claim in a select makes Postgres evaluate it
  // once per statement rather than once per row.
  it('never reads the acting identity unwrapped', () => {
    expect(sql).not.toMatch(/=\s*auth\.jwt\(\)/);
  });

  // covers: spec 0004 AC-7. The trap this guards is the reason it exists:
  // under Clerk, auth.uid() returns null rather than failing, so a policy
  // copied from a Supabase example would match zero rows *silently*. That is
  // a security bug that looks like an empty screen. Fail the suite instead.
  it('never mentions auth.uid(), anywhere, in generated SQL', () => {
    expect(sql).not.toContain('auth.uid');
  });

  // covers: spec 0004 AC-7. No row points at auth.users any more: identity is
  // Clerk's, so there is no such row and no cascade. Deletion is explicit
  // work (the Clerk user.deleted webhook, scope feature 10).
  it('references auth.users nowhere', () => {
    expect(sql).not.toContain('auth.users');
  });

  // covers: spec 0004 AC-7. A Clerk identifier is a string, so every user_id
  // must be text. A stray uuid column would reject every real identifier.
  it('declares user_id as text on every table', () => {
    const syncedTables = releaseOneTables.filter((table) => table.presence === 'both');
    const textColumns = sql.match(/user_id text not null/g) ?? [];
    expect(textColumns).toHaveLength(syncedTables.length);
    expect(sql).not.toMatch(/user_id uuid/);
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

  // covers: spec 0005 AC-7. The core migration is applied. If a later change
  // ever leaks into it, this generator rewrites what a database already ran.
  it('keeps the arbitration triggers out of the core migration entirely', () => {
    expect(sql).not.toContain('create trigger');
    expect(sql).not.toContain('sync_stamp');
    expect(sql).not.toContain('clock_timestamp');
  });
});

describe('toPostgresSyncTriggers', () => {
  const sql = toPostgresSyncTriggers(releaseOneTables);
  const softDeleting = releaseOneTables.filter(
    (table) => table.presence === 'both' && table.softDelete,
  );
  const withoutTombstone = releaseOneTables.filter(
    (table) => table.presence === 'both' && !table.softDelete,
  );

  // covers: spec 0005 AC-1. The whole decision in one assertion: the clock
  // belongs to Postgres, and the device's value is overwritten on every write.
  it('assigns updated_at from the server clock in both functions', () => {
    expect(sql.match(/new\.updated_at := clock_timestamp\(\);/g)).toHaveLength(2);
  });

  // covers: spec 0005 AC-6. now() is the transaction's start time, so a whole
  // push batch would share one instant and a pull page that shares its
  // boundary instant stops advancing. A distinct stamp per row removes the
  // dependency between BATCH and PAGE rather than documenting it.
  it('never uses now(), which would stamp a whole batch identically', () => {
    expect(sql).not.toMatch(/:=\s*now\(\)/);
  });

  // covers: spec 0005 AC-4. saveMeal gives a meal and its items one identical
  // created_at and searchPastItems orders on it, but they are pushed in
  // separate statements, so a server stamp on insert would split them. Frozen
  // on update, never assigned on insert.
  it('freezes created_at on update and never stamps it on insert', () => {
    expect(sql.match(/new\.created_at := old\.created_at;/g)).toHaveLength(2);
    expect(sql).not.toMatch(/new\.created_at := clock_timestamp/);
  });

  // covers: spec 0005 AC-3. The rule spec 0002 claimed and only the client
  // enforced, now in the database where a future caller cannot go round it.
  it('refuses to move deleted_at back to null', () => {
    expect(sql).toContain('if old.deleted_at is not null and new.deleted_at is null then');
    expect(sql).toContain('return old;');
  });

  // covers: spec 0005 AC-3. Returning null would cancel the row, PostgREST
  // would leave it out of the reply, and pushChanges would never see an
  // acknowledgement: the row stays dirty and is retried on every sync forever.
  // Returning OLD writes nothing and still puts the stored row in the reply,
  // which is the only way the phone learns it lost.
  it('returns old rather than null, so the refused row is still in the reply', () => {
    expect(sql).not.toMatch(/return null;/);
  });

  // covers: spec 0005 AC-3. A function reading new.deleted_at is attached only
  // where that column exists. NEW is an untyped record, so a mismatch is not
  // caught at creation: it raises on a real write, in production.
  it('gives the sticky variant to exactly the tables that declare a tombstone', () => {
    expect(softDeleting.map((table) => table.name)).toEqual([
      'meals',
      'meal_items',
      'daily_targets',
      'weight_entries',
    ]);

    for (const table of softDeleting) {
      expect(sql).toContain(
        `create trigger ${table.name}_sync_stamp\n  before insert or update on public.${table.name}\n  for each row execute function public.sync_stamp_sticky_delete();`,
      );
    }
  });

  it('gives the plain variant to the tables with no tombstone', () => {
    expect(withoutTombstone.map((table) => table.name)).toEqual(['profiles', 'meal_scans']);

    for (const table of withoutTombstone) {
      expect(sql).toContain(
        `create trigger ${table.name}_sync_stamp\n  before insert or update on public.${table.name}\n  for each row execute function public.sync_stamp();`,
      );
    }
  });

  // covers: spec 0005 AC-1. Six synced tables, six triggers. A table added
  // without one would silently keep trusting the device's clock.
  it('stamps every synced table and no others', () => {
    expect(sql.match(/create trigger /g)).toHaveLength(6);
    expect(sql).not.toContain('sync_state');
  });

  it('fires before the write, on both inserts and updates', () => {
    expect(sql.match(/before insert or update on/g)).toHaveLength(6);
  });

  // The functions read only OLD and NEW, so they need no privilege of their
  // own. security definer would hand them a row level security bypass with no
  // use for it, and an unset search_path is the hazard that makes that
  // dangerous.
  it('takes no privilege it does not need, and pins the search path', () => {
    expect(sql.match(/security invoker/g)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/g)).toHaveLength(2);
    expect(sql).not.toContain('security definer');
  });

  it('emits nothing for a table set that syncs nothing', () => {
    const localOnly = { ...mealItems, name: 'sync_state', presence: 'sqlite' as const };
    expect(toPostgresSyncTriggers([localOnly])).toBe('\n');
  });
});

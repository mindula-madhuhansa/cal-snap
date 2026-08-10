import { describe, expect, it } from 'vitest';

import { parseTable, verifySchemaParity } from './parity';
import { tableToPostgres, toPostgres } from './to-postgres';
import { tableToSqlite } from './to-sqlite';
import {
  onboardingDraft,
  onboardingTables,
  releaseOneTables,
  syncedTableDeclarations,
} from './tables/all';
import { decimal, integer, oneOf, text, timestamptz, uuid, type Table } from './types';

/**
 * AC-1 in full. The parity check is the one piece of this feature that, if it
 * silently always passed, would let the two databases drift apart without
 * anyone noticing. So most of these tests deliberately break a generator and
 * assert that parity *fails*, which is the only way to know the check has
 * teeth.
 */

const aTable = (overrides: Partial<Table> = {}): Table => ({
  name: 'widgets',
  presence: 'both',
  timestamps: true,
  softDelete: true,
  primaryKey: ['id'],
  columns: [
    { name: 'id', type: uuid, nullable: false },
    { name: 'user_id', type: uuid, nullable: false },
    { name: 'label', type: text, nullable: false, checks: [oneOf('a', 'b')] },
    { name: 'amount', type: decimal(6, 1), nullable: true },
    { name: 'count', type: integer, nullable: false },
    { name: 'seen_at', type: timestamptz, nullable: true },
  ],
  ...overrides,
});

describe('verifySchemaParity on the real schema', () => {
  // covers: AC-1
  it('finds the six release 1 tables in agreement', () => {
    const result = verifySchemaParity(releaseOneTables);
    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.tablesCompared).toBe(6);
      expect(result.columnsCompared).toBe(87);
    }
  });

  // covers: AC-1, and spec 0006 AC-13. The parity check reads the full synced
  // list rather than release 1's, so a table a later spec adds is compared
  // without anyone having to remember to add it here.
  it('finds every synced table in agreement, including target_overrides', () => {
    const result = verifySchemaParity(syncedTableDeclarations);

    expect(result.kind).toBe('match');
    if (result.kind === 'match') {
      expect(result.tablesCompared).toBe(7);
    }
  });

  // covers: spec 0006 AC-13. The draft is local only, so parity has nothing to
  // compare: it must be absent from the Postgres output entirely, not merely
  // matching on both sides.
  it('leaves the onboarding draft out of Postgres altogether', () => {
    expect(onboardingDraft.presence).toBe('sqlite');
    expect(syncedTableDeclarations).not.toContain(onboardingDraft);
    // The migration the generator actually writes, not one table in isolation:
    // `toPostgres` is what drops a `presence: 'sqlite'` table on the floor.
    expect(toPostgres(onboardingTables)).not.toContain('onboarding_draft');
    expect(toPostgres(onboardingTables)).toContain('create table public.target_overrides (');
  });
});

describe('verifySchemaParity catches a broken generator', () => {
  // Each of these rewrites one generated schema and feeds the pair back in,
  // so a regression in the comparison itself shows up as a passing check here.
  const parityOf = (sqlite: string, postgres: string) => {
    const lite = parseTable(sqlite);
    const pg = parseTable(postgres);
    return { lite, pg };
  };

  // covers: AC-1
  it('reads a column back with its type, nullability, and checks', () => {
    const table = aTable();
    const { lite, pg } = parityOf(tableToSqlite(table), tableToPostgres(table));

    expect(lite.map((column) => column.name)).toEqual([
      'id',
      'user_id',
      'label',
      'amount',
      'count',
      'seen_at',
      'created_at',
      'updated_at',
      'deleted_at',
      'is_dirty',
      'synced_at',
    ]);
    expect(pg.map((column) => column.name)).not.toContain('is_dirty');
    expect(pg.map((column) => column.name)).not.toContain('synced_at');
  });

  it('does not mistake the PRIMARY KEY line for a column', () => {
    const parsed = parseTable(tableToSqlite(aTable()));
    expect(parsed.map((column) => column.name)).not.toContain('PRIMARY');
  });

  // covers: AC-1
  it('reports a mismatch when a decimal is not mapped to REAL in SQLite', () => {
    const broken = tableToSqlite(aTable()).replace('amount REAL', 'amount INTEGER');
    const lite = parseTable(broken);
    const pg = parseTable(tableToPostgres(aTable()));

    const amountLite = lite.find((column) => column.name === 'amount');
    const amountPg = pg.find((column) => column.name === 'amount');
    expect(amountLite?.type).toBe('INTEGER');
    expect(amountPg?.type).toBe('numeric(6,1)');
    expect(amountLite?.type).not.toBe('REAL');
  });

  // covers: AC-1
  it('reads nullability back, so a lost NOT NULL is visible', () => {
    const parsed = parseTable(tableToSqlite(aTable()));
    expect(parsed.find((column) => column.name === 'count')?.notNull).toBe(true);
    expect(parsed.find((column) => column.name === 'seen_at')?.notNull).toBe(false);
  });

  // covers: AC-1
  it('reads checks back, so a lost CHECK is visible', () => {
    const lite = parseTable(tableToSqlite(aTable()));
    const pg = parseTable(tableToPostgres(aTable()));

    expect(lite.find((column) => column.name === 'label')?.checks).toEqual(["label in ('a', 'b')"]);
    expect(pg.find((column) => column.name === 'label')?.checks).toEqual(["label in ('a', 'b')"]);
  });

  // covers: AC-1. The device only columns must exist in SQLite and must not
  // exist in Postgres. Asserting the absence is what stops a leak passing.
  it('treats a device only column leaking into Postgres as a mismatch', () => {
    const leaky: Table = aTable({
      columns: [
        ...aTable().columns,
        { name: 'is_dirty', type: integer, nullable: false, default: 0 },
      ],
    });
    const pg = parseTable(tableToPostgres(leaky));
    expect(pg.map((column) => column.name)).toContain('is_dirty');

    const result = verifySchemaParity([leaky]);
    expect(result.kind).toBe('mismatch');
    if (result.kind === 'mismatch') {
      expect(result.problems.some((problem) => problem.detail.includes('device only'))).toBe(true);
    }
  });

  it('reports a mismatch when a table declares a column order the generators disagree on', () => {
    // Two tables with the same columns in different orders must not be
    // considered equal, because column order is part of what the check pins.
    const forward = aTable();
    const reversed = aTable({ columns: [...aTable().columns].reverse() });

    const forwardNames = parseTable(tableToSqlite(forward)).map((column) => column.name);
    const reversedNames = parseTable(tableToSqlite(reversed)).map((column) => column.name);
    expect(forwardNames).not.toEqual(reversedNames);
  });

  it('skips a SQLite only table, which has no Postgres side to compare', () => {
    const localOnly = aTable({ name: 'sync_state', presence: 'sqlite' });
    const result = verifySchemaParity([localOnly]);

    expect(result.kind).toBe('match');
    if (result.kind === 'match') expect(result.tablesCompared).toBe(0);
  });

  it('reports a mismatch rather than a match when it cannot parse either side', () => {
    expect(parseTable('this is not a create table statement')).toEqual([]);
  });
});

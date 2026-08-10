import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { releaseOneTables } from '../schema/tables/all';
import { toSqlite } from '../schema/to-sqlite';

import { syncState } from '../schema/tables/sync-state';

import {
  checkMigrationFingerprint,
  checkSyncStateFingerprint,
  coreDataModelSql,
  digestOf,
  syncStateSql,
} from './migrations';

/**
 * Generating a migration that has already shipped creates one hazard a hand
 * written migration does not have: editing a table declaration would rewrite
 * what migration 2 says, and a phone that already ran it would quietly
 * disagree with a phone installing today. The fingerprint is the guard, and
 * these tests are what prove the guard can actually fire.
 */
describe('coreDataModelSql', () => {
  // covers: AC-1
  it('is generated from the declarations, not written by hand', () => {
    expect(coreDataModelSql).toBe(toSqlite(releaseOneTables));
  });

  it('creates all six release 1 tables', () => {
    for (const table of releaseOneTables) {
      expect(coreDataModelSql).toContain(`CREATE TABLE ${table.name} (`);
    }
  });

  it('runs against a real SQLite database', () => {
    const db = new DatabaseSync(':memory:');
    expect(() => db.exec(coreDataModelSql)).not.toThrow();
    db.close();
  });
});

describe('checkMigrationFingerprint', () => {
  // covers: AC-1
  it('reports the shipped migration as unchanged', () => {
    expect(checkMigrationFingerprint()).toEqual({ kind: 'unchanged' });
  });

  // The tripwire. If a table declaration migration 2 covers is edited, this
  // fails and the fix is to add migration 3, never to update the fingerprint.
  it('would report a change if the generated SQL differed by even one character', () => {
    expect(digestOf(coreDataModelSql)).not.toBe(digestOf(`${coreDataModelSql} `));
  });

  it('produces a stable 40 character digest', () => {
    expect(digestOf(coreDataModelSql)).toMatch(/^[0-9a-f]{40}$/);
    expect(digestOf(coreDataModelSql)).toBe(digestOf(coreDataModelSql));
  });

  it('pins the exact schema migration 2 shipped with', () => {
    expect(digestOf(coreDataModelSql)).toBe('e930ebeca7dcf6b28c76dc9c9c90e3fdc081cc59');
  });
});

/**
 * Migration 3 adds the pull watermark. It is generated from the same
 * declarations and shipped in its turn, so it gets the same guard: a phone
 * that already ran it must not disagree with one installing today.
 */
describe('syncStateSql', () => {
  it('is generated from the declaration, not written by hand', () => {
    expect(syncStateSql).toBe(toSqlite([syncState]));
  });

  it('creates the watermark table and nothing else', () => {
    expect(syncStateSql).toContain('CREATE TABLE sync_state (');
    expect(syncStateSql).toContain('last_pulled_at TEXT NOT NULL');
  });

  it('stays out of migration 2, which has shipped', () => {
    expect(coreDataModelSql).not.toContain('sync_state');
  });

  it('runs against a real SQLite database', () => {
    const db = new DatabaseSync(':memory:');
    expect(() => db.exec(syncStateSql)).not.toThrow();
    db.close();
  });

  it('reports the shipped migration as unchanged', () => {
    expect(checkSyncStateFingerprint()).toEqual({ kind: 'unchanged' });
  });
});

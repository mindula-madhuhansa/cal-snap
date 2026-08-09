import { DatabaseSync } from 'node:sqlite';

import { createIdSource, type IdSource } from '../../src/data/ids/uuid';
import type { SqlDatabase, SqlValue } from '../../src/data/local/database';
import { coreDataModelSql } from '../../src/data/local/migrations';

/**
 * Shared setup for the data access layer tests.
 *
 * The narrow `SqlDatabase` port is what makes this possible: `expo-sqlite`
 * satisfies it on the phone, and plain `node:sqlite` satisfies it here, so
 * the tests exercise the real query text and the real migration rather than a
 * stand in. Nothing is mocked except the clock and the random source, which
 * are the only true boundaries in this layer.
 */

export type TestDatabase = {
  readonly db: SqlDatabase;
  /** The raw handle, for asserting on rows the data layer deliberately hides. */
  readonly raw: DatabaseSync;
  readonly close: () => void;
};

export const openTestDatabase = (): TestDatabase => {
  const raw = new DatabaseSync(':memory:');
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec(coreDataModelSql);

  const db: SqlDatabase = {
    runAsync: async (sql: string, params: readonly SqlValue[]) => raw.prepare(sql).run(...params),
    getAllAsync: async <T>(sql: string, params: readonly SqlValue[]) =>
      raw.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, params: readonly SqlValue[]) =>
      (raw.prepare(sql).get(...params) as T | undefined) ?? null,
    withTransactionAsync: async (work: () => Promise<void>) => {
      raw.exec('BEGIN');
      try {
        await work();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return { db, raw, close: () => raw.close() };
};

/**
 * A deterministic `IdSource`. Identifiers still come out as real, well formed
 * UUID version 7 values, they are just reproducible, so a failure is always
 * the same failure.
 */
export const testIdSource = (): IdSource => {
  let tick = 0;
  return createIdSource(
    (count) => Uint8Array.from({ length: count }, (_, index) => (tick * 31 + index) % 256),
    () => {
      tick += 1;
      return 1_770_000_000_000 + tick;
    },
  );
};

export const USER_A = '11111111-2222-4333-8444-555555555555';
export const USER_B = '99999999-8888-4777-8666-555555555555';

/** A meal item with sensible numbers, so a test only states what it cares about. */
export const anItem = (
  overrides: Partial<{
    name: string;
    basePer: number;
    baseUnit: 'g' | 'ml' | 'piece';
    baseCalories: number;
    baseProteinG: number;
    baseCarbsG: number;
    baseFatG: number;
    quantity: number;
    source: 'ai_scan' | 'manual' | 'ai_edited';
    confidence: 'high' | 'medium' | 'low';
    typed: Partial<Record<'calories' | 'protein_g' | 'carbs_g' | 'fat_g', number>>;
  }> = {},
) => ({
  name: 'Rice',
  baseUnit: 'g' as const,
  baseCalories: 130,
  baseProteinG: 2.7,
  baseCarbsG: 28.2,
  baseFatG: 0.3,
  quantity: 100,
  source: 'manual' as const,
  ...overrides,
});

/** Inserts the minimum profile the daily target path needs. */
export const seedProfile = (
  raw: DatabaseSync,
  userId: string,
  options: { readonly onboarded?: boolean } = {},
): void => {
  raw
    .prepare(
      `insert into profiles (user_id, age_years, age_recorded_on, sex, height_cm, activity_level,
         goal_direction, goal_rate_kg_per_week, goal_weight_kg, unit_preference, timezone,
         exercise_credit, exercise_credit_factor, photo_sync_enabled, consented_at, consent_version,
         onboarded_at, created_at, updated_at, is_dirty, synced_at)
       values (?, 34, '2026-08-01', 'female', 168.0, 'moderate', 'lose', 0.5, 62.0, 'metric',
         'Asia/Colombo', 'full', 1, 0, '2026-08-01T00:00:00Z', 'v1', ?,
         '2026-08-01T00:00:00Z', '2026-08-01T00:00:00Z', 0, null)`,
    )
    .run(userId, options.onboarded === false ? null : '2026-08-01T00:00:00Z');
};

export const seedWeight = (
  raw: DatabaseSync,
  userId: string,
  onDate: string,
  weightKg: number,
  id: string,
): void => {
  raw
    .prepare(
      `insert into weight_entries (id, user_id, on_date, recorded_at, weight_kg, source,
         created_at, updated_at, deleted_at, is_dirty, synced_at)
       values (?, ?, ?, ?, ?, 'onboarding', ?, ?, null, 0, null)`,
    )
    .run(
      id,
      userId,
      onDate,
      `${onDate}T00:00:00Z`,
      weightKg,
      `${onDate}T00:00:00Z`,
      `${onDate}T00:00:00Z`,
    );
};

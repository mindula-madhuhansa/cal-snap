/**
 * Numbered migrations, applied in order against `PRAGMA user_version`. No ORM
 * and no migration library (spec 0001, "Scaffold decisions").
 *
 * Rules that keep this honest:
 *   - A migration that has shipped is never edited. Add the next number.
 *   - `version` is its position in the sequence, starting at 1, no gaps.
 *   - Each one runs inside a transaction, so a failure leaves the previous
 *     version intact rather than a half-applied schema.
 */
export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

/**
 * The product tables (a user, a profile, a meal, an exercise entry, a weight
 * entry) are scope feature 3's decision and are deliberately not invented
 * here. This first migration only stands the database up.
 */
const initial: Migration = {
  version: 1,
  name: 'initial',
  sql: `
    CREATE TABLE app_meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    INSERT INTO app_meta (key, value)
    VALUES ('schema_created_at', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
  `,
};

export const migrations: readonly Migration[] = [initial];

/** The version the database should be at once every migration has run. */
export const latestVersion: number = migrations.length;

/** The migrations still to apply to a database currently at `currentVersion`. */
export const pendingMigrations = (currentVersion: number): readonly Migration[] =>
  migrations.filter((migration) => migration.version > currentVersion);

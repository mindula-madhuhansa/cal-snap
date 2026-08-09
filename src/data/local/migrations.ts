import { sha1 } from '../ids/sha1';
import { releaseOneTables } from '../schema/tables/all';
import { toSqlite } from '../schema/to-sqlite';

/**
 * SQLite migration 2: the six release 1 tables, generated from the one schema
 * declaration in `src/data/schema/` rather than hand written here.
 *
 * Generating a *shipped* migration creates one hazard the hand written kind
 * does not have. Editing a table declaration would retroactively change what
 * migration 2 says, so a phone that already ran it would quietly disagree
 * with a phone installing today. The fingerprint below is the guard: it is
 * the digest of the SQL as shipped, `npm run check:schema` compares the two,
 * and any edit to a declaration this migration covers fails that check.
 *
 * The fix when it fires is never to update the fingerprint. It is to add
 * migration 3 with an `ALTER TABLE`, exactly as `src/db/AGENTS.md` says.
 */

export const coreDataModelSql: string = toSqlite(releaseOneTables);

const digestOf = (text: string): string =>
  [...sha1(new TextEncoder().encode(text))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

/** The digest of `coreDataModelSql` as it shipped. Never update this by hand. */
export const CORE_DATA_MODEL_FINGERPRINT: string = 'e930ebeca7dcf6b28c76dc9c9c90e3fdc081cc59';

export type FingerprintCheck =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'changed'; readonly expected: string; readonly actual: string };

/**
 * Whether migration 2's SQL still matches what shipped. Called by
 * `npm run check:schema`, never at runtime.
 */
export const checkMigrationFingerprint = (): FingerprintCheck => {
  const actual = digestOf(coreDataModelSql);
  return actual === CORE_DATA_MODEL_FINGERPRINT
    ? { kind: 'unchanged' }
    : { kind: 'changed', expected: CORE_DATA_MODEL_FINGERPRINT, actual };
};

export { digestOf };

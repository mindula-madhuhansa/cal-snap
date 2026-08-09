/**
 * Naming and validating the per account database file.
 *
 * Pure, and apart from `database-file.ts`, which is an Expo edge: this is the
 * part that decides whether a string may become a file path, so it is also
 * the part most worth testing without a phone.
 */

/**
 * A Clerk user identifier: `user_` followed by an opaque alphanumeric run
 * (spec 0004, value sourcing). Clerk does not promise an exact length, so the
 * bound is deliberately generous. What matters is what it excludes: no dot,
 * no slash, no separator, nothing that could climb out of a filename.
 */
export const CLERK_USER_ID_SHAPE = /^user_[A-Za-z0-9]{20,32}$/;

/**
 * Whether this string is an identifier this app issued.
 *
 * Checked rather than trusted, because the value reaches both a file path and
 * `deleteDatabaseAsync`. A wrong answer here does not read the wrong diary, it
 * deletes one.
 */
export const isClerkUserId = (userId: string): boolean => CLERK_USER_ID_SHAPE.test(userId);

/** One file per account, named for the account (spec 0004, AC-8). */
export const databaseNameForUser = (userId: string): string => `calsnap-${userId}.db`;

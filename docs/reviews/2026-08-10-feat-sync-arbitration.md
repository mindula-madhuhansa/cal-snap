# Review, feat/account-and-sign-in (spec 0005 stack), 2026-08-10

**Reviewed by**: Claude Sonnet 5 (author on Opus 5, per prior commit pattern)
**Scope**: 13 files, branch vs `feat/account-and-sign-in` (merge base `2fdefceb746613d41c56b6f1c30e865364ffe7a5`)
**Verdict**: Approve with nits

## Summary

Spec 0005 moves sync arbitration from client assumption into the database: a Postgres trigger now
stamps `updated_at` from `clock_timestamp()`, freezes `created_at` on update, and refuses to revive
a tombstone, and `pushChanges` was rewritten to write the server's reply back wholesale instead of
trusting its own request. The PL/pgSQL, the generator, the rewritten push loop, and the fake server
that now models the trigger were all read in full against the four areas most likely to hide a bug
(trigger semantics, the push stopping rule, whether the fake server weakens older tests, and
agreement with the unchanged `pull.ts`). None of the four turned up a correctness problem: the
two-function split is justified and necessary (`meal_scans` genuinely has no `deleted_at` column,
confirmed against its declaration), `return old` is used correctly and only where a revival is
being refused, the push loop's stopping rule and `PushResult.rows` semantics are consistent with
every caller, and the client-side `mayApply` sticky-delete rule in `pull.ts` cannot disagree with
the new server-side rule because push always runs before pull and a dirty local row is never
overwritten by either. The gaps that remain are documentation ones, not code ones.

## Minor

### 🟡 `src/data/AGENTS.md` still describes one generated migration file

**Problem**: `src/data/AGENTS.md`'s Gotchas section still says "`supabase/migrations/` is generated.
Do not hand edit it; run `npm run gen:supabase-migration`," as a single statement, and the Key files
table still lists only `schema/to-postgres.ts` with no mention of `toPostgresSyncTriggers` or the
second, always-rewritten migration file. `scripts/generate-supabase-migration.ts`'s header comment
was updated to explain the two-file split, but the nested AGENTS.md this feature's own convention
docs point to was not touched in this diff.

**Why it matters**: The core migration (`20260809000000_core_data_model.sql`) must never change
once applied — the fingerprint-style guard here is `git diff --exit-code` at `/check verify` — while
the arbitration migration is rewritten in full on every run and is expected to change. A future
contributor reading only this file would not learn that distinction exists, and could regenerate
after editing a table declaration expecting one file to update and be surprised, or worse, not
realize the core file diffing non-empty is the actual failure signal.

**Suggested fix**: Add one line noting the second generated file and that only it is safe to
regenerate freely; the core file's regeneration must diff empty. This is already tracked as an open
item in spec 0005's own Follow-up list, so this finding just confirms it's still outstanding after
this diff landed.

### 🟡 `pushTable`'s write-back guard is a separate SELECT then UPDATE, not the single conditional UPDATE the spec sketches

**Problem**: `src/data/remote/push.ts:93-166`. The spec's "push change, precisely" section sketches
`UPDATE <table> SET ... WHERE <key> = ? AND updated_at = ?` as one statement, using the affected-row
count as the signal for whether the write landed. The implementation instead runs `stillUnchanged`
(a `SELECT ... WHERE key = ? AND updated_at IS ?`) and, only if that returns a row, follows with an
unconditional `UPDATE ... WHERE key = ?` (no `updated_at` in that statement's `WHERE` at all). Both
happen inside the same `db.withTransactionAsync` per row.

**Why it matters**: This appears to be forced by the `SqlDatabase` port (`src/data/local/database.ts`),
whose `runAsync` returns `Promise<unknown>` with no rows-changed count, so a single conditional
UPDATE would have no way to report back whether it matched anything — the SELECT is standing in for
that missing information. Functionally this is fine as written, but it silently depends on
`withTransactionAsync` fully serializing against every other writer on the same connection (so
nothing can change the row between the SELECT and the UPDATE); that guarantee is true of
`expo-sqlite`'s single native connection today but is not part of the `SqlDatabase` port's type, and
nothing documents the dependency at the call site. A future port implementation (or a change that
lets two connections share one file) would reintroduce exactly the race AC-5's guard exists to
close, with no compiler or test signal.

**Suggested fix**: Either add a short comment at `stillUnchanged` (or in `src/data/local/database.ts`)
stating explicitly that this pattern relies on `withTransactionAsync` serializing all writers on the
connection, or extend `SqlDatabase.runAsync` to surface an affected-row count so the write-back can
become the single conditional UPDATE the spec describes and drop the extra per-row SELECT.

## Nits

- ⚪ `src/data/schema/to-postgres.ts:187-193`: `toPostgresSyncTriggers` takes the full table list and
  filters twice (`presence === 'both' && table.timestamps`); `toPostgres` filters once on
  `presence === 'both'` alone and lets `resolveColumns` decide the rest. Not wrong, just a small
  asymmetry between the two generators worth a one-line note if it's intentional (every
  `presence: 'both'` table in this schema also carries `timestamps: true`, so the extra clause is
  currently a no-op safety net rather than a live distinction).

## Strengths

- The two-function trigger split (`sync_stamp` vs `sync_stamp_sticky_delete`) is the correct call and
  is proven, not just asserted: `meal_scans` is confirmed in its own declaration
  (`schema/tables/meal-scans.ts`) to have `softDelete: false` and therefore no `deleted_at` column at
  all, so a single function referencing `new.deleted_at` unconditionally would have raised at
  runtime on that table's first write. The generator tests pin every load-bearing detail of the
  functions individually: `clock_timestamp()` vs `now()`, `created_at` frozen only on update, `return
  old` vs `return null`, `security invoker`, `set search_path = ''`, and which four tables get the
  sticky variant.
- `pushTable`'s revised stopping rule (`dirty.length < BATCH || landed === 0`) is correct against the
  scenario it exists for: a full page with a partial confirm keeps looping (the unconfirmed rows
  reappear in the next page, ordered by their own `updated_at`, with no starvation observed), and a
  full page confirming nothing stops rather than resending the identical page.
- `test/support/fake-server.ts`'s `arbitrate` models all three trigger rules faithfully without
  overreaching (it deliberately still does not arbitrate on content, matching spec 0005's "last push
  wins" decision), and none of the pre-existing `pushChanges`/`pullChanges`/`runSync` tests changed
  behaviour under the new modelling — each was traced individually and still exercises what it did
  before.
- Spec and verify docs are unusually candid about residual risk: the microsecond truncation found in
  `codec.ts`, the accepted narrow window between an upsert committing and a watermark advancing past
  it, and AC-8 being explicitly blocked rather than marked done are all recorded rather than
  smoothed over.

## Test coverage

AC-1 and AC-4 through AC-7 are pinned in `generators.test.ts` against the generated SQL text, which
is the right split given the suite runs on `node:sqlite` and cannot execute a Postgres trigger; the
trigger's actual behaviour was proven manually against the live project and is recorded in
`verify.md`. AC-2, AC-3, and AC-5 are exercised end to end in the new `sync.test.ts` describe block
against the fake server, including the two edge cases the spec calls out explicitly (an edit landing
mid-flight, and a full page that confirms nothing). AC-8 has no automated coverage and cannot: it
needs two physical devices with a clock offset, and is correctly recorded as blocked rather than
skipped silently. No branching logic introduced in this diff was found untested.

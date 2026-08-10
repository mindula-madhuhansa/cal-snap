# Verify: sync arbitration · spec 0005 · updated 2026-08-10

_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

The behaviour that matters most here cannot be executed by `npm test`: the suite runs on plain Node
against `node:sqlite` and cannot run a Postgres trigger. So the generated SQL is pinned by the
Vitest generator tests, and the trigger itself is proven against the live `Cal Snap` project. That
manual half is permanent, not a gap waiting to be closed.

## Already proven, 10 August 2026, during `/develop`

Run against the live project through the Supabase MCP, on throwaway rows under `user_id =
'probe_0005'` which were deleted afterwards (confirmed zero remaining).

- [x] Six triggers exist, read back from `pg_trigger`: the sticky variant on `meals`, `meal_items`,
      `daily_targets`, `weight_entries`, the plain one on `profiles` and `meal_scans`. Neither
      function is `security definer`; both carry `search_path=""` → AC-1, AC-3
- [x] Three rows inserted in one statement, all sent `updated_at` of `2030-01-01`. Stored: three
      **distinct** stamps, all at the server's real time → AC-1, AC-6
- [x] `created_at` sent as `2020-01-01` on insert was kept exactly as sent → AC-4
- [x] An update sending `created_at` of `1999-01-01` left it at `2020-01-01` → AC-4
- [x] The same via `insert ... on conflict do update`, the path PostgREST actually uses:
      `created_at` frozen, device clock overridden, **and the row still present in `returning`**,
      which is what `pushChanges` depends on → AC-1, AC-4
- [x] An update setting `deleted_at` back to null while also changing `note` left the row deleted
      **and** kept the original note, so the bundled edit went with the refused revival → AC-3
- [x] A refused write moved `updated_at` by nothing at all, asserted inside a `do $$` block that
      would have raised had the stamp moved → AC-3

## Commands

- [x] `npm test` → 458 passing across 37 files, including the `toPostgresSyncTriggers` block and
      `pushChanges, when the server disagrees` → AC-1..AC-7 · run 10 August 2026
- [x] `npm run gen:supabase-migration` → writes both files, and
      `git diff supabase/migrations/20260809000000_core_data_model.sql` is empty. A non empty diff
      means a later change leaked into a migration the database has already run → AC-7 · run
      10 August 2026, `git diff --exit-code` returned 0 on both files
- [x] `npm run typecheck` and `npm run lint` → clean · plus `npm run format`, all three clean

## Still owed, needs two devices

- [ ] Sign in to one account on two development builds. Set device A's clock **two hours behind**.
      Save a meal on A, sync both. Expect: the meal appears on B → AC-8

      This is the bug the whole spec exists for. Before the trigger, A would have stamped the row
      two hours in the past, behind B's stored watermark, and B would never have pulled it. Both
      online, nothing failing, a meal simply missing.

- [ ] With A's clock still behind, edit the same meal on B and sync B, then sync A. Expect: B's
      edit is what both devices hold, because B pushed second, not because its clock reads later
      → AC-2, AC-8
- [x] Delete a meal on B and sync. On A, still offline, edit that same meal, then bring A back
      online and sync. Expect: the meal is gone on A too, A shows no error, and the row is clean
      rather than retried on every sync → AC-3, AC-5

      **Done on 10 August 2026 without a second phone**, and the substitution is worth stating so
      nobody reads more into it than it proves. The tombstone was put on the live database as if B
      had pushed it, the real `pushChanges` was then run as a program against a real SQLite file,
      and the reply it was handed was the **exact JSON the live Postgres returned**, timestamp
      formatting and all. Result: the local row took the tombstone and B's note, `is_dirty` went to
      0, and nothing errored. Same code path, same server behaviour, same data. What it does not
      cover is two real devices, which is AC-8 below.

## Value sourcing checks

One per row of the spec's Value sourcing table, since a mis sourced value is the failure the
design time gate cannot see.

- [x] `updated_at` on any row in Postgres always differs from what the device sent → AC-1
- [x] `created_at` survives a second push of the same meal unchanged → AC-4 · the second half of
      this line, that a meal and its items still share one instant after both are pushed, was
      **not** exercised: it needs two tables pushed in sequence and is only observable once real
      meals exist (feature 9)
- [x] The winner of a conflict is the later **push**, not the later device clock → AC-2
- [x] A refused push leaves every stored column alone, `updated_at` included → AC-3
- [x] After a refused push the local row holds the server's content, and `is_dirty` is 0 → AC-3
- [x] A row edited during its own push is still `is_dirty = 1` afterwards and carries the new edit,
      not the reply → AC-5 · and `PushResult.rows` correctly reported 0 confirmed
- [ ] `sync_state.last_pulled_at` only ever holds instants the server assigned → AC-1, AC-6 · not
      exercised, no pull was run in this pass

## Found while verifying, 10 August 2026

**AC-6's distinctness does not survive the trip to the phone.** Postgres stamps at microsecond
precision, and the observed reply carried `2026-08-10 11:29:15.261642+00`. `normaliseInstant` in
`codec.ts` puts that through `Date`, which truncates to milliseconds, so the device stored
`2026-08-10T11:29:15.261Z`. Two rows written 300 microseconds apart get distinct stamps on the
server and **identical** ones on the phone.

Nothing is broken by it today, and the direction of the error is the safe one:

- The truncation always rounds down, so a stored watermark is never ahead of the true value. A pull
  can re-read a row it already has, which is harmless because every apply is an upsert. It can
  never skip one.
- The stall case in `pullChanges` needs a whole page to share one instant. `PAGE` is 500 and
  `BATCH` is 200, so one push cannot fill a page, and three pushes would have to land inside the
  same millisecond over a network.

Worth recording rather than fixing here, for two reasons: spec 0005 states AC-6 as though
distinctness reaches the device, which it does not, and the safety margin is again a relationship
between `PAGE` and `BATCH` that no test states, which is the exact coupling `clock_timestamp()` was
chosen to remove. Raised for `/check review`.

## Acceptance-criteria coverage

Verdict after the 10 August 2026 pass: **7 of 8 met, AC-8 blocked.**

- AC-1 server owns the clock · **met** · a sent stamp of 2030 was overridden on the live database,
  asserted inside a block that raises on failure, and the real client adopted the server's value
- AC-2 later push wins and the loser learns · **met** · the upsert overwrote on the live database,
  and the real client took the server's content on the reply. The two device field version is AC-8
- AC-3 tombstone is sticky · **met** on both sides, and the client half was driven with the actual
  JSON the live database returned
- AC-4 `created_at` never moves · **met** · frozen on the update and the upsert path, and the
  client adopted the frozen value rather than its own
- AC-5 in flight edit survives · **met** · the edit held, the row stayed dirty, `rows` reported 0
- AC-6 distinct stamp per row · **met on the server**, three rows in one statement, three stamps.
  See the finding above: it does not hold on the device, and the spec does not say so
- AC-7 core migration untouched · **met** · `git diff --exit-code` returned 0 after regenerating
- AC-8 skewed clock cannot hide or win · **blocked**, needs two devices on one account with one
  clock set two hours behind. This is the bug the whole spec exists for, so it is the one that
  matters most and the one still unproven

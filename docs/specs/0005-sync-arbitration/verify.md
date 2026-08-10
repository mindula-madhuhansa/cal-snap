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

- [ ] `npm test` → 458 passing across 37 files, including the `toPostgresSyncTriggers` block and
      `pushChanges, when the server disagrees` → AC-1..AC-7
- [ ] `npm run gen:supabase-migration` → writes both files, and
      `git diff supabase/migrations/20260809000000_core_data_model.sql` is empty. A non empty diff
      means a later change leaked into a migration the database has already run → AC-7
- [ ] `npm run typecheck` and `npm run lint` → clean

## Still owed, needs two devices

- [ ] Sign in to one account on two development builds. Set device A's clock **two hours behind**.
      Save a meal on A, sync both. Expect: the meal appears on B → AC-8

      This is the bug the whole spec exists for. Before the trigger, A would have stamped the row
      two hours in the past, behind B's stored watermark, and B would never have pulled it. Both
      online, nothing failing, a meal simply missing.

- [ ] With A's clock still behind, edit the same meal on B and sync B, then sync A. Expect: B's
      edit is what both devices hold, because B pushed second, not because its clock reads later
      → AC-2, AC-8
- [ ] Delete a meal on B and sync. On A, still offline, edit that same meal, then bring A back
      online and sync. Expect: the meal is gone on A too, A shows no error, and the row is clean
      rather than retried on every sync → AC-3, AC-5

## Value sourcing checks

One per row of the spec's Value sourcing table, since a mis sourced value is the failure the
design time gate cannot see.

- [ ] `updated_at` on any row in Postgres always differs from what the device sent → AC-1
- [ ] `created_at` survives a second push of the same meal unchanged, and a meal and its items still
      share one instant after both have been pushed → AC-4
- [ ] The winner of a conflict is the later **push**, not the later device clock → AC-2
- [ ] A refused push leaves every stored column alone, `updated_at` included → AC-3
- [ ] After a refused push the local row holds the server's content, and `is_dirty` is 0 → AC-3
- [ ] A row edited during its own push is still `is_dirty = 1` afterwards and carries the new edit,
      not the reply → AC-5
- [ ] `sync_state.last_pulled_at` only ever holds instants the server assigned → AC-1, AC-6

## Acceptance-criteria coverage

- AC-1 server owns the clock · proven live, plus generator tests
- AC-2 later push wins and the loser learns · unit proven, two device check owed
- AC-3 tombstone is sticky · proven live, plus unit tests both sides
- AC-4 `created_at` never moves · proven live on both the update and upsert paths
- AC-5 in flight edit survives · unit proven, guard verified by removing it
- AC-6 distinct stamp per row · proven live, three rows one statement
- AC-7 core migration untouched · generator test, plus the empty diff check above
- AC-8 skewed clock cannot hide or win · **owed**, needs two devices

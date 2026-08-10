# Verify: data model · spec 0002 · updated 10 August 2026

_Amended 10 August 2026 for the Clerk identity change (spec [0004](../0004-account-and-sign-in/index.md)). Three database steps changed: the policy check now expects `auth.jwt() ->> 'sub'`, two steps were added for the `text` column type and the removed foreign keys, and the account deletion step can no longer pass at all. Every other step is untouched._

_Steps derived from spec 0002 acceptance criteria and from every row of its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

One command covers a large part of this list, and it runs in CI:

- `npm test` runs 230 Vitest tests across the pure calculations, the identifiers, the two schema generators, and the data access layer driven against a real SQLite database. Each test that pins an acceptance criterion carries a `covers: AC-N` comment, so the suite traces back to the contract (AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-12, AC-13, AC-16).

This replaced the earlier `check:schema` and `check:data` scripts, which have been deleted; `npm test` is now the single gate.

What is left is the cloud half, the on device half, and the value sourcing edges that only show up on a real phone.

## Commands

- [x] `npm test` → 230 tests pass across 15 files → AC-1, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-11, AC-12, AC-13, AC-16
- [x] `npm test src/data/schema` → the two generated schemas agree on 87 shared columns, the generated SQLite DDL runs against a real database, and `is_dirty` and `synced_at` never reach Postgres → AC-1
- [x] `npm test src/data/calculations/rounding.test.ts` → one decimal macros survive the values binary floating point rounds the wrong way → AC-13
- [x] `npm test src/data/local/migrations.test.ts` → the shipped migration fingerprint still matches. Edit any table declaration and re-run: it must fail, telling you to add migration 3 rather than change migration 2 → AC-1
- [x] `npm test src/data/ids` → SHA-1 matches the FIPS 180-1 vectors and UUID version 5 matches the RFC 9562 vector, so the derived identifiers are right and not merely self consistent → AC-4, AC-9
- [x] `npm run typecheck && npm run lint && npm run format` → clean

## Database (Supabase)

Project `Cal Snap` (`kfzlocqwrzgkyqkzphfq`), Postgres 17. The first three were
confirmed on 9 August 2026 by querying the live database.

- [x] Apply `supabase/migrations/20260809000000_core_data_model.sql` to the Cal Snap project, then confirm all six tables exist → AC-1 · six tables, 87 columns, matching the parity check
- [x] `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in (...)` → row level security is both **enabled** and **forced** on all six → AC-2 · true on all six
- [x] `select tablename, policyname, qual from pg_policies where schemaname = 'public'` → one `<t>_own_rows` policy per table, each testing `user_id = (select auth.jwt() ->> 'sub')` → AC-2 · six policies, `using` and `with check` both correct, role `authenticated`. Re confirmed against the live project on 10 August 2026 after the identity change _(amended: this step expected `auth.uid()`, which spec 0004 replaced. Anyone rerunning it against the old expectation would read a real pass as a failure)_
- [x] `select attname, format_type(...) from pg_attribute` for `user_id` on all six tables → `text`, not `uuid` → AC-2 · confirmed live on 10 August 2026 (added with the identity change)
- [x] `select conname, pg_get_constraintdef(oid) from pg_constraint where contype = 'f'` → only `meal_items.meal_id` and `meals.scan_id` remain; no `auth.users` reference survives anywhere → AC-2, AC-10 · confirmed live on 10 August 2026 (added with the identity change)
- [ ] Sign in as user A, `select * from meals where user_id = '<user B>'` → **zero rows**, not an error → AC-2 · needs a real session, so it lands with feature 5
- [ ] Sign in as user A, try `insert into meals (...) values (..., '<user B>', ...)` → refused by the `with check` clause → AC-2
- [x] Confirm an index exists on `user_id` for every table, and on every foreign key column (`meal_items.meal_id`, `meals.scan_id`) → AC-2 · all eight foreign key columns indexed; Supabase's performance advisors report no missing index
- [x] Compare the **live** `information_schema.columns` against the schema declarations, column by column → AC-1 · all 87 columns match on name, order, type, nullability, and default, and `is_dirty` / `synced_at` did not leak into Postgres
- [x] Count live `CHECK` constraints per table → AC-1 · 9, 2, 2, 12, 2, 2, exactly what the declarations produce
- [ ] Delete a person in the Clerk dashboard → every row for that `sub` is gone from all six tables, tombstones included, and the storage prefix `<user_id>/` is gone with them → AC-10 · **cannot pass today, and that is the finding**: this step read "delete a user from `auth.users`", and spec 0004 removed that cascade without replacing it. Nothing deletes anything by itself until scope feature 10 builds the `user.deleted` webhook. Run it then, and run it twice to prove the function is idempotent _(amended 10 August 2026)_
- [ ] Insert a `meals` row with an `id` the device chose → Postgres accepts it unchanged, and no extension or default renumbers it → AC-4

## On the phone

- [ ] Fresh install, open the app → the database opens at schema version 2 and the six tables exist → AC-1
- [ ] Kill and reopen the app → still version 2, no migration re-runs, data survives → AC-1
- [ ] Sign in as user A, log a meal, sign out, sign in as user B → B's diary is empty, and A's database file is not readable from B's session → AC-11
- [ ] Sign out with everything pushed → the local database file is gone from disk → AC-11
- [ ] Sign out with at least one `is_dirty = 1` row → the file **stays**, and the next sign in retries the push → AC-11
- [ ] Change the unit preference to imperial → weights read in lb and heights in feet and inches, and `select weight_kg, height_cm` shows the stored numbers unchanged → AC-12

## Value sourcing (one step per row of the spec's table)

These are the edges that break quietly if a value is sourced from the wrong place, so each one varies the input rather than just reading the happy path.

- [ ] Set the phone to Asia/Colombo, save a meal at 23:50 → it files under that local date, not the UTC one. Fly the phone to Europe/London and reopen → `eaten_on` is unchanged → AC-3
- [ ] Save a meal, then check `tz_at_save` → it holds the IANA zone the device was actually in, not a fixed value → AC-3
- [x] Save meals at 03:59, 04:00, 10:59, 11:00, 14:59, 15:00, 16:59, 17:00, 20:59, 21:00 → snack, breakfast, breakfast, lunch, lunch, snack, snack, dinner, dinner, snack; `meal_type_source` reads `guessed`. Change one by hand → it reads `chosen` → AC-3
- [x] Save a meal → its `id` is a UUID version 7 (version nibble `7`), and it is the same id after syncing → AC-4
- [ ] Cross local midnight with the app open → "today" follows the **device's** current local date, not `profiles.timezone` → AC-3
- [x] Edit one item's calories by hand, then change the portion → the typed calories hold, the macros rescale, `source` reads `ai_edited` and `edited_fields` names `calories` → AC-6, AC-8
- [x] Delete one item from a three item meal → the meal total and the day total both drop by exactly that item → AC-7 · locked by `totalsForDay` tests
- [ ] With exercise not yet built, confirm remaining calories = target minus eaten, with the burned term reading zero rather than the formula being absent → AC-7
- [x] Page a day's meals two at a time while saving a new meal mid paging → no row is skipped or repeated → AC-16
- [x] Search past items on a brand new account → empty, and the screen says so plainly rather than showing a blank box → AC-16
- [x] Create today's target, then backdate a weigh in to today → the target does **not** change → AC-9 · locked by a `getOrCreateDailyTarget` test
- [ ] Create the same day's target on two offline devices, then sync → exactly one live row survives, and both devices computed the same `id` → AC-9
- [x] Confirm `formula_version` on a target records which calculation produced it (feature 6 owns the formula itself) → AC-9 · locked by a `getOrCreateDailyTarget` test
- [x] Log meals on three consecutive days, skip one, log again → the streak counts back from yesterday and adds today only once today has a meal
- [x] Count a day's scans from `meal_scans` alone, with no other table involved → AC-15

## Still owed (feature 5 brings these)

- [ ] Push the same batch twice, and push a batch interrupted after the server wrote but before the device recorded the acknowledgement → no duplicate rows → AC-14
- [ ] A device with a clock running an hour fast pushes an older edit → it does not overwrite the newer edit from the other device, because the server stamped `updated_at` → AC-14
- [ ] Delete a meal on device A → after two full sync cycles it is gone from device B and never returns → AC-5
- [ ] Device B, offline when the delete happened, edits that meal and pushes → the delete still wins → AC-5
- [ ] Soft deleted rows older than 90 days are removed; `meal_scans.raw_response` older than 90 days is cleared while the rest of the row stays → AC-17

## Acceptance-criteria coverage

- AC-1 · covered by `npm test` (parity, generated DDL executed, fingerprint) plus the live Postgres comparison; the fresh install step is still owed
- AC-2 · **structurally covered** · row level security is enabled, forced, and correctly policied on the live database, re confirmed on 10 August 2026 after the identity change, and Supabase's security advisors are clean. The behavioural half (user A sees zero of user B's rows) needs a signed in session, so it is owed to feature 5, and it now also needs Clerk registered with Supabase as a third party auth provider with `role: authenticated`. Until that is done every request is unauthenticated and every policy denies, which looks like a pass for entirely the wrong reason
- AC-3 · covered by `npm test` (zone resolution, meal type boundaries, `eaten_on` stored at save); the fly the phone step is still owed
- AC-4 · covered by `npm test` (version and variant bits, time ordering, no collisions over 500 ids); the Postgres accepts-device-id step is still owed
- AC-5 · covered by `npm test` for the local half (tombstone set, meal and items both, no revival, dropped from totals); the two device half is owed to feature 5
- AC-6 · covered by `npm test` (no drift across repeated changes, hand typed fields held, zero and negative portions refused)
- AC-7 · covered by `npm test` (totals summed at read time, no stored total column, deleted rows excluded)
- AC-8 · covered by `npm test` (source transitions and `edited_fields`)
- AC-9 · covered by `npm test` (written once, never recomputed, backdated weigh in ignored, identifier derived); the two offline devices step is owed to feature 5
- AC-10 · **not yet covered, and further from covered than it was** · the `auth.users` cascade that used to do most of this for free is gone (spec 0004). It now needs an idempotent edge function behind Clerk's `user.deleted` webhook that deletes every row for that `sub` **and** removes the storage prefix. Scope feature 10 owns it, and until it lands the app cannot honour a deletion request
- AC-11 · the query scoping half is covered by `npm test` (no read, delete, search, or streak crosses users); the per user file open and remove half needs a device and is still owed
- AC-12 · covered by `npm test` (conversion is display only, stored kilograms untouched)
- AC-13 · covered by `npm test` (every decimal maps to REAL, one decimal rounding holds through the values binary floating point gets wrong, day totals agree)
- AC-14 · **not yet covered** · owed to feature 5 (sync)
- AC-15 · covered by `npm test` (`scan-usage.test.ts`: countable from `meal_scans` alone, no counter column, no tombstone to hide a scan)
- AC-16 · covered by `npm test` (keyset paging on both lists, nothing skipped or repeated when a row is inserted mid paging)
- AC-17 · **not yet covered** · owed to feature 5 (the retention sweep has no scheduler yet)

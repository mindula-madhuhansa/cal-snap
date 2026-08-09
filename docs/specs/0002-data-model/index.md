# 0002. Core data model for CalSnap

**Date**: 2026-08-09
**Status**: In Progress

## Summary

CalSnap stores a person's diary in two places at once: SQLite on the phone, so every screen is instant, and Postgres in Supabase, so the data survives a new phone. This spec defines the tables once, in TypeScript, and generates both databases from that single definition, so the two can never drift apart. Six tables ship in release 1, one more arrives with exercise, and a billing table is written down here but not created. The rules that matter most: a meal belongs to the calendar day it was eaten in the eater's own timezone, deletes leave a marker so the other phone learns about them, and Postgres itself refuses to hand one person another person's diary.

## Requirements

**User stories**:

- As someone logging meals, I want my diary to be the same on any phone I sign in to, so that changing phones does not cost me my history.
- As someone logging meals, I want a late night snack to count against the day I ate it, so that the app agrees with my own sense of what a day is.
- As someone correcting a scan, I want changing a portion to change the numbers exactly, so that fixing the app's guess does not introduce a new error.
- As the engineer, I want one definition of each table, so that a schema change cannot land on one database and be forgotten on the other.
- As someone with a health diary, I want it to be impossible for another user to read my data, so that I do not have to trust that every query was written correctly.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: Each table is declared once in TypeScript. The SQLite statements and the Postgres statements are both produced from that declaration, and a test proves that the column names, types, nullability, and checks match on both sides.
- **AC-2**: Every table carries `user_id`, has row level security enabled and forced, and has a policy of the form `(select auth.uid()) = user_id`. A signed in user selecting another user's rows receives zero rows, not an error.
- **AC-3**: A meal saved at 23:50 local time is filed under that local calendar date. Reading "today" returns it, whatever the device's offset from UTC is, and reading it again after the device moves timezone still returns the same date.
- **AC-4**: Rows are created on the device with a UUID version 7 identifier and keep that identifier after syncing. Nothing is renumbered, and no row waits on the server to be named.
- **AC-5**: Deleting a meal sets `deleted_at` rather than removing the row. After one sync cycle the second device no longer shows it, and it does not reappear on any later pull.
- **AC-6**: Changing a meal item's quantity recomputes its calories and macros from the stored base rate exactly, with no compounding drift across repeated changes. Editing a value by hand marks the item as edited and stops that item rescaling.
- **AC-7**: A meal's total and a day's total are computed as a sum over the live (not deleted) items at read time. No total is stored, so no total can disagree with its parts.
- **AC-8**: Each meal item records whether its numbers came from a scan, from a hand entry, or from a scan the user edited, and each scan records its confidence, so a screen can mark an estimate as an estimate.
- **AC-9**: A `daily_targets` row is written once per user per day, on first use of that day, and is never recomputed afterwards. Reading a past day returns the target that applied on that day, not today's.
- **AC-10**: Deleting the account removes every row belonging to that user across every table, including tombstones and any stored photo, through cascades from the auth user.
- **AC-11**: Signing in as a different user on the same phone opens a different local database file. No row belonging to the previous account is readable or syncable from the new session.
- **AC-12**: Weight is stored only in kilograms and height only in centimetres. Changing the unit preference changes what is displayed and never what is stored.
- **AC-13**: Macro grams survive a round trip between Postgres `numeric(6,1)` and SQLite `REAL` unchanged to one decimal place, and a day's totals agree on both sides.
- **AC-14**: Replaying the same sync push produces the same result. A push interrupted midway and retried creates no duplicate rows.
- **AC-15**: The number of scans a user made on a given day is answerable from `meal_scans` alone, with no additional table and no counter to keep in step.
- **AC-16**: Every list read is paginated, with a stable order that does not skip or repeat a row when a new row is inserted during paging.
- **AC-17**: Soft deleted rows older than 90 days are removed, and raw scan responses older than 90 days are cleared while the rest of the scan record stays.

## Decision

**Chosen option**: Option 2: one schema definition in TypeScript, generating both databases, with tombstones for sync and row level security for isolation.

The tables are declared once as data in `src/data/schema/`, pure functions turn each declaration into a SQLite migration and a Supabase migration, and the same declaration produces the TypeScript type. Sync carries `updated_at` and `deleted_at` on every row and resolves conflicts by newest write. Postgres enforces per user isolation itself.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`)

## Feature design

**Data model sketch**

Every table below carries these columns in both databases unless noted: `created_at timestamptz not null`, `updated_at timestamptz not null`, `deleted_at timestamptz null`. SQLite additionally carries `is_dirty integer not null default 0` (needs pushing) and `synced_at text null` (last confirmed by the server). Postgres does not have those two: they describe one device's relationship to the server, not the data.

Identifiers are UUID version 7, generated on the device. Postgres never generates one, so it needs no extension and no default; it accepts the identifier the phone already chose.

Two tables are the exception. `daily_targets` and `weight_entries` are naturally keyed by a day rather than by an event, and two offline devices can each decide to create the row for the same day. A random identifier on each would collide on the unique index rather than on the primary key, where the conflict rule cannot see it. Both therefore use a **deterministic** identifier: a UUID version 5 computed from a fixed project namespace, the `user_id`, and the `on_date`. Two devices independently creating Tuesday's target produce the same identifier, so the collision becomes an ordinary same row conflict that newest write wins already handles.

`updated_at` is stamped **by the server**, not by the device, and the device stores the value the server returns. A device sets its own `updated_at` only while a row is still local and unpushed. This matters because newest write wins is the only arbitration there is, and a phone with a wrong clock would otherwise win every conflict forever.

`profiles` (one row per user, no `deleted_at`: removing a profile means removing the account)

| Column | Type | Notes |
|---|---|---|
| `user_id` | `uuid` | primary key, references `auth.users(id)` on delete cascade |
| `age_years` | `integer` | required, check between 13 and 120 |
| `age_recorded_on` | `date` | required, so age advances without inventing a birthday |
| `sex` | `text` | required, check in `female`, `male` |
| `height_cm` | `numeric(5,1)` | required, check greater than 0 |
| `activity_level` | `text` | required, check in `sedentary`, `light`, `moderate`, `active`, `very_active` |
| `goal_direction` | `text` | required, check in `lose`, `hold`, `gain` |
| `goal_rate_kg_per_week` | `numeric(3,2)` | required, default 0, check between 0 and 1.5 |
| `goal_weight_kg` | `numeric(5,2)` | optional |
| `unit_preference` | `text` | required, default `metric`, check in `metric`, `imperial` |
| `timezone` | `text` | required, IANA name, last seen from the device |
| `exercise_credit` | `text` | required, default `full`, check in `none`, `full`, `partial` |
| `exercise_credit_factor` | `numeric(3,2)` | required, default 1, check between 0 and 1 |
| `photo_sync_enabled` | `boolean` | required, default false |
| `consented_at` | `timestamptz` | optional, when health data consent was given |
| `consent_version` | `text` | optional, which policy version was agreed to |
| `onboarded_at` | `timestamptz` | optional, null means onboarding is unfinished |

`daily_targets`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | required, references `auth.users(id)` on delete cascade |
| `on_date` | `date` | required, the user's local calendar date |
| `calories` | `integer` | required, check greater than 0 |
| `protein_g` `carbs_g` `fat_g` | `numeric(6,1)` | optional, the macro split for that day |
| `source` | `text` | required, check in `computed`, `manual` |
| `formula_version` | `text` | required, which calculation produced it |

Unique on `(user_id, on_date)` where `deleted_at is null`. Indexed on `(user_id, on_date)`.

`meals`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | required, references `auth.users(id)` on delete cascade |
| `eaten_on` | `date` | required, the local calendar date decided at save time |
| `eaten_at` | `timestamptz` | required, the exact instant |
| `tz_at_save` | `text` | required, the IANA zone the device was in when saved |
| `meal_type` | `text` | required, check in `breakfast`, `lunch`, `dinner`, `snack` |
| `meal_type_source` | `text` | required, check in `guessed`, `chosen` |
| `note` | `text` | optional |
| `photo_local_uri` | `text` | optional, a file on this device |
| `photo_remote_path` | `text` | optional, the Supabase Storage object once uploaded |
| `photo_synced_at` | `timestamptz` | optional |
| `scan_id` | `uuid` | optional, references `meal_scans(id)` on delete set null |

Indexed on `(user_id, eaten_on)` where `deleted_at is null`, and on `scan_id`.

`meal_items`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `meal_id` | `uuid` | required, references `meals(id)` on delete cascade |
| `user_id` | `uuid` | required, carried for row level security so no policy needs a join |
| `name` | `text` | required |
| `position` | `integer` | required, the order on the plate |
| `base_per` | `numeric(6,1)` | required, default 100, the amount the base numbers describe |
| `base_unit` | `text` | required, check in `g`, `ml`, `piece` |
| `base_calories` | `integer` | required, check at least 0 |
| `base_protein_g` `base_carbs_g` `base_fat_g` | `numeric(6,1)` | required, check at least 0 |
| `quantity` | `numeric(7,1)` | required, check greater than 0, the amount eaten |
| `calories` | `integer` | required, check at least 0, resolved |
| `protein_g` `carbs_g` `fat_g` | `numeric(6,1)` | required, check at least 0, resolved |
| `source` | `text` | required, check in `ai_scan`, `manual`, `ai_edited` |
| `edited_fields` | `text` | optional, a comma separated list of the field names the user typed by hand, for example `calories,fat_g`. Null means nothing was typed |
| `confidence` | `text` | optional, check in `high`, `medium`, `low` |

Indexed on `meal_id`, on `user_id`, and on `(user_id, lower(name))` for the "add by hand" search over past items.

`edited_fields` is what makes AC-6 buildable. Rescaling recomputes every resolved field except the ones named there, which keep the value the user typed. `source` alone cannot express this, because it says the item was edited without saying which part.

`meal_scans` (no `deleted_at`: a scan record is not user facing content)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | required, references `auth.users(id)` on delete cascade |
| `model` | `text` | required, the model identifier used |
| `prompt_version` | `text` | required |
| `status` | `text` | required, check in `ok`, `low_confidence`, `unrecognised`, `failed` |
| `confidence` | `text` | optional, check in `high`, `medium`, `low` |
| `raw_response` | `jsonb` | optional, cleared after 90 days |
| `cost_cents` | `numeric(6,3)` | optional |

Indexed on `(user_id, created_at)`. This index is the scan counter: a count over a date range answers usage with no separate table.

`weight_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | required, references `auth.users(id)` on delete cascade |
| `on_date` | `date` | required, local calendar date |
| `recorded_at` | `timestamptz` | required |
| `weight_kg` | `numeric(5,2)` | required, check between 20 and 500 |
| `source` | `text` | required, check in `onboarding`, `manual` |

Unique on `(user_id, on_date)` where `deleted_at is null`: one weigh in per day, a second replaces the first. Indexed on `(user_id, on_date)`.

`exercise_entries` (built in release 2, designed now)

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key |
| `user_id` | `uuid` | required, references `auth.users(id)` on delete cascade |
| `on_date` | `date` | required, local calendar date |
| `performed_at` | `timestamptz` | required |
| `tz_at_save` | `text` | required |
| `activity` | `text` | required |
| `duration_minutes` | `integer` | optional, check greater than 0 |
| `calories_burned` | `integer` | required, check at least 0 |
| `source` | `text` | required, check in `manual`, `estimated` |

Indexed on `(user_id, on_date)` where `deleted_at is null`.

`sync_state` (SQLite only, never synced, no `user_id` because the file already belongs to one user)

| Column | Type | Notes |
|---|---|---|
| `table_name` | `text` | primary key |
| `last_pulled_at` | `text` | required, the watermark `pullChanges` resumes from |
| `last_pushed_at` | `text` | optional, for diagnostics |

This is where the pull watermark lives. Without it the device has no memory of how far it got, and every pull would be a full download.

`subscriptions` (designed only, not created by this spec)

`user_id` primary key referencing the auth user, plus `plan`, `status`, `provider`, `provider_ref`, and `current_period_end`. Release 1 treats every account as free with no scan limit. When billing is built, this table is added and nothing existing changes.

Relationships: the auth user has one profile and many of everything else. A meal has many items. A scan produces zero or one meal, because a scan the user discards still leaves its record and its cost.

**State transitions**

A meal item's `source` is the one state machine, and it is one way:

```
ai_scan ----(user edits a value)----> ai_edited
manual  (created by hand, never becomes ai_scan)
```

Once an item is `ai_edited`, changing the quantity still rescales every resolved field except those named in `edited_fields`, which keep the value the user typed. `confidence` stays on the item as the scan's original claim and is not cleared by an edit, because it describes where the number came from, not how good it currently is.

A row's deletion is the second, and it is one way and sticky:

```
live ----(delete)----> deleted        (deleted_at set)
deleted --X-->  live                  (never, by any path)
```

An incoming synced row carrying `deleted_at` null for an identifier that is already deleted is rejected, whatever its `updated_at` says. Without this rule a device that was offline when the delete happened resurrects the meal on its next push, which would break AC-5.

**API surface**

There are no HTTP endpoints in release 1. The surface is a set of data access functions over the local database, plus the two sync calls that arrive with feature 5. Every read is local; every write is local and then pushed.

| Function | Shape | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `saveMeal` | local write | `meal` (required), `items` (required, at least one) | `meal_id` | local session | invalid quantity, no items |
| `listMealsForDay` | local read | `on_date` (required), `limit`, `cursor` | meals with items, day totals | local session | none expected |
| `deleteMeal` | local write | `meal_id` (required) | ok | local session | not found |
| `rescaleItem` | pure function | `item` (required), `quantity` (required) | the item with new resolved values | none, no side effects | quantity not greater than 0 |
| `getOrCreateDailyTarget` | local write | `on_date` (required) | the target row | local session | profile not onboarded |
| `searchPastItems` | local read | `query` (required), `limit` | distinct past item names with their last numbers | local session | none expected |
| `computeStreak` | local read | `today` (required) | consecutive day count | local session | none expected |
| `pushChanges` | Supabase upsert | rows where `is_dirty = 1` | accepted identifiers, server `updated_at` | bearer | network failure, conflict resolved by newest write |
| `pullChanges` | Supabase select | `since` (required, per table watermark) | rows changed since, including tombstones | bearer | network failure |

**Value sourcing**

| Action | Value produced or displayed | Source |
|---|---|---|
| `saveMeal` | `eaten_on`, the day the meal counts against | derived from the device clock and the device's current IANA zone at the moment of saving, stored, never recomputed |
| `saveMeal` | `tz_at_save` | the device's current IANA zone, read from the platform |
| `saveMeal` | `meal_type` | guessed from the local hour of `eaten_at`: `breakfast` from 04:00 up to but not including 11:00, `lunch` from 11:00 up to 15:00, `dinner` from 17:00 up to 21:00, and `snack` at every other hour. Overridable, with `meal_type_source` recording whether it was guessed or chosen |
| `saveMeal` | `id` | UUID version 7 generated on the device |
| `listMealsForDay` | which day is "today" | the device's current local calendar date at read time, not `profiles.timezone` |
| `listMealsForDay` | the meal total and the day total | a sum over `meal_items` where `deleted_at is null`, computed on read |
| `listMealsForDay` | remaining calories | `daily_targets.calories` minus eaten, plus burned times `exercise_credit_factor` when `exercise_credit` is not `none`. In release 1 burned is **always 0**, because `exercise_entries` does not exist until release 2. The formula is written once, in full, and the burned term simply reads zero |
| `listMealsForDay` | the paging order | keyset on `(eaten_at desc, id desc)`, so a meal inserted during paging cannot make a row skip or repeat |
| `searchPastItems` | the paging order | keyset on `(name asc, id asc)` |
| `pullChanges` | the paging order and where to resume | keyset on `(updated_at asc, id asc)`, resuming from `sync_state.last_pulled_at` for that table |
| `getOrCreateDailyTarget` | `calories` | computed from `profiles` and the newest `weight_entries` row by the formula feature 6 defines; `formula_version` records which formula ran |
| `getOrCreateDailyTarget` | the weight the calculation uses | the newest `weight_entries` row at or before `on_date`, falling back to the onboarding entry |
| `rescaleItem` | `calories` and each macro | `base_*` times `quantity` divided by `base_per`, rounded on write (calories to a whole number, macros to one decimal) |
| `computeStreak` | the streak count | consecutive local dates back from yesterday having at least one live meal, plus today when today already has one |
| `searchPastItems` | the suggested numbers | the most recent `meal_items` row for that name belonging to this user; empty on a new account, which the screen states plainly |
| `pushChanges` | conflict winner | a deleted row always wins, whatever the timestamps say. Otherwise the row with the later `updated_at`, with ties resolving to the server copy |
| `pushChanges` | `updated_at` | assigned by the server on receipt, never trusted from the device, so a wrong device clock cannot win every conflict |
| `saveMeal`, `getOrCreateDailyTarget` | `id` for a day keyed row | UUID version 5 over the project namespace, `user_id`, and `on_date`, so two offline devices produce the same identifier for the same day |
| any read | which rows are visible | `deleted_at is null`, always, plus row level security in Postgres |
| any display of a health number | whether it is an estimate | `meal_items.source` and `meal_items.confidence` |
| profile display | current age | `age_years` plus whole years elapsed since `age_recorded_on` |

**Key invariants**

- A meal total always equals the sum of its live items, because no total is stored.
- `meal_items.calories` always equals `base_calories` times `quantity` divided by `base_per`, rounded, unless that field is named in `edited_fields`.
- `eaten_on` never changes after the meal is saved. Moving a meal to another day is a separate, explicit action.
- Exactly one live `daily_targets` row exists per user per local date, enforced by a partial unique index.
- Exactly one live `weight_entries` row exists per user per local date.
- Every row in every table has a `user_id` equal to the signed in user. There is no shared or global row anywhere in the schema.
- A row is never physically deleted by user action. Only the retention sweep removes rows, and only tombstones older than 90 days.
- `updated_at` never moves backwards, and is only ever set by the server once a row has been pushed.
- A deleted row is never revived. `deleted_at` only ever goes from null to a time.
- The identifier of a `daily_targets` or `weight_entries` row is a pure function of its `user_id` and its `on_date`, so it is the same on every device.
- Weight is kilograms and height is centimetres, everywhere, in both databases.
- A `daily_targets` row is never recomputed after it is written. Adding a weight entry backdated to a day whose target already exists does **not** change that target. This is deliberate, not an oversight: the target that applied on a day is what the person was actually eating against.

**Security model**

Isolation is enforced by Postgres, not by application code. Every table gets:

```sql
alter table <t> enable row level security;
alter table <t> force row level security;

create policy <t>_own_rows on <t>
  for all to authenticated
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create index <t>_user_id_idx on <t> (user_id);
```

`auth.uid()` is wrapped in a `select` so Postgres evaluates it once for the statement rather than once per row, and `user_id` is indexed on every table because every policy tests it. `meal_items` carries its own `user_id` rather than reaching through `meal_id`, so no policy needs a join.

On the phone, isolation is physical: each account gets its own SQLite file named for the user, opened on sign in and closed on sign out. Two accounts cannot share a file, so a missed filter cannot leak between them.

**Sign out removes the file**, once every dirty row has been pushed. If a push is still pending, the file stays and is retried on the next sign in, because losing unsynced meals would be worse than holding them. Nothing is kept for convenience: a signed out account leaves no diary on the device. This matters on a shared or family phone, where otherwise a full health record would sit on disk indefinitely after someone signs out.

**Deleting the account removes three things, not one.** A foreign key cascade only reaches rows in tables, so it handles the diary and the tombstones. It does not touch Supabase Storage, and it does not touch the phone. The full path is: the database rows go by cascade from `auth.users`; the stored photos go by an edge function that deletes the whole `<user_id>/` prefix from the storage bucket; the local database file and any local photo files are removed on the device. All three are required for AC-10 to be true, and the storage step is the one a cascade silently will not do.

**Compliance scope**: consumer wellness, not regulated medical data. No HIPAA obligations apply and no audit log of reads is built. What does apply, and what the schema must support: explicit consent recorded before health details are collected (`consented_at`, `consent_version`), a delete that genuinely removes everything (cascades from `auth.users`, plus the stored photos), and an export of everything one user has. Health values never appear in logs. If this app ever moves toward clinical use, a read audit log becomes mandatory and is a schema change, so the decision is recorded here rather than assumed away.

**Configuration required**

This spec introduces no new environment variables. The Supabase project URL and anonymous key arrive with feature 5 and are already reserved in `.env.example`. Two operational settings belong to the retention sweep and are recorded here rather than invented later:

- Tombstone retention: 90 days, after which a soft deleted row is removed.
- Raw scan response retention: 90 days, after which `meal_scans.raw_response` is set to null while the rest of the row stays.

**Critical test scenarios**

- Happy path: a meal with three items saved at 23:50 local time appears under today, and the day total equals the sum of the three items, verifies **AC-3**, **AC-7**.
- Rescaling: an item at 180g rescaled to 250g and back to 180g returns exactly its original numbers, with no drift, verifies **AC-6**.
- Parity: the generated SQLite schema and the generated Postgres schema are compared column by column and agree, verifies **AC-1**.
- Failure case: a sync push interrupted after the server has written but before the device records the acknowledgement, then retried, produces no duplicate rows, verifies **AC-14**.
- Failure case: a meal deleted on device A does not return to device B after two full sync cycles, verifies **AC-5**.
- Failure case: device B, offline when the delete happened, edits that same meal and pushes. The delete still wins and the meal stays gone, verifies **AC-5**.
- Failure case: two offline devices each create a target and a weigh in for the same day, then both sync. Exactly one live row per day survives on each side, verifies **AC-9**.
- Failure case: a device with a clock running an hour fast pushes an older edit. It does not overwrite a newer edit made on the other device, verifies **AC-14**.
- Rescaling: an item whose calories were typed by hand keeps that number when the quantity changes, while its macros rescale, verifies **AC-6**.
- Paging: a list is paged while a new row is inserted ahead of the cursor, and no row is skipped or returned twice, verifies **AC-16**.
- Sign out: signing out with everything pushed leaves no database file on the device; signing out with a pending push keeps the file and retries on the next sign in, verifies **AC-11**.
- Auth and permission: a signed in user selecting `meals` with another user's `user_id` receives zero rows, verifies **AC-2**.
- Auth and permission: signing out and signing in as a second account on the same phone shows an empty diary, and the first account's file is untouched and unreadable from that session, verifies **AC-11**.
- Deletion: deleting an account leaves no row for that user in any table, tombstones included, verifies **AC-10**.
- Timezone: a meal saved in Colombo and read after the device moves to London keeps its original `eaten_on`, verifies **AC-3**.
- Precision: a day of twelve items round trips through both databases with macro totals equal to one decimal place, verifies **AC-13**.

## Build plan

Ordered the Skateboard way: the thinnest usable whole first. Steps 1 to 4 give a diary that works completely on one phone with no account and no network, which is exactly what spec 0001 set as the first build target. The cloud half is added underneath it afterwards without any screen changing.

1. [x] Write the schema declaration module in `src/data/schema/`: the table description type, and one file per table for the six release 1 tables, as plain data with no database imports, satisfies **AC-1**.
2. [x] Write the two generators as pure functions, `toSqlite` and `toPostgres`, plus the type derivation, and the parity test that compares their output, satisfies **AC-1**, **AC-13**.
3. [x] Generate and apply SQLite migration 2 for the six release 1 tables, extending the existing numbered migration runner in `src/db/`, satisfies **AC-1**, **AC-4**, **AC-8**.
4. [x] Build the local data access layer: `saveMeal`, `listMealsForDay`, `deleteMeal`, `getOrCreateDailyTarget`, `searchPastItems`, `computeStreak`, all paginated where they return lists, all filtering `deleted_at is null`, satisfies **AC-5**, **AC-7**, **AC-9**, **AC-15**, **AC-16**.
5. [x] Build the pure calculation functions with no database in them: `rescaleItem`, the local day resolver that decides `eaten_on`, the meal type guesser, and the unit converters, satisfies **AC-3**, **AC-6**, **AC-12**.
6. [x] Build the per user database file lifecycle: open and migrate a database named for the signed in user, and on sign out remove the file once nothing is left unpushed, satisfies **AC-11**.
7. [x] Generate the Supabase migration for the same six tables, with row level security enabled and forced, one policy and one `user_id` index per table, and an index on every foreign key, satisfies **AC-2**.
8. [ ] Add the sync columns, the `sync_state` watermark table, and the push and pull functions. Pushes upsert on the primary key so a replay is idempotent, the server stamps `updated_at`, a deleted row always wins, and pulls resume by keyset from the stored watermark, satisfies **AC-5**, **AC-14**, **AC-16**.
9. [ ] Add the account deletion path in all three places it has to reach: the cascade from the auth user, an edge function removing the user's storage prefix, and removal of the local database and photo files on the device, satisfies **AC-10**.
10. [ ] Add the retention sweep for tombstones and raw scan responses, satisfies **AC-17**.
11. [ ] Add `exercise_entries` as SQLite migration 3 and the matching Supabase migration when release 2 begins. Purely additive, nothing above changes. This step is outside the release 1 contract and carries no acceptance criterion here; feature 12 owns its criteria.

**Build progress (9 August 2026, `/develop`)**

Steps 1 to 7 are built, and green under `npm test`: 238 Vitest tests across 16
files covering the pure calculations, the identifiers, the two generators, and
the data access layer driven against a real SQLite database. Every test that
pins an acceptance criterion carries a `covers: AC-N` comment. (An earlier pair
of `check:schema` and `check:data` scripts did this job and has been replaced
by the suite, so `npm test` is the single gate in CI.)

Step 7 is applied to the live Supabase project (`Cal Snap`,
`kfzlocqwrzgkyqkzphfq`, Postgres 17) from
`supabase/migrations/20260809000000_core_data_model.sql`, and confirmed by
querying the database rather than by trusting the migration file: six tables,
87 columns (the same count the parity check compares), row level security
**enabled and forced** on every one, and one `<table>_own_rows` policy each
whose `using` and `with check` both read
`(user_id = (select auth.uid()))` for the `authenticated` role. Supabase's
security advisors report nothing.

That proves the structural half of **AC-2**. Its behavioural half, a signed
in user selecting another user's rows and receiving zero rows, still needs a
real session, so it lands with feature 5.

Steps 8 to 10 wait for feature 5 too, which brings the Supabase client, a
signed in session, and the scheduling the retention sweep needs.

One ordering change from the plan as written: the SQLite `is_dirty` and
`synced_at` columns are created in migration 2 rather than added in step 8.
The data model sketch says every SQLite table carries them, and adding them
up front avoids altering six shipped tables later.


## Consequences

**Positive**

- One place to change a table. The most likely long term bug in a local first app, a column that exists on one side only, is made structurally impossible rather than merely tested for.
- The whole diary works with no network and no account, so the first shippable build needs no backend and costs nothing to run.
- Isolation is a property of the database. A query written wrongly returns nothing rather than someone else's meals.
- History is honest. A past day keeps the target it actually had, and a corrected item cannot disagree with the total above it.
- Billing has a real usage record from day one, so a scan limit can be priced from actual numbers rather than guessed.

**Negative and tradeoffs**

- Soft deletes are usually the wrong choice, and this spec chose them anyway. They complicate every query with a `deleted_at is null` clause, they force partial unique indexes, and a forgotten clause shows deleted meals. Offline sync leaves no honest alternative: without a tombstone, the second device cannot tell a deleted row from a row it has not seen. The retention sweep limits the damage and the cost is real.
- Newest write wins loses data in a genuine conflict. Two phones editing the same meal in the same minute means one edit disappears with no warning. That is acceptable for one person with one or two devices and it would not be acceptable for a shared diary.
- Sign out deletes the local diary, so signing back in re-downloads it. That is slower than keeping the file, and it is the right trade on a phone that more than one person might use.
- Two tables use a deterministic identifier while the rest use a random one. That inconsistency has to be understood by anyone adding a table: the rule is that a row keyed by a day gets a deterministic identifier, and a row recording an event does not.
- The generator is code you own and must maintain. It is small and pure, but it is a layer between you and both databases, and a bug in it lands in both at once.
- SQLite has no exact decimal type, so macros are stored as `REAL` there and rounded on write to stay equal to Postgres. That rounding is a rule the code must keep, not something the database enforces.
- Carrying `user_id` on `meal_items` duplicates what `meal_id` already implies. It is deliberate, for policy speed, and it is one more column that could be set wrongly.
- No read audit log. Correct for consumer wellness, and it means you cannot answer "who looked at this" if the product ever moves toward clinical use.

**Neutral**

- `weight_entries` moves into release 1 because onboarding writes the first weight there. That is one more table in the first migration and a trend line that starts on day one.
- The design's exercise rule is now recorded as a per user setting defaulting to full credit. Feature 12 still owns the product decision and can change the default without a migration.
- Age is stored as the number given at onboarding plus the date it was given, because the design asks for age and not a birthday. Age advances by whole years and the app never invents a birth date it was not told.

## Follow-up

- [ ] The design at `docs/design/CalSnap.dc.html` includes an "Add by hand" food search screen. This spec sources it from the user's own past items, which is empty on a new account. Feature 8 should design what that screen says on day one, or the deferred food database moves forward.
- [ ] The design shows a day streak on the Today screen. The definition is settled here (any day with at least one meal) but the streak has no scope feature of its own. It belongs to feature 9.
- [ ] Spec 0001 records the test runner as Jest with the `jest-expo` preset, while `test-preferences.json` records Vitest. The parity test in build step 2 needs one of the two corrected first.
- [ ] Feature 6 owns the calorie formula. This spec reserves `daily_targets.formula_version` for it but does not choose the formula.
- [ ] Photo upload to Supabase Storage is designed here as columns only. The upload path, the storage bucket policy, and what happens to a photo when its meal is deleted belong to feature 7 or 8.
- [ ] The retention sweep has no home yet. It is a scheduled job, most naturally `pg_cron` in Supabase, and needs deciding when the backend is stood up in feature 5.
- [ ] The local half of the retention sweep also has no trigger. Postgres can be scheduled; the phone cannot. The most likely answer is a sweep on app launch, and feature 5 should settle it alongside sync.
- [ ] Newest write wins is still the only arbitration, now with a server stamped clock and a sticky delete. It remains capable of losing an edit when two phones change the same meal in the same minute. That is an accepted trade for one person and one or two devices, and PowerSync is the named upgrade path in spec 0001 if it starts hurting.
- [ ] `supabase` and `supabase-postgres-best-practices` conventions shape every file under a future `src/data/` directory. Once that directory exists, its `AGENTS.md` should carry them, rather than root, since they are only needed when working there.

## Rationale

Reasoning, the options weighed, and the forces behind each pick: see [rationale.md](rationale.md).

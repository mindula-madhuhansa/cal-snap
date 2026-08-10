# 0005. Server owned clock and sticky tombstone for sync arbitration

**Date**: 2026-08-10
**Status**: Proposed

## Summary

Spec 0002 says the server decides who wins when two phones change the same meal, and that a deleted
meal never comes back. Neither of those is true today: nothing in Postgres does the deciding, so the
phone that pushes last simply overwrites, carrying its own clock with it. This spec puts a small
piece of database code (a trigger, meaning code Postgres runs automatically on every write) behind
both rules, and changes the push so a phone learns the outcome instead of assuming it won. It is
cheap to do now because no real diary exists yet, and expensive later.

## Requirements

**User stories**:

- As someone with a phone and a tablet, I want a meal I logged on one to appear on the other, even
  when one of the two has the wrong time set, so that my diary is the same everywhere.
- As someone who deleted a meal, I want it to stay deleted on every device I ever sign in on, so
  that I do not have to delete the same mistake twice.
- As the engineer, I want the arbitration rule to be enforced where it is written down, so that a
  spec sentence and the running system cannot quietly disagree again.

**Acceptance criteria**:

- **AC-1**: `updated_at` on every row in Postgres is the value the server assigned, whatever the
  device sent. A phone with a clock set hours ahead or behind cannot change it.
- **AC-2**: When two devices change the same row, the one whose push arrives second is the stored
  result, and the first device ends up holding that same content once it next pushes or pulls.
- **AC-3**: A push carrying `deleted_at` as null for a row the server already has as deleted leaves
  the server row deleted, and the pushing device ends up holding the tombstone locally.
- **AC-4**: `created_at` is never moved by a later push. A meal and its items keep the single
  instant `saveMeal` gave them.
- **AC-5**: A row changed on the phone while its own push is in flight stays dirty and is pushed
  again on the next sync, rather than being marked clean or overwritten by the reply. A push that
  confirms nothing ends rather than re-sending the same page, and reports the count the server
  actually confirmed.
- **AC-6**: Every row the server **accepts** in one push gets a distinct `updated_at`, so a pull
  watermark can always advance past a full page. A refused row is the deliberate exception: it
  changes nothing at all, its stamp included.
- **AC-7**: `supabase/migrations/20260809000000_core_data_model.sql` is unchanged byte for byte, the
  triggers arrive in a second generated migration, and no Postgres SQL is written by hand.
- **AC-8**: With one device's clock set two hours behind, a row it pushes is still pulled by the
  other device, and still loses to a later change from that device.

## Decision

**Chosen option**: Option 2: stamp the clock in a Postgres trigger and make the push read the reply.

Postgres assigns `updated_at` on every insert and update, refuses to move `deleted_at` back to null,
and freezes `created_at`; the phone stops assuming its push won and writes the returned row back
into SQLite instead.

**Implementation skills**: `supabase-postgres-best-practices` (`supabase/agent-skills`,
`.agents/skills/supabase-postgres-best-practices/`) · `supabase` (`supabase/agent-skills`,
`.agents/skills/supabase/`)

## Feature design

**Data model sketch**

No new entities, columns, indexes, or constraints. The change is behavioural on columns that already
exist. `updated_at` changes meaning: it stops being "when this device edited the row" and becomes
"when the server accepted it", which is what spec 0002 always said it was.

**The two trigger functions**

Two, not one, because a function that reads `NEW.deleted_at` raises at runtime on a table without
that column, and this project does not use dynamic SQL where a second function will do.

| Function | Applied to | What it does |
| --- | --- | --- |
| `public.sync_stamp()` | `profiles`, `meal_scans` | Insert: sets `updated_at` to `clock_timestamp()`. Update: sets `updated_at` to `clock_timestamp()` and `created_at` back to `OLD.created_at`. |
| `public.sync_stamp_sticky_delete()` | `meals`, `meal_items`, `daily_targets`, `weight_entries` | Everything above, plus: on update, if `OLD.deleted_at` is not null and `NEW.deleted_at` is null, returns `OLD` so the stored row is left exactly as it was. |

Both are `language plpgsql`, both are `security invoker` (the default, and correct here: the trigger
reads only `OLD` and `NEW` and needs no privilege of its own, so `security definer` would hand it a
row level security bypass it has no use for), and both carry `set search_path = ''`. The only
function they call is `clock_timestamp()`, which lives in `pg_catalog` and stays reachable with an
empty search path.

One trigger per table, named `<table>_sync_stamp`, declared `before insert or update ... for each
row`. Six tables get one, chosen by `presence: 'both'`; the sticky variant is chosen by
`softDelete: true`, both read off the existing declarations in `src/data/schema/tables/`.

**Returning `OLD`, not null, is load bearing.** A `before` trigger that returns null cancels the row
and PostgREST leaves it out of the reply, so `pushChanges` would never see an acknowledgement, the
row would stay dirty forever, and every sync from then on would retry it. Returning `OLD` performs a
write that changes nothing and puts the stored row in the reply, which is exactly what the phone
needs in order to learn it lost.

**A refusal reverts the whole row, not only `deleted_at`.** Returning `OLD` restores every column,
so `updated_at` stays frozen at the tombstone's stamp and any other edit the device bundled into
that same write is discarded with it. That is intended rather than a side effect: an edit to a meal
that has already been deleted has nothing to apply to. It is the one case where a push leaves a
stamp unmoved, which is why AC-6 is written about rows the server accepts.

**State transitions**

The row lifecycle from spec 0002 is unchanged, but the one way arrow is now enforced by the database
rather than only by `mayApply` in `pull.ts`:

```
live ----(delete)----> deleted        (deleted_at set)
deleted --(any push)-> deleted        (the trigger returns OLD)
```

**API surface**

No endpoint changes. What changes is what an upsert returns and what the caller does with it.

| Call | Method | Key inputs | Key outputs | Auth | Key errors |
| --- | --- | --- | --- | --- | --- |
| `pushChanges` | PostgREST upsert on the primary key, then `select` | dirty rows as sent | **the stored rows**, which may differ from what was sent | Clerk bearer token | network failure, `42501` or `PGRST3xx` as today |
| `pullChanges` | PostgREST select, keyset on `(updated_at, key)` | `since` watermark | rows changed since | Clerk bearer token | network failure |

**Value sourcing**

| Action | Value produced | Source |
| --- | --- | --- |
| any write to Postgres | `updated_at` | `clock_timestamp()` inside the trigger, never the device |
| insert | `created_at` | the device, kept as sent, so `saveMeal`'s one instant per meal survives |
| update | `created_at` | `OLD.created_at`, frozen by the trigger |
| two devices changing one row | the winner | whichever push arrives second, since the server stamps the clock |
| push of a live row over a tombstone | every stored column, not just `deleted_at` | `OLD`, returned whole by the trigger, so a bundled edit is discarded with the revival |
| a refused push | the stored `updated_at` | unchanged, the only case where a push moves no stamp |
| push | the local row's content afterwards | the row PostgREST returned, written back whole |
| push | whether a local row may be marked clean | the `updated_at` the device sent still matching the local row |
| pull | where to resume | `sync_state.last_pulled_at`, now holding only server assigned instants |

**The push change, precisely**

`acknowledged` in `src/data/remote/push.ts` currently keeps one value per returned row, its
`updated_at`, and marks the local row clean. It becomes: for each returned row, write every shared
column back into SQLite along with `synced_at` and `is_dirty = 0`, guarded by the `updated_at` the
device sent for that row.

The guard needs the value that was sent, and the reply does not carry it, because the server has
already replaced it. Build a map from key to `updated_at` over the `dirty` batch that is already in
hand before the request, and look each returned row up in it by its key. A returned row whose key is
not in the map is not this device's push and is skipped.

```
UPDATE <table> SET <every shared column> = ?, synced_at = ?, is_dirty = 0
 WHERE <key> = ? AND updated_at = ?          -- the value that was sent
```

Zero rows changed means the person edited that row while the push was in flight. It stays dirty and
goes again next cycle, which is the correct outcome and is not what happens today.

**The batch loop needs a stopping rule, because a row may now stay dirty.** `pushTable` reads dirty
rows in pages and today ends only when it reads a short page, which was safe while every sent row
was marked clean. A full page containing one row the guard leaves dirty would otherwise be read and
sent again immediately. Two changes:

- End the loop when a pass confirms no rows at all. Those rows are being edited right now and the
  next sync will take them.
- Count rows the server confirmed, not rows sent. `PushResult.rows` currently adds `dirty.length`,
  which would overstate the work and hide the fact that something did not land.

`recordPush` still runs once per pass, including a pass that confirmed only some of its rows. It
records when this device last pushed the table, not that the table is fully pushed, and
`countPendingPushes` remains the thing that answers that.

**Key invariants**

- `updated_at` in Postgres is only ever written by a trigger, and only ever forward.
- `deleted_at` in Postgres only ever goes from null to a time.
- `created_at` in Postgres is written once, on insert, and never again.
- A local row is marked clean only when the server confirmed the exact version that was sent.
- A refused write moves nothing, its stamp included. It is the only push that leaves a row untouched.
- A push pass that confirms nothing ends the loop rather than repeating it.
- The applied core migration file is never regenerated.

**Security model**

Unchanged. Row level security stays enabled and forced on all six tables, with the same
`(user_id = (select auth.jwt() ->> 'sub'))` policy. Triggers fire after a policy has already
admitted the row, so this adds no path around isolation and needs no privilege of its own. Health
data, so the same care as spec 0002.

**Configuration required**

None. No new environment variables, keys, or dashboard settings.

**Critical test scenarios**

Split by what can actually run where. The suite runs on plain Node against `node:sqlite` and cannot
execute a Postgres trigger, so the trigger's text is pinned by the generator tests and its behaviour
is proven against the live project at `/check verify`.

Automated, in Vitest:

- The emitted SQL uses `clock_timestamp()` and not `now()`, freezes `created_at` on update, and
  carries `set search_path = ''`, verifies **AC-1**, **AC-4**, **AC-6**.
- The sticky variant is emitted for exactly the four tables with `softDelete: true` and for no
  others, verifies **AC-3**.
- The trigger SQL does not appear in the core migration output, verifies **AC-7**.
- Driving the real `pushChanges` against the fake server: a reply whose content differs from what
  was sent replaces the local row, verifies **AC-2**.
- A reply carrying a tombstone for a row the device pushed as live leaves the local row deleted and
  clean, verifies **AC-3**.
- A row updated between the send and the reply stays dirty and is not overwritten, verifies **AC-5**.
- A full page in which nothing is confirmed ends the push rather than re-sending the same page, and
  the reported row count is what the server confirmed, verifies **AC-5**.

Manual, through the Supabase MCP against the `Cal Snap` project at `/check verify`:

- Upsert a row with an `updated_at` far in the future and read back what was stored, verifies
  **AC-1**.
- Upsert a live row over an existing tombstone and confirm the stored row is still deleted, verifies
  **AC-3**.
- Upsert several rows in one statement and confirm every `updated_at` differs, verifies **AC-6**.
- On two development builds with one device's clock set two hours behind, confirm its row still
  arrives on the other and still loses to a later change, verifies **AC-8**.

## Build plan

Skateboard, so the first slice is the thinnest thing that is genuinely whole: the server owns the
clock and the tombstone, applied and proven, before the phone half is touched. That order is safe on
purpose, see `## Migration plan`.

1. Add `toPostgresSyncTriggers(tables)` to `src/data/schema/to-postgres.ts`: the two functions, and
   one trigger per table with `presence: 'both'`, picking the sticky variant by `softDelete`. Pure,
   like the rest of that file. Satisfies **AC-1**, **AC-3**, **AC-4**, **AC-6**.
2. Extend `scripts/generate-supabase-migration.ts` to write a second file,
   `supabase/migrations/20260810000000_sync_arbitration.sql`, leaving the core migration untouched.
   Satisfies **AC-7**.
3. Add the generator tests listed above, beside the existing ones. Satisfies **AC-1**, **AC-3**,
   **AC-4**, **AC-6**, **AC-7**.
4. Apply the new migration to the live `Cal Snap` project. Satisfies **AC-1**, **AC-3**.
5. Rewrite `acknowledged` and its update in `src/data/remote/push.ts` to write the whole returned
   row back, guarded on the sent `updated_at` looked up by key, and give `pushTable` its stopping
   rule and a confirmed row count. Satisfies **AC-2**, **AC-3**, **AC-5**.
6. Add the push tests in `src/data/remote/sync.test.ts`, driving the real push against the fake
   server. Satisfies **AC-2**, **AC-3**, **AC-5**.
7. Run the live checks through the Supabase MCP and record them in `verify.md`. Satisfies **AC-8**,
   and re-proves **AC-1**, **AC-3**, **AC-6** against the real database rather than the generated
   text.

## Migration plan

**Strategy**: additive, in two independent deployments. No existing data is transformed, and there
is no code freeze.

**Phases**:

1. The new migration adds two functions and six triggers. It touches no existing row, because the
   trigger only fires on a write. Safe to apply before the app changes: the current `pushChanges`
   already stores whatever `updated_at` the reply carries, so it gets the server value immediately
   and correctly. The one case it handles badly is a refused push, which cannot happen yet, since
   nothing writes meals until scope feature 9 and there is no second device with an offline delete.
2. The push change ships with the next app build. From that point a refused push heals itself.

**Rollback**: phase 1 reverts with `drop trigger` on six tables and `drop function` twice, and
nothing depends on the stamps having happened. Phase 2 is one commit. The two revert independently
and in either order.

**Risks**:

- Returning null instead of `OLD` from the trigger would strand rows dirty forever, retried on every
  sync. Called out above; the tests pin it.
- Leaving `search_path` unset would raise a Supabase advisor warning and is a real hazard on a
  `security definer` function, which this deliberately is not.
- The hard deletes that scope feature 10's account deletion webhook and the retention sweep will
  perform are unaffected: these are `before insert or update` triggers and never fire on a delete.
- The window is small because no real diary exists yet. My probe row and the phone's placeholder
  `profiles` row are the only rows in the database. Every month this waits, the migration gets more
  expensive and less reversible.

## Consequences

**Positive**:

- The bug that hides rows completely goes away. A device with a slow clock currently pushes rows
  stamped behind another device's watermark, and that device never pulls them: both phones online,
  nothing failing, a meal simply missing. One clock removes it at the source.
- AC-5 of spec 0002 becomes true in the database rather than in client code a future caller could
  bypass. A fresh phone can no longer pull a meal that was deleted.
- Arbitration becomes one sentence a person can hold in their head: the last push wins. There is no
  comparison to get wrong, because there is nothing left to compare.
- A refused push heals itself on the same round trip, using data already on the wire.
- The in flight edit guard closes a hole that exists today independently of this change: a push
  currently marks a row clean even if the person edited it a moment ago.

**Negative / tradeoffs**:

- Whoever syncs last wins, even if they edited first. Someone who edits a meal offline on Monday and
  opens the app on Wednesday overwrites a Tuesday edit made on the other device. Spec 0002 already
  accepts losing an edit in a genuine conflict; this makes the losing rule "who synced last" rather
  than "who edited last", which is easier to reason about and occasionally less fair.
- The behaviour that matters most here can never be tested by `npm test`. Part of the proof is
  manual against the live project, forever, and manual proof rots.
- The generator now writes two files, and someone must remember to run it after touching a
  declaration. `src/data/AGENTS.md` says the folder is generated; it will need to say both files.
- Every row write costs a trigger call. Irrelevant at this volume and worth saying out loud anyway.
- A residual and deliberately accepted gap remains: a row committed just after another device
  advanced its watermark past that instant is never pulled again. A PostgREST upsert is a single
  sub millisecond statement so the window is tiny, but it is not zero. The structural fix is paging
  on a monotonic sequence instead of a timestamp, which was considered and turned down.

**Neutral**:

- Three sentences in spec 0002 stop being true of the code they describe and are corrected in this
  same run, with a pointer here.
- `updated_at` is now strictly a server value once a row has been pushed. Any future feature that
  wants "when did I last change this on this phone" must not read it.
- `sync_state` is local only and gets no trigger, correctly.

## Follow-up

- [ ] Nothing checks that a spec's server side claims are true of the live database. This gap
      survived a build, a test pass, a fresh model review, and a run on a real phone, because
      everything that could see it was reading the same text rather than the database. Spec 0002
      already carries a related item (a generator guard against `auth.uid()`). Worth one check that
      reads the live schema back and compares it to what the specs assert.
- [ ] Verifying AC-2 and AC-8 properly needs two devices signed in to one account, and the review of
      feature 5 raised an open question about whether Clerk allows two sessions at once on one
      device. Neither is a blocker here, but the two phone check cannot happen until there is a
      second device.
- [ ] AC-2 and AC-8 cannot be exercised end to end until scope feature 9 writes real meals. Until
      then the proof is at the row level through the MCP, which is honest but is not the same thing.
- [ ] The header comment in `scripts/generate-supabase-migration.ts` should mention the second file
      once it exists, and `src/data/AGENTS.md` should say the folder now holds two generated
      migrations.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

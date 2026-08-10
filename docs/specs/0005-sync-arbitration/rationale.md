# 0005. Rationale

The reasoning behind [index.md](index.md). `/develop` does not need this file.

## Context

Spec 0002 settled how two devices reconcile the same diary. Three of its rules are load bearing:
`updated_at` is stamped by the server and not by the device, the newer write wins with ties going to
the server copy, and a deleted row is never revived. Feature 5 built the sync layer on top of those
rules and shipped it, and the identity change to Clerk amended 0002 twice without touching them.

None of the three is enforced. Checked against the live `Cal Snap` project on 10 August 2026,
`pg_trigger` returns no rows in `public`, so nothing assigns `updated_at`. The push in
`src/account/supabase-transport.ts` is a plain PostgREST upsert, which writes what it is given and
overwrites unconditionally. So the stored `updated_at` is the sending phone's clock; the comparison
described in 0002 does not happen anywhere, because an upsert has nothing to compare against; and
the sticky tombstone lives only in `mayApply` in `src/data/remote/pull.ts`, on the receiving client.

Three things follow, and the third is the one that changes how urgent this is.

A phone with a fast clock wins every conflict forever, which 0002 predicted.

The tombstone is not sticky on the server. A device that was offline when a meal was deleted pushes
it back as live, and Postgres stores it. Devices that already hold the tombstone refuse it on the way
in, so the bug is invisible on every phone that was present. A phone signing in for the first time
pulls the resurrected meal as real, which is precisely the new device case the whole feature exists
for.

And a phone with a slow clock makes rows disappear. The pull watermark is a keyset on `updated_at`.
A row stamped behind another device's stored watermark is never selected again. This is not a lost
edit during a rare simultaneous change: it is a meal that never arrives, with both devices online,
nothing failing, and nothing on screen to notice.

Two forces shape what can be done about it. The Postgres migration is generated from one declaration
in `src/data/schema/`, by a script that writes a single fixed filename which has already been
applied, so anything added to the existing generator rewrites history rather than extending it. And
the test suite runs on plain Node against `node:sqlite` in seconds, deliberately, so it cannot
execute a Postgres trigger at all.

The cost of waiting is the last force. The only rows in the database are one probe row and the
placeholder `profiles` row from the phone test. Every rule here is free to install today and
progressively harder once people have diaries.

## Options considered

### Option 1: Correct the spec instead, and accept the device clock

Delete 0002's server stamp claim, write down that the pushing device wins, and change nothing in the
code.

**Pros**:

- No migration, no trigger, no new failure mode, and no Postgres behaviour that the Node suite
  cannot reach.
- Honest immediately. The documents would stop describing a system nobody built.
- Fully reversible, because there is nothing to reverse.

**Cons**:

- Leaves the invisible row bug in place. That is silent data loss on a read path, not an accepted
  conflict trade, and no amount of honest documentation makes a missing meal acceptable in a health
  app.
- Leaves the server storing rows it was told to delete, so AC-5 of spec 0002 is false for any new
  device.
- Gets more expensive every month, because the cheap moment to install a write time rule is before
  any rows exist.

### Option 2: A Postgres trigger, and a push that reads the reply

Postgres stamps `updated_at` from its own clock on every insert and update, freezes `created_at`,
and refuses to move `deleted_at` back to null. The phone stops assuming its push won and writes the
returned row back into SQLite.

**Pros**:

- One clock across every device, which removes the invisible row bug at the source rather than
  narrowing it.
- Makes newest write wins and last push wins the same rule, so the comparison 0002 describes
  disappears rather than needing to be built.
- Puts the tombstone rule in the database, where a future caller cannot bypass it, alongside row
  level security which is already enforced there for the same reason.
- Small: two functions, six triggers, one changed step in `push.ts`, no new columns.

**Cons**:

- The behaviour cannot be tested by the suite. Part of the proof is manual against the live project,
  permanently.
- Adds a second generated migration file and a step someone must remember.
- Changes the losing rule from "who edited last" to "who synced last", which is occasionally less
  fair to the person who edited first offline.

### Option 3: Trigger plus a separate device edit time column

As option 2, but each table also carries the moment the device actually edited the row, and the
trigger compares that to pick the winner while still stamping `updated_at` for the watermark.

**Pros**:

- Honours the person who genuinely edited last, even if they synced later. The only option that
  makes newest write wins mean what it says.
- Keeps the watermark on a trusted clock, so it fixes the invisible row bug too.

**Cons**:

- A new column on all six tables, another SQLite migration, changes to the codec and the parity
  check, and the device clock back in the deciding path, which is the thing this whole spec exists
  to remove.
- Buys fairness in a case that barely exists: one person, one or two devices, and 0002 already
  accepts losing an edit in a real conflict.
- Substantially more surface for a benefit nobody would notice.

### Option 4: A monotonic sequence column, and page on that

As option 2, plus a `bigserial` assigned by the same trigger, with `pullChanges` keyed on it instead
of on a timestamp.

**Pros**:

- Structurally removes the residual gap where a row committed just after another device advanced its
  watermark is never pulled again, rather than shrinking it.
- A sequence cannot go backwards, which is a stronger guarantee than any clock gives.

**Cons**:

- Changes the pull keyset, the `sync_state` watermark's type, the codec, and `BEGINNING_OF_TIME`,
  which is a wide change to code that just shipped and has not yet run on a phone.
- The window it closes is one sub millisecond PostgREST statement wide, for one person with one or
  two devices.
- Would land the day before feature 5's pull request, on the exact code path that is about to be
  verified by hand.

## Rationale

Option 2, and the deciding force is the third consequence in Context rather than the first. A wrong
clock winning a conflict is annoying and rare. A wrong clock making a meal invisible is silent loss
on the read path, and the pull watermark makes that inevitable rather than unlikely once two devices
have clocks that differ by more than the gap between syncs. Nothing but one shared clock fixes it,
so option 1 is out however honest it is, and options 2, 3, and 4 all fix it because they all stamp
server side. The choice among those three is only about how much else to buy at the same time.

Option 3 buys fairness that nobody in this product will feel. Spec 0002 already wrote down that a
genuine conflict loses an edit, for one person with one or two devices, and 0004 did not change that.
Paying a column on six tables, another SQLite migration, and a parity change for it, while putting
the device clock back into the deciding path, is a bad trade against a rule that fits in one
sentence.

Option 4 is the technically correct one, and I turned it down on timing rather than on merit. It
rewrites the pull keyset and the watermark type in code that landed this week and has never run on a
phone, at the moment feature 5 is one verification pass from a pull request. The gap it closes is one
statement wide. It is recorded as an accepted limit in Consequences next to the seven day draining
ceiling, so it is a decision rather than an oversight, and it stays available if the diary ever
becomes something two people share.

Two details inside option 2 came from reading the existing code rather than from the shape of the
decision, and both would have been easy to get wrong. `created_at` must not be stamped on insert,
because `saveMeal` deliberately gives a meal and all its items one identical instant and
`searchPastItems` orders on it, while meals and `meal_items` are pushed in separate statements: a
server stamp would split them. And the trigger must return `OLD` rather than null when it refuses a
revival, because a `before` trigger returning null drops the row from PostgREST's reply, which would
leave it dirty and retried on every sync forever. Returning `OLD` is what puts the winning row in
front of the phone, which is the whole reason the push change is worth making.

`clock_timestamp()` over `now()` is the smaller call. `now()` is the transaction's start time, so
every row in one push batch would share an instant, and `pullChanges` stops advancing when a full
page shares one. With `BATCH` at 200 and `PAGE` at 500 that is safe today, but only by the accident
of two unrelated constants in two different files, with no test stating the relationship. A distinct
stamp per row removes the coupling instead of documenting it.

# Review, feat/account-and-sign-in, 2026-08-10

**Reviewed by**: Sonnet 5 (author on Opus)
**Scope**: 81 files in scope (144 changed total incl. vendored skills), branch vs `main` (merge-base `13d3fa2`)
**Verdict**: Changes requested

## Summary

This is a large, careful feature: Clerk replaces Supabase Auth, `user_id` moves to `text` keyed on the
Clerk `sub`, and a full sync layer (push/pull/debounce/draining) lands behind it. The design is
disciplined about the two things that matter most here — row isolation and never losing a diary — and
it shows: pure decision files sit beside their effects, every Postgres policy was regenerated off
`auth.jwt() ->> 'sub'` with a test that fails if `auth.uid()` or `auth.users` ever reappear, the
draining state machine has a documented seven-day ceiling, and the failure-message mapping is
thorough and deliberately narrow (`endsSession` only fires on a refused token, never `offline` or
`rejected`). The known gaps called out for this review (no `updated_at` server stamp, no deletion
webhook, four untested files that import Expo/Clerk/React at module level) are exactly as described
and are not repeated below.

Two real problems remain. Settings silently drops the `'failed'` outcome of `signOutSafely` — a
person who presses "Sign out" and hits a local file-removal error gets no message and stays signed in
with no explanation, which is exactly the kind of silent failure the project rules forbid. And the
draining design assumes the retained Clerk session survives until the next foreground, but this app
supports only one active Clerk session per device; a different person signing in on the same phone
during the drain window would very plausibly end the draining account's session first, silently
converting "will finish shortly" into "will sit for up to seven days and then lose the rows." Neither
is a security hole — isolation itself is solid — but both are gaps in the two guarantees this feature
exists to make.

## Major

### 🟠 A failed sign out is never shown to the person, `src/app/(tabs)/settings.tsx:69-85`

**Problem**: `signOutSafely` can return `{ kind: 'failed', message }` (`src/account/sign-out.ts:52`,
reached when `removeUserDatabase` throws inside `deleteDatabaseAsync`, e.g. a disk error). `runSignOut`
in `settings.tsx` only branches on `'pending'` and `'removed'`:

```ts
if (result.kind === 'pending') { setPending(result.meals); setBusy(false); return; }
if (result.kind === 'removed') await signOut();
recheck();
setBusy(false);
```

For `'failed'`, neither branch fires, no message is shown, and `recheck()` re-runs the startup
sequence with the Clerk session still active and the (still-existing, since deletion failed) file
still there. The person pressed "Sign out", saw the screen re-render, and is quietly still signed in.

**Why it matters**: The root `AGENTS.md` rule is explicit — "Every failure the user can hit says
something honest on screen" — and this is a health app where a shared-phone sign-out is a privacy
action, not just a session action. Someone who believes they signed out and hands the phone over is
still exposing their diary, with nothing on screen telling them it didn't work.

**Suggested fix**: Handle `result.kind === 'failed'` explicitly: show it through `Notice` (the same
pattern already used for `pending`), keep `busy` false, and do not call `recheck()` in that branch
since nothing actually changed.

## Minor

### 🟡 Draining's retained Clerk session can be pulled out from under it by a second sign-in, `src/account/sign-out.ts`, `src/account/session.tsx:244-249`

**Problem**: "Sign out anyway" keeps the Clerk session alive specifically to push the owed rows later
(`sign-out.ts:66-91`, and the AGENTS.md gotcha "draining is a signed out state that still holds a
Clerk session"). But `@clerk/expo` supports one active session per device unless multi-session mode is
turned on in the dashboard (nothing in `docs/specs/0004.../index.md` "Dashboard prerequisites" mentions
enabling it). If a second person signs in on the same phone while an account is draining — the exact
shared-phone scenario AC-11b exists for — Clerk's `finalize()` for the new sign-in very plausibly
replaces the active session, invalidating the draining account's token before its meals can be pushed.
From that point every `resumeDraining` attempt gets `session-ended`/`rejected` from Supabase, never
succeeds, and the guarantee silently degrades from "pushed within a foreground cycle or two" to "sits
unpushed until the seven-day ceiling removes the file with the rows still unpushed" — a worse outcome
than the design intends, reached with nobody told.

**Why it matters**: This is the scenario AC-11b was written for (a borrowed or shared phone), and the
mitigating seven-day ceiling exists precisely so a health record never sits forever — but the ceiling
also means *data loss*, not just delay, is the actual outcome here rather than the "retried on each
foreground" the spec describes as the common case.

**I'm not fully certain of Clerk's exact session-replacement behaviour without exercising it on a
device** — flagging as a risk to verify rather than a confirmed bug. If confirmed, worth either
enabling Clerk multi-session mode, or documenting/accepting the risk explicitly in spec 0004's
Follow-up the way the seven-day number already is.

**Suggested fix**: Verify against a real second sign-in during an active drain on a development build.
If the session is indeed replaced, either enable multi-session support in the Clerk dashboard so the
draining session survives, or record this as a known, accepted risk next to the seven-day ceiling
rather than leaving it undiscovered.

### 🟡 The after-write debounce is not invalidated on account change, `src/account/sync.tsx:159-165, 199-204`

**Problem**: `afterWrite`'s `setTimeout` closes over the `syncNow` in scope when it was scheduled,
which itself closes over the `db`/`transport` current at that render. The only cleanup effect
(`sync.tsx:199-204`) has an empty dependency array, so it clears the timer only when `SyncProvider`
unmounts — which never happens across a sign-out/sign-in cycle, since `SyncProvider` sits above `Gate`
in `_layout.tsx` and persists for the app's whole lifetime. A write followed within three seconds by a
sign-out (and the file being closed) would let the stale timer fire afterward and call `pushChanges`
against a closed SQLite handle.

This path is currently unreachable — `afterWrite` is exported by `useSync()` but nothing in this
change calls it yet (Today is still sample data; the real write path is scope feature 9) — so it is
latent rather than live. It will need addressing before that feature lands.

**Suggested fix**: Clear the pending timer (or make `syncNow`/`afterWrite` check a "still the current
account" guard) whenever `db` changes, not only on provider unmount.

### 🟡 `adoptDrainingFile` is dead code that duplicates `signBackIn`'s logic by hand, `src/account/sign-out.ts:159-168`, `src/account/session.tsx:312-320`

**Problem**: `sign-out.ts` exports `adoptDrainingFile(userId, store)`, which reads the draining record,
checks it belongs to `userId`, and clears it. Nothing calls it. `session.tsx`'s `signBackIn` instead
calls `clearDraining()` directly with no ownership check of its own (relying instead on the UI only
rendering the "Sign back in" button when `draining` state is already true for the current session,
which does happen to make it safe today, per `session.tsx:244-249`).

**Why it matters**: Not a bug today, but two implementations of the same decision that can silently
drift — a future edit to one (e.g. tightening the ownership check) has no reason to touch the other,
and a reader has to notice `adoptDrainingFile` is unused to know which one is authoritative.

**Suggested fix**: Either have `signBackIn` call `adoptDrainingFile(userId)` and act on its boolean, or
delete `adoptDrainingFile` if `session.tsx`'s inline version is meant to be the one implementation.

### 🟡 Sign-in on a fresh device runs a full sync twice, `src/account/session.tsx:282-287`, `src/account/sync.tsx:169-172`

**Problem**: On a brand-new local file, `AccountProvider` itself runs `runSync(..., 'sign-in')` as step
3b before routing (`session.tsx:283-287`). Once `account.kind` becomes `'ready'`, `db` becomes defined
and `SyncProvider`'s Trigger 1 (`sync.tsx:169-172`) fires `syncNow('sign-in')` again. Both build their
own Supabase client and transport, so this is two independent push-then-pull round trips for the same
event, not a shared in-flight run that the second call collapses into.

**Why it matters**: Purely wasted network work at the moment least convenient for it (first-launch pull
of a whole diary over 3G on a fresh device), not a correctness bug — `runSync` is documented as safe to
call repeatedly. Worth trimming since it doubles exactly the request the restoring screen is holding
the person hostage for.

**Suggested fix**: Either have `AccountProvider`'s step 3b skip when `SyncProvider`'s own sign-in
trigger will fire momentarily after (e.g. by not gating the restoring screen on a duplicate `runSync`
and only holding it on `SyncProvider`'s status instead), or have `SyncProvider`'s sign-in trigger check
whether a sync already completed for this session before firing again.

## Strengths

- The `auth.uid()` trap named in the spec's Consequences is guarded three separate ways in
  `src/data/schema/generators.test.ts`: never unwrapped, never mentioned anywhere, and never a `uuid`
  column — exactly the kind of test that turns a documented risk into something the suite actually
  enforces rather than a comment nobody re-reads.
- `looksLikeLostConnection` (`src/account/network-failure.ts`) consolidating what used to be two
  drifted copies of the same classification, with real platform-specific error text (`ETIMEDOUT`,
  `EAI_AGAIN`, iOS's "The request timed out") rather than guessed vocabulary, is the right fix for a
  real bug class and is well commented on why it existed.
- The sticky-delete and dirty-row-wins rules in `src/data/remote/pull.ts` (`mayApply`) are exercised
  end to end against a real SQLite database and a fake server in `sync.test.ts`, not just asserted in
  isolation — the tests that matter most for "never lose a diary" are the ones actually driven through
  the real push/pull code path.
- `countPendingMeals` vs `countPendingPushes` staying genuinely separate, with the AGENTS.md gotcha and
  the code comments both calling out why one is not redundant with the other, is a good example of a
  subtle product decision staying visible at the point someone could accidentally "simplify" it away.

## Test coverage

The suite (431 tests) is strong on every pure file: `drain-rules.ts`, `session-end.ts`, `routing.ts`,
`error-messages.ts`, `network-failure.ts`, `sync-marker-label.ts`, `database-name.ts`, and the full
`push`/`pull`/`sync` path are all exercised, including the deliberately awkward cases (a replayed push
creating no duplicate, a tombstone beating a late live row, a dirty local row refusing an incoming
overwrite). The `'failed'` branch of `signOutSafely`/`removeUserDatabase` — the exact path behind the
Major finding above — has no test on either side (the pure decision in `drain-rules.ts` doesn't cover
it because it's not a decision, it's an effect failure; and `sign-out.ts` itself is one of the four
files with no test at all, consistent with the stated gap). `session.tsx`, `sync.tsx`, `sign-out.ts`,
`draining.ts`, `use-sign-in-or-up.ts`, and the three React providers remain untested for the reason
already on record (they import Expo/Clerk/React at module level under a Node-only runner) — not a new
finding, but worth naming as the reason the settings.tsx bug above made it through: it lives in a
component none of the 431 tests can reach.

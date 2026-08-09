# 0004. Account and sign in for CalSnap

**Date**: 2026-08-09
**Status**: In Progress

## Summary

CalSnap uses Clerk for accounts rather than Supabase Auth, and the app opens on one combined sign in screen that nobody gets past without an account. You sign in with an email plus a password, or an emailed code, or with Google or Apple. Clerk keeps the session in the phone's secure hardware store, so closing the app does not sign you out. The cost of choosing Clerk is that Supabase's built in `auth.uid()` no longer works, so every `user_id` column becomes text holding the Clerk identifier and every access policy reads it from the token instead. This spec also decides the thing spec 0002 left open: sync runs on sign in, when the app comes to the foreground, and a few seconds after each local write.

## Requirements

**User stories**:

- As someone new to CalSnap, I want to make an account in a few taps so I can start logging food without filling in a form.
- As someone coming back, I want the app to already know me when I open it so I never sign in twice on the same phone.
- As someone who got a new phone, I want my whole diary to be there when I sign in so that changing phone does not cost me my history.
- As someone on a shared phone, I want signing out to genuinely remove my health record from the device so nobody else can read it.
- As someone with no signal, I want to be told plainly what did not save rather than quietly losing a meal.

**Acceptance criteria** (the contract, each independently checkable):

- **AC-1**: A new person enters an email on the combined screen, receives a six digit code, enters it, and lands in the app signed in. No password is required to sign up and no email confirmation step stands between them and the app.
- **AC-2**: A returning person with a password is asked for it on the same screen, and can choose "email me a code instead" to get in without it. The code is a sign in method in its own right, so it is also the answer to a forgotten password: nobody is ever locked out. Changing a password is deliberately not in this release (see Follow-up).
- **AC-3**: Native Google sign in and native Sign in with Apple both complete on a development build and land the person in the app. Sign in with Apple is offered on iOS wherever Google is offered.
- **AC-4**: Closing the app fully and reopening it leaves the person signed in. The splash screen is held until Clerk has answered and the right database file is open, and the app then routes once. A signed in person never sees the sign in screen flash first.
- **AC-5**: While signed out, no screen other than the combined sign in screen is reachable by any route, including a deep link.
- **AC-6**: A signed in person with no `profiles` row, or one whose `onboarded_at` is null, is routed to onboarding rather than to Today, on every device they sign in on. The routing decision is never made from a stale local row: the single `profiles` row is pulled before routing on every sign in, so someone who onboarded on another phone is not sent through onboarding twice.
- **AC-7**: Every row the app writes carries the Clerk user identifier as `user_id`, and Postgres returns zero rows when one account requests another account's data. Every policy tests `(auth.jwt() ->> 'sub') = user_id`, row level security is enabled and forced on every table, and `auth.uid()` appears nowhere in the schema.
- **AC-8**: Signing in opens the SQLite file named for that Clerk identifier. Signing in as a second account on the same phone opens a different file and leaves the first account's file untouched and unreadable from the new session.
- **AC-9**: Signing in on a device that has no local file for that account holds on a restoring screen until the first pull finishes, then opens on Today with the full diary present. A later launch of the same account never shows that screen. On those later launches Today shows a quiet syncing marker until the foreground pull completes, so a number that may still change is never presented as settled.
- **AC-10**: A meal saved on one phone reaches the server within seconds, without the app being closed or reopened. A push also runs on sign in and whenever the app returns to the foreground. Saving one meal with several items produces one push, not one per item.
- **AC-11**: Signing out pushes first. If every row lands, the local database file is removed. If the push cannot complete, the person is told how many **meals** have not reached their account yet (a count of distinct dirty meals, not of dirty rows) and chooses to sign out anyway or to wait.
- **AC-11b**: Choosing to sign out anyway leaves the phone looking and behaving as signed out immediately: the sign in screen is shown and no diary is readable. The account is held in a draining state, retried on each foreground, and the moment the push succeeds the file is removed and the Clerk session ends. If it has not drained within seven days, the file is removed anyway. A borrowed or shared phone never keeps a health record indefinitely because nobody signed in again.
- **AC-12**: A wrong password, an unknown email, a wrong or expired code, and a missing network connection each produce a specific message a person can act on. No raw provider error string reaches the screen, and no failure is silent.
- **AC-13**: A session that stops being valid while the app is open lets any save already in flight finish into the local file, then returns the person to the sign in screen saying that the session ended and asking them to sign in again. The local file is kept, so nothing unpushed is lost.
- **AC-14**: The Settings tab shows the signed in email address and a sign out row.
- **AC-15**: Every Supabase request carries the Clerk session token. The app never establishes a Supabase anonymous session, and the Supabase anonymous key alone never grants access to any row.
- **AC-16**: Every screen and state this feature adds is built only from `@/design-system/components`, meets the contrast floor in `docs/design/design.md`, respects the system font size setting, and carries screen reader labels. The password and code fields are marked so the platform password manager and the code autofill both work.

## Decision

**Chosen option**: Option 2: Clerk for identity, with Supabase third party auth and text user identifiers.

Clerk owns accounts, sessions, and every sign in method. Supabase Postgres stays as the database and keeps enforcing isolation itself, but it validates Clerk issued tokens instead of its own, and every `user_id` column becomes `text` holding the Clerk identifier.

**Implementation skills**: `clerk-expo` (`clerk/skills`, `.agents/skills/clerk-expo/`) · `clerk-setup` (`clerk/skills`, `.agents/skills/clerk-setup/`) · `clerk-custom-ui` (`clerk/skills`, `.agents/skills/clerk-custom-ui/`) · `clerk-webhooks` (`clerk/skills`, `.agents/skills/clerk-webhooks/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `expo-dev-client` (`expo/skills`, `.agents/skills/expo-dev-client/`)

## Rationale

Reasoning, the options weighed, and the references: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**

No new table is created by this feature. Sessions live in Clerk and in the phone's secure store, never in either database. What changes is the identity column on the six tables spec 0002 already declared.

| Element | Before (spec 0002, applied) | After |
|---|---|---|
| `userId` column, all six tables | `uuid`, `references auth.users(id) on delete cascade` | `text`, no foreign key |
| `profiles` primary key | `user_id uuid` referencing `auth.users` | `user_id text` |
| Row level security policy | `using (user_id = (select auth.uid()))` | `using (user_id = (auth.jwt() ->> 'sub'))` |
| `user_id` index on every table | unchanged | unchanged, still required, every policy tests it |
| SQLite side | `uuid` renders as `TEXT` | unchanged, a Clerk identifier fits with no migration |
| Day scoped identifiers (UUID version 5 over namespace, `user_id`, `on_date`) | unchanged | unchanged, version 5 hashes a string and a Clerk identifier is a string |

Both databases are regenerated from the single declaration in `src/data/schema/`, so this is four small edits and a regeneration, not hand written SQL. `CORE_DATA_MODEL_FINGERPRINT` is reset deliberately in the same change, with a comment recording why: no phone has ever run migration 2 and the live tables hold zero rows, so there is nothing to migrate and an `alter column type` migration would exist only to undo a decision no user ever met. This is the one sanctioned exception to the rule in `src/data/AGENTS.md`, and it closes the moment real data exists.

The email address is held by Clerk and is deliberately not copied into `profiles`. There is one source of truth for it, and health rows carry no contact detail.

**State transitions**

The session is the state machine this feature owns:

```
unknown ---(Clerk loaded, no session)--------> signed out
unknown ---(Clerk loaded, session found)-----> restoring ---> signed in
signed out ---(sign in or sign up completes)-> restoring ---> signed in
signed in ---(sign out, push succeeded)------> signed out    (file removed)
signed in ---(sign out, push failed, allowed)-> draining     (looks signed out)
signed in ---(session revoked or expired)----> signed out    (file kept, reason shown)

draining ---(foreground, push succeeds)------> signed out    (file removed, Clerk session ended)
draining ---(seven days elapsed)-------------> signed out    (file removed regardless)
draining ---(same account signs in again)----> restoring     (file adopted, drains normally)
```

`unknown` is the only state the splash screen covers. `restoring` renders a screen only when the local file is new for this account, which is the fresh device case; otherwise it passes through in one frame.

`draining` is a signed out state as far as the person is concerned: the sign in screen is showing, no diary is readable, and no screen reads from the file. The Clerk session is retained for one purpose only, pushing the remaining rows, and it ends the moment that succeeds. Seven days is a hard ceiling, after which the file is removed even with rows unpushed, because a health record sitting on a phone nobody signs into again is the worse outcome. The draining account's identifier and its deadline are the only thing kept outside the file, in the app's own small settings store.

Onboarding is a separate gate that sits after `signed in`: no `profiles` row, or `onboarded_at` null, routes to onboarding. That check runs against a freshly pulled `profiles` row, never a stale local one. The onboarding screens themselves are scope feature 6; this spec owns only the routing.

**Startup is a sequence, not a race.** The splash gate is easy to misread as three conditions settling in parallel, and implementing it that way opens the wrong file or no file at all, silently. The real order is strict, because each step needs the one before it:

```
1. fonts load                     (independent, may run alongside)
2. Clerk loads and answers        -> gives the user id, or "signed out"
3. openSessionDatabase(userId)    -> needs step 2's user id
4. pull the profiles row          -> needs steps 2 and 3
5. splash lifts, route once
```

Only step 1 may run alongside the rest. Steps 2 to 4 are sequential and each depends on its predecessor.

**API surface**

There are still no HTTP endpoints in the app. The surface is functions, matching spec 0002's shape. Clerk's own network calls are made by `@clerk/expo` and are not restated here.

| Function | Shape | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `useSignInOrUp` | screen hook over Clerk | `email` (required), then `password` or `code` | the active session | none, this is the door | unknown email, wrong password, wrong or expired code, network down |
| `signInWithGoogle` | native Clerk flow | none | the active session | none | cancelled by the person, no Play services, network down |
| `signInWithApple` | native Clerk flow | none | the active session | none | cancelled by the person, network down |
| `getSupabaseClient` | client factory | none | a Supabase client whose `accessToken` returns the Clerk token | Clerk session | no session, token fetch failed |
| `openSessionDatabase` | local effect | `userId` (required) | the open database, and whether it was newly created | Clerk session | invalid identifier shape, file cannot be opened |
| `runSync` | push then pull | `reason` (required: `sign-in`, `foreground`, `after-write`, `sign-out`) | rows pushed, rows pulled | Clerk session | network down, token expired, conflict resolved by newest write |
| `countPendingMeals` | local read | none | distinct dirty meals, the number a person is shown | Clerk session | none expected |
| `signOutSafely` | push then remove then sign out | `force` (optional) | `removed`, or `draining` with the meal count and deadline | Clerk session | network down, which surfaces as `draining` rather than an error |
| `resumeDraining` | foreground effect | none | `removed`, `still-draining`, or `expired` | the retained draining token | network down, which leaves it `still-draining` |

`runSync` wraps `pushChanges` and `pullChanges`, which spec 0002 already defines in full. This spec adds only when they run and what happens around them.

**Value sourcing**

| Action | Value produced or displayed | Source |
|---|---|---|
| every write | `user_id` | the Clerk session's `sub` claim, read through `useAuth().userId`, never typed or derived on the device |
| every Supabase request | the bearer token | Clerk's `getToken()`, passed as the `accessToken` callback on the Supabase client, refreshed by Clerk, never cached by app code |
| every Postgres policy | the acting identity | `auth.jwt() ->> 'sub'`, read by Postgres from the verified Clerk token, never sent as a query parameter |
| `openSessionDatabase` | the file name | `calsnap-<clerk user id>.db`, from `databaseNameForUser`, with the identifier check widened from the UUID pattern to `/^user_[A-Za-z0-9]{20,32}$/`. Anything else is rejected before it can reach a file path or `deleteDatabaseAsync` |
| startup routing | whether this person is signed in | Clerk's cached token, read before the splash lifts, never a value stored by the app |
| startup routing | whether to show onboarding | the `profiles` row pulled from the server during startup step 4, not the local copy. Absent, or present with `onboarded_at` null, means not onboarded. If that pull fails (no network) the local row is used and the person is told the app is offline, so a network failure never forces someone through onboarding again |
| `restoring` screen | whether to show it at all | whether `openSessionDatabase` reported the file as newly created for this account |
| Today | whether to show the syncing marker | whether the foreground `runSync` for this launch has finished. It clears on completion, and on failure becomes a quiet offline marker rather than disappearing |
| `runSync` | where a pull resumes from | `sync_state.last_pulled_at` for that table. **A table with no `sync_state` row pulls from the beginning of time**, which is the fresh device case and the only way AC-9 can hold. Spec 0002 made `since` required but never named this default |
| `runSync` | when an after write push fires | a fixed three second debounce after the last local write, so one saved meal is one push |
| Settings | the email shown | Clerk's `useUser().user.primaryEmailAddress`, not a column in `profiles` |
| sign out | the count shown to the person | a count of **distinct dirty meals**: `select count(distinct id) from meals where is_dirty = 1`, plus meals reachable from dirty `meal_items`. Deliberately not `countPendingPushes`, which sums dirty rows across all six tables and would report 6 for one meal with four items and a scan |
| sign out | whether the file may be removed | `countPendingPushes` (all six tables), which stays the correct gate. The two counts differ on purpose: one is what a person is told, the other is what the code checks |
| `draining` | the deadline | seven days from the moment sign out was forced, stored beside the draining account identifier outside the database file |
| every error on screen | the message text | a mapping in app code from Clerk's error code to a written sentence, covering unknown email, wrong password, wrong code, expired code, cancelled social sign in, no network, and **session ended**. A provider string is never rendered directly |

**Key invariants**

- No screen other than the combined sign in screen renders while signed out.
- `user_id` on every row written on this device equals the current Clerk session's `sub`. There is no path that writes a row for another identity.
- The Supabase client never exists without a token source attached. There is no anonymous client anywhere in the app.
- The splash screen lifts only once fonts have loaded and steps 2 to 4 of the startup sequence have completed in order, so routing happens exactly once per launch and always against a fresh `profiles` row.
- A local database file is removed only after `countPendingPushes` returns zero, or after the draining deadline has passed.
- No local database file outlives its account by more than seven days, in any state, by any path.
- A session ending never deletes local data. Only a successful push, or the draining deadline, does.
- While an account is draining, no screen reads from its file and its data is not reachable. The retained Clerk token is used for pushing and for nothing else.
- One local file per Clerk identifier, always. Signing in never opens, reads, or removes a file belonging to a different identifier.

**Security model**

Isolation stays where spec 0002 put it: in Postgres, not in app code. Clerk's session token carries a `role` claim of `authenticated` so Supabase applies the same policies as before, and each policy compares `user_id` against the `sub` claim of the verified token. The device cannot forge this: Supabase verifies the token's signature against Clerk's published keys, so a client that lies about its identity is rejected before any policy runs.

On the phone, isolation stays physical: one SQLite file per account, named for the Clerk identifier.

The session token itself is held by `tokenCache` from `@clerk/expo/token-cache`, which stores it in the iOS Keychain and in Android storage encrypted by the Keystore. App code never touches the raw token and never writes it to `AsyncStorage` or to any file.

Compliance scope is unchanged from spec 0002: consumer wellness, not regulated medical data. Two things this feature must hold to. No health value and no session token ever appears in a log line. And explicit consent still has to be recorded before health details are collected, which is feature 6's job and is not weakened by moving identity to Clerk.

The one real security regression is deletion. With Supabase Auth, deleting the auth user cascaded every row away. Clerk has no such reach into your database, so nothing is deleted automatically. Until the Clerk webhook is built (feature 10), deleting a person in the Clerk dashboard leaves their diary in Postgres. This is written into Follow-up rather than left to be discovered.

**Configuration required**

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: the Clerk instance this build talks to. Safe to ship, it is a public identifier.
- `EXPO_PUBLIC_SUPABASE_URL`: the project endpoint, already reserved in `.env.example`.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the anonymous key, already reserved. Safe to ship: with Clerk it grants nothing on its own, because every policy now requires a valid Clerk token.

All three are validated by `src/config/env.ts` at startup and fail loudly, per the project rule.

**Prerequisites** (dashboard work, before any code runs):

- Clerk: enable the Native API (Dashboard, Native applications). `@clerk/expo` cannot work without it.
- Clerk: enable email address as the identifier, with both password and email code strategies.
- Clerk: configure the Google and Apple providers, including the Apple service identifier and key.
- Clerk: add `"role": "authenticated"` as a custom claim on the session token. Without it Supabase treats the request as unauthenticated and every policy denies.
- Supabase: register Clerk as a third party auth provider, giving it the Clerk domain.

**Critical test scenarios**

- Happy path: a brand new email receives a code, enters it, and lands on onboarding with a signed in session, verifies **AC-1**, **AC-6**.
- Happy path: force quitting and reopening lands straight on Today with no sign in screen shown at any point, verifies **AC-4**.
- Happy path: a meal saved on device A appears on device B after B comes to the foreground, verifies **AC-10**.
- Restore: signing in on a device with no local file holds the restoring screen, then opens on Today with every past meal present and correct totals, verifies **AC-9**.
- Isolation: account B signs in on a phone where account A is still stored, and no row, total, or streak belonging to A is visible or pushable, verifies **AC-7**, **AC-8**.
- Auth and permission: a Supabase request carrying only the anonymous key, with no Clerk token, returns zero rows from every table, verifies **AC-7**, **AC-15**.
- Failure case: sign out with three unpushed meals (twelve dirty rows between them) and the network off says **three meals**, not twelve rows, verifies **AC-11**.
- Failure case: signing out anyway with the network off shows the sign in screen immediately with no diary reachable, then removes the file on the next foreground once the network returns, without anyone signing in, verifies **AC-11b**.
- Failure case: a phone left draining with no network for seven days removes the file anyway, verifies **AC-11b**.
- Failure case: someone who onboarded on a second phone signs in on a phone holding a pre onboarding local file and lands on Today, not back in onboarding, verifies **AC-6**.
- Failure case: the startup `profiles` pull fails with no network, and the person is let in against their local row with the offline state shown, rather than being sent through onboarding again, verifies **AC-6**.
- Failure case: a revoked session mid save lets the save land locally, then returns to sign in with the reason shown and nothing lost, verifies **AC-13**.
- Failure case: a wrong password, then a wrong code, then airplane mode each produce a distinct written message, verifies **AC-12**.
- Failure case: cancelling the Google sheet returns to the sign in screen intact, with no error shown and no half signed in state, verifies **AC-12**.
- Accessibility: the sign in screen at the largest system font size shows every field and both buttons without clipping, and a screen reader announces each field and every error, verifies **AC-16**.

## Build plan

Ordered by the project's **Skateboard** approach: the first slice is the smallest complete thing a person could actually use, which for this feature is getting in, staying in, and getting out. Sync comes second, hardening third. Each slice is shippable.

**Slice 1: the door works**

1. Change `userId` in `src/data/schema/types.ts` to `text` with no `auth.users` reference, change the policy lines in `to-postgres.ts` to `(auth.jwt() ->> 'sub')`, and update `profiles.ts`'s primary key. Regenerate both databases and reset `CORE_DATA_MODEL_FINGERPRINT` with a comment recording why, satisfies **AC-7**.
2. Apply the regenerated Postgres migration to the live project and confirm row level security is enabled and forced on all six tables with the new policy, satisfies **AC-7**.
3. Install `@clerk/expo` and `@supabase/supabase-js`, add the three variables to `.env.example` and to the schema in `src/config/env.ts`, satisfies **AC-15**.
4. Complete the Clerk and Supabase dashboard prerequisites listed above, including the `role` claim, satisfies **AC-7**, **AC-15**.
5. Mount `ClerkProvider` with `tokenCache` from `@clerk/expo/token-cache` in `src/app/_layout.tsx`, and extend the splash gate to the strict sequence in the design section: fonts alongside, then Clerk, then the file, then the `profiles` pull, then route once. Do not join these as parallel settled flags, satisfies **AC-4**, **AC-6**.
6. Build the combined sign in screen from the design system: wordmark, one line of purpose, email field, continue, a hairline divider, then Google and Apple. Use the current method based hooks (`signIn.password()`, `signIn.emailCode.sendCode()`, `signIn.finalize()`), never the legacy `create` plus `prepareFirstFactor` pattern, satisfies **AC-1**, **AC-2**, **AC-16**.
7. Add the bot protection mount point the sign up path requires. It needs a raw `View` with `nativeID="clerk-captcha"`, which `eslint.config.js` forbids inside `src/app/**`, so expose it as a small design system component rather than weakening the rule, satisfies **AC-1**.
8. Wire native Google and Apple through `useSignInWithGoogle` and `useSignInWithApple`, and confirm both on a development build, satisfies **AC-3**.
9. Route by session: signed out reaches only the sign in screen, signed in with no profile or a null `onboarded_at` reaches onboarding, otherwise Today. Route from the pulled `profiles` row, falling back to the local one with the offline state shown when that pull fails, satisfies **AC-5**, **AC-6**.
10. Widen the identifier check in `databaseNameForUser` to `/^user_[A-Za-z0-9]{20,32}$/`, and open the per user file on sign in, satisfies **AC-8**.
11. Add `countPendingMeals` beside the existing `countPendingPushes`, counting distinct dirty meals for the sentence a person reads while `countPendingPushes` stays the gate on removing the file, satisfies **AC-11**.
12. Add the sign out row and the signed in email to the Settings tab, calling `signOutSafely`, satisfies **AC-11**, **AC-14**.

**Slice 2: the data follows you**

13. Build `getSupabaseClient`, passing Clerk's `getToken` as the `accessToken` callback so every request carries the session token and no anonymous client exists, satisfies **AC-15**.
14. Build `runSync` over spec 0002's `pushChanges` and `pullChanges`, taking a reason and safe to call repeatedly. Make a missing `sync_state` row for a table mean pull from the beginning of time, and cover it with a test, satisfies **AC-9**, **AC-10**.
15. Trigger it on sign in, on foreground, and three seconds after the last local write, satisfies **AC-10**.
16. Add the restoring screen shown only when the local file is newly created for this account, holding until the first pull completes, satisfies **AC-9**.
17. Add the syncing marker on Today, clearing when the foreground pull finishes and becoming an offline marker when it fails, satisfies **AC-9**.
18. Complete `signOutSafely`: push, then remove the file, or report the meal count and offer to sign out anyway, satisfies **AC-11**.
19. Build the draining state: keep the account identifier and a seven day deadline outside the file, show the sign in screen immediately, retry on each foreground through `resumeDraining`, remove the file on success or at the deadline, and re adopt it if that account signs in again, satisfies **AC-11b**.

**Slice 3: it holds up**

20. Map every Clerk error code to a written sentence and render those, never a provider string. Cover unknown email, wrong password, wrong and expired code, cancelled social sign in, no network, and session ended, satisfies **AC-12**, **AC-13**.
21. Handle a session ending mid use: let the in flight save land locally, keep the file, return to sign in with the reason stated, satisfies **AC-13**.
22. Run the accessibility sweep over every new screen and state: contrast, font scaling, screen reader labels, and the password and code autofill hints, satisfies **AC-16**.
23. Amend spec 0001's Auth row and spec 0002's security model, AC-2, and AC-10 to match this decision, and record the Clerk conventions in a new `src/account/AGENTS.md`, satisfies **AC-7**.

## Consequences

**Positive**

- The Expo experience is genuinely better than the alternative. Native Google and Apple flows, a maintained token cache backed by the Keychain and the Keystore, and refresh handled for you are all things you would otherwise have written and got subtly wrong.
- Sign in methods become dashboard configuration rather than code. Adding passkeys later, which you considered and deferred, is a toggle plus a small screen change.
- Isolation did not move. Postgres still refuses to hand one person another person's diary, which was the property spec 0002 cared most about.
- The change costs almost nothing today. Zero rows live, nothing on any phone, and one schema declaration to edit. The same change in six months means migrating real diaries.
- Spec 0002's sync design finally has a trigger, which unblocks the half of feature 3 that was waiting on this feature.

**Negative and tradeoffs**

- You now depend on two vendors where you depended on one, and they must agree about who you are. A Clerk outage signs nobody out, because the cached token stays valid until it expires, but it does block new sign ins.
- **Deleting an account no longer happens by itself.** The `auth.users` cascade is gone. Until feature 10 builds the Clerk webhook, deleting a person in Clerk leaves their diary in Postgres, which is a real gap in a health app and is the single most important thing on the Follow-up list.
- `auth.uid()` is now a trap. Any future policy written from a Supabase example will silently match nothing rather than fail loudly, which is the worst kind of security bug. Nothing in the codebase catches this yet.
- Clerk is free to ten thousand monthly active users and paid after that, and Supabase bills third party auth users too. Two meters where there was one.
- Resetting the migration fingerprint deliberately weakens a guard that exists for good reason. It is defensible exactly once, on the facts recorded here, and the comment in the code must say so.
- Specs 0001 and 0002 are now partly wrong until task 20 amends them, and 0002 is already marked `In Progress` with 238 passing tests, several of which assert `auth.uid()` and will fail until updated.

**Neutral**

- SQLite is untouched. `uuid` already rendered as `TEXT`, so the phone side needed nothing.
- Day scoped UUID version 5 identifiers keep working, because version 5 hashes a string and a Clerk identifier is one.
- The email address lives only in Clerk. Any future feature wanting it reads it from Clerk rather than from `profiles`.
- Native Google and Apple mean this feature can never be tested in Expo Go, only on a development build. You already have one.
- The draining state is real machinery: a small store outside the database, a foreground effect, and a deadline. It exists because the shared phone case is the reason sign out removes the file at all, and letting "sign out anyway" quietly defeat that would have made the guarantee untrue.
- Two different counts of unpushed work now exist on purpose. `countPendingMeals` is what a person reads, `countPendingPushes` is what the code gates on. Anyone changing one should read this line before assuming the other is redundant.

## Follow-up

- [ ] Build the Clerk `user.deleted` webhook into a Supabase edge function that removes every row for that `sub` plus the storage prefix, and make it idempotent. This is scope feature 10 and it closes the deletion gap this decision opens. It is the highest priority item here.
- [ ] Add a lint or test guard that fails if `auth.uid()` ever reappears in a generated policy, so the trap named in Consequences cannot be walked into.
- [ ] Amend spec 0001's Auth row (it currently records Supabase Auth) and spec 0002's security model, AC-2, and AC-10. Build plan task 20 does this, listed here so it is not lost if the task slips.
- [ ] The Clerk skills are installed in `.agents/skills/` but are not listed in root `AGENTS.md`'s Agent skills section. Their conventions are area specific, so they belong in a new `src/account/AGENTS.md` with a one line pointer from root, not in root itself.
- [ ] Decide what happens to an account that signs up and never onboards. Clerk will hold a user with no profile row and no diary forever, which is harmless but untidy, and worth a rule before it is thousands of rows.
- [ ] There is no way to change a password inside the app. This is deliberate for release 1, because an emailed code means nobody is ever locked out, but it is an omission a person will eventually notice. It belongs with a proper account settings screen rather than being bolted onto sign in.
- [ ] Seven days is a judgement, not a derived number. It is long enough to cover a holiday with no signal and short enough that a borrowed phone does not keep a health record. Revisit it if real usage shows drains failing for longer.
- [ ] Passkeys were considered and deferred. Revisit once the base flows are proven, since Clerk supports them and they suit a phone first health app well.

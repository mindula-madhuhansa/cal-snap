# Verify: account and sign in · spec 0004 · updated 10 August 2026

_Steps derived from spec 0004's acceptance criteria and its value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

**The dashboard prerequisites are done as of 10 August 2026**, which unblocks every sync step below:

- Supabase has Clerk registered as a third party auth provider, domain `https://superb-albacore-29.clerk.accounts.dev`, showing `ENABLED`.
- Clerk's `__session` token template carries `{"role": "authenticated"}`, with the Supabase managed integration attached.
- Confirmed independently: that Clerk domain serves an RS256 signing key at `/.well-known/jwks.json` and an OIDC issuer matching itself, which is what Supabase verifies an incoming token's signature against.

The three environment variables and the Postgres identity change were already live.

## UI / manual

### The door (slice 1, confirmed by hand on 9 August 2026)

- [ ] Fresh install, enter a new email, receive the six digit code, enter it → lands in the app signed in, with no password step and no email confirmation screen → AC-1
- [ ] Sign in with a password, then choose "Email me a code instead" → the code alone gets you in → AC-2
- [ ] Force quit and reopen → lands straight on Today, and the sign in screen never flashes past → AC-4
- [ ] While signed out, try a deep link to `/(tabs)` → the sign in screen is what renders → AC-5
- [ ] Sign in as someone who onboarded on another phone, on a phone holding a pre onboarding local file → lands on Today, not back in onboarding → AC-6
- [ ] Settings shows the signed in email address and a sign out row → AC-14

### The data following you (slice 2, built 10 August 2026, not yet run on a phone)

- [ ] Save a meal on phone A, wait about five seconds without closing the app, then bring phone B to the foreground → the meal is on B → AC-10
- [ ] Save one meal with four items and watch the requests → one push for `meals` and one for `meal_items`, not one per item → AC-10
- [ ] Sign in on a phone with no local file for that account → the restoring screen holds until the first pull finishes, then Today opens with the whole diary present → AC-9
- [ ] Launch the same account again on that phone → no restoring screen, and Today shows the quiet syncing marker until the foreground pull finishes → AC-9
- [ ] Turn the network off, then bring the app to the foreground → the marker becomes "Offline · saved on this phone" rather than disappearing → AC-9
- [ ] Delete a meal on phone A, sync both → it is gone on phone B, and it does not come back after two more foreground cycles → AC-5 (spec 0002)
- [ ] Sign out with three unpushed meals (twelve dirty rows between them) and the network off → the sentence says **three meals**, not twelve rows → AC-11
- [ ] Choose "Sign out anyway" → the sign in screen shows immediately, no diary is readable, and the draining notice is on screen → AC-11b
- [ ] With that account draining, turn the network on and bring the app to the foreground → the file is removed, the notice goes, and the Clerk session ends without anyone signing in → AC-11b
- [ ] With that account draining, press "Sign back in to finish" → the file is adopted, the diary opens, and the owed meals push normally → AC-11b
- [ ] Sign out with everything already pushed → the local file is gone from the device → AC-11

### It holds up (slice 3, built 10 August 2026, not yet run on a phone)

**A session ending mid use.** Revoke the session from the Clerk dashboard (Sessions, revoke) while the app is open on Today. That is the honest way to produce this; waiting for a token to expire takes too long to test.

- [ ] Save a meal, then revoke the session, then bring the app to the foreground → the save is in the local diary, and the app returns to the sign in screen → AC-13
- [ ] On that sign in screen → the notice reads "You were signed out. Your meals are safe on this phone. Please sign in again.", never a provider string and never a bare redirect → AC-12, AC-13
- [ ] Sign in again as the same person → the meal saved just before the session ended is still in the diary and pushes to the account → AC-13
- [ ] Press "Dismiss" on that notice → it goes, the sign in form still works, and it does not come back on the next render → AC-13
- [ ] The counter case: turn the network off and foreground the app several times → you are **not** signed out, the marker says offline, and the diary stays open. Only a refused token ends a session → AC-13

**Every failure written out.** Each of these produces its own sentence; run them in one sitting and confirm no two are the same and none is a provider string.

- [ ] An email with no account → is taken to sign up rather than refused → AC-1, AC-12
- [ ] A wrong password → says so and points at "Email me a code instead" → AC-12
- [ ] A wrong code → says so and offers a new one → AC-12
- [ ] A code left until it expires → says it expired, not that it was wrong → AC-12
- [ ] Airplane mode, then press Continue → says CalSnap could not reach the internet → AC-12
- [ ] Sign up on an instance whose password attribute is set to required → says the account could not be finished and that this is not the person's fault, never "something went wrong" → AC-12

**The accessibility sweep.** Run with VoiceOver on iOS and TalkBack on Android; the announcement behaviour genuinely differs and one platform passing does not prove the other.

- [ ] The sign in screen at the largest system font size shows every field and every button without clipping (the screen scrolls, so check by scrolling to the end) → AC-16
- [ ] With a screen reader on, press Continue with a wrong code → the new error sentence is announced without having to hunt for it → AC-16
- [ ] Swipe through the sign in screen → each field is announced with its label and "required", and an error is spoken as part of the field it belongs to → AC-16
- [ ] Press "Sign out" with meals still unpushed → the meal count sentence is announced, not just drawn → AC-11, AC-16
- [ ] The session ended notice and the draining notice each read as one sentence, and their buttons are still reachable by swiping → AC-13, AC-16
- [ ] The syncing and offline markers are announced as full sentences, with no "middle dot" spoken → AC-9, AC-16
- [ ] Tap the password field → the platform password manager offers to fill it. Tap the code field with a code in the inbox → the one time code is offered above the keyboard → AC-16
- [ ] Every button on these screens measures at least 44 points → AC-16

## Value sourcing (one step per row, so a mis sourced value is caught)

- [ ] Every row written on the device carries `user_id` equal to the Clerk `sub` → read a saved row and compare it with the identifier in Settings → AC-7
- [x] A Supabase request carrying only the publishable key, with no Clerk token, returns zero rows from every table → AC-7, AC-15 · **proven on 10 August 2026** against the live project. Run with a real row present, not against empty tables, which is the version of this check that actually proves something: a `meals` row was inserted through the service role, then `GET /rest/v1/meals?select=*` with only `apikey: sb_publishable_...` returned `[]` at HTTP 200 (zero rows, not an error, exactly as AC-7 words it), and so did the same request filtered to that exact `user_id`. A `POST` with the same key was refused with `42501 new row violates row-level security policy`, and a forged bearer token with `PGRST301`. The probe row was deleted and all six tables are back to zero
- [ ] The local file is named `calsnap-<clerk user id>.db`, and signing in as a second account on the same phone opens a different file and leaves the first untouched → AC-8
- [ ] A table with no `sync_state` row pulls from the beginning of time → covered by a test, and visible on a fresh device as the full diary arriving → AC-9
- [ ] The pull watermark advances after a pull → a second pull with nothing changed transfers nothing → AC-9
- [ ] `updated_at` on a pushed row is the value the server returned, not the device's → covered by a test; on a phone, set the clock an hour fast and confirm the stored value is not the fast one → AC-14 (spec 0002)
- [ ] The after write push fires three seconds after the **last** write, so several saves in a row make one push → AC-10
- [ ] The email in Settings comes from Clerk, not from `profiles` → change it in the Clerk dashboard and reopen Settings → AC-14
- [ ] The count shown at sign out is distinct dirty meals, while the gate on removing the file is dirty rows across all six tables → AC-11
- [ ] The draining deadline is seven days from the forced sign out → AC-11b
- [ ] Every failure on screen is a written sentence, never a provider string → AC-12

## Commands

- [x] `npm test` → 431 passing across 36 files on 10 August 2026, after `/test` and `/debug` (was 383). One caveat worth knowing: a single run immediately after a bulk `prettier --write` collapsed with all 36 files failing to import and zero tests collected. Five consecutive runs since have been green and it has not reproduced, so it looks like a Vite transform cache race on Windows rather than a code fault. If you ever see it, rerun before believing it
- [x] `npm run typecheck` → clean across all three projects · clean
- [x] `npm run lint` → clean · clean
- [x] `npm run format` → clean · clean
- [x] `npx expo export --platform ios` → the bundle builds, so every import resolves including `@clerk/expo`, `@clerk/expo/token-cache`, `@supabase/supabase-js`, and `expo-secure-store` · one 6.5MB bundle, no unresolved module. Not a substitute for running the app, but it rules out a broken module graph before you build to a phone

## Transport classification, driven for real (10 August 2026)

Not hand written strings: a real Supabase client wrapped in the real `createSupabaseTransport`, pointed at a host that does not resolve and then at the live project with no Clerk token. Both went through the whole module.

- [x] A real DNS failure → `{"kind":"failed","reason":"offline","message":"Your meals are saved on this phone and will reach your account when you are online."}` → AC-12 · this is the case `/debug` fixed the same day; before the fix the identical failure came back `rejected`
- [x] The live project, publishable key only, no Clerk token, on an upsert → `{"kind":"failed","reason":"session-ended","message":"You were signed out. Your meals are safe on this phone. Please sign in again."}` → AC-13, AC-15 · the `42501` path proven end to end through the real module against the real database, and the refused write left the tables at zero rows

## Acceptance-criteria coverage

- AC-1, AC-2, AC-4, AC-5, AC-6, AC-14 · covered by the door steps, confirmed by hand on 9 August 2026
- AC-3 · withdrawn on 9 August 2026, nothing to verify
- AC-7 · **the isolation half is proven** on the live database (schema, policies, and a real unauthenticated request against a table holding a row). The on device half, that every row this app writes carries the Clerk `sub`, still needs the phone
- AC-15 · **the negative half is proven**: the publishable key alone reads nothing, writes nothing, and a forged token is rejected. The positive half, that every request the app sends carries the Clerk token, needs the app running
- AC-8 · needs the phone
- AC-9, AC-10, AC-11, AC-11b · covered by the sync steps, built and gate green, not yet run on a phone
- AC-12, AC-13, AC-16 · covered by the slice 3 steps, built and gate green, not yet run on a phone. The screen reader half needs both platforms, and the session ending step needs the Clerk dashboard open beside the phone

## Known gaps at the time of writing

- ~~Specs 0001 and 0002 still describe Supabase Auth and `auth.uid()`, and the Clerk conventions still owe a `src/account/AGENTS.md`.~~ Both closed on 10 August 2026, by `/architect` and `/sync` respectively.
- **Everything that needs a phone is still unverified.** This app cannot run in Expo Go, so every screen, every failure message, the whole sync path, and the accessibility sweep need a development build on a real device. The `/check verify` run on 10 August proved the database, the trust wiring, and the gate, and could not exercise a single screen. Treat the unticked boxes above as genuinely unknown rather than probably fine.
- One thing worth knowing before the phone pass: the live server returns `42501` for a refused row and `PGRST301` for a bad token, which are exactly the two codes `src/account/supabase-transport.ts` maps to `session-ended`. That mapping is therefore checked against real server behaviour, not guessed. It also means a missing `role: authenticated` claim would sign a person out rather than look like a network error, so if sign in starts bouncing people back to the door, suspect the token template first.
- Postgres does not stamp `updated_at` on receipt and does not keep a tombstone against a live incoming row. Both are spec 0002 rules with no trigger behind them, so the pushing device currently wins a conflict. The sticky delete rule **is** enforced on the pulling device, so a delete is not undone locally; it is the server copy that can be revived by another phone's late push. Adding the trigger changes the generated Postgres migration that has already been applied, so it is a decision: `/architect account & sync arbitration`.

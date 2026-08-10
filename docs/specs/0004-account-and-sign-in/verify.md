# Verify: account and sign in · spec 0004 · updated 10 August 2026

_Steps derived from spec 0004's acceptance criteria and its value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

Two things are owed before the sync steps below can pass on a phone, and both are dashboard work rather than code:

- Clerk registered with Supabase as a third party auth provider, with `role: authenticated` on the session token. Without it every Supabase request is refused and the marker sits on "Offline".
- Nothing else. The three environment variables and the Postgres identity change are already live.

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

### Accessibility (slice 3, not built yet)

- [ ] The sign in screen at the largest system font size shows every field and both buttons without clipping, and a screen reader announces each field and every error → AC-16
- [ ] The syncing and offline markers are announced by a screen reader → AC-9, AC-16

## Value sourcing (one step per row, so a mis sourced value is caught)

- [ ] Every row written on the device carries `user_id` equal to the Clerk `sub` → read a saved row and compare it with the identifier in Settings → AC-7
- [ ] A Supabase request carrying only the publishable key, with no Clerk token, returns zero rows from every table → AC-7, AC-15
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

- [ ] `npm test` → 372 passing, including the sync rules and the two migration fingerprints
- [ ] `npm run typecheck` → clean across all three projects
- [ ] `npm run lint` → clean
- [ ] `npm run format` → clean

## Acceptance-criteria coverage

- AC-1, AC-2, AC-4, AC-5, AC-6, AC-14 · covered by the door steps, confirmed by hand on 9 August 2026
- AC-3 · withdrawn on 9 August 2026, nothing to verify
- AC-7, AC-8, AC-15 · covered by the value sourcing steps, and the isolation step is the one that matters most
- AC-9, AC-10, AC-11, AC-11b · covered by the sync steps, built and gate green, not yet run on a phone
- AC-12, AC-13, AC-16 · slice 3, not built yet

## Known gaps at the time of writing

- Postgres does not stamp `updated_at` on receipt and does not keep a tombstone against a live incoming row. Both are spec 0002 rules with no trigger behind them, so the pushing device currently wins a conflict. The sticky delete rule **is** enforced on the pulling device, so a delete is not undone locally; it is the server copy that can be revived by another phone's late push. Adding the trigger changes the generated Postgres migration that has already been applied, so it is a decision: `/architect account & sync arbitration`.

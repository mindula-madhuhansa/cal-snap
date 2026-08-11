# Verify: onboarding and the daily calorie target · spec 0006 · updated 2026-08-10

_Steps derived from spec 0006's acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

Most of this needs a development build on a real phone. Three things cannot be checked any other way and are called out where they appear: a screen reader pass, a second device on one account, and a phone whose region is set to the United States.

## Commands

- [x] `npm test` → 560 passing, 45 files, nothing skipped (555 was this file's estimate before the two device bug fixes added regression tests; 560 is correct) → AC-7, AC-8, AC-10, AC-10b, AC-11, AC-13, AC-14, AC-16
- [x] `npm run typecheck` and `npm run lint` → both clean → AC-16
- [x] `npm run gen:supabase-migration`, then `git diff supabase/migrations/` → empty → AC-14
- [x] In the live database, `select relrowsecurity, relforcerowsecurity from pg_class where oid = 'public.target_overrides'::regclass` → both true → AC-13
- [x] `select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.target_overrides'::regclass` → reads `auth.jwt() ->> 'sub'`, never `auth.uid()` → AC-13
- [x] `select to_regclass('public.onboarding_draft')` → null → AC-13
- [x] No unique index on `(user_id, effective_from)` → confirmed (only `target_overrides_user_effective_from_idx`, non unique; the query above also counts the primary key's own index, which every table has and isn't the hazard, so it read 1 rather than 0. Fixed here to name the index directly) → AC-10b

## UI / manual

### Getting in and out of setup

- [ ] Sign in as a brand new account → expect the consent screen, not Today → AC-1
- [ ] Press **Start using CalSnap** on the result screen → expect to land on Today within a moment, not to sit on "Saving your daily target". Both device bugs of 10 August 2026 ended here: first the write threw, then the write succeeded but nothing navigated → AC-1, AC-6
- [ ] Press **Start using CalSnap**, and if it ever fails, press it again → expect the second press to succeed. Finishing setup has to survive a retry → AC-6
- [ ] Finish setup, force quit, reopen → expect Today, never setup again → AC-1
- [ ] **Second device.** Sign in on a second development build with the same account, having finished setup on the first → expect Today directly, with the target and answers already there and setup never shown → AC-1, AC-13
- [ ] Sign out midway through setup, sign back in → expect the first question again, with no earlier answers. The draft goes with the per account database file → AC-17

### The questions

- [ ] Walk the flow → expect exactly consent, sex, age, height, weight, activity, goal direction, goal pace, then the result. Nothing else is asked → AC-2
- [ ] On each screen → expect a visible "N of 8" and a working Back, except on consent where Back is absent → AC-2
- [ ] Answer without hesitating, timed → expect under a minute → AC-2
- [ ] Try to get past consent without agreeing → expect no way through → AC-3
- [ ] Agree, finish setup, then read the `profiles` row → `consented_at` set and `consent_version` = `v1-placeholder` → AC-3
- [ ] Go back two questions, change an answer, come forward → expect the changed answer kept and nothing after it blanked → AC-2, AC-5
- [ ] Force quit on the height question, reopen → expect the height question, with consent, sex and age intact → AC-5

### Units (Value sourcing: the locale default)

- [ ] **Set the phone's region to the United Kingdom or United States**, then start setup → expect height and weight to open in feet/inches and pounds → AC-4
- [ ] Set the region to anywhere else (Sri Lanka, France, Australia) → expect centimetres and kilograms → AC-4
- [ ] Switch units inline on the height field, type a value, finish setup → read `profiles.height_cm` and `weight_entries.weight_kg` → **centimetres and kilograms whatever was typed**, and `unit_preference` records what was used → AC-4

### The number (Value sourcing: the formula, the floor, the pace)

- [ ] Answer 35, female, 165 cm, 70 kg, moderate, losing 0.5 kg a week → expect **exactly 1613** on the result screen → AC-7
- [ ] Read the stored `daily_targets` row for today → same number, `source` = `computed`, `formula_version` = `mifflin-st-jeor-v1`. The number shown is the number stored → AC-7
- [ ] Answer 30, female, 160 cm, 55 kg, mostly sitting, losing 1 kg a week → expect **exactly 1200**, plus a sentence saying the target was raised to keep it safe and naming about **0.26 kg a week** rather than the pace picked → AC-8
- [ ] Same answers as male → expect exactly 1500 → AC-8
- [ ] Read the result sentence → one plain sentence naming the goal, the number marked as an estimate, and an expandable detail naming Mifflin-St Jeor and saying it may need adjusting → AC-9
- [ ] Answer at each bound: age 13, age 120, pace 0 → all accepted and calculated, nothing blocks, warns, or lectures → AC-16
- [ ] Try to reach age 12 or 121 on the stepper → the control stops first, so a database check constraint is never what a person meets → AC-16

### Changing the number (Value sourcing: the override, "starts tomorrow")

- [ ] Settings → expect "Your goal" showing today's target and whether it is worked out or set by hand → AC-12
- [ ] Set your own target → expect a sentence naming tomorrow's date and saying today stays as it is; today's number on Settings is **unchanged** → AC-11, AC-12
- [ ] Read tomorrow's `daily_targets` row after tomorrow arrives (or set the phone's clock forward) → `source` = `manual`, `formula_version` = `manual-v1`, and the number you set → AC-10
- [ ] Clear it → expect a sentence saying later days go back to the worked out number, and today still unchanged → AC-10, AC-11
- [ ] Change activity level from Settings → expect the same "starts tomorrow" sentence, and today's target untouched → AC-11, AC-12
- [ ] **The one that used to lose data.** Set an override, clear it, set a different one for the same date, then let a sync run. Read the row back → expect the **second** number, live, not a tombstone and not the first number → AC-10b

### Sync and failure

- [ ] Set an override, sync, then check `target_overrides` in the live database → the row is there, owned by your Clerk `sub` → AC-13
- [ ] Turn off the network partway through setup → expect setup to carry on regardless. Nothing here needs a server → AC-6
- [ ] Finish setup with the network off → expect a real target on screen and stored locally → AC-6

### Accessibility (AC-15)

- [ ] **Screen reader on**, walk every one of the nine screens → every control is labelled and every hint reads sensibly → AC-15
- [ ] Screen reader on the progress line → expect "Question 3 of 8" as a phrase, not two bare numerals → AC-15
- [ ] Screen reader on the result → expect the whole sentence announced, not just the numeral, and the floor sentence read with it when it applies → AC-15
- [ ] Screen reader, expand "How was this worked out?" → expect the detail announced rather than silently appearing → AC-15
- [ ] Set the system font size to its largest → every screen still readable, nothing clipped, nothing overlapping → AC-15
- [ ] Check every tappable thing is at least 44 points → AC-15

### Value sourcing: the timezone and today's date

- [ ] Finish setup, read `profiles.timezone` → the device's real IANA zone (e.g. `Asia/Colombo`), not UTC → AC-6
- [ ] Read `profiles.age_recorded_on`, `weight_entries.on_date`, and the `daily_targets.on_date` → all three the same **local** date, and correct near midnight in a zone well away from UTC → AC-6
- [ ] Set the phone's clock to 23:50 local, finish setup, then move the phone to another zone → the recorded date does not move → AC-6

## Acceptance-criteria coverage

- **AC-1** covered by the four "getting in and out" steps, including the second device
- **AC-2** covered by the five "questions" steps
- **AC-3** covered by the consent steps
- **AC-4** covered by the three "units" steps, including the US region one
- **AC-5** covered by the force quit and go back steps
- **AC-6** covered by the timezone and date steps, the offline steps, and by `npm test`'s rollback test
- **AC-7** covered by the 1613 reference step and the stored row step
- **AC-8** covered by the two floor steps
- **AC-9** covered by the result sentence step
- **AC-10** covered by the override set, clear, and stored row steps
- **AC-10b** covered by "the one that used to lose data", and by the fake server test in `npm test`
- **AC-11** covered by the "starts tomorrow" steps and the changed answer step
- **AC-12** covered by the Settings steps
- **AC-13** covered by the four database command steps and the sync step
- **AC-14** covered by the `git diff` command step and `npm test`'s fingerprint tests
- **AC-15** covered by the six accessibility steps
- **AC-16** covered by the two bounds steps
- **AC-17** covered by the sign out midway step

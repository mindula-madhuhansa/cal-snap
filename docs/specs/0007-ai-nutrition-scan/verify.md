# Verify: snap a meal, the AI nutrition scan · spec 0007 · updated 2026-08-11

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Nothing below can run until the server half is live. Do the two commands under **Commands** first, then the manual steps on a **new** development build: `expo-camera`, `expo-image-picker` and `expo-image-manipulator` are native code, so a client built before this feature will not run the app.

## Commands

- [ ] `supabase secrets set ANTHROPIC_API_KEY=<key> --project-ref <ref>` → the key is a function secret only, never an `EXPO_PUBLIC_` variable → AC-10
- [ ] `supabase db push` (or apply `supabase/migrations/20260811000000_scan_cap.sql`) → `claim_meal_scan` exists → AC-8
- [ ] `supabase functions deploy scan-meal --project-ref <ref>` → the function is live → AC-1
- [ ] `select proname, prosecdef from pg_proc where proname = 'claim_meal_scan'` → one row, `prosecdef` false (security invoker, so row level security still applies) → AC-11
- [ ] `npm test` → 635 passing, 50 files → AC-1, AC-2, AC-12, AC-15, AC-18
- [ ] `npm run lint && npm run typecheck && npm run format` → all clean
- [ ] `npm run gen:supabase-migration && git diff --exit-code supabase/migrations` → empty, proving the three generated migrations still generate exactly what was applied and the hand written fourth is untouched
- [ ] `grep -ri "sk-ant" src/ app.config.ts .env.example` → no match, and the same search over a release bundle → AC-10
- [ ] `npx expo-doctor` → the three new packages match the SDK

## UI / manual

- [ ] Open the Scan tab → the bar shows three tabs, Scan carries a camera mark → AC-4
- [ ] Photograph a real plate → within about 6 seconds, a named food with a portion, calories, protein, carbs and fat → AC-1
- [ ] Same scan → `select model, prompt_version, status, confidence, cost_cents from meal_scans order by created_at desc limit 1` → `claude-sonnet-5`, `v1`, a real status, and a `cost_cents` that is **not** zero and not a round guess → AC-9, AC-15
- [ ] Pick that same plate from the photo library instead → the same result screen, same shape → AC-4
- [ ] Photograph something with an obviously uncertain portion (a mixed curry, a covered dish) → any item below `high` shows a written tag and its calorie figure is marked as an estimate, and a sentence above the list says how many to check → AC-2
- [ ] Photograph a wall → "No food found", no invented item, and both a retake and a library control → AC-3
- [ ] Turn the camera permission off in system Settings, reopen the tab → a screen explaining why the camera is needed, an **Open Settings** control that lands on this app's page, and **Pick from library** still working → AC-5
- [ ] Turn airplane mode on, take a photo → the message names the connection, the photo is still there, and **Try again** with the connection back re-sends that same photo and succeeds. `select count(*) from meal_scans` is unchanged by the offline attempt → AC-6
- [ ] Start a scan, background the app for 15 seconds, return → the result is on screen, not an empty camera, and one row was written → AC-13
- [ ] Watch a slow scan past 10 seconds → the wording changes to "taking longer than usual" without the scan being cancelled → AC-12
- [ ] Turn VoiceOver or TalkBack on and sweep both screens → every control named, the result announced as one summary sentence rather than a bare numeral, the system font size honoured up to the cap, and reduce motion respected → AC-14

## Value sourcing

One per row of the spec's table, each varying the input that breaks it if the source is wrong.

- [ ] **Local day for the cap.** Set `profiles.timezone` to `Pacific/Kiritimati` (UTC+14), scan, then set it to `Pacific/Niue` (UTC-11) and scan again → the two scans fall in different local days, and the cap counts them separately. Then send a request with a *different* timezone in the body → ignored, because the zone is read server side → AC-8
- [ ] **Cap reset time.** Over the cap, the message names a time that equals the window's end for that same zone, not the device's → AC-8b
- [ ] **`user_id`.** Sign in as a second account and request the first account's `scan_id` → nothing of the first account's is returned, and no row of theirs changes → AC-11
- [ ] **`status`.** A photo of food the model is unsure about lands `low_confidence`, a confident one `ok`, a wall `unrecognised` → AC-2, AC-3
- [ ] **`cost_cents`.** Two scans with visibly different reply lengths record different costs, both non zero, both to three decimals. Proven to bite by replacing the token counts with a constant → AC-15
- [ ] **`model` and `prompt_version`.** Both recorded values match the constants in `prompt.ts`, not anything in configuration → AC-9
- [ ] **`meal_scans.id`.** The row's `id` equals the `scan_id` the phone minted, so no second round trip was needed → AC-18
- [ ] **`created_at` / `updated_at`.** Both come from the server clock: set the phone's clock a year ahead and scan → the row's stamps are today's → AC-9
- [ ] **Image size.** Instrument or inspect the prepared file → longest edge 1024 px, JPEG, quality 0.7, on both a landscape and a portrait photo → AC-16
- [ ] **`raw_response`.** `select raw_response from meal_scans limit 1` → the parsed reply and the usage object, and **no image bytes** → AC-9
- [ ] **Local mirror.** After a scan, `select is_dirty, synced_at from meal_scans` on the phone → `is_dirty = 0` and `synced_at` equal to the returned `updated_at`, and `countPendingPushes` does not count it → AC-9
- [ ] **Failure reason.** Force each of the five branches (bad key, a 429, a timeout, a malformed reply, a thrown error) → five different sentences, and none contains a code, a status, or a provider name → AC-19

## The two that need load, not a phone

- [ ] **Cap under load.** Sitting at 24 scans used, fire 50 concurrent requests from one account → exactly one more scan and 49 refusals. **Proven to bite** by removing the `pg_advisory_xact_lock` from `claim_meal_scan` and watching the count overshoot → AC-8
- [ ] **Idempotency.** Send the same `scan_id` twice → the same result both times, one Anthropic call, one row, one cap slot consumed → AC-18
- [ ] **Failed rows are free.** Force a failure, then check the cap count → the `failed` row does not count toward it → AC-7

## Acceptance-criteria coverage

- AC-1 real plate + `npm test` · AC-2 uncertain plate + confidence wording tests · AC-3 wall photo · AC-4 camera and library · AC-5 refused permission · AC-6 airplane mode · AC-7 failed rows are free · AC-8 timezone sourcing + cap under load · AC-8b reset time · AC-9 the row's columns + local mirror · AC-10 secret searches · AC-11 second account + `prosecdef` · AC-12 slow wording + timeout tests · AC-13 background and return · AC-14 screen reader sweep · AC-15 cost arithmetic tests + two real scans · AC-16 prepared file size · AC-17 covered by the pinned schema, evidenced by no parse retry existing · AC-18 repeated `scan_id` · AC-19 the five branches

# Verify: snap a meal, the AI nutrition scan · spec 0007 · updated 2026-08-11

_Steps derived from spec 0007 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Run of 11 August 2026: verdict PASS.** Nothing failed. The server half, the database rules and the bundle were proven here and are ticked with their evidence. The camera, the screens and the screen reader sweep were run by the engineer on a real device the same day and are ticked as theirs, marked _(engineer run)_ so the source of each verdict stays visible. Two things are still owed and neither blocks the feature: the cap under concurrent load, which one session cannot prove, and one defect written up at the end.

The server half is live: the migration is applied, the function is deployed at version 3, and `ANTHROPIC_API_KEY` is set. The manual steps need a **new** development build, because `expo-camera`, `expo-image-picker` and `expo-image-manipulator` are native code.

## Commands

- [x] `supabase secrets set ANTHROPIC_API_KEY=<key> --project-ref <ref>` → the key is a function secret only, never an `EXPO_PUBLIC_` variable → AC-10. Set through the dashboard. Not readable back by any tool here, so it is proven indirectly: a real scan reached Anthropic and recorded a real cost, which is impossible without a working key
- [x] `supabase db push` (or apply `supabase/migrations/20260811000000_scan_cap.sql`) → `claim_meal_scan` exists → AC-8. Migration history shows `scan_cap` as the fourth entry
- [x] `supabase functions deploy scan-meal --project-ref <ref>` → the function is live → AC-1. Version 3, `ACTIVE`, and its five files read back and matched the repo
- [x] `select proname, prosecdef from pg_proc where proname = 'claim_meal_scan'` → one row, `prosecdef` false (security invoker, so row level security still applies) → AC-11
- [x] `npm test` → 635 passing, 50 files → AC-1, AC-2, AC-12, AC-15, AC-18
- [x] `npm run lint && npm run typecheck && npm run format` → all clean
- [x] `npm run gen:supabase-migration && git diff --exit-code supabase/migrations` → empty, proving the three generated migrations still generate exactly what was applied and the hand written fourth is untouched. The only difference the run produced was line endings, no content
- [x] `grep -ri "sk-ant" src/ app.config.ts .env.example` → no match, and the same search over a release bundle → AC-10. A real Android bundle was exported (7.1 MB of Hermes bytecode) and searched: no `sk-ant`, no `ANTHROPIC`. **Proven to bite**: the identical search over the same binary finds `supabase.co` twice and `clerk` thirty six times, so the method reads strings out of the bundle and the absence is real. Worth knowing that `ANTHROPIC_API_KEY` **is** in the loaded environment at bundle time, and still does not reach the bundle, because Metro only inlines `EXPO_PUBLIC_` names
- [x] `npx expo-doctor` → the three new packages match the SDK. 20 of 21 checks pass; the one failure is `eas-cli` sitting in project dependencies, which predates this feature and is unrelated to it

## UI / manual

- [x] Open the Scan tab → the bar shows three tabs, Scan carries a camera mark → AC-4 _(engineer run, 11 August 2026)_
- [x] Photograph a real plate → within about 6 seconds, a named food with a portion, calories, protein, carbs and fat → AC-1. _(engineer run, 11 August 2026)_ The row it left is real and is the evidence behind several rows below. Timing is worth a look: the row's own stamps say the server side took 6.16 seconds from claim to settle, and the phone adds image preparation and upload on top, so "about 6 seconds" is the boundary rather than comfortable headroom
- [x] Same scan → `select model, prompt_version, status, confidence, cost_cents from meal_scans order by created_at desc limit 1` → `claude-sonnet-5`, `v1`, a real status, and a `cost_cents` that is **not** zero and not a round guess → AC-9, AC-15. Returned `claude-sonnet-5`, `v1`, `low_confidence`, `medium`, `0.527`
- [x] Pick that same plate from the photo library instead → the same result screen, same shape → AC-4 _(engineer run, 11 August 2026)_
- [ ] Photograph something with an obviously uncertain portion (a mixed curry, a covered dish) → any item below `high` shows a written tag and its calorie figure is marked as an estimate, and a sentence above the list says how many to check → AC-2
- [x] Photograph a wall → "No food found", no invented item, and both a retake and a library control → AC-3 _(engineer run, 11 August 2026)_
- [x] Turn the camera permission off in system Settings, reopen the tab → a screen explaining why the camera is needed, an **Open Settings** control that lands on this app's page, and **Pick from library** still working → AC-5 _(engineer run, 11 August 2026)_
- [x] Turn airplane mode on, take a photo → the message names the connection, the photo is still there, and **Try again** with the connection back re-sends that same photo and succeeds. `select count(*) from meal_scans` is unchanged by the offline attempt → AC-6 _(engineer run, 11 August 2026)_
- [ ] Start a scan, background the app for 15 seconds, return → the result is on screen, not an empty camera, and one row was written → AC-13
- [ ] Watch a slow scan past 10 seconds → the wording changes to "taking longer than usual" without the scan being cancelled → AC-12
- [x] Turn VoiceOver or TalkBack on and sweep both screens → every control named, the result announced as one summary sentence rather than a bare numeral, the system font size honoured up to the cap, and reduce motion respected → AC-14 _(engineer run, 11 August 2026)_

## Value sourcing

One per row of the spec's table, each varying the input that breaks it if the source is wrong.

- [ ] **Local day for the cap.** Set `profiles.timezone` to `Pacific/Kiritimati` (UTC+14), scan, then set it to `Pacific/Niue` (UTC-11) and scan again → the two scans fall in different local days, and the cap counts them separately. Then send a request with a *different* timezone in the body → ignored, because the zone is read server side → AC-8
- [ ] **Cap reset time.** Over the cap, the message names a time that equals the window's end for that same zone, not the device's → AC-8b
- [x] **`user_id`.** Sign in as a second account and request the first account's `scan_id` → nothing of the first account's is returned, and no row of theirs changes → AC-11. Run as a second `sub` against the live database: the stranger reads zero rows, including that exact `scan_id`, and a blanket `update` plus a blanket `delete` changed nothing. The real row still reads `low_confidence` and `0.527` afterwards. Rolled back, so nothing was left behind
- [ ] **`status`.** A photo of food the model is unsure about lands `low_confidence`, a confident one `ok`, a wall `unrecognised` → AC-2, AC-3. One third of this is done: the real scan came back `medium` and landed `low_confidence`, which is the derivation working. `ok` and `unrecognised` still need their photos
- [ ] **`cost_cents`.** Two scans with visibly different reply lengths record different costs, both non zero, both to three decimals. Proven to bite by replacing the token counts with a constant → AC-15. Only one real scan exists so far, at `0.527`, three decimals and clearly not a round guess. The second scan is what makes this a comparison
- [x] **`model` and `prompt_version`.** Both recorded values match the constants in `prompt.ts`, not anything in configuration → AC-9. `claude-sonnet-5` and `v1`, matching the pinned constants
- [x] **`meal_scans.id`.** The row's `id` equals the `scan_id` the phone minted, so no second round trip was needed → AC-18. The stored id is a version 7 UUID, and the function only ever inserts the `scan_id` it was handed
- [ ] **`created_at` / `updated_at`.** Both come from the server clock: set the phone's clock a year ahead and scan → the row's stamps are today's → AC-9. Both come from `clock_timestamp()` in the migration and neither is in the request, so the source is right by construction; the clock skew run is what would prove it
- [ ] **Image size.** Instrument or inspect the prepared file → longest edge 1024 px, JPEG, quality 0.7, on both a landscape and a portrait photo → AC-16
- [x] **`raw_response`.** `select raw_response from meal_scans limit 1` → the parsed reply and the usage object, and **no image bytes** → AC-9. Its keys are exactly `reply` and `usage`, and the whole column is 589 bytes of text, which settles the image question on its own: a 1024 px JPEG in base64 could not fit in a thousandth of that
- [ ] **Local mirror.** After a scan, `select is_dirty, synced_at from meal_scans` on the phone → `is_dirty = 0` and `synced_at` equal to the returned `updated_at`, and `countPendingPushes` does not count it → AC-9
- [ ] **Failure reason.** Force each of the five branches (bad key, a 429, a timeout, a malformed reply, a thrown error) → five different sentences, and none contains a code, a status, or a provider name → AC-19

## The two that need load, not a phone

- [ ] **Cap under load.** Sitting at 24 scans used, fire 50 concurrent requests from one account → exactly one more scan and 49 refusals. **Proven to bite** by removing the `pg_advisory_xact_lock` from `claim_meal_scan` and watching the count overshoot → AC-8. The gate itself is proven below; the serialisation is not, and one session cannot prove it. This is the single most valuable thing still owed, because it is the money bug the cross check found
- [x] **Idempotency.** Send the same `scan_id` twice → the same result both times, one Anthropic call, one row, one cap slot consumed → AC-18. Run against the live function in a rolled back transaction: the second claim on an unsettled row returned `claimed` and reused the same row (one row for that id, not two), and once the row was settled a further claim returned `recorded` carrying the stored result back, so no second call and no second slot
- [x] **Failed rows are free.** Force a failure, then check the cap count → the `failed` row does not count toward it → AC-7. With two settled scans and one `failed` row present, a claim at a cap of 3 still succeeded, so the `failed` row consumed nothing. At a cap of 2 the same account was correctly refused with `over_cap`

## Found on 11 August 2026, still open

**A `scan_id` that already exists under another account raises instead of claiming.** The migration says at the `select ... into v_existing` step that another account's id "is simply not found and is claimed fresh under this user, which is the safe answer". It is not. `meal_scans_pkey` is `PRIMARY KEY (id)` across the whole table, not per account, so the insert that follows hits a duplicate key and the function raises `23505`. The edge function turns that into `failed` with reason `internal`.

Nothing leaks: the stranger never sees a column of the row. Two things are still wrong. The comment describes behaviour the schema makes impossible, which is the same shape of mistake as the `anon` grant. And a caller can tell "this id exists for somebody" from "this id is free" by whether the request fails, which is a weak existence oracle across accounts. It is close to unreachable in practice, because ids are version 7 UUIDs minted on the phone, but it should return a result rather than raise.

## Acceptance-criteria coverage

- AC-1 real plate + `npm test` · AC-2 uncertain plate + confidence wording tests · AC-3 wall photo · AC-4 camera and library · AC-5 refused permission · AC-6 airplane mode · AC-7 failed rows are free · AC-8 timezone sourcing + cap under load · AC-8b reset time · AC-9 the row's columns + local mirror · AC-10 secret searches · AC-11 second account + `prosecdef` · AC-12 slow wording + timeout tests · AC-13 background and return · AC-14 screen reader sweep · AC-15 cost arithmetic tests + two real scans · AC-16 prepared file size · AC-17 covered by the pinned schema, evidenced by no parse retry existing · AC-18 repeated `scan_id` · AC-19 the five branches

**Met on the 11 August run**: AC-1, AC-3, AC-4, AC-5, AC-6, AC-7, AC-9 (the row's columns), AC-10, AC-11, AC-14, AC-15 (the arithmetic and one real cost), AC-17 (the schema is pinned in the deployed source and no repair or retry path exists), AC-18. The six device ones are the engineer's own run, marked as such above.

**Still open, none of it blocking**: AC-2 (the written estimate tags were never put in front of an uncertain plate on purpose), AC-8 (the cap gate is proven, the atomic half is not, and that is the load test), AC-8b, AC-12, AC-13, AC-16, AC-19. Every one of these has a passing unit test behind it; what is missing is the runtime look.

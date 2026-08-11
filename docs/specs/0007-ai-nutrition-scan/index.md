# 0007. Snap a meal: the AI nutrition scan

**Date**: 2026-08-11
**Status**: In Progress

## Summary

You point the camera at a plate, and a few seconds later the app names each food on it with calories, protein, carbs and fat. The photo is resized on the phone and sent to a small server side function, which calls Claude Sonnet 5 and gets back a result whose shape is guaranteed by the model API itself, so a malformed reply is not something the phone has to cope with. The photo never leaves the device except as scan input, the Anthropic key lives only in that function, and every call is recorded with what it actually cost. When the app is unsure, or finds no food at all, it says so in plain words rather than making a number up.

## Requirements

**User stories**:

- As someone logging lunch, I want to photograph my plate and get its nutrition back in seconds, so that logging costs me a moment instead of a data entry session.
- As someone who cares whether the numbers are right, I want to see which parts the app is unsure about, so that I know what to check rather than trusting a guess.
- As someone on a patchy connection or with the camera permission switched off, I want to be told what actually went wrong and what to do next, so that I am not staring at a spinner or a dead button.
- As the person paying for this, I want to know what each scan costs and to have a ceiling on how many can run, so that a stuck retry loop or a stolen token cannot spend my money all night.

**Acceptance criteria** (the contract, each independently checkable):

- **AC-1**: A photo of a meal returns a result naming one or more foods, each with a name, an estimated portion (a quantity plus `g`, `ml` or `piece`), calories, protein, carbs and fat. On a normal connection this takes under about 6 seconds.
- **AC-2**: Each food carries its own confidence of `high`, `medium` or `low`, and anything below `high` is visibly marked on screen as an estimate worth checking, in a plain sentence rather than an icon alone.
- **AC-3**: A photo with no recognisable food comes back as `unrecognised`, and the screen says it could not find food in the photo and offers a retake and a library pick. No food item is ever invented to fill an empty result.
- **AC-4**: A photo can come from the live camera or from the phone's photo library, and both reach the same scan and the same result screen.
- **AC-5**: A refused or previously refused camera permission shows a screen explaining why the camera is needed, a control that opens this app's page in the system settings, and the photo library as a second way through. No tap is ever silently ignored.
- **AC-6**: With no usable connection the photo is still captured and kept, the message names the connection as the cause, and retrying re-sends that same photo. No `meal_scans` row is written, because nothing was attempted and nothing was spent.
- **AC-7**: A scan recorded as `failed` does not count toward the daily cap. Only `ok`, `low_confidence` and `unrecognised` count.
- **AC-8**: A daily cap of 25 scans per account per the user's own local day is enforced inside the edge function, counted from Postgres before Anthropic is called, and enforced **atomically**: concurrent requests from one account cannot each read a count under the cap and all proceed.
- **AC-8b**: Being over the cap tells the person, in plain words, that they have reached the daily limit and when it resets.
- **AC-9**: Every call that reaches Anthropic writes exactly one `meal_scans` row carrying `model`, `prompt_version`, `status`, `confidence`, `raw_response` and `cost_cents`, whether or not the person keeps the result. A discarded scan still leaves its record and its cost.
- **AC-10**: The Anthropic API key is not present in the app bundle, in the repository, or in any value the phone can read.
- **AC-11**: A caller without a valid Clerk session token cannot scan, and cannot read or write another account's scan rows. Row level security is what enforces this, on both the cap count and the scan write.
- **AC-12**: At about 10 seconds the waiting screen changes its wording to say the scan is taking longer than usual. The function gives up on Anthropic at 25 seconds and returns a failure; the phone gives up at 30 seconds. Each of the three produces an honest message rather than a bare error.
- **AC-13**: Backgrounding the app or navigating away while a scan is in flight does not cancel it. The scan record is still written with its real cost, and returning to the capture screen shows the result rather than an empty camera.
- **AC-14**: The capture and result screens meet the project accessibility baseline: every control labelled, status changes announced to a screen reader, the system font size setting respected, and reduce motion honoured.
- **AC-15**: `cost_cents` is computed from the token counts the Anthropic response itself reports, multiplied by rates pinned in the function. It is never a fixed guess.
- **AC-16**: The image is resized to 1024 pixels on its longest edge and encoded as JPEG at quality 0.7 before it leaves the phone.
- **AC-17**: The result shape is enforced by the model API's structured outputs, so a reply that does not match the schema is not a case the phone has to handle.
- **AC-18**: A retry re-sends the same `scan_id`. A scan already recorded against that id for that account returns its recorded result without calling Anthropic again, without charging again, and without consuming a second cap slot. One photo can cost at most one scan however many times the reply is lost.
- **AC-19**: A `failed` reply carries a reason drawn from a fixed set of values, never an exception message, so nothing internal reaches a sentence a person reads.

_AC-8b, AC-18 and AC-19 were added on 11 August 2026 after a cross check on a second model. AC-8b was split out of AC-8, which was doing two jobs. The other two close real gaps: without AC-18 a lost reply could charge twice, and without AC-19 the failure sentence had no named source._

## Decision

**Chosen option**: Option 2: a thin scan endpoint with structured outputs and a server counted cap.

The phone captures and shrinks the photo, posts it as base64 to a single Supabase edge function, and that function calls Claude Sonnet 5 with a pinned JSON schema, records the scan and its real cost in Postgres under row level security, and returns one tagged result value the phone handles exhaustively.

**Implementation skills**: `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `supabase` (`supabase/agent-skills`, `.agents/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.agents/skills/supabase-postgres-best-practices/`) · `expo-data-fetching` (`expo/skills`, `.agents/skills/expo-data-fetching/`) · `claude-api` (installed at user level, in the agent's own skills directory)

## Rationale

Reasoning, the options weighed, and the derivations: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**

No table change. Spec 0002 already declared every table this feature touches, and all of them are inside frozen migration 2. No table, column, index or constraint is added or altered, so `CORE_DATA_MODEL_FINGERPRINT` is untouched and no SQLite migration is written.

**One Postgres migration is written, and it declares no table.** `supabase/migrations/20260811000000_scan_cap.sql` adds a single function, `claim_meal_scan`, because the atomic cap below cannot be expressed as a PostgREST call and has to live in the database. It is the only hand written file in that folder: the other three are generated from the table declarations in `src/data/schema/`, and a function has no declaration to generate it from. `npm run gen:supabase-migration` writes only its own three files, so this one sits beside them untouched. _Corrected on 11 August 2026, after the build: the original wording said no Postgres migration was written at all, which the code contradicted._

| Table | Columns this feature uses | Written by |
|---|---|---|
| `meal_scans` | `id` (uuid v7, primary key), `user_id` (text, the Clerk `sub`), `model`, `prompt_version`, `status` in `ok` / `low_confidence` / `unrecognised` / `failed`, `confidence` in `high` / `medium` / `low` (nullable), `raw_response` (json, nullable), `cost_cents` (numeric 6,3, nullable), `created_at` / `updated_at`. Index `(user_id, created_at)` | The edge function writes the authoritative row into Postgres. The phone writes the same row into SQLite with `is_dirty = 0` from the returned values |
| `meals.scan_id` | nullable, references `meal_scans(id)` on delete set null | Feature 8, when the person saves. Nothing here writes a meal |
| `meals.photo_local_uri` | the captured photo's path on this device | Feature 8. `photo_remote_path` and `photo_synced_at` stay null in release 1 |
| `meal_items` | `source = 'ai_scan'`, `confidence`, the `base_*` rate columns plus `quantity` | Feature 8. This feature produces the values in memory and shows them; it saves nothing |
| `profiles.timezone` | read only, resolves the user's local day for the cap | onboarding (spec 0006) |

Relationships: one account has many scans; one scan produces zero or one meal, because a discarded scan still leaves its row and its cost.

**State transitions**

The capture screen is one state machine, and it is the whole feature's shape:

```
idle (camera live)
  ├─ permission refused ──────────→ blocked (explain, settings link, library path)
  └─ shutter or library pick ─────→ preparing (resize, encode)
                                        │
                     no connection ─────┴──→ offline (photo kept, retry re-sends it)
                                        │
                                        ↓
                                    scanning ──(~10 s)──→ scanning, slow wording
                                        │
        ┌───────────────┬───────────────┼──────────────────┬──────────────────┐
        ↓               ↓               ↓                  ↓                  ↓
    ok result   low_confidence   unrecognised        over_daily_cap        failed
   (per item      (same screen,   (no items, honest    (told the limit    (honest reason,
    marks)         marks shown)    line, retake)        and the reset)     retry same photo)
```

Backgrounding or navigating away does not leave `scanning`. The request runs to completion, the record is written, and the result is held for the return.

`meal_scans.status` maps one to one onto those terminal states, except `over_daily_cap`, which writes no row (nothing was spent) and `offline`, likewise.

Inside the function the row's own life is short and deliberate:

```
take a per account transaction lock (this is what serialises concurrent
requests from one account; the conditional insert alone does not)
        │
        ↓
insert (status 'failed') only if this account's count for its local
day is under 25, counting only non 'failed' rows
        │
   inserted? ──no──→ return over_daily_cap (no row, nothing spent)
        │ yes
        ↓
   call Anthropic ──fails or times out──→ row stays 'failed' (correct, and it
        │                                  does not count toward the cap)
        ↓
   update the row to its real status, confidence, raw_response and cost_cents
```

Inserting first, pessimistically, is what makes a crashed function safe: whatever goes wrong, the row it leaves behind is `failed`, and `failed` costs the person nothing. A retry carrying the same `scan_id` finds that row and, if it already holds a non `failed` status, returns it rather than calling Anthropic again (AC-18).

**What actually makes the cap atomic is the lock, not the single statement.** This spec originally said a conditional insert was enough, and it is not: `insert ... select ... where (count) < 25` is one statement but not a *serial* one. Under Postgres's default READ COMMITTED isolation, two concurrent transactions both take their snapshot before either commits, so both read a count of 24, both pass the condition, and both insert. The `pg_advisory_xact_lock` on the account, taken before the count, is what genuinely serialises them, and it is held only to the end of that transaction. Locking on the account rather than the table means two different people scanning at the same moment never wait on each other. _Corrected on 11 August 2026, after the build._

**API surface**

| Endpoint | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `/functions/v1/scan-meal` | POST | `scan_id`: uuid v7 (req), `image_base64`: string (req), `media_type`: `"image/jpeg"` (req) | `kind`: `ok` \| `low_confidence` \| `unrecognised` \| `over_daily_cap` \| `failed`; on the first two: `items[]` (`name`, `quantity`, `unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `confidence`), `confidence`, `scan` (`id`, `model`, `prompt_version`, `status`, `confidence`, `cost_cents`, `created_at`, `updated_at`); on `over_daily_cap`: `resets_at`; on `failed`: `reason`, one of `upstream_timeout`, `upstream_refused`, `upstream_error`, `invalid_reply`, `internal` | Clerk session token, verified by Supabase before the function body runs | Always HTTP 200 with a tagged `kind`. A non 200 means only something genuinely unexpected, and the phone treats it as `failed` |

The endpoint is **idempotent on `scan_id`** (AC-18). Sending the same id twice returns the same result and calls Anthropic once.

The tagged result is the project's "expected failures return an explicit result value" rule carried across the network boundary. The phone handles one exhaustive union, and TypeScript's exhaustiveness check is what proves no case was forgotten.

The phone reaches this through a narrow port, matching how `src/data/remote/transport.ts` already isolates sync:

```ts
// src/scan/transport.ts, no Supabase import
export type ScanTransport = { scan: (request: ScanRequest) => Promise<ScanResult> };
```

with the Supabase adapter beside `src/account/supabase-transport.ts`. That is what lets the scan rules be tested against a fake with no network, no client and no camera.

**Value sourcing**

| Action | Value produced or displayed | Source |
|---|---|---|
| scan | each food's name, portion quantity and unit, calories, protein, carbs, fat | the model's reply, constrained to the pinned JSON schema (AC-17) |
| scan | per item `confidence`, and the scan's overall `confidence` | an enum field in that same schema, so the model must supply it |
| scan | `status` (`ok` / `low_confidence` / `unrecognised`) | derived in the function: `unrecognised` when the schema's `found_food` is false, `low_confidence` when the overall confidence is not `high`, else `ok` |
| scan | `cost_cents` | computed in the function from `response.usage.input_tokens` and `output_tokens` against `SONNET_5_RATES`, a pinned constant naming its own effective date (AC-15) |
| scan | `model` | a pinned constant in the function, `claude-sonnet-5`. Never read from configuration, so the recorded value always matches what actually ran |
| scan | `prompt_version` | a constant in the function, bumped by hand whenever the system prompt or the schema changes. This is what makes a past scan's numbers explainable later |
| scan | `meal_scans.id` | uuid v7 generated on the phone and sent as `scan_id`, so the phone can write its local copy and reference it without a second round trip |
| scan | `user_id` | the `sub` claim of the Clerk token Supabase already verified. Never taken from the request body |
| scan | `created_at`, `updated_at` | Postgres, through spec 0005's trigger. The function does not set them and the phone believes the reply |
| cap check | the user's current local day | `profiles.timezone`, read inside the function for that `sub`. **Not** sent by the phone: a client supplied day would let anyone reset their own cap by lying about their timezone |
| cap check | today's scan count | `count(*)` over `meal_scans` where `user_id = sub`, `created_at` falls inside that local day, and `status <> 'failed'` (AC-7) |
| over cap screen | when the cap resets | the next local midnight in `profiles.timezone`, the same value the count used |
| capture | the photo's file path | `expo-camera`'s capture result or `expo-image-picker`'s pick, written into the app's **cache** directory. It moves to permanent storage only when feature 8 saves the meal, so an abandoned scan's photo is reclaimed by the operating system rather than accumulating forever |
| waiting screen | the "taking longer than usual" wording | a 10 second timer on the phone (AC-12), not anything the server sends |
| failure screen | the `reason` behind a `failed` result | a fixed set of five values the function chooses per failure branch (`upstream_timeout`, `upstream_refused`, `upstream_error`, `invalid_reply`, `internal`), mapped to sentences on the phone. **Never** an exception message, which would put internals in front of a person (AC-19) |
| scan | `raw_response` | the parsed model reply plus the API's `usage` object, and nothing else. Not the SDK's response envelope, and never image bytes, which would put a meal photo into Postgres and contradict photos staying on the device |
| local mirror | the SQLite `meal_scans` row's `is_dirty` and `synced_at` | `is_dirty = 0`, `synced_at` set to the `updated_at` the function returned. Written through `src/data/local/`, the same access layer every other table uses, so `countPendingPushes` never counts it and the pull watermark behaves |
| result screen, and later feature 8 | the scan result itself, after the screen unmounts or the app returns from the background | a small module level store in `src/scan/`, keyed by `scan_id`, holding the last completed result. The capture screen re-reads it on mount (AC-13) and feature 8 reads the same one. Nothing is persisted: the durable record is the `meal_scans` row, which syncs |

**Key invariants**

- The Anthropic key exists only in the edge function's environment. No code path puts it into a response, a log line, or a `raw_response` value.
- The cap is counted server side, from Postgres, before Anthropic is called, in the same statement that inserts the row. A client side count is a convenience at most and never the gate.
- One `scan_id` costs at most one Anthropic call, forever. The endpoint is idempotent on it, which is what makes retrying safe on a path where the reply can be lost after the money is spent.
- A row that exists before its outcome is known always reads `failed`. Every path out of the function either updates it to the truth or leaves it as the safe lie, and the safe lie costs the person nothing.
- **`meal_scans` has no `deleted_at`, and this feature relies on that.** Spec 0005's sticky tombstone trigger therefore cannot fire here, and the row's one update (from `failed` to its real status) is not fighting anything. A future `deleted_at` on this table would break that reliance quietly.
- A scan the person discards still leaves its `meal_scans` row and its `cost_cents`. Usage is answerable from that table alone, with no counter to keep in step.
- The phone writes its local `meal_scans` copy with `is_dirty = 0`. It must never push over the server's `cost_cents` or `raw_response`.
- Nothing in this feature writes a `meal`, a `meal_item`, or a permanent photo file. That boundary is feature 8's.
- The recorded `model` and `prompt_version` always describe the call that actually ran, so any past scan can be explained.
- Health values and session tokens never appear in a log line (spec 0002, compliance).

**Security model**

- **Who may scan**: any signed in account, for itself only. Supabase verifies the Clerk token before the function body runs, because Clerk is registered as a third party auth provider, which is what puts `role: authenticated` on the token. Without a valid token there is no `sub` and the function refuses.
- **How writes are constrained**: the function builds its Supabase client with the caller's own token, so `meal_scans`'s existing policy, `(user_id = (select auth.jwt() ->> 'sub'))`, is the actual gate on both the count and the insert. **No service role key lives in the function.** One wrong or missing filter therefore cannot reach another account's rows, because the database refuses rather than trusting the code.
- **The secret boundary**: the app ships the Supabase URL, the Supabase publishable key and the Clerk publishable key, all safe (spec 0001). `ANTHROPIC_API_KEY` is a function secret and never crosses into the app.
- **Abuse ceiling**: 25 scans per account per local day, server counted. This bounds what a single stolen token can spend.
- **Compliance scope**: consumer wellness, not regulated medical data (spec 0002). A meal photo is personal data, which is the main reason photos stay on the device in release 1: nothing to secure server side, nothing to delete, nothing to breach. Consent was already recorded at onboarding (`consented_at`, `consent_version`).

**Configuration required**

- `ANTHROPIC_API_KEY`: the Anthropic key, set as a Supabase edge function secret only. Never an `EXPO_PUBLIC_` variable, never in `.env.example` as a real value, never in `app.config.ts`.

No new app side environment variable. The function's URL derives from the existing `EXPO_PUBLIC_SUPABASE_URL`, so `src/config/env.ts` is unchanged.

**Critical test scenarios**

- Happy path: a plate photo returns three named items with portions, macros and per item confidence, in under about 6 seconds, and one `meal_scans` row lands with a real `cost_cents`, verifies **AC-1**, **AC-9**, **AC-15**.
- Honesty: a low confidence item is marked as an estimate in a sentence, and a photo of a wall returns `unrecognised` with no invented item, verifies **AC-2**, **AC-3**.
- Failure case: Anthropic times out at 25 seconds, the function returns `failed`, the row records `status = 'failed'`, and that row does not count toward the cap, verifies **AC-7**, **AC-12**.
- Failure case: the connection drops before the request leaves; the photo survives, the message names the connection, retry re-sends the same photo, and no scan row exists, verifies **AC-6**.
- Failure case: the app is backgrounded mid scan; the request completes, the row is written, and returning shows the result, verifies **AC-13**.
- Limit: the 26th scan of a local day returns `over_daily_cap` with a reset time, before Anthropic is called, verifies **AC-8**, **AC-8b**.
- Limit under load: fifty requests fired at once from one account, sitting at 24 scans used, produce exactly one more scan and forty nine refusals. Proven to bite by reverting the atomic insert to a separate count, verifies **AC-8**.
- Idempotency: the same `scan_id` sent twice returns the same result, calls Anthropic once, writes one row, and consumes one cap slot, verifies **AC-18**.
- Honest failure: each of the five failure branches produces its own `reason` value and its own sentence, and no exception message reaches the screen, verifies **AC-19**.
- Auth: a request with no token, an expired token, or another account's `scan_id` gets nothing back and writes nothing, because row level security refuses it, verifies **AC-11**.
- Permission: with the camera permission refused, the screen explains, opens system settings, and still offers the library, verifies **AC-5**, **AC-4**.
- Secret boundary: a release bundle and the repository are both searched for the Anthropic key and it is absent, verifies **AC-10**.

## Build plan

Sliced by the project's **Skateboard** approach: the first slice is the thinnest thing a real person could actually use, and each later slice thickens it without rewriting what came before. No slice touches a table, so no SQLite migration appears anywhere in this plan; slice 2 carries the one Postgres migration, which declares a function and no table.

1. **A photo becomes numbers.** Deploy the `scan-meal` edge function: pinned `claude-sonnet-5`, the system prompt and its `prompt_version` constant, the JSON schema behind `output_config.format`, `thinking` disabled at `effort: "low"`, zod validation of the reply, `cost_cents` from the reported token usage, and the scan row written through a user scoped Supabase client. On the phone: the `ScanTransport` port with its Supabase adapter, the camera tab and capture screen on `expo-camera`, `expo-image-manipulator` at 1024 px and quality 0.7, the local mirror written through `src/data/local/`, and a plain result list built from the existing design system. Satisfies **AC-1**, **AC-4**, **AC-9**, **AC-10**, **AC-11**, **AC-15**, **AC-16**, **AC-17**.
2. **One photo cannot cost twice.** The atomic insert that is both the cap gate and the pessimistic `failed` row, the update to the real status on success, and idempotency on `scan_id` so a repeated request returns the recorded result instead of calling Anthropic again. Built early and deliberately, because both bugs it prevents cost real money and neither is visible in normal use. Satisfies **AC-8**, **AC-18**, and half of **AC-7**.
3. **It tells the truth.** Per item confidence marks and the sentence that carries them, the `unrecognised` screen with its retake and library escapes, and the low confidence wording. Satisfies **AC-2**, **AC-3**.
4. **It fails well.** The refused permission screen with its settings deep link, the offline path over the shared `network-failure.ts` rule, the five failure reasons and their sentences, the three timeouts and the 10 second copy change, the module level result store that lets an interrupted scan survive a background, retry re-sending the kept photo and its id, and the over cap message with its reset time. Satisfies **AC-5**, **AC-6**, **AC-7**, **AC-8b**, **AC-12**, **AC-13**, **AC-19**.
5. **It holds.** Vitest over every pure rule in the feature (the status derivation, the cost arithmetic, the local day and cap window, the failure reason mapping, the result union handling) driven through a fake transport, the accessibility sweep across both screens, and a confirmation on a real development build that a real plate returns real numbers. Satisfies **AC-14**, and re-covers **AC-1**, **AC-2**, **AC-12**, **AC-18**.

## Consequences

**Positive**

- Zero table change. Spec 0002 designed `meal_scans` for exactly this, so the most expensive part of the feature was paid for a week ago and migration 2 stays frozen. The one migration this feature adds declares a function, not a table.
- Structured outputs delete a whole class of work. There is no JSON repair, no retry on a parse failure, no partial result to reason about.
- Cost is measured rather than assumed, from day one, on a table that already answers usage by date range. When billing arrives, a scan limit can be priced from real numbers.
- The narrow `ScanTransport` port keeps the scan rules testable with no network, no client and no camera, exactly as `remote/transport.ts` did for sync.
- Photos staying local means no bucket, no bucket policy, no orphan cleanup, and nothing extra for feature 10's account deletion to reach. It is the cheapest option and the most private one at the same time.
- Not using a service role key means a coding mistake in the function cannot cross accounts. The database refuses instead.

**Negative and tradeoffs**

- **Two Deno files now duplicate logic that exists as tested TypeScript in `src/`.** The function cannot import from `src/`, so the local day window it computes for the cap re-implements what `calculations/local-day.ts` already does, and the rounding it applies re-implements `calculations/rounding.ts`. Nothing keeps the copies in step, and a drift would show up as a cap that resets at the wrong hour or a value SQLite and Postgres disagree about. Both are small and both are worth a comment naming their twin. Enrolled as a follow up.
- **Prompt caching does not help.** The system prompt plus the schema come to roughly 500 tokens, and Claude Sonnet 5's minimum cacheable prefix is 1024, so a `cache_control` marker would silently do nothing. The input side of the cost is what it is until the prompt grows past that line, which is not a reason to pad it.
- Thinking off at low effort is the fast, cheap setting, and it is the least capable one. A genuinely confusing plate will be read less well than it would at the model's defaults. The confidence marks are the mitigation, not a fix.
- 1024 px throws away detail the model could have used. Small text in shot, a nutrition label, or a crowded plate will read worse than it would at full resolution. That is a deliberate trade for cost and speed, and it can be revisited with real scans rather than guesses.
- Base64 in the request body inflates the payload by about a third. At roughly 200 KB this is comfortable, and it stops being comfortable if the resolution decision is ever revisited upward.
- A hard cap of 25 will, eventually, block somebody legitimate on a day of heavy testing. There is no override path, and the message has to be good enough that they do not think the app is broken.
- The feature is only half a product until feature 8 lands. Someone can scan and look, and not yet keep anything.
- **The row now exists before its outcome does.** That is what buys the atomic cap and the safe crash, and the price is that `meal_scans` is no longer insert only: it takes one update per successful scan. Reading the table therefore means remembering that a `failed` row can mean "it failed" or "the function never got to finish", and those are indistinguishable after the fact.
- **The app being killed mid scan loses the result but not the record.** The row is in Postgres with its real cost, and `meal_scans` syncs, so it comes back down on the next pull and the accounting stays honest. What is gone is the list of foods, which lived only in memory. The person pays a scan and sees nothing, and the only mitigation is that this is rare.
- The module level result store is state outside React, which the project has otherwise avoided. It is deliberately tiny and deliberately not persisted, and it is still a second place where "the current scan" lives.

**Neutral**

- Four new packages: `expo-camera`, `expo-image-picker` and `expo-image-manipulator` on the phone, `@anthropic-ai/sdk` inside the function. All four need `npx expo-doctor` to stay happy and the first three need a new development build, since they are native code.
- `supabase/functions/` is a new directory in this repo, with a Deno runtime and its own conventions. It is the first server side code the project has had.
- The tab bar grows from two entries to three. `src/design-system/components/tab-bar.tsx` was built for a typographic bar and gains a middle item.
- Camera and photo library usage descriptions are now required in `app.config.ts` for both platforms. A missing one is an App Store rejection, not a runtime error.
- `prompt_version` is bumped by hand. Nothing enforces it, and forgetting it makes a past scan harder to explain later.

## Follow-up

- [ ] The Deno function duplicates the local day window and the rounding rule that `src/data/calculations/` already owns and tests. Decide whether to keep the copies with a comment naming their twin, or to extract a small shared module both runtimes can read.
- [ ] Nothing checks that the model and rates pinned in the function still exist and still cost what the constant says. `SONNET_5_RATES` carries an effective date; the introductory pricing it is written against runs to 31 August 2026, after which the input and output rates rise. Put a reminder somewhere a human will see it.
- [ ] Photo sync is designed for but not built. `profiles.photo_sync_enabled` exists and defaults to false, and `meals.photo_remote_path` and `photo_synced_at` stay null. Enrolling opt in photo upload as its own scope feature would give that column an owner.
- [ ] Production needs its own Clerk instance registered with Supabase as a third party auth provider before this function will accept a single request there. It is a per instance setting, and it is already recorded against feature 5.
- [ ] `claim_meal_scan` is still executable by `anon`. The migration's `revoke ... from public` does not reach it, because Supabase grants execute on public functions to `anon` directly rather than through `PUBLIC`. It is not a hole (the function raises immediately when the token carries no `sub`, and row level security still applies to every row it touches), but the migration's comment claims something untrue, which is worse than the grant. Apply `revoke all on function public.claim_meal_scan(uuid, text, text, timestamptz, timestamptz, integer) from anon;` and correct the file to match.
- [ ] `src/data/AGENTS.md` says `supabase/migrations/` is generated and must not be hand edited. That is now true of three files out of four. The rule needs a sentence carving out a migration that declares something no table declaration can produce, which `/sync` should add rather than leaving the next person to discover it from a diff.
- [ ] Agent Skills and MCP discovery was offered for the four new packages and declined, on the grounds that `expo-native-ui`, `supabase` and the user level Claude API skill already cover all of them. Worth recording as a decline in `AGENTS.md` so it is not offered again.

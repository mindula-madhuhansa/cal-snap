# 0007. Rationale: the AI nutrition scan

Reasoning and options for [index.md](index.md). `/develop` does not need this file.

## Context

Feature 7 is the whole promise of CalSnap. Everything built so far is scaffolding for this moment: you point a camera at food and the app knows what it is. If this feels like magic, the product works. If it feels like a form, nothing else matters.

Most of the hard structural decisions were made before this spec. Spec 0001 chose Claude Sonnet 5 behind a Supabase edge function, so that the Anthropic key never ships inside an installed app, and derived a cost of roughly 1.2 cents per scan from a 1,500 token image plus a 500 token system prompt and schema. Spec 0002 declared `meal_scans` with `model`, `prompt_version`, `status`, `confidence`, `raw_response` and `cost_cents`, gave it a `(user_id, created_at)` index explicitly described as the scan counter, and put `photo_local_uri`, `photo_remote_path`, `photo_synced_at` and `scan_id` on `meals`. Spec 0004 put Clerk behind every request and made `auth.jwt() ->> 'sub'` the identity every policy reads. Spec 0005 gave Postgres ownership of `updated_at`. Spec 0006 put a `timezone` on every profile.

So the forces here are narrow and specific rather than open ended.

**The photo is the expensive thing, and its size is the main cost lever.** Image tokens dominate the input side. Claude Sonnet 5 is the first Sonnet with high resolution vision, accepting up to 2576 pixels on the long edge at up to 4,784 image tokens, which is roughly three times what spec 0001's cost figure assumed. Choosing a resolution is therefore choosing a per scan price.

**There is no billing yet, and no ceiling either.** Spec 0002 says release 1 treats every account as free with no scan limit. That was written about product policy, not about abuse. Today a single leaked session token can call an endpoint that spends real money, in a loop, with nothing to stop it.

**The frozen migration constrains everything.** `releaseOneTables` generates migration 2, which has shipped to real phones. Any new column would mean a new declaration list, a new SQLite migration with its own fingerprint, and a new Postgres file. That cost is worth paying for a real need and not for a nice to have.

**A wrong number that looks confident is the failure mode that loses users.** The project's own rules say health numbers are shown to people who act on them, and that an uncertain value must say so rather than being presented as fact. A scan is an estimate by construction. The design has to carry that without making every meal feel unreliable.

**This is a network call on a phone, in a kitchen or a restaurant.** Slow connections, no connection, a refused camera permission, and a phone that gets backgrounded when a notification lands are all normal, not edge cases.

**The edge function is the project's first server side code.** It runs on Deno and cannot import anything from `src/`, so every rule it needs either exists there and gets duplicated, or lives only there and is unreachable.

## Options considered

### Option 1: call Anthropic from the app

The phone talks to the Anthropic API directly, holding the key.

**Pros**: no server side code at all, no edge function to deploy or operate, the lowest possible latency, and the whole feature is one screen and one fetch.

**Cons**: the key is inside an installed app, which is to say it is public. Spec 0001 already ruled this out and made it AC-8 there. There is also nowhere to enforce a cap, and nowhere trustworthy to record what a scan cost.

### Option 2: a thin scan endpoint with structured outputs and a server counted cap (chosen)

One edge function. The phone shrinks the photo and posts it as base64; the function verifies the caller's Clerk token, counts their scans for their local day, calls Claude Sonnet 5 with a pinned JSON schema, records the scan and its real cost through a user scoped Supabase client, and returns one tagged result value.

**Pros**: the key stays server side. The cap sits in the only place a client cannot bypass. Structured outputs make a malformed reply impossible rather than handled, which removes retry loops and parse failures from a latency sensitive path. `cost_cents` comes from the API's own reported token usage rather than a guess. Using the caller's token rather than a service role key means row level security, not the function's own correctness, is what keeps accounts apart. No table change at all.

**Cons**: a Deno runtime the project has never operated, and a second place where a bug can live. Two small rules (the local day window and the rounding) get duplicated because Deno cannot reach `src/`. And the function is one more thing that must be deployed in step with the app.

### Option 3: upload the photo to Supabase Storage first, then scan by URL

The phone uploads to a bucket under a `<user_id>/` prefix, then asks the function to scan that object.

**Pros**: photos survive a new phone from day one, so `photo_sync_enabled` gets its meaning immediately. The request body stays tiny. A failed scan can be retried server side without the phone re-sending anything.

**Cons**: a bucket, its row level security policy, signed URLs, and an orphan cleanup path for photos that were only ever scan input and never became a meal. It also puts pictures of people's meals on a server from day one, which then becomes something feature 10's account deletion must reach and something a breach could expose. Two round trips instead of one, on the path that has to feel instant.

### Option 4: ask for JSON in the prompt and parse the reply

Same architecture as option 2, but no schema. The prompt asks for JSON and the function parses whatever comes back, retrying on a parse failure.

**Pros**: works on any model, so swapping providers later costs nothing. No schema to maintain or version.

**Cons**: it re-invents the problem structured outputs solve. A parse failure on this path means a retry, which means another cent and several more seconds while someone waits for their lunch to be recognised. It also makes the failure surface bigger for no benefit the project actually needs.

## Rationale

Option 2 was close to predetermined by spec 0001's secret boundary, so most of the real reasoning went into the choices inside it.

**Structured outputs over tool use or prompt and parse.** Claude Sonnet 5 supports `output_config.format` with a JSON schema, and the schema compiles once and is then cached for 24 hours, so only the first scan after a prompt change pays for it. Against a "slow network, no network, a few seconds" requirement, deleting the retry loop is worth more than provider portability, which the project can buy back later by rewriting one function. Strict tool use would give the same guarantee, and it shapes the response as an action when what we want is an answer.

**Thinking off, effort low.** Claude Sonnet 5 runs adaptive thinking at effort `high` by default, tuned for hard agentic work. This is one constrained extraction from one image, and the default would both slow the scan past the 6 second target and spend output tokens on reasoning nobody reads. The usual warning that a thinking off model reaches for tools less does not apply, because there are no tools in this call. If real scans show the numbers are not good enough, adaptive thinking at low effort is the next step up and it is a one line change.

**1024 pixels.** This is the resolution spec 0001's cost derivation assumed, at about 1,500 image tokens. Food on a plate is a large, well lit subject, and the detail beyond this mostly is not what distinguishes rice from couscous. Full resolution roughly triples the image half of the cost for accuracy that has not been shown to be needed. That is a decision worth revisiting with a folder of real scans, not with an argument.

**A cap, despite spec 0002 saying release 1 has no scan limit.** Those are different questions. Spec 0002 was setting product policy: nobody pays, and nobody is throttled for using the app normally. Twenty five scans a day is invisible to a real person, since nobody eats twenty five meals, while bounding what one stolen token or one stuck retry loop can spend overnight. Counting it in the function against Postgres is the only version that means anything, because the whole point is protecting against a client that cannot be trusted. Failed scans not counting follows from the same reasoning: the person got nothing, so charging them a scan for the network's mistake is just unfair.

**No service role key.** The tempting shortcut is to give the function full database rights and filter by `user_id` in code. That makes the function's own correctness the only thing standing between accounts. Building the Supabase client from the caller's own verified token instead means the existing `(user_id = (select auth.jwt() ->> 'sub'))` policy is the gate, and a missing filter fails closed rather than leaking. It costs nothing, because the function only ever touches its own caller's rows.

**Photos stay on the phone.** This is where the cheapest option and the most private one agree, which is rare enough to take. `profiles.photo_sync_enabled` already exists and already defaults to false, so spec 0002 anticipated exactly this. It means no bucket policy to get wrong, no orphaned objects, nothing extra for account deletion to reach, and no store of people's meal photos to be responsible for. The cost is that a photo does not survive a new phone, which is a real loss and a smaller one than it sounds: the meal and its numbers do survive, because those sync.

**The server writes the scan row, the phone mirrors it clean.** The obvious alternative, having the phone write and sync it, breaks on two things. Only the server knows the real cost and the raw response, and the cap must count rows the client cannot fake. But SQLite has a foreign key from `meals.scan_id` to `meal_scans(id)`, and that table is inside frozen migration 2, so the local row has to exist before feature 8 can save a meal. Writing it locally with `is_dirty = 0` from the function's reply satisfies both: the reference resolves immediately, and the phone never pushes over the server's numbers.

**A tagged result rather than status codes.** The project's rule is that expected failures return an explicit result value rather than throwing. Carrying that across the network gives the phone one exhaustive union that TypeScript checks, instead of a status code table plus a body. It also sidesteps a real ambiguity: Supabase's own gateway emits 429 and 5xx for reasons that have nothing to do with this function, and the phone would have no way to tell those apart from the cap being reached.

**The engineer's choices and mine agreed throughout.** Every recommendation in the design conversation was taken, so there is no conflict to record here. The one place worth flagging is the resolution: 1024 pixels is a judgement made against a cost figure rather than against measured accuracy, and it is the first thing to revisit if scans read poorly.

## Cost, derived

The function computes `cost_cents` from the token counts Anthropic itself reports, so the figures below are the expectation and not the record.

At 1024 pixels the image is roughly 1,500 input tokens. The system prompt and the JSON schema add roughly 500, so about 2,000 input tokens. A four item plate returns roughly 400 output tokens, with thinking off so nothing is spent on reasoning.

Claude Sonnet 5 lists at $3 per million input tokens and $15 per million output. That is `2000 × $3/1M` plus `400 × $15/1M`, which is $0.006 plus $0.006, or about **1.2 cents per scan**. An introductory rate of $2 and $10 runs to 31 August 2026, at which the same scan is about **0.8 cents**.

This matches spec 0001's derivation exactly, which is the point: the resolution was chosen to keep that figure true rather than to quietly invalidate it.

The daily cap of 25 therefore bounds one account at roughly 30 cents a day at the standard rate. Prompt caching would cut the input side, and cannot be used here: the cacheable prefix is around 500 tokens and Claude Sonnet 5's minimum cacheable prefix is 1024, so a marker would silently do nothing.

## What the cross check changed

A second model read the drafted spec on 11 August 2026, before any code existed. It found eight things; seven were real and all seven are now closed in `index.md`.

The two that mattered were both about money, and both were invisible in normal use. The first: the phone gives up at 30 seconds and the function at 25, so there is a window where the function finished, spent a cent and wrote the row, and the phone saw nothing. The retry the spec cheerfully offered would then have paid for the same photo twice. The endpoint is idempotent on `scan_id` now, which is the project's own "idempotency from day one" rule applied to a path where the reply can be lost after the money is gone. The second: the cap was a count followed by an insert, so fifty simultaneous requests would each have read a count under 25 and all proceeded. That is precisely the abuse the cap exists to bound, so it made the cap decorative against the only attacker it was designed for. It is one serialised step now, which also made the crash path safe as a side effect: the row is inserted pessimistically as `failed`, so whatever goes wrong, what is left behind costs the person nothing.

_Amended on 11 August 2026, during the build. The cross check's fix was written up as "one atomic statement", and that is not sufficient: a conditional insert is a single statement but not a serial one, because under READ COMMITTED both concurrent transactions take their snapshot before either commits, read the same count of 24, and both proceed. So the cross check found the right bug and prescribed a remedy that would have left it open, which is the more interesting failure of the two. The remedy that works is a `pg_advisory_xact_lock` on the account, taken before the count, inside a database function. Worth remembering that a fix arriving with a confident mechanism still needs the mechanism checked._

The other five were unnamed sources rather than design faults: what `reason` contains on a failure (a fixed set of five values, never an exception message), what goes into `raw_response` (the parsed reply and the usage object, nothing else), what `is_dirty` and `synced_at` become on the local mirror, how the result reaches feature 8 across a navigation boundary, and the app being killed mid scan. That last one turned out better than the cross check thought: the record and its cost survive, because `meal_scans` syncs and comes back down on the next pull. Only the on screen list is lost.

The eighth was wrong, and worth recording because it is the shape of mistake a cross check makes. It asked for a connectivity detection package to satisfy AC-6. The project already has that answer in `src/account/network-failure.ts`, which `/debug` hardened on 10 August after tests caught it matching `timeout` but not `timed out`, `ETIMEDOUT`, `ENOTFOUND` or `EAI_AGAIN`. Adding a package would have been a second, competing answer to a settled question.

It also confirmed one thing the spec had left implicit and now states outright: `meal_scans` has no `deleted_at`, so spec 0005's sticky tombstone trigger cannot fire here, and the row's single update is not fighting it.

## References

Not included. This decision rests on the project's own specs 0001, 0002, 0004, 0005 and 0006, and on the Claude API reference consulted during the design conversation, both named in the text where they are used.

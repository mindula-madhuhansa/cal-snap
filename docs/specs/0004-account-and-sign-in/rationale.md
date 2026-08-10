# 0004. Account and sign in, reasoning

The build spec is [index.md](index.md). This file is the decision record: why Clerk, what else was weighed, and what it is grounded in.

> **Amended 9 August 2026, after the build began.** The reasoning below is left as it was written, because it is the record of a decision made with the information available then. Two things it says did not survive contact with the build, and you should read it knowing them:
>
> 1. **Native Google and Apple sign in were dropped** (AC-3 withdrawn; see Consequences in [index.md](index.md)). They appear below as a real advantage of Clerk over Supabase Auth, and that argument was honestly made. It is now a smaller advantage than it reads: `@clerk/expo` version 4 moved native Google into a separate package needing Google Cloud OAuth credentials and a registered signing fingerprint, which is more assembly than "it comes with it" implies. The Clerk decision still stands on the token cache, the refresh handling, and the dashboard configurable factors, all of which held up. It just stands on a narrower base than this file claims.
> 2. **The fingerprint guard was never reset.** The line below about a guard "this decision knowingly resets once" describes a compromise that turned out to be unnecessary: SQLite renders `uuid` and `text` identically, so the generated migration did not change at all.

## Context

> ⚠️ Premise note: this decision reverses a recorded one. Spec [0001](../0001-stack-architecture/index.md) chose Supabase Auth, and spec [0002](../0002-data-model/index.md) built its entire isolation model on it: `user_id uuid references auth.users(id) on delete cascade` on six tables, policies reading `(select auth.uid())`, and account deletion happening by foreign key cascade. Choosing Clerk breaks all three, because a Clerk identifier is a string like `user_2abc`, not a UUID, and `auth.uid()` returns nothing for it. The engineer was shown this cost, including the lost delete cascade, and chose Clerk anyway. That is a defensible call and this spec records it as one, but it is a reversal and not an addition.

CalSnap needs accounts for one reason above the others: a food diary that dies with the phone is not worth keeping. Every other requirement follows from that. The session has to survive closing the app, or people sign in daily and stop. Signing in on a new phone has to bring the whole history, or the promise is not kept. And because this is health data on what is often a shared or family phone, signing out has to genuinely remove the record from the device.

Three forces shaped the choice.

**The phone is the whole product.** There is no web target. Whatever handles identity has to be excellent on iOS and Android specifically: native Google and Apple sheets rather than a browser redirect, secure hardware backed token storage, and refresh that works when someone opens the app after four days offline. This is where the mobile SDKs differ most from each other, and it is the dimension a web centric evaluation would miss.

**Isolation is already load bearing and already built.** Spec 0002 deliberately pushed per user isolation down into Postgres rather than trusting application code, and pushed it down again on the phone by giving each account its own SQLite file. Both mechanisms are written, tested, and applied. Anything chosen here has to preserve them, because a health app where one person can read another's diary is not a bug, it is the end of the product.

**Timing.** The Postgres schema is applied and live but holds zero rows across all six tables, and there are zero auth users. Nothing has ever been installed on a real phone. This is the last moment when changing the identity column costs an afternoon rather than a migration of real diaries, and that window closes at the first real user.

The cost of not deciding is that feature 5 blocks features 6 through 10, and the unbuilt half of feature 3 (sync, account deletion, the retention sweep) was explicitly parked until this decision landed.

## Options considered

### Option 1: Supabase Auth, as spec 0001 recorded

Keep identity in the same platform as the database. `auth.uid()`, the cascades, and the policies all stand exactly as built.

**Pros**

- Zero change to a schema that is already applied and tested. Nothing to redo.
- Account deletion is free and correct: one cascade from `auth.users` removes the whole diary, which is what AC-10 of spec 0002 already promises.
- One vendor, one bill, one status page, one set of docs.

**Cons**

- The Expo story is thinner. Native Google and Apple sign in need more assembly, and secure token storage and refresh are more your problem than Clerk's.
- Sign in methods are more code and less configuration, so adding passkeys or changing methods later costs real work.

### Option 2: Clerk for identity, Supabase third party auth, text identifiers (chosen)

Clerk issues the tokens. Supabase verifies them against Clerk's published keys and keeps enforcing policies itself, with `user_id` as `text` and policies reading the `sub` claim.

**Pros**

- The strongest Expo integration available. `@clerk/expo` gives native Google and Apple flows, a token cache backed by the iOS Keychain and the Android Keystore, and refresh handled for you.
- Sign in methods become dashboard configuration. Passkeys, more social providers, or multi factor later are largely a toggle.
- Isolation is unchanged in kind. Postgres still enforces it, still without a join, still with the same index on every table.
- Six Clerk skills are already installed in this repo, so the build has authoritative conventions to follow rather than guesswork.

**Cons**

- It reverses spec 0001 and forces a schema change to spec 0002's applied migration.
- Account deletion stops being automatic. The cascade is gone and a webhook has to replace it, which is strictly more code and one more thing that can silently stop working.
- `auth.uid()` becomes a silent trap: any future policy copied from a Supabase example matches nothing rather than erroring.
- Two vendors and two meters instead of one.

### Option 3: Clerk, but keep `uuid` by mapping through a users table

A `users` table maps the Clerk identifier to an internal UUID, and every policy joins through it. Every existing column stays as it is.

**Pros**

- No column type change anywhere. Day scoped identifier maths and every index survive untouched.
- An internal identifier that survives changing auth vendor again later.

**Cons**

- Every policy on every table now needs a join, which is precisely what spec 0002 designed against. `meal_items` was given its own `user_id` specifically so no policy would need one.
- Slower on every read, on a database where every query touches a policy.
- More machinery than the thing it avoids: a table, a lookup on every write, and a new failure mode when the mapping row is missing.

## Rationale

Clerk was the engineer's call, made with the full cost on the table, so the job here is to make it correctly rather than to relitigate it. It is also a reasonable call on the merits. The phone is the whole product, and that is exactly where Clerk's advantage sits: native Google and Apple sheets, Keychain and Keystore backed token storage, and refresh handled for you are not conveniences on a mobile only app, they are most of the work. Option 1 remains the more conservative choice and would have been the recommendation on a blank sheet, purely because keeping identity and data in one platform buys the delete cascade and one vendor instead of two. But the difference is not large enough to override a considered preference, and the timing makes it cheap.

Timing is what turns this from a risky reversal into a routine one. Every table is empty, no phone has run a migration, and spec 0002's generate both databases from one declaration design means the whole change is four edits and a regeneration. Every month that passes makes this more expensive, and the first real user makes it a data migration. If Clerk is what you want, now is the only sensible time.

Option 3 was rejected because it fights the design it claims to protect. Spec 0002 gave `meal_items` its own `user_id` column, duplicating information that `meal_id` already implied, for the express purpose of keeping joins out of policies. Adding a mapping table puts a join back into every policy on every table, paying a permanent read cost to avoid a one afternoon column change on empty tables. That is the wrong trade in both directions.

The one place this decision genuinely loses something is deletion, and it should be named plainly rather than softened. Spec 0002's AC-10 rests on a foreign key cascade that no longer exists. A webhook is a real replacement, but it is code that can fail quietly, and it is not built yet. Choosing to build it in feature 10 rather than here is the right sequencing, because feature 10 owns the deletion path end to end and splitting it would mean two half implementations. Until then, the gap is real and is written into Consequences and Follow-up rather than left to be found later.

One part of this spec was rewritten after an independent cross check, and it is worth recording why rather than leaving the result looking obvious. The first draft let someone sign out with unpushed meals and keep the file, to be drained "on the next sign in". That quietly broke the promise the feature exists to make. Spec 0002 removes the file on sign out specifically for the shared or family phone, where otherwise a full health record sits on disk after someone stops using it. On exactly that phone there is no next sign in: the person hands it back and never signs in again, so the file stays forever. The fix is the `draining` state. The phone behaves as signed out at once, the Clerk token is kept for pushing and nothing else, and a seven day ceiling removes the file regardless. It costs a small amount of machinery to keep a guarantee that was otherwise untrue in precisely the case it was written for.

On the smaller calls. Custom sign in flows over Clerk's prebuilt `AuthView` follows from the project having just spent a whole feature (spec 0003) building a design system with lint rules that fail the build on a screen not assembled from it. A vendor rendered screen would be both the first screen a person sees and the only screen in the app that does not look like CalSnap. Holding the splash until Clerk answers extends a pattern `src/app/_layout.tsx` already uses for fonts and the database, and avoids the sign in screen flashing at a signed in person, which is the classic tell of a badly wired auth SDK. Waiting on a restoring screen for the first sync, rather than entering with an empty diary that fills in, follows the project rule that a health number is never shown as fact when it is not one: a zero calorie day that later becomes 1,800 is a wrong number on screen, briefly, and people act on these numbers.

## References

**Project sources** (verifiable, in this repo)

- `AGENTS.md`: the stack, the folder by feature rule, expected failures returning a result rather than throwing, and configuration validated at startup.
- Spec [0001](../0001-stack-architecture/index.md): records Supabase Auth as the mechanism, and explicitly leaves the sign in methods to this feature. This spec reverses the first half of that row.
- Spec [0002](../0002-data-model/index.md): the security model, the sync push and pull contract, the per user database file, and the deletion path this decision changes.
- Spec [0003](../0003-design-system-ui-foundation/index.md) and `docs/design/design.md`: the component set and contrast rules the sign in screen is built from.
- `src/data/schema/types.ts`, `to-postgres.ts`, `src/data/local/database-file.ts`: the four places the identity change actually lands.
- `src/data/AGENTS.md`: the never edit a shipped declaration rule, and its fingerprint guard. This decision expected to reset that guard once; in the event it did not have to, and the guard is untouched. See the amendment note at the top.
- The installed `clerk-expo` skill (`.agents/skills/clerk-expo/`): the current method based hooks, the token cache rule, the bot protection mount point, and the development build requirement for native sign in.
- The live Supabase project `Cal Snap`: confirmed zero rows across all six tables and zero auth users on 9 August 2026, which is the fact the timing argument rests on.

**Practices and standards**

- Row level security enforced in the database rather than in application code.
- Secure hardware backed credential storage on mobile: iOS Keychain, Android Keystore.
- Provider tokens verified by signature against published keys, never trusted from the client.
- Debounced write behind sync, so a burst of local writes is one network call.
- Idempotent webhook handling for account deletion, since delivery is at least once.
- Honest failure states: a health number is never displayed as settled while it is still loading.

**Links** (checked on 9 August 2026)

- Supabase docs, Clerk as a third party auth provider: https://supabase.com/docs/guides/auth/third-party/clerk
- Clerk docs, integrating with Supabase: https://clerk.com/docs/guides/development/integrations/databases/supabase
- Clerk Expo quickstart: https://clerk.com/docs/expo/getting-started/quickstart
- Expo docs, using Clerk: https://docs.expo.dev/guides/using-clerk/
- Clerk, compatibility with recent Expo SDKs: https://clerk.com/articles/clerk-compatibility-in-expo-54-and-55

The claim that `auth.uid()` does not work with Clerk, and that the supported pattern is a `text` column compared against `auth.jwt() ->> 'sub'`, comes from the first two links above. It is the single load bearing external fact in this spec and is worth checking yourself before the build starts.

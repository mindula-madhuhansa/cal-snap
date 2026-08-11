# Account and session

## Overview

Who the person is, and everything that follows from it: signing in, holding the session, opening
the right diary, syncing it, and taking it off the phone again on the way out. Clerk owns accounts
and sessions. Supabase Postgres stays the database and still enforces isolation itself, but it now
validates a Clerk issued token instead of its own.

Two rules shape almost every file here. **Identity comes from the token, never from the device**:
a `user_id` is always the Clerk session's `sub` claim, never typed, derived, or remembered. And
**the decisions are split from the effects**: the pure rule files (`drain-rules.ts`, `routing.ts`,
`session-end.ts`, `sync-marker-label.ts`, and `@/data/local/database-name.ts`) hold the judgements
worth testing, and the `.tsx` providers and the store files hold the side effects. The suite runs
under plain Node, so a rule that lives in a `.tsx` file cannot be tested at all.

## Key files

| File                    | Owns                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `session.tsx`           | The session state machine, the strict startup sequence, and four contexts                     |
| `use-sign-in-or-up.ts`  | The combined door: one email field decides sign in or sign up, then password or code          |
| `error-messages.ts`     | Every provider failure mapped to a written sentence. Pure                                     |
| `session-end.ts`        | Whether a sync failure means the session ended, and what to say. Pure                         |
| `routing.ts`            | Where a signed in person lands, including when the profile pull failed. Pure                  |
| `sync.tsx`              | When sync runs: sign in, foreground, three seconds after the last write. Also the drain retry |
| `sync-marker.tsx`       | The quiet marker on a screen whose numbers may still change                                   |
| `sync-marker-label.ts`  | What that marker says, seen and spoken. Pure                                                  |
| `supabase.ts`           | The client factory, which never exists without a token source attached                        |
| `supabase-transport.ts` | The only file that knows what Supabase is, adapting it to the sync port                       |
| `sign-out.ts`           | `signOutSafely` (push, then remove) and `resumeDraining` (finish it later)                    |
| `drain-rules.ts`        | The sign out and draining decisions, including the seven day ceiling. Pure                    |
| `draining.ts`           | The draining record in the secure store, outside the database file                            |

## Conventions

- **Never write a `user_id` from anything but the Clerk session.** `useAuth().userId`, or the
  `sub` claim server side. There is no path in this app that writes a row for another identity.
- **The Supabase client is never built without `accessToken`.** Use `createSupabaseClient` and
  pass Clerk's `getToken`. A client without it still sends requests, and they come back empty
  rather than refused, which reads as a bug and hides a security hole.
- **Pass `getToken` through a ref, never as an effect dependency.** Clerk returns a fresh function
  on every render, so depending on it directly is an infinite loop: effect sets state, state
  renders, render makes a new function. `session.tsx` and `sync.tsx` both carry the comment.
- **Expected failures return a result value.** Nothing here throws for a phone with no signal.
- **No provider string ever reaches a screen.** Everything goes through `failureMessage` or
  `syncFailureMessage`. An unmapped code is reported with `devWarn`, which is development only, so
  no token and no health value can reach a release log.
- **A new pure rule goes in its own `.ts` file with its test beside it**, matching how the design
  system splits its decision logic. Tests carry `covers: AC-N` back to spec 0004.
- Screens still build only from `@/design-system/components`; this folder holds no screens, only
  the providers and rules behind them.

## Gotchas

- **Startup is a sequence, not a race**, and implementing it as parallel flags fails silently: the
  app opens no file, or the wrong one, and nobody sees an error. Fonts may load alongside.
  Everything else is strict: Clerk answers, then the file opens for that identifier, then the
  `profiles` row is pulled, then routing happens once. Each step needs the one before it.
- **Route from the pulled `profiles` row, never the local one**, or a person who onboarded on
  another phone is marched through onboarding again and overwrites the target they already have.
  When the pull fails, the local row is the fallback and the app says it is offline.
- **The destination is decided once per launch, so a screen that changes it has to say so.** Setup
  finishing is the only case today: `useOnboardingHandover` moves a `ready` state's destination from
  onboarding to today, and nothing else. It deliberately does not re-run the startup sequence,
  because the profile it would pull is the one this device just wrote. The screen must also
  navigate afterwards; see [src/app/AGENTS.md](../app/AGENTS.md) for why both halves are needed.
- **`draining` is a signed out state that still holds a Clerk session.** That is the one place the
  app and Clerk disagree on purpose. The session exists to push the owed rows and for nothing
  else, and it ends the moment they land. No screen may read that account's file while it drains.
- **Two different counts of unpushed work exist deliberately.** `countPendingMeals` is what a
  person is told (distinct dirty meals, so one meal with four items is "1 meal"), and
  `countPendingPushes` is what the code gates removing the file on (dirty rows across all six
  tables). Neither is redundant.
- **A session ending never deletes local data.** Only a successful push, or the draining deadline,
  removes a file. `endsSession` is deliberately narrow: only a refused token, never `offline` and
  never `rejected`, or a phone in a tunnel throws people back to the door.
- **`@clerk/expo` version 4 is not symmetrical.** Sign in has an `emailCode` namespace
  (`signIn.emailCode.sendCode()`); sign up does not (`signUp.verifications.sendEmailCode()`). The
  legacy `create` plus `prepareFirstFactor` plus `setActive` pattern lives at `@clerk/expo/legacy`
  and is not used here.
- **This feature cannot run in Expo Go**, only on a development build. `@clerk/expo` and its
  Keychain backed token cache are native code.
- Clerk's bot protection needs a raw `View` with `nativeID="clerk-captcha"`, which ESLint forbids
  inside `src/app/**`. It is exposed as `CaptchaMount` in the design system rather than by
  weakening the rule.

## Dashboard prerequisites

Code alone does not make this work. All of these are settings, and each fails in its own way:

- Clerk: the Native API enabled, email as the identifier with both password and email code
  strategies, and the password attribute set to **optional**. Clerk defaults it to required, which
  contradicts the sign up flow directly: the person sees their email verified and then a failure
  they cannot act on.
- Clerk: the Supabase integration activated, which is what puts `"role": "authenticated"` on the
  session token. Activating it is the whole of that claim; do not add it by hand.
- Supabase: Clerk registered as a third party auth provider (Authentication, then Sign In and
  Providers, then add Clerk and paste the Clerk domain the integration reveals). Without it every
  Supabase request is refused, the startup profile pull falls back to the local row, and sync cannot
  work at all.
- **Both of the above are done for the development instance and were confirmed end to end on a
  device on 11 August 2026.** They are per instance settings, so **production needs them again**
  before release.
- Do **not** create a Clerk JWT template named `supabase`. Clerk deprecated that route on 1 April
  2025 and the native provider above replaces it. `.agents/skills/clerk-cli/references/recipes.md`
  still shows the old way; it is wrong for this project.

## Agent skills

- [clerk-expo](../../.agents/skills/clerk-expo/): `clerk/skills`, Clerk in Expo and React Native,
  the custom sign in and sign up flows, and protected routes.
- [clerk-custom-ui](../../.agents/skills/clerk-custom-ui/): `clerk/skills`, custom auth flows built
  on Clerk's hooks rather than its prebuilt components.
- [clerk-setup](../../.agents/skills/clerk-setup/): `clerk/skills`, adding Clerk to a project and
  the dashboard configuration behind it.
- [clerk-webhooks](../../.agents/skills/clerk-webhooks/): `clerk/skills`, verifying and handling
  Clerk events. Needed when scope feature 10 builds the `user.deleted` webhook.
- [clerk-cli](../../.agents/skills/clerk-cli/) and
  [clerk-backend-api](../../.agents/skills/clerk-backend-api/): `clerk/skills`, managing users,
  sessions, and instance settings from the command line or the Backend API.
- [supabase](../../.agents/skills/supabase/): `supabase/agent-skills`, the client, third party
  auth, and edge functions.

MCP servers: Supabase (connected; the live project is `Cal Snap`).

## Related specs

- [0004. Account and sign in](../../docs/specs/0004-account-and-sign-in/index.md), the source of
  truth for everything here. Its `verify.md` records what is proven and what is still owed.
- [0002. Core data model](../../docs/specs/0002-data-model/index.md), which this feature amended:
  `user_id` is `text` holding the Clerk identifier, and every policy reads `auth.jwt() ->> 'sub'`.

_Drafted by /sync from the introducing change, worth a quick human pass._

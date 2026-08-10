# 0001. Stack and architecture for CalSnap

**Date**: 2026-08-08
**Status**: Accepted
**Amended**: 2026-08-10, for identity only. Spec [0004](../0004-account-and-sign-in/index.md) chose Clerk over Supabase Auth, which reverses the Auth row below and changes which public keys ship. The amended lines are marked. Nothing else in this stack decision moved, and the amendment does not reopen it.

## Summary

CalSnap is built as a single Expo and React Native app in TypeScript, shipping to both iOS and Android from one codebase. The phone keeps its own copy of the diary in SQLite so every screen is instant, and pushes changes up to Supabase in the background so the data survives a new phone. Food photos are read by Claude Sonnet 5 through a small server side function, never from the app itself, so the API key cannot be pulled out of the installed app. The first build is the whole design running locally with no backend and no paid AI calls, and each of those pieces is wired in afterwards without rewriting screens.

## Requirements

These are light acceptance criteria derived from the chosen stack. They describe what the scaffold must prove, not what the product must do.

**User story**: as the engineer, I want a project that boots on both platforms with the real conventions in place, so that every later feature is built on real structure rather than guesses.

**Acceptance criteria**:

- **AC-1**: `npx expo start` runs the app on an iOS simulator and an Android emulator from a single codebase.
- **AC-2**: TypeScript runs in strict mode and the typecheck passes on an empty project.
- **AC-3**: Routing is file based, and adding a file under the tabs directory adds a tab.
- **AC-4**: The Classical design tokens from `docs/design/classical.css` exist as a typed theme module at `src/design-system/theme.ts`, and a sample screen built only from theme values renders with the correct fonts, colours, and spacing. This spec owns the raw tokens only; the components built from them are scope feature 4's job, not this one's.
- **AC-5**: A local SQLite database opens, migrates, and survives an app restart.
- **AC-6**: Lint, format, and typecheck run clean, and run automatically before a commit.
- **AC-7**: A push to GitHub runs lint, typecheck, and tests.
- **AC-7b**: Required configuration is parsed and validated once at startup and fails loudly when a value is missing, rather than failing later and mysteriously.
- **AC-8**: No secret of any kind is present in the app bundle or in the repository. The Supabase project URL, the Supabase publishable key, and the Clerk publishable key are not secrets and may ship; the Anthropic API key may not. _(Amended 10 August 2026: this originally named the Supabase anonymous key. Spec 0004 replaced it with the `sb_publishable_` key, which rotates on its own rather than with the project's whole JWT secret, and added the Clerk key. The criterion is unchanged in substance: what ships is a public identifier, and what protects the data is row level security.)_

## Decision

**Chosen option**: a managed Expo app with a local first SQLite store and a Supabase backend, with AI vision behind a server side function.

**Implementation skills**: `expo-native-ui` (`expo/skills`, `.claude/skills/expo-native-ui/`) · `eas-app-stores` (`expo/skills`, `.claude/skills/eas-app-stores/`) · `expo-dev-client` (`expo/skills`, `.claude/skills/expo-dev-client/`) · `expo-data-fetching` (`expo/skills`, `.claude/skills/expo-data-fetching/`) · `expo-upgrade` (`expo/skills`, `.claude/skills/expo-upgrade/`) · `supabase` (`supabase/agent-skills`, `.claude/skills/supabase/`) · `supabase-postgres-best-practices` (`supabase/agent-skills`, `.claude/skills/supabase-postgres-best-practices/`) · `expo-react-native-performance` (installed at user level, in the agent's own skills directory)

## Proposed stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Expo (SDK 56) with React Native 0.85, TypeScript strict | New Architecture is mandatory from SDK 55 onward, so there is no legacy mode to opt into |
| Routing | Expo Router | File based; the five tabs are a directory |
| Styling | A typed theme module plus React Native `StyleSheet` | Ported from `docs/design/classical.css`; no styling library |
| Fonts | `expo-font` with Cormorant Garamond and Lora | Both are on Google Fonts, as the design's own import shows |
| Drawing | `react-native-svg` | The design needs it for the calorie ring, the weight line, and the weekly bars |
| Motion | `react-native-reanimated` | Ships with Expo; the ring and the macro bars animate |
| Camera | `expo-camera` | |
| Screen state | Zustand | Small, plain functions, no boilerplate, fits the functional standard in `AGENTS.md` |
| Local data | `expo-sqlite` | Real tables, because history and weight trends are queries, not blobs |
| Backend | Supabase | Postgres, storage, and edge functions. **Amended 10 August 2026**: auth is no longer Supabase's, see the Auth row |
| Sync | Hand written background push and pull | Write local first, reconcile on launch and on foreground |
| Auth | **Clerk** (amended 10 August 2026; was Supabase Auth) | Spec [0004](../0004-account-and-sign-in/index.md) reversed this row during feature 5. Supabase Postgres still enforces isolation itself, but it validates a Clerk issued token, so every `user_id` column is `text` holding the Clerk identifier and every policy reads `auth.jwt() ->> 'sub'` rather than `auth.uid()`. Which sign in methods to offer was and remains feature 5's decision; it landed on email only |
| AI vision | Claude Sonnet 5 (`claude-sonnet-5`) via a Supabase edge function | Structured outputs return the exact JSON shape; roughly one cent per scan, derived below |
| Build and release | EAS Build, EAS Submit, EAS Update | Over the air updates for JavaScript only fixes |
| Continuous integration | GitHub Actions | Lint, typecheck, and test on push |
| Analytics and error monitoring | None | Explicitly de-scoped on 8 August 2026; scope feature 11 is `dropped` |

**Scaffold decisions.** These are the choices a person would otherwise have to invent on day one. They are settled here so `/develop` does not stop to ask.

| Choice | Value |
|---|---|
| Package manager | `npm` (Expo's own default; no second lockfile format to reason about) |
| Node version | 22 LTS, pinned in `.nvmrc` and in `engines` |
| Lint and format | ESLint with `eslint-config-expo`, plus Prettier. `npx expo lint` works with no extra wiring |
| Checks before commit | `husky` running `lint-staged` over lint, format, and `tsc --noEmit` |
| Test runner | Jest with the `jest-expo` preset. `/test` sets up the suite; this spec only fixes which runner |
| SQLite migrations | Numbered `.sql` files applied in order against `PRAGMA user_version`. No ORM and no migration library |
| Configuration | `EXPO_PUBLIC_` variables read through `app.config.ts`, parsed and validated once at startup with Zod, failing loudly on a missing value, as `AGENTS.md` requires |
| App identifier | `com.calsnap.app` on both platforms |
| Theme module | `src/design-system/theme.ts`, exporting typed `colors`, `space`, `radii`, `type`, and `fonts` objects read from the token set in `docs/design/classical.css` |

**Cost per scan, derived.** One photo at the resolution the design uses is roughly 1,500 input tokens, plus about 500 tokens of system prompt and schema, so about 2,000 input tokens. The JSON result for a four item plate is about 400 output tokens. At Sonnet 5's standard $3 and $15 per million tokens that is `2000 × $3/1M` plus `400 × $15/1M`, which is $0.006 plus $0.006, or about **1.2 cents**. At the introductory $2 and $10 rate running to 31 August 2026 it is about **0.8 cents**. Both figures assume no prompt caching; caching the system prompt and schema would cut the input side substantially once scan volume is real.

**Folder shape**: `folder-by-feature`, as `AGENTS.md` records. Each feature owns its screen, its logic, its types, and its tests in one directory, mirroring the feature list in `docs/scope/scope.md`. Shared theme and primitives live in one design system directory that every feature imports.

**The secret boundary**: the app holds the Supabase project URL, the Supabase publishable key, and the Clerk publishable key. All three are safe to ship, because row level security is what actually protects the data and every policy now requires a valid Clerk token, so the publishable key grants nothing on its own. The Anthropic API key lives only in the edge function's environment. No build of the app ever contains it. _(Amended 10 August 2026: the anonymous key became the publishable key and the Clerk key joined it, per spec 0004. The boundary itself did not move.)_

## Consequences

**What this makes easy.** The design ports almost mechanically, because it is already React shaped state and props. The first build target, the whole design running on local state, needs only the top half of this stack, so you get the app in your hand without paying for a backend or a single AI call. Postgres row level security means the rule "you only see your own diary" is enforced by the database rather than by app code you have to remember to write correctly in every query. EAS Update means a spacing bug found on a real phone can be fixed the same afternoon without a store review.

**What this makes harder.** Hand written sync is the one place this stack trades correctness for simplicity: it is a few hundred lines you fully understand, and it will not handle two phones editing the same day at the same time as gracefully as a real sync engine would. That is an accepted trade for one person and one or two devices, and PowerSync is the named upgrade path if it starts hurting.

**What it costs.** Nothing at all for the first build target. Once scanning is real, roughly one cent per scan at Sonnet 5's current pricing, plus Supabase's free tier until the diary gets large. EAS has a free build tier that a solo project stays inside comfortably.

**What it locks in.** The mobile framework is the expensive decision to reverse; everything below it is replaceable. Supabase can be swapped because the data is plain Postgres. The AI model can be swapped by editing one edge function, which is the main reason the call does not live in the app.

## Follow-up

- The Supabase MCP server is worth connecting once the data model exists, so schema and row level security can be checked against the real project rather than assumed. It is a configuration step in your own MCP settings, which I cannot do for you.
- Two more Expo skills look relevant and were not installed: `expo-router` and `expo-project-structure`. Add them with `npx skills add expo/skills@expo-router -y` if you want them.
- `AGENTS.md` still carries `<to be filled>` in `## Stack` and `## Commands`. `/sync` fills the stack from this spec; `/develop` fills the commands after the scaffold exists.
- The design at `docs/design/` has no sign in screen, no privacy or terms screen, and no account deletion path. Scope features 5 and 10 need design before they can be built.
- The onboarding copy in the design says "Nothing leaves the phone", which contradicts the cloud sync decision. The copy has to change, or the decision does.

## Rationale

See [rationale.md](rationale.md) for the problem framing, the options weighed at each layer, and the reasoning behind each pick.

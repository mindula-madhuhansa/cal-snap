# CalSnap

An AI calorie counter for everyday people losing weight: snap a meal, get its nutrition, see how much of the day is left. iOS and Android, accounts with cloud sync.

## Stack

- **Language / Runtime**: TypeScript strict, Node 22, React 19.2 on React Native 0.85
- **Framework**: Expo SDK 56 (New Architecture), with Expo Router for file based routing
- **Key dependencies**: `expo-sqlite` (the local first store), `zod` (configuration validation), `@expo-google-fonts` (Cormorant Garamond, Lora), `react-native-reanimated`
- **Styling**: a typed theme module plus React Native `StyleSheet`. No styling library, one light theme, no web target
- **Package manager**: npm
- **Decided but not wired yet**: Supabase (Postgres, auth, edge functions), Claude Sonnet 5 for the vision scan behind an edge function, EAS for build and release

Mirrors spec [0001](docs/specs/0001-stack-architecture/index.md), which is the source of truth for this section.

## Build approach

**Skateboard**: ship the smallest complete app a real person would use, then grow it, shippable at every release.

## Commands

Node 22 (see `.nvmrc`), npm, run from the repo root.

| Command             | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm install`       | Install dependencies                        |
| `npm start`         | Start the Expo dev server                   |
| `npm run ios`       | Start it and open an iOS simulator          |
| `npm run android`   | Start it and open an Android emulator       |
| `npm run lint`      | ESLint over the repo (`eslint .`)           |
| `npm run format`    | Check formatting (`format:write` to fix it) |
| `npm run typecheck` | `tsc --noEmit`                              |
| `npx expo-doctor`   | Check dependencies match the SDK            |

Lint, format, and typecheck also run automatically before every commit, and on
every push through GitHub Actions.

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`. The feature scope lives in `docs/scope/scope.md`.

## Rules

- Functions are pure by default: same input gives the same output, no side effects. The calorie target, portion rescaling, and day totals are pure functions that run without a phone.
- Data is immutable. Never mutate in place. Module level values are constants only, and there is no shared mutable state.
- Side effects (network, storage, camera, notifications) are pushed to the edges and kept explicit. Prefer composing functions over inheritance, and a plain function over a class.
- Expected failures return an explicit result value rather than throwing. Exceptions are for genuinely unexpected conditions. Every failure the user can hit says something honest on screen.
- Types are strict. No escape hatches, no untyped values, every case handled. Avoid null; use an explicit optional type.
- Files are organised `folder-by-feature`: a feature's screen, logic, types, and tests live together in one folder, mirroring the features in `docs/scope/scope.md`.
- Named exports only, no default exports, and one consistent naming convention for files, components, and functions. Two exceptions, both required by the framework and both encoded in `eslint.config.js`: Expo Router route files under `src/app/`, and `app.config.ts`.
- Required configuration is validated at startup and fails loudly, never silently mid scan.
- Accessibility baseline is WCAG AA on every screen: contrast, touch target size, screen reader labels, and respecting the system font size setting.
- Health numbers are shown to people who act on them. When a value is uncertain, say so rather than presenting a guess as fact.

## Tooling

Installed and running.

- Lint: ESLint 9 flat config (`eslint.config.js`), `eslint-config-expo` plus the `## Rules` above turned into checks: no default exports, no `any`, no `@ts-ignore` or `@ts-nocheck`, no non null assertions, no parameter mutation, prefer `const`.
- Format: Prettier (`.prettierrc`), last in the ESLint chain so formatting is its job alone.
- Types: `tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`. Import from `src/` through the `@/*` alias.
- Checks before commit: husky runs `lint-staged` (ESLint then Prettier on staged files), then `npm run typecheck`.
- Testing: Vitest, chosen and recorded in `test-preferences.json`. No suite exists yet; `/test` sets one up with the first real feature.
- Continuous integration: `.github/workflows/ci.yml` runs lint, format, typecheck, and test on every push and pull request.

## Git

- integration: on
- branch prefix: `feat/`
- commit: per-milestone

Pushing and opening a pull request always confirm with the engineer first.

## Agent skills

Installed in `.agents/skills/` (mirrored to `.claude/skills/`), pinned in `skills-lock.json`. Load only the ones a task needs.

- [expo-native-ui](.agents/skills/expo-native-ui/): `expo/skills`, native feeling Expo screens, controls, media, animation, and layout.
- [expo-data-fetching](.agents/skills/expo-data-fetching/): `expo/skills`, network requests, caching, offline behaviour, and Expo Router loaders.
- [expo-dev-client](.agents/skills/expo-dev-client/): `expo/skills`, building and distributing a development client for testing on a real phone.
- [expo-upgrade](.agents/skills/expo-upgrade/): `expo/skills`, Expo SDK upgrades and dependency fixes.
- [eas-app-stores](.agents/skills/eas-app-stores/): `expo/skills`, EAS build and submit, TestFlight, and store metadata. A paid service.
- [supabase](.agents/skills/supabase/): `supabase/agent-skills`, Supabase database, auth, edge functions, storage, and the client libraries.
- [supabase-postgres-best-practices](.agents/skills/supabase-postgres-best-practices/): `supabase/agent-skills`, Postgres schema, migrations, row level security, and query performance.
- `expo-react-native-performance` (installed at user level, in the agent's own skills directory, not in this repo): Expo and React Native performance conventions.

MCP servers: Supabase (recommended, not connected; worth adding once the data model exists).

## Context files

- [src/app/AGENTS.md](src/app/AGENTS.md): the routes, the startup gates, and Expo Router's default export exception.
- [src/db/AGENTS.md](src/db/AGENTS.md): the local SQLite store and the migration rules.
- [src/design-system/AGENTS.md](src/design-system/AGENTS.md): the Classical theme tokens and the fonts.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

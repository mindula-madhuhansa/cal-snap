# CalSnap

An AI calorie counter for everyday people losing weight: snap a meal, get its nutrition, see how much of the day is left. iOS and Android, accounts with cloud sync.

## Stack

- **Language / Runtime**: TypeScript strict, Node 22, React 19.2 on React Native 0.85
- **Framework**: Expo SDK 56 (New Architecture), with Expo Router for file based routing
- **Key dependencies**: `expo-sqlite` (the local first store), `expo-crypto` (device randomness for identifiers), `zod` (configuration validation), `@expo-google-fonts` (Cormorant Garamond, Lora), `react-native-reanimated`, `@expo/vector-icons` (the Feather set, behind the design system's `Icon`), `expo-haptics` (the shared feedback helper)
- **Styling**: a typed theme module plus React Native `StyleSheet`. No styling library, one light theme, no web target
- **Package manager**: npm
- **Partly wired**: Supabase Postgres is live (project `Cal Snap`), with the spec 0002 schema applied and row level security on every table. Supabase auth, edge functions, and sync arrive with scope feature 5. EAS development builds are wired (`eas.json`, `eas-cli`, the project linked in `app.config.ts`'s `extra.eas.projectId`); production builds and store submission are not yet.
- **Decided but not wired yet**: Claude Sonnet 5 for the vision scan behind an edge function

Mirrors spec [0001](docs/specs/0001-stack-architecture/index.md), which is the source of truth for this section.

## Build approach

**Skateboard**: ship the smallest complete app a real person would use, then grow it, shippable at every release.

## Commands

Node 22 (see `.nvmrc`), npm, run from the repo root.

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm install`       | Install dependencies                          |
| `npm start`         | Start the Expo dev server                     |
| `npm run ios`       | Start it and open an iOS simulator            |
| `npm run android`   | Start it and open an Android emulator         |
| `npm run lint`      | ESLint over the repo (`eslint .`)             |
| `npm run format`    | Check formatting (`format:write` to fix it)   |
| `npm run typecheck` | `tsc --noEmit` across three tsconfig projects |
| `npm test`          | Vitest (`test:watch` to watch)                |
| `npx expo-doctor`   | Check dependencies match the SDK              |

`npm run gen:supabase-migration` rewrites `supabase/migrations/` from the schema
declarations. It generates, it does not check, so it is not part of the gate.

`package.json`'s `overrides.eas-cli.typescript` pins `eas-cli`'s own bundled TypeScript to `5.9.2`.
Without it, `eas build`/`eas init` crash reading `app.config.ts`: `eas-cli`'s `@expo/require-utils`
treats TypeScript as an optional peer, and npm's `typescript@latest` is now a `7.x` whose API shape
it cannot fully guard against. This is unrelated to the project's own `typescript@~6.0.3`, which
this override does not touch.

Lint, format, and typecheck run automatically before every commit. GitHub Actions
runs those three plus the test suite on every push and pull request.

## Specs

Stored in `docs/specs/`. Each spec is a folder: `docs/specs/NNNN-title/index.md` for the build spec, `rationale.md` for the reasoning, and `verify.md` once `/develop` emits one. The feature scope lives in `docs/scope/scope.md`.

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
- Types: `tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, and `noUnusedParameters`. Import from `src/` through the `@/*` alias. Three projects: `tsconfig.json` for app source, `scripts/tsconfig.json` and `tsconfig.test.json` for the two that need Node types, which keeps Node globals out of app source.
- Checks before commit: husky runs `lint-staged` (ESLint then Prettier on staged files), then `npm run typecheck`.
- Testing: Vitest (`test-preferences.json`), tests beside the source as `*.test.ts`, shared setup in `test/support/`. A test that pins a spec acceptance criterion carries a `covers: AC-N` comment.
- Continuous integration: `.github/workflows/ci.yml` runs lint, format, typecheck, and test on every push and pull request. `npm test` is the single behavioural gate.

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

MCP servers: Supabase (connected; the live project is `Cal Snap`).

## Context files

- [src/app/AGENTS.md](src/app/AGENTS.md): the routes, the startup gates, and Expo Router's default export exception.
- [src/data/AGENTS.md](src/data/AGENTS.md): the one schema declaration, the two generators, the pure calculations, and the data access layer.
- [src/db/AGENTS.md](src/db/AGENTS.md): the local SQLite store and the migration rules.
- [src/design-system/AGENTS.md](src/design-system/AGENTS.md): the Classical theme tokens and the fonts.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

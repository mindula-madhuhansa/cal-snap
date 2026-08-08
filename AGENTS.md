# CalSnap

An AI calorie counter for everyday people losing weight: snap a meal, get its nutrition, see how much of the day is left. iOS and Android, accounts with cloud sync.

## Stack

`<to be filled>` by the architecture spec. The stack is not decided yet; `/architect stack & architecture` decides it and this section then mirrors that spec. Do not guess a framework, database, auth provider, or AI provider before that spec exists.

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
| `npm run lint`      | ESLint via `expo lint`                      |
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
- Named exports only, no default exports, and one consistent naming convention for files, components, and functions.
- Required configuration is validated at startup and fails loudly, never silently mid scan.
- Accessibility baseline is WCAG AA on every screen: contrast, touch target size, screen reader labels, and respecting the system font size setting.
- Health numbers are shown to people who act on them. When a value is uncertain, say so rather than presenting a guess as fact.

## Tooling

Recorded here, installed by `/develop tooling`. Nothing below is installed yet.

- Lint and format: the standard linter plus formatter for the chosen stack, picked once the stack is decided.
- Checks before commit: lint, format, and typecheck on every commit.
- Testing: unit and integration tests. The runner is set up by `/test`.
- Continuous integration: a basic check on push running lint, typecheck, and tests.

## Git

- integration: on
- branch prefix: `feat/`
- commit: per-milestone

Pushing and opening a pull request always confirm with the engineer first.

## Agent skills

- `expo-react-native-performance` (installed at user level, in the agent's own skills directory, not in this repo): Expo and React Native performance conventions. Only load it if the architecture spec picks that stack.

Tool discovery deferred: the Agent Skills and MCP sweep was postponed because the stack is undecided. Run it again after `/architect stack & architecture`.

## Context files

<!-- Nested AGENTS.md files are listed here as they are created -->

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._

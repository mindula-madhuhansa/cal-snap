# Verify: Stack & architecture · spec 0001 · updated 2026-08-09

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

**Verify run on 9 August 2026, Windows machine, Android emulator.** Every ticked
step below was observed passing in this run, not carried over from the build.
The app was driven on a fresh `calsnap_verify` AVD (Android 16, API 36) through
Expo Go, on Metro at `exp://192.168.1.5:8081`.

**Second pass, same day.** `npm run format` failed the first time round. The
fix landed in `.prettierrc` and the step now passes, so AC-6 is met. Lint,
format, and typecheck were all re run together and all three exit 0. The fix
touches formatting configuration only, so the on device observations from the
first pass still stand.

**Third pass, same day, closed by the engineer.** Two steps could not be run on
the Windows machine and were handed over:

- **GitHub Actions: green.** The engineer pushed commit `12a595b` (which
  carries the `.prettierrc` fix) and the CI job passed. That closes AC-7, and
  independently confirms AC-6, since CI runs the format check on Linux.
- **A real Android phone: no problems found.** The engineer ran the app through
  Expo Go on their own Android device. This is stronger evidence than the
  emulator for the Android half of AC-1.

**One criterion is still not fully proven.** AC-1 asks for both platforms. No
Apple device has ever run this app: no Mac for a simulator, and the engineer's
phone is Android. What is proven for iOS is that the bundle builds
(`npx expo export --platform ios` succeeds) and that the code is shared, so
there is no known reason it would fail. That is reasonable confidence, not
proof. The honest position is that the iOS boot is untested, and the first
person to run it on an iPhone is doing a real check, not a formality.

An earlier note on this file said no Android SDK was installed. That was wrong.
An SDK is installed at `~/AppData/Local/Android/Sdk`; what was broken was the
`Pixel_7` AVD, which had lost its `config.ini` and `Pixel_7.ini`. A fresh
`calsnap_verify` AVD was created beside it, leaving `Pixel_7` untouched.

## The format failure, and its fix

`npm run format` used to report "Code style issues found in 21 files", which is
every file it checks. The cause was not the formatting of the code:

- git here runs `core.autocrlf=true`, so the working copy has CRLF line endings.
- `.prettierrc` set no `endOfLine`, so Prettier used its default of `lf`.
- Every file therefore failed on line endings alone.

The git index stores LF, so CI on `ubuntu-latest` would very likely have gone
green throughout. This only ever broke Windows working copies, which is the
machine this project is being built on, which is why it went unnoticed.

Worth knowing: the pre-commit hook never caught it. `lint-staged` runs
`prettier --write`, which rewrites and passes regardless, so commits kept
landing while `npm run format` kept failing.

**Fixed** by adding `"endOfLine": "auto"` to `.prettierrc`. Prettier now accepts
whichever line ending the local machine uses, and the check passes.

One loose end worth knowing about. `auto` trusts the working copy, and what
keeps CRLF out of the repository is `core.autocrlf=true`, a per machine git
setting rather than anything committed. A contributor on Windows without it
could commit CRLF and nobody would be warned. A committed `.gitattributes`
holding `* text=auto eol=lf` would settle line endings for everyone from the
repository itself. Not needed while you are the only contributor; worth doing
before a second one arrives.

## UI / manual

- [ ] `npm run ios` → the app boots on an iOS simulator and lands on the Today tab → AC-1 · **still unproven, no Apple device has run this app**
- [x] `npm run android` → the same build boots on an Android emulator → AC-1 · also confirmed on a real Android phone through Expo Go
- [x] Add `src/app/(tabs)/probe.tsx` exporting a screen → a third tab appears without touching any router config; delete the file → the tab goes → AC-3
- [x] On the Today screen, headings render in Cormorant Garamond and body text in Lora, on the warm paper ground `#f3f2f2` with the gold `CalSnap` kicker → AC-4
- [x] Turn the phone's text size up to its largest setting → the Today screen text grows and nothing is clipped or overlapped → AC-4, accessibility baseline
- [x] Today shows `Local database · schema version 1` → AC-5
- [x] Force quit the app and reopen it → still `schema version 1`, boots straight in, no migration runs a second time → AC-5
- [x] Set `EXPO_PUBLIC_APP_ENV=bogus` in `.env.local`, restart → the app stops at startup naming the bad value, rather than failing later → AC-7b
- [x] Unset every `EXPO_PUBLIC_` variable and restart → the app still boots, because `appEnv` has a default → AC-7b

## Commands

- [x] `npm run typecheck` → exits 0 with strict mode on → AC-2
- [x] `npm run lint` → exits 0 → AC-6
- [x] `npm run format` → "All matched files use Prettier code style!" → AC-6
- [x] Stage a badly formatted `.ts` file and commit → the pre-commit hook formats it and runs the typecheck before the commit lands → AC-6
- [x] `npx expo-doctor` → 21/21 checks pass → AC-2
- [x] Push the branch to GitHub → the CI workflow runs lint, format, typecheck, and test, and goes green → AC-7 · green on commit `12a595b`
- [x] `npx expo export --platform ios --platform android` → both bundles build → AC-1
- [x] `grep -rl "sk-ant\|ANTHROPIC_API_KEY\|service_role" <export dir>` → no matches, and `git grep` for the same in the repo → no matches → AC-8

## Acceptance-criteria coverage

- AC-1 · Android met twice, on the emulator and on a real phone; both bundles export · **iOS boot still unproven, no Apple device available**
- AC-2 · met, `npm run typecheck` and `npx expo-doctor` both clean
- AC-3 · met, the tab appeared on adding the file and went on deleting it
- AC-4 · met, fonts, colours, and the largest text size all render correctly
- AC-5 · met, schema version 1 shown and kept across a force quit
- AC-6 · met, lint, format, and typecheck all exit 0, and the pre-commit hook runs them
- AC-7 · met, CI green on commit `12a595b`
- AC-7b · met, both the bad value and the no variables cases behave as specced
- AC-8 · met, nothing in the bundles, nothing real in the repo

## Notes for `/check review`

- `src/app/(tabs)/index.tsx` and the other route files use `export default`,
  which `AGENTS.md` forbids ("named exports only"). Expo Router requires a
  default export for a route, so the rule and the router genuinely conflict.
  Worth writing the exception into `AGENTS.md` rather than leaving every route
  file quietly breaking a stated rule.
- The invalid configuration path throws an uncaught error. In development that
  is the red box seen in this run, which is clear and helpful. In a production
  build the same throw would close the app with nothing on screen, which sits
  awkwardly beside "every failure the user can hit says something honest on
  screen". Configuration is fixed at build time, so it may be fine; worth a
  deliberate decision rather than an accident.
- `app.config.ts` sets no `newArchEnabled`, relying on the SDK 56 default.
  Fine today, worth being explicit about.

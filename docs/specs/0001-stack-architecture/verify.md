# Verify: Stack & architecture · spec 0001 · updated 2026-08-08

_Steps derived from spec 0001 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Everything under **Commands** was already run green during the build, except the
GitHub Actions one. Everything under **UI / manual** needs a simulator or an
emulator and has not been run yet.

## UI / manual

- [ ] `npm run ios` → the app boots on an iOS simulator and lands on the Today tab → AC-1
- [ ] `npm run android` → the same build boots on an Android emulator → AC-1
- [ ] Add `src/app/(tabs)/probe.tsx` exporting a screen → a third tab appears without touching any router config; delete the file → the tab goes → AC-3
- [ ] On the Today screen, headings render in Cormorant Garamond and body text in Lora, on the warm paper ground `#f3f2f2` with the gold `CalSnap` kicker → AC-4
- [ ] Turn the phone's text size up to its largest setting → the Today screen text grows and nothing is clipped or overlapped → AC-4, accessibility baseline
- [ ] Today shows `Local database · schema version 1` → AC-5
- [ ] Force quit the app and reopen it → still `schema version 1`, boots straight in, no migration runs a second time → AC-5
- [ ] Set `EXPO_PUBLIC_APP_ENV=bogus` in `.env.local`, restart → the app stops at startup naming the bad value, rather than failing later → AC-7b
- [ ] Unset every `EXPO_PUBLIC_` variable and restart → the app still boots, because `appEnv` has a default → AC-7b

## Commands

- [ ] `npm run typecheck` → exits 0 with strict mode on → AC-2
- [ ] `npm run lint` → exits 0 → AC-6
- [ ] `npm run format` → "All matched files use Prettier code style!" → AC-6
- [ ] Stage a badly formatted `.ts` file and commit → the pre-commit hook formats it and runs the typecheck before the commit lands → AC-6
- [ ] `npx expo-doctor` → 21/21 checks pass → AC-2
- [ ] Push the branch to GitHub → the CI workflow runs lint, format, typecheck, and test, and goes green → AC-7
- [ ] `npx expo export --platform ios --platform android` → both bundles build → AC-1
- [ ] `grep -rl "sk-ant\|ANTHROPIC_API_KEY\|service_role" <export dir>` → no matches, and `git grep` for the same in the repo → no matches → AC-8

## Acceptance-criteria coverage

- AC-1 · covered by the two boot steps and the export step
- AC-2 · covered by `npm run typecheck` and `npx expo-doctor`
- AC-3 · covered by the add-a-file tab step
- AC-4 · covered by the font and colour step and the text size step
- AC-5 · covered by the schema version step and the force quit step
- AC-6 · covered by lint, format, and the pre-commit step
- AC-7 · covered by the GitHub Actions step
- AC-7b · covered by the bad value step and the no variables step
- AC-8 · covered by the secret scan step

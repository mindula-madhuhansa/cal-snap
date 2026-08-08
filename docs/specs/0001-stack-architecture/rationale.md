# Rationale: stack and architecture for CalSnap

The decision record behind [index.md](index.md). `/develop` skips this file.

## Context

CalSnap is a calorie counter for everyday people losing weight: photograph a meal, get its nutrition, see how much of the day is left. It ships to iOS and Android together, keeps user data in the cloud so it survives a new phone, and is built by one person with no hard deadline and real sensitivity to anything billed per use.

Three forces shape this decision more than anything else.

**A complete visual design already exists.** `docs/design/CalSnap.dc.html` is not a mood board; it is every screen with working state logic, and `classical.css` is a finished token set. The design is quiet and specific: warm paper ground, a single antique gold accent, Cormorant Garamond for every numeral, hairline rules instead of cards. Whatever the stack is, its job is to reproduce that faithfully. A framework that fights the design, or a component library with opinions of its own, costs more than it saves.

**The first build target is deliberately backendless.** The engineer chose to build the whole design running on local device state first, with real calculations and simulated camera and coach responses, before any account, any sync, or any paid AI call exists. So the stack must make that first pass genuinely cheap while not painting the project into a corner on the backend, auth, and vision provider that Release 1 eventually needs. Choices that only pay off after the backend arrives are the wrong shape here.

**The product handles health data about identifiable people, and money leaks per scan.** Row level access control is not a nice to have; it is the thing that stops one user reading another's food diary. And AI vision is billed per image, from an app given away free, so both the model choice and the placement of the API key are cost decisions as much as technical ones.

Not deciding is not an option: `docs/scope/scope.md` puts Stack and architecture at number 1, and no other feature can start until it lands.

## Options considered

### Framework

**Expo with React Native (chosen).** One TypeScript codebase to both stores, with EAS handling builds and signing.

Pros: the design's logic is already React shaped, so porting is mechanical rather than a rewrite; EAS removes the build and certificate work that reliably eats a solo developer's week; over the air updates suit a design led app where small visual fixes matter; the engineer already had the `expo-react-native-performance` skill installed, and seven more official Expo and Supabase skills were available.

Cons: a layer of abstraction over the native platforms, and heavy native work eventually means a development build rather than Expo Go.

**Bare React Native.** Same language and libraries, no Expo layer. Rejected because the control it buys is control over build pipelines and upgrades, which is exactly the work a solo builder least wants, and Expo now supports custom native code anyway.

**Flutter.** Excellent rendering and a genuinely strong camera story. Rejected because Dart means the design's React logic is rewritten rather than ported, and none of the available skills apply.

**Native Swift and Kotlin.** The best possible feel and the deepest platform access, which would matter for the deferred Apple Health and Google Fit work. Rejected as two codebases and roughly two of everything for one person.

### Local data and state

**Zustand plus `expo-sqlite` (chosen).** Zustand for screen state, SQLite for the diary.

Pros: Zustand is small, boilerplate free, and plain functions, which matches the functional and immutable standard recorded in `AGENTS.md`; SQLite gives real tables, which Release 2 (history) and Release 3 (weight trends) need as queries rather than as a full data load; SQLite is also the local half of every sync engine, so nothing is thrown away when the backend arrives.

Cons: schema migrations are now something to manage from day one.

**Zustand plus MMKV.** Faster to write today, and it cannot answer "show me last Tuesday" without loading everything. Rejected on the Release 2 and 3 requirements.

**Legend-State.** State, persistence, and an optional sync layer in one, and very fast. Rejected on ecosystem size: when something goes wrong at 1am, there is less to lean on.

**React Context and AsyncStorage.** No new dependencies. Rejected as prototype grade; it will not carry a real diary.

### Backend

**Supabase (chosen).** Postgres, auth, and edge functions.

Pros: a food diary is genuinely relational (users, profiles, entries, foods, weights) and Postgres models it directly; row level security enforces per user isolation in the database rather than in application code; edge functions provide the server side place the AI key has to live, so no separate service is needed for it; generous free tier; the data is plain Postgres, so leaving is possible.

Cons: edge functions are Deno, a second runtime alongside the app's own.

**Convex.** A reactive backend with TypeScript end to end and the least code to write. Rejected narrowly: the document model makes the history and trend queries clumsier than SQL does, and the escape hatch if the project outgrows it is smaller.

**Firebase.** The most battle tested, with excellent auth and push. Rejected on the same query shape grounds, plus the difficulty of getting data out later.

**A custom API server.** Full control, and it eats the most time before a single screen exists. Rejected on the solo build constraint.

### Sync

**Hand written background push and pull (chosen).** Write to SQLite immediately, reconcile with Supabase on launch and on foreground.

Pros: a few hundred lines fully understood, no extra service, no extra bill, and enough for one person on one or two devices; the app always feels instant, which the design demands of the today screen.

Cons: conflict handling is naive, and two devices editing the same day concurrently will not resolve as gracefully as a real engine would.

**PowerSync on top of Postgres.** The strongest answer to this problem, and of the pluggable sync engines the one with first class offline support. Rejected for now as another service, another cost, and another set of concepts on top of an already large first pass; it is the named upgrade path.

**No local first layer.** Simplest code, and it makes every screen depend on the network, contradicting the design. Rejected.

### AI vision

**Claude Sonnet 5 behind a Supabase edge function (chosen).**

Pros: roughly one cent per scan at current pricing ($3 and $15 per million input and output tokens, with an introductory $2 and $10 running to 31 August 2026), which is affordable to give away; it is the first Sonnet tier model with high resolution vision, at 2576 pixels on the long edge, and resolution is exactly what portion estimation depends on; structured outputs return the precise JSON shape rather than prose to parse; the model can be swapped later by editing one function.

Cons: a server round trip on every scan, and a Deno function to maintain.

**Claude Haiku 4.5.** Half the cost, at $1 and $5 per million tokens. Rejected because the hard part of this task is not naming the food, it is judging how much of it there is, and that is where the cheapest tier is weakest. Worth revisiting as a fallback for simple single item photos.

**Claude Opus 5.** Roughly two cents per scan, and the most capable at reading a messy plate. Rejected as hard to justify per scan for a free app before there are paying users. It is the obvious upgrade once a subscription exists.

**A food specific API such as LogMeal or Passio.** Purpose built recognition with a nutrition database attached, which removes the question of where the numbers come from. Rejected as another vendor in the path with less flexible output; the wider industry has moved image based food logging from specialist providers into general purpose vision models.

**Calling the model directly from the app** was rejected outright, not weighed: an API key shipped inside a mobile binary can be extracted, and someone else spends your money.

## Rationale

The single strongest force here is that the design already exists and is unusually specific. That pushed every UI layer choice toward the option with the fewest opinions of its own: React Native's own `StyleSheet` over a styling framework, a hand written theme module over a component kit, `react-native-svg` for the ring and the charts rather than a charting library. A utility framework such as NativeWind would have meant expressing a bespoke token set as arbitrary values, which is the worst of both worlds. Expo won the framework layer for a related reason: the design is React shaped, so the port is mechanical, and everything the engineer would otherwise spend a week on (signing, builds, store submission) is handled.

The second force is the backendless first pass. It is why the local data layer is a real database rather than a thin persistence shim: SQLite is the piece that spans both worlds, serving the local only build immediately and then becoming the client half of sync unchanged. It is also why sync is hand written rather than PowerSync. Adopting a sync engine before there is anything to sync would mean carrying its concepts through the entire first build for no benefit, and the upgrade path stays open because the local store is already SQLite and the remote store is already Postgres.

The third force is that this app handles health data and pays per scan. Both point at the same architectural line: the app is untrusted. Supabase was chosen partly because row level security puts the isolation rule in the database, where forgetting a `where` clause in app code cannot defeat it, and the edge function exists so that the one genuinely secret credential never ships to a phone. Sonnet 5 rather than Haiku or Opus is the cost and capability balance at that boundary: high resolution vision is the feature that actually determines whether portion estimates are trustworthy, and one cent per scan is a number a free app can absorb while the model choice stays a one line change.

## References

**Project sources**

- `docs/scope/scope.md`, for the build approach (Skateboard), the workflow tier (Beta), and the release ordering.
- `AGENTS.md`, for the coding standards this stack must satisfy: functional and immutable, strict types, `folder-by-feature`, named exports, WCAG AA, configuration validated at startup.
- `docs/design/CalSnap.dc.html` and `docs/design/classical.css`, for the screens, the tokens, and the formulas the design already fixes.

**Practices and standards**

- Local first data: write to the device first and reconcile in the background, so the interface never waits on the network.
- Keep credentials out of client binaries: anything shipped to a device is readable, so a secret belongs behind a server you control.
- Enforce authorisation at the data layer: row level policies hold even when application code forgets.

**Links, web verified on 8 August 2026**

- [React Native's New Architecture, Expo documentation](https://docs.expo.dev/guides/new-architecture/): confirms the New Architecture is always enabled and cannot be disabled from SDK 55 onward.
- [Local first architecture with Expo](https://docs.expo.dev/guides/local-first/): Expo's own guidance on the local first pattern chosen here.
- [PowerSync and Supabase integration guide](https://docs.powersync.com/integrations/supabase/guide): the named upgrade path if hand written sync stops being enough.
- [powersync-js on GitHub](https://github.com/powersync-ja/powersync-js): the React Native client for that path.
- [LogMeal food recognition API](https://logmeal.com/api/nutritional-information/) and [Passio Nutrition AI](https://www.passio.ai/): the food specific alternatives weighed and set aside.

Claude model identifiers and pricing were taken from the bundled `claude-api` reference rather than fetched from the web, and are current as of this spec's date. Verify against the Anthropic models and pricing pages before committing to a per scan cost model.

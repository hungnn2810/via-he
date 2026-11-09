# Codebase Concerns

**Analysis Date:** 2026-11-09

Project: "Vỉa Hè Online" — a fan remaster of VNG's *Hàng Rong*. Node.js + Colyseus server
(`server/`, 4283 lines of TypeScript across 17 files), Unity 6 client (`client/`).

The single dominant concern right now is the state of the working tree: the client's whole
presentation layer has been deleted and nothing is committed. Everything else in this document
is ordinary, long-lived debt by comparison.

---

## Tech Debt

### The client presentation layer is deleted in the working tree and nothing is committed

This is the largest risk in the repo and it is time-sensitive, not architectural.

- Files: `client/Assets/Scripts/Game.cs`, `GameExpansion.cs`, `StreetScene.cs`, `UIBuilder.cs`,
  `Draw.cs`, `Character.cs`, `CharacterCreator.cs`, `PassingBike.cs`, `StreetObject.cs`
  — 9 C# files, **2735 lines**, staged as deleted.
- Also deleted: all **188** sprites under `client/Assets/Resources/Sprites/` plus their `.meta`
  files, and all three manifests — `sprites.txt`, `street_sprites.txt`, `street_wheels.txt`.
- `client/Tools/sprites.js` trimmed from 797 lines to 21 (helpers and the `add()` manifest
  mechanism only), per `docs/client-remaster-plan.md` §9.
- Working tree totals: **400 deletions, 3 modifications, 0 commits.** `git status` shows
  `.planning/`, `docs/` and `tools/dump-protocol.mjs` as untracked.
- Impact: the client cannot build or run. `SpriteLibrary.LoadList` in
  `client/Assets/Scripts/SpriteLibrary.cs:22` will log `Missing Resources/Sprites/sprites.txt`
  (and the same for `street_sprites`) and every `SpriteLibrary.Get` returns `null` silently via
  `SpriteLibrary.cs:43`. `smoke-test-game` cannot reach the login screen.
- Fix approach: commit immediately, in the order `docs/client-remaster-plan.md` itself
  prescribes — specs first on their own, then the delete. The specs that encode the three lost
  contracts (`docs/client/protocol.md`, `world.md`, `sprite-names.md`, `screens.md`, 833 lines
  total) exist but are **untracked**, so the only record of the deleted contracts is also
  uncommitted. One `git checkout .` or a crashed editor loses both the delete and its
  replacement spec.

### The executed route is not the route the plan recommends

`docs/client-remaster-plan.md` §3 offers Route 1 (delete first) and Route 2 (strangler, "Build
the new renderer and UI next to the old one behind one boot flag... The game stays playable the
whole way") and explicitly recommends Route 2. What was executed is Route 1. The plan's own
cost note for Route 1 applies: "every contract has to be re-derived from the server while
nothing runs... Expect a long period with no working build."

The doc also still says "Status: plan only. Nothing has been deleted yet." (`line 9`) — stale as
of this delete, and the document is the hand-off artefact for the rewrite.

Fix approach: either accept Route 1 and update the plan's status line and §3 to record the
decision and why, or restore from HEAD and take the strangler path. Do not leave the plan
describing a world that no longer exists.

### No schema for the message protocol — names and payload keys are hand-synced

`CLAUDE.md` states the contract explicitly: "Message names and payload keys must match between
`server/src/rooms/StreetRoom.ts` and `client/Assets/Scripts/Network.cs` / `Models.cs`." There is
no generated artefact enforcing it. Only the Colyseus *state* schema is generated
(`server/src/schema.ts` → `client/Assets/Scripts/Schema/*.cs` via `npm run schema-cs`); the
messages — 68 of them — are typed by hand on both ends.

`node .claude/skills/verify-protocol/scripts/check-protocol.mjs` run today reports:

```
Server accepts 68 messages and pushes 16. Client has 0 send calls, 2 requests, 7 listeners, 4 HTTP calls.
... 68 notes (server accepts X, no client code sends it)
9 mismatches found.
```

The `0 send calls` is an artefact of the delete. Measured against `HEAD` (the last state in
which the client existed), the real picture is:

| Side | Count | Where |
| --- | --- | --- |
| Server message handlers | 68 | `server/src/rooms/StreetRoom.ts:109`–`:307` |
| Server pushes to client | 16 | same file |
| Client `Send(...)` calls | 50 | `Game.cs` 21, `GameExpansion.cs` 27, `StreetScene.cs` 2 |
| Client listeners | 7 | `Game.cs`, `Network.cs` |

So **18 server features were never reachable from the client**, and **9 server pushes had no
listener**. The 9 unlistened pushes, all still present on the server:

`cafeSeats` (`StreetRoom.ts:125`), `sharedOrderGiven` (`:220`), `season` (`:224`),
`sharedOrderClaimed` (`:226`), `fortune` (`:293`), `fortuneShared` (`:299`), `emote` (`:304`),
`regularSale` (`:717`), `seasonQuestDone` (`:960`).

Impact: whole server subsystems — the wholesale market, seasons, fortune, the café, regulars —
are built, tested and dead. A typo in a message name or a payload key is a silent no-op with no
compile error and no runtime warning on either side.

Fix approach: `tools/dump-protocol.mjs` already derives the full table from the server
(`docs/client/protocol.md` is its output). Promote it from a doc generator to a code generator
that emits the C# message-name constants and payload DTOs, and keep `verify-protocol` as the
regression gate on every wave of the rewrite, as `docs/client-remaster-plan.md` §8 requires.

### Sprite names are built from server data ids at runtime

Names are assembled from server data ids in the scene code: `counter_<product.id>`,
`wear_<wearable.id>`, `deco_<decoration.id>`, `building_<lot.building>`, `crop_<crop>_<stage>`,
`bg_land_<district>`, `vehicle_<vehicle.id>`, plus layered `body_`/`hair_`/`brows_`/`lips_`/
`cheeks_`/`earrings_` + index from `LOOK_OPTIONS`. Renaming a `data.ts` id or an asset produces
no compile error — only `Debug.LogWarning("Missing sprite " + c[0])` at
`SpriteLibrary.cs:30`, or a `null` sprite from `SpriteLibrary.cs:43` with no log at all.

Verified gaps against the manifest at `HEAD`, which listed 188 sprites:

| Missing sprite | Source id | Note |
| --- | --- | --- |
| `counter_soap_bubbles` | `PRODUCTS` in `server/src/data.ts:19` | 18 of 22 products have a counter |
| `counter_pinwheel` | same | |
| `counter_plastic_sandals` | same | |
| `counter_t_shirt` | same | |
| `building_cafe` | `BuildingType` in `server/src/data.ts:92` | `cafe` is a real building type; only `prop_cafe_sign` existed |

Clean: all 10 `WEARABLES`, all 5 `DECORATIONS`, all 4 `bg_land_<0..3>` for the 4 `DISTRICTS`,
and 3 of 3 vehicles (`vehicle_walk` is correctly absent — `walk` means no vehicle). `crop_banana_*`
is absent by design; bananas use the separate `banana_stage_<1..3>` set.

Fix approach: generate `sprites.txt` rows from `server/src/data.ts` rather than hand-maintaining
them, and add a build-time assertion that every id-derived name resolves. The rewrite is the
cheap moment to do this — `docs/client-remaster-plan.md` §5 already warns "**Keep every id.**"

### Balance numbers are partly centralised, partly scattered

`BALANCE` in `server/src/data.ts` holds 59 keys and is the intended single source. Outside it,
`server/src/` still contains 62 bare 4-digit-or-longer numeric literals and 19 raw time
constants (`86_400_000`, `3_600_000`, `1000 * 60`). Day-boundary arithmetic in particular is
re-derived inline in at least four places — `StreetRoom.ts:236`, `StreetRoom.ts:280`,
`profile.ts:366`, `world.ts` — rather than going through `dayIndex()` in `world.ts`, which
exists for exactly that.

Impact: a balance change requires grepping, not editing one table; a timezone or day-rollover
change has four independent sites to find.

Fix approach: move the remaining literals into `BALANCE`, and route every day/week computation
through `dayIndex()` / `weekIndex()`.

### `StreetRoom.ts` is 1011 lines and owns everything

`server/src/rooms/StreetRoom.ts` registers all 68 message handlers, runs the customer
simulation at 10 Hz, owns stall/slot logic, the caro and shuttle minigames, the wedding, and
metadata updates. It imports from 11 other modules. Next largest file is `profile.ts` at 559.

The file is well organised internally (one `handle()` wrapper, `// ---------- Stalls ----------`
section banners) so this is size debt rather than tangle, but it is the file every protocol
change touches and the one most likely to produce merge conflicts between the two AI tools that
`CLAUDE.md` assigns to this repo.

Fix approach: split the message registration by subsystem into `rooms/handlers/*.ts` that take
the room as a parameter, leaving the simulation loop in `StreetRoom.ts`.

### An orphan `node_modules/` sits at the repo root with no `package.json`

`node_modules/` is present at `C:\sources\xom-tro-sinh-vien\node_modules` but there is **no
root `package.json`**. The only manifest is `server/package.json`.

It is **not** committed: `.gitignore:1` has `node_modules/` and `git ls-files | grep -c node_modules`
returns `0`. So the repo is clean — the directory is local-only cruft from an install run in the
wrong directory.

Impact: low. It confuses `npm` commands run from the root and anything that walks the tree.
Fix approach: delete it; run `npm` from `server/`. If root-level tooling is wanted (the repo has
`tools/dump-protocol.mjs` and `tools/sync-skills.mjs`), add a real root `package.json` instead.

---

## Known Bugs

### Banning a player does not revoke their session or token

- Files: `server/src/profile.ts:179-184`, `server/src/index.ts:42`,
  `server/src/rooms/StreetRoom.ts:338-343`
- Symptoms: `POST /admin/ban` sets `profile.banned = true`, but a ban is only checked at
  `/api/login` and at `onAuth` on the *next* join. A banned player already in a room keeps
  playing until they disconnect, and their existing token still authenticates every HTTP route
  (`/api/streets`, `/api/log`, `/api/link`) because `verifyToken` does not consult `banned`.
- Trigger: ban a player who is online.
- Workaround: none in code; restart the server.

### `9` server pushes have no client listener

Covered under tech debt above. Each one is a feature that works end-to-end on the server and
never reaches the player: café seat updates, the shared wholesale order, the season panel, the
daily fortune, emotes and regular-customer sales.

---

## Security Considerations

### Login tokens never expire and carry no nonce

- Files: `server/src/profile.ts:175-184`
- Risk: `signToken(id)` is `` `${id}.${HMAC_SHA256(SECRET, id)}` `` — a pure function of the
  player id. There is no issued-at, no expiry, no version and no per-session component, so a
  token is a permanent bearer credential. It cannot be rotated for one player, cannot be
  revoked, and a leaked token (logs, a shared device, an http proxy) is valid forever.
- Current mitigation: the signing key is 32 random bytes, persisted to
  `server/data/token-secret.txt` or supplied via `TOKEN_SECRET`. Comparison is `===` on the
  whole token string, which is not constant-time but leaks little here.
- Recommendations: add `iat` and a per-profile `tokenVersion` to the signed payload; bump the
  version on ban, on recovery and on social relink. Check `banned` inside `verifyToken`.

### Guest login treats a client-generated device id as the only credential

- Files: `server/src/index.ts:38-45`, `server/src/profile.ts` (`login`)
- Risk: `POST /api/login` accepts `{ deviceId }` (minimum 8 characters, truncated to 64) and
  returns a full token for whatever account that device id maps to. The id is generated and
  stored by the client, so it is a password the server never verified and the user never chose.
  Anyone who learns a device id owns that account. There is no rate limiting, so short or
  low-entropy ids are enumerable.
- Current mitigation: length floor of 8 characters; `express.json({ limit: '16kb' })`.
- Recommendations: require ≥32 characters of client entropy and reject ids that are not
  high-entropy; rate-limit `/api/login` per IP; treat social linking
  (`server/src/social.ts`) as the durable identity and the device id as a convenience only.

### Account recovery is brute-forceable and unthrottled

- Files: `server/src/index.ts:80-87`, `server/src/profile.ts:210`, `:342-351`
- Risk: `newRecoveryCode()` is `randomBytes(5).toString('hex').toUpperCase()` — 40 bits, 10 hex
  characters. `recoverAccount` does `allProfiles().find(p => p.recoveryCode === wanted)`:
  a linear scan over **every** profile with no attempt counter, no lockout and no per-IP limit.
  A matching code immediately re-points the device row (`qClearDevice` + `qMoveDevice`) and
  returns a token — a full account takeover with no second factor and no notification to the
  previous device.
- Current mitigation: 40 bits of entropy is respectable for a single guess; the code is not
  reset after use, which is itself a weakness.
- Recommendations: rate-limit `/api/recover` hard (per IP and globally), index recovery codes
  instead of scanning, rotate the code after a successful recovery, and invalidate the old
  device's token.

### The admin HTML page is served without authentication

- Files: `server/src/index.ts:107`
- Risk: `app.get('/admin', ...)` sends `public/admin.html` to anyone. The data routes behind it
  (`/admin/reports`, `/admin/stats`, `/admin/ban`, `/admin/event`) are gated correctly by
  `isAdmin()` with a `timingSafeEqual` comparison and are disabled entirely when `ADMIN_TOKEN`
  is unset — that part is done well. But serving the page discloses the admin surface, and the
  path is a hard-coded `path.resolve('public/admin.html')` relative to the process cwd, so it
  404s or leaks a stack trace depending on where the server was started.
- Recommendations: put `isAdmin()` on `/admin` too, and resolve the path from the module
  location rather than cwd.

### Chat and reports have no rate limit, and the profanity filter is exact-match

- Files: `server/src/rooms/StreetRoom.ts:41-42` (`BANNED_WORDS`, `filterWords`), `:113-118`
  (`say`), `:275-277` (`report`)
- Risk: `say` is one of only 9 raw `onMessage` handlers (the other 59 go through `handle()`).
  It trims and truncates to 80 characters but has no cooldown, so a client can broadcast at the
  socket's full rate. `filterWords` splits on whitespace and compares whole lowercased words
  against a 15-entry list, so any spacing, punctuation or diacritic substitution passes.
  `report` writes an unbounded row per call with no per-player daily cap.
- Current mitigation: length caps (80 chars for speech, 64/200 for report fields);
  `maxClients = 30` per room.
- Recommendations: per-player cooldown on `say` and a daily cap on `report`; normalise text
  before filtering, or drop the word list and lean on the report queue.

### Environment-gated social providers fail open to "off", which is correct

Worth recording as a positive: `server/src/social.ts` verifies each provider's token against
that provider's endpoint and returns `null` unless the matching credential
(`GOOGLE_CLIENT_ID`, `FACEBOOK_APP_TOKEN`, `ZALO_ENABLED`) is present. Google's check validates
`aud` against the configured client id rather than trusting `sub`. No `.env` file exists in the
repo and no secrets are committed.

---

## Performance Bottlenecks

### Every street room ticks at 10 Hz and rooms are deliberately kept alive

- Files: `server/src/rooms/StreetRoom.ts:318` (`this.setSimulationInterval(..., 100)`),
  `:61` (`autoDispose = false`), `:607-610`
- Problem: each room is one player's street. `autoDispose` is off, and the self-dispose check
  only fires when `this.clients.length === 0 && (stalls.size === 0 || owner.isNpc)`. A room with
  an employee-run stall therefore runs its full simulation forever with nobody connected — which
  is the intended offline-selling feature, but it means concurrent rooms scale with the number of
  players who left a staffed stall open, not with the number of players online.
- Cause: offline progression implemented as a live simulation rather than as computed-on-read
  elapsed time.
- Improvement path: for ownerless rooms, drop the tick to 1 Hz or settle employee sales
  analytically on the next read. Measure rooms-per-process before this matters in production.

### `allProfiles()` is a full-table scan used on hot paths

- Files: `server/src/profile.ts:342-344` (`recoverAccount`), and `/api/streets` →
  `randomStreets` in `server/src/index.ts:47-66`
- Problem: recovery and street listing walk every profile. At a few thousand profiles this is
  invisible; it is O(n) per request on the public, unauthenticated-ish surface.
- Improvement path: SQLite indexes on `recovery_code`, and a `LIMIT`-ed random query for street
  sampling.

### `Resources/` loads the whole sprite folder into the build with no streaming

- Files: `client/Assets/Scripts/SpriteLibrary.cs:16-37`
- Problem: `Resources.Load` on every manifest row means all sprites ship in the build and are
  resident. 188 sprites was fine; `docs/client-remaster-plan.md` §5 targets ~260.
- Improvement path: the plan's own recommendation — Sprite Atlas now, Addressables later, with
  `SpriteLibrary.Get(name)` kept as the only call site so the backing store can change
  underneath. Do this in Wave 1 while the loader has no callers.

---

## Fragile Areas

### `SpriteLibrary` fails silently on every lookup

- Files: `client/Assets/Scripts/SpriteLibrary.cs:43` — `Get` returns `null` for an unknown name
  with no log; only the *manifest row* path warns (`:30`).
- Why fragile: combined with runtime-constructed names (above), a missing or renamed asset
  surfaces as an invisible object in the scene. `Has(name)` exists but call sites are free to
  ignore it.
- Safe modification: log once per distinct missing name in `Get`, and keep `sprites.txt`
  generated.
- Test coverage: none. There is no client test harness at all.

### Module-level mutable maps shared across all rooms

- Files: `server/src/rooms/StreetRoom.ts:37-39` — `online` (player → room + client) and
  `employeesAtWork` (employee → room id)
- Why fragile: process-global state keyed by ids. `onLeave` (`:385-393`) cleans `online`
  defensively (`if (online.get(id)?.client === client)`), and `closeStall` (`:480`) clears
  `employeesAtWork` — but any path that drops a stall without going through `closeStall` leaks
  an entry, and a leaked `employeesAtWork` entry permanently blocks that employee with
  "Nhân viên đang đứng sạp" (`:290`). The maps also make the server single-process by
  construction: horizontal scaling needs them in Redis.
- Safe modification: never write these maps outside `onJoin`/`onLeave`/`closeStall`; add an
  invariant check in the 5-second close check that every `employeesAtWork` entry points at a
  live stall.

### `handle()` rethrows non-`GameError` exceptions out of a Colyseus message callback

- Files: `server/src/rooms/StreetRoom.ts:321-336`
- Why fragile: the wrapper is good design — it loads the profile, catches `GameError` and sends
  `{ text }` back to the client, then marks dirty and resyncs. But `else throw e` sends any
  programming error (a `TypeError` on a malformed payload that slipped past validation) up into
  the transport's callback. There is no `process.on('uncaughtException')` handler; the only
  process-level hooks are the `SIGINT`/`SIGTERM`/`exit` flushes in `server/src/index.ts:144-147`.
- Safe modification: log and send a generic error instead of rethrowing, and add an
  `uncaughtException` handler that calls `flushNow()` before exiting so a crash cannot lose up
  to 2 seconds of profile writes (`profile.ts:304`).

### Input validation lives in the domain functions, not at the message boundary

- Files: `server/src/world.ts:27-31` (`landAt`), `server/src/market.ts:90-97` (`buyWholesale`),
  `server/src/profile.ts:365-375` (`postPlayerOrder`), `server/src/rooms/StreetRoom.ts:431`
- Why this is mostly fine: the checks that exist are genuinely good. `landAt` takes `unknown`
  and demands `Number.isInteger` on both district and index. `buyWholesale` takes `unknown` and
  enforces an integer in `[1, MARKET.maxBuy]`. `postPlayerOrder` bounds quantity to `[1, 50]`
  and price against `retail * quantity * playerOrderMaxPct`. Stall stock clamps with
  `Math.max(1, Math.min(capacity, Math.floor(m.quantity) || 0))`.
- Why fragile anyway: only **2** of the 68 handlers do any coercion themselves; the rest pass
  `m.lot`, `m.quantity`, `m.cell`, `m.employeeId` straight through on trust that the callee
  validates. The handler signatures (`m: { lot: number }`) are TypeScript fiction over untrusted
  socket JSON. A new handler that forwards a number to arithmetic instead of to a validating
  domain function has no guard rail, and nothing in the test suite would catch it.
- Safe modification: validate at the boundary. Give `handle()` an optional payload-shape
  argument, or add `int(m.lot)` / `str(m.id)` coercion helpers that every handler must use.

---

## Scaling Limits

**Single process, in-memory room registry:**
- Current capacity: one Node process; `maxClients = 30` per street room; profiles cached in a
  `Map` in `server/src/profile.ts:186` with a 2-second batched write to SQLite
  (`node:sqlite`, `profile.ts:304-312`).
- Limit: the `online` and `employeesAtWork` module maps (`StreetRoom.ts:37-39`) and the profile
  cache are process-local, so a second instance would disagree about who is online and let an
  employee run two stalls. The SQLite file is also a single-writer store.
- Scaling path: move presence to Redis via Colyseus's presence driver, move the profile cache
  behind a shared store, and migrate SQLite to Postgres before a second process is added.

**Seasonal rollover on a single `setInterval`:**
- `server/src/index.ts:24` — `setInterval(() => rolloverSeason(), 3_600_000).unref()`. Hourly,
  in-process, with no leader election and no catch-up if the process was down over a boundary.

---

## Dependencies at Risk

**`node:sqlite`:**
- Risk: `server/src/profile.ts:3` imports `DatabaseSync` from `node:sqlite`. This is a built-in
  that requires Node 22+, and its API has moved between Node releases. There is no
  `engines` field in `server/package.json` and no `.nvmrc` to pin the runtime.
- Impact: the server fails to start, or fails at a query, on a mismatched Node.
- Migration plan: add `"engines": { "node": ">=22" }` and an `.nvmrc`. `better-sqlite3` is the
  stable escape hatch if the built-in API shifts again.

**`@colyseus/ws-transport` and `@colyseus/sdk` pinned to `0.18.x`:**
- Risk: `@colyseus/core` and `@colyseus/schema` are pinned exactly (`0.18.25`, `5.0.43`) but the
  transport and the client SDK float on `0.18.x`. Colyseus has broken wire compatibility across
  minors before, and the generated C# schema in `client/Assets/Scripts/Schema/` is produced by
  the pinned `schema-codegen` while the Unity-side SDK floats.
- Impact: a fresh `npm install` can pair a floating transport with a pinned core and desync the
  state protocol — which surfaces as corrupt entity state, not a clean error.
- Migration plan: pin all four exactly, and regenerate `Schema/*.cs` whenever any of them moves.

**Express 4:**
- `server/package.json` has `express: ^4.21.2`. Express 5 is current. Not urgent; worth noting
  before the HTTP surface grows.

---

## Missing Critical Features

**A playable client:**
- Problem: see the first entry. There is no renderer, no UI and no art.
- Blocks: everything. `smoke-test-game` cannot run, UAT cannot run, and no gameplay change can
  be verified end-to-end until Wave 2 of `docs/client-remaster-plan.md` lands.

**Client access to 18 server features:**
- Problem: measured at `HEAD`, 18 of the 68 server messages had no caller and 9 of the 16 pushes
  had no listener. The wholesale market, seasons, the fortune draw, the café and regular
  customers are server-complete and player-invisible.
- Blocks: the last three commits (`f07ca7a` diverse goods and season rewards, `5cf937b`
  wholesale market, fortune, incidents, café) shipped gameplay no player can reach. The rewrite
  is the opportunity to close this; `docs/client/screens.md` (487 lines, 28 windows) is the
  checklist.

**A shared design system:**
- Problem: `docs/client-remaster-plan.md` §7 records that colors were hardcoded in both
  `UIBuilder.cs` and `sprites.js`, with no shared source — "That is why nothing can be
  re-themed." Both files are now deleted or gutted, and the replacement (`Theme.cs` +
  `theme.js`) does not exist yet.
- Blocks: generating a coherent ~260-sprite catalog. The plan calls this the highest-leverage
  step; it is Wave 1 and nothing exists.

**Unresolved decisions that block art generation:**
`docs/client-remaster-plan.md` §10 lists four open items: which of the three concepts in
`client/Tools/concept/` is the art direction, portrait-only vs landscape, the `portrait_*` frame
size, and the `CLAUDE.md` division-of-work update. The division-of-work item **is** done — the
uncommitted diff to `CLAUDE.md` and `AGENTS.md` reassigns all client presentation to Claude and
adds an "Art: generate every piece on its own, compose in code" section. The other three are
open, and generating assets before picking a concept is how a 260-sprite catalog stops holding
together.

---

## Test Coverage Gaps

The server test suite is a real strength and should be said plainly: 11 suites under
`server/test/` (`simulation`, `world`, `garden`, `market`, `goods`, `regulars`, `season`,
`fortune`, `incidents`, `cafe`, `dialogues`), each with its own npm script, covering the economy
and every recent subsystem. The gaps are at the edges.

**The entire client:**
- What's not tested: all of it. No C# test assembly, no play-mode tests. The only client check
  is the `smoke-test-game` skill, which launches Unity and screenshots the login screen.
- Files: `client/`
- Risk: with the presentation layer being rewritten from scratch against hand-synced contracts,
  nothing but a human eye will notice a wrong message name, a wrong payload key or a wrong
  depth-sort constant.
- Priority: **High** — at minimum, make `verify-protocol` and `smoke-test-game` a mandatory gate
  on every wave, as `docs/client-remaster-plan.md` §8 already specifies.

**The message layer in `StreetRoom.ts`:**
- What's not tested: no suite exercises the 68 handlers. The tests target the domain modules
  (`world.ts`, `market.ts`, `season.ts`) the handlers call, so the wiring, the `handle()`
  wrapper, `onAuth`, `onJoin`/`onLeave` cleanup and the `online` / `employeesAtWork` maps are
  uncovered.
- Files: `server/src/rooms/StreetRoom.ts` (1011 lines)
- Risk: a leaked `employeesAtWork` entry permanently bricks an employee; a mis-registered
  handler is a silent no-op.
- Priority: **High** — this is the file with the most lines, the most imports and the least
  coverage.

**Authentication and the HTTP surface:**
- What's not tested: `/api/login`, `/api/recover`, `/api/link`, `/api/login/social`, the
  `/admin/*` routes, `signToken`/`verifyToken`, and `recoverAccount`'s device re-pointing.
- Files: `server/src/index.ts`, `server/src/profile.ts:175-184`, `:342-351`,
  `server/src/social.ts`
- Risk: every security concern in this document sits in untested code, including account
  takeover via recovery and the ban bypass.
- Priority: **High**.

**Persistence and migration:**
- What's not tested: the SQLite layer — `migrate()` on load (`profile.ts:267`), the 2-second
  batched flush, and `flushNow()` on `SIGINT`/`SIGTERM`/`exit`.
- Files: `server/src/profile.ts`
- Risk: a `migrate()` bug silently reshapes every stored profile on next boot. Up to 2 seconds
  of writes are lost on an uncaught exception, which nothing currently handles.
- Priority: **Medium**.

---

*Concerns audit: 2026-11-09*

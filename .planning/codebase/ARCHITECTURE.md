<!-- refreshed: 2026-11-09 -->
# Architecture

**Analysis Date:** 2026-11-09

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│          Unity 6 client (C#, namespace ViaHeOnline)          │
│                 `client/Assets/Scripts/`                     │
├──────────────────┬──────────────────┬───────────────────────┤
│   Network        │   Models (DTOs)  │  Generated Schema     │
│ `Network.cs`     │  `Models.cs`     │  `Schema/*.cs`        │
├──────────────────┴──────────────────┴───────────────────────┤
│  Presentation layer — DELETED, to be rebuilt                 │
│  (widget kit, 28 screens, street scene, 188 sprites)         │
│  Contracts preserved in `docs/client/*.md`                   │
│  Surviving helpers: `SpriteLibrary.cs`, `SoundFx.cs`         │
└────────┬───────────────────────────────┬────────────────────┘
         │ WebSocket (Colyseus room)     │ HTTP (login, lists)
         ▼                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Node.js + Colyseus 0.18 server                │
│                        `server/src/`                         │
├──────────────────────────────┬──────────────────────────────┤
│  Transport / HTTP boot       │  Room = one street            │
│  `index.ts`                  │  `rooms/StreetRoom.ts`        │
├──────────────────────────────┴──────────────────────────────┤
│  Synced state  `schema.ts`  ──codegen──▶ client `Schema/`    │
├─────────────────────────────────────────────────────────────┤
│  Rule modules (all game logic, no Colyseus imports)          │
│  `world.ts` `market.ts` `season.ts` `regulars.ts`            │
│  `events.ts` `incidents.ts` `fortune.ts` `cafe.ts`           │
│  `stories.ts` `activities.ts` `dialogues.ts` `social.ts`     │
├─────────────────────────────────────────────────────────────┤
│  Catalog / tuning  `data.ts`   ·  Persistence `profile.ts`    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  SQLite (`node:sqlite`) at `$DATA_DIR/game.db`               │
│  tables: players, linked_accounts, reports, analytics,       │
│  player_orders, votes, community                             │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTTP + transport boot | Express routes (login, streets, log, leaderboard, recover, link, admin), room definition, season rollover timer, flush on shutdown | `server/src/index.ts` |
| StreetRoom | The only room type. Owns the simulation tick, all 68 message handlers, customer AI, stalls, activities, broadcast | `server/src/rooms/StreetRoom.ts` |
| Synced state | `StreetState`, `Player`, `Stall`, `Customer`, `LotState` — the only data pushed by diff | `server/src/schema.ts` |
| Catalog / balance | `PRODUCTS`, `WEARABLES`, `CROPS`, `RECIPES`, `BUILDINGS`, `DISTRICTS`, `VEHICLES`, `PROFESSIONS`, `LOOK_OPTIONS`, `BALANCE` | `server/src/data.ts` |
| Profile store | `Profile` type, SQLite schema + prepared statements, login tokens (HMAC), dirty-set write-behind, XP/level, wardrobe, employees, log, `GameError` | `server/src/profile.ts` |
| Land & progression rules | Planting, watering, harvesting, building, upgrades, cooking, store, professions, vehicles, delivery orders, wages, daily tasks, friends | `server/src/world.ts` |
| Wholesale market | Buying stock, credit/debt, stall stock provenance, refunds, shared orders | `server/src/market.ts` |
| Season | Season goals, tiers, leaderboard | `server/src/season.ts` |
| Regular customers | Recruiting, tiers, wants, second portions | `server/src/regulars.ts` |
| Events / incidents | Street, scheduled and seasonal events; rule merging; random incidents | `server/src/events.ts`, `server/src/incidents.ts` |
| Side systems | Fortune draws, café seats, neighbour quests, shuttlecock/caro minigames, NPC dialogue, social-login verification | `fortune.ts`, `cafe.ts`, `stories.ts`, `activities.ts`, `dialogues.ts`, `social.ts` |
| Client network | Colyseus client, guest login, recover, room join, message routing to C# events, catalog request, server-clock estimate | `client/Assets/Scripts/Network.cs` |
| Client DTOs | Hand-written mirror of every message/HTTP payload (39 classes) | `client/Assets/Scripts/Models.cs` |
| Generated schema | C# mirror of `schema.ts`, produced by `npm run schema-cs`. Never hand-edited | `client/Assets/Scripts/Schema/` |
| Sprite loader | Loads `Resources/Sprites/{sprites,street_sprites}.txt` into `Sprite`s with pivot + 9-slice at PPU 200 | `client/Assets/Scripts/SpriteLibrary.cs` |
| Audio | Sound effects | `client/Assets/Scripts/SoundFx.cs` |
| Art pipeline | Canvas-2D sprite generator and exporter; Unity-side importer | `client/Tools/sprites.js`, `client/Tools/export-*.mjs`, `client/Assets/Editor/SpriteImporter.cs` |
| Protocol dump | Regenerates `docs/client/protocol.md` from the server | `tools/dump-protocol.mjs` |

## Pattern Overview

**Overall:** Authoritative server with state synchronisation — one Colyseus room per street, thin client.

**Key Characteristics:**
- All rules, money and randomness live on the server; the client only sends intents and renders state.
- Two data channels: diff-synced `StreetState` (public, everyone in the room) and a per-client `profile` message (private: money, store, employees, wardrobe, quests).
- Rule modules are pure-ish functions over a `Profile`; `StreetRoom` is the only Colyseus-aware file, which is what makes the rules unit-testable from `server/test/*.ts`.
- `server/src/data.ts` is the single tuning surface — prices, levels and `BALANCE` constants are never hardcoded in rule modules.
- The message protocol has no schema: names and payload keys are kept in sync by hand between `server/src/rooms/StreetRoom.ts` and `client/Assets/Scripts/Network.cs` / `Models.cs`, and verified by the `verify-protocol` skill plus `tools/dump-protocol.mjs`.
- The client scene and UI are composed entirely in C#; there are no Unity prefabs or designer-authored scenes.

## Layers

**Transport layer (server):**
- Purpose: Accept HTTP requests and WebSocket room joins, authenticate, define the room.
- Location: `server/src/index.ts`
- Contains: Express handlers, `server.define('street', StreetRoom).filterBy(['ownerId', 'district'])`, admin routes gated on `ADMIN_TOKEN`.
- Depends on: `profile.ts` (tokens, profiles), `season.ts`, `events.ts`, `world.ts`, `social.ts`.
- Used by: The Unity client over HTTP and the Colyseus matchmaker.

**Room layer (server):**
- Purpose: One live street — state ownership, message dispatch, simulation.
- Location: `server/src/rooms/StreetRoom.ts`
- Contains: `onCreate` (handler registration + `setSimulationInterval(…, 100)`), `onAuth`, `onJoin`, `onLeave`, `onDispose`, `tick`, `syncStreet`, `sendProfile`, `updateMetadata`, stall/customer/activity logic.
- Depends on: every rule module and `schema.ts`.
- Used by: Colyseus.

**Rule layer (server):**
- Purpose: Game rules over persistent player state, free of networking.
- Location: `server/src/world.ts`, `market.ts`, `season.ts`, `regulars.ts`, `events.ts`, `incidents.ts`, `fortune.ts`, `cafe.ts`, `stories.ts`, `activities.ts`.
- Contains: Exported functions taking `(profile, …, now = Date.now())` and throwing `GameError` on rule violations.
- Depends on: `data.ts`, `profile.ts`.
- Used by: `StreetRoom.ts`, `index.ts`, `server/test/*.ts`.

**Data / persistence layer (server):**
- Purpose: Catalog constants and the SQLite-backed profile store.
- Location: `server/src/data.ts`, `server/src/profile.ts`, hot-reloadable `server/data/dialogues.json`.
- Contains: Tables, prepared statements, in-memory profile cache, `markDirty`/`flushNow` write-behind.
- Used by: Everything above it.

**Client network layer:**
- Purpose: Connection, auth, message routing, DTO decoding.
- Location: `client/Assets/Scripts/Network.cs`, `Models.cs`, `Schema/`.
- Contains: C# `event` hooks (`OnProfileChanged`, `OnError`, `OnSale`, `OnLevelUp`, `OnInvite`, `OnIncome`, `OnOrderDone`, `OnRoomLeft`), `Send(type, payload)`, cached `Catalog`.
- Used by: The presentation layer (currently absent).

**Client presentation layer:**
- Purpose: Screens, HUD, street scene, character composition, tap routing.
- Location: `client/Assets/Scripts/` — **deleted in the working tree**; the contracts are specified in `docs/client/protocol.md`, `docs/client/screens.md`, `docs/client/world.md`, `docs/client/sprite-names.md` and the wave plan in `docs/client-remaster-plan.md`.
- Rebuild target per plan: `Theme.cs` + `client/Tools/theme.js`, a `Depth.Of(y)` helper, a pooled widget kit on uGUI + TextMeshPro, sprite atlas behind `SpriteLibrary.Get(name)`.

## Data Flow

### Primary Request Path (player action)

1. Client calls `Network.Send("openStall", payload)` — `client/Assets/Scripts/Network.cs:118`.
2. Colyseus delivers to the handler registered via the `handle` wrapper (`server/src/rooms/StreetRoom.ts:322`), which resolves the caller's `Profile` from `client.auth.id`.
3. The handler calls rule functions (e.g. `stockStall` in `server/src/market.ts`, `openStall` at `server/src/rooms/StreetRoom.ts:405`); a violation throws `GameError`.
4. On success the wrapper runs `markDirty(profile)` → `sendProfile(profile.id)` → `syncStreet()`; on `GameError` it sends `{ text }` on the `error` message instead.
5. `syncStreet()` (`server/src/rooms/StreetRoom.ts:824`) copies owner-side truth (fame, decorations, lots, wedding) into `StreetState`; Colyseus diffs and pushes.
6. The client receives the schema diff on `Room<StreetState>` and the private `profile` message on `Network.OnProfileChanged`.

### Simulation Loop

1. `setSimulationInterval((dt) => this.tick(dt / 1000), 100)` — `server/src/rooms/StreetRoom.ts:318`.
2. `tick` moves players toward `targetX`, expires speech, tends NPC gardens, runs events and incidents, spawns customers scaled by `footTraffic`, runs activities.
3. Customers walk, decide to stop at a passing stall (charm-weighted roll), queue, buy, or time out after `MAX_WAIT_SECONDS`; completed sales push `sale`/`regularSale`/`income` messages.

### Join Flow

1. `POST /api/login` with a device id returns an HMAC token (`server/src/index.ts:37`).
2. `Client.JoinOrCreate<StreetState>("street", { token, ownerId, district })` — `client/Assets/Scripts/Network.cs:93`.
3. `onAuth` verifies the token and the ban flag (`server/src/rooms/StreetRoom.ts:336`); `onJoin` kicks any previous session, inserts a `Player` at the bus stop, settles wages/debt/daily/orders, then sends `profile`, `cafeSeats` and current incidents.
4. The client requests the static `catalog` once per process and caches it on `Network.Catalog`.

**State Management:**
- Public, diff-synced: `StreetState` only. Everything else is a message.
- Private: one `profile` snapshot per change, built by `privateProfile()` in `server/src/profile.ts`.
- Persistence: profiles live in an in-memory cache and are written to SQLite as JSON blobs 2 s after `markDirty`, plus `flushNow` on `SIGINT`/`SIGTERM`/`exit`.
- Cross-room: module-level `online` map routes a `sendProfile` to whichever room the player is actually in.

## Key Abstractions

**`Profile`:**
- Purpose: The whole persistent player — money, level, districts/lots, store, employees, wardrobe, quests, season, regulars, fortune, log.
- Defined: `server/src/profile.ts:79`; serialised whole as JSON into `players.data`.
- Pattern: Passed by reference into rule functions that mutate it, followed by `markDirty`.

**`handle<M>(type, fn)`:**
- Purpose: Uniform message handler — profile lookup, `GameError` → `error` message, save + resend + resync.
- Location: `server/src/rooms/StreetRoom.ts:322`.
- Pattern: Every mutating message is registered through it; only `move`, `say` and the request/response messages (`catalog`, `marketPrices`, `playerOrders`, `sharedOrder`, `season`, `regulars`) use raw `onMessage`.

**`GameError`:**
- Purpose: Expected rule violation with a Vietnamese player-facing message.
- Location: `server/src/profile.ts:452`.
- Pattern: Thrown by rule modules, caught only by `handle`; any other exception propagates.

**Catalog request/response:**
- Purpose: Ship all static data (products, crops, recipes, buildings, professions, vehicles, neighbours, fortunes, balance) to the client once instead of duplicating it in C#.
- Location: `server/src/rooms/StreetRoom.ts:307`, consumed at `client/Assets/Scripts/Network.cs:111`.

**Street/world coordinate contract:**
- Purpose: Server sends `x` in server units; the client converts. `WorldScale = 100`, `DepthOrder(y) = 1000 - y*100`, slot spread from `firstSlotX`/`lastSlotMargin`.
- Location: Server side in `BALANCE` (`server/src/data.ts`) and `slotX()` (`server/src/rooms/StreetRoom.ts:406`); client side specified in `docs/client/world.md`.

**Sprite-name contract:**
- Purpose: Sprite ids are built from server data ids at runtime (`counter_<product.id>`, `wear_<wearable.id>`, `building_<type>`, `bg_land_<district>`, `npc_*`, character layers from `LOOK_OPTIONS`).
- Location: `docs/client/sprite-names.md`; resolved through `SpriteLibrary.Get(name)`.

## Entry Points

**Server:**
- Location: `server/src/index.ts` (`npm start` → `tsx src/index.ts`, port 2567 or `$PORT`).
- Triggers: Process start; `start-server.bat` at the repo root.
- Responsibilities: Ensure NPC streets, start the hourly season rollover, mount Express, define the `street` room, listen.

**Room:**
- Location: `StreetRoom.onCreate` — `server/src/rooms/StreetRoom.ts:76`.
- Triggers: `joinOrCreate('street', { ownerId, district })`, filtered by both options so one room = one owner's district.
- Responsibilities: Build initial state from the owner's profile, register handlers, start the tick.

**Client:**
- Location: `new Network()` → `Login` → `JoinStreet` (`client/Assets/Scripts/Network.cs`). The old `Game.Boot()` bootstrapper is deleted; the rebuild needs a new one (Wave 1–3 of `docs/client-remaster-plan.md`).

**Tests:**
- Location: `server/test/*.ts`, run via `npm run test`, `test:garden`, `test:world`, `test:market`, `test:season`, etc.
- Triggers: Manual / skill-driven (`simulate-economy`, `smoke-test-game`).

**Admin:**
- Location: `GET /admin` serving `server/public/admin.html`; `/admin/*` JSON routes require the `x-admin-token` header and stay disabled unless `ADMIN_TOKEN` is set.

## Architectural Constraints

- **Threading:** Single-threaded Node event loop. One `setSimulationInterval` at 100 ms per room; all rooms share the process. SQLite access is synchronous (`node:sqlite`), so avoid per-tick queries.
- **Global state:** Module-level singletons in `server/src/rooms/StreetRoom.ts` — `online` (player id → room + client) and `employeesAtWork` (employee id → room id). `server/src/profile.ts` holds the profile `cache`, the `dirty` set and the shared `db`/`gameDb`. These make the process effectively single-instance: horizontal scaling would need all three externalised.
- **One street per owner per district:** enforced by `filterBy(['ownerId', 'district'])`; `autoDispose = false`, so rooms persist until the process ends.
- **One session per player:** `onJoin` kicks the previous client with code 4000.
- **Protocol has no machine-checked contract:** 68 client→server messages, 16 server→client, 13 HTTP routes (`docs/client/protocol.md`). Drift is only caught by `tools/dump-protocol.mjs` / the `verify-protocol` skill.
- **Schema codegen is one-way:** editing `client/Assets/Scripts/Schema/*.cs` by hand is always wrong; edit `server/src/schema.ts` and run `npm run schema-cs`.
- **Client has no presentation layer right now:** nothing boots; `smoke-test-game` cannot pass until Wave 3 of the remaster plan lands.
- **Unity packages:** uGUI 2.0.0 (TMP included), physics2d, audio, Colyseus SDK. No URP, no Addressables, no 2D feature set; `Resources/` loading means the whole sprite folder ships in the build.
- **Circular imports:** none observed; dependencies run strictly room → rules → `data.ts`/`profile.ts`.

## Anti-Patterns

### Rules on the client

**What happens:** Computing money, prices, unlock levels or randomness in C# so the UI can show a number immediately.
**Why it's wrong:** The server is authoritative and re-derives everything; the client drifts and the player sees values that snap back. Prices and unlock levels also change in `server/src/data.ts` without a client release.
**Do this instead:** Read the cached `Network.Catalog` for static numbers and the `profile` message for live ones; send an intent and render the result.

### Hand-editing generated schema

**What happens:** Adding a field to `client/Assets/Scripts/Schema/StreetState.cs` to "match" the server.
**Why it's wrong:** The next `npm run schema-cs` overwrites it, and the Colyseus field order stops matching, which desyncs silently.
**Do this instead:** Edit `server/src/schema.ts`, then run `npm run schema-cs` from `server/` (the `edit-schema` skill covers this).

### Inventing a message on the client

**What happens:** The UI needs data, so a new message name or payload key is added only in `Network.cs`.
**Why it's wrong:** There is no schema to catch it; the server silently ignores the message and nothing logs.
**Do this instead:** Register the handler in `server/src/rooms/StreetRoom.ts` first, mirror the DTO in `Models.cs`, then run `verify-protocol` and refresh `docs/client/protocol.md`.

### Numbers inline in rule modules

**What happens:** A price, cooldown or reward literal written into `world.ts`, `market.ts` or `StreetRoom.ts`.
**Why it's wrong:** The economy can no longer be tuned or simulated from one place, and the `balance` / `simulate-economy` skills stop measuring reality.
**Do this instead:** Add it to `BALANCE` or the relevant catalog table in `server/src/data.ts` and read it from there.

### Repeating the depth formula

**What happens:** `1000 - y * 100` written at each sprite-creation site, as the deleted `StreetScene.cs` did at ~10 places.
**Why it's wrong:** One missed site sorts a character behind the sidewalk with no error.
**Do this instead:** One `Depth.Of(y)` helper, per `docs/client/world.md` and §4 of `docs/client-remaster-plan.md`.

### Mutating a profile without marking it dirty

**What happens:** `profile.money += x` inside a raw `onMessage` or a timer without `markDirty(profile)`.
**Why it's wrong:** The change lives only in the in-memory cache and is lost on restart, and the client never gets a refreshed `profile`.
**Do this instead:** Route mutations through `handle(...)`, which calls `markDirty` + `sendProfile` + `syncStreet`; outside it, call them explicitly.

## Error Handling

**Strategy:** Two classes of failure — expected rule violations and bugs.

**Patterns:**
- Rule violation: throw `GameError('<Vietnamese message>')` from a rule module; `handle` catches it and sends `error` → `Network.OnError`.
- Bug: any non-`GameError` exception rethrows and surfaces in the server log; it is not sent to the player.
- HTTP: explicit status codes with a Vietnamese `{ error }` body (`400` missing input, `401` re-login, `403` banned / admin, `404` not found).
- Auth: `onAuth` throws, which Colyseus turns into a join rejection.
- Payment safety: held money is refunded explicitly (`postPlayerOrderBack`, `refundStall`, `settleDebt`) rather than left dangling.
- Client: missing art degrades to a `Missing sprite <name>` warning from `SpriteLibrary`, never an exception.

## Cross-Cutting Concerns

**Logging:** Player-visible activity via `addLogEntry(profile, …)` (surfaced on `GET /api/log` and the Log screen); analytics events via `track(playerId, type, value)` into the `analytics` table, summarised by `analyticsSummary()` on `/admin/stats`. Server diagnostics use `console`.
**Validation:** At the handler boundary — `Number.isFinite`, clamping to street bounds, slot-range and ownership checks, string `.slice()` caps, and the Vietnamese profanity filter `filterWords` on `say`. Rule modules re-check affordability and unlock level.
**Authentication:** Device-id guest login issuing an HMAC-SHA256 token (secret in `$DATA_DIR/token-secret.txt` or `TOKEN_SECRET`); `verifyToken` on every HTTP route and in `onAuth`; optional Zalo/Google/Facebook linking via `server/src/social.ts`; recovery codes move an account to a new device. Admin routes use a constant-time compare on `ADMIN_TOKEN`.
**Time:** The server owns the clock; rule functions take `now = Date.now()` so tests can inject it, and the client estimates `ServerNow` from the last `profile` message.
**Localisation:** Identifiers, ids, routes and comments in English; all player-facing strings in Vietnamese (`CLAUDE.md`, `AGENTS.md`).

---

*Architecture analysis: 2026-11-09*

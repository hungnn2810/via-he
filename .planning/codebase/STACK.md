# Technology Stack

**Analysis Date:** 2026-11-09

Project: **Vỉa Hè Online** — a fan remaster of VNG's *Hàng Rong*, a multiplayer street-vendor game for phones. Two halves: an authoritative Node.js + Colyseus server (`server/`) holding all game rules, and a Unity 6 client (`client/`) that builds its scene and UI entirely in C# code.

## Languages

**Primary:**
- TypeScript 5.6 (ESM, `"type": "module"`) — all server game logic, `server/src/**`, `server/test/**`
- C# (Unity-targeted, .NET Standard 2.1 profile) — client code, `client/Assets/Scripts/**`

**Secondary:**
- JavaScript (Node ESM `.mjs`) — tooling: `tools/dump-protocol.mjs`, `tools/sync-skills.mjs`, `client/Tools/export-runner.mjs`, `client/Tools/export-server.mjs`, `client/Tools/sprites.js`
- Python 3 — `client/Tools/cut_street.py` (cuts sprites out of source street art)
- HTML — `server/public/admin.html` (admin console), `client/Tools/export.html` (sprite export harness)
- Batch — `start-server.bat` (one-click server launch for Windows)
- Vietnamese is the player-facing text language; code and comments are English (`CLAUDE.md`)

## Runtime

**Environment:**
- Node.js **22 or newer** required on the server. Hard requirement, not a preference: `server/src/profile.ts` uses `node:sqlite` (`DatabaseSync`), which only exists in Node 22+. The machine analysed reports `node -v` = **v16.20.2** on PATH, which cannot run the server as written — a newer Node must be on PATH or shimmed.
- Unity Editor **6000.6.8f1** (`client/ProjectSettings/ProjectVersion.txt`) for the client.

**Package Manager:**
- npm (server only). Lockfile: `server/package-lock.json` present.
- Unity Package Manager for the client (`client/Packages/manifest.json`).
- Repo root has a `node_modules/` directory but **no root `package.json`** — root tooling scripts run on bare Node with no dependencies.

## Frameworks

**Core:**
- `@colyseus/core` **0.18.25** — authoritative realtime room server; one room per district, `server.define('street', StreetRoom).filterBy(['ownerId','district'])` in `server/src/index.ts`
- `@colyseus/schema` **5.0.43** — binary state sync; state classes in `server/src/schema.ts`, mirrored to C# in `client/Assets/Scripts/Schema/`
- `@colyseus/ws-transport` **0.18.x** — WebSocket transport
- `express` **^4.21.2** — HTTP API mounted inside the Colyseus server via the `express:` hook (`/api/*`, `/admin/*`)
- Unity **uGUI** (`com.unity.ugui` 2.0.0) — client UI, constructed in code (no scenes, no prefabs)
- `io.colyseus.sdk` — Unity Colyseus client, pulled straight from `https://github.com/colyseus/colyseus-unity-sdk.git#upm` (unpinned git branch)

**Testing:**
- No test framework. Tests are plain TypeScript programs run with `tsx`: `server/test/{simulation,garden,world,dialogues,market,fortune,incidents,cafe,goods,regulars,season}.ts`, exposed as `npm test` / `npm run test:*`.
- Client smoke testing is a project skill (`.claude/skills/smoke-test-game`) driving the Unity CLI; captures land in `client/Screenshots/` (gitignored).

**Build/Dev:**
- `tsx` **^4.19.0** — runs TypeScript directly; `npm start` = `tsx src/index.ts`, `npm run dev` = `tsx watch src/index.ts`. There is no compile step: `tsconfig.json` sets `"noEmit": true`.
- `typescript` **^5.6.0** — type checking only
- `@colyseus/sdk` **0.18.x** (devDependency) — provides `schema-codegen`, used by `npm run schema-cs` to regenerate `client/Assets/Scripts/Schema/*.cs` from `server/src/schema.ts`
- `com.unity.pipeline` **0.10.0-exp.1** — experimental Unity build pipeline package

## Key Dependencies

**Critical:**
- `node:sqlite` (`DatabaseSync`, Node built-in) — the only persistence layer. All tables are created at import time in `server/src/profile.ts`; `server/src/market.ts` shares the same handle via the exported `gameDb`.
- `@colyseus/schema` — the cross-language contract. The C# side is **generated, never hand-edited**.
- Unity Colyseus SDK — without it `client/Assets/Scripts/Network.cs` does not compile.

**Infrastructure:**
- `express` — login, street list, account linking, admin endpoints
- `node:crypto` — HMAC-signed login tokens, `timingSafeEqual` for the admin token
- Unity modules in use: `ui`, `uielements`, `imgui`, `unitywebrequest`, `jsonserialize`, `physics2d`, `audio`

## Configuration

**Environment:**
- Configured purely through process env vars; **no `.env` file and no dotenv loader** in the repo. Vars are read inline at module load.

| Variable | Read in | Effect |
|---|---|---|
| `PORT` | `server/src/index.ts:18` | Listen port, default `2567` |
| `ADMIN_TOKEN` | `server/src/index.ts:19` | Enables `/admin` APIs; compared with `timingSafeEqual` against the `x-admin-token` header |
| `DATA_DIR` | `server/src/profile.ts:132`, `dialogues.ts:52`, `events.ts:60` | Where `game.db`, `token-secret.txt`, `dialogues.json`, `events.json` live; default `./data` relative to `server/` |
| `TOKEN_SECRET` | `server/src/profile.ts:175` | Login-token HMAC key; if unset, a random 32-byte key is generated once and written to `data/token-secret.txt` |
| `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_TOKEN`, `ZALO_ENABLED` | `server/src/social.ts` | Each gates one social-login provider; unset provider = verification always fails |

- Client config: the server URL is a static field, `Network.ServerAddress = "ws://localhost:2567"` (`client/Assets/Scripts/Network.cs:14`), overridden at runtime from `PlayerPrefs["serverAddress"]` so a phone on the same wifi can enter `ws://PC-IP:2567`.
- Game tuning is data, not env: `server/src/data.ts` (`PRODUCTS`, `WEARABLES`, `BALANCE`), plus `server/data/dialogues.json` and an optional `server/data/events.json` for dated events without an app update.

**Build:**
- `server/tsconfig.json`: target ES2022, module ESNext, `moduleResolution: "Bundler"`, `strict: true`, `experimentalDecorators: true` (required by `@colyseus/schema`), `useDefineForClassFields: false`, `noEmit: true`, includes `src` and `test`.
- Client has no csproj in git (`client/*.csproj`, `client/*.sln` gitignored); Unity regenerates them.
- `client/Assets/Editor/SpriteImporter.cs` is the only editor script — it applies import settings to generated sprite PNGs.

## Client state (important)

The client's entire presentation layer was deleted in the working tree as step one of a planned rewrite. What remains under `client/Assets/Scripts`:

| File | Role |
|---|---|
| `Network.cs` (127 lines) | Colyseus connect, guest login, room join, message routing, server-clock estimate |
| `Models.cs` (333 lines) | DTOs for every message payload — the only written form of the message protocol |
| `Schema/{StreetState,Player,Stall,Customer,LotState}.cs` | Generated from `server/src/schema.ts` |
| `SpriteLibrary.cs` (50 lines) | Loads `Resources/Sprites/{sprites,street_sprites}.txt` manifests plus their PNGs, with pivot and 9-slice |
| `SoundFx.cs` (52 lines) | Audio |

Gone: `UIBuilder.cs`, `Game.cs`, `GameExpansion.cs`, `StreetScene.cs`, `Draw.cs`, `Character.cs`, `CharacterCreator.cs`, `PassingBike.cs`, `StreetObject.cs` (~2800 lines) and all 188 sprites — `client/Assets/Resources/Sprites/` is now empty, so `SpriteLibrary.Load()` currently logs `Missing Resources/Sprites/sprites.txt` and every lookup returns null. The client does not run as a game right now. Rebuild specs: `docs/client-remaster-plan.md`, `docs/client/{protocol,screens,sprite-names,world}.md`.

## Platform Requirements

**Development:**
- Windows is the assumed dev host (`start-server.bat`, PowerShell-oriented docs), though nothing in the server is Windows-specific.
- Node 22+, Unity 6000.6.8f1, Python 3 only for `cut_street.py`, a Chromium-capable browser for the sprite export harness (`client/Tools/export.html` served by `export-server.mjs` / driven by `export-runner.mjs`).
- Project skills live in `.claude/skills/` (and are mirrored to `.agents/skills/` by `tools/sync-skills.mjs`): `add-event`, `add-product`, `add-quest`, `balance`, `draw-sprite`, `edit-schema`, `export-sprites`, `simulate-economy`, `smoke-test-game`, `verify-protocol`.

**Production:**
- No deployment manifests, Dockerfile, or CI config anywhere in the repo. Shipping is a bare `npm start` behind whatever host is chosen; `Network.ServerAddress` must be repointed to `wss://…` for a real deployment.
- Client target is mobile (phones), built from the Unity Editor; no build automation in repo.

---

*Stack analysis: 2026-11-09*

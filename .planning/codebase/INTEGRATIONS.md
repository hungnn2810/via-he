# External Integrations

**Analysis Date:** 2026-11-09

This project is deliberately self-contained: one Node process, one local SQLite file, no third-party services required to run. The only outbound network calls are the three optional social-login token checks, and they stay off unless their env vars are set.

## APIs & External Services

**Outbound (social login token verification) — `server/src/social.ts`:**
- **Google Identity** — `GET https://oauth2.googleapis.com/tokeninfo?id_token=…`; accepted only when `info.aud === GOOGLE_CLIENT_ID`. Gated by env `GOOGLE_CLIENT_ID`.
- **Facebook Graph** — `GET https://graph.facebook.com/debug_token?input_token=…&access_token=…`; accepted when `data.is_valid`. Gated by env `FACEBOOK_APP_TOKEN`.
- **Zalo Graph** — `GET https://graph.zalo.me/v2.0/me?fields=id` with the user token in an `access_token` header. Gated by env `ZALO_ENABLED`.
  - Client: plain `fetch` (Node built-in), no SDK. Failures are swallowed and logged (`console.error('Social login check failed', e)`), returning `null` = rejected.
  - Not wired on the client: the Unity side still needs each provider's native SDK to obtain a provider token in the first place (`README.md`, server settings table). No such SDK is in `client/Packages/manifest.json`.

**Inbound (client → server), HTTP, served by Express inside the Colyseus server — `server/src/index.ts`:**

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/login` | device id | Guest login; returns signed token, id, name. Rejects `banned` profiles with 403 |
| POST | `/api/recover` | recovery code | Move an account to a new device |
| POST | `/api/link` | player token + provider token | Link Google/Facebook/Zalo to the current account |
| POST | `/api/login/social` | provider token | Sign in via a previously linked account |
| GET | `/api/streets?token=` | player token | Streets to travel to: populated rooms (via `matchMaker.query({name:'street'})`), NPC streets, random empties, friends first |
| GET | `/api/log?token=` | player token | The player's own activity log |
| GET | `/api/leaderboard` | none | Current season's most famous streets |
| GET | `/` | none | Liveness string |
| GET | `/admin` | none (page only) | Serves `server/public/admin.html` |
| GET | `/admin/reports`, `/admin/stats` | `x-admin-token` | Moderation queue, analytics summary |
| POST | `/admin/ban`, `/admin/event` | `x-admin-token` | Ban/unban a player, start a manual timed event |

Client call sites: `Client.Http.Post/Get("api/…")` in `client/Assets/Scripts/Network.cs` (lines 59, 71, 82, 86), using the Colyseus SDK's HTTP helper against the same host as the websocket.

**Realtime (the main channel):**
- Colyseus room `street`, defined in `server/src/index.ts` as `server.define('street', StreetRoom).filterBy(['ownerId','district'])` — one room per player district, joined with `joinOrCreate('street', { ownerId, district })`.
- Room logic: `server/src/rooms/StreetRoom.ts` (1011 lines). Commands arrive as `this.onMessage('move'|'say'|…)` and the wrapper `this.handle('openStall'|'sitCafe'|…)`.
- Synced state: `@colyseus/schema` classes in `server/src/schema.ts` → generated C# in `client/Assets/Scripts/Schema/` via `npm run schema-cs`.
- **The message protocol has no schema.** Names and payload keys are kept in sync by hand between `StreetRoom.ts` and `Network.cs` / `Models.cs`. `tools/dump-protocol.mjs` scrapes `StreetRoom.ts` to regenerate `docs/client/protocol.md` as the written reference; the `verify-protocol` project skill checks both sides agree.

## Data Storage

**Databases:**
- **SQLite via `node:sqlite` (`DatabaseSync`)** — Node built-in, no external driver. File: `${DATA_DIR:-server/data}/game.db`.
  - Opened and schema-created at import time in `server/src/profile.ts:135`; handle re-exported as `gameDb` and reused by `server/src/market.ts`.
  - Tables: `players` (profile JSON blob keyed by id, unique `device_id`), `linked_accounts` (provider, provider_user_id → player_id), `reports`, `analytics` (+ index on `(type, at)`), `player_orders`, `votes`, `community`, plus market tables in `market.ts`.
  - Access pattern: prepared statements only (`db.prepare(...)`), with an in-memory `Map` profile cache and a dirty-flag flush (`markDirty` / `flushNow`, flushed on `SIGINT`/`SIGTERM`).
  - `server/data/*` is gitignored except `*.json`, so `game.db` never enters git.
- No ORM, no migration tool — `CREATE TABLE IF NOT EXISTS` is the whole migration story.

**File-based data:**
- `server/data/dialogues.json` (committed) — NPC dialogue, loaded by `server/src/dialogues.ts`
- `server/data/events.json` (optional, not committed) — dated events addable without an app update, loaded by `server/src/events.ts`
- `${DATA_DIR}/token-secret.txt` — generated HMAC key (see Auth)

**File Storage:**
- Local filesystem only. No object store, no CDN. Client art is shipped inside the Unity build from `client/Assets/Resources/Sprites/` — currently **empty**, deleted as step one of the client rewrite, with the manifest format (`sprites.txt`, `street_sprites.txt`: name, pivot x/y, 9-slice borders, plus a `ppu` line) still read by `client/Assets/Scripts/SpriteLibrary.cs`.

**Caching:**
- In-process only: the profile `Map` cache in `profile.ts`. No Redis; consequently the server is single-node — Colyseus runs with the default local presence/driver, so two instances would not share rooms or the street list.

## Authentication & Identity

**Primary: custom device-id guest auth.**
- `POST /api/login` with a client-generated `deviceId` (min 8 chars, truncated at 64) creates or fetches a profile.
- Token format: `"<playerId>.<base64url(HMAC-SHA256(playerId, SECRET))>"` — `signToken` / `verifyToken` in `server/src/profile.ts`. Note: the token is a bare identity proof with **no expiry and no nonce**, so it is a long-lived bearer credential and is passed as a URL query parameter on `GET /api/streets` and `/api/log`.
- `SECRET` comes from env `TOKEN_SECRET`, else a random 32-byte key persisted to `${DATA_DIR}/token-secret.txt` on first boot (rotating that file invalidates every token).
- Account recovery: a recovery code moves the account to a new device (`/api/recover`, `recoverAccount`), clearing the old `device_id`.
- Room auth: the Colyseus room resolves the token to a profile and keeps it on `client.auth` (`c.auth!.id` in `StreetRoom.ts`).

**Optional: social linking** — Google / Facebook / Zalo as described above, mapping provider user ids to player ids in `linked_accounts`. No OAuth flow is implemented server-side; the server only *verifies* a token the client obtained itself.

**Admin auth** — single shared secret in env `ADMIN_TOKEN`, sent as the `x-admin-token` header, compared with `crypto.timingSafeEqual` after a length check (`isAdmin` in `server/src/index.ts`). When `ADMIN_TOKEN` is unset every `/admin/*` API returns 403, but `GET /admin` still serves the HTML page unauthenticated.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry/Crashlytics/OpenTelemetry anywhere in the repo.

**Analytics:**
- Home-grown: `track(playerId, type, value?)` writes rows to the SQLite `analytics` table; `analyticsSummary()` aggregates counts, distinct players, first-seen and per-player sessions for the admin page. No external analytics provider.

**Logs:**
- `console.log` / `console.error` to stdout, plus Colyseus's own logging. On the client, `Debug.Log*`. No log shipping, no structured logging, no rotation.

**Health:**
- `GET /` returns `"Vỉa Hè Online server is running"` — the only health endpoint.

## CI/CD & Deployment

**Hosting:**
- Not configured. The server is run locally: `cd server && npm install && npm start`, or `start-server.bat` (checks for Node, installs deps on first run, prints `ws://localhost:2567` and the "phones on the same wifi" hint).
- No Dockerfile, docker-compose, Procfile, Terraform, or host-specific config in the repo.

**CI Pipeline:**
- None. No `.github/workflows`, no other CI directory. Verification is manual via `npm test` / `npm run test:*` and the `smoke-test-game` project skill driving the Unity CLI.

**Client distribution:**
- Manual Unity Editor builds; no build automation, signing config, or store integration in the repo. `client/Screenshots/` (CLI smoke-test captures) is gitignored.

## Environment Configuration

**Required for a working server:** none — it boots with zero env vars (random token secret, local SQLite, port 2567).

**Required to switch features on:**
- `ADMIN_TOKEN` — admin APIs
- `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_TOKEN`, `ZALO_ENABLED` — social login/linking
- `TOKEN_SECRET` — stable token signing across restarts/hosts (set this before any multi-host or redeploy scenario)
- `PORT`, `DATA_DIR` — placement

**Secrets location:**
- Process environment only. There is **no `.env` file, no dotenv loader, and no secret manager** in the repo. The one secret the server stores itself is `${DATA_DIR}/token-secret.txt`, which lives in the gitignored `server/data/` directory.
- Client-side: the server address is stored in Unity `PlayerPrefs["serverAddress"]`; the login token is held in memory by `Network`.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook endpoints; `/admin/event` is an authenticated operator action, not a provider callback.

**Outgoing:**
- None. No notification, email, or payment provider. There is no monetisation or IAP integration anywhere in the codebase.

## Tooling-only integrations

- `client/Tools/export-server.mjs` + `export-runner.mjs` + `export.html` — a local HTTP server on loopback that receives `POST /save?name=…` and writes PNG/text straight into `client/Assets/Resources/Sprites/`; the sprite art is drawn in a browser canvas by `client/Tools/sprites.js`. Driven by the `export-sprites` / `draw-sprite` project skills.
- `client/Tools/cut_street.py` — cuts sprites out of `street_source.jpg` / `street_source_2.png`.
- `tools/dump-protocol.mjs` — regenerates `docs/client/protocol.md` from `StreetRoom.ts`.
- `tools/sync-skills.mjs` — mirrors `.claude/skills/` to `.agents/skills/`.
- All are local-only; none reach the network beyond loopback.

---

*Integration audit: 2026-11-09*

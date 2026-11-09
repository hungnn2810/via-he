# Coding Conventions

**Analysis Date:** 2026-11-09

The authoritative rule source is `CLAUDE.md` (identical copy in `AGENTS.md`). Everything below is
verified against the code; where the code is consistent, follow it as written.

## Language rule (non-negotiable)

**Code is English, player-facing text is Vietnamese.**

- English: class/function/variable names, file and folder names, sprite asset names, enum and
  string ids, message types, HTTP routes, JSON keys, SQLite tables/columns, comments, logs,
  dev tooling, docs, commit messages.
- Vietnamese: every string a player reads — UI labels, error text thrown as `GameError`,
  product and NPC names, text painted onto sprites, the profanity list in
  `server/src/rooms/StreetRoom.ts` (`BANNED_WORDS`).
- `ViaHeOnline` / "Vỉa Hè Online" is a proper noun and stays as it is.

The code follows this closely: ids are English (`iced_tea`, `banh_mi`, `grandma_soup`) while the
`name` field next to them is Vietnamese (`'Trà đá'`, `'Bánh mì'`) — see `server/src/data.ts`.
Transliterated Vietnamese *dish* ids (`banh_mi`, `banh_chung`, `xoi` → `sticky_rice`) are
accepted; prefer an English word when one exists, otherwise unaccented ASCII.

## Naming Patterns

**Files:**
- Server: lowercase single-word modules — `server/src/data.ts`, `market.ts`, `regulars.ts`,
  `season.ts`, `world.ts`, `profile.ts`. Rooms are PascalCase: `server/src/rooms/StreetRoom.ts`.
- Tests: `server/test/<feature>.ts`, matching the source module (`market.ts` → `test/market.ts`).
- Client C#: PascalCase, one type family per file — `client/Assets/Scripts/Network.cs`,
  `Models.cs`, `SpriteLibrary.cs`, `SoundFx.cs`; generated schema in
  `client/Assets/Scripts/Schema/*.cs`.
- Sprites: lowercase snake_case with a stage/variant suffix — `banana_stage_1.png`,
  `bg_land_0.png`, `body_female_step1.png` (see `docs/client/sprite-names.md`).

**Functions:** `camelCase` verbs in TS (`marketPrice`, `plantCrop`, `seasonView`,
`rolloverSeason`); `PascalCase` in C# (`Login`, `LoadList`). Test-only hooks are suffixed
`ForTest` — `setSeasonForTest` in `server/src/world.ts:535`.

**Variables:** `camelCase`. Numeric literals use underscore separators for anything above a
thousand: `3_600_000`, `200_000`, `10_000_000`. Module-level constants are `SCREAMING_SNAKE`
(`MARKET`, `BALANCE`, `PRODUCTS`, `DAY`, `CUSTOMER_SPEED`, `MAX_WAIT_SECONDS`).

**Types:** `PascalCase` interfaces with no `I` prefix — `Product`, `Profile`, `Employee`,
`MarketState`, `Appearance`. String-union types instead of enums:
`export type ProductCategory = 'snack' | 'drink' | 'toy' | 'goods';` (`server/src/data.ts:4`).

**Ids:** lowercase snake_case string literals (`soap_bubbles`, `gold_sign_20`, `green_sunday`),
never numeric. Message names are lowerCamelCase (`openStall`, `createCharacter`, `marketPrices`).

## Code Style

**Formatting:** no Prettier, ESLint or Biome config exists anywhere in the repo — style is
by hand and consistent:
- 2-space indent, semicolons, single quotes in TS; double quotes only in `tools/*.mjs`.
- Long lines are accepted (120–200 cols) when they keep a data row on one line. Data tables in
  `server/src/data.ts` are column-aligned by hand; preserve the alignment when adding rows.
- One-line guard clauses and one-line bodies are idiomatic:
  `if (!product) throw new GameError('Không có món này');`
- Arrow consts for small pure helpers: `const wait = (ms: number) => new Promise(...)`,
  `export const isWholesale = (p: Product) => !p.homegrown && !p.seasonal;`

**TypeScript:** `server/tsconfig.json` — `strict: true`, `target: ES2022`,
`module: ESNext`, `moduleResolution: Bundler`, `noEmit: true`, `experimentalDecorators: true`
(required by `@colyseus/schema`), `useDefineForClassFields: false`. ESM throughout
(`"type": "module"`), so **every relative import carries a `.js` extension** even though the
file is `.ts`: `import { PRODUCTS } from './data.js';`. There is no build step — `tsx` runs the
TypeScript directly.

**C#:** Allman braces, `namespace ViaHeOnline` / `ViaHeOnline.Schema`, public fields (not
properties) on DTOs in `Models.cs` because they are JSON-deserialized, private fields prefixed
with `_` (`_profileReceivedAt`, `_sprites`), `static` utility classes (`SpriteLibrary`).

## Import Organization

Server files open with a comment block, then imports:
1. Node builtins with the `node:` prefix — `node:crypto`, `node:fs`, `node:path`, `node:sqlite`.
2. Third-party — `@colyseus/core`, `@colyseus/schema`, `express`.
3. Local modules with `.js` extensions, named imports sorted roughly alphabetically and wrapped
   across lines (see the import block at the top of `server/src/rooms/StreetRoom.ts`).

Type-only names are inlined with the `type` keyword rather than a separate statement:
`import { GameError, gameDb, type Profile } from './profile.js';`

No path aliases, no barrel files, no `index.ts` re-exports — modules import each other directly.

## Error Handling

**One pattern, used everywhere on the server:**

```ts
export class GameError extends Error {}            // server/src/profile.ts:452
...
if (profile.money < w.price) throw new GameError('Không đủ tiền');
```

Rule violations throw `GameError` with a **Vietnamese** message. Every room message handler is
wrapped by `StreetRoom.handle()` (`server/src/rooms/StreetRoom.ts:321`), which:
1. resolves the profile from `c.auth.id`, returning silently if there is none,
2. calls the handler,
3. on success: `markDirty(profile)` → `sendProfile()` → `syncStreet()`,
4. on `GameError`: `c.send('error', { text: e.message })`,
5. on any other error: rethrows (programming bugs must not be swallowed).

So: **never catch inside a handler, never `c.send('error', ...)` by hand, never return an error
object.** Throw `GameError` and let the wrapper do the rest. The one place a local `catch` is
right is compensating state before rethrowing — `catch (e) { postPlayerOrderBack(order); throw e; }`
(`StreetRoom.ts:207`).

HTTP routes in `server/src/index.ts` use explicit status codes with a Vietnamese `error` field:
`res.status(401).json({ error: 'Đăng nhập lại' })`. Inputs are clamped at the boundary —
`String(req.body?.deviceId || '').slice(0, 64)`, `Number.isFinite(seconds)`,
`express.json({ limit: '16kb' })`. Admin routes stay dead unless `ADMIN_TOKEN` is set and compare
with `timingSafeEqual`.

Validate with `Number.isInteger` + explicit range before trusting any client number
(`server/src/profile.ts:369`).

## Logging

No logging framework. `console.log` only, in English, and only at startup/shutdown or in test
scripts (`Vỉa Hè Online: ws://localhost:2567`). Client side uses `Debug.LogError` with English
text (`SpriteLibrary.cs`). Gameplay events go to the player's in-profile activity log via
`addLogEntry` / `track`, not to stdout.

## Comments

Written in English, and used deliberately:
- **Every module starts with a 1–3 line header comment** saying what it owns and how to run or
  regenerate it. Match this when adding a module. Examples: `schema.ts` ("After editing this file
  run `npm run schema-cs`"), `market.ts` ("Every function takes `now` so tests can run on a fake
  clock"), `profile.ts` ("Stored in SQLite … batched every 2 seconds").
- **Trailing comments explain units and formats**, not syntax:
  `@type('string') look = '';  // appearance: "gender,hair,brows,lips,cheeks,earrings"`,
  `cost: number;  // purchase cost per portion`, `creditLimit: 200_000, // outstanding debt, interest included`.
- Comments flag intent the code cannot show: `// All numbers are provisional`,
  `// best tier first`, `// Vietnamese profanity filter (player content, so the words stay Vietnamese)`.

No JSDoc/TSDoc anywhere; no XML doc comments in C#. Do not introduce them.

## Function Design

- Small and pure where possible. Pricing is a pure function of the day, so nothing is stored:
  `marketPct(productId, now)` hashes `${dayIndex(now)}:${productId}` (`server/src/market.ts`).
- **Every time-dependent function takes `now` as a trailing default parameter**
  (`now = Date.now()`). This is what makes the fake-clock tests possible — keep it.
- Payloads are inline object types on the handler, which is also what
  `tools/dump-protocol.mjs` and the protocol checker parse:
  `this.handle('plant', (pr, c, m: { lot: number; crop: string }) => ...)`. Named payload types
  defeat the checker, so prefer inline `{ ... }`.
- View builders are named `<thing>View` and return plain JSON for the client (`seasonView`,
  `fortuneView`, `regularsView`, `sharedOrderView`, `privateProfile`).

## Module Design

- Named exports only; no default exports.
- Each server module owns one subject and its constants: `data.ts` all tunable numbers,
  `profile.ts` persistence + player state, `world.ts` garden/buildings/progression,
  `market.ts` wholesale, `season.ts` season track, `rooms/StreetRoom.ts` the message protocol
  and the tick loop.
- `StreetRoom.ts` (~1000 lines) is the largest file and the intended seam: new features get
  their own module and a thin `handle(...)` registration in the room.

## Contract rules that must not drift

1. **Schema:** after editing `server/src/schema.ts`, run `npm run schema-cs` in `server/` to
   regenerate `client/Assets/Scripts/Schema/`. Colyseus encodes by field order, so **append new
   fields at the end of a class** — inserting in the middle silently corrupts already-shipped
   clients. Pick the smallest type that fits (`uint8`/`uint16`/`int8`/`float32`; `float64` only
   for `Date.now()` timestamps). Skill: `edit-schema`.
2. **Messages:** names and payload keys must match between `server/src/rooms/StreetRoom.ts` and
   `client/Assets/Scripts/Network.cs` / `Models.cs`. Mismatches fail silently at runtime —
   verify with `node .agents/skills/verify-protocol/scripts/check-protocol.mjs`.
   Regenerate the spec with `node tools/dump-protocol.mjs > docs/client/protocol.md`.
3. **Server first:** when a feature needs both sides, define state fields and messages on the
   server, then build the UI on the contract. Never invent a client-side field or message.
4. **No balance numbers on the client.** The client requests the `catalog` message; all numbers
   live in `server/src/data.ts`. Before and after touching any number, run
   `cd server && npx tsx ../.agents/skills/balance/scripts/profit-table.ts` (skill: `balance`).
5. **Skills:** edit only `.agents/skills/`, then `node tools/sync-skills.mjs`
   (`--check` exits 1 if the two copies differ). Never hand-edit `.claude/skills/`.
6. **Art:** generate each button, icon, character layer and prop as its own sprite; compose
   layout in C#. Never generate a whole screen as one image (`docs/client-remaster-plan.md`).

## Division of work

`CLAUDE.md` splits the repo between two AI tools: Claude owns gameplay, server, protocol and
client presentation; Antigravity owns UI/UX in the same client areas and never touches game
rules, `server/src/data.ts` numbers, or server logic. Check `git status` before editing a client
file and keep changes small so both sets merge.

## Client-side state note

The client's presentation layer was deleted as step one of a rewrite. Surviving C# conventions
are readable in `client/Assets/Scripts/Network.cs`, `Models.cs`, `SpriteLibrary.cs`,
`SoundFx.cs` and `Schema/`; the intended screens, world layout and sprite naming live in
`docs/client/screens.md`, `docs/client/world.md`, `docs/client/sprite-names.md` and
`docs/client-remaster-plan.md`. Build new UI against those plus `docs/client/protocol.md`.

---

*Convention analysis: 2026-11-09*

# Testing Patterns

**Analysis Date:** 2026-11-09

## Test Framework

**Runner:**
- **None.** There is no Jest, Vitest, Mocha, or `node:test` anywhere. Each test file is a
  standalone ESM script executed by `tsx` and exits with code 0 or 1.
- Config: `server/package.json` scripts; type-checked by `server/tsconfig.json`
  (`include: ["src", "test"]`).

**Assertion Library:**
- Hand-rolled. Every test file redefines the same two helpers (copy them when adding a file):

```ts
let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
```

Labels are written as English sentences describing the rule
(`'First planting is free'`, `'Wholesale profit per second never drops as levels rise'`).

**Run Commands:**
```bash
cd server
npm test                 # test/simulation.ts — needs a running server (npm start elsewhere)
npm run test:garden      # test/garden.ts
npm run test:world       # test/world.ts
npm run test:dialogues
npm run test:market
npm run test:fortune
npm run test:incidents
npm run test:cafe
npm run test:goods
npm run test:regulars
npm run test:season
npx tsx test/<file>.ts   # any file directly; this is what the file headers document
```

There is no `test:all` script and no watch or coverage mode. Running everything means running
each script in turn.

## Test File Organization

**Location:** separate `server/test/` directory, never co-located with sources.

**Naming:** `server/test/<module>.ts`, one file per feature module it exercises.

**Structure:**
```
server/test/
├── simulation.ts   # end-to-end, two real clients against a live server
├── world.ts        # garden, buildings, progression, season rollover
├── garden.ts       # crops, watering, harvest
├── market.ts       # wholesale prices, credit, shared bulk order
├── season.ts       # season track, weekly quests, leaderboards, rewards
├── goods.ts        # product catalog invariants, categories, customer groups
├── regulars.ts     # regular customers
├── fortune.ts      # daily fortune
├── incidents.ts    # street incidents
├── cafe.ts         # café / stamina
└── dialogues.ts    # NPC dialogue data
```

Client (Unity/C#) has **no automated tests**. Client verification is manual Play Mode driving via
the `smoke-test-game` skill and the C# snippets in
`.agents/skills/smoke-test-game/scripts/*.cs`.

## Test Structure

Two distinct kinds of test file.

**A. In-process unit/integration tests** (every file except `simulation.ts`). The pattern is
fixed and load-bearing — an isolated data directory must be set **before** the modules are
imported, so imports are dynamic `await import`:

```ts
// Checks the diverse goods: product categories, the four wholesale-only new products and customer groups.
//   npx tsx test/goods.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-goods-'));
const { PRODUCTS, getProduct } = await import('../src/data.js');
const P = await import('../src/profile.js');
const M = await import('../src/market.js');
const { GameError, login } = P;
```

`server/src/profile.ts:132` reads `process.env.DATA_DIR` at module load and creates
`game.db` there, so setting it first gives each run a throwaway SQLite database. Modules are
imported under short aliases (`P`, `W`, `M`, `S`) and used as `P.privateProfile(...)`,
`W.rolloverSeason(...)`.

**B. End-to-end simulation** (`server/test/simulation.ts`): real `@colyseus/sdk` clients against
a server started separately.

```ts
const URL = process.env.URL || 'http://localhost:2567';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function joinStreet(account: { token: string }, ownerId: string, district = 0) {
  const client = new Client(URL);
  const room = await client.joinOrCreate<any>('street', { token: account.token, ownerId, district });
  const ctx = { room, profile: null as any, errors: [] as string[], sales: 0 };
  room.onMessage('profile', (p) => { ctx.profile = p; });
  room.onMessage('error', (m) => { ctx.errors.push(m.text); });
  room.onMessage('sale', () => { ctx.sales++; });
  room.onMessage('*', () => {});
  await wait(300);
  return ctx;
}
```

**Patterns:**
- No `describe`/`it` and no setup/teardown hooks. Files are linear top-level scripts with
  `// ---- Section ----` or plain `// Section` comments as grouping.
- Top-level `await` is used freely (ESM + ES2022).
- Every file ends with the same footer:

```ts
P.flushNow();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll season checks passed');
process.exit(failures ? 1 : 0);
```

`flushNow()` forces the batched SQLite write before exit.

## Mocking

**Framework:** none. Nothing is stubbed, spied on, or monkey-patched.

Three substitution techniques replace mocking:

**1. Fake clock by parameter.** Every time-dependent server function takes `now` as its last
parameter (`now = Date.now()`), so tests pass computed timestamps instead of faking timers:

```ts
const DAY = 86_400_000;
const SEASON_LENGTH = SEASON_DAYS * DAY;
const SEASON_START = 20 * SEASON_LENGTH;   // season 20
const t0 = SEASON_START + DAY;
const nextWeek = t0 + 3 * DAY;
const nextSeason = SEASON_START + SEASON_LENGTH + DAY;
const table = M.marketTable(t0);
```

**2. Temp data directory.** `process.env.DATA_DIR = mkdtempSync(...)` before import — the real
SQLite layer runs, against a disposable file.

**3. Explicit test seams in production code**, used sparingly and named `...ForTest`:
`W.setSeasonForTest(20)` (`server/src/world.ts:535`).

**What to mock:** nothing. Use `now`, `DATA_DIR`, and real `login()` profiles.

**What NOT to mock:** the database, the profile store, the market, the clock. The value of these
tests is that they run the real rules.

## Fixtures and Factories

Profiles are created through the real `login()` and then mutated directly:

```ts
let counter = 0;
const player = (name: string, level: number) => {
  const p = login(`season-device-${counter++}`, name);
  p.level = level;
  return p;
};

const buyer = login('goods-buyer-device', 'Người mua');
buyer.money = 10_000_000;
buyer.level = 2;
Object.assign(buyer.districts[0].lots[0], { building: 'store', level: 3, readyAt: 0 });
```

**Rules:**
- Device ids are unique per test file and describe the file: `goods-buyer-device`,
  `season-device-0`, `simulation-${name}-${Date.now()}`.
- Player names are Vietnamese (`'An'`, `'Bình'`, `'Người mua'`, `'Người mới'`) — they are
  player-facing data.
- There is no fixtures directory and no shared test-helper module. Helpers are duplicated per
  file on purpose; keep them identical in shape.
- Feature-specific local helpers are defined where used, e.g. `finishQuest(p, quest, now)` and
  `weeklyOf(p, now)` in `test/season.ts`, `perSecond(x)` in `test/goods.ts`.

## Coverage

**Requirements:** none measured and none enforced. No coverage tool is installed.

Coverage is reasoned about by rule, not by line: the tests assert game-rule invariants
(ids unique, catalog sorted by unlock level, profit per second monotonic, prices within
70–130%, fame reset at rollover, rolling over twice does nothing). When adding a feature, add
the invariants to the matching `server/test/<module>.ts`.

**Known gaps:**
- All Unity/C# client code — zero automated tests.
- `tools/dump-protocol.mjs` and `tools/sync-skills.mjs` themselves.
- HTTP routes in `server/src/index.ts` beyond `/api/login` (exercised only through
  `simulation.ts`); admin routes untested.
- `server/src/social.ts` (external provider token verification).

## Test Types

**Unit / rule tests:** the in-process files. Import real modules against a temp `DATA_DIR` and a
fake clock, assert rules and data invariants. Fast, no server needed. This is the default kind to
write.

**Integration / E2E:** `server/test/simulation.ts`. Two logged-in players join the same street
over WebSocket and drive real messages (`createCharacter`, `plant`, `openStall`, `hire`,
`inviteCustomer`, `fillOrder`). Asserts both sides of the protocol: synced state
(`A.room.state.stalls.get('4')?.sellerName`) and pushed messages (collected `errors`, `sales`).
Requires `npm start` in another terminal; override the target with `URL=...`.

**Protocol check (static):** `node .agents/skills/verify-protocol/scripts/check-protocol.mjs`
from the repo root. Exits 1 with `MISMATCH` lines when the client sends a message the server has
no handler for, a payload key is missing on either side, a server push has no client listener, or
the client calls an undefined `api/` route. `note:` lines do not fail. Run it after touching
`StreetRoom.ts`, `index.ts`, `Network.cs`, or any `_net.Send` call. Because it parses the inline
`m: { ... }` handler type, keep payload types inline.

**Balance check:** `cd server && npx tsx ../.agents/skills/balance/scripts/profit-table.ts`
imports `server/src/data.ts` directly and prints the profit-per-second table, the levelling
curve in minutes, wardrobe totals and employee costs. Run before and after changing any number
in `data.ts` — measure, change one group, measure again.

**Client smoke test:** the `smoke-test-game` skill. Ordered gate, stop at the first failure:
1. `node .agents/skills/verify-protocol/scripts/check-protocol.mjs`
2. in `server/`: `npm test`, `npm run test:garden`, `npm run test:world`
3. start the server if port 2567 does not answer; confirm `http://localhost:2567/` replies
4. Unity CLI Play Mode run (needs `unity --version` and `com.unity.pipeline` in `client/`;
   installing the CLI needs the user's approval), driven by
   `.agents/skills/smoke-test-game/scripts/*.cs` (`login.cs`, `create.cs`, `plant.cs`,
   `water.cs`, `harvest.cs`, `sell.cs`, `invite.cs`, `state.cs`, `lot.cs`, `restore.cs`)

Compiling is not proof and a Play Mode screenshot can show a frozen frame — follow the skill's
order rather than asserting a change works.

**Economy simulation:** the `simulate-economy` skill wraps `server/test/simulation.ts` for
headless bot runs covering levelling, wages, sidewalk rent and multi-player interaction.

## Common Patterns

**Async testing** — fixed `wait()` after each send, because the server ticks every 100 ms:

```ts
A.room.send('plant', { lot: 0, crop: 'banana' });
await wait(300);
check(A.profile.districts[0].lots[0].readyAt > 0 && A.profile.money === 500000, 'First planting is free');
```

**Error testing** — in-process, assert the Vietnamese `GameError` substring via `refuses`:

```ts
refuses(() => M.buyWholesale(p, 'iced_tea', 500, t0), 'Không đủ tiền', 'Cannot buy without money');
```

Over the wire, collect `error` messages and match a substring:

```ts
check(A.errors.some((t) => t.includes('Kho hết')), 'Cannot sell bananas with an empty store');
check(B.errors.some((t) => t.includes('chủ phố')), "Bình cannot open a stall in the owner's slot");
```

Match a short distinctive fragment, not the whole sentence, so wording tweaks do not break tests.

**Invariant testing** — assert over the whole catalog rather than single rows:

```ts
check(PRODUCTS.every((p, i) => i === 0 || p.unlockLevel >= PRODUCTS[i - 1].unlockLevel), 'The catalog stays sorted by unlock level');
check(new Set(PRODUCTS.map((p) => p.id)).size === PRODUCTS.length, 'Product ids are unique');
```

**Tolerant assertions where other test players can tie** — compare order, not absolute values
(see the leaderboard ranks in `server/test/season.ts`).

## Adding a test

1. Create `server/test/<feature>.ts` with a header comment: what it checks, then the run command.
2. Set `process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-<feature>-'))` first.
3. `await import('../src/<module>.js')` after it; copy `check` / `refuses`.
4. Define a fake-clock base (`const DAY = 86_400_000; const t0 = ...`) and pass `now` explicitly.
5. End with `P.flushNow();` + the `process.exit(failures ? 1 : 0)` footer.
6. Add `"test:<feature>": "tsx test/<feature>.ts"` to `server/package.json` scripts.

---

*Testing analysis: 2026-11-09*

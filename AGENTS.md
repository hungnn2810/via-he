# Project rules

## Language: code in English

All code is written in English:

- Identifiers: classes, functions, variables, fields, enum/string ids, message types, API routes, JSON keys, DB tables/columns.
- File and folder names, including asset names (sprites in `client/Assets/Resources/Sprites/`).
- Code comments, log output, developer tooling (Unity editor menus, scripts), docs and commit messages.

Exception: **player-facing text stays Vietnamese** (UI labels, button text, in-game messages and error messages shown to players, item and NPC names, text painted onto sprites, the profanity filter list). The game is for Vietnamese players. Keep that text in string literals; do not use Vietnamese words for identifiers.

The product name "Vỉa Hè Online" (namespace `ViaHeOnline`) is a proper noun and stays as it is.

## Layout

- `server/`: Node.js + Colyseus 0.18 (TypeScript). It runs all game rules.
- `client/`: Unity 6 project. The scene and UI are built entirely in code.
- `client/Assets/Resources/` holds what the game loads by name at runtime (`Sprites/` is generator output with a fixed name contract). `client/Assets/Art/` holds source art that is not loaded yet, e.g. the female outfit set in `Art/Outfits/` (see `docs/client/outfits.md`).
- `server/src/schema.ts` is the synced state. After editing it, run `npm run schema-cs` in `server/` to regenerate `client/Assets/Scripts/Schema/`.
- Message names and payload keys must match between `server/src/rooms/StreetRoom.ts` and `client/Assets/Scripts/Network.cs` / `Models.cs`.
- Shared agent skills live in `.agents/skills/` (Codex and Antigravity). Edit them there, then run `node tools/sync-skills.mjs` to update the copy in `.claude/skills/` (Claude Code).

## Division of work

Two AI tools work on this repo. Claude may work anywhere, including UI/UX.

- **Claude (Claude Code)**: gameplay — game rules, economy and balance, progression, products, events, quests and NPC stories, and the server code behind them (`server/`, including `schema.ts` and the message protocol) — **and** client presentation: screens, layout, navigation, flows, HUD, visual style, and the sprites that go with them (`client/Assets/Scripts`, `client/Tools/sprites.js`, `client/Tools/concept/`, `client/Assets/Resources/Sprites/`).
- **Antigravity**: UI/UX, same client areas. It does not change game rules, numbers in `server/src/data.ts`, or server logic.

Working rules:

- Claude is not restricted from restyling screens or redesigning flows.
- When a feature needs both server and client, gameplay goes first: define the state fields and messages (keeping `server/src/rooms/StreetRoom.ts` and `Network.cs` / `Models.cs` in sync), then build the UI on top of that contract.
- If UI work needs a new field or message that does not exist yet, add it on the server rather than inventing one on the client.
- Do not rewrite a file the other tool is working on. Check `git status` first and keep changes small and focused so the two sets of changes merge cleanly.

## Art: generate every piece on its own, compose in code

Each button, icon, character layer and prop is generated as its own sprite. Never generate a
whole screen or a composed layout as one image. Layout and scene composition are written in
C#. A per-asset set stays editable — changing one button or recoloring a palette touches one
sprite or one layout call, 9-slice borders stay pixel-exact, and assets are reused across
screens. See `docs/client-remaster-plan.md`.

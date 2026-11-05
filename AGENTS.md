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
- `server/src/schema.ts` is the synced state. After editing it, run `npm run schema-cs` in `server/` to regenerate `client/Assets/Scripts/Schema/`.
- Message names and payload keys must match between `server/src/rooms/StreetRoom.ts` and `client/Assets/Scripts/Network.cs` / `Models.cs`.
- Shared agent skills live in `.agents/skills/` (Codex and Antigravity). Edit them there, then run `node tools/sync-skills.mjs` to update the copy in `.claude/skills/` (Claude Code).

## Division of work: Claude for gameplay, Antigravity for UI/UX

Two AI tools work on this repo, each with its own area:

- **Claude (Claude Code) designs and builds gameplay**: game rules, economy and balance, progression, products, events, quests and NPC stories, and the server code behind them (`server/`, including `schema.ts` and the message protocol). It also writes the client code that only forwards or applies that state.
- **Antigravity designs and builds UI/UX**: screens, layout, navigation, flows, HUD, animations and feedback, visual style, and the sprites and portraits that go with them (`client/Assets/Scripts` UI code, `client/Tools/sprites.js`, `client/Tools/concept/`, `client/Assets/Resources/Sprites/`).

Working rules:

- Stay in your area. Claude does not restyle screens or redesign flows; Antigravity does not change game rules, numbers in `server/src/data.ts`, or server logic.
- When a feature needs both, gameplay goes first: Claude defines the state fields and messages (and keeps `server/src/rooms/StreetRoom.ts` and `Network.cs` / `Models.cs` in sync), then Antigravity builds the UI on top of that contract.
- If UI work needs a new field or message that does not exist yet, ask for it (note it in the commit or hand-off message) instead of inventing one on the client.
- Do not rewrite a file the other tool is working on. Check `git status` first and keep changes small and focused so the two sets of changes merge cleanly.

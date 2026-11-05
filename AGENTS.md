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

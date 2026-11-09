# Client remaster plan

Scope: throw away the whole client presentation — the widget kit, the screen bodies and the
street scene — and rebuild it. Every button, icon, character and prop is generated as its own
sprite; all layout and scene composition is written in C#.

Server, protocol and synced schema are untouched.

Status: **Route 1 executed on 2026-11-09.** Step 0 specs were written first, then the whole
presentation layer was deleted — 9 C# files (2735 lines), all 188 sprites, 3 manifests, and the
drawing bodies of `client/Tools/sprites.js` (817 → 62 lines). 400 deletions, not yet committed.
The client does not build or run until Wave 3. Waves 1-6 below are still to do.

## 0. Where it stands — handoff, 2026-11-09

Claude did Step 0 through the start of Wave 1 and handed the client rewrite to Antigravity.

**Done and committed:**

- Step 0 specs: `docs/client/{protocol,screens,world,sprite-names}.md`, plus
  `tools/dump-protocol.mjs` to regenerate the protocol table from the server
- `.planning/codebase/` — seven documents from the GSD codebase map
- The delete (Route 1): 9 C# files, 188 sprites, 3 manifests
- `docs/client/art-direction.md` — the visual language, taken from the original Zing Me
  client, and `client/Tools/cut_ui.py` to cut reference frames into components
- Wave 1 foundation: `client/Tools/theme.js` + `client/Assets/Scripts/Theme.cs`, the window
  frame primitive with a skin parameter in `sprites.js`, and 25 exported UI sprites

**Read these first:** `docs/client/art-direction.md`, then `docs/client/screens.md` for the
238 Vietnamese strings that must come across verbatim, then `docs/client/world.md` before any
scene work.

**Two things to know before editing:**

1. `client/Tools/concept/UI_HANG_RONG_SPEC.md` is **superseded for visual style**. It was
   written from an article about the mobile remake and specifies a vintage wood-and-kraft
   theme; the original is bright glossy cartoon with six distinct window skins. Its token
   structure is still a fine skeleton. `docs/client/art-direction.md` is now the reference.
2. `client/Tools/export-runner.mjs` was fixed to run on Node 16 and to find Edge or Chrome
   automatically; `node client/Tools/export-runner.mjs` exports the whole sprite set.

**Next, in order:** the widget kit on top of `Theme.cs` (Screen, Modal, ListView with pooled
rows, Card, StatChip, IconButton, Toast, Confirm), then Wave 2, the street renderer, which is
what `smoke-test-game` needs before anything can run again.

**Not verified:** nothing has been opened in Unity since the delete. The 9-slice borders and
`Theme.PixelsPerUnitMultiplier` are calculated, not seen. `SpriteLibrary` still logs a missing
`street_sprites.txt` until the scene art returns.

## 1. What actually survives

Client code is 3590 lines across 18 files. Removing all three layers leaves this:

| File | Lines | Why it stays |
| --- | --- | --- |
| `Network.cs` | 127 | Colyseus connection, login, room join, message routing |
| `Models.cs` | 333 | DTOs for every message payload — the only written form of the protocol |
| `Schema/*.cs` | 303 | Generated from `server/src/schema.ts` by `npm run schema-cs`. Never hand-edit |
| `SpriteLibrary.cs` | 50 | Sprite loader (name, pivot, 9-slice). Keep the interface, change the backing store — see §5 |
| `SoundFx.cs` | 52 | Audio, not presentation |

Everything else goes: `UIBuilder.cs`, `Game.cs`, `GameExpansion.cs`, `StreetScene.cs`,
`Draw.cs`, `Character.cs`, `CharacterCreator.cs`, `PassingBike.cs`, `StreetObject.cs` —
about **2800 lines**, plus all 188 sprites and most of `client/Tools/sprites.js` (817 lines).

Be clear about the size: this is a client rewrite, not a reskin. It is the largest single
piece of work in the project so far.

## 2. The contracts buried in the code being deleted

This is the part that makes a blind delete expensive. Three separate contracts live only in
the deleted code and nowhere else.

### 2a. Message protocol — in `Game.cs` / `GameExpansion.cs`

There is no schema for messages. `CLAUDE.md` states the names and payload keys are kept in
sync by hand between `server/src/rooms/StreetRoom.ts` and `Network.cs` / `Models.cs`. The call
sites that encode each payload are inside the window bodies being deleted, e.g.

```csharp
_net.Send("plant", new Dictionary<string, object> { ["lot"] = index, ["crop"] = c.id });
_net.Send("build", new Dictionary<string, object> { ["lot"] = index, ["type"] = b.id });
_net.Send("cook",  new Dictionary<string, object> { ["lot"] = index, ["recipe"] = r.id });
```

The repo already has `verify-protocol` to check client and server agree. Run it to produce the
list, and keep it as the regression gate after the rewrite.

### 2b. World coordinate contract — in `StreetScene.cs`

The server sends `x` as `float32` on `Player`, `Customer` and `Stall`, plus `length`,
`slotCount`, `ownerSlots` and `district`. Everything that turns those into screen positions is
client-side and gets deleted with the scene:

| Constant | Value | Role |
| --- | --- | --- |
| `WorldScale` | 100 | 100 server units = 1 Unity unit |
| `FirstSlotX` / `LastSlotMargin` | 220 / 220 | Slot spread across the street length |
| `LotWidth` / `LotSpacing` / `LotStartX` | 4.5 / 4.5 / 3.25 | Lot row behind the sidewalk |
| `LotY` / `LotSoilY` / `LandY` | 1.1 / 1.6 / 0.9 | Ground bands |
| `DepthOrder(y)` | `1000 - y*100` | The entire depth sort of the scene |
| `CropScale` / `LotScale` / `DecorScale` / `ShopScale` | 0.75 / — / 0.9 / 0.72 | Per-object scale |

Lose `WorldScale` or `DepthOrder` and characters sort behind the sidewalk with no error
message. Write these into the spec before deleting.

### 2c. Sprite-name contract — spread across the scene code

Sprite names are built from server data ids at runtime. Renaming an asset silently breaks the
link; there is no compile error, only a `Missing sprite` log.

| Pattern | Source of the id | Count today |
| --- | --- | --- |
| `counter_<product.id>` | `PRODUCTS` in `server/src/data.ts` | 18 of 22 |
| `umbrella_<color>` | Client-side `UmbrellaColor` map keyed by `productId` | 6 |
| `wear_<wearable.id>` | `WEARABLES` | 10 of 10 |
| `deco_<decoration.id>`, fallback `deco_trophy` | `DECORATIONS` | 5 of 5 |
| `building_<lot.building>`, `building_scaffold` | `BuildingType` | 6 of 7 |
| `crop_<crop>_<1..3>`, `banana_stage_<1..3>` | `CROPS` | 3 crops x 3 |
| `bg_land_<district>` | `DISTRICTS` | 4 |
| `vehicle_<vehicle>` | `VEHICLES`, `walk` has none | 3 |
| `body_`, `hair_`, `hairback_`, `brows_`, `lips_`, `cheeks_`, `earrings_` + index | `LOOK_OPTIONS` | layered |
| `npc_*` prefix | `StreetObject` treats a `npc_`-prefixed name as alive | 14 |

**Gaps that already exist and should be closed during the remaster:**

- `counter_soap_bubbles`, `counter_pinwheel`, `counter_plastic_sandals`, `counter_t_shirt`
- `building_cafe` (the `cafe` building type has no sprite; only `prop_cafe_sign` exists)

## 3. Order of work — extract, build, then delete

The user's instruction is that all three layers go. That is the end state. The *order* still
matters, because the three contracts above only exist inside the code being removed.

Two routes:

**Route 1 — delete first. This is the route that was taken.** One commit removes everything,
then the rebuild starts on a blank client. Cleanest history. Cost: `smoke-test-game` cannot
pass until the whole client is back, so there is a long period with no working build. Step 0
was done first, which is what keeps the contracts from having to be re-derived.

**Route 2 — strangler (was recommended, not taken).** Build the new renderer and UI next to the old one
behind one boot flag in `Game.Boot()`, port screen by screen, then delete the old code in a
single commit once `smoke-test-game` and `verify-protocol` both pass on the new path. The game
stays playable the whole way, and each wave is verifiable against the thing it replaces.

Either way, **Step 0 is the same and comes first**: write the three specs from §2 into
`docs/client/` and commit them on their own.

- `docs/client/protocol.md` — generated by `verify-protocol`, one row per message
- `docs/client/world.md` — the constants table and the depth-sort rule
- `docs/client/sprite-names.md` — the naming patterns and the id sources
- `docs/client/screens.md` — one entry per window: state read, messages sent, rows, unlock
  condition (`MenuUnlocks` in `Game.cs:328`)

The 28 windows to cover in `screens.md`:

Login · CharacterCreator · HUD · Tutorial strip · Toast · Modal shell · Stall · CloseStall ·
Staff · Barber · More menu · Decorations · Daily · Wardrobe · Shop · Log · Lot · EmptyLot ·
Crop · Building · Kitchen · Store · Map · Neighbours · Neighbour · Profession · Vehicles ·
Orders · Activities · Meeting · Caro

## 4. Technical decisions now open

Nothing is invested any more, so these are real choices rather than migrations. Current
`client/Packages/manifest.json` has `com.unity.ugui 2.0.0`, `uielements`, `physics2d`, `audio`,
the Colyseus SDK — **no URP, no Addressables, no 2D feature packages**.

| Decision | Recommendation | Reason |
| --- | --- | --- |
| uGUI vs UI Toolkit | **uGUI** | Runtime UI Toolkit still trails on game-feel animation, world-space UI and sprite 9-slice workflows. This game needs floating damage-style text, bubbles over characters and heavy sprite framing |
| Text | **TextMeshPro** | Ships inside `com.unity.ugui` 2.0.0 on Unity 6 — nothing to install. Legacy `UnityEngine.UI.Text` and world-space `TextMesh` both render Vietnamese diacritics badly at small sizes, and the `Outline` component multiplies draw calls. TMP gives SDF outline and shadow for free |
| Asset loading | **Sprite Atlas now, Addressables later** | `Resources/` loads the whole folder into the build with no streaming. Fine at 188 sprites, not at the ~260 this plan produces. Keep `SpriteLibrary.Get(name)` as the only call site so the backing store can change without touching anything else |
| Render pipeline | **Stay on Built-in** | 2D URP would buy 2D lights for rain, night and seasonal events — real but optional. Adding it mid-rewrite doubles the moving parts. Revisit once the new scene is up |
| Depth sorting | **Centralise, keep the formula** | Keep `1000 - y*100` but put it behind one `Depth.Of(y)` call instead of repeating it at 10 sites |
| Safe area | **Fix during the rewrite** | `CanvasScaler` is pinned to 1280x720 with `matchWidthOrHeight = 0.5`. Phones run 19.5:9 to 21:9 with notches |
| List rows | **Pool them** | The old `UIBuilder.Window` rebuilt every row on every open with a `ContentSizeFitter` and no pooling — a GC spike per window on mid-range Android |

## 5. Asset catalog

Target is roughly **260 sprites**, from 188 today. Naming stays English per `CLAUDE.md`;
player-facing text painted onto sprites stays Vietnamese. Every sprite needs a `sprites.txt`
row: `name, pivotX, pivotY, left, bottom, right, top`.

### New UI set (~70, replaces the 25 that exist)

- **Frames, 9-slice (~14)**: `panel_window`, `panel_inset`, `panel_card`, `ribbon_title`,
  `row`, `row_alt`, `row_selected`, `tag`, `tooltip`, `speech_bubble`, `progress_track`,
  `progress_fill`, `scroll_thumb`, `divider`
- **Buttons, 9-slice (~16)**: `btn_primary`, `btn_secondary`, `btn_danger`, `btn_ghost`,
  `btn_gold`, each in `_normal` / `_pressed` / `_disabled`, plus `btn_close`, `btn_square`,
  `btn_tab_on`, `btn_tab_off`. Drawing the pressed state as art, instead of tinting one sprite
  at runtime the way the old kit did, is what stops buttons looking flat
- **Icons, 96x96 (~40, from 10)**: `coin`, `gem`, `energy`, `fame`, `level_star`, `time`,
  `heart`, `home`, `stall`, `shop`, `staff`, `wardrobe`, `log`, `more`, `map`, `bus`,
  `neighbours`, `profession`, `vehicle`, `orders`, `activities`, `daily`, `decoration`,
  `kitchen`, `store`, `crop`, `barber`, `market`, `fortune`, `cafe`, `season`, `quest`,
  `mail`, `settings`, `sound_on`, `sound_off`, `lock`, `check`, `plus`, `minus`, `arrow`,
  `close`, `warning`

### Scene set (~190, all redrawn)

Characters (layered, 160x256 frame, feet on the bottom edge, draw order hairback → body →
earrings → cheeks → brows → lips → hair), NPCs, counters, umbrellas, buildings, lots, crops,
decorations, vehicles, traffic, street background bands, props.

New: `portrait_*` for dialogue and list rows — a new square head-and-shoulders format.

**Keep every id.** Frame sizes and the layer order may change, but a renamed id breaks §2c.

## 6. How each asset is generated

**Route A — procedural, in `sprites.js`.** Deterministic, versioned as code, re-tweakable by
changing a palette constant, and 9-slice borders come out pixel-exact because the generator
knows the corner radius it just drew. The repo already has `draw-sprite` and `export-sprites`
skills for this loop. Ceiling: clean vector cartoon.

**Route B — AI generation, one asset per call.** Higher ceiling for faces and food. Costs:
style and palette drift between calls, backgrounds need removing, 9-slice borders must be
measured by hand, and a tweak means re-generating rather than editing.

| Asset group | Route |
| --- | --- |
| Frames, buttons, progress bars, dividers | A |
| Icons | A |
| Buildings, decorations, scenery, street bands | A |
| Character layers | B |
| Portraits | B |
| Product counters | B |

This session has no image-generation tool. For Route B the deliverable is
`docs/client/asset-prompts.md`: a shared style preamble plus one prompt per asset with the
output size and the transparent-background rule. Generation runs on your side;
`Assets/Editor/SpriteImporter.cs` plus a `sprites.txt` row brings each file in.

## 7. Design system first

No shared style source exists today — colors are hardcoded in both `UIBuilder.cs`
(`TextDark`, `TextMuted`, `TextOutline`) and `sprites.js` (`OUTLINE` plus inline hex per
sprite). That is why nothing can be re-themed.

Create one source of truth, mirrored:

- `client/Tools/theme.js` — read by the art generator
- `client/Assets/Scripts/Theme.cs` — read by the layout and scene code

Holding: palette (8-10 named colors plus one ink/outline), radius scale (3 steps), the
9-slice border table per frame type so `sprites.txt` rows are generated rather than typed,
spacing scale (4/8/12/16/24/32), type scale (5 steps with line heights), elevation rules
(outline width, shadow offset, highlight band).

Highest-leverage step in the plan: change one number, and both the art and the layout move.

## 8. Waves

Each wave ends with a build that runs. Under Route 2 the old path stays reachable until Wave 5.

**Wave 0 — specs.** The four files in `docs/client/`. No code.
**Wave 1 — foundation.** `Theme.cs` + `theme.js`, `Depth`, sprite atlas setup, TMP setup, the
new widget kit, Toast, Modal shell.
**Wave 2 — walking skeleton.** New street renderer: background bands, slots, lots, depth sort,
camera fit, tap routing. Characters rendering from the layer system. Proves §2b before any
screen is ported.
**Wave 3 — entry.** Login, CharacterCreator, HUD, tutorial strip.
**Wave 4 — core loop.** Stall, CloseStall, Shop, Staff, Log.
**Wave 5 — land.** Lot, EmptyLot, Crop, Building, Kitchen, Store, Map. Old code deleted here.
**Wave 6 — social and meta.** Neighbours, Neighbour, Profession, Vehicles, Orders, Wardrobe,
Barber, Decorations, Daily, Activities, Meeting, Caro, More menu.

Gate on every wave: `verify-protocol` clean, `smoke-test-game` reaches the login screen with a
clean console.

## 9. Exact delete list

| Target | Detail |
| --- | --- |
| `client/Assets/Scripts/UIBuilder.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/Game.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/GameExpansion.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/StreetScene.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/Draw.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/Character.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/CharacterCreator.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/PassingBike.cs` | Whole file + `.meta` |
| `client/Assets/Scripts/StreetObject.cs` | Whole file + `.meta` |
| `client/Assets/Resources/Sprites/*.png` | All 188 + `.meta` |
| `client/Assets/Resources/Sprites/sprites.txt`, `street_sprites.txt` | Regenerated, not edited |
| `client/Tools/sprites.js` | Drawing bodies; keep the helpers (`roundRect`, `fill`, `ellipse`, `poly`, `gradient`, `shade`, `drawText`) and the `add()` manifest mechanism |

Not deleted: `Network.cs`, `Models.cs`, `Schema/`, `SpriteLibrary.cs`, `SoundFx.cs`,
`Assets/Editor/SpriteImporter.cs`, `client/Tools/cut_street.py`, `client/Tools/concept/`,
`client/Tools/export-*.mjs`, anything under `server/`.

## 10. Repo rules to settle first

1. **`CLAUDE.md` division of work.** It assigns all of UI/UX, `sprites.js`, `concept/` and
   `Resources/Sprites/` to Antigravity, and forbids Claude from restyling screens. This plan is
   that work, requested directly. Update the "Division of work" section in `CLAUDE.md` and
   `AGENTS.md` in the same change, or the two agents will overwrite each other.
2. **Art direction.** Three concepts already exist in `client/Tools/concept/`:
   `concept-style-1-hom-hinh`, `concept-style-2-moc-mac`, `concept-style-3-gen-z`. Pick one
   before any asset is generated, or a 260-sprite catalog will not hold together.
3. **Orientation.** Portrait-only or landscape too. It changes the HUD and every window frame.
4. **Portrait format.** Frame size for the new `portrait_*` set.

# Sprite name contract

Sprite names are built from server data ids at runtime, so a renamed asset breaks the link with
no compile error — only a `Missing sprite <name>` warning from `SpriteLibrary`. Extracted
before the scene code was deleted.

Every sprite needs a row in `client/Assets/Resources/Sprites/sprites.txt`
(or `street_sprites.txt`, `scene_sprites.txt`, `player_sprites.txt`): `folder/name, pivotX, pivotY, left, bottom, right, top`, where the last four
are the 9-slice border. The file starts with `ppu,200`.

## Folders

The PNGs are sorted by kind. The folder comes from the name prefix, by the rules in `client/Tools/sprite-folders.json`
(first match wins). The generators apply it when they write, so the manifests and the files always agree.
The folder is part of the manifest id only (`npc/npc_worker`); code asks for the bare name (`npc_worker`),
so a sprite name is unique across all folders and moving a sprite never changes the code that uses it.

| Folder | Prefixes |
| --- | --- |
| `wearables/` | `wear_` |
| `npc/` | `npc_` |
| `player/` | `player_` (whole-body player poses, `client/Tools/import_player.py`, see `player-character.md`) |
| `outfits/` | not generated: the female outfit set and `outfits.json`, see `outfits.md` |
| `stalls/` | `counter_`, `umbrella_` |
| `vehicles/` | `vehicle_`, `traffic_`, `wheel_` |
| `scene/` | `bg_`, `scene_`, `prop_`, `deco_` |
| `icons/` | `icon_` |
| `ui/` | `badge_`, `bar_`, `board_`, `btn_`, `chip_`, `coin`, `divider`, `panel_`, `progress_`, `row_`, `scroll_`, `slot_`, `tab_`, `title_`, `toast_`, `tooltip_`, `ui_` |

A new prefix needs a rule there, or its PNG lands in the `Sprites/` root. The manifests and `street_wheels.txt` stay in the root.

## Patterns driven by server data

| Pattern | Id source | Have | Need |
| --- | --- | --- | --- |
| `counter_<product.id>` | `PRODUCTS` in `server/src/data.ts` | 18 | 22 |
| `wear_<wearable.id>` | `WEARABLES` | 0 | 10 |
| `deco_<decoration.id>` | `DECORATIONS` | 0 | 5 |
| `vehicle_<vehicle>` (`walk` has none) | `VEHICLES` | 0 | 3 |
| `body_`, `hair_`, `hairback_`, `brows_`, `lips_`, `cheeks_`, `earrings_` + index | `LOOK_OPTIONS` | 0 | layered |
| `umbrella_<colour>` | client map, see below | 6 | 6 |

Removed with the street remaster (bg_street replaced the backdrop, and lots and slots are no longer drawn):
`building_*`, `crop_*`, `banana_stage_*`, `lot_*`, `slot_owner` / `slot_empty`, `bg_land_*`, the other `deco_*`.
Lots, buildings and crops still exist on the server, so their art has to be drawn again before the street shows them.

Removed later, art to be redrawn (code skips a missing sprite, see below):

- Character layers: every `body_*`, `hair_*`, `hairback_*`, `brows_*`, `lips_*`, `cheeks_*`, `earrings_*` and `shadow`.
  Male players now use the whole-body `player_male` poses instead (see `player-character.md`); a female player
  falls back to the street look `npc_worker`. The creator's hair and face options change nothing on screen.
- All `wear_*`, `vehicle_*` and `deco_peach_tree`: worn items, vehicles and the Tết decoration are not drawn.
- `bg_sky`, `bg_city`: the camera background fills above the street; the login screen has no city backdrop.
- `ui_tag`, `ui_speech_bubble`: name tags and speech bubbles show their text with no frame behind it.
- `wheel_spin`: passing riders' wheels do not turn.
- NPCs `npc_girl`, `npc_tattooed_man`, `npc_green_cap_girl` (dropped from the street, customer looks and
  `StreetObject`), and the neighbour portraits `npc_leader`, `npc_tea_seller`, `npc_driver`, `npc_grocer`, `npc_shipper`.
  `server/src/stories.ts` still names those portraits; the client does not draw them.

### Gaps to close during the remaster

Missing counters — the product exists in `PRODUCTS` but has no stall art:

- `counter_soap_bubbles`
- `counter_pinwheel`
- `counter_plastic_sandals`
- `counter_t_shirt`

### Umbrella colour map

Client-side only, keyed by `productId`, default `red`. Six umbrella sprites:
`umbrella_red`, `_green`, `_blue`, `_yellow`, `_purple`, `_orange`.

| Colour | Products |
| --- | --- |
| yellow | `banana`, `sticky_rice`, `tofu_noodles` |
| orange | `fried_banana`, `moon_cake`, `flowers` |
| purple | `banana_soup`, `grandma_soup`, `sweet_soup` |
| green | `fresh_cane`, `banh_chung`, `sugarcane_juice`, `rambutan`, `fresh_milk` |
| red | `banana_cake`, `banh_mi` |
| blue | `iced_tea`, `popsicle` |

Products with no entry fall back to `umbrella_red`. The four missing counters above have no
colour either.

## Prefixes with behaviour attached

- `npc_*` — `StreetObject` treats any sprite whose name starts with `npc_` as alive, so it
  reacts to taps. 18 such sprites today, including `_step1` / `_step2` walk frames.
- `*_step1` / `*_step2` — walk frames for bodies and NPCs.
- `ui_*` — frames and widget art used by the UI kit.
- `icon_*` — bottom-bar and row icons.
- `bg_*` — backdrops; `bg_street` is the whole street (city, river, wall, sidewalk, road).
- `scene_*`, `prop_*` — hand-cut street scenery from `client/Tools/import_scene.py`.
- `deco_*` — festival decorations.
- `traffic_*` — passing riders, client-side decoration, no server state.

## UI sprites being replaced

15 frames: `ui_avatar_frame`, `ui_bar`, `ui_bar_fill`, `ui_bolt`, `ui_button_blue`,
`ui_button_gray`, `ui_button_green`, `ui_button_orange`, `ui_button_red`, `ui_level_star`,
`ui_panel`, `ui_ribbon`, `ui_row`, `ui_speech_bubble`, `ui_tag` (the last two are deleted).

10 icons: `icon_banana`, `icon_bus`, `icon_fame`, `icon_home`, `icon_log`, `icon_more`,
`icon_shop`, `icon_staff`, `icon_stall`, `icon_wardrobe`.

`UIBuilder.Button` picked its frame as `"ui_button_" + color` where colour was one of
`orange`, `green`, `blue`, `red`, `gray`. The rebuilt kit uses named roles
(`btn_primary`, `btn_secondary`, `btn_danger`, …) with real `_pressed` and `_disabled` art
instead of a runtime tint.

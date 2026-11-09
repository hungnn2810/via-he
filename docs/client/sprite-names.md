# Sprite name contract

Sprite names are built from server data ids at runtime, so a renamed asset breaks the link with
no compile error — only a `Missing sprite <name>` warning from `SpriteLibrary`. Extracted
before the scene code was deleted.

Every sprite needs a row in `client/Assets/Resources/Sprites/sprites.txt`
(or `street_sprites.txt`): `name, pivotX, pivotY, left, bottom, right, top`, where the last four
are the 9-slice border. The file starts with `ppu,200`.

## Patterns driven by server data

| Pattern | Id source | Have | Need |
| --- | --- | --- | --- |
| `counter_<product.id>` | `PRODUCTS` in `server/src/data.ts` | 18 | 22 |
| `wear_<wearable.id>` | `WEARABLES` | 10 | 10 |
| `deco_<decoration.id>` + `deco_trophy` fallback | `DECORATIONS` | 5 | 5 |
| `building_<BuildingType>` + `building_scaffold` | `BuildingType` union | 6 | 7 |
| `crop_<crop>_<1..3>` and `banana_stage_<1..3>` | `CROPS` | 3 x 3 | 3 x 3 |
| `bg_land_<district>` | `DISTRICTS` index | 4 | 4 |
| `vehicle_<vehicle>` (`walk` has none) | `VEHICLES` | 3 | 3 |
| `body_`, `hair_`, `hairback_`, `brows_`, `lips_`, `cheeks_`, `earrings_` + index | `LOOK_OPTIONS` | layered | — |
| `umbrella_<colour>` | client map, see below | 6 | 6 |
| `slot_owner` / `slot_empty` | `ownerSlots` threshold | 2 | 2 |

### Gaps to close during the remaster

Missing counters — the product exists in `PRODUCTS` but has no stall art:

- `counter_soap_bubbles`
- `counter_pinwheel`
- `counter_plastic_sandals`
- `counter_t_shirt`

Missing building:

- `building_cafe` (the `cafe` type is in `BuildingType`; only `prop_cafe_sign` exists today)

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
  reacts to taps. 27 such sprites today, including `_step1` / `_step2` walk frames.
- `*_step1` / `*_step2` — walk frames for bodies and NPCs.
- `ui_*` — frames and widget art used by the UI kit.
- `icon_*` — bottom-bar and row icons.
- `bg_*` — parallax backdrops.
- `street_*`, `road`, `sidewalk`, `curb` — street bands, drawn tiled.
- `prop_*`, `deco_*` — scenery.
- `lot_*` — lot states.
- `traffic_*`, `bike_*` — client-side decoration, no server state.

## UI sprites being replaced

15 frames: `ui_avatar_frame`, `ui_bar`, `ui_bar_fill`, `ui_bolt`, `ui_button_blue`,
`ui_button_gray`, `ui_button_green`, `ui_button_orange`, `ui_button_red`, `ui_level_star`,
`ui_panel`, `ui_ribbon`, `ui_row`, `ui_speech_bubble`, `ui_tag`.

10 icons: `icon_banana`, `icon_bus`, `icon_fame`, `icon_home`, `icon_log`, `icon_more`,
`icon_shop`, `icon_staff`, `icon_stall`, `icon_wardrobe`.

`UIBuilder.Button` picked its frame as `"ui_button_" + color` where colour was one of
`orange`, `green`, `blue`, `red`, `gray`. The rebuilt kit uses named roles
(`btn_primary`, `btn_secondary`, `btn_danger`, …) with real `_pressed` and `_disabled` art
instead of a runtime tint.

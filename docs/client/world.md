# World coordinate and scene contract

Extracted from `StreetScene.cs`, `Draw.cs`, `Character.cs` and `PassingBike.cs` before they
were deleted. None of this is in the server or the schema, so it has to be reproduced exactly
or the scene silently renders wrong — characters sort behind the sidewalk, stalls land off the
slots, and nothing logs an error.

## What the server sends

From `server/src/schema.ts`:

| Field | Type | On |
| --- | --- | --- |
| `x` | `float32` | `Player`, `Customer`, `Stall` |
| `targetX` | `float32` | `Player` |
| `length` | number | `StreetState` — street length in server units |
| `slotCount` | `uint8` | `StreetState`, default 8 |
| `ownerSlots` | `uint8` | `StreetState`, default 2 |
| `district` | number | `StreetState` |
| `isPublic` | boolean | `StreetState` — server-owned public district |
| `shard` | `uint16` | `StreetState` — which copy of a crowded public district |
| `lots` | `MapSchema<LotState>` | `StreetState` |
| `dayPhase`, `dayPhaseName` | string | `StreetState` — `morning` / `noon` / `afternoon` / `evening` |
| `gameMinute` | `uint16` | `StreetState` — in-game time of day, 0..1439, steps of 5 |
| `weather`, `weatherName` | string | `StreetState` — `sunny` / `cloudy` / `hot` / `rain` |
| `weatherDialogue` | string | `StreetState` — bystander line key (`rain`, `hot_sun`) or empty |
| `weatherEndsAt` | `float64` | `StreetState` — when the current weather spell may change |
| `skyBoost` | string | `StreetState` — product ids customers crave because of time of day and weather |

## Time of day and weather

`server/src/weather.ts` works both out from the clock alone, so every street shows the same sky. One game
day is 44 real minutes (morning 12, noon 8, afternoon 10, evening 14); the weather can change every 10
minutes. Each phase and weather adds `EventRules` (boosted products, spawn factor; rain waters gardens).
`WeatherView.cs` (added by `StreetScene.Init`) draws all of it from code-built shapes:

- Sun on an arc 6h→18h (bigger, pulsing glow when `hot`), moon and twinkling stars at night; hidden by rain,
  dimmed by cloud. Sky bodies and clouds sit at orders -987..-981, on the backdrop and behind all scenery.
- 1–10 drifting clouds per weather, darker in rain and at night.
- Rain: slanted streaks at `Depth.Rain` that splash on the sidewalk/road band, puddles that fill during
  rain and dry slowly after, lightning flashes.
- Warm lamp glow at every open stall by night (`Depth.Traffic + 50`).
- Umbrellas open over players (not over stall sellers) while it rains.
- No colour tint over the street: the art keeps its own colours at every hour and in every weather.
- A toast on each phase or weather change lists `skyBoost` product names. The HUD shows `Sáng 07:30 · Nắng đẹp` under the feature cluster.

Positions arrive in **server units**. Everything else below is client-side.

## Districts

- A player owns 1 to 10 districts (`MAX_DISTRICTS`). District 1 (`Bãi đất`, index 0) is free and is the
  street scene described in this file. The rest are bought in order with `buyDistrict`; price, level and
  fame come from `DISTRICTS` in `server/src/data.ts` and reach the client in `catalog.districts`.
- Joining your own district: `joinOrCreate('street', { ownerId, district })`. Other players' districts the
  same way, through `GET /api/streets`.
- **Public districts** (`PUBLIC_DISTRICTS`: `public-market`, `public-plaza`) belong to the server. Anyone
  can sell there: `ownerSlots` is 0, `slotCount` is `BALANCE.publicSlots` (12), there is no sidewalk fee,
  no farming or building, and friend/gift actions are refused. Join with
  `joinOrCreate('street', { ownerId: 'public-market', district: 0, shard })`, where `shard` comes from
  `GET /api/public` (the first shard with fewer than `BALANCE.roomShardClients` players, else a new one).
  `StreetState.isPublic` is true there, so the scene skips the `KHU PHỐ 1` pole.

## Scale

```
WorldScale = 100          // 100 server units = 1 Unity unit
```

Unity position = server `x` / `WorldScale`.

## Slot layout (sidewalk stalls)

```
FirstSlotX     = 220      // server units from the street start
LastSlotMargin = 220      // server units kept free at the end

SlotX(slot, st) = (FirstSlotX + slot * (st.length - FirstSlotX - LastSlotMargin)
                   / (st.slotCount - 1)) / WorldScale
```

Slots below `st.ownerSlots` use the `slot_owner` sprite, the rest `slot_empty`.

## Lot layout (land behind the sidewalk)

```
LotWidth     = 4.5
LotSpacing   = LotWidth          // 4.5
LotStartX    = 1 + LotWidth / 2  // 3.25
LotHalfWidth = LotWidth / 2      // 2.25

LotX(index) = LotStartX + index * LotSpacing
```

## Ground bands (Unity units, y)

| Name | Value | What sits there |
| --- | --- | --- |
| `LotY` | 1.1 | Lot contents (crops, buildings) |
| `LotSoilY` | 1.6 | Soil sprite |
| `LandY` | 0.9 | District land strip (`bg_land_<district>`), tiled, height 1.5, order -972 |
| `BystanderY` | 0.2 | Idle NPCs between slots |
| `ParkedBikeY` | -1.85 | Parked bikes |
| `RiverCityY` | 2.1 | `bg_river_city` backdrop |

Plants stand at `LotY + 0.2`. Decorations sit at `LotX(gap) + LotSpacing / 2`, y `LotY`,
scale 0.7, order -944.

## Depth sort

```
DepthOrder(y) = 1000 - round(y * 100)
```

Higher on screen = further away = drawn first. This single rule orders the whole scene; it was
repeated at about ten call sites. In the rebuild put it behind one `Depth.Of(y)` helper.

Fixed orders observed: land -972, slots -920, crops -945, decorations -944, stall umbrella 0,
stall counter 10.

## Scales

| Name | Value |
| --- | --- |
| `CropScale` | 0.75 |
| `DecorScale` | 0.9 |
| `ShopScale` | 0.72 |

## Camera

```
CameraY = 0.3             // starting height only
orthographicSize = (length + 2 * ScreenMargin) / 2 / aspect
position         = (length / 2, RoadBottom + orthographicSize, -10)
```

`FitCamera()` takes over once a street has loaded.

## Sprite pivots and units

`SpriteLibrary` builds every sprite with `PPU = 200` (200 px = 1 Unity unit) and a pivot read
from `sprites.txt`. Character layers all share a 160x256 frame with the feet on the bottom
edge, so layers stack with no per-layer offset.

## Character composition

`look` is a comma-separated string: `gender, hair, brows, lips, cheeks, earrings`.
`outfit` is `hat, shirt, pants, acc` (wearable ids, empty string for none).

Sprites and their layer order relative to the body:

| Layer | Sprite | Order |
| --- | --- | --- |
| Hair back | `hairback_{gender}_{hair}` | -1 |
| Body | `body_{gender}` | 0 |
| Earrings | `earrings_{earrings}` | 1 |
| Cheeks | `cheeks_{cheeks}` | 2 |
| Brows | `brows_{brows}` | 3 |
| Lips | `lips_{lips}` | 4 |
| Hair | `hair_{gender}_{hair}` | 5 |
| Pants | `wear_{pants}` | 6 |
| Shirt | `wear_{shirt}` | 7 |
| Hat | `wear_{hat}` | 9 |
| Accessory | `wear_{acc}` | 10 |

None of these layer sprites are in the set right now (see `sprite-names.md`). `Parts` adds only the
layers `SpriteLibrary` has. For the body it prefers the whole-body `player_{gender}` poses, then
`body_{gender}`, then the `npc_worker` look; see `player-character.md`.

Index 0 of `cheeks` and `earrings` means none and has no sprite. Walk frames use
`*_step1` / `*_step2` variants of the body and NPC sprites. `LOOK_OPTIONS` in
`server/src/data.ts` caps the indices: hair 4, brows 4, lips 4, cheeks 3, earrings 4.

A vehicle is drawn as `vehicle_{vehicle}` at the body position, two orders behind the body.
`walk` has no sprite.

## Tap routing

`StreetScene` raised four events, which `Game` turned into windows:

| Event | Opens |
| --- | --- |
| `OnEmptySlotTapped(int slot)` | Stall window for that slot |
| `OnOwnStallTapped(Stall)` | Close-stall confirm |
| `OnLotTapped(int index)` | Lot / EmptyLot / Crop / Building / Kitchen |
| `OnObjectAction(StreetAction)` | `Staff`, `Shop`, `Wardrobe`, `Bus` |

`StreetObject` treated any sprite whose name starts with `npc_` as alive (it reacts to taps).
That prefix is part of the contract.

## Client-side decoration, no server state

Passing motorbikes (`RunMotorbikes`), bystanders between slots and parked bikes are purely local.
The weather effects are local drawing driven by `weather` and `gameMinute`. Bystander and parked-bike choice is `gap / 2 % count`
over the `Bystanders` and `ParkedBikes` arrays; stall umbrella colour comes from a client-side
`UmbrellaColor` map keyed by `productId`, defaulting to `red`.

# Female outfit art

70 hand-generated outfit pieces for the female character, imported from the `outfits-vietnam` pack.
Source art only: nothing here is loaded at runtime yet.

## Where it lives

```
client/Assets/Art/Outfits/
├── outfits.json              catalog: id, slot, Vietnamese display text, file, size, original file name
└── female/
    ├── hair/      10 pieces
    ├── tops/      20 pieces
    ├── bottoms/   20 pieces   (trousers and skirts)
    └── shoes/     20 pieces   (shoes and sandals)
```

`Assets/Art/` is for source art that is not loaded by name. It is deliberately outside `Resources/`,
because everything under `Resources/` ships in the build and these 70 PNGs are about 62 MB. Runtime
sprites that are looked up by name stay in `Resources/Sprites/` (see `sprite-names.md`).

## Naming

`outfit_<slot>_<nn>_<english_slug>.png`, for example `outfit_tops_01_ao_dai_white.png`.

- The `outfit_` prefix keeps these ids clear of the `hair_<gender>_<n>` layers of the character creator.
- Vietnamese garment names that are proper terms stay (`ao_dai`, `ao_ba_ba`, `ao_yem`, `ao_tu_than`), as `wear_ao_dai` already does.
- The Vietnamese display text for the player is in `outfits.json` (`name`), taken from the pack's own catalog.

## Format

- RGBA, transparent background, one piece per file, drawn on a full canvas: 65 files are 1808x1344, five are 1920x1280
  (`tops_15`, `shoes_03`, `shoes_07`, `shoes_11`, `shoes_20`).
- Import settings come from `client/Assets/Editor/SpriteImporter.cs` (Sprite, no mipmaps, compressed, max 2048).

## Before these can be worn in game

These pieces are not on the character's 160x256 layer frame yet, so they cannot replace `wear_<id>` as they are.

- Scale and position: pieces were drawn front-on on a big canvas, the base body is a 3/4 view at 160x256, feet on the bottom edge.
  Each piece needs trimming, scaling and a pivot, written to a manifest row so `SpriteLibrary` can load it.
- Slots: the server knows `hat`, `shirt`, `pants`, `acc` (`WearSlot` in `server/src/data.ts`). The pack adds `hair` and `shoes`,
  and splits skirts from trousers inside one `bottoms` slot. A slot and draw-order decision comes first, then `WEARABLES`
  entries with price and unlock level, then the `Character.Parts` layers.

## Known defects in the pack

- `outfit_shoes_19_flat_sandals_blue` shows one sandal, not a pair.
- `outfit_tops_03_ao_dai_gold_brocade` is drawn almost front-on; three skirts (`bottoms_09`, `_10`, `_11`) are front-on too.
- `outfit_hair_08_short_curled` looks close to `outfit_hair_07_bob_black`.
- White pieces (`tops_01`, `tops_05`, `tops_19`, `bottoms_09`, `bottoms_16`, `shoes_03`, `shoes_07`, `shoes_09`, `shoes_17`) were hard to cut out
  and can show a thin light fringe or a little background on dark backdrops.

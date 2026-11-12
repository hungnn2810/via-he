# Player character art

The male player is drawn as whole-body poses (one image per pose, no separate hair or face layers), imported
from the `nv-nam` set. There is no female set yet: a female player falls back to the street look `npc_worker`.

## Import

```
python client/Tools/import_player.py <folder with the nv-nam images>
```

The script mirrors each pose (the source faces left, street sprites face right and `Character` flips them by
walking direction), trims it, scales it so a standing figure is 310 px tall (NPCs are about 290 px at PPU 200),
and centres it on the head so the head does not jump between walk frames. Source files come in families drawn at
different scales, so each family gets one scale. Output goes to `Resources/Sprites/player/` and the manifest
`Resources/Sprites/player_sprites.txt`, which `SpriteLibrary` loads after the other manifests.

| Sprite | Source file | Used by |
| --- | --- | --- |
| `player_male` | `34-trai-dung-thang` | standing, portraits (HUD avatar, creator preview) |
| `player_male_step1` … `_step4` | `di34-01` … `di34-04` | walk cycle (four frames) |
| `player_male_happy` | `cx-01-vui-cuoi-lon-34` | `Character.Cheer()` |
| `player_male_surprised` | `cx-04-ngac-nhien-34` | `Character.Surprise()` |
| `player_male_sad`, `_angry`, `_tired` | `cx-02`, `cx-03`, `cx-05` | not used yet |
| `player_male_wave`, `_arms_crossed` | `34-trai-vay-tay`, `34-trai-khoanh-tay` | not used yet |

The other poses in the set (front view, sitting, bowing, holding money, carrying a basket) are not imported.
Add a row to `POSES` in the script to bring one in; poses that are not standing need their own family so the
scale stays right.

## How the client picks it

`Character.Parts(look, outfit)` reads the gender from the `look` string. It uses `player_<gender>` when that
sprite exists, else the layered `body_<gender>`, else `npc_worker`. A look with a `_step4` frame walks through
four frames; other looks keep the two-step cycle with the standing frame in between. While `Cheer()` or
`Surprise()` runs, a standing character with a `_happy` or `_surprised` frame shows it.

The character creator's hair, brows, lips, cheeks and earrings choices are still saved on the server, but the
whole-body art has no layers for them, so they change nothing on screen. Worn items (`wear_*`) have no art either.

# Art direction

Decided 2026-11-09. This resolves open question 2 in `docs/client-remaster-plan.md`.

## The rule

- **Gameplay** may be studied from Hàng Rong Mobile, the fan remake.
- **Visuals** — buttons, panels, icons, characters, props, HUD — follow the **original Hàng
  Rong on Zing Me**, not the mobile remake.
- Reference screenshots are cut into components, and every component is then **drawn fresh**
  in `client/Tools/sprites.js`. Cut crops are reference material only; they are never shipped
  as game art, and `client/Tools/ui_ref/` is gitignored so third-party screenshots stay out of
  the repository.
- What is taken from the reference is the **visual language** — palette, outline weight, panel
  anatomy, proportion, layout. Interface furniture (frames, buttons, bars, grids, tabs) is
  generic enough to build in that language directly. Characters, mascots, signage and logos
  are **designed originally** in the same style rather than recreated; the original art is
  VNG's, and redrawing it line for line would copy it rather than study it. IP ownership is
  recorded in `.planning/codebase/CONCERNS.md`.

## Reference material already in the repo

| File | What it shows |
| --- | --- |
| `client/Tools/street_source_2.png` (800x606) | **The best reference.** Full original client: top HUD, icon cluster, buff banner, bottom dock with street tabs, bus button, street signs, scene |
| `client/Tools/street_source.jpg` (834x593) | Original client at the wholesale market (`CHỢ ĐẦU MỐI`), build `0.7.0`. Scene, NPCs, speech bubble, less UI chrome |
| `client/Tools/concept/crops/hang_rong_*_enhanced_*.jpg` | Three AI-enhanced character references, already used for the character layers |
| `client/Tools/ui_ref/ref_*.png` (9 frames) | Pulled from a recording of the original client, cropped to the game canvas (700x595). Gitignored — regenerate from the source video |

`street_source_2.png` is build `0.9.5`, account `ikaros`, level 62. The recording is a browser
session on `me.zing.vn/apps/hangrong`, dated 30/11/2013 in the in-game timestamps, account at
level 211 — so it is a late build with most systems unlocked.

### The nine frames

| File | Surface it documents |
| --- | --- |
| `ref_confirm_dialog.png` | Smallest dialog: title, one line of body, two buttons |
| `ref_window_grid_barber.png` | Three-column window: character preview, thumbnail grid, info panel |
| `ref_window_list_log.png` | List window: rows as cards, item-slot strips, row action button, pagination |
| `ref_popup_reward.png` | Reward popup over a dimmed scene: stars, ribbon, reward lines |
| `ref_panel_scroll.png` | Parchment/scroll panel with a speech-tail tooltip |
| `ref_window_gacha_grid.png` | Tall window: milestone track, 3x3 item grid, two-button footer, prize shelf |
| `ref_window_chest_grid.png` | Wood-framed window with corner brackets and a 3x3 grid |
| `ref_screen_character.png` | Full-screen layout: avatar + stats, equipment grid, bonus text panel, roster strip |
| `ref_street_dock.png` | Street scene with the bottom dock and street tabs |

## What the original actually looks like

Read off the screenshots, not from prose.

**Overall:** bright cartoon, high saturation, cyan sky. Every element carries a thin dark
outline (roughly 2px at 800px wide, dark brown-black). White or near-white panel fills.
Gold/amber display numerals with a dark outline. Nothing is flat — chips and buttons have a
glossy top highlight.

**Palette, sampled from the screenshot:**

| Role | Colour |
| --- | --- |
| Outline | dark brown-black, near `#2b1d12` |
| Panel fill | white to `#f4f4ef` |
| Display numerals | gold-amber with dark outline |
| Primary button | blue gradient, white outer rim (`XE BUÝT`, `Chat`, arrows) |
| Dock bar | dark navy, rounded ends, lighter top edge |
| Street tab plaque | grey-silver with a screw head at the top |
| Buff banner title | gold-amber arc text over a white rounded panel |
| Accent figures in text | blue for percentages, red for costs |
| Sky / background | cyan to pale blue |

**This contradicts the spec already in the repo.** `client/Tools/concept/UI_HANG_RONG_SPEC.md`
(146 lines, by Antigravity) describes a vintage theme — wood frames, kraft paper, red festive
ribbons, brass screws, candy-gloss buttons. It was derived from a Thế Giới Di Động article
about the **mobile remake**, not from the original, and its own comparison table calls the
current blue UI "cold and modern". The original is not vintage wood. It is bright glossy
cartoon on white and cyan with a navy dock.

That spec is therefore **superseded for visual style**. Its design-token structure (naming,
the idea of one token table) is still a good skeleton and should be reused with the colours
above.

## Component inventory, read off `street_source_2.png`

### Top-left: player block

- `hud_level_badge` — white rounded badge, gold-brown outline, large level numerals, `VIP` on
  a dark brown ribbon underneath, a blue five-point star pinned at the upper left
- `hud_xp_bar` — thin capsule, blue-to-green fill, dark outline
- `hud_name` — outlined comic text, gold on dark
- `hud_money` — coin glyph plus large gold outlined numerals, thousands separated with `.`
- `hud_stat_row` x3 — small glyph plus outlined value: a red cross with a coin, a pink heart
  (`0 + 56`), a green clover (`102 + 21%`)

### Top-centre

- `hud_icon_square` x2 — quest notebook and a pointing hand, each with a red count badge at
  the upper right
- build number printed as plain small text

### Top-right: the icon cluster

Seven soft-square icons in a row, each with a red notification badge: globe (map), green crate
labelled `CHỢ SỈ`, a person (`SHOP`), a pack, a camera, a frog in a gold wreath, a food item.
Then `hud_timer` — a dark pill with `01:01:51`.

### Floating

- `banner_buff` — gold arc title (`May mắn`) over a **pale green** rounded panel with a dark
  outline and a white inner keyline; body lines are dark with coloured figures (blue for a
  percentage, red for a cost)
- `tooltip_small` — white rounded box with a tail, for prompts (`Mời bạn tạo mật khẩu`)
- `sign_district` — blue arrow-shaped street sign (`KHU PHỐ 1`)
- `sign_for_sale` — small white plaque on a post (`BÁN ĐẤT`)
- `btn_bus` — blue button, thick white rim, bus glyph over the label `XE BUÝT`
- `marker_arrow` — large pink downward arrow pointing at the thing the tutorial means

### Bottom dock

- `dock_bar` — full width, dark navy, rounded ends, lighter top edge
- `dock_icon` — gold padlock with a red `!` badge; shop buildings at both ends
- `tab_street` x8 — grey-silver rounded plaque with a screw head, label `KP 1` … `KP 8`,
  joined by a thin dashed line, tiny occupancy count beneath each
- `btn_arrow` x2 — blue triangles at both ends of the tab strip
- `btn_chat` — blue button at the far right

## What the original HUD says about gameplay

Studying the original screenshot turned out to answer a protocol question too. The features
its HUD puts on screen line up almost exactly with the server messages that the deleted client
never exposed (`docs/client/protocol.md`, and the 18 unexposed handlers in
`.planning/codebase/CONCERNS.md`).

| Seen in the original UI | Server already supports |
| --- | --- |
| `CHỢ SỈ` crate icon | `marketPrices`, `marketBuy`, `marketCredit` — never exposed |
| `May mắn` buff banner | `drawFortune`, `shareFortune`, push `fortune` — never exposed |
| Countdown timer in the top bar | `season`, `claimSeasonGoal`, `claimSeasonTier` — never exposed |
| `bắt nạt hàng xóm` in the buff text | neighbour harassment, the original's antagonistic loop |
| `XE BUÝT` button | `/api/streets` plus `JoinStreet` — was exposed |
| `KP 1` … `KP 8` dock tabs with occupancy counts | districts and `slotCount`; the per-tab count has no message yet |
| `BÁN ĐẤT` plaque | lot purchase — was exposed |
| Shop building icons at both dock ends | `cafe` (`sitCafe`, `leaveCafe`) — never exposed |

So the rebuild is not only redrawing 41 screens. The original's own HUD is the argument for
surfacing the wholesale market, fortune, season and café that the server has been carrying
unused. Two things in the original have **no** server support and need a decision before they
are drawn: the `VIP` level badge and the pet (the frog in a gold wreath).

Gameplay may be studied from Hàng Rong Mobile, but note that the server here already defines
its own economy in `server/src/data.ts` — 22 products, 10 wearables, 7 building types, 3 crops,
5 recipes, 4 districts, 4 vehicles, 3 professions. Research should fill gaps in that model,
not replace it.

## The original has several panel skins, not one

The first reading of this document, taken from `street_source_2.png` alone, described a single
white-and-cyan HUD. The recording shows that is only the HUD. Windows come in distinct skins,
and the rebuilt kit needs the same range rather than one frame reused everywhere.

| Skin | Where it is used | Anatomy |
| --- | --- | --- |
| **Amber** | Logs and lists (`Nhật ký cuộc chiến`) | Thick orange frame, dark outer line plus a bright inner keyline, cream inner board holding row cards |
| **Blue** | System and feature windows (barber, code entry) | Mid-blue body, lighter blue inner panels, white keyline, columns of sub-panels |
| **Parchment** | Gacha and progress (`Balo vàng`) | Cream board, scroll-roll top and bottom, milestone track across the head, two-button footer |
| **Wood** | Chests (`Rương đá may mắn`) | Plank fill, metal corner brackets, grid of recessed cells |
| **Overlay** | Rewards, victory | No frame — dimmed scene, gold ribbon banner, star cluster, reward lines, one button |
| **Novelty** | Photo capture | The window is drawn as the object itself; one-off, not part of the kit |

Shared across all of them: the same dark outline, the same blue circular close button pinned
at the top-right corner, gold outlined display text, and green for the positive row action.

That gives the kit its real shape: one frame primitive with a skin parameter, not six separate
window widgets. Pick two skins to build first — amber for lists and blue for forms — since
between them they cover most of the 41 screens.

## Information architecture

Decided 2026-11-09. Binding, not advisory — the sections above describe how things look, this
one describes where things live.

The first rebuilt HUD kept the old Vỉa Hè Online layout and reskinned it: eight labelled
buttons along the bottom (`Dọn hàng`, `Nhân viên`, `Tủ đồ`, `Cửa hàng`, `Nhật ký`, `Xe buýt`,
`Về nhà`, `Thêm`), the same set recorded in `docs/client/screens.md` for the deleted client.
The original organises the screen on a different principle, and that principle is what the
remaster adopts.

**The principle: the scene is the verb, the dock is the place, the cluster is the feature.**

| Zone | Holds | Why |
| --- | --- | --- |
| The scene itself | Every core-loop action: tap an empty slot to open a stall, tap a lot to plant or build, tap a customer to invite, tap your own stall to close it | These already exist as `OnEmptySlotTapped`, `OnLotTapped`, `OnOwnStallTapped`, `OnObjectAction` in the street renderer. A bar button that opens the same window is a second route to the same thing |
| Bottom dock | Where you are and where you can go: district tabs, home, bus, chat | Spatial navigation only |
| Top-right cluster | Feature entry points, each able to carry a notification count | One place that scales as features land |
| Top-left block | Who you are and what you hold: level, name, money, resources | Read-only status |

### Top-left: the player block

Level badge, then name, then money, then the resource rows. Flat and scannable, not a single
composite widget. Sprites: the level badge, `progress_track` + `progress_fill` for XP,
`chip_navy` for each resource row.

Shows: level and XP, player name, money, and one row each for the resources the economy
actually tracks — stock against `storeCapacity`, and fame. Nothing that needs a request to
display.

### Top-right: the feature cluster

A row of icon buttons, each a square icon with an optional red count badge
(`badge_red`), and a countdown pill beside them for the running season or event.

Seven entries, chosen so that the cluster covers the features the server already supports but
the old client never exposed (see "What the original HUD says about gameplay" above):

| Icon | Opens | Server side | Badge means |
| --- | --- | --- | --- |
| `map` | Bản đồ khu phố | `buyDistrict` | a district is newly affordable |
| `market` | Chợ sỉ | `marketPrices`, `marketBuy`, `marketCredit` — **never exposed** | credit available to spend |
| `neighbours` | Hàng xóm | `finishQuest`, `neighbourGift` | quests whose items you already hold |
| `orders` | Đơn giao | `sendDelivery`, `collectDeliveries` | deliveries finished and unclaimed |
| `season` | Mùa giải | `season`, `claimSeasonGoal`, `claimSeasonTier` — **never exposed** | rewards claimable |
| `fortune` | Xem bói | `drawFortune`, `shareFortune` — **never exposed** | today's draw unused |
| `activities` | Hoạt động xóm phố | `shuttleStart`, `caroStart`, `startWedding`, `vote` | an activity is running |

Everything else — wardrobe, clothes shop, staff, barber, decorations, daily tasks, warehouse,
profession, vehicles, leaderboard, café — goes in the `Thêm` overflow, opened from the dock.
Promote an entry out of the overflow only when it earns a badge of its own.

### Bottom dock

A navy bar (`bar_navy`) spanning the width, holding, left to right:

1. `home` — back to your own street
2. The district tab strip: one tab per district in `DISTRICTS` — four today, `Bãi đất`,
   `Ven sông`, `Gần chợ`, `Phố cổ`, unlocking at levels 1, 5, 10 and 15. `tab_on` for the one
   you are in, `tab_off` for the others, `icon_lock` over any district you have not bought.
   Tapping a locked tab opens the map window rather than failing silently.
3. `bus` — the street list, for visiting another player's street inside the current district
4. `more` — the overflow menu
5. The chat field and its send button

The tab strip is the dock's reason to exist. It is the one control that tells a player the
world is bigger than the screen they are on.

### What this needs from the server

Per `CLAUDE.md`, a badge that has no data behind it gets added on the server, not invented on
the client. Three of the seven can be computed from state the client already holds
(`neighbours`, `orders`, `map`). The rest need something new:

- **`market`** — whether any wholesale credit is unspent. `marketCredit` exists as a message
  but nothing reports the balance passively.
- **`season`** — whether a goal or tier is claimable. `season` is a request today; the badge
  needs either a pushed field on the profile or a cheap count.
- **`fortune`** — whether today's draw is still unused. No field exists.
- **District occupancy under each tab** needs nothing new. `StreetSummary` from
  `/api/streets` already carries `district`, `playerCount` and `stallCount`, so the client
  rolls the counts up itself. Refresh it on the same cadence as the bus window, not per frame.

Define these on the server first, then build the badges on top. Until they exist, the icons
ship without badges rather than with made-up ones.

### Migration from the current HUD

- `Hud.BuildBottomBar` loses its eight feature buttons and becomes the dock described above.
- `Hud.BuildTopBar` gains the cluster on the right.
- `tab_on`, `tab_off`, `badge_red`, `badge_green`, `badge_blue` and `bar_navy` are already
  drawn and currently unused by any screen — this is what they were for.
- The icons listed in the cluster table are not drawn yet. Draw them per the art rules: each
  one on its own, in the style of the reference, as an original design rather than a copy of
  the original game's artwork.

## Reference still missing

The recording closed the earlier gaps — frame, title, close button, list rows, item cells,
confirm dialog and the character screen are all documented now. What it does not show:

1. **A stall-setup window.** The core loop of this game is choosing a product and a seller for
   a slot; no frame in the recording shows that screen. It is the single most important
   missing surface.
2. **A warehouse or inventory list** with quantities, as opposed to the fixed 3x3 reward grids.
3. **A neighbour or quest window** with portraits beside rows.
4. **Empty and loading states.** Nothing shows what a list looks like with no entries.

Those can wait: the two skins chosen above plus the row card cover enough to build the kit,
and the missing screens reuse the same primitives.

## Pipeline

1. Drop a reference screenshot into `client/Tools/ui_ref/`.
2. Add named rectangles for it in `client/Tools/cut_ui.py` and run it. Each component lands as
   its own PNG under `client/Tools/ui_ref/cut/`, upscaled for inspection.
3. Study the crop, then **draw** the component in `client/Tools/sprites.js` using the palette
   above and the helpers already in that file.
4. Export with the `export-sprites` skill, add the `sprites.txt` row, and check it in Unity.

`client/Tools/cut_street.py` already does step 2-style cutting for scene art with GrabCut;
`cut_ui.py` is the simpler rectangle-based sibling for interface chrome.

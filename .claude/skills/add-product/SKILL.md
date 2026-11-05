---
name: add-product
description: Add, change or remove a product sold in Vỉa Hè Online — touches PRODUCTS in the server catalog, the canvas-drawn stall sprite, the parasol colour on the client, then the sprite export and a test run. Use this skill whenever the user wants a new thing to sell, says "thêm món", "bán thêm", "món mới", "bỏ món", changes a product's price or unlock level, or simply names a Vietnamese street food the game does not have yet ("cho bán bánh cuốn đi", "thêm cà phê sữa đá"). A product lives in three different files, so do not hand-edit one and hope — follow the order below.
---

# Add a product

A product is not in one place. Miss a step and the game still runs, but wrongly and silently:
no stall drawing means the sprite renders empty, no parasol entry means every new product gets
the red parasol, and no sprite export means the PNG is absent and Unity logs `Thiếu hình`.

## Step 1 — Declare it on the server (the single source of truth)

`server/src/data.ts`, the `PRODUCTS` array. The client has no catalog of its own: it asks for
one over the `catalog` message, so editing this array is enough for both sides.

```ts
{ id: 'rice_rolls', name: 'Bánh cuốn', unlockLevel: 7, cost: 12000, price: 30000, sellSeconds: 4, xp: 4 },
```

- `id`: lowercase snake_case **English** (project rule in `CLAUDE.md`). It becomes the sprite
  name and a client lookup key, so a typo in one place silently breaks three.
- `name`: Vietnamese — it is player-facing text, which the project rule keeps in Vietnamese.
- Keep the array sorted by `unlockLevel`; the in-game product picker renders in array order.
- `sellSeconds` is the time to serve **one** customer, and it is divided by the seller's Skill stat.

### Balancing: profit per second is the yardstick

A pricier product has to be worth more, or players level up and keep selling iced tea anyway.
Current profit table (`(price - cost) / sellSeconds`):

| Product | unlockLevel | Profit/portion | Profit/sec | XP/sec |
|---|---|---|---|---|
| Trà đá | 1 | 2,000 | 1,000 | 0.50 |
| Bánh mì | 1 | 8,000 | 2,667 | 0.67 |
| Xôi | 2 | 8,000 | 2,667 | 0.67 |
| Kem que | 4 | 6,000 | 3,000 | 1.00 |
| Chè | 3 | 12,000 | 4,000 | 1.00 |
| Chôm chôm | 5 | 20,000 | 5,000 | 1.00 |
| Bún đậu | 8 | 25,000 | 5,000 | 1.00 |
| Sữa tươi | 10 | 13,000 | 6,500 | 1.50 |
| Hoa tươi | 6 | 35,000 | 7,000 | 1.20 |

A product unlocking at level *n* should sit between the one below and the one above it. Also
check the capital it demands: `cost × 20` (a full stall) has to be affordable at that level —
`BALANCE.startingMoney` is only 200,000đ.

To measure instead of guessing, use the **balance** skill.

## Step 2 — Draw the stall

`client/Tools/sprites.js`, the `COUNTERS` object. Each entry draws on a **380×190 px** canvas
(200px = 1 Unity unit), origin top-left, pivot bottom-centre.

```js
rice_rolls: (g) => {
  table(g, '#8d5a2b');                                  // wooden table top, colour argument
  // ... goods on the table, roughly y 0..70
  drawText(g, 'BÁNH CUỐN', 190, 116, 28, '#fff', OUTLINE); // label on the table front
},
```

Reuse the helpers already in the file instead of drawing raw paths: `table(g, woodColour)` builds
the whole table, `roundRect`, `ellipse`, `poly` (polygon), `fill(g, colour, stroke, outline)`
fills with an outline, `gradient`, `shade(colour, k)` lightens or darkens,
`drawText` draws outlined text. Text painted onto a sprite stays Vietnamese — players read it.

House style: dark brown `OUTLINE` at 3–4 px, flat two-tone shading, saturated colours.
`COUNTERS.sweet_soup` and `COUNTERS.fresh_milk` are short, readable models. The sprite is exported as `counter_<id>`.

## Step 3 — Parasol colour

`client/Assets/Scripts/StreetScene.cs`, the `UmbrellaColor` map. With no entry a stall falls back to the
red umbrella, which collides with bánh mì.

```csharp
["rice_rolls"] = "blue",
```

Available colours: `red`, `green`, `blue`, `yellow`, `purple`, `orange` (see `UMBRELLA_COLORS` in `sprites.js`).
Pick one unused by products of the same level so players can tell stalls apart at a distance.

## Step 4 — Export the sprites

Run the **export-sprites** skill. It produces the stall PNG and rewrites `sprites.txt`, the
file Unity reads for each sprite's pivot and 9-slice border. Skip it and the new sprite does
not exist as far as Unity is concerned.

## Step 5 — Verify

```
cd server && npm start      # separate window
cd server && npm test
```

`test/simulation.ts` drives two simulated players selling through the real server. It knows
nothing about the new product, so add a `check(...)` assertion there if the product deserves one
(unusual price, very short or very long `sellSeconds`).

Any product with `unlockLevel <= max(3, street owner's level)` shows up in NPC demand
automatically (the `wants` generator in the room) — nothing else to declare.

## Removing a product

Remove all three entries (`PRODUCTS`, `COUNTERS`, `UmbrellaColor`), re-export, then **delete the stale
PNG** from the sprite folder: `sprites.txt` is rewritten so Unity ignores it, but the orphan
file still ships in the build. Warn the user that players who already own a stall selling it —
stored in `server/data/game.db` — keep a stall whose product id no longer resolves.

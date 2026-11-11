# Vỉa Hè Online: a multiplayer street-vendor game for phones

Each player starts with **an empty district**: four lots of bare land and a sidewalk. You grow crops, build shops and set up stalls, and passing customers stop by when they see something they want. More districts can be bought, each on its own screen. You can take the **bus** to a friend's street to **co-sell**, water their garden and chat; the street owner collects a sidewalk fee and the street gains **fame**. You can hire **employees** to run stalls for you (they keep selling after you leave the street) and buy **clothes** that attract customers and raise your prices.

- `server/`: Node.js + [Colyseus](https://colyseus.io) 0.18. All game rules run here.
- `client/`: a **Unity 6** project, 2D side view. The art style is cartoon: chibi characters cut from the street art, with generated walking steps, breathing and a hop when they make a sale, motorbikes with spinning wheels and exhaust puffs, rows of shops and homes, stalls with umbrellas, and rounded blue UI frames. The scene and UI are built in code from the sprite set, so you can open an empty scene, press Play and start playing.

Project conventions (code in English, player-facing text in Vietnamese) are in `CLAUDE.md`.

## Gameplay

| Action | How it works |
|---|---|
| **Create a character** | New players pick male or female plus hair, brows, lips, cheeks and earrings. The look is stored on the server and everyone on the street sees it |
| **Land** | Every district has 4 build lots. Tap a lot to plant a crop or build, and tap a growing crop to water or harvest. The first banana crop is free and ripens in 3 minutes. Sidewalk slots are separate: 8 per district |
| **Districts** | Bãi đất is free, then Ven sông, Gần chợ and Phố cổ can be bought from the district map. Money, the store and staff are shared; each district adds a staff place. Customers rise from 40% on bare land by 20% per building |
| **Cooking** | A Bếp nhà turns crops into fried banana, banana soup, sugarcane juice and banana cake, sold from a stall. Ingredients and food share the store |
| **Professions** | From level 5 pick Chef, Gardener or Trader, once per season. Each has a bonus and a way to help a neighbour |
| **Neighbours** | Five fictional neighbours with five quests each. Friendship 5 unlocks a lasting reward, such as the old motorbike |
| **Activities** | Shuttlecock rally, sidewalk caro, Sunday neighbourhood meeting and neighbourhood weddings. A neighbour plays with you when you are alone. No betting |
| **Vehicles and deliveries** | Vehicles change speed and capacity. Send a vehicle on an order and collect the money when it returns; players can also post and fill each other's orders |
| **Tutorial** | The neighbourhood leader guides the first 15 minutes: plant, water, harvest, sell, plant a second crop, build a tea shop, water on an NPC street, then harvest and plant a long crop. Banana crops ripen in 3, then 10, then 30 minutes. Bottom-bar buttons and *Thêm* entries appear gradually by tutorial step and level |
| **Buildings** | Build a store, kitchen, tea shop, grocery, barber or the neighbourhood stage on a lot. Shops earn money for up to 8 hours between collections, buildings upgrade up to level 3, and demolishing refunds 50% |
| **Daily tasks** | Three tasks a day from the neighbourhood leader, each paying money and XP |
| **Friends and helping** | Add a friend from their street and water their garden once a day, even when they are away. Both players are rewarded. NPC streets are always open to visit |
| **Fame** | Unique visitors, street sales and help earn fame. It cannot be spent or bought, it ranks streets on a 4-week season leaderboard, and famous streets attract tourists who pay 50% more |
| **Events** | Random street events (rain, hot sun, rush hour, tourist group, shipper order) and weekly ones (Saturday night market, green Sunday). Seasonal events add limited products, decorations and gifts, and the banana festival is a server-wide goal. Extra dated events go in `server/data/events.json` without an app update |
| **Open a stall** | Tap an empty slot on the sidewalk (or the *Dọn hàng* button), then pick a product and who sells it. The stock cost is paid up front; leftover stock is refunded when you close the stall |
| **Selling** | NPC customers walk by with the products they want shown above their heads. When they pass a stall selling one of those, they may stop (the more **Charm** the seller has, the likelier they stop; the more **Skill**, the faster the sale) |
| **Invite customers** | Tap a nearby customer (within 2.5 slots) to pull them to your stall. Costs 1 **stamina**, which regenerates over time. You can also poach customers queuing at someone else's stall |
| **Walking** | Tap the street to walk there. The camera follows your character |
| **Street objects** | Tap people and parked bikes to see their name and a line. The bus stop opens *Xe buýt*, and the other windows are on the bottom bar and under *Thêm* |
| **Bus** | Lists streets with players on them plus a few empty ones. On someone else's street you can only use the regular slots (the first 2 slots, outlined in gold, belong to the owner) |
| **Sidewalk fee** | When you sell on someone else's street, the owner gets 10% of the revenue. The owner's log records who poached customers and for how much |
| **Employees** | Hire from the list of applicants (stats Charm / Skill / Strength). Strength = more stock per stall. Higher levels let you hire more people (up to 6) |
| **Wardrobe, Shop** | Buy hats, shirts, pants and accessories. Dress yourself or your employees for bonus % money, % XP and Charm. Clothes show on the character |
| **Levels** | Sales give XP; leveling up unlocks new products (sticky rice, sweet soup, popsicles, rambutan, flowers, tofu noodles, fresh milk) and new clothes |
| **Chat** | Type in the *Nói gì đó…* box; your message appears as a speech bubble above your head (with a profanity filter) |

Prices, customer spawn rate, the sidewalk fee and so on are tuned in `server/src/data.ts` (`PRODUCTS`, `WEARABLES`, `BALANCE`).

## Running the server

Requires **Node.js 22 or newer**.

```
cd server
npm install
npm start
```

Or double-click `start-server.bat`. The server listens on `ws://localhost:2567`. Player data is stored in `server/data/game.db` (SQLite). To check the game rules with two simulated players, keep the server running and run `npm test` in another terminal. `npm run test:garden` and `npm run test:world` check the garden and world rules on a fake clock and need no running server.

### Server settings

| Variable | Purpose |
|---|---|
| `ADMIN_TOKEN` | Turns on the admin page at `/admin` and its APIs, which read the token from the `x-admin-token` header |
| `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_TOKEN`, `ZALO_ENABLED` | Turn on token checks for `/api/link` and `/api/login/social`. The Unity client still needs each provider's native SDK |

## Running the Unity client

1. Install **Unity Hub** and a **Unity 6** editor (add *Android Build Support* for an APK, or *iOS Build Support* on a Mac for iPhone).
2. Unity Hub → **Add → Add project from disk** → choose the `client` folder. If Hub reports a version mismatch, pick the Unity 6 version you have.
3. On first open Unity downloads the Colyseus SDK package from GitHub (this needs internet access and **Git** installed).
4. Press **Play** in the open scene (an empty scene works). The login screen appears: enter a name, keep the server at `ws://localhost:2567`, and press **VÀO PHỐ**.

To try multiple players, also build a desktop version (*File → Build Profiles → Windows*) or run it on a phone.

## Building for phones

- *File → Build Profiles* → **Android** → *Switch Platform*.
- *Player Settings → Other Settings*:
  - **Internet Access: Require**
  - **Allow downloads over HTTP: Always allowed** (while the server has no HTTPS)
- A phone on the same wifi as the server machine: on the login screen enter `ws://<PC IP>:2567` (find the IP with `ipconfig`). Open port 2567 in Windows Firewall if it cannot connect.
- When putting the server online: run it behind HTTPS (e.g. Nginx/Caddy) and use `wss://your-domain`. Change the default address in `Network.ServerAddress` in `client/Assets/Scripts/Network.cs`.

## Editing the sprite set

The street scenery (river and city backdrop, homes, shops, sidewalk, curb, road, characters, parked and passing bikes) is cut from `client/Tools/street_source.jpg` and `street_source_2.png` by `client/Tools/cut_street.py` (needs `numpy` and `opencv-python-headless`), which writes its own manifest `street_sprites.txt`. All other art is drawn in code in `client/Tools/sprites.js` (canvas, 200 px = 1 Unity unit). To change a stall, an icon or add a product:

1. Edit `sprites.js`.
2. Run `node client/Tools/export-server.mjs`, open http://localhost:5181/ to preview every sprite, then run `exportSprites()` in the browser console. The PNGs are written to `client/Assets/Resources/Sprites/`.
3. In Unity choose the menu **Via He → Reimport Sprites**.

A new product also needs a `counter_<product id>` sprite and an umbrella color in `StreetScene.UmbrellaColor`.

## Font

The game text uses Charm Bold from `client/Assets/Resources/Fonts/`, under the SIL Open Font License in `Charm-OFL.txt`. Text painted onto sprites still uses Arial from `client/Tools/sprites.js`.

## Editing the synced state

The street state is declared in `server/src/schema.ts`. After editing it, run:

```
cd server
npm run schema-cs
```

to regenerate the C# classes in `client/Assets/Scripts/Schema/`.

## Code layout

| File | Contents |
|---|---|
| `server/src/index.ts` | Server startup, guest login API (`/api/login`), bus street list (`/api/streets`) |
| `server/src/rooms/StreetRoom.ts` | One room = one district: NPC customers, stalls, inviting, sales, sidewalk fee, log |
| `server/src/profile.ts` | Player profiles, garden rules, accounts, reports and analytics, stored in SQLite |
| `server/src/world.ts` | Land, districts, cooking, professions, vehicles, deliveries, wages, daily tasks, friends, fame, seasons |
| `server/src/stories.ts` | Neighbours and their quests |
| `server/src/activities.ts` | Mini-game rules |
| `server/src/events.ts` | Event definitions and scheduling |
| `server/src/social.ts` | Google, Facebook and Zalo token checks |
| `server/src/data.ts` | Product catalog, clothes, balance constants |
| `client/Assets/Scripts/Game.cs`, `GameExpansion.cs` | Self-boot, login, HUD, windows |
| `client/Assets/Scripts/StreetScene.cs` | Builds the street, syncs stalls / players / customers, handles taps |
| `client/Assets/Scripts/Network.cs` | Server connection |
| `client/Assets/Scripts/Models.cs` | Data types received from the server |
| `client/Assets/Scripts/Character.cs` | Layered characters, speech bubbles, the "Muốn: ..." label |
| `client/Assets/Scripts/CharacterCreator.cs` | First-run character creation screen |
| `client/Assets/Scripts/SoundFx.cs` | Sound effects synthesized at runtime |
| `client/Assets/Scripts/SpriteLibrary.cs`, `Draw.cs`, `UIBuilder.cs` | Sprite loading, scene and UI building |
| `client/Assets/Resources/Sprites/` | PNG sprite set in folders by kind (`character/`, `ui/`, `icons/`, `npc/`, `scene/`, `stalls/`, `vehicles/`, `wearables/`) + `sprites.txt` (pivots, 9-slice borders); folder rules in `client/Tools/sprite-folders.json` |
| `client/Assets/Art/Outfits/` | Source art for the female character's outfits: hair, tops, bottoms, shoes + `outfits.json` (see `docs/client/outfits.md`) |
| `client/Tools/sprites.js` | Drawing code for the whole sprite set (see above) |

## Next steps

- Hire an artist to redraw the sprites in more detail: if the file names and frames stay the same (characters 160×340, feet on the bottom edge), no code changes are needed.
- Add the Zalo, Google and Facebook SDKs to the Unity client.
- Rhythm singing on the neighbourhood stage, once original or licensed music exists.
- Dates for seasonal events after 2027 in `server/src/events.ts`.

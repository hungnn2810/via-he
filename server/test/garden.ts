// Checks land, crops and the store directly, with a fake clock so nobody waits for bananas to ripen.
//   npm run test:garden
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-test-'));
const { BALANCE, PRODUCTS } = await import('../src/data.js');
const { GameError, TUTORIAL_DONE, advanceTutorial, createCharacter, emptyLand, ensureNpcStreets, getProfile, login } = await import('../src/profile.js');
ensureNpcStreets();
const W = await import('../src/world.js');

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};

const p = login('garden-test-device', 'Chuối');
const t0 = 1_000_000;

check(p.money === 500000 && p.districts.length === 1 && p.districts[0].lots.length === 4 && p.freeSeeds === 4, 'New player: 500,000đ, one district, 4 empty lots, free first crop');
check(p.districts[0].lots.every((l) => !l.crop && !l.building), 'The first district is empty land');

refuses(() => createCharacter(p, { gender: 'male', hair: 99, brows: 0, lips: 0, cheeks: 0, earrings: 0 }), 'không hợp lệ', 'Rejects a look option out of range');
createCharacter(p, { gender: 'male', hair: 1, brows: 1, lips: 1, cheeks: 1, earrings: 0 });
check(p.appearance?.gender === 'male', 'Creates a character');
refuses(() => createCharacter(p, { gender: 'female', hair: 0, brows: 0, lips: 0, cheeks: 0, earrings: 0 }), 'rồi', 'Cannot create a second character');

refuses(() => W.harvestCrop(p, 0, 0, t0), 'chưa trồng', 'Cannot harvest an empty lot');
refuses(() => W.plantCrop(p, 0, 9, 'banana', t0), 'không hợp lệ', 'Lot must exist');
refuses(() => W.plantCrop(p, 0, 0, 'mung_bean', t0), 'Cần cấp', 'Crops respect the unlock level');
W.plantCrop(p, 0, 0, 'banana', t0);
const lot = p.districts[0].lots[0];
check(lot.readyAt === t0 + 180_000 && p.money === 500000 && p.tutorial === 1, 'First crop is free and ripens in 3 minutes');
refuses(() => W.plantCrop(p, 0, 0, 'banana', t0), 'đang dùng', 'Cannot plant twice');
refuses(() => W.build(p, 0, 0, 'store', t0), 'đang dùng', 'Cannot build on a planted lot');
refuses(() => W.harvestCrop(p, 0, 0, t0 + 1000), 'chưa chín', 'Cannot harvest before it ripens');

const stamina = p.stamina;
W.waterCrop(p, 0, 0, t0);
check(lot.readyAt === t0 + 144_000 && p.stamina === stamina - 1 && p.tutorial === 2, 'Watering cuts 20% of the remaining time for 1 stamina');
refuses(() => W.waterCrop(p, 0, 0, t0), 'đã tưới', 'Each crop is watered once');

W.harvestCrop(p, 0, 0, t0 + 10_000_000);
check(p.store.banana === 5 && !lot.crop && p.tutorial === 3, 'Ripe bananas never rot and go to the store');

for (const i of [1, 2, 3]) W.plantCrop(p, 0, i, 'banana', t0);
check(p.districts[0].lots[1].readyAt === t0 + 180_000, 'Crops planted before the first sale ripen in 3 minutes');
p.tutorial = 5;
W.plantCrop(p, 0, 0, 'banana', t0);
check(p.money === 490000 && lot.readyAt === t0 + 600_000 && p.tutorial === 6, 'The second crop costs 10,000đ and takes 10 minutes');
Object.assign(lot, emptyLand());
p.tutorial = 9;
p.money += 10000;
W.plantCrop(p, 0, 0, 'banana', t0);
check(lot.readyAt === t0 + 1_800_000 && p.tutorial === TUTORIAL_DONE, 'Planting the long crop takes 30 minutes and ends the tutorial');

p.store = { banana: BALANCE.storeCapacity - 2 };
refuses(() => W.harvestCrop(p, 0, 1, t0 + 200_000), 'Kho đầy', 'A full store blocks the harvest');
check(p.districts[0].lots[1].crop === 'banana', 'The crop waits when the store is full');

advanceTutorial(p, 2);
check(p.tutorial === TUTORIAL_DONE, 'The tutorial never goes backwards');

// Guided first session: a step already done never blocks the next one
const guided = login('guide-test', 'Hướng dẫn');
guided.tutorial = 5;
W.build(guided, 0, 0, 'tea_shop', t0);
W.plantCrop(guided, 0, 1, 'banana', t0);
check(guided.tutorial === 7, 'A tea shop built early is counted once the second crop is planted');
const npc = getProfile('npc-street-1')!;
W.tendNpcGarden(npc, t0);
const npcLot = npc.districts[0].lots[0];
const npcReady = npcLot.readyAt;
W.helpWater(guided, npc, 0, 0, t0);
check(guided.tutorial === 8 && !npcLot.watered && npcLot.readyAt === npcReady, 'Watering an NPC street finishes that step and leaves the crop for the next player');
Object.assign(guided.districts[0].lots[1], emptyLand());
advanceTutorial(guided, 0);
check(guided.tutorial === 9, 'With no crop left to harvest the tutorial moves on to replanting');

const byLevel = PRODUCTS.filter((x) => !x.homegrown && !x.seasonal).sort((a, b) => a.unlockLevel - b.unlockLevel);
const perSecond = (x: { price: number; cost: number; sellSeconds: number }) => (x.price - x.cost) / x.sellSeconds;
check(byLevel.every((x, i) => i === 0 || perSecond(x) >= perSecond(byLevel[i - 1]) || x.unlockLevel === byLevel[i - 1].unlockLevel), 'Profit per second never drops as levels rise');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

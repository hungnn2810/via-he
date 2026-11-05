// Checks districts, buildings, cooking, professions, stories, vehicles, deliveries, fame, seasons and events on a fake clock.
//   npm run test:world
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-test-'));
const { BALANCE, FAME } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const E = await import('../src/events.js');
const S = await import('../src/stories.js');
const A = await import('../src/activities.js');
const { GameError, login, getProfile } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const HOUR = 3_600_000, DAY = 24 * HOUR, t0 = 100 * DAY;

const p = login('world-owner-device', 'Chủ phố');
const v = login('world-visitor-device', 'Khách');
const lotsOf = (d: number) => p.districts[d].lots;

// Buildings and traffic
check(W.footTraffic(p, 0, t0) === 0.4, 'An empty field draws 40% of the customers');
refuses(() => W.build(p, 0, 0, 'grocery', t0), 'Cần cấp', 'Buildings respect the unlock level');
W.build(p, 0, 0, 'tea_shop', t0);
check(p.money === 0 && lotsOf(0)[0].level === 1, 'The tea shop costs the starting 500,000đ');
refuses(() => W.build(p, 0, 0, 'store', t0), 'đang dùng', 'One use per lot');
refuses(() => W.build(p, 0, 1, 'store', t0), 'Không đủ tiền', 'Building needs money');
refuses(() => W.upgrade(p, 0, 0, t0), 'đang xây', 'Cannot upgrade while building');

const ready = lotsOf(0)[0].readyAt;
check(Math.abs(W.footTraffic(p, 0, ready) - 0.6) < 1e-9, 'Each finished building adds 20% traffic');
check(W.collectIncome(p, ready + HOUR) === 40000, 'A tea shop earns 40,000đ an hour');
check(W.collectIncome(p, ready + HOUR + 100 * HOUR) === 320000, 'Income stops at the 8 hour cap');

p.money = 10_000_000;
W.upgrade(p, 0, 0, ready + 200 * HOUR);
check(lotsOf(0)[0].level === 2, 'A building upgrades');
W.build(p, 0, 1, 'store', t0);
check(W.storeCapacity(p, t0) === 40 && W.storeCapacity(p, t0 + DAY) === 80, 'A finished store adds 40 items');
const beforeDemolish = p.money;
W.demolish(p, 0, 1, t0 + DAY);
check(p.money === beforeDemolish + 150000 && !lotsOf(0)[1].building, 'Demolishing refunds 50% and frees the lot');

// Districts
p.level = 4;
refuses(() => W.buyDistrict(p), 'Cần cấp', 'Districts respect the unlock level');
p.level = 5; p.money = 2_000_000;
const staff = W.maxEmployees(p);
W.buyDistrict(p);
check(p.districts.length === 2 && p.money === 500000 && p.districts[1].lots.length === 4, 'Buying a district adds 4 lots');
check(W.maxEmployees(p) === staff + 1, 'Each district adds a staff place');
p.freeSeeds = 0;
p.tutorial = 10;
W.plantCrop(p, 1, 0, 'banana', t0);
check(lotsOf(1)[0].readyAt === t0 + 1800 * 900, 'The river district grows crops 10% faster');
W.clearCrop(p, 1, 0);

// Cooking
p.money = 5_000_000; p.level = 6; p.store = {};
refuses(() => W.cook(p, 1, 1, 'fried_banana', t0), 'Bếp nhà', 'Cooking needs a kitchen');
W.build(p, 1, 1, 'kitchen', t0);
refuses(() => W.cook(p, 1, 1, 'fried_banana', t0 + DAY), 'nguyên liệu', 'Cooking needs ingredients');
p.store = { banana: 2 };
W.cook(p, 1, 1, 'fried_banana', t0 + DAY);
check(!p.store.banana && lotsOf(1)[1].recipe === 'fried_banana', 'Cooking takes the ingredients');
refuses(() => W.collectCooking(p, 1, 1, t0 + DAY + 1000), 'chưa chín', 'Food takes time');
refuses(() => W.demolish(p, 1, 1, t0 + DAY), 'đang nấu', 'A busy kitchen cannot be demolished');
W.collectCooking(p, 1, 1, t0 + DAY + 300_000);
check(p.store.fried_banana === 3 && !lotsOf(1)[1].recipe, 'A batch gives 3 fried bananas');
p.store.banana = 2; p.store.mung_bean = 2;
refuses(() => W.cook(p, 1, 1, 'grandma_soup', t0 + DAY), 'Chưa học', 'The family recipe needs the tea seller');

// Professions
p.level = 4;
refuses(() => W.chooseProfession(p, 'chef', t0), 'Cần cấp', 'Professions start at level 5');
p.level = 6;
W.chooseProfession(p, 'chef', t0);
refuses(() => W.chooseProfession(p, 'trader', t0), 'một lần', 'One profession change per season');
W.chooseProfession(p, 'trader', t0 + 40 * DAY);
check(p.profession?.id === 'trader', 'A new season allows a change');
check(W.traderBonusPct(p) === 5, 'Traders earn 5% more');
for (let i = 0; i < 50; i++) W.addProfessionWork(p, 'trader');
check(p.profession?.rank === 2 && W.traderBonusPct(p) === 6, 'Work raises the rank');
p.profession = { id: 'gardener', rank: 1, work: 0, season: 0 };
W.plantCrop(p, 1, 0, 'banana', t0);
p.store = {};
W.harvestCrop(p, 1, 0, t0 + DAY);
check(p.store.banana === 6, 'Gardeners harvest one extra');

// Stories
const take = (item: string, n: number) => W.takeFromStore(p, item, n);
refuses(() => S.finishQuest(p, 'leader', take), 'chưa xong', 'A quest must be done first');
S.questEvent(p, 'harvest', 'banana', 2);
const xp = S.finishQuest(p, 'leader', take);
check(xp === BALANCE.questXp && S.friendship(p, 'leader') === 1 && p.neighbours.leader.quests === 1, 'Finishing a quest raises friendship');
p.store = { banana: 9 };
refuses(() => S.finishQuest(p, 'tea_seller', take), 'không đủ', 'A give quest takes the items');
p.store = { banana: 10 };
S.finishQuest(p, 'tea_seller', take);
check(!p.store.banana, 'Items are handed over');
p.store = { iced_tea: 2 };
S.giveNeighbourGift(p, 'leader', 5, take);
check(p.neighbours.leader.points === 4, 'A liked gift adds a point');
refuses(() => S.giveNeighbourGift(p, 'leader', 5, take), 'đã tặng', 'One gift a day');
check(S.NEIGHBOURS.length === 5 && S.NEIGHBOURS.every((n) => n.quests.length === 5), 'Five neighbours with five quests');
p.neighbours.leader.points = 15;
check(W.buildCost(p, 'tea_shop') === 450000, 'Friendship 5 with the leader cuts building costs');
p.neighbours.grocer = { points: 15, quests: 5, progress: 0, giftDay: 0 };
check(W.seedCost(p, 'banana', t0) === 8500, 'Friendship 5 with the grocer cuts seed costs');

// Vehicles
p.money = 10_000_000;
refuses(() => W.buyVehicle(p, 'motorbike'), 'xe ôm', 'The motorbike needs the driver');
W.buyVehicle(p, 'bicycle');
check(p.vehicle === 'bicycle' && W.vehicleOf(p).capacity === 10, 'Buys a bicycle');
refuses(() => W.buyVehicle(p, 'bicycle'), 'đã có', 'One of each vehicle');
refuses(() => W.useVehicle(p, 'cargo_trike'), 'chưa có', 'Only owned vehicles');
W.useVehicle(p, 'walk');

// Deliveries
W.refreshOrders(p, t0, () => 0.1);
check(p.orders.length === 3, 'Three orders on the board');
const near = p.orders[0];
check(near.kind === 'near' && near.quantity === 5, 'The first order is near');
refuses(() => W.sendDelivery(p, near.id, t0), 'xe tốt hơn', 'Walking cannot take deliveries');
W.useVehicle(p, 'bicycle');
p.store = { [near.item]: 5 };
const money = p.money;
check(W.sendDelivery(p, near.id, t0) === 'near', 'Sending reports the order kind');
check(!p.store[near.item] && p.deliveries.length === 1, 'Sending takes the goods');
// The shipper's story counts deliveries by order kind
const shipperQuests = S.NEIGHBOURS.find((n) => n.id === 'shipper')!.quests;
const deliverQuest = shipperQuests.findIndex((q) => q.type === 'deliver');
const shipper = p.neighbours.shipper = { points: 0, quests: deliverQuest, progress: 0, giftDay: 0 };
S.questEvent(p, 'deliver', 'far');
check(shipper.progress === 0, 'A far delivery does not count for a near-delivery quest');
S.questEvent(p, 'deliver', 'near');
check(shipper.progress === 1, 'A near delivery counts for the shipper quest');
delete p.neighbours.shipper;
refuses(() => W.collectDeliveries(p, t0 + 1000), 'giao xong', 'The vehicle needs time');
check(W.collectDeliveries(p, t0 + DAY).total === near.reward && p.money === money + near.reward, 'A finished delivery pays out');

// Player orders
p.money = 500000; v.money = 0;
refuses(() => P.postPlayerOrder(p, 'banana', 10, 999999, 12000, t0), 'quá cao', 'Player orders have a price cap');
P.postPlayerOrder(p, 'banana', 10, 150000, 12000, Date.now());
check(p.money === 350000, 'The money is held');
const open = P.listPlayerOrders();
check(open.length === 1, 'The order is listed');
refuses(() => P.claimPlayerOrder(open[0].id, p.id), 'của bạn', 'Cannot take your own order');
P.claimPlayerOrder(open[0].id, v.id);
check(P.listPlayerOrders().length === 0, 'A taken order leaves the board');
P.postPlayerOrder(p, 'banana', 1, 1000, 12000, Date.now() - 2 * DAY);
const held = p.money;
P.listPlayerOrders();
check(p.money === held + 1000, 'An expired order refunds the buyer');
for (let i = 0; i < 5; i++) { try { P.postPlayerOrder(p, 'banana', 1, 100, 12000, t0); } catch {} }
refuses(() => P.postPlayerOrder(p, 'banana', 1, 100, 12000, t0), 'đủ đơn', 'Five orders a day');
P.listPlayerOrders();

// Wages and daily tasks
p.employees = [{ id: 'e1', name: 'A', charm: 10, skill: 10, strength: 10, trait: 'quick', look: '', outfit: {} }];
p.money = 100000; p.lastWageDay = 0;
check(W.payWages(p, t0) === 8000 && W.payWages(p, t0) === 0, 'Wages are paid once a day');
p.money = 1000;
W.payWages(p, t0 + 30 * DAY);
check(p.money === 0, 'Wages never push money below zero');
W.refreshDaily(p, t0);
check(W.progressTask(p, 'visit', 1, t0) === BALANCE.dailyTaskXp && W.progressTask(p, 'visit', 1, t0) === 0, 'A daily task pays once');

// Helping
W.addFriend(v, p.id);
refuses(() => W.addFriend(v, p.id), 'Đã là bạn', 'No duplicate friends');
Object.assign(lotsOf(0)[2], { crop: 'banana', plantedAt: t0, readyAt: t0 + 1000 * 1000, watered: false });
Object.assign(lotsOf(0)[3], { crop: 'banana', plantedAt: t0, readyAt: t0 + 1000 * 1000, watered: false });
const fame0 = p.fame;
W.helpWater(v, p, 0, 2, t0);
check(lotsOf(0)[2].watered && p.fame === fame0 + FAME.help, 'Helping waters the lot and adds fame');
refuses(() => W.helpWater(v, p, 0, 3, t0), 'đã tưới giúp', 'Once per street per day');
v.profession = { id: 'gardener', rank: 1, work: 0, season: 0 };
const before = lotsOf(0)[3].readyAt;
W.professionHelp(v, p, 0, t0);
check(lotsOf(0)[3].readyAt < before, 'A gardener fertilizes a friend\'s crops');
refuses(() => W.professionHelp(v, p, 0, t0), 'đã giúp', 'Profession help is once a day');

// Fame
v.level = 1;
check(!W.recordVisit(p, v, t0 + 5 * DAY), 'Low level visitors give no fame');
v.level = 2;
const fame1 = p.fame;
check(W.recordVisit(p, v, t0 + 5 * DAY) && p.fame === fame1 + FAME.visit, 'A visitor adds fame');
check(!W.recordVisit(p, v, t0 + 5 * DAY), 'Each visitor counts once a day');
W.recordStreetSales(p, 100_000_000, t0 + 5 * DAY);
check(p.fameDay.salesFame === FAME.maxSalesPerDay, 'Sales fame has a daily cap');

// Stage
p.level = 8; p.money = 50_000_000; p.fame = 10;
Object.assign(lotsOf(1)[2], P.emptyLand());
refuses(() => W.build(p, 1, 2, 'stage', t0), 'điểm nổi tiếng', 'The stage needs fame');
p.fame = 200;
W.build(p, 1, 2, 'stage', t0);
W.awardFinishedBuildings(p, t0 + DAY);
W.awardFinishedBuildings(p, t0 + DAY);
check(p.fame === 300, 'A finished stage gives its fame once');

// Seasonal extras
const tet = E.seasonalEvent(Date.parse('2027-02-05T00:00:00+07:00'));
check(tet?.id === 'tet' && tet.rules.products?.includes('banh_chung'), 'Tet sells banh chung');
const merged = E.mergeRules([tet, E.scheduledEvent(Date.parse('2026-11-07T12:00:00Z'))]);
check(merged.sidewalkFeePct === 5 && merged.gift === 'Lì xì hàng xóm', 'Overlapping events combine their rules');
p.money = 1_000_000;
W.buyDecoration(p, 'peach_tree', tet!.rules);
check(p.decorations.includes('peach_tree'), 'Buys a peach tree during Tet');
const festival = E.seasonalEvent(Date.parse('2027-05-12T00:00:00+07:00'))!;
p.store = { banana: 300000 };
W.donateBananas(p, festival.id, festival.rules, 300000);
const reward = v.money;
W.claimCommunity(v, festival.id, festival.rules);
check(v.money === reward + 50000, 'Everyone earns reached festival steps');
p.titles = []; p.decorations = [];

// Seasons
P.ensureNpcStreets();
W.setSeasonForTest(5);
P.flushNow();
check(W.rolloverSeason(t0) === (W.seasonIndex(t0) !== 5), 'The season rolls over');
check(p.fame === 0 && p.titles.length === 1, 'The top street keeps a title and fame restarts');
check(getProfile('npc-street-1')!.titles.length === 0, 'NPC streets earn no titles');

// Recovery
const code = v.recoveryCode;
check(P.recoverAccount(code.toLowerCase(), 'new-phone-device')?.id === v.id, 'A recovery code moves the account');
check(login('new-phone-device', '').id === v.id, 'The new device logs into the same account');

// Events and meeting
const saturdayNight = Date.parse('2026-11-07T12:00:00Z'); // 19:00 in Vietnam
check(E.scheduledEvent(saturdayNight)?.rules.sidewalkFeePct === 5, 'Saturday night halves the sidewalk fee');
check(E.scheduledEvent(Date.parse('2026-11-08T01:00:00Z'))?.id === 'green_sunday', 'Sunday morning is green Sunday');
check(E.meetingOpen(Date.parse('2026-11-08T12:00:00Z')), 'The meeting runs on Sunday evening');
const friday = Date.parse('2026-11-13T12:00:00Z');
E.meeting.winner = () => 'rush_hour';
check(E.scheduledEvent(friday)?.id === 'rush_hour', 'The voted event runs on Friday evening');
E.meeting.winner = () => null;

// Mini-games
let board = A.emptyBoard();
for (const cell of [0, 1, 2, 3]) board = A.placeMark(board, cell, 'X')!;
check(A.placeMark(board, 0, 'O') === null, 'A taken cell is refused');
check(!A.hasFive(board, 3), 'Four in a row is not a win');
check(A.npcMove(board, 'O', 'X', () => 0) === 4, 'The neighbour blocks a win');
board = A.placeMark(board, 4, 'X')!;
check(A.hasFive(board, 4), 'Five in a row wins');
check(A.shuttleReward(5) === 5000 && A.shuttleReward(99) === 30000, 'Rally rewards are capped');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

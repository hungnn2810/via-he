// Rules beyond the stall loop: districts, land, cooking, professions, vehicles, deliveries, wages, daily tasks, friends, fame, seasons.
// Every function takes `now` so tests can run on a fake clock.
import {
  BALANCE, BUILDINGS, CROPS, DAILY_TASKS, DECORATIONS, DISTRICTS, FAME, ORDER_KINDS, PROFESSIONS, RECIPES, SEASON_DAYS, VEHICLES,
  getProduct, maxEmployeesForLevel, type BuildingType,
} from './data.js';
import {
  GameError, TUTORIAL_DONE, addCommunityProgress, advanceTutorial, allProfiles, communityProgress, emptyLand, flushNow, markDirty,
  type DeliveryOrder, type Land, type Profile,
} from './profile.js';
import { friendship } from './stories.js';
import type { EventRules } from './events.js';
import { fortuneTrafficMultiplier, helpRewardFor } from './fortune.js';
import { awardSeasonBoards, seasonEvent } from './season.js';

const DAY = 86_400_000;
export const dayIndex = (now = Date.now()) => Math.floor(now / DAY);
export const seasonIndex = (now = Date.now()) => Math.floor(now / (SEASON_DAYS * DAY));

function pay(profile: Profile, cost: number) {
  if (profile.money < cost) throw new GameError('Không đủ tiền');
  profile.money -= cost;
}

// ---------- Land ----------

export function landAt(profile: Profile, district: unknown, index: unknown): Land {
  const lot = Number.isInteger(district) && Number.isInteger(index) ? profile.districts[district as number]?.lots[index as number] : undefined;
  if (!lot) throw new GameError('Ô đất không hợp lệ');
  return lot;
}

export const isBuilt = (lot: Land, now = Date.now()) => !!lot.building && now >= lot.readyAt;
const allLots = (profile: Profile) => profile.districts.flatMap((d) => d.lots);
const builtLevels = (profile: Profile, type: BuildingType, now: number) =>
  allLots(profile).reduce((sum, l) => sum + (l.building === type && isBuilt(l, now) ? l.level : 0), 0);

export const hasBuilding = (profile: Profile, district: number, type: BuildingType, now = Date.now()) =>
  !!profile.districts[district]?.lots.some((l) => l.building === type && isBuilt(l, now));

// Customers follow development: an empty field draws few people
export function footTraffic(profile: Profile, district: number, now = Date.now()) {
  const built = profile.districts[district]?.lots.filter((l) => isBuilt(l, now)).length ?? 0;
  const base = Math.min(BALANCE.maxTraffic, BALANCE.baseTraffic + built * BALANCE.trafficPerBuilding);
  return base * (1 + (DISTRICTS[district]?.customerPct ?? 0) / 100) * fortuneTrafficMultiplier(profile, now);
}

// ---------- Store ----------

export const storeUsed = (profile: Profile) => Object.values(profile.store).reduce((a, b) => a + b, 0);
export const storeCapacity = (profile: Profile, now = Date.now()) =>
  BALANCE.storeCapacity + builtLevels(profile, 'store', now) * BALANCE.storePerLevel;

export function addToStore(profile: Profile, item: string, amount: number, now = Date.now()) {
  if (storeUsed(profile) + amount > storeCapacity(profile, now)) throw new GameError('Kho đầy rồi, bán bớt hàng đã');
  profile.store[item] = (profile.store[item] ?? 0) + amount;
}

export function takeFromStore(profile: Profile, item: string, amount: number) {
  if ((profile.store[item] ?? 0) < amount) throw new GameError('Kho không đủ hàng');
  profile.store[item] -= amount;
  if (!profile.store[item]) delete profile.store[item];
}

// ---------- Crops ----------

export function seedCost(profile: Profile, crop: string, now = Date.now()) {
  let cost = CROPS[crop].seedCost;
  if (builtLevels(profile, 'grocery', now) > 0) cost *= (100 - BALANCE.groceryDiscountPct) / 100;
  if (friendship(profile, 'grocer') >= 5) cost *= 0.85;
  return Math.round(cost);
}

// Bananas ripen fast during the guided first session, so a new player always has something to do
function cropSeconds(profile: Profile, cropId: string) {
  if (cropId !== 'banana') return CROPS[cropId].seconds;
  if (profile.tutorial < 5) return BALANCE.firstCropSeconds;
  if (profile.tutorial < 9) return BALANCE.secondCropSeconds;
  return CROPS[cropId].seconds;
}

export function plantCrop(profile: Profile, district: number, index: number, cropId: string, now = Date.now()) {
  const lot = landAt(profile, district, index);
  const crop = CROPS[cropId];
  if (!crop) throw new GameError('Không có giống này');
  if (lot.crop || lot.building) throw new GameError('Ô đất này đang dùng rồi');
  if (profile.level < crop.unlockLevel) throw new GameError(`Cần cấp ${crop.unlockLevel}`);
  const free = cropId === 'banana' && profile.freeSeeds > 0;
  if (free) profile.freeSeeds--;
  else pay(profile, seedCost(profile, cropId, now));
  const gardener = profile.employees.find((e) => e.id === profile.gardenerId);
  const faster = (gardener?.trait === 'gardener' ? BALANCE.gardenerCutPct : 0) + (DISTRICTS[district].growPct ?? 0);
  const seconds = cropSeconds(profile, cropId);
  lot.crop = cropId;
  lot.plantedAt = now;
  lot.readyAt = now + Math.round(seconds * 1000 * (100 - faster) / 100);
  lot.watered = false;
  advanceTutorial(profile, profile.tutorial === 9 ? TUTORIAL_DONE : 1);
}

export function waterCrop(profile: Profile, district: number, index: number, now = Date.now()) {
  const lot = landAt(profile, district, index);
  if (!lot.crop) throw new GameError('Ô này chưa trồng gì');
  if (now >= lot.readyAt) throw new GameError('Cây chín rồi, thu hoạch thôi');
  if (lot.watered) throw new GameError('Lứa này đã tưới rồi');
  if (profile.stamina < 1) throw new GameError('Hết sức rồi, nghỉ chút đã');
  profile.stamina -= 1;
  lot.readyAt -= Math.round((lot.readyAt - now) * BALANCE.waterCutPct / 100);
  lot.watered = true;
  advanceTutorial(profile, 2);
}

export function harvestCrop(profile: Profile, district: number, index: number, now = Date.now()) {
  const lot = landAt(profile, district, index);
  if (!lot.crop) throw new GameError('Ô này chưa trồng gì');
  if (now < lot.readyAt) throw new GameError('Cây chưa chín');
  const crop = lot.crop;
  const bonus = profile.profession?.id === 'gardener' ? profile.profession.rank : 0;
  addToStore(profile, crop, CROPS[crop].yield + bonus, now);
  Object.assign(lot, emptyLand());
  advanceTutorial(profile, profile.tutorial === 8 ? 9 : 3);
  addProfessionWork(profile, 'gardener');
  return crop;
}

export function clearCrop(profile: Profile, district: number, index: number) {
  const lot = landAt(profile, district, index);
  if (!lot.crop) throw new GameError('Ô này chưa trồng gì');
  Object.assign(lot, emptyLand());
}

// ---------- Buildings ----------

export const buildCost = (profile: Profile, type: BuildingType) =>
  Math.round(BUILDINGS[type].cost * (friendship(profile, 'leader') >= 5 ? 0.9 : 1));
export const maxEmployees = (profile: Profile) => maxEmployeesForLevel(profile.level) + profile.districts.length - 1;
export const upgradeCost = (type: BuildingType, level: number) => BUILDINGS[type].cost * (level + 1);

export function build(profile: Profile, district: number, index: number, type: BuildingType, now = Date.now()) {
  const lot = landAt(profile, district, index);
  const b = BUILDINGS[type];
  if (!b) throw new GameError('Không có công trình này');
  if (lot.crop || lot.building) throw new GameError('Ô đất này đang dùng rồi');
  if (profile.level < b.unlockLevel) throw new GameError(`Cần cấp ${b.unlockLevel}`);
  if (b.needsFame && profile.fame < b.needsFame) throw new GameError(`Cần ${b.needsFame} điểm nổi tiếng`);
  pay(profile, buildCost(profile, type));
  lot.building = type;
  lot.level = 1;
  lot.readyAt = lot.collectedAt = now + b.buildSeconds * 1000;
  advanceTutorial(profile, 0);
}

export function upgrade(profile: Profile, district: number, index: number, now = Date.now()) {
  const lot = landAt(profile, district, index);
  if (!lot.building) throw new GameError('Ô này chưa có công trình');
  if (!isBuilt(lot, now)) throw new GameError('Công trình đang xây');
  if (lot.level >= BUILDINGS[lot.building].maxLevel) throw new GameError('Đã nâng cấp tối đa');
  collectLot(profile, lot, now);
  pay(profile, upgradeCost(lot.building, lot.level));
  lot.level++;
}

// Demolishing refunds half the base price and frees the land
export function demolish(profile: Profile, district: number, index: number, now = Date.now()) {
  const lot = landAt(profile, district, index);
  if (!lot.building) throw new GameError('Ô này chưa có công trình');
  if (lot.recipe) throw new GameError('Bếp đang nấu, chờ xong đã');
  collectLot(profile, lot, now);
  profile.money += Math.round(BUILDINGS[lot.building].cost * BALANCE.demolishRefundPct / 100);
  Object.assign(lot, emptyLand());
}

function collectLot(profile: Profile, lot: Land, now: number) {
  const perHour = lot.building ? BUILDINGS[lot.building].incomePerHour * lot.level : 0;
  if (!perHour || now <= lot.collectedAt) return 0;
  const hours = Math.min(BALANCE.incomeCapHours, (now - lot.collectedAt) / 3_600_000);
  const income = Math.floor(perHour * hours);
  profile.money += income;
  lot.collectedAt = now;
  return income;
}

export function collectIncome(profile: Profile, now = Date.now()) {
  return allLots(profile).reduce((sum, lot) => sum + (isBuilt(lot, now) ? collectLot(profile, lot, now) : 0), 0);
}

// Special buildings give their fame once, when they finish
export function awardFinishedBuildings(profile: Profile, now = Date.now()) {
  for (const lot of allLots(profile)) {
    const points = lot.building ? BUILDINGS[lot.building].fame : 0;
    if (!points || lot.fameAwarded || !isBuilt(lot, now)) continue;
    lot.fameAwarded = true;
    addFame(profile, points);
  }
}

// ---------- Districts ----------

export function buyDistrict(profile: Profile) {
  const next = DISTRICTS[profile.districts.length];
  if (!next) throw new GameError('Bạn đã có đủ các khu phố');
  if (profile.level < next.unlockLevel) throw new GameError(`Cần cấp ${next.unlockLevel}`);
  if (next.needsFame && profile.fame < next.needsFame) throw new GameError(`Cần ${next.needsFame} điểm nổi tiếng`);
  pay(profile, next.cost);
  profile.districts.push({ lots: Array.from({ length: BALANCE.lotsPerDistrict }, emptyLand) });
}

// ---------- Cooking ----------

export function cook(profile: Profile, district: number, index: number, recipeId: string, now = Date.now()) {
  const lot = landAt(profile, district, index);
  const recipe = RECIPES[recipeId];
  if (lot.building !== 'kitchen' || !isBuilt(lot, now)) throw new GameError('Cần một Bếp nhà đã xây xong');
  if (!recipe) throw new GameError('Không có công thức này');
  if (lot.recipe) throw new GameError('Bếp đang nấu');
  if (profile.level < recipe.unlockLevel) throw new GameError(`Cần cấp ${recipe.unlockLevel}`);
  if (recipe.needsFriend && friendship(profile, recipe.needsFriend) < 5) throw new GameError('Chưa học được công thức này');
  for (const [item, amount] of Object.entries(recipe.inputs)) {
    if ((profile.store[item] ?? 0) < amount) throw new GameError('Kho không đủ nguyên liệu');
  }
  for (const [item, amount] of Object.entries(recipe.inputs)) takeFromStore(profile, item, amount);
  const chef = profile.profession?.id === 'chef' ? PROFESSIONS.chef.bonusPct + (profile.profession.rank - 1) * 5 : 0;
  lot.recipe = recipeId;
  lot.cookReadyAt = now + Math.round(recipe.seconds * 1000 * (100 - chef) / 100);
}

export function collectCooking(profile: Profile, district: number, index: number, now = Date.now()) {
  const lot = landAt(profile, district, index);
  if (!lot.recipe) throw new GameError('Bếp chưa nấu gì');
  if (now < lot.cookReadyAt) throw new GameError('Món chưa chín');
  const recipe = RECIPES[lot.recipe];
  addToStore(profile, recipe.output, recipe.yield, now);
  lot.recipe = '';
  lot.cookReadyAt = 0;
  addProfessionWork(profile, 'chef');
  return recipe.output;
}

// ---------- Professions ----------

export function chooseProfession(profile: Profile, id: string, now = Date.now()) {
  if (!PROFESSIONS[id]) throw new GameError('Không có nghề này');
  if (profile.level < BALANCE.professionLevel) throw new GameError(`Cần cấp ${BALANCE.professionLevel}`);
  if (profile.profession?.id === id) throw new GameError('Bạn đang làm nghề này');
  if (profile.profession && profile.profession.season === seasonIndex(now)) throw new GameError('Mỗi mùa chỉ đổi nghề một lần');
  profile.profession = { id, rank: 1, work: 0, season: seasonIndex(now) };
}

export function addProfessionWork(profile: Profile, id: string) {
  const p = profile.profession;
  if (p?.id !== id) return;
  p.work++;
  const next = BALANCE.professionRanks[p.rank - 1];
  if (next && p.work >= next) p.rank++;
}

export const traderBonusPct = (profile: Profile) =>
  profile.profession?.id === 'trader' ? PROFESSIONS.trader.bonusPct + profile.profession.rank - 1 : 0;

// The profession's neighbourly action, once per street per day
export function professionHelp(helper: Profile, owner: Profile, district: number, now = Date.now()) {
  const job = helper.profession?.id;
  if (!job) throw new GameError('Bạn chưa chọn nghề');
  if (helper.id === owner.id) throw new GameError('Hãy sang phố bạn để giúp');
  refreshFameDay(owner, now);
  if (owner.fameDay.professionHelpers.includes(helper.id)) throw new GameError('Hôm nay bạn đã giúp phố này rồi');
  const lots = owner.districts[district]?.lots ?? [];
  if (job === 'chef') {
    const kitchen = lots.find((l) => l.recipe && now < l.cookReadyAt);
    if (!kitchen) throw new GameError('Bếp phố này không có món đang nấu');
    kitchen.cookReadyAt -= Math.round((kitchen.cookReadyAt - now) / 2);
  } else if (job === 'gardener') {
    const growing = lots.filter((l) => l.crop && now < l.readyAt);
    if (!growing.length) throw new GameError('Vườn phố này không có cây đang lớn');
    for (const l of growing) l.readyAt -= Math.round((l.readyAt - now) * 0.15);
  } else {
    helper.money += BALANCE.helpReward;
    owner.money += BALANCE.helpReward;
    addFame(owner, 1);
  }
  owner.fameDay.professionHelpers.push(helper.id);
  addProfessionWork(helper, job);
}

// ---------- Vehicles ----------

export const vehicleOf = (profile: Profile) => VEHICLES[profile.vehicle] ?? VEHICLES.walk;

export function buyVehicle(profile: Profile, id: string) {
  const v = VEHICLES[id];
  if (!v || !v.price) throw new GameError('Không có xe này');
  if (profile.vehicles.includes(id)) throw new GameError('Bạn đã có xe này');
  if (v.needsFriend && friendship(profile, v.needsFriend) < 5) throw new GameError('Chú xe ôm chưa nhượng xe cho bạn');
  pay(profile, v.price);
  profile.vehicles.push(id);
  profile.vehicle = id;
}

export function useVehicle(profile: Profile, id: string) {
  if (id !== 'walk' && !profile.vehicles.includes(id)) throw new GameError('Bạn chưa có xe này');
  profile.vehicle = id;
}

// ---------- Deliveries ----------

function randomOrder(profile: Profile, now: number, random: () => number): DeliveryOrder {
  const kinds = Object.keys(ORDER_KINDS);
  const kind = kinds[Math.floor(random() * kinds.length)];
  const rules = ORDER_KINDS[kind];
  const cooked = Object.values(RECIPES).filter((r) => !r.needsFriend).map((r) => r.output);
  const items = rules.processedOnly ? cooked : ['banana', ...cooked];
  const known = items.filter((id) => (getProduct(id)?.unlockLevel ?? 99) <= Math.max(profile.level, 2));
  const item = known[Math.floor(random() * known.length)] ?? 'banana';
  const price = getProduct(item)?.price ?? 12000;
  const bonus = rules.bonusPct + (kind === 'bulk' && friendship(profile, 'shipper') >= 5 ? 10 : 0);
  return {
    id: Math.floor(random() * 1e9).toString(36) + profile.orders.length, kind, item, quantity: rules.quantity,
    reward: Math.round(price * rules.quantity * (100 + bonus) / 100), expiresAt: now + BALANCE.orderBoardHours * 3_600_000,
  };
}

export function refreshOrders(profile: Profile, now = Date.now(), random = Math.random) {
  if (now < profile.ordersAt) return;
  profile.orders = [];
  for (let i = 0; i < BALANCE.ordersOnBoard; i++) profile.orders.push(randomOrder(profile, now, random));
  profile.ordersAt = now + BALANCE.orderBoardHours * 3_600_000;
}

export function sendDelivery(profile: Profile, orderId: string, now = Date.now()) {
  const order = profile.orders.find((o) => o.id === orderId);
  if (!order || now >= order.expiresAt) throw new GameError('Đơn này hết hạn rồi');
  const rules = ORDER_KINDS[order.kind];
  const vehicle = vehicleOf(profile);
  if (vehicle.rank < rules.minVehicleRank) throw new GameError('Cần xe tốt hơn cho đơn này');
  if (vehicle.capacity < order.quantity) throw new GameError('Xe không chở nổi đơn này');
  takeFromStore(profile, order.item, order.quantity);
  profile.orders = profile.orders.filter((o) => o !== order);
  profile.deliveries.push({ reward: order.reward, doneAt: now + Math.round(rules.seconds * 1000 * 100 / vehicle.speedPct) });
  return order.kind;
}

export function collectDeliveries(profile: Profile, now = Date.now()) {
  const done = profile.deliveries.filter((d) => now >= d.doneAt);
  if (!done.length) throw new GameError('Chưa có đơn nào giao xong');
  profile.deliveries = profile.deliveries.filter((d) => now < d.doneAt);
  const total = done.reduce((sum, d) => sum + d.reward, 0);
  profile.money += total;
  return { total, count: done.length };
}

// ---------- Wages and daily tasks ----------

export const wageOf = (e: { charm: number; skill: number; strength: number }) =>
  BALANCE.baseWage + (e.charm + e.skill + e.strength) * BALANCE.wagePerStat;

// Wages are charged for one day at most and never push money below zero, so a long absence costs nothing extra
export function payWages(profile: Profile, now = Date.now()) {
  const today = dayIndex(now);
  if (profile.lastWageDay >= today) return 0;
  profile.lastWageDay = today;
  const total = profile.employees.reduce((sum, e) => sum + wageOf(e), 0);
  const paid = Math.min(total, profile.money);
  profile.money -= paid;
  return paid;
}

export function refreshDaily(profile: Profile, now = Date.now()) {
  const today = dayIndex(now);
  if (profile.daily.day === today) return;
  profile.daily = { day: today, tasks: DAILY_TASKS.map((t) => ({ id: t.id, progress: 0, target: t.target, done: false })) };
}

// Advances a daily task and returns the XP to grant when this call finishes it
export function progressTask(profile: Profile, id: string, amount = 1, now = Date.now()) {
  refreshDaily(profile, now);
  const task = profile.daily.tasks.find((t) => t.id === id);
  if (!task || task.done) return 0;
  task.progress = Math.min(task.target, task.progress + amount);
  if (task.progress < task.target) return 0;
  task.done = true;
  profile.money += BALANCE.dailyTaskMoney;
  return BALANCE.dailyTaskXp;
}

// ---------- Friends and helping ----------

export function addFriend(profile: Profile, friendId: string) {
  if (friendId === profile.id) throw new GameError('Không thể tự kết bạn');
  if (profile.friends.includes(friendId)) throw new GameError('Đã là bạn rồi');
  if (profile.friends.length >= BALANCE.maxFriends) throw new GameError('Danh sách bạn đã đầy');
  profile.friends.push(friendId);
}

export function removeFriend(profile: Profile, friendId: string) {
  profile.friends = profile.friends.filter((id) => id !== friendId);
}

function refreshFameDay(profile: Profile, now: number) {
  const today = dayIndex(now);
  if (profile.fameDay.day !== today) profile.fameDay = { day: today, visitors: [], helpers: [], gifters: [], professionHelpers: [], salesFame: 0, salesCarry: 0 };
}

// Water a plot on someone else's street: once per street per day, and both players are rewarded
export function helpWater(helper: Profile, owner: Profile, district: number, index: number, now = Date.now()) {
  if (helper.id === owner.id) throw new GameError('Đây là vườn nhà bạn');
  refreshFameDay(owner, now);
  if (owner.fameDay.helpers.includes(helper.id)) throw new GameError('Hôm nay bạn đã tưới giúp phố này rồi');
  const lot = landAt(owner, district, index);
  if (!lot.crop) throw new GameError('Ô này chưa trồng gì');
  if (now >= lot.readyAt) throw new GameError('Cây chín rồi, không cần tưới');
  if (lot.watered) throw new GameError('Lứa này đã tưới rồi');
  if (helper.stamina < 1) throw new GameError('Hết sức rồi, nghỉ chút đã');
  helper.stamina -= 1;
  // An NPC garden is shared by every new player, so watering never uses it up
  if (!owner.isNpc) {
    lot.readyAt -= Math.round((lot.readyAt - now) * BALANCE.waterCutPct / 100);
    lot.watered = true;
  }
  owner.fameDay.helpers.push(helper.id);
  helper.money += helpRewardFor(helper, owner, now);
  owner.money += BALANCE.helpReward;
  addFame(owner, FAME.help);
  if (helper.tutorial === 7) advanceTutorial(helper, 8);
}

// Keeps bananas growing on an NPC street so visitors always have something to water. Returns true if anything changed.
export function tendNpcGarden(owner: Profile, now = Date.now()) {
  let changed = false;
  for (const lot of owner.districts[0].lots) {
    if (lot.crop && now < lot.readyAt) continue;
    Object.assign(lot, emptyLand(), { crop: 'banana', plantedAt: now, readyAt: now + CROPS.banana.seconds * 1000 });
    changed = true;
  }
  return changed;
}

// ---------- Seasonal extras ----------

export function buyDecoration(profile: Profile, id: string, rules: EventRules) {
  const d = DECORATIONS.find((x) => x.id === id);
  if (!d || !rules.decorations?.includes(id)) throw new GameError('Món này chỉ bán trong dịp lễ');
  if (profile.decorations.includes(id)) throw new GameError('Bạn đã có món này rồi');
  pay(profile, d.price);
  profile.decorations.push(id);
}

// The event's friendly action on someone else's street: once per street per day
export function giveGift(giver: Profile, owner: Profile, rules: EventRules, now = Date.now()) {
  if (!rules.gift) throw new GameError('Chưa tới dịp tặng quà');
  if (giver.id === owner.id) throw new GameError('Hãy sang phố bạn để tặng quà');
  refreshFameDay(owner, now);
  if (owner.fameDay.gifters.includes(giver.id)) throw new GameError('Hôm nay bạn đã tặng quà phố này rồi');
  if (giver.stamina < 1) throw new GameError('Hết sức rồi, nghỉ chút đã');
  giver.stamina -= 1;
  owner.fameDay.gifters.push(giver.id);
  giver.money += BALANCE.giftReward;
  owner.money += BALANCE.giftReward;
  addFame(owner, FAME.help);
}

export function donateBananas(profile: Profile, eventId: string, rules: EventRules, quantity: number) {
  if (!rules.community) throw new GameError('Chưa tới dịp góp chuối');
  const amount = Math.min(Math.floor(quantity) || 0, profile.store.banana ?? 0);
  if (amount < 1) throw new GameError('Kho hết chuối rồi');
  takeFromStore(profile, 'banana', amount);
  addCommunityProgress(eventId, amount);
  const before = profile.communityGiven[eventId] ?? 0;
  profile.communityGiven[eventId] = before + amount;
  if (before < BALANCE.generousDonorAt && before + amount >= BALANCE.generousDonorAt) profile.titles.push('Người góp chuối hào phóng');
}

// Everyone earns each reached step, whether or not they gave bananas
export function claimCommunity(profile: Profile, eventId: string, rules: EventRules) {
  const goal = rules.community;
  if (!goal) throw new GameError('Chưa tới dịp góp chuối');
  const reached = Math.min(goal.steps, Math.floor(communityProgress(eventId) / (goal.target / goal.steps)));
  const paid = profile.communityClaims[eventId] ?? 0;
  if (reached <= paid) throw new GameError('Chưa có phần thưởng mới');
  profile.money += (reached - paid) * goal.rewardPerStep;
  profile.communityClaims[eventId] = reached;
}

// ---------- Fame ----------

export function addFame(profile: Profile, points: number) {
  profile.fame += points;
  seasonEvent(profile, 'fame', points);
  markDirty(profile);
}

// Only accounts past the minimum level count, which keeps throwaway accounts from farming fame
export function recordVisit(owner: Profile, visitor: Profile, now = Date.now()) {
  refreshFameDay(owner, now);
  if (visitor.level < FAME.minVisitorLevel || owner.fameDay.visitors.includes(visitor.id)) return false;
  if (owner.fameDay.visitors.length >= FAME.maxVisitorsPerDay) return false;
  owner.fameDay.visitors.push(visitor.id);
  addFame(owner, FAME.visit);
  return true;
}

export function recordStreetSales(owner: Profile, revenue: number, now = Date.now()) {
  refreshFameDay(owner, now);
  owner.fameDay.salesCarry += revenue;
  const points = Math.floor(owner.fameDay.salesCarry / FAME.salesPerPoint);
  if (!points) return;
  owner.fameDay.salesCarry -= points * FAME.salesPerPoint;
  const gained = Math.min(points, FAME.maxSalesPerDay - owner.fameDay.salesFame);
  if (gained <= 0) return;
  owner.fameDay.salesFame += gained;
  addFame(owner, gained);
}

// ---------- Seasons ----------

let lastSeason = seasonIndex();

// Top streets of a finished season earn a title; fame then restarts. Titles and decorations stay forever.
export function rolloverSeason(now = Date.now()) {
  const current = seasonIndex(now);
  if (current === lastSeason) return false;
  const finished = lastSeason;
  lastSeason = current;
  flushNow();
  const ranked = allProfiles().filter((p) => !p.isNpc).sort((a, b) => b.fame - a.fame);
  awardSeasonBoards(finished, ranked);
  ranked.forEach((p, rank) => {
    if (p.fame > 0 && rank < 10) p.titles.push(`Mùa ${finished}: hạng ${rank + 1}`);
    if (p.fame >= FAME.seasonDecorationAt) p.decorations.push(`season_${finished}`);
    p.fame = 0;
    markDirty(p);
  });
  return true;
}

export const setSeasonForTest = (season: number) => { lastSeason = season; };

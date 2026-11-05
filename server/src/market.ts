// Wholesale market (chợ đầu mối), buying on credit and the server-wide shared bulk order.
// Every function takes `now` so tests can run on a fake clock. Prices are a pure function of the day, so no state is stored.
import { PRODUCTS, RECIPES, getProduct, type Product } from './data.js';
import { GameError, gameDb, type Profile } from './profile.js';
import { addToStore, dayIndex, storeCapacity, storeUsed, takeFromStore } from './world.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// All numbers are provisional
export const MARKET = {
  unlockLevel: 2,
  minPct: 70,                // daily multiplier on a product's base cost
  maxPct: 130,
  tiers: [{ min: 50, discountPct: 20 }, { min: 20, discountPct: 10 }], // best tier first
  maxBuy: 200,               // portions in one purchase
  creditLevel: 4,
  creditLimit: 200_000,      // outstanding debt, interest included
  interestPct: 5,
  debtDays: 3,               // an older debt is cancelled
  creditLockHours: 24,       // credit is locked this long after a cancelled debt
  sharedLevel: 3,
  sharedTarget: 30,          // portions needed
  sharedHours: 24,
  sharedPerDay: 15,          // portions one player may give per day
  sharedRewardPct: 160,      // of retail price * target
  sharedMaxUnlock: 6,        // the order only asks for items players of this level can make or buy
};

export interface MarketState {
  debt: number;               // what must be repaid (interest included)
  borrowedAt: number;         // when the current debt began (the oldest unpaid loan)
  creditLockedUntil: number;  // no new credit before this time
  sharedDay: number;          // day index of sharedGiven
  sharedGiven: number;        // portions given to the shared order today
}

// ---------- Daily prices ----------

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

export const isWholesale = (p: Product) => !p.homegrown && !p.seasonal;

// Share of the base cost the market asks for today (70-130%), the same for every player
export const marketPct = (productId: string, now = Date.now()) =>
  MARKET.minPct + hash(`${dayIndex(now)}:${productId}`) % (MARKET.maxPct - MARKET.minPct + 1);

export function marketPrice(product: Product, now = Date.now()) {
  return Math.round(product.cost * marketPct(product.id, now) / 100);
}

export function marketTable(now = Date.now()) {
  return PRODUCTS.filter(isWholesale).map((p) => ({
    item: p.id, name: p.name, unlockLevel: p.unlockLevel, cost: p.cost, pct: marketPct(p.id, now), price: marketPrice(p, now),
  }));
}

export const marketPrices = (now = Date.now()) => ({
  day: dayIndex(now), unlockLevel: MARKET.unlockLevel, tiers: MARKET.tiers, maxBuy: MARKET.maxBuy,
  creditLevel: MARKET.creditLevel, creditLimit: MARKET.creditLimit, interestPct: MARKET.interestPct,
  prices: marketTable(now),
});

export const wholesaleDiscountPct = (quantity: number) => MARKET.tiers.find((t) => quantity >= t.min)?.discountPct ?? 0;

// ---------- Buying into the store ----------

// Repays what it can at each new day and cancels a debt that stayed unpaid for too long; never pushes money below zero
export function settleDebt(profile: Profile, now = Date.now()) {
  const m = profile.market;
  if (m.debt <= 0) return 0;
  let paid = 0;
  if (dayIndex(now) > dayIndex(m.borrowedAt)) {
    paid = Math.min(m.debt, profile.money);
    profile.money -= paid;
    m.debt -= paid;
  }
  if (m.debt > 0 && now - m.borrowedAt > MARKET.debtDays * DAY) {
    m.debt = 0;
    m.creditLockedUntil = now + MARKET.creditLockHours * HOUR;
  }
  if (m.debt <= 0) m.borrowedAt = 0;
  return paid;
}

export function buyWholesale(profile: Profile, itemId: unknown, quantity: unknown, credit: boolean, now = Date.now()) {
  if (profile.level < MARKET.unlockLevel) throw new GameError(`Cần cấp ${MARKET.unlockLevel} để vào chợ đầu mối`);
  const product = typeof itemId === 'string' ? getProduct(itemId) : undefined;
  if (!product || !isWholesale(product)) throw new GameError('Chợ đầu mối không bán món này');
  if (profile.level < product.unlockLevel) throw new GameError(`Cần cấp ${product.unlockLevel} để nhập ${product.name}`);
  const amount = Number(quantity);
  if (!Number.isInteger(amount) || amount < 1 || amount > MARKET.maxBuy) throw new GameError('Số lượng không hợp lệ');
  if (storeUsed(profile) + amount > storeCapacity(profile, now)) throw new GameError('Kho đầy rồi, bán bớt hàng đã');
  settleDebt(profile, now);
  const unit = Math.round(marketPrice(product, now) * (100 - wholesaleDiscountPct(amount)) / 100);
  const total = unit * amount;
  if (credit) {
    const m = profile.market;
    if (profile.level < MARKET.creditLevel) throw new GameError(`Cần cấp ${MARKET.creditLevel} để nhập chịu`);
    if (now < m.creditLockedUntil) throw new GameError('Chủ chợ chưa cho nhập chịu, đợi một ngày nữa');
    const owed = Math.ceil(total * (100 + MARKET.interestPct) / 100);
    if (m.debt + owed > MARKET.creditLimit) throw new GameError('Nợ vượt hạn mức nhập chịu');
    if (m.debt <= 0) m.borrowedAt = now;
    m.debt += owed;
  } else {
    if (profile.money < total) throw new GameError('Không đủ tiền nhập hàng');
    profile.money -= total;
  }
  addToStore(profile, product.id, amount, now);
  return { item: product.id, quantity: amount, unitPrice: unit, total, debt: profile.market.debt };
}

// ---------- Opening a stall ----------

export interface StallStock { fromStore: number; bought: number; unitCost: number }

// Cost of one bought portion of a stall's stock: today's market price once the market is unlocked, else the base cost
export function stallUnitCost(profile: Profile, product: Product, now = Date.now()) {
  return profile.level >= MARKET.unlockLevel && isWholesale(product) ? marketPrice(product, now) : product.cost;
}

// Stock held in the store is used first for free; any shortfall is bought at today's price
export function stockStall(profile: Profile, product: Product, quantity: number, now = Date.now()): StallStock {
  const fromStore = Math.min(quantity, profile.store[product.id] ?? 0);
  const unitCost = stallUnitCost(profile, product, now);
  const bought = quantity - fromStore;
  if (profile.money < bought * unitCost) throw new GameError('Không đủ tiền nhập hàng');
  if (fromStore > 0) takeFromStore(profile, product.id, fromStore);
  profile.money -= bought * unitCost;
  return { fromStore, bought, unitCost };
}

// Closing a stall: unsold portions go back to the store first, the rest are refunded at what was paid for them
export function refundStall(profile: Profile, product: Product, remaining: number, stock?: StallStock) {
  const back = Math.min(remaining, stock?.fromStore ?? 0);
  if (back > 0) profile.store[product.id] = (profile.store[product.id] ?? 0) + back;
  profile.money += (remaining - back) * (stock?.unitCost ?? product.cost);
}

// ---------- Shared bulk order ----------

gameDb.exec(`CREATE TABLE IF NOT EXISTS shared_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT, target INTEGER, reward INTEGER, created_at INTEGER, expires_at INTEGER, progress INTEGER, done INTEGER
)`);
gameDb.exec('CREATE TABLE IF NOT EXISTS shared_contributions (order_id INTEGER, player TEXT, portions INTEGER, claimed INTEGER, PRIMARY KEY (order_id, player))');
const qLatest = gameDb.prepare('SELECT * FROM shared_orders ORDER BY id DESC LIMIT 1');
const qNew = gameDb.prepare('INSERT INTO shared_orders (item, target, reward, created_at, expires_at, progress, done) VALUES (?, ?, ?, ?, ?, 0, 0)');
const qProgress = gameDb.prepare('UPDATE shared_orders SET progress = ?, done = ? WHERE id = ?');
const qContribution = gameDb.prepare('SELECT portions, claimed FROM shared_contributions WHERE order_id = ? AND player = ?');
const qContribute = gameDb.prepare(`INSERT INTO shared_contributions (order_id, player, portions, claimed) VALUES (?, ?, ?, 0)
  ON CONFLICT(order_id, player) DO UPDATE SET portions = portions + excluded.portions`);
const qUnclaimed = gameDb.prepare(`SELECT c.order_id, c.portions, o.item, o.target, o.reward, o.done FROM shared_contributions c
  JOIN shared_orders o ON o.id = c.order_id WHERE c.player = ? AND c.claimed = 0 AND (o.done = 1 OR o.expires_at <= ?) ORDER BY c.order_id`);
const qClaim = gameDb.prepare('UPDATE shared_contributions SET claimed = 1 WHERE order_id = ? AND player = ? AND claimed = 0');

export interface SharedOrder { id: number; item: string; target: number; reward: number; created_at: number; expires_at: number; progress: number; done: number }

// Items a shared order may ask for: bought goods and cooked dishes, never seasonal ones
export const sharedCandidates = () => PRODUCTS
  .filter((p) => !p.seasonal && p.unlockLevel <= MARKET.sharedMaxUnlock &&
    (isWholesale(p) || Object.values(RECIPES).some((r) => r.output === p.id && !r.needsFriend)))
  .map((p) => p.id);

// The current order; a finished or expired one is replaced lazily, here
export function currentSharedOrder(now = Date.now()): SharedOrder {
  const latest = qLatest.get() as unknown as SharedOrder | undefined;
  if (latest && !latest.done && now < latest.expires_at) return latest;
  const items = sharedCandidates();
  let index = hash(`shared:${(latest?.id ?? 0) + 1}:${dayIndex(now)}`) % items.length;
  if (latest && items[index] === latest.item) index = (index + 1) % items.length;
  const product = getProduct(items[index])!;
  const reward = Math.round(product.price * MARKET.sharedTarget * MARKET.sharedRewardPct / 100);
  qNew.run(product.id, MARKET.sharedTarget, reward, now, now + MARKET.sharedHours * HOUR);
  return qLatest.get() as unknown as SharedOrder;
}

const givenToday = (profile: Profile, now: number) =>
  profile.market.sharedDay === dayIndex(now) ? profile.market.sharedGiven : 0;

export function sharedOrderView(profile: Profile, now = Date.now()) {
  const order = currentSharedOrder(now);
  const mine = (qContribution.get(order.id, profile.id) as { portions: number } | undefined)?.portions ?? 0;
  const claimable = (qUnclaimed.all(profile.id, now) as unknown as { order_id: number }[]).length;
  return {
    id: order.id, item: order.item, target: order.target, progress: order.progress, reward: order.reward,
    expiresAt: order.expires_at, level: MARKET.sharedLevel, perDay: MARKET.sharedPerDay,
    mine, givenToday: givenToday(profile, now), claimable,
  };
}

export function contributeSharedOrder(profile: Profile, quantity: unknown, now = Date.now()) {
  if (profile.level < MARKET.sharedLevel) throw new GameError(`Cần cấp ${MARKET.sharedLevel} để góp đơn lớn`);
  const order = currentSharedOrder(now);
  const wanted = Math.floor(Number(quantity)) || 0;
  if (wanted < 1) throw new GameError('Số lượng không hợp lệ');
  const dayLeft = MARKET.sharedPerDay - givenToday(profile, now);
  if (dayLeft < 1) throw new GameError('Hôm nay bạn đã góp đủ phần rồi');
  const amount = Math.min(wanted, dayLeft, order.target - order.progress, profile.store[order.item] ?? 0);
  if (amount < 1) throw new GameError('Kho không đủ hàng');
  takeFromStore(profile, order.item, amount);
  profile.market.sharedGiven = givenToday(profile, now) + amount;
  profile.market.sharedDay = dayIndex(now);
  qContribute.run(order.id, profile.id, amount);
  const progress = order.progress + amount;
  qProgress.run(progress, progress >= order.target ? 1 : 0, order.id);
  return { id: order.id, item: order.item, quantity: amount, progress, done: progress >= order.target };
}

// Pays every finished order the player contributed to, and returns portions of expired ones to the store.
// Each contribution is marked as claimed in the same step, so claiming twice pays nothing.
export function claimSharedOrder(profile: Profile, now = Date.now()) {
  const rows = qUnclaimed.all(profile.id, now) as unknown as { order_id: number; portions: number; item: string; target: number; reward: number; done: number }[];
  if (!rows.length) throw new GameError('Chưa có phần thưởng để nhận');
  let paid = 0, refunded = 0;
  const refund: Record<string, number> = {};
  for (const row of rows) {
    if (Number(qClaim.run(row.order_id, profile.id).changes) < 1) continue;
    if (row.done) {
      const share = Math.floor(row.reward * row.portions / row.target);
      profile.money += share;
      paid += share;
    } else {
      // Whatever does not fit in the store is lost, so a full store never blocks the claim
      const give = Math.min(row.portions, Math.max(0, storeCapacity(profile, now) - storeUsed(profile)));
      if (give > 0) addToStore(profile, row.item, give, now);
      refund[row.item] = (refund[row.item] ?? 0) + give;
      refunded += give;
    }
  }
  return { paid, refunded, refund };
}

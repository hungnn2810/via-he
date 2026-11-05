// Checks the wholesale market, credit and the shared bulk order on a fake clock.
//   npx tsx test/market.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-market-'));
const { getProduct, PRODUCTS } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const M = await import('../src/market.js');
const { GameError, login } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const HOUR = 3_600_000, DAY = 24 * HOUR, t0 = 200 * DAY;

const a = login('market-a-device', 'An');
const b = login('market-b-device', 'Bình');
const c = login('market-c-device', 'Cúc');
const tea = getProduct('iced_tea')!;

// Daily prices
const table = M.marketTable(t0);
const wholesale = PRODUCTS.filter((p) => !p.homegrown && !p.seasonal);
check(table.length === wholesale.length && table.every((r) => !getProduct(r.item)!.homegrown && !getProduct(r.item)!.seasonal), 'The table lists only non-homegrown, non-seasonal products');
check(table.every((r) => r.pct >= 70 && r.pct <= 130 && r.price === Math.round(r.cost * r.pct / 100)), 'Every price is 70-130% of the base cost');
check(JSON.stringify(M.marketTable(t0)) === JSON.stringify(M.marketTable(t0 + HOUR)), 'The table is the same all day for everyone');
let differs = false;
for (let d = 1; d < 30; d++) if (M.marketPct('iced_tea', t0 + d * DAY) !== M.marketPct('iced_tea', t0)) differs = true;
check(differs, 'Prices change from day to day');
check(M.marketPrices(t0).prices.length === table.length, 'The marketPrices payload carries the table');

// Buying
a.money = 10_000_000;
refuses(() => M.buyWholesale(a, 'iced_tea', 5, false, t0), 'Cần cấp 2', 'The market opens at level 2');
a.level = 2;
Object.assign(a.districts[0].lots[0], { building: 'store', level: 3, readyAt: 0 }); // capacity 40 + 120
refuses(() => M.buyWholesale(a, 'banana', 5, false, t0), 'không bán', 'Homegrown products are not sold');
refuses(() => M.buyWholesale(a, 'banh_chung', 5, false, t0), 'không bán', 'Seasonal products are not sold');
refuses(() => M.buyWholesale(a, 'popsicle', 5, false, t0), 'Cần cấp 3', 'A product needs its unlock level');
refuses(() => M.buyWholesale(a, 'iced_tea', 0, false, t0), 'không hợp lệ', 'The quantity must be positive');
refuses(() => M.buyWholesale(a, 'iced_tea', 1.5, false, t0), 'không hợp lệ', 'The quantity must be whole');
const price = M.marketPrice(tea, t0);
a.money = 1_000_000;
M.buyWholesale(a, 'iced_tea', 10, false, t0);
check(a.store.iced_tea === 10 && a.money === 1_000_000 - 10 * price, 'Ten portions cost the day price each');
M.buyWholesale(a, 'iced_tea', 20, false, t0);
const unit10 = Math.round(price * 0.9);
check(a.store.iced_tea === 30 && a.money === 1_000_000 - 10 * price - 20 * unit10, '20 portions or more are 10% cheaper');
a.store = {}; a.money = 10_000_000;
M.buyWholesale(a, 'iced_tea', 50, false, t0);
check(a.money === 10_000_000 - 50 * Math.round(price * 0.8), '50 portions or more are 20% cheaper');
a.store = {};
a.store.banana = 150;
refuses(() => M.buyWholesale(a, 'iced_tea', 11, false, t0), 'Kho đầy', 'A purchase cannot overflow the store');
const before = a.money;
check(a.store.iced_tea === undefined && a.money === before, 'A refused purchase changes nothing');
a.store = {}; a.money = 1;
refuses(() => M.buyWholesale(a, 'iced_tea', 5, false, t0), 'Không đủ tiền', 'Buying needs money');

// Credit
b.level = 3; b.money = 0;
refuses(() => M.buyWholesale(b, 'iced_tea', 5, true, t0), 'Cần cấp 4', 'Credit starts at level 4');
b.level = 4;
M.buyWholesale(b, 'iced_tea', 20, true, t0);
const principal = 20 * Math.round(price * 0.9);
check(b.money === 0 && b.store.iced_tea === 20, 'Credit gives the goods without paying');
check(b.market.debt === Math.ceil(principal * 1.05), 'The debt is the principal plus 5%');
b.money = 100;
M.settleDebt(b, t0 + HOUR);
check(b.market.debt === Math.ceil(principal * 1.05) && b.money === 100, 'Nothing is taken before the next day');
M.settleDebt(b, t0 + DAY);
check(b.money === 0 && b.market.debt === Math.ceil(principal * 1.05) - 100, 'The next day takes what the player has, never below zero');
b.money = 10_000_000;
M.settleDebt(b, t0 + DAY + HOUR);
check(b.market.debt === 0 && b.money === 10_000_000 - (Math.ceil(principal * 1.05) - 100), 'The debt is repaid in full when money allows');
b.store = {};
b.money = 0;
// The limit counts debt already owed
Object.assign(b.districts[0].lots[0], { building: 'store', level: 3, readyAt: 0 });
const bm = getProduct('banh_mi')!;
let q = 1;
while (Math.ceil((q + 1) * Math.round(M.marketPrice(bm, t0 + 5 * DAY) * (100 - M.wholesaleDiscountPct(q + 1)) / 100) * 1.05) <= 200_000) q++;
M.buyWholesale(b, 'banh_mi', q, true, t0 + 5 * DAY);
b.store = {};
const owed = b.market.debt;
check(owed <= 200_000 && owed > 150_000, 'Credit buys up to the limit');
refuses(() => M.buyWholesale(b, 'banh_mi', q, true, t0 + 5 * DAY), 'hạn mức', 'Debt cannot pass 200,000đ');
refuses(() => M.buyWholesale(b, 'banh_mi', 5, false, t0 + 5 * DAY), 'Không đủ tiền', 'Cash buying still needs cash');

// An unpaid debt older than 3 days is cancelled and credit locks for a day
const old = t0 + 5 * DAY;
b.money = 0;
M.settleDebt(b, old + 2 * DAY);
check(b.market.debt === owed && b.money === 0, 'A debt waits while it is young and the player has no money');
M.settleDebt(b, old + 3 * DAY + HOUR);
check(b.market.debt === 0 && b.money === 0, 'A debt older than 3 days is cancelled');
check(b.market.creditLockedUntil === old + 3 * DAY + HOUR + DAY, 'Credit is locked for one day after that');
b.store = {};
refuses(() => M.buyWholesale(b, 'iced_tea', 5, true, old + 3 * DAY + 2 * HOUR), 'chưa cho nhập chịu', 'Credit is refused while locked');
M.buyWholesale(b, 'iced_tea', 5, true, old + 4 * DAY + 2 * HOUR);
check(b.market.debt > 0, 'Credit works again after the lock');
check((P.privateProfile(b, 1, 40) as { market: { debt: number } }).market.debt === b.market.debt, 'The private profile shows the debt');
b.market.debt = 0;

// Stall stock: store first, shortfall at today's price
const unitStall = M.stallUnitCost(a, tea, t0);
check(unitStall === price, 'A level 2 player pays the market price for stall stock');
a.level = 2; a.money = 100_000; a.store = { iced_tea: 12 };
const stock = M.stockStall(a, tea, 20, t0);
check(stock.fromStore === 12 && stock.bought === 8 && a.money === 100_000 - 8 * price && !a.store.iced_tea, 'The store is used first, the shortfall is bought at market price');
a.money = 0;
M.refundStall(a, tea, 20, stock);
check(a.store.iced_tea === 12 && a.money === 8 * price, 'Unsold portions return to the store first, then are refunded at the price paid');
a.store = {}; a.money = 0;
refuses(() => M.stockStall(a, tea, 5, t0), 'Không đủ tiền', 'Stall stock needs money when the store is empty');
check(!a.store.iced_tea && a.money === 0, 'A refused stall stock changes nothing');
const low = login('market-low-device', 'Mới');
low.money = 100_000;
const lowStock = M.stockStall(low, tea, 20, t0);
check(low.money === 100_000 - 20 * tea.cost && lowStock.unitCost === tea.cost, 'Below level 2 stock costs the base price, as before');
M.refundStall(low, tea, 20, lowStock);
check(low.money === 100_000, 'A level 1 refund is at cost');

// Shared bulk order
const order = M.currentSharedOrder(t0);
const orderItem = getProduct(order.item)!;
check(order.target === 30 && order.reward === Math.round(orderItem.price * 30 * 1.6), 'The order is 30 portions and pays retail * 30 * 1.6');
check(!orderItem.seasonal && M.sharedCandidates().includes(order.item) && order.item !== 'grandma_soup', 'The item is not seasonal');
check(M.currentSharedOrder(t0 + HOUR).id === order.id, 'The same order lasts all day');
check(M.sharedOrderView(a, t0).item === order.item, 'The sharedOrder payload shows the current order');
a.level = 2; a.store = { [order.item]: 40 };
refuses(() => M.contributeSharedOrder(a, 5, t0), 'Cần cấp 3', 'Giving needs level 3');
a.level = 3; b.level = 3; c.level = 3;
refuses(() => M.contributeSharedOrder(c, 5, t0), 'Kho không đủ', 'Giving needs goods in the store');
refuses(() => M.contributeSharedOrder(a, 0, t0), 'không hợp lệ', 'The quantity must be positive');
M.contributeSharedOrder(a, 100, t0);
check(a.store[order.item] === 25 && M.sharedOrderView(a, t0).mine === 15, 'A player gives at most 15 portions a day');
refuses(() => M.contributeSharedOrder(a, 1, t0 + HOUR), 'đủ phần', 'The daily limit is reached');
refuses(() => M.claimSharedOrder(a, t0 + HOUR), 'Chưa có', 'Nothing to claim while the order is open');
b.store = { [order.item]: 20 };
M.contributeSharedOrder(b, 10, t0 + HOUR);
c.store = { [order.item]: 20 };
const last = M.contributeSharedOrder(c, 10, t0 + 2 * HOUR);
check(last.quantity === 5 && last.done, 'The last giver is capped at what is missing');
check(c.store[order.item] === 15, 'Only the used portions leave the store');
const next = M.currentSharedOrder(t0 + 3 * HOUR);
check(next.id !== order.id && next.progress === 0 && next.item !== order.item, 'A finished order rotates to a new one');

const moneyA = a.money, moneyB = b.money, moneyC = c.money;
const sa = M.claimSharedOrder(a, t0 + 3 * HOUR);
M.claimSharedOrder(b, t0 + 3 * HOUR);
M.claimSharedOrder(c, t0 + 3 * HOUR);
const share = (n: number) => Math.floor(order.reward * n / 30);
check(sa.paid === share(15) && a.money === moneyA + share(15) && b.money === moneyB + share(10) && c.money === moneyC + share(5), 'Contributors are paid in proportion to their portions');
check(share(15) + share(10) + share(5) <= order.reward && order.reward - (share(15) + share(10) + share(5)) < 3, 'The shares add up to the total reward');
refuses(() => M.claimSharedOrder(a, t0 + 4 * HOUR), 'Chưa có', 'Claiming again pays nothing');
check(a.money === moneyA + share(15), 'The reward is paid only once');

// Next day: the daily limit resets, and an expired unfinished order refunds
const day2 = t0 + DAY + 4 * HOUR;
const second = M.currentSharedOrder(day2);
check(second.id === next.id || second.id > next.id, 'A new day keeps or replaces the order');
const cur = M.currentSharedOrder(day2);
a.store = { [cur.item]: 10 };
M.contributeSharedOrder(a, 6, day2);
check(M.sharedOrderView(a, day2).givenToday === 6, 'The daily limit resets on a new day');
const expiredAt = cur.expires_at + HOUR;
const view = M.sharedOrderView(a, expiredAt);
check(view.id !== cur.id && view.claimable === 1, 'An expired order is replaced and claimable by its givers');
a.store = { filler: 1 };
const cap = W.storeCapacity(a, expiredAt);
a.store = { filler: cap - 2 };
const refund = M.claimSharedOrder(a, expiredAt);
check(refund.paid === 0 && refund.refunded === 2 && a.store[cur.item] === 2, 'An expired order refunds what fits in the store, the rest is lost');
refuses(() => M.claimSharedOrder(a, expiredAt), 'Chưa có', 'The refund is given once');
check(W.storeUsed(a) === cap, 'The refund never overflows the store');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

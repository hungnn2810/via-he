// Checks the diverse goods: product categories, the four wholesale-only new products and customer groups.
//   npx tsx test/goods.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-goods-'));
const { PRODUCTS, CUSTOMER_GROUPS, TOURIST, getProduct, groupOfProduct } = await import('../src/data.js');
const P = await import('../src/profile.js');
const M = await import('../src/market.js');
const { GameError, login } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const DAY = 24 * 3_600_000, t0 = 300 * DAY;
const perSecond = (x: { price: number; cost: number; sellSeconds: number }) => (x.price - x.cost) / x.sellSeconds;

// Categories
const categories = ['snack', 'drink', 'toy', 'goods'];
check(PRODUCTS.every((p) => categories.includes(p.category)), 'Every product has a valid category');
check(categories.every((c) => PRODUCTS.some((p) => p.category === c)), 'Every category has at least one product');
check(['iced_tea', 'sugarcane_juice', 'fresh_cane', 'fresh_milk'].every((id) => getProduct(id)!.category === 'drink'), 'Drinks are in the drink tab');
check(getProduct('popsicle')!.category === 'snack' && getProduct('banh_mi')!.category === 'snack', 'Snacks stay snacks');
check(['soap_bubbles', 'pinwheel'].every((id) => getProduct(id)!.category === 'toy'), 'Bubbles and pinwheels are toys');
check(['plastic_sandals', 't_shirt'].every((id) => getProduct(id)!.category === 'goods'), 'Sandals and T-shirts are goods');

// The catalog message ships the product list as is, so each entry carries its category
const catalogProducts = JSON.parse(JSON.stringify(PRODUCTS)) as typeof PRODUCTS;
check(catalogProducts.every((p) => typeof p.category === 'string' && p.category.length > 0), 'Catalog entries carry the category');

// The new products
const added = [
  { id: 'soap_bubbles', level: 3, cost: 3000, price: 9000, secs: 2, xp: 2 },
  { id: 'pinwheel', level: 5, cost: 7000, price: 22000, secs: 3, xp: 3 },
  { id: 'plastic_sandals', level: 7, cost: 25000, price: 55000, secs: 5, xp: 5 },
  { id: 't_shirt', level: 9, cost: 60000, price: 109000, secs: 7, xp: 6 },
];
for (const a of added) {
  const p = getProduct(a.id);
  check(p && p.unlockLevel === a.level && p.cost === a.cost && p.price === a.price && p.sellSeconds === a.secs && p.xp === a.xp, `${a.id} has the agreed numbers`);
  check(p && !p.homegrown && !p.seasonal && M.isWholesale(p), `${a.id} is wholesale only`);
}
check(PRODUCTS.every((p, i) => i === 0 || p.unlockLevel >= PRODUCTS[i - 1].unlockLevel), 'The catalog stays sorted by unlock level');
check(new Set(PRODUCTS.map((p) => p.id)).size === PRODUCTS.length, 'Product ids are unique');
const ladder = PRODUCTS.filter(M.isWholesale);
check(ladder.every((x, i) => i === 0 || perSecond(x) >= perSecond(ladder[i - 1]) || x.unlockLevel === ladder[i - 1].unlockLevel), 'Wholesale profit per second never drops as levels rise');

// New products follow the market's daily prices
const table = M.marketTable(t0);
check(added.every((a) => table.some((r) => r.item === a.id)), 'The market table lists the new products');
check(added.every((a) => { const r = table.find((x) => x.item === a.id)!; return r.pct >= 70 && r.pct <= 130 && r.price === Math.round(a.cost * r.pct / 100); }), 'Their prices are 70-130% of the base cost');

const buyer = login('goods-buyer-device', 'Người mua');
buyer.money = 10_000_000;
buyer.level = 2;
Object.assign(buyer.districts[0].lots[0], { building: 'store', level: 3, readyAt: 0 });
refuses(() => M.buyWholesale(buyer, 'soap_bubbles', 5, false, t0), 'Cần cấp 3', 'Bubbles need level 3');
buyer.level = 3;
const bought = M.buyWholesale(buyer, 'soap_bubbles', 10, false, t0);
check(buyer.store.soap_bubbles === 10 && bought.unitPrice === M.marketPrice(getProduct('soap_bubbles')!, t0), 'Bubbles are bought at the day price');
refuses(() => M.buyWholesale(buyer, 'pinwheel', 5, false, t0), 'Cần cấp 5', 'Pinwheels need level 5');
refuses(() => M.buyWholesale(buyer, 't_shirt', 5, false, t0), 'Cần cấp 9', 'T-shirts need level 9');

// Customer groups
const everyGroup = Object.keys(CUSTOMER_GROUPS);
check(['homemaker', 'student', 'kid', 'shopper'].every((g) => everyGroup.includes(g)), 'Kid and shopper groups exist');
const wantedAnywhere = (id: string) => everyGroup.some((g) => CUSTOMER_GROUPS[g].includes(id));
check(PRODUCTS.filter((p) => !wantedAnywhere(p.id)).map((p) => p.id).join(',') === '', 'Every product belongs to at least one group (none falls back by accident)');
check(Object.values(CUSTOMER_GROUPS).every((list) => list.every((id) => getProduct(id))), 'Groups list only real products');
check(groupOfProduct('soap_bubbles') === 'kid' && groupOfProduct('pinwheel') === 'kid', 'Toys resolve to the kid group');
check(groupOfProduct('plastic_sandals') === 'shopper' && groupOfProduct('t_shirt') === 'shopper', 'Sandals and T-shirts resolve to the shopper group');
check(groupOfProduct('iced_tea') === 'student' && groupOfProduct('popsicle') === 'student', 'Iced tea and popsicles keep resolving to student');
check(['banana', 'sticky_rice', 'rambutan', 'tofu_noodles', 'flowers'].every((id) => groupOfProduct(id) === 'homemaker'),'Homemaker items keep resolving to homemaker');
check(PRODUCTS.every((p) => CUSTOMER_GROUPS[groupOfProduct(p.id)]?.includes(p.id)), 'Each product resolves to a group that lists it');

// A customer of a group only picks a second item from that group's products (the spawnCustomer rule); tourists pick anything
const wantsFor = (group: string, possible: string[]) => possible.filter((id) => group === TOURIST || CUSTOMER_GROUPS[group].includes(id));
const everything = PRODUCTS.map((p) => p.id);
check(wantsFor('kid', everything).every((id) => ['soap_bubbles', 'pinwheel', 'popsicle', 'iced_tea'].includes(id)), 'Kids only want their products');
check(wantsFor('shopper', everything).every((id) => ['plastic_sandals', 't_shirt', 'banana', 'sticky_rice', 'rambutan', 'tofu_noodles', 'flowers'].includes(id)), 'Shoppers only want their products');
check(wantsFor(TOURIST, everything).length === everything.length, 'Tourists buy anything, including the new products');

// Gating by the street owner's level (the `possible` filter in spawnCustomer uses max(3, ownerLevel))
const possibleAt = (ownerLevel: number) => PRODUCTS.filter((p) => p.unlockLevel <= Math.max(3, ownerLevel) && !p.seasonal).map((p) => p.id);
check(possibleAt(1).includes('soap_bubbles') && !possibleAt(1).includes('pinwheel'), 'A low-level street draws bubble buyers but not pinwheel buyers');
check(wantsFor('shopper', possibleAt(4)).every((id) => !['plastic_sandals', 't_shirt'].includes(id)), 'Shoppers do not ask for sandals before level 7');
check(wantsFor('shopper', possibleAt(7)).includes('plastic_sandals') && !wantsFor('shopper', possibleAt(7)).includes('t_shirt'), 'Sandals appear at level 7, T-shirts later');
check(wantsFor('shopper', possibleAt(9)).includes('t_shirt'), 'T-shirts appear at level 9');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

// Prints the per-product profit table and the levelling curve, read straight from server/src/data.ts.
//   cd server && npx tsx ../.agents/skills/balance/scripts/profit-table.ts
import { PRODUCTS, RECIPES, WEARABLES, BALANCE, xpToLevelUp, maxEmployeesForLevel, hireCost } from '../../../../server/src/data.js';

const d = (n: number) => n.toLocaleString('vi-VN');
const l = (s: string | number, w: number) => String(s).padEnd(w);
const r = (s: string | number, w: number) => String(s).padStart(w);
const perSec = (p: { price: number; cost: number; sellSeconds: number }) => (p.price - p.cost) / p.sellSeconds;

console.log('\nPRODUCTS — by profit per second');
console.log(l('product', 12) + r('lvl', 4) + r('cost', 9) + r('price', 9) + r('profit', 9) + r('secs', 6) + r('profit/s', 10) + r('xp/s', 8) + r('full stall', 12));
for (const p of [...PRODUCTS].sort((a, b) => perSec(a) - perSec(b))) {
  console.log(
    l(p.name, 12) + r(p.unlockLevel, 4) + r(d(p.cost), 9) + r(d(p.price), 9) + r(d(p.price - p.cost), 9) +
    r(p.sellSeconds, 6) + r(d(Math.round(perSec(p))), 10) + r((p.xp / p.sellSeconds).toFixed(2), 8) +
    r(d(p.cost * BALANCE.baseStallCapacity), 12));
}

console.log('\nLEVELLING — assuming nonstop sales of the best product unlocked');
console.log(l('lvl', 5) + r('xp needed', 11) + r('best product', 14) + r('minutes', 9) + r('money/min', 11) + r('employees', 11));
for (let level = 1; level <= 12; level++) {
  // Seasonal items and recipes locked behind a neighbour's friendship are not what a player can sell nonstop
  const locked = new Set(Object.values(RECIPES).filter((r) => r.needsFriend).map((r) => r.output));
  const best = PRODUCTS.filter((p) => p.unlockLevel <= level && !p.seasonal && !locked.has(p.id)).reduce((a, b) => (perSec(b) > perSec(a) ? b : a));
  const xp = xpToLevelUp(level);
  console.log(
    l(level, 5) + r(d(xp), 11) + r(best.name, 14) + r((xp / (best.xp / best.sellSeconds) / 60).toFixed(1), 9) +
    r(d(Math.round(perSec(best) * 60)), 11) + r(maxEmployeesForLevel(level), 11));
}

const sum = (f: (w: typeof WEARABLES[number]) => number) => WEARABLES.reduce((s, w) => s + f(w), 0);
console.log(`\nWEARABLES — ${WEARABLES.length} items; wearing the best of each slot is capped by slot, ` +
  `the full set totals +${sum((w) => w.charm)} charm, +${sum((w) => w.moneyPct)}% money, +${sum((w) => w.xpPct)}% xp, ` +
  `costing ${d(sum((w) => w.price))}đ`);
console.log(`Hiring a 0-stat employee: ${d(hireCost(0, 0, 0))}đ · a 10/10/10 one: ${d(hireCost(10, 10, 10))}đ`);
console.log(`Starting money ${d(BALANCE.startingMoney)}đ · ${BALANCE.slotsPerStreet} slots (${BALANCE.ownerSlots} reserved) · ` +
  `sidewalk fee ${BALANCE.sidewalkFeePct}% · a customer every ${BALANCE.customerSpawnSeconds}s, up to ${BALANCE.maxCustomers}\n`);

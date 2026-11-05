// Checks regular customers: slots, recruiting, appearing, loyalty, tiers, bonuses, the core gift, fame caps and the daily task.
//   npx tsx test/regulars.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-test-'));
const { BALANCE, DAILY_TASKS, FAME } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const R = await import('../src/regulars.js');
const { login } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const HOUR = 3_600_000, DAY = 24 * HOUR, t0 = 100 * DAY;
const never = () => 0.99;   // every chance fails
const always = () => 0;     // every chance succeeds, and picks the first option

const owner = login('regulars-owner', 'Chủ phố');
const visitor = login('regulars-visitor', 'Khách ghé');
owner.level = 5;

// Slots: 3 from the start, +1 per 2 finished buildings on the district's lots, max 6
const finish = (profile: typeof owner, district: number, count: number, at: number) => {
  profile.districts[district].lots.forEach((lot, i) => {
    Object.assign(lot, i < count ? { building: 'store', level: 1, readyAt: at } : { building: '', readyAt: 0 });
  });
};
check(R.regularSlots(owner, 0, t0) === 3, 'A new street has 3 regular slots');
finish(owner, 0, 1, t0);
check(R.regularSlots(owner, 0, t0) === 3, 'One finished building adds no slot');
finish(owner, 0, 2, t0);
check(R.regularSlots(owner, 0, t0) === 4, 'Two finished buildings add a slot');
finish(owner, 0, 2, t0 + HOUR);
check(R.regularSlots(owner, 0, t0) === 3, 'Buildings still under construction do not count');
finish(owner, 0, 4, t0);
check(R.regularSlots(owner, 0, t0) === 5, 'Four finished buildings give 5 slots');
check(R.REGULARS.maxSlots === 6, 'The slot cap is 6');
finish(owner, 0, 0, t0);
check(R.openRegularSlots(owner, 0, t0) === 3, 'All 3 slots start open');
check(Array.isArray(owner.regulars.list) && owner.regulars.list.length === 0, 'Profiles have an empty regular book by default');

// Recruiting
check(R.maybeRecruit(owner, 0, 'homemaker', 'banana', t0, never) === null, 'A failed 15% roll recruits nobody');
check(R.maybeRecruit(owner, 0, 'tourist', 'banana', t0, always) === null, 'Tourists never become regulars');
const first = R.maybeRecruit(owner, 0, 'homemaker', 'banana', t0, always)!;
check(!!first && first.group === 'homemaker' && first.district === 0, 'A passing roll recruits a regular of the same group');
check(first.favourite === 'banana', 'The favourite is the product just bought');
check(first.name === 'Chị Hai' && first.nickname === 'bán vé số', 'Regulars get a Vietnamese name and nickname');
check(first.loyalty === R.REGULARS.favouritePoints, 'The first purchase of the favourite counts as 10 loyalty');
check(R.openRegularSlots(owner, 0, t0) === 2, 'A regular takes a slot');
const second = R.maybeRecruit(owner, 0, 'student', 'banh_mi', t0, always)!;
check(second.name !== first.name && second.group === 'student', 'Each regular on a street gets a different name');
check(R.REGULAR_NAMES.length === 16, 'There are 16 names');
check(second.favourite === 'iced_tea' || second.favourite === 'banh_mi', 'A student favourite is a student product');
// A product the owner level does not allow (flowers, level 10) cannot become a favourite
owner.level = 5;
const third = R.maybeRecruit(owner, 0, 'homemaker', 'flowers', t0, always)!;
check(third.favourite !== 'flowers', 'A favourite must be allowed at the owner\'s level');
check(R.openRegularSlots(owner, 0, t0) === 0 && R.maybeRecruit(owner, 0, 'homemaker', 'banana', t0, always) === null, 'A full street recruits nobody');
check(R.regularsOn(owner, 1).length === 0, 'Regulars belong to one district');
// Seasonal products are never favourites
for (let i = 0; i < 20; i++) {
  const o = login(`regulars-seasonal-${i}`, 'x');
  const r = R.maybeRecruit(o, 0, 'homemaker', 'banh_chung', t0, i % 2 ? always : () => (i / 20 < 0.15 ? 0 : 0.5));
  if (r && ['banh_chung', 'moon_cake', 'sugarcane_juice'].includes(r.favourite)) check(false, 'Seasonal favourite');
}
check(true, 'Seasonal products are never favourites');
// NPC streets keep no regulars
const npc = login('regulars-npc', 'NPC'); npc.isNpc = true;
check(R.maybeRecruit(npc, 0, 'homemaker', 'banana', t0, always) === null && R.pickAppearingRegular(npc, 0, new Set(), t0, always) === null, 'NPC streets have no regulars');

// Appearing
const [a, b, c] = R.regularsOn(owner, 0);
a.lastSeenAt = t0 - 2 * HOUR; b.lastSeenAt = t0 - 10 * 60_000; c.lastSeenAt = t0 - 10 * 60_000;
check(R.pickAppearingRegular(owner, 0, new Set(), t0, never) === null, 'Most spawns stay anonymous (10% chance)');
check(R.pickAppearingRegular(owner, 0, new Set(), t0, always)?.id === a.id, 'A regular who has not visited for an hour is preferred');
check(R.pickAppearingRegular(owner, 0, new Set([a.id]), t0, always)!.id !== a.id, 'A regular already on the street does not appear twice');
let rolls = 0;
const sequence = () => [0, 0.5][rolls++ % 2];   // appear roll passes, then the stale roll (0.5 >= 0.3) fails
check(R.pickAppearingRegular(owner, 0, new Set([a.id]), t0, sequence) === null, 'Recently seen regulars rarely come back');
check(R.pickAppearingRegular(owner, 0, new Set([a.id]), t0, always) !== null, 'But they still can (reduced chance)');
R.markSeen(owner, a, t0);
check(a.lastSeenAt === t0 && a.lastSeenDay === W.dayIndex(t0), 'Appearing updates the last seen time and day');
check(R.regularWants(a, ['banana', 'rambutan', 'iced_tea'], never).join() === a.favourite, 'A regular wants its favourite');
const wants = R.regularWants(a, ['banana', 'rambutan', 'iced_tea'], always);
check(wants.length === 2 && wants[0] === a.favourite && wants[1] !== a.favourite && wants[1] !== 'iced_tea', 'Sometimes it also wants one more product of its group');
check(R.regularLook(a) === R.regularLook(a) && R.regularLook(a) >= 0 && R.regularLook(a) < 12, 'A regular always looks the same');

// Loyalty: favourite +10, other +5, counted on the street whoever sells
const x = R.REGULARS;
a.loyalty = 0; a.gainDay = 0; a.gainToday = 0; a.giftDay = 0;
const other = a.favourite === 'rambutan' ? 'banana' : 'rambutan';
let res = R.recordRegularSale(owner, owner, a, a.favourite, 0, t0);
void res;
check(res.loyalty === 10 && a.loyalty === 10 && res.gained === 10, 'Buying the favourite gives 10 loyalty');
res = R.recordRegularSale(owner, owner, a, other, 0, t0);
check(a.loyalty === 15, 'Any other product gives 5 loyalty');
res = R.recordRegularSale(owner, visitor, a, a.favourite, 0, t0);
check(a.loyalty === 25 && regularLoyaltyOnOwner(a.id) === 25, 'A sale at a visitor\'s stall counts for the street owner');
check(visitor.regulars.list.length === 0, 'Nothing is recorded on the visitor profile');
function regularLoyaltyOnOwner(id: string) { return R.regularById(owner, id)?.loyalty; }

// Daily loyalty cap
for (let i = 0; i < 10; i++) R.recordRegularSale(owner, owner, a, a.favourite, 0, t0);
check(a.loyalty === x.maxLoyaltyPerDay && a.gainToday === x.maxLoyaltyPerDay, `Loyalty rises at most ${x.maxLoyaltyPerDay} a day per regular`);
R.recordRegularSale(owner, owner, a, a.favourite, 0, t0 + DAY);
check(a.loyalty === 50, 'The cap resets the next day');

// Tiers and bonuses
check(R.tierOf(0) === 'new' && R.tierOf(29) === 'new', 'Under 30 loyalty is a new regular');
check(R.tierOf(30) === 'familiar' && R.tierOf(59) === 'familiar', '30 loyalty is Quen');
check(R.tierOf(60) === 'close' && R.tierOf(99) === 'close', '60 loyalty is Thân thiết');
check(R.tierOf(100) === 'core', '100 loyalty is Ruột');
check(R.TIER_NAMES.familiar === 'Quen' && R.TIER_NAMES.close === 'Thân thiết' && R.TIER_NAMES.core === 'Ruột', 'Tier names are Vietnamese');
check(R.tierBonusPct(29) === 0 && R.tierBonusPct(30) === 10 && R.tierBonusPct(60) === 20 && R.tierBonusPct(100) === 20, 'Bonuses are 0 / +10% / +20% / +20%');
check(!R.rollSecondPortion({ ...a, loyalty: 59 }, always) && R.rollSecondPortion({ ...a, loyalty: 60 }, always), 'Only Thân thiết and Ruột want a second portion');
check(!R.rollSecondPortion({ ...a, loyalty: 60 }, () => 0.25) && R.rollSecondPortion({ ...a, loyalty: 60 }, () => 0.249), 'The second portion chance is 25%');
check(res.bonusPct === 0 && R.recordRegularSale(owner, owner, a, a.favourite, 20, t0 + DAY).bonusPct === 20, 'The sale result reports the bonus that was applied');

// Loyalty never goes past 100 and never decays
a.loyalty = 95; a.gainDay = 0; a.gainToday = 0; a.giftDay = 0;
// The Ruột gift: 5,000đ and 1 fame to the owner, once a day
const day = t0 + 10 * DAY;
const money0 = owner.money, fame0 = owner.fame;
res = R.recordRegularSale(owner, visitor, a, a.favourite, 0, day);
check(a.loyalty === 100 && res.tier === 'core', 'Loyalty is capped at 100');
check(res.gift?.money === 5000 && owner.money === money0 + 5000 && owner.fame === fame0 + 1, 'A Ruột regular leaves 5,000đ and 1 fame for the owner');
check(visitor.money !== money0 + 5000, 'The gift goes to the street owner, not to the seller');
res = R.recordRegularSale(owner, visitor, a, a.favourite, 0, day + HOUR);
check(res.gift === null && owner.money === money0 + 5000 && owner.fame === fame0 + 1, 'The gift is only given once per day');
res = R.recordRegularSale(owner, visitor, a, a.favourite, 0, day + DAY);
check(res.gift?.money === 5000 && owner.money === money0 + 10_000, 'The next day the regular leaves a gift again');
check(a.loyalty === 100 && R.tierOf(a.loyalty) === 'core', 'Loyalty never decays while the owner is away');

// Gift fame caps: at most 3 a day from regulars, and never above the daily sales-fame cap
const cappedDay = t0 + 20 * DAY;
finish(owner, 0, 4, t0);
const d = R.maybeRecruit(owner, 0, 'student', 'popsicle', cappedDay, always)!;
const e = R.maybeRecruit(owner, 0, 'homemaker', 'banana', cappedDay, always)!;
check(!!d && !!e && R.regularsOn(owner, 0).length === 5, 'Finished buildings open more slots for more regulars');
for (const r of [b, c, d, e]) { r.loyalty = 100; r.giftDay = 0; r.gainDay = 0; r.gainToday = 0; }
a.loyalty = 100; a.giftDay = 0;
const fameBefore = owner.fame;
const moneyBefore = owner.money;
for (const r of [a, b, c, d, e]) R.recordRegularSale(owner, visitor, r, r.favourite, 20, cappedDay);
check(owner.money === moneyBefore + 5 * 5000, 'Every Ruột regular still leaves its money');
check(owner.fame === fameBefore + x.maxGiftFamePerDay, `Gift fame stops at ${x.maxGiftFamePerDay} a day`);
const nextCap = cappedDay + DAY;
W.recordStreetSales(owner, 0, nextCap);
owner.fameDay.salesFame = FAME.maxSalesPerDay;
const fameFull = owner.fame;
a.giftDay = 0;
R.recordRegularSale(owner, owner, a, a.favourite, 20, nextCap);
check(owner.fame === fameFull && owner.money > moneyBefore, 'Gift fame respects the daily sales-fame cap too');

// Daily task: "Đón khách quen", 3 sales to regulars
check(DAILY_TASKS.some((t) => t.id === 'regular' && t.name === 'Đón khách quen' && t.target === 3), 'The daily task exists with a target of 3');
const seller = login('regulars-seller', 'Người bán');
const taskDay = t0 + 30 * DAY;
const sellerMoney = seller.money;
const xps = [1, 2, 3, 4].map(() => R.recordRegularSale(owner, seller, b, b.favourite, 0, taskDay).xp);
const task = seller.daily.tasks.find((t) => t.id === 'regular')!;
check(task.progress === 3 && task.done, 'Three sales to regulars finish the task');
check(xps[0] === 0 && xps[1] === 0 && xps[2] === BALANCE.dailyTaskXp && xps[3] === 0, 'The task pays its XP once');
check(seller.money === sellerMoney + BALANCE.dailyTaskMoney, 'The task pays the money once');
// A profile whose tasks were created before the new task existed still gets it
const oldSave = login('regulars-old-save', 'Cũ');
oldSave.daily = { day: W.dayIndex(taskDay), tasks: [{ id: 'sell', progress: 0, target: 10, done: false }] };
R.recordRegularSale(owner, oldSave, b, b.favourite, 0, taskDay);
check(oldSave.daily.tasks.find((t) => t.id === 'regular')?.progress === 1, 'Old daily lists gain the new task');

// Messages
const view = R.regularsView(owner, 0, t0);
check(view.openSlots === 0 && view.totalSlots === 5 && view.regulars.length === 5, 'The regulars view lists the street\'s regulars and the open slots');
const entry = view.regulars.find((r) => r.id === a.id)!;
check(['id', 'name', 'nickname', 'group', 'favourite', 'loyalty', 'tier'].every((k) => k in entry) && entry.tier === 'core', 'A regular entry has the contract keys');
const push = R.regularSaleView(R.recordRegularSale(owner, owner, c, c.favourite, 20, t0 + 40 * DAY));
check(['regularId', 'name', 'tier', 'loyalty', 'bonusPct'].every((k) => k in push) && push.bonusPct === 20, 'The regularSale push has the contract keys');

// Old saves: a profile without the book gets one
const legacy = login('regulars-legacy', 'Cũ hơn') as unknown as Record<string, unknown>;
delete legacy.regulars;
check(R.regularsOn(legacy as unknown as typeof owner, 0).length === 0 && !!legacy.regulars, 'A profile without a regular book gets an empty one');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

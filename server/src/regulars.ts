// Regular customers (khách quen): each street keeps a few named customers who come back, grow loyal and pay more.
// Regulars belong to the STREET (the owner's profile, per district). Loyalty is earned by every sale to them, whoever
// runs the stall, so visitors who co-sell help the owner. Nothing decays and nothing can be lost while the owner is away.
// Every function takes `now` (and `random`) so tests can run on a fake clock with fixed dice.
import { CUSTOMER_GROUPS, DAILY_TASKS, FAME, getProduct } from './data.js';
import { markDirty, type Profile } from './profile.js';
import { addFame, dayIndex, isBuilt, progressTask, recordStreetSales, refreshDaily } from './world.js';

// All numbers are provisional.
export const REGULARS = {
  baseSlots: 3,               // slots open from the start of each district
  buildingsPerSlot: 2,        // +1 slot for every 2 finished buildings on the district's lots
  maxSlots: 6,
  recruitChance: 0.15,        // a non-regular customer who buys may become a regular (if a slot is free)
  favouriteBoughtChance: 0.7, // a new regular's favourite is the product just bought, else another of the group
  appearChance: 0.1,          // per customer spawn, a regular comes instead of an anonymous customer
  staleAppearChance: 0.3,     // share of those spawns still allowed when every regular visited within the last hour
  revisitGapMs: 3_600_000,    // a regular is "fresh" when it has not visited for this long
  extraWantChance: 0.35,      // same chance as anonymous customers to want one more product of the group
  favouritePoints: 10,
  otherPoints: 5,
  maxLoyalty: 100,
  maxLoyaltyPerDay: 40,       // per regular per day, against alt-account farming
  familiarAt: 30, familiarBonusPct: 10,
  closeAt: 60, closeBonusPct: 20, secondPortionChance: 0.25,
  coreAt: 100,
  giftMoney: 5000,            // a core regular's daily gift to the street owner
  giftFame: 1,
  maxGiftFamePerDay: 3,       // fame from gifts per street per day (also counted in the daily sales-fame cap)
};

export type RegularTier = 'new' | 'familiar' | 'close' | 'core';

// Player-facing tier names stay Vietnamese
export const TIER_NAMES: Record<RegularTier, string> = { new: 'Mới', familiar: 'Quen', close: 'Thân thiết', core: 'Ruột' };

// Fictional locals: name + short nickname shown to players
export const REGULAR_NAMES: { name: string; nickname: string }[] = [
  { name: 'Chị Hai', nickname: 'bán vé số' },
  { name: 'Bác Tư', nickname: 'xe ôm đầu hẻm' },
  { name: 'Cô Ba', nickname: 'bán rau chợ' },
  { name: 'Chú Năm', nickname: 'thợ sửa xe' },
  { name: 'Anh Sáu', nickname: 'shipper' },
  { name: 'Bà Bảy', nickname: 'hưu trí' },
  { name: 'Cậu Út', nickname: 'sinh viên' },
  { name: 'Dì Tám', nickname: 'tiệm may' },
  { name: 'Ông Chín', nickname: 'nghe đài sáng' },
  { name: 'Cô Mười', nickname: 'cô giáo mầm non' },
  { name: 'Chị Tư', nickname: 'phục vụ quán' },
  { name: 'Bé Na', nickname: 'học sinh lớp 5' },
  { name: 'Anh Hai', nickname: 'bảo vệ tòa nhà' },
  { name: 'Bác Sáu', nickname: 'thợ hồ' },
  { name: 'Chú Bảy', nickname: 'tài xế taxi' },
  { name: 'Cô Út', nickname: 'y tá' },
];

export interface Regular {
  id: string;
  district: number;
  name: string;
  nickname: string;
  group: string;        // homemaker | student (tourists never become regulars)
  favourite: string;    // product id
  loyalty: number;      // 0..100
  lastSeenDay: number;  // day index of the last visit
  lastSeenAt: number;   // timestamp of the last visit
  giftDay: number;      // day index of the last gift to the owner
  gainDay: number;      // loyalty gained today (cap), see REGULARS.maxLoyaltyPerDay
  gainToday: number;
}

// Stored on the owner profile
export interface RegularBook {
  list: Regular[];
  giftFameDay: number;  // fame given by gifts, per day
  giftFameToday: number;
}

export const emptyRegularBook = (): RegularBook => ({ list: [], giftFameDay: 0, giftFameToday: 0 });

const book = (owner: Profile): RegularBook => (owner.regulars ??= emptyRegularBook());
const pick = <T>(arr: T[], random: () => number) => arr[Math.min(arr.length - 1, Math.floor(random() * arr.length))];

export const regularsOn = (owner: Profile, district: number) => book(owner).list.filter((r) => r.district === district);
export const regularById = (owner: Profile, id: string) => book(owner).list.find((r) => r.id === id);

export function regularSlots(owner: Profile, district: number, now = Date.now()) {
  const built = owner.districts[district]?.lots.filter((l) => isBuilt(l, now)).length ?? 0;
  return Math.min(REGULARS.maxSlots, REGULARS.baseSlots + Math.floor(built / REGULARS.buildingsPerSlot));
}

export const openRegularSlots = (owner: Profile, district: number, now = Date.now()) =>
  Math.max(0, regularSlots(owner, district, now) - regularsOn(owner, district).length);

export function tierOf(loyalty: number): RegularTier {
  if (loyalty >= REGULARS.coreAt) return 'core';
  if (loyalty >= REGULARS.closeAt) return 'close';
  if (loyalty >= REGULARS.familiarAt) return 'familiar';
  return 'new';
}

// Extra revenue the seller earns from a regular of this loyalty
export function tierBonusPct(loyalty: number) {
  const tier = tierOf(loyalty);
  if (tier === 'close' || tier === 'core') return REGULARS.closeBonusPct;
  return tier === 'familiar' ? REGULARS.familiarBonusPct : 0;
}

// Same regular always looks the same on the street
export function regularLook(r: Regular) {
  let h = 0;
  for (const ch of r.id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 12;
}

// ---------- Becoming a regular ----------

// Products a street owner of this level could pick as a favourite for this group
function favouriteChoices(group: string, level: number) {
  return (CUSTOMER_GROUPS[group] ?? []).filter((id) => {
    const p = getProduct(id);
    return !!p && !p.seasonal && p.unlockLevel <= level;
  });
}

// Called after a non-regular customer completes a purchase. Returns the new regular, or null.
export function maybeRecruit(
  owner: Profile, district: number, group: string, productId: string, now = Date.now(), random: () => number = Math.random,
): Regular | null {
  if (owner.isNpc || !CUSTOMER_GROUPS[group] || openRegularSlots(owner, district, now) < 1) return null;
  if (random() >= REGULARS.recruitChance) return null;
  const choices = favouriteChoices(group, owner.level);
  if (!choices.length) return null;
  const favourite = choices.includes(productId) && random() < REGULARS.favouriteBoughtChance ? productId : pick(choices, random);
  const used = new Set(regularsOn(owner, district).map((r) => r.name + r.nickname));
  const free = REGULAR_NAMES.filter((n) => !used.has(n.name + n.nickname));
  const who = pick(free.length ? free : REGULAR_NAMES, random);
  const points = productId === favourite ? REGULARS.favouritePoints : REGULARS.otherPoints;
  const today = dayIndex(now);
  const regular: Regular = {
    id: `r${Math.floor(random() * 1e9).toString(36)}${book(owner).list.length}`,
    district, name: who.name, nickname: who.nickname, group, favourite, loyalty: points,
    lastSeenDay: today, lastSeenAt: now, giftDay: 0, gainDay: today, gainToday: points,
  };
  book(owner).list.push(regular);
  markDirty(owner);
  return regular;
}

// ---------- Appearing ----------

// Called once per customer spawn: maybe returns the regular who shows up instead of an anonymous customer.
// `busy` holds the ids of regulars already walking the street. Prefers regulars who have not visited for an hour.
export function pickAppearingRegular(
  owner: Profile, district: number, busy: Set<string>, now = Date.now(), random: () => number = Math.random,
): Regular | null {
  if (owner.isNpc) return null;
  const free = regularsOn(owner, district).filter((r) => !busy.has(r.id));
  if (!free.length || random() >= REGULARS.appearChance) return null;
  const fresh = free.filter((r) => now - r.lastSeenAt >= REGULARS.revisitGapMs);
  if (fresh.length) return pick(fresh, random);
  return random() < REGULARS.staleAppearChance ? pick(free, random) : null;
}

export function markSeen(owner: Profile, regular: Regular, now = Date.now()) {
  regular.lastSeenAt = now;
  regular.lastSeenDay = dayIndex(now);
  markDirty(owner);
}

// What a regular wants: its favourite, plus maybe one more product of its group (from the products on offer)
export function regularWants(regular: Regular, possible: string[], random: () => number = Math.random) {
  const wants = [regular.favourite];
  if (random() < REGULARS.extraWantChance) {
    const more = possible.filter((id) => id !== regular.favourite && (CUSTOMER_GROUPS[regular.group] ?? []).includes(id));
    if (more.length) wants.push(pick(more, random));
  }
  return wants;
}

// ---------- Sales ----------

export interface RegularSaleResult {
  regular: Regular;
  tier: RegularTier;       // tier after this sale
  loyalty: number;
  gained: number;
  bonusPct: number;        // revenue bonus that applied to this sale
  xp: number;              // XP from finishing the daily task, for the seller
  gift: { money: number; fame: number } | null;
}

// Fame from a gift obeys the street's daily caps: our own cap and the existing daily sales-fame cap
function giftFame(owner: Profile, now: number) {
  recordStreetSales(owner, 0, now); // refreshes owner.fameDay for the new day without adding anything
  const b = book(owner);
  const today = dayIndex(now);
  if (b.giftFameDay !== today) { b.giftFameDay = today; b.giftFameToday = 0; }
  if (b.giftFameToday + REGULARS.giftFame > REGULARS.maxGiftFamePerDay) return 0;
  if (owner.fameDay.salesFame + REGULARS.giftFame > FAME.maxSalesPerDay) return 0;
  b.giftFameToday += REGULARS.giftFame;
  owner.fameDay.salesFame += REGULARS.giftFame;
  addFame(owner, REGULARS.giftFame);
  return REGULARS.giftFame;
}

// Records a sale of `productId` to a regular. `bonusPct` is what tierBonusPct() returned before the sale (the
// caller already used it for the revenue). Loyalty goes to the street (owner profile) whoever the seller is.
export function recordRegularSale(
  owner: Profile, seller: Profile, regular: Regular, productId: string, bonusPct: number, now = Date.now(),
): RegularSaleResult {
  const today = dayIndex(now);
  if (regular.gainDay !== today) { regular.gainDay = today; regular.gainToday = 0; }
  const points = productId === regular.favourite ? REGULARS.favouritePoints : REGULARS.otherPoints;
  const gained = Math.max(0, Math.min(points, REGULARS.maxLoyaltyPerDay - regular.gainToday, REGULARS.maxLoyalty - regular.loyalty));
  regular.loyalty += gained;
  regular.gainToday += gained;
  regular.lastSeenAt = now;
  regular.lastSeenDay = today;

  let gift: RegularSaleResult['gift'] = null;
  if (regular.loyalty >= REGULARS.coreAt && regular.giftDay !== today) {
    regular.giftDay = today;
    owner.money += REGULARS.giftMoney;
    gift = { money: REGULARS.giftMoney, fame: giftFame(owner, now) };
  }
  markDirty(owner);

  // The daily task goes to whoever made the sale
  refreshDaily(seller, now);
  if (!seller.daily.tasks.some((t) => t.id === 'regular')) {
    const def = DAILY_TASKS.find((t) => t.id === 'regular');
    if (def) seller.daily.tasks.push({ id: def.id, progress: 0, target: def.target, done: false });
  }
  const xp = progressTask(seller, 'regular', 1, now);
  markDirty(seller);

  return { regular, tier: tierOf(regular.loyalty), loyalty: regular.loyalty, gained, bonusPct, xp, gift };
}

// Close and core regulars sometimes want a second portion in the same visit (the caller allows it once per visit)
export function rollSecondPortion(regular: Regular, random: () => number = Math.random) {
  const tier = tierOf(regular.loyalty);
  return (tier === 'close' || tier === 'core') && random() < REGULARS.secondPortionChance;
}

// ---------- Messages ----------

// Payload of the `regulars` request (the room street's regulars)
export function regularsView(owner: Profile, district: number, now = Date.now()) {
  return {
    regulars: regularsOn(owner, district).map((r) => ({
      id: r.id, name: r.name, nickname: r.nickname, group: r.group, favourite: r.favourite, loyalty: r.loyalty,
      tier: tierOf(r.loyalty), tierName: TIER_NAMES[tierOf(r.loyalty)], bonusPct: tierBonusPct(r.loyalty),
    })),
    openSlots: openRegularSlots(owner, district, now),
    totalSlots: regularSlots(owner, district, now),
  };
}

// Payload of the `regularSale` message pushed to the seller
export const regularSaleView = (r: RegularSaleResult) => ({
  regularId: r.regular.id, name: r.regular.name, tier: r.tier, tierName: TIER_NAMES[r.tier], loyalty: r.loyalty,
  bonusPct: r.bonusPct, gained: r.gained, gift: !!r.gift,
});

// Player profiles: money, level, employees, wardrobe, activity log. Stored in SQLite (node:sqlite, built into Node 22+).
// Profiles are kept in memory and written to disk after changes (batched every 2 seconds).
import { DatabaseSync } from 'node:sqlite';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  BALANCE, LOOK_OPTIONS, NPC_STREETS, SURNAMES, GIVEN_NAMES, TRAITS, WEARABLES, getWearable, hireCost, xpToLevelUp,
  type BuildingType, type Trait, type WearSlot,
} from './data.js';
import type { MarketState } from './market.js';
import { emptyFortuneDay, type FortuneDay, type FortuneState } from './fortune.js';

export type Outfit = Partial<Record<WearSlot, string>>;

export interface Employee {
  id: string;
  name: string;
  charm: number;    // attracts customers
  skill: number;    // sells faster
  strength: number; // carries more stock
  trait: Trait;
  look: string;     // same format as Player.look
  outfit: Outfit;
}

export interface LogEntry {
  at: number;
  type: 'co_selling' | 'sidewalk_fee' | 'visit' | 'help';
  who: string;
  amount: number;
}

export interface Appearance {
  gender: 'male' | 'female';
  hair: number;
  brows: number;
  lips: number;
  cheeks: number;
  earrings: number;
}

// One build lot: it holds a crop, a building, or nothing. readyAt means ripe or finished.
export interface Land {
  crop: string;
  plantedAt: number;
  readyAt: number;
  watered: boolean;
  building: BuildingType | '';
  level: number;
  collectedAt: number;
  fameAwarded?: boolean;
  recipe: string;       // what a kitchen is cooking
  cookReadyAt: number;
}

export interface District {
  lots: Land[];
}

export interface DeliveryOrder {
  id: string;
  kind: string;
  item: string;
  quantity: number;
  reward: number;
  expiresAt: number;
}

export interface DailyTask {
  id: string;
  progress: number;
  target: number;
  done: boolean;
}

export interface Profile {
  id: string;
  name: string;
  money: number;
  level: number;
  xp: number;
  stamina: number;
  appearance: Appearance | null; // null until the character is created
  districts: District[];
  store: Record<string, number>; // shared by all districts
  freeSeeds: number;         // plots of the first crop, free and fast
  tutorial: number;          // see advanceTutorial
  tutorialPaced: boolean;    // false on saves from when step 5 meant the tutorial was finished
  gardenerId: string;        // employee looking after the garden
  lastWageDay: number;
  daily: { day: number; tasks: DailyTask[] };
  friends: string[];
  fame: number;              // this season's points; cannot be spent
  fameDay: { day: number; visitors: string[]; helpers: string[]; gifters: string[]; professionHelpers: string[]; salesFame: number; salesCarry: number };
  titles: string[];
  decorations: string[];
  recoveryCode: string;
  banned: boolean;
  isNpc: boolean;
  lastTidyDay: number;
  profession: { id: string; rank: number; work: number; season: number } | null;
  neighbours: Record<string, { points: number; quests: number; progress: number; giftDay: number }>;
  vehicle: string;
  vehicles: string[];
  orders: DeliveryOrder[];
  ordersAt: number;
  deliveries: { reward: number; doneAt: number }[];
  orderDay: { day: number; count: number };
  activityDay: { day: number; shuttle: number; caro: number };
  cafeDay: { day: number; sessions: number; visitors: string[] }; // café payouts and fame already given today (as the owner)
  wedding: { endsAt: number; progress: number; givers: string[] };
  lastWeddingAt: number;
  fortune: FortuneState | null;  // today's fortune (xem bói), see fortune.ts
  fortuneDay: FortuneDay;        // daily counters for sharing fortunes and emotes
  communityClaims: Record<string, number>;  // community event id → reward steps already paid
  communityGiven: Record<string, number>;   // community event id → bunches given
  market: MarketState;       // wholesale credit debt and shared order limits
  outfit: Outfit;
  wardrobe: string[];        // ids of owned wearables not being worn
  employees: Employee[];
  candidates: Employee[];    // job applicants, refreshed after each hire
  log: LogEntry[];
  totalSales: number;
  createdAt: number;
}

const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'game.db'));
export const gameDb = db; // for modules that keep their own shared tables (market.ts)
db.exec(`CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY, device_id TEXT UNIQUE, name TEXT, level INTEGER, data TEXT, updated_at INTEGER
)`);
const qGet = db.prepare('SELECT data FROM players WHERE id = ?');
const qByDevice = db.prepare('SELECT id FROM players WHERE device_id = ?');
const qSave = db.prepare(`INSERT INTO players (id, device_id, name, level, data, updated_at) VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET name = excluded.name, level = excluded.level, data = excluded.data, updated_at = excluded.updated_at`);
const qRandom = db.prepare('SELECT id, name, level FROM players WHERE id != ? ORDER BY RANDOM() LIMIT ?');
const qAll = db.prepare('SELECT id FROM players');
const qMoveDevice = db.prepare('UPDATE players SET device_id = ? WHERE id = ?');
const qClearDevice = db.prepare('UPDATE players SET device_id = NULL WHERE device_id = ?');
db.exec(`CREATE TABLE IF NOT EXISTS linked_accounts (provider TEXT, provider_user_id TEXT, player_id TEXT, PRIMARY KEY (provider, provider_user_id))`);
db.exec(`CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter TEXT, target TEXT, reason TEXT, at INTEGER)`);
db.exec(`CREATE TABLE IF NOT EXISTS analytics (player TEXT, type TEXT, value REAL, at INTEGER)`);
db.exec('CREATE INDEX IF NOT EXISTS analytics_type ON analytics (type, at)');
db.exec(`CREATE TABLE IF NOT EXISTS player_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, buyer TEXT, buyer_name TEXT, item TEXT, quantity INTEGER, price INTEGER, at INTEGER)`);
db.exec('CREATE TABLE IF NOT EXISTS votes (week INTEGER, player TEXT, choice TEXT, PRIMARY KEY (week, player))');
const qOrderAdd = db.prepare('INSERT INTO player_orders (buyer, buyer_name, item, quantity, price, at) VALUES (?, ?, ?, ?, ?, ?)');
const qOrderList = db.prepare('SELECT * FROM player_orders ORDER BY id DESC LIMIT 50');
const qOrderGet = db.prepare('SELECT * FROM player_orders WHERE id = ?');
const qOrderDelete = db.prepare('DELETE FROM player_orders WHERE id = ?');
const qOrderExpired = db.prepare('SELECT * FROM player_orders WHERE at < ?');
const qVote = db.prepare('INSERT OR REPLACE INTO votes (week, player, choice) VALUES (?, ?, ?)');
const qVoteWinner = db.prepare('SELECT choice, COUNT(*) AS count FROM votes WHERE week = ? GROUP BY choice ORDER BY count DESC LIMIT 1');
db.exec('CREATE TABLE IF NOT EXISTS community (event_id TEXT PRIMARY KEY, progress INTEGER)');
const qCommunity = db.prepare('SELECT progress FROM community WHERE event_id = ?');
const qCommunityAdd = db.prepare('INSERT INTO community (event_id, progress) VALUES (?, ?) ON CONFLICT(event_id) DO UPDATE SET progress = progress + excluded.progress');
const qLinked = db.prepare('SELECT player_id FROM linked_accounts WHERE provider = ? AND provider_user_id = ?');
const qLink = db.prepare('INSERT OR REPLACE INTO linked_accounts (provider, provider_user_id, player_id) VALUES (?, ?, ?)');
const qReport = db.prepare('INSERT INTO reports (reporter, target, reason, at) VALUES (?, ?, ?, ?)');
const qReports = db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 100');
const qTrack = db.prepare('INSERT INTO analytics (player, type, value, at) VALUES (?, ?, ?, ?)');
const qCount = db.prepare('SELECT type, COUNT(*) AS count, COUNT(DISTINCT player) AS players FROM analytics WHERE at >= ? GROUP BY type');
const qFirstSeen = db.prepare("SELECT player, MIN(at) AS first FROM analytics WHERE type = 'session' GROUP BY player");
const qSessionsOf = db.prepare("SELECT at FROM analytics WHERE type = 'session' AND player = ?");

// Key for signing login tokens; generated once and kept in the data directory.
const KEY_PATH = path.join(DATA_DIR, 'token-secret.txt');
const SECRET = process.env.TOKEN_SECRET || (existsSync(KEY_PATH)
  ? readFileSync(KEY_PATH, 'utf8').trim()
  : (() => { const k = randomBytes(32).toString('hex'); writeFileSync(KEY_PATH, k); return k; })());

export const signToken = (id: string) => `${id}.${createHmac('sha256', SECRET).update(id).digest('base64url')}`;
export function verifyToken(token: unknown): string | null {
  if (typeof token !== 'string') return null;
  const id = token.slice(0, token.lastIndexOf('.'));
  return id && signToken(id) === token ? id : null;
}

const cache = new Map<string, Profile>();
const newDevices = new Map<string, string>(); // id → device id (only used when inserting a new row)
let flushTimer: NodeJS.Timeout | null = null;

const randInt = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function randomLook() {
  const part = (n: number) => randInt(0, n - 1);
  return [pick(['male', 'female']), part(LOOK_OPTIONS.hair), part(LOOK_OPTIONS.brows), part(LOOK_OPTIONS.lips), part(LOOK_OPTIONS.cheeks), part(LOOK_OPTIONS.earrings)].join(',');
}

export function createCandidate(level: number): Employee {
  const cap = 20 + level * 6;
  return {
    id: randomUUID().slice(0, 8),
    name: `${pick(SURNAMES)} ${pick(GIVEN_NAMES)}`,
    charm: randInt(5, cap), skill: randInt(5, cap), strength: randInt(5, cap),
    trait: pick([...TRAITS]),
    look: randomLook(),
    outfit: {},
  };
}

const newRecoveryCode = () => randomBytes(5).toString('hex').toUpperCase();

function worldDefaults() {
  return {
    districts: [{ lots: Array.from({ length: BALANCE.lotsPerDistrict }, emptyLand) }] as District[],
    store: {} as Record<string, number>,
    profession: null as Profile['profession'], neighbours: {} as Profile['neighbours'],
    vehicle: 'walk', vehicles: [] as string[], orders: [] as DeliveryOrder[], ordersAt: 0, deliveries: [] as Profile['deliveries'],
    orderDay: { day: 0, count: 0 }, activityDay: { day: 0, shuttle: 0, caro: 0 },
    cafeDay: { day: 0, sessions: 0, visitors: [] as string[] },
    wedding: { endsAt: 0, progress: 0, givers: [] as string[] }, lastWeddingAt: 0,
    gardenerId: '', lastWageDay: 0, daily: { day: 0, tasks: [] as DailyTask[] },
    friends: [] as string[], fame: 0, fameDay: { day: 0, visitors: [] as string[], helpers: [] as string[], gifters: [] as string[], professionHelpers: [] as string[], salesFame: 0, salesCarry: 0 },
    titles: [] as string[], decorations: [] as string[], recoveryCode: newRecoveryCode(), banned: false, isNpc: false, lastTidyDay: 0,
    communityClaims: {} as Record<string, number>, communityGiven: {} as Record<string, number>,
    fortune: null as FortuneState | null, fortuneDay: emptyFortuneDay(),
    market: { debt: 0, borrowedAt: 0, creditLockedUntil: 0, sharedDay: 0, sharedGiven: 0 } as MarketState,
  };
}

export const emptyLand = (): Land => ({
  crop: '', plantedAt: 0, readyAt: 0, watered: false, building: '', level: 0, collectedAt: 0, recipe: '', cookReadyAt: 0,
});

export const TUTORIAL_DONE = 10;

// Profiles saved before districts existed keep their money, level and bananas, and their first four buildings
function migrate(profile: Profile): Profile {
  const old = profile as Profile & { bananas?: number; lots?: ({ type: BuildingType; level: number; readyAt: number; collectedAt: number } | null)[] };
  const needsLand = !profile.districts;
  profile.appearance ??= null;
  profile.freeSeeds ??= BALANCE.startingFreeSeeds;
  profile.tutorial ??= 0;
  if (!profile.tutorialPaced) {
    if (profile.tutorial >= 5) profile.tutorial = TUTORIAL_DONE;
    profile.tutorialPaced = true;
  }
  Object.assign(profile, { ...worldDefaults(), ...profile });
  if (needsLand) {
    (old.lots ?? []).filter(Boolean).slice(0, BALANCE.lotsPerDistrict).forEach((lot, i) => {
      Object.assign(profile.districts[0].lots[i], { building: lot!.type, level: lot!.level, readyAt: lot!.readyAt, collectedAt: lot!.collectedAt });
    });
    if (old.bananas) profile.store.banana = old.bananas;
  }
  for (const key of ['plots', 'lots', 'bananas', 'houseLevel']) delete (profile as unknown as Record<string, unknown>)[key];
  profile.fameDay.professionHelpers ??= [];
  for (const e of [...profile.employees, ...profile.candidates]) { e.trait ??= pick([...TRAITS]); e.look ??= randomLook(); }
  return profile;
}

export function getProfile(id: string): Profile | null {
  const cached = cache.get(id);
  if (cached) return cached;
  const row = qGet.get(id) as { data: string } | undefined;
  if (!row) return null;
  const profile = migrate(JSON.parse(row.data) as Profile);
  cache.set(id, profile);
  return profile;
}

export function login(deviceId: string, name: string): Profile {
  const row = qByDevice.get(deviceId) as { id: string } | undefined;
  if (row) {
    const profile = getProfile(row.id)!;
    if (name && name !== profile.name) { profile.name = name; markDirty(profile); }
    return profile;
  }
  const profile: Profile = {
    id: randomUUID(),
    name: name || `Hàng rong ${randInt(1000, 9999)}`,
    money: BALANCE.startingMoney,
    level: 1, xp: 0, stamina: BALANCE.maxStamina,
    appearance: null,
    freeSeeds: BALANCE.startingFreeSeeds,
    tutorial: 0,
    tutorialPaced: true,
    ...worldDefaults(),
    outfit: {},
    wardrobe: [],
    employees: [],
    candidates: [createCandidate(1), createCandidate(1), createCandidate(1)],
    log: [], totalSales: 0, createdAt: Date.now(),
  };
  cache.set(profile.id, profile);
  newDevices.set(profile.id, deviceId);
  markDirty(profile);
  return profile;
}

const dirty = new Set<string>();
export function markDirty(profile: Profile) {
  dirty.add(profile.id);
  if (!flushTimer) flushTimer = setTimeout(flushNow, 2000);
}

export function flushNow() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  for (const id of dirty) {
    const p = cache.get(id);
    if (!p) continue;
    qSave.run(p.id, newDevices.get(id) ?? null, p.name, p.level, JSON.stringify(p), Date.now());
    newDevices.delete(id);
  }
  dirty.clear();
}

export function allProfiles() {
  return (qAll.all() as { id: string }[]).map((r) => getProfile(r.id)!).filter(Boolean);
}

// Built-in streets give new players somewhere to visit before the game has many players
export function ensureNpcStreets() {
  for (const street of NPC_STREETS) {
    if (getProfile(street.id)) continue;
    const profile: Profile = {
      id: street.id, name: street.name, money: 0, level: 5, xp: 0, stamina: 0, appearance: null,
      freeSeeds: 0, tutorial: TUTORIAL_DONE, tutorialPaced: true, ...worldDefaults(), isNpc: true, outfit: {}, wardrobe: [],
      employees: [], candidates: [], log: [], totalSales: 0, createdAt: Date.now(),
    };
    cache.set(profile.id, profile);
    markDirty(profile);
  }
  flushNow();
}

export function npcStreetList() {
  return NPC_STREETS.map((s) => ({ ownerId: s.id, ownerName: s.name, ownerLevel: 5, district: 0, playerCount: 0, stallCount: 3, isOpen: false }));
}

// A recovery code moves an account to a new device, so changing phones never loses progress
export function recoverAccount(code: string, deviceId: string): Profile | null {
  const wanted = code.trim().toUpperCase();
  const profile = allProfiles().find((p) => !p.isNpc && p.recoveryCode === wanted);
  if (!profile) return null;
  flushNow();
  qClearDevice.run(deviceId);
  qMoveDevice.run(deviceId, profile.id);
  return profile;
}

export const linkedPlayer = (provider: string, userId: string) =>
  (qLinked.get(provider, userId) as { player_id: string } | undefined)?.player_id ?? null;
export const linkAccount = (provider: string, userId: string, playerId: string) => { qLink.run(provider, userId, playerId); };

export const communityProgress = (eventId: string) => (qCommunity.get(eventId) as { progress: number } | undefined)?.progress ?? 0;
export const addCommunityProgress = (eventId: string, amount: number) => { qCommunityAdd.run(eventId, amount); };

export interface PlayerOrder { id: number; buyer: string; buyer_name: string; item: string; quantity: number; price: number; at: number }

export const castVote = (week: number, player: string, choice: string) => { qVote.run(week, player, choice); };
export const voteWinner = (week: number) => (qVoteWinner.get(week) as { choice: string } | undefined)?.choice ?? null;

// Money for an open order is held until someone delivers it or it expires
export function postPlayerOrder(buyer: Profile, item: string, quantity: number, price: number, retail: number, now = Date.now()) {
  const day = Math.floor(now / 86_400_000);
  if (buyer.orderDay.day !== day) buyer.orderDay = { day, count: 0 };
  if (buyer.orderDay.count >= BALANCE.playerOrdersPerDay) throw new GameError('Hôm nay bạn đã đăng đủ đơn rồi');
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new GameError('Số lượng không hợp lệ');
  if (!Number.isInteger(price) || price < 1 || price > retail * quantity * BALANCE.playerOrderMaxPct / 100) throw new GameError('Giá trả quá cao');
  if (buyer.money < price) throw new GameError('Không đủ tiền');
  buyer.money -= price;
  buyer.orderDay.count++;
  qOrderAdd.run(buyer.id, buyer.name, item, quantity, price, now);
}

export function listPlayerOrders(now = Date.now()) {
  for (const order of qOrderExpired.all(now - BALANCE.playerOrderHours * 3_600_000) as unknown as PlayerOrder[]) {
    const buyer = getProfile(order.buyer);
    if (buyer) { buyer.money += order.price; markDirty(buyer); }
    qOrderDelete.run(order.id);
  }
  return qOrderList.all() as unknown as PlayerOrder[];
}

// Takes the order off the board; the caller moves the goods and pays the seller
export function claimPlayerOrder(id: number, sellerId: string) {
  const order = qOrderGet.get(id) as unknown as PlayerOrder | undefined;
  if (!order) throw new GameError('Đơn này không còn nữa');
  if (order.buyer === sellerId) throw new GameError('Đây là đơn của bạn');
  qOrderDelete.run(id);
  return order;
}

export const addReport = (reporter: string, target: string, reason: string) => { qReport.run(reporter, target, reason, Date.now()); };
export const listReports = () => qReports.all();

export const track = (player: string, type: string, value = 0) => { qTrack.run(player, type, value, Date.now()); };

// Share of players seen again N days after their first session, plus event counts for the last week
export function analyticsSummary(now = Date.now()) {
  const DAY = 86_400_000;
  const players = qFirstSeen.all() as { player: string; first: number }[];
  const returned = (days: number) => {
    const eligible = players.filter((p) => now - p.first >= days * DAY);
    const back = eligible.filter((p) => (qSessionsOf.all(p.player) as { at: number }[]).some((s) => s.at >= p.first + days * DAY && s.at < p.first + (days + 1) * DAY));
    return { eligible: eligible.length, returned: back.length };
  };
  return { players: players.length, day1: returned(1), day7: returned(7), lastWeek: qCount.all(now - 7 * DAY) };
}

export function randomStreets(excludeId: string, count: number) {
  return qRandom.all(excludeId, count) as { id: string; name: string; level: number }[];
}

// ---------- Profile rules ----------

// Total bonus from what someone (player or employee) is wearing
export function outfitBonus(outfit: Outfit) {
  let moneyPct = 0, xpPct = 0, charm = 0;
  for (const id of Object.values(outfit)) {
    const w = id && getWearable(id);
    if (!w) continue;
    moneyPct += w.moneyPct; xpPct += w.xpPct; charm += w.charm;
  }
  return { moneyPct, xpPct, charm };
}

// Add XP, return how many levels were gained
export function addXp(profile: Profile, xp: number): number {
  profile.xp += xp;
  let gained = 0;
  while (profile.xp >= xpToLevelUp(profile.level)) {
    profile.xp -= xpToLevelUp(profile.level);
    profile.level++; gained++;
  }
  return gained;
}

export function addLogEntry(profile: Profile, entry: Omit<LogEntry, 'at'>) {
  // Merge consecutive entries of the same kind from the same person to keep the log short
  const first = profile.log[0];
  if (first && first.type === entry.type && first.who === entry.who && Date.now() - first.at < 10 * 60_000) {
    first.amount += entry.amount; first.at = Date.now();
  } else {
    profile.log.unshift({ ...entry, at: Date.now() });
    profile.log.length = Math.min(profile.log.length, BALANCE.maxLogEntries);
  }
}

// Rule violation; the message is shown to the player, so it stays Vietnamese.
export class GameError extends Error {}

// Steps: 0 plant, 1 water, 2 harvest, 3 open a stall, 4 first sale, 5 plant a second crop, 6 build a tea shop,
// 7 water on another street, 8 harvest, 9 plant a long crop, 10 done
export function advanceTutorial(profile: Profile, step: number) {
  profile.tutorial = Math.max(profile.tutorial, step);
  // Players may do a step early, so a step that is already satisfied never waits for its action
  const lots = profile.districts.flatMap((d) => d.lots);
  if (profile.tutorial === 5 && lots.some((l) => l.crop)) profile.tutorial = 6;
  if (profile.tutorial === 6 && lots.some((l) => l.building === 'tea_shop')) profile.tutorial = 7;
  if (profile.tutorial === 8 && !lots.some((l) => l.crop)) profile.tutorial = 9;
}

// The barber changes a finished character's look
export function changeLook(profile: Profile, m: Partial<Appearance>) {
  const old = profile.appearance;
  profile.appearance = null;
  try { createCharacter(profile, m); }
  catch (e) { profile.appearance = old; throw e; }
}

export function createCharacter(profile: Profile, m: Partial<Appearance>) {
  if (profile.appearance) throw new GameError('Bạn đã tạo nhân vật rồi');
  if (m.gender !== 'male' && m.gender !== 'female') throw new GameError('Chọn nam hoặc nữ');
  const part = (value: unknown, count: number) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n >= count) throw new GameError('Lựa chọn không hợp lệ');
    return n;
  };
  profile.appearance = {
    gender: m.gender,
    hair: part(m.hair, LOOK_OPTIONS.hair),
    brows: part(m.brows, LOOK_OPTIONS.brows),
    lips: part(m.lips, LOOK_OPTIONS.lips),
    cheeks: part(m.cheeks, LOOK_OPTIONS.cheeks),
    earrings: part(m.earrings, LOOK_OPTIONS.earrings),
  };
}

export function buyWearable(profile: Profile, wearableId: string) {
  const w = getWearable(wearableId);
  if (!w) throw new GameError('Không có món đồ này');
  if (profile.level < w.unlockLevel) throw new GameError(`Cần cấp ${w.unlockLevel}`);
  if (profile.money < w.price) throw new GameError('Không đủ tiền');
  profile.money -= w.price;
  profile.wardrobe.push(w.id);
}

function wearer(profile: Profile, employeeId?: string) {
  const who = employeeId ? profile.employees.find((e) => e.id === employeeId) : profile;
  if (!who) throw new GameError('Không có nhân viên này');
  return who;
}

// Put on a wearable for yourself (no employeeId) or for an employee. Whatever was in that slot goes back to the wardrobe.
export function wear(profile: Profile, wearableId: string, employeeId?: string) {
  const i = profile.wardrobe.indexOf(wearableId);
  const w = getWearable(wearableId);
  if (i < 0 || !w) throw new GameError('Tủ đồ không có món này');
  const who = wearer(profile, employeeId);
  profile.wardrobe.splice(i, 1);
  const old = who.outfit[w.slot];
  if (old) profile.wardrobe.push(old);
  who.outfit[w.slot] = w.id;
}

export function takeOff(profile: Profile, slot: WearSlot, employeeId?: string) {
  const who = wearer(profile, employeeId);
  const old = who.outfit[slot];
  if (!old) return;
  delete who.outfit[slot];
  profile.wardrobe.push(old);
}

export function hireEmployee(profile: Profile, candidateId: string, maxCount: number) {
  const c = profile.candidates.find((x) => x.id === candidateId);
  if (!c) throw new GameError('Người này không còn xin việc');
  if (profile.employees.length >= maxCount) throw new GameError(`Cấp ${profile.level} chỉ thuê được ${maxCount} người`);
  const cost = hireCost(c.charm, c.skill, c.strength);
  if (profile.money < cost) throw new GameError('Không đủ tiền thuê');
  profile.money -= cost;
  profile.employees.push(c);
  profile.candidates = profile.candidates.filter((x) => x !== c);
  profile.candidates.push(createCandidate(profile.level));
}

export function fireEmployee(profile: Profile, employeeId: string) {
  const i = profile.employees.findIndex((e) => e.id === employeeId);
  if (i < 0) throw new GameError('Không có nhân viên này');
  const [e] = profile.employees.splice(i, 1);
  if (profile.gardenerId === e.id) profile.gardenerId = '';
  for (const id of Object.values(e.outfit)) if (id) profile.wardrobe.push(id);
}

// Data sent only to the profile's owner
export function privateProfile(profile: Profile, maxEmployees: number, storeCapacity: number) {
  const { fameDay: _fameDay, banned: _banned, isNpc: _isNpc, lastWageDay: _wage, lastTidyDay: _tidy, communityClaims: _claims, communityGiven: _given, orderDay: _orderDay, activityDay: _activityDay, cafeDay: _cafeDay, wedding: _wedding, ...visible } = profile;
  return {
    ...visible,
    xpToLevelUp: xpToLevelUp(profile.level),
    maxEmployees,
    storeCapacity,
    serverTime: Date.now(),
    candidates: profile.candidates.map((c) => ({ ...c, hireCost: hireCost(c.charm, c.skill, c.strength) })),
  };
}

export const allWearables = () => WEARABLES;

// Events are data: a definition says when one runs and which rules it changes. server/data/events.json can add
// dated events without an app update. Events only ever add opportunities; none of them costs an absent player anything.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export interface EventRules {
  spawnFactor?: number;    // customer spawn rate multiplier
  boost?: string[];        // products customers ask for more often
  sidewalkFeePct?: number; // replaces the normal fee while active
  autoWater?: boolean;     // rain waters every plot on the street
  tourists?: boolean;      // a group of high-paying customers visits
  order?: { quantity: number; reward: number }; // sell this many within the event for a bonus
  products?: string[];     // seasonal products on sale
  decorations?: string[];  // decorations on sale
  gift?: string;           // player-facing label of the event's gift action
  community?: { target: number; steps: number; rewardPerStep: number }; // bananas everyone gives together
}

export interface GameEvent {
  id: string;
  name: string;            // player-facing
  rules: EventRules;
  seconds?: number;        // length of a random street event
  minFame?: number;        // street needs this much fame to get it
  weekday?: number;        // weekly: 0 = Sunday
  hours?: [number, number];// weekly: local start and end hour
  from?: string;           // dated: ISO start
  to?: string;             // dated: ISO end
}

// Random events picked per street. Rain and hot sun are weather now (see weather.ts).
export const STREET_EVENTS: GameEvent[] = [
  { id: 'rush_hour', name: 'Giờ tan tầm', seconds: 300, rules: { spawnFactor: 1.5 } },
  { id: 'tourist_group', name: 'Đoàn du khách', seconds: 180, minFame: 100, rules: { tourists: true } },
  { id: 'shipper_order', name: 'Đơn hàng của anh shipper', seconds: 900, rules: { order: { quantity: 15, reward: 150000 } } },
];

// Only reachable through the neighbourhood meeting vote (MEETING_CHOICES)
const VOTE_ONLY_EVENTS: GameEvent[] = [
  { id: 'hot_sun', name: 'Trà đá bán chạy', rules: { boost: ['iced_tea', 'popsicle'] } },
];

// Scheduled for every street. Hours use Vietnam time.
const SCHEDULED_EVENTS: GameEvent[] = [
  { id: 'night_market', name: 'Chợ đêm cuối tuần', weekday: 6, hours: [18, 23], rules: { sidewalkFeePct: 5, spawnFactor: 1.3 } },
  { id: 'green_sunday', name: 'Chủ nhật xanh', weekday: 0, hours: [6, 11], rules: {} },
];

// Lunar dates change every year, so each year's dates are listed; server/data/events.json can add more
const SEASONAL_EVENTS: GameEvent[] = [
  { id: 'christmas', name: 'Giáng sinh', from: '2026-12-20T00:00:00+07:00', to: '2026-12-27T00:00:00+07:00', rules: { decorations: ['xmas_tree'], gift: 'Trao quà', spawnFactor: 1.1 } },
  { id: 'tet', name: 'Tết Nguyên đán', from: '2027-01-30T00:00:00+07:00', to: '2027-02-12T00:00:00+07:00', rules: { products: ['banh_chung'], decorations: ['peach_tree'], gift: 'Lì xì hàng xóm', spawnFactor: 1.2 } },
  { id: 'valentine', name: 'Lễ tình nhân', from: '2027-02-12T00:00:00+07:00', to: '2027-02-15T00:00:00+07:00', rules: { boost: ['flowers'], decorations: ['flower_basket'], gift: 'Tặng hoa' } },
  { id: 'womens_day', name: 'Ngày 8/3', from: '2027-03-06T00:00:00+07:00', to: '2027-03-09T00:00:00+07:00', rules: { boost: ['flowers'], decorations: ['flower_basket'], gift: 'Tặng hoa' } },
  { id: 'banana_festival', name: 'Lễ hội chuối', from: '2027-05-10T00:00:00+07:00', to: '2027-05-17T00:00:00+07:00', rules: { boost: ['banana'], community: { target: 1000000, steps: 4, rewardPerStep: 50000 } } },
  { id: 'summer', name: 'Hội chợ hè', from: '2027-06-01T00:00:00+07:00', to: '2027-07-01T00:00:00+07:00', rules: { products: ['sugarcane_juice'], boost: ['popsicle'], decorations: ['summer_fair'], gift: 'Góp vui hội chợ' } },
  { id: 'mid_autumn', name: 'Trung thu', from: '2027-09-08T00:00:00+07:00', to: '2027-09-16T00:00:00+07:00', rules: { products: ['moon_cake'], decorations: ['star_lantern'], gift: 'Rước đèn' } },
  { id: 'vn_womens_day', name: 'Ngày 20/10', from: '2027-10-18T00:00:00+07:00', to: '2027-10-21T00:00:00+07:00', rules: { boost: ['flowers'], decorations: ['flower_basket'], gift: 'Tặng hoa' } },
  { id: 'christmas_2027', name: 'Giáng sinh', from: '2027-12-20T00:00:00+07:00', to: '2027-12-27T00:00:00+07:00', rules: { decorations: ['xmas_tree'], gift: 'Trao quà', spawnFactor: 1.1 } },
];

const VIETNAM_OFFSET = 7 * 3_600_000;
const DATA_FILE = path.join(process.env.DATA_DIR || path.resolve('data'), 'events.json');

function datedEvents(): GameEvent[] {
  if (!existsSync(DATA_FILE)) return [];
  try { return JSON.parse(readFileSync(DATA_FILE, 'utf8')) as GameEvent[]; }
  catch { console.error('events.json is not valid JSON'); return []; }
}

let manual: GameEvent | null = null;
let manualUntil = 0;

// Admin tool: run an event on every street for a while (for example a football night)
export function startManualEvent(event: GameEvent, seconds: number, now = Date.now()) {
  manual = event;
  manualUntil = now + seconds * 1000;
}

// Set by the server start-up: the event the neighbourhood meeting voted for last Sunday
export const meeting = { winner: (_week: number): string | null => null };
export const weekIndex = (now = Date.now()) => Math.floor((now + VIETNAM_OFFSET + 3 * 86_400_000) / (7 * 86_400_000));
export const meetingOpen = (now = Date.now()) => {
  const local = new Date(now + VIETNAM_OFFSET);
  return local.getUTCDay() === 0 && local.getUTCHours() >= 18 && local.getUTCHours() < 23;
};

export function scheduledEvent(now = Date.now()): GameEvent | null {
  if (manual && now < manualUntil) return manual;
  const local = new Date(now + VIETNAM_OFFSET);
  if (local.getUTCDay() === 5 && local.getUTCHours() >= 18 && local.getUTCHours() < 22) {
    const voted = [...STREET_EVENTS, ...VOTE_ONLY_EVENTS].find((e) => e.id === meeting.winner(weekIndex(now) - 1));
    if (voted) return voted;
  }
  const weekly = SCHEDULED_EVENTS.find((e) => e.weekday === local.getUTCDay() && local.getUTCHours() >= e.hours![0] && local.getUTCHours() < e.hours![1]);
  return weekly ?? null;
}

export function seasonalEvent(now = Date.now()): GameEvent | null {
  return [...datedEvents(), ...SEASONAL_EVENTS].find((e) => e.from && e.to && now >= Date.parse(e.from) && now < Date.parse(e.to)) ?? null;
}

// Several events can overlap, for example the night market during Tet
export function mergeRules(events: (GameEvent | null)[]): EventRules {
  const merged: EventRules = {};
  for (const e of events) {
    if (!e) continue;
    const r = e.rules;
    if (r.spawnFactor) merged.spawnFactor = (merged.spawnFactor ?? 1) * r.spawnFactor;
    if (r.sidewalkFeePct !== undefined) merged.sidewalkFeePct = Math.min(merged.sidewalkFeePct ?? 100, r.sidewalkFeePct);
    for (const key of ['boost', 'products', 'decorations'] as const) if (r[key]) merged[key] = [...(merged[key] ?? []), ...r[key]!];
    for (const key of ['autoWater', 'tourists', 'order', 'gift', 'community'] as const) if (r[key] !== undefined) (merged as any)[key] = r[key];
  }
  return merged;
}

export function pickStreetEvent(fame: number, random = Math.random): GameEvent {
  const possible = STREET_EVENTS.filter((e) => fame >= (e.minFame ?? 0));
  return possible[Math.floor(random() * possible.length)];
}

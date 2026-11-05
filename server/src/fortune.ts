// Daily fortune (xem bói) and friend emotes. Every fortune is positive and free, so this is not gacha:
// the fortune is fixed by the day and the player id, and only the kind of small benefit differs.
// Every function takes `now` so tests can run on a fake clock.
import { createHash } from 'node:crypto';
import { BALANCE } from './data.js';
import { GameError, type Profile } from './profile.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const dayOf = (now: number) => Math.floor(now / DAY);

// All numbers are provisional.
export const FORTUNE_RULES = {
  busyPct: 10,            // extra foot traffic on your own street
  wisePct: 10,            // extra XP
  helpfulPct: 50,         // extra reward when you help a friend's street
  luckyMoney: 5000,       // flat bonus of the lucky fortune
  buffMs: HOUR,           // how long the busy and wise fortunes last
  shareFactor: 0.5,       // a shared fortune has half the strength
  emotesPerDay: 20,
  emoteCooldownMs: 10_000, // between two emotes to the same target
};

export interface FortuneDef { id: string; name: string; line: string }

// Player-facing text stays Vietnamese
export const FORTUNES: FortuneDef[] = [
  { id: 'busy', name: 'Khách đông như hội', line: 'Quẻ báo hôm nay khách kéo về phố bạn đông hơn mọi ngày. Dọn hàng sớm kẻo lỡ!' },
  { id: 'wise', name: 'Học một biết mười', line: 'Quẻ nói đầu óc bạn sáng như đèn pha, việc gì cũng thông nhanh, học gì cũng vô.' },
  { id: 'helpful', name: 'Tay đưa tay nối', line: 'Hôm nay ai giúp hàng xóm sẽ được cảm ơn gấp rưỡi. Tốt bụng có lộc đấy!' },
  { id: 'lucky', name: 'Số hưởng', line: 'Thầy bói nhìn bạn một hồi rồi phán: "Hôm nay không có gì đặc biệt, nhưng cứ cầm ít tiền đi uống trà đá cho vui."' },
];

export const EMOTES: Record<string, { name: string; text: (from: string) => string }> = {
  cheer: { name: 'Cổ vũ', text: (from) => `${from} gửi bạn lời cổ vũ: cố lên nhé!` },
  comfort: { name: 'An ủi', text: (from) => `${from} gửi bạn lời an ủi: không sao đâu, mai khá hơn!` },
  coffee: { name: 'Mời ly cà phê', text: (from) => `${from} mời bạn một ly cà phê ảo. Cạn ly nào!` },
};

export interface FortuneState {
  day: number;        // day index when it was drawn or received
  id: string;
  startedAt: number;
  half: boolean;      // true when it came from a friend
  paid: number;       // flat money already paid for it (lucky)
}

export interface FortuneDay {
  day: number;
  sent: boolean;      // shared a fortune today
  received: boolean;  // received a shared fortune today
  emotes: number;     // emotes sent today
}

export const emptyFortuneDay = (): FortuneDay => ({ day: 0, sent: false, received: false, emotes: 0 });

const defOf = (id: string) => FORTUNES.find((f) => f.id === id);

// Same day and same player always give the same fortune
export function fortuneFor(playerId: string, now = Date.now()): FortuneDef {
  const hash = createHash('sha256').update(`${dayOf(now)}:${playerId}`).digest();
  return FORTUNES[hash.readUInt32BE(0) % FORTUNES.length];
}

function refreshFortuneDay(profile: Profile, now: number) {
  const today = dayOf(now);
  if (!profile.fortuneDay || profile.fortuneDay.day !== today) profile.fortuneDay = { ...emptyFortuneDay(), day: today };
  return profile.fortuneDay;
}

const strength = (pct: number, half: boolean) => pct * (half ? FORTUNE_RULES.shareFactor : 1);

// The benefit in force right now, or null
export function activeFortune(profile: Profile, now = Date.now()): { id: string; pct: number } | null {
  const f = profile.fortune;
  if (!f) return null;
  const timed = now >= f.startedAt && now < f.startedAt + FORTUNE_RULES.buffMs;
  if (f.id === 'busy' && timed) return { id: f.id, pct: strength(FORTUNE_RULES.busyPct, f.half) };
  if (f.id === 'wise' && timed) return { id: f.id, pct: strength(FORTUNE_RULES.wisePct, f.half) };
  if (f.id === 'helpful' && dayOf(now) === f.day) return { id: f.id, pct: strength(FORTUNE_RULES.helpfulPct, f.half) };
  return null;
}

export function fortuneTrafficMultiplier(profile: Profile, now = Date.now()) {
  const a = activeFortune(profile, now);
  return a?.id === 'busy' ? 1 + a.pct / 100 : 1;
}

export function fortuneXp(profile: Profile, xp: number, now = Date.now()) {
  const a = activeFortune(profile, now);
  return a?.id === 'wise' ? Math.round(xp * (100 + a.pct) / 100) : xp;
}

// What a helper earns for helping on someone's street; the helpful fortune only boosts helping friends
export function helpRewardFor(helper: Profile, owner: Profile, now = Date.now()) {
  const a = activeFortune(helper, now);
  if (a?.id !== 'helpful' || !helper.friends.includes(owner.id)) return BALANCE.helpReward;
  return Math.round(BALANCE.helpReward * (100 + a.pct) / 100);
}

// Details for the client
export function fortuneView(profile: Profile, now = Date.now()) {
  const f = profile.fortune;
  const def = f && defOf(f.id);
  if (!f || !def) return null;
  const timedKind = f.id === 'busy' || f.id === 'wise';
  return {
    id: f.id, name: def.name, line: def.line, half: f.half, startedAt: f.startedAt,
    pct: activeFortune(profile, now)?.pct ?? 0,
    endsAt: timedKind ? f.startedAt + FORTUNE_RULES.buffMs : f.id === 'helpful' ? (f.day + 1) * DAY : 0,
    active: !!activeFortune(profile, now),
  };
}

function setFortune(profile: Profile, id: string, half: boolean, now: number) {
  const old = profile.fortune;
  const paidBefore = old && old.day === dayOf(now) && old.id === 'lucky' && id === 'lucky' ? old.paid : 0;
  const bonus = id === 'lucky' ? strength(FORTUNE_RULES.luckyMoney, half) : 0;
  profile.money += bonus - paidBefore;
  profile.fortune = { day: dayOf(now), id, startedAt: now, half, paid: bonus };
}

// Free, once per day. A fortune received from a friend can still be replaced by your own.
export function drawFortune(profile: Profile, now = Date.now()) {
  const f = profile.fortune;
  if (f && f.day === dayOf(now) && !f.half) throw new GameError('Hôm nay bạn đã xem bói rồi, mai quay lại nhé');
  setFortune(profile, fortuneFor(profile.id, now).id, false, now);
  return fortuneView(profile, now)!;
}

// Gives a friend your fortune at half strength
export function shareFortune(sender: Profile, receiver: Profile | null | undefined, now = Date.now()) {
  if (!receiver || receiver.isNpc) throw new GameError('Không tìm thấy người này');
  if (receiver.id === sender.id) throw new GameError('Không thể tự tặng quẻ cho mình');
  if (!sender.friends.includes(receiver.id)) throw new GameError('Chỉ tặng quẻ cho bạn bè');
  const mine = sender.fortune;
  if (!mine || mine.day !== dayOf(now) || mine.half) throw new GameError('Hãy xem bói cho mình trước đã');
  const sentToday = refreshFortuneDay(sender, now);
  if (sentToday.sent) throw new GameError('Hôm nay bạn đã tặng quẻ rồi');
  const theirs = refreshFortuneDay(receiver, now);
  if (theirs.received) throw new GameError('Bạn này đã nhận quẻ hôm nay rồi');
  const own = receiver.fortune;
  const hasOwnToday = !!own && own.day === dayOf(now) && !own.half;
  if (hasOwnToday && own.id !== mine.id) throw new GameError('Bạn này đã xem bói và ra quẻ khác rồi');
  if (!hasOwnToday) setFortune(receiver, mine.id, true, now);
  sentToday.sent = true;
  theirs.received = true;
}

// Emotes are cosmetic: they only validate and count; the room pushes the notification
const lastEmote = new Map<string, number>(); // "sender>target" → time of the last one

export function checkEmote(sender: Profile, target: Profile | null | undefined, kind: unknown, now = Date.now()) {
  if (typeof kind !== 'string' || !EMOTES[kind]) throw new GameError('Không có cử chỉ này');
  if (!target || target.isNpc) throw new GameError('Không tìm thấy người này');
  if (target.id === sender.id) throw new GameError('Không thể gửi cho chính mình');
  if (!sender.friends.includes(target.id)) throw new GameError('Chỉ gửi cho bạn bè');
  const day = refreshFortuneDay(sender, now);
  if (day.emotes >= FORTUNE_RULES.emotesPerDay) throw new GameError('Hôm nay bạn gửi nhiều rồi, mai gửi tiếp nhé');
  const key = `${sender.id}>${target.id}`;
  const last = lastEmote.get(key);
  if (last !== undefined && now - last < FORTUNE_RULES.emoteCooldownMs) throw new GameError('Gửi chậm thôi, đợi vài giây nhé');
  if (lastEmote.size > 5000) for (const [k, t] of lastEmote) if (now - t >= FORTUNE_RULES.emoteCooldownMs) lastEmote.delete(k);
  lastEmote.set(key, now);
  day.emotes++;
  return { text: EMOTES[kind].text(sender.name) };
}

// Checks the daily fortune, shared fortunes and friend emotes on a fake clock.
//   npx tsx test/fortune.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-fortune-'));
const { BALANCE } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const F = await import('../src/fortune.js');
const { GameError, login, addXp } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const HOUR = 3_600_000, DAY = 24 * HOUR, t0 = 200 * DAY + 8 * HOUR;

const a = login('fortune-device-a', 'An');
const b = login('fortune-device-b', 'Bình');
const c = login('fortune-device-c', 'Cúc');
const stranger = login('fortune-device-s', 'Người lạ');
a.friends = [b.id, c.id];
b.friends = [a.id];

// Old profiles without the fields still work (defaults come from login/migrate)
check(a.fortune === null && a.fortuneDay.emotes === 0, 'A new profile has no fortune and empty counters');

// Determinism
const first = F.fortuneFor(a.id, t0);
check(F.fortuneFor(a.id, t0 + 5 * HOUR).id === first.id, 'The same day and player always give the same fortune');
const days = new Set(Array.from({ length: 40 }, (_, i) => F.fortuneFor(a.id, t0 + i * DAY).id));
check(days.size > 1, 'Different days can give different fortunes');
const kinds = new Set(Array.from({ length: 200 }, (_, i) => F.fortuneFor(`p${i}`, t0).id));
check(kinds.size === F.FORTUNES.length, 'Every fortune kind is reachable');

// Drawing: free, once per day
const moneyBefore = a.money;
const view = F.drawFortune(a, t0);
check(view.id === first.id && a.fortune?.id === first.id && a.fortune.day === Math.floor(t0 / DAY), 'Drawing stores the deterministic fortune');
check(view.name.length > 0 && view.line.length > 0, 'A fortune has a Vietnamese name and line');
check(a.money === moneyBefore + (first.id === 'lucky' ? 5000 : 0), 'Drawing costs nothing; only lucky pays 5,000đ');
refuses(() => F.drawFortune(a, t0 + HOUR), 'đã xem bói', 'Only one draw per day');
F.drawFortune(a, t0 + DAY);
check(a.fortune?.day === Math.floor(t0 / DAY) + 1, 'The next day allows a new draw');

// Effects, each forced onto a fresh profile
const forced = (id: string, at: number, half = false) => {
  const p = login(`forced-${id}-${half}-${at}`, 'Thử');
  p.fortune = { day: Math.floor(at / DAY), id, startedAt: at, half, paid: 0 };
  return p;
};

// busy: +10% traffic for one hour, then it expires
const busy = forced('busy', t0);
const base = W.footTraffic(login('plain', 'Thường'), 0, t0);
check(Math.abs(W.footTraffic(busy, 0, t0) - base * 1.1) < 1e-9, 'Busy adds 10% foot traffic');
check(Math.abs(W.footTraffic(busy, 0, t0 + HOUR - 1) - base * 1.1) < 1e-9, 'Busy lasts the full hour');
check(W.footTraffic(busy, 0, t0 + HOUR) === base, 'Busy expires after one hour');
check(Math.abs(W.footTraffic(forced('busy', t0, true), 0, t0) - base * 1.05) < 1e-9, 'A shared busy gives 5%');

// wise: +10% XP for one hour
const wise = forced('wise', t0);
check(F.fortuneXp(wise, 100, t0) === 110, 'Wise adds 10% XP');
check(F.fortuneXp(wise, 100, t0 + HOUR) === 100, 'Wise expires after one hour');
check(F.fortuneXp(forced('wise', t0, true), 100, t0) === 105, 'A shared wise gives 5%');
check(F.fortuneXp(forced('busy', t0), 100, t0) === 100, 'Other fortunes leave XP alone');
const lvl = login('lvl', 'Lên cấp');
check(addXp(lvl, F.fortuneXp(wise, 10, t0)) === 0 && lvl.xp === 11, 'The boosted XP is what gets added');

// helpful: +50% on help rewards for friends, for the rest of the day only
const helper = forced('helpful', t0);
const friendOwner = login('help-owner-f', 'Bạn chủ phố');
const otherOwner = login('help-owner-o', 'Người khác');
helper.friends = [friendOwner.id];
check(F.helpRewardFor(helper, friendOwner, t0) === BALANCE.helpReward * 1.5, 'Helpful pays +50% for helping a friend');
check(F.helpRewardFor(helper, otherOwner, t0) === BALANCE.helpReward, 'Helpful does not boost helping non-friends');
check(F.helpRewardFor(helper, friendOwner, t0 + 15 * HOUR) === BALANCE.helpReward * 1.5, 'Helpful lasts past one hour, same day');
check(F.helpRewardFor(helper, friendOwner, (Math.floor(t0 / DAY) + 1) * DAY) === BALANCE.helpReward, 'Helpful ends with the day');
check(F.helpRewardFor(forced('helpful', t0, true), friendOwner, t0) === BALANCE.helpReward, 'A shared helpful needs friendship too');
{
  const hp = forced('helpful', t0, true); hp.friends = [friendOwner.id];
  check(F.helpRewardFor(hp, friendOwner, t0) === Math.round(BALANCE.helpReward * 1.25), 'A shared helpful gives 25%');
}

// The helpWater hook pays the helper more, never the owner
{
  const owner = login('water-owner', 'Chủ vườn');
  const h = forced('helpful', t0); h.friends = [owner.id]; h.stamina = 5;
  owner.districts[0].lots[0].crop = 'banana';
  owner.districts[0].lots[0].readyAt = t0 + DAY;
  const hm = h.money, om = owner.money;
  W.helpWater(h, owner, 0, 0, t0);
  check(h.money - hm === 7500 && owner.money - om === 5000, 'helpWater: helper earns 7,500đ, owner still 5,000đ');
}

// Lucky: flat money, no other effect
const lucky = login('lucky-draw', 'May mắn');
lucky.fortune = null;
{
  const m = lucky.money;
  // find a day whose fortune is lucky for this player
  let day = t0;
  while (F.fortuneFor(lucky.id, day).id !== 'lucky') day += DAY;
  F.drawFortune(lucky, day);
  check(lucky.money === m + 5000, 'Lucky pays 5,000đ once');
  check(F.activeFortune(lucky, day) === null && F.fortuneTrafficMultiplier(lucky, day) === 1, 'Lucky has no timed effect');
}

// Sharing
const ta = t0 + 2 * DAY;
const mk = (name: string) => login(`share-${name}`, name);
// A day (at or after `from`) on which this player's own fortune is `kind`
const dayWith = (p: ReturnType<typeof mk>, kind: string, from: number) => {
  let day = from;
  while (F.fortuneFor(p.id, day).id !== kind) day += DAY;
  return day;
};
const sA = mk('Gui'), sB = mk('Nhan'), sC = mk('Nhan2'), sD = mk('Nhan3');
sA.friends = [sB.id, sC.id, sD.id];
refuses(() => F.shareFortune(sA, sB, ta), 'xem bói cho mình', 'You must draw your own fortune first');
const day1 = dayWith(sA, 'busy', ta);
F.drawFortune(sA, day1);
refuses(() => F.shareFortune(sA, stranger, day1), 'bạn bè', 'Only friends can receive a fortune');
refuses(() => F.shareFortune(sA, null, day1), 'Không tìm thấy', 'The receiver must exist');
refuses(() => F.shareFortune(sA, sA, day1), 'tự tặng', 'Not to yourself');
F.shareFortune(sA, sB, day1 + 1000);
check(sB.fortune?.id === 'busy' && sB.fortune.half === true, 'A friend gets the same fortune at half strength');
const plain = W.footTraffic(login('plain2', 'Thường 2'), 0, day1);
check(Math.abs(W.footTraffic(sB, 0, day1 + 2000) - plain * 1.05) < 1e-9, 'The shared busy gives the friend 5% traffic');
check(W.footTraffic(sB, 0, day1 + 1000 + HOUR) === plain, 'The shared buff expires after an hour too');
refuses(() => F.shareFortune(sA, sC, day1 + 2000), 'đã tặng', 'One share per sender per day');

// A receiver takes only one shared fortune per day
const s2 = mk('Gui2');
s2.friends = [sB.id];
F.drawFortune(s2, day1);
refuses(() => F.shareFortune(s2, sB, day1 + 3000), 'đã nhận', 'A receiver gets at most one shared fortune per day');

// A receiver who already drew a different fortune refuses; the same kind is accepted and keeps full strength
const own = mk('Own');
const dayX = dayWith(own, 'wise', day1);
F.drawFortune(own, dayX);
const givers = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'].map(mk);
const withWise = givers.find((g) => F.fortuneFor(g.id, dayX).id === 'wise');
const withOther = givers.find((g) => F.fortuneFor(g.id, dayX).id !== 'wise');
check(!!withWise && !!withOther, 'Test setup: found givers of both kinds');
if (withWise && withOther) {
  for (const g of [withWise, withOther]) { g.friends = [own.id]; F.drawFortune(g, dayX); }
  refuses(() => F.shareFortune(withOther, own, dayX), 'ra quẻ khác', 'A receiver with a different own fortune refuses');
  F.shareFortune(withWise, own, dayX);
  check(own.fortune?.half === false && F.fortuneXp(own, 100, dayX) === 110, 'The same kind leaves the own full-strength fortune alone');
}

// A shared fortune cannot be passed on; a shared lucky pays half and your own draw replaces a shared fortune
refuses(() => { sB.friends = [sD.id]; F.shareFortune(sB, sD, day1 + 4000); }, 'xem bói cho mình', 'A received fortune cannot be shared again');
{
  const next = mk('Later'), giver = mk('Giver');
  giver.friends = [next.id];
  const d = dayWith(giver, 'lucky', day1);
  F.drawFortune(giver, d);
  const m = next.money;
  F.shareFortune(giver, next, d);
  check(next.money === m + 2500, 'A shared lucky pays 2,500đ');
  F.drawFortune(next, d);
  const ownKind = F.fortuneFor(next.id, d).id;
  check(next.fortune?.half === false && next.fortune.id === ownKind, 'Your own draw replaces a received fortune');
  check(next.money === (ownKind === 'lucky' ? m + 5000 : m + 2500), 'Money only ever goes up, and lucky is never paid twice in full');
}

// Emotes
const te = t0 + 10 * DAY;
const e1 = mk('E1'), e2 = mk('E2'), e3 = mk('E3');
e1.friends = [e2.id, e3.id];
e1.name = 'Lan';
const snap = (p: ReturnType<typeof mk>) => JSON.stringify({ money: p.money, store: p.store, fame: p.fame, stamina: p.stamina, xp: p.xp });
const s1 = snap(e1), s2snap = snap(e2);
const res = F.checkEmote(e1, e2, 'cheer', te);
check(res.text.includes('Lan'), 'An emote produces a notification text naming the sender');
check(snap(e1) === s1 && snap(e2) === s2snap, 'Emotes change nobody\'s money, goods, fame, stamina or XP');
refuses(() => F.checkEmote(e1, e2, 'cheer', te + 5000), 'chậm', 'One emote per target per 10 seconds');
F.checkEmote(e1, e3, 'comfort', te + 5000);
check(e1.fortuneDay.emotes === 2, 'A different target is not blocked by that limit');
F.checkEmote(e1, e2, 'coffee', te + 10_000);
check(e1.fortuneDay.emotes === 3, 'Each emote counts toward the daily limit');
refuses(() => F.checkEmote(e1, e2, 'slap', te + 30_000), 'cử chỉ', 'Unknown emote kinds are refused');
refuses(() => F.checkEmote(e1, stranger, 'cheer', te + 30_000), 'bạn bè', 'Emotes go to friends only');
refuses(() => F.checkEmote(e1, e1, 'cheer', te + 30_000), 'chính', 'No emote to yourself');
for (let i = 1; e1.fortuneDay.emotes < 20; i++) F.checkEmote(e1, i % 2 ? e2 : e3, 'cheer', te + 20_000 + i * 11_000);
check(e1.fortuneDay.emotes === 20, 'Twenty emotes are allowed per day');
refuses(() => F.checkEmote(e1, e3, 'cheer', te + HOUR), 'nhiều rồi', 'The 21st emote of the day is refused');
F.checkEmote(e1, e3, 'cheer', te + DAY);
check(e1.fortuneDay.emotes === 1, 'The emote limit resets the next day');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

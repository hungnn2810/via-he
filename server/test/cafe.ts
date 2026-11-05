// Checks the shared café: build gate, seats by level, doubled stamina regen, owner payout caps, the sit cap and freeing seats.
//   npx tsx test/cafe.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-cafe-'));
const { BALANCE, BUILDINGS, FAME } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const C = await import('../src/cafe.js');
const { GameError, login } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const MIN = 60_000, HOUR = 3_600_000, DAY = 24 * HOUR, t0 = 100 * DAY;

const owner = login('cafe-owner-device', 'Chủ quán');
const visitor = (n: number, level = 3) => { const v = login(`cafe-visitor-${n}`, `Khách ${n}`); v.level = level; return v; };

// Building cost and level gate
check(BUILDINGS.cafe.cost === 1_200_000 && BUILDINGS.cafe.unlockLevel === 4 && BUILDINGS.cafe.maxLevel === 3 && BUILDINGS.cafe.incomePerHour === 80_000, 'The café costs 1,200,000đ, needs level 4 and earns 80,000đ an hour');
owner.money = 5_000_000; owner.level = 3;
refuses(() => W.build(owner, 0, 0, 'cafe', t0), 'Cần cấp 4', 'The café needs level 4');
owner.level = 4;
W.build(owner, 0, 0, 'cafe', t0);
check(owner.money === 3_800_000, 'Building the café takes 1,200,000đ');
const ready = owner.districts[0].lots[0].readyAt;
check(ready === t0 + 1800 * 1000, 'The café takes 30 minutes to build');
check(Math.abs(W.footTraffic(owner, 0, ready) - 0.6) < 1e-9, 'A finished café counts toward foot traffic');
check(W.collectIncome(owner, ready + HOUR) === 80_000, 'A level 1 café earns 80,000đ an hour');

// Seats by level
const seats = new C.CafeSeats(0);
const v = [1, 2, 3, 4, 5, 6, 7].map((n) => visitor(n));
refuses(() => seats.sit(owner, v[0], 0, 0, 0, ready - 1000), 'xây xong', 'Cannot sit in a café still being built');
refuses(() => seats.sit(owner, v[0], 0, 0, 1, ready), 'Quán cà phê', 'Cannot sit on a lot without a café');
refuses(() => seats.sit(owner, v[0], 0, 1, 0, ready), 'không ở phố này', 'Cannot sit in a café on another street');
refuses(() => seats.sit(owner, visitor(99, 1), 0, 0, 0, ready), 'Cần cấp 2', 'Level 1 players cannot sit');
check(C.cafeSeatCount(1) === 4 && C.cafeSeatCount(2) === 6 && C.cafeSeatCount(3) === 8, 'Seats are 4, 6 and 8 by level');
for (let i = 0; i < 4; i++) seats.sit(owner, v[i], 0, 0, 0, ready);
refuses(() => seats.sit(owner, v[4], 0, 0, 0, ready), 'hết chỗ', 'A level 1 café has only 4 seats');
refuses(() => seats.sit(owner, v[0], 0, 0, 0, ready), 'đang ngồi', 'A player sits only once at a time');
check(seats.view().seats.map((s) => s.index).join() === '0,1,2,3' && seats.view().seats[0].playerId === v[0].id, 'The seat view lists index and player');
owner.money = 10_000_000;
W.upgrade(owner, 0, 0, ready + 1);
seats.sit(owner, v[4], 0, 0, 0, ready + 1);
seats.sit(owner, v[5], 0, 0, 0, ready + 1);
refuses(() => seats.sit(owner, v[6], 0, 0, 0, ready + 1), 'hết chỗ', 'A level 2 café has 6 seats');
check(seats.leave(v[1].id) && !seats.leave(v[1].id), 'Leaving frees a seat once');
seats.sit(owner, v[6], 0, 0, 0, ready + 1);
check(seats.view().seats.find((s) => s.playerId === v[6].id)?.index === 1, 'A freed seat is reused');

// Stamina regen doubles while seated
check(C.regenStamina(5, false) === 6 && C.regenStamina(5, true) === 7, 'A seated player regains stamina twice as fast');
check(C.regenStamina(BALANCE.maxStamina - 1, true) === BALANCE.maxStamina, 'Regen never passes the maximum');
check(seats.isSeated(v[0].id) && !seats.isSeated(visitor(50).id), 'isSeated tells who is sitting');

// Owner payout: 3,000đ per visitor session, 10 a day, fame once per visitor
const o2 = login('cafe-owner-2', 'Chủ quán hai');
o2.money = 5_000_000; o2.level = 4;
const day1 = 200 * DAY;
W.build(o2, 0, 0, 'cafe', day1);
const open = day1 + 1800 * 1000;
const s2 = new C.CafeSeats(0);
const fameBefore = o2.fame, moneyBefore = o2.money;
const first = visitor(10);
check(s2.sit(o2, first, 0, 0, 0, open).paid === 3000, 'A visitor sitting pays the owner 3,000đ');
check(o2.money === moneyBefore + 3000 && o2.fame === fameBefore + 1, 'The owner also gets 1 fame for a new visitor');
s2.leave(first.id);
s2.sit(o2, first, 0, 0, 0, open + 1);
check(o2.fame === fameBefore + 1 && o2.money === moneyBefore + 6000, 'The same visitor sitting again pays again but gives no extra fame');
s2.leave(first.id);
for (let i = 0; i < 8; i++) { const x = visitor(20 + i); s2.sit(o2, x, 0, 0, 0, open + 2); s2.leave(x.id); }
check(o2.cafeDay.sessions === 10 && o2.money === moneyBefore + 30_000, 'Ten paid sessions earn 30,000đ');
const eleventh = visitor(40);
check(s2.sit(o2, eleventh, 0, 0, 0, open + 3).paid === 0 && o2.money === moneyBefore + 30_000, 'The 11th session of the day pays nothing');
check(o2.fame === fameBefore + 10, 'Fame is 1 per distinct visitor (10 so far)');
s2.leave(eleventh.id);
const ownerSelf = s2.sit(o2, o2, 0, 0, 0, open + 4);
check(ownerSelf.paid === 0 && o2.money === moneyBefore + 30_000, 'The owner sitting in their own café earns nothing');
s2.leave(o2.id);
// Fame cap by distinct visitors per day
o2.cafeDay.visitors = Array.from({ length: FAME.maxVisitorsPerDay }, (_, i) => `ghost-${i}`);
const fameAtCap = o2.fame;
const late = visitor(41);
s2.sit(o2, late, 0, 0, 0, open + 5);
check(o2.fame === fameAtCap, 'Café fame stops at the daily visitor cap');
s2.leave(late.id);
// A new day resets the counters
const nextDay = open + DAY;
const fresh = visitor(60);
check(s2.sit(o2, fresh, 0, 0, 0, nextDay).paid === 3000 && o2.cafeDay.sessions === 1, 'The next day the cap resets');

// 10 minute sit cap, and a demolished café empties
const s3 = new C.CafeSeats(0);
const sitter = visitor(70);
s3.sit(o2, sitter, 0, 0, 0, nextDay);
check(!s3.expire(o2, nextDay + 10 * MIN - 1) && s3.isSeated(sitter.id), 'A sit lasts up to 10 minutes');
check(s3.expire(o2, nextDay + 10 * MIN) && !s3.isSeated(sitter.id), 'A sit ends after 10 minutes');
s3.sit(o2, sitter, 0, 0, 0, nextDay + 11 * MIN);
W.demolish(o2, 0, 0, nextDay + 11 * MIN);
check(s3.expire(o2, nextDay + 11 * MIN) && s3.view().seats.length === 0, 'Demolishing the café empties its seats');

// Leaving the room frees the seat (the room calls leave() from onLeave)
const s4 = new C.CafeSeats(0);
s4.sit(owner, v[0], 0, 0, 0, ready + 2);
check(s4.leave(v[0].id) && s4.view().seats.length === 0, 'Leaving the room frees the seat');

// Old profiles get the new counter
const newcomer = login('cafe-newcomer', 'Người mới');
check(newcomer.cafeDay.sessions === 0 && newcomer.cafeDay.visitors.length === 0, 'Profiles have a cafeDay counter by default');

console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

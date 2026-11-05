// Checks the light street incidents (police reminder, communal cleanup) on a fake clock, without a running room.
//   npx tsx test/incidents.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-test-'));
const P = await import('../src/profile.js');
const I = await import('../src/incidents.js');
const { GameError, login } = P;
const { INCIDENTS, INCIDENT_RULES, IncidentManager } = I;

import type { Profile } from '../src/profile.js';
let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const DAY = 86_400_000, t0 = 100 * DAY, SEC = 1000;

type Sent = { to: string; type: string; payload: any };
// A fake room: who is present, whether the owner has a stall open, and everything that was pushed
function makeRoom(owner: Profile, now: number, random = () => 0) {
  const room = {
    present: [owner] as Profile[],
    stall: true,
    sent: [] as Sent[],
    manager: null as unknown as InstanceType<typeof IncidentManager>,
  };
  room.manager = new IncidentManager({
    owner,
    present: () => room.present,
    ownerHasOpenStall: () => room.stall,
    send: (to, type, payload) => room.sent.push({ to, type, payload }),
    broadcast: (type, payload) => room.sent.push({ to: '*', type, payload }),
    changed: () => {},
  }, now, random);
  return room;
}
const results = (room: ReturnType<typeof makeRoom>, to: string) => room.sent.filter((s) => s.type === 'incidentResult' && s.to === to);
const police = INCIDENTS.police_reminder;
const cleanup = INCIDENTS.communal_cleanup;

// ---- Police reminder ----
const owner = login('incidents-owner-device', 'Chủ phố');
owner.money = 500_000; owner.level = 3;

let room = makeRoom(owner, t0);
check(room.manager.start(police, t0), 'A police reminder starts when the owner is present with a stall open');
const notice = room.sent.find((s) => s.type === 'incident');
check(notice?.to === owner.id && notice.payload.phase === 'notice' && notice.payload.endsAt === t0 + 30 * SEC && notice.payload.id === 'police_reminder',
  'The notice is pushed to the owner only, with a 30 second window');
check(!room.manager.start(cleanup, t0), 'Only one incident at a time');
room.manager.tick(t0 + 29 * SEC);
check(owner.money === 500_000, 'No fine inside the notice window');
room.manager.tick(t0 + 30 * SEC);
check(owner.money === 480_000, 'Ignoring the notice costs 20,000đ');
check(results(room, owner.id).length === 1 && results(room, owner.id)[0].payload.money === -20_000, 'A one-line result is pushed to the owner');
check(room.sent.at(-1)?.payload.phase === 'ended', 'The incident ends with an "ended" push');

// once per day
room = makeRoom(owner, t0 + SEC);
check(!room.manager.start(police, t0 + 60 * SEC), 'No second fine on the same day (the incident is not even started)');
room = makeRoom(owner, t0 + DAY);
check(room.manager.start(police, t0 + DAY), 'The next day a new reminder can run');
room.manager.tick(t0 + DAY + 30 * SEC);
check(owner.money === 460_000, 'The next day the fine applies again');

// fine capped by money
const poor = login('incidents-poor-device', 'Nghèo');
poor.money = 5_000;
room = makeRoom(poor, t0);
room.manager.start(police, t0);
room.manager.tick(t0 + 30 * SEC);
check(poor.money === 0, 'The fine is capped at the money the player has (never below zero)');
check(results(room, poor.id)[0].payload.money === -5_000, 'The result reports the real amount paid');
poor.money = 0;
room = makeRoom(poor, t0 + DAY);
check(!room.manager.start(police, t0 + DAY), 'A player with no money is not given a reminder');

// offline / absent owner
const away = login('incidents-away-device', 'Vắng');
away.money = 100_000;
room = makeRoom(away, t0);
room.present = [];
check(!room.manager.start(police, t0), 'An offline owner never gets a reminder');
room.present = [away];
room.manager.start(police, t0);
room.present = [];
room.manager.tick(t0 + 31 * SEC);
check(away.money === 100_000, 'An owner who left during the notice is never fined');
const absentDay = I.incidentDay(away, t0 + 31 * SEC);
check(!absentDay.fined, 'And it does not use up the daily fine');

// closing the stall in time
room = makeRoom(away, t0 + DAY);
room.manager.start(police, t0 + DAY);
room.stall = false;
room.manager.tick(t0 + DAY + 31 * SEC);
check(away.money === 100_000, 'An owner who closed their stall during the notice is not fined');

// pause prevents the fine
const pauser = login('incidents-pauser-device', 'Dọn tạm');
pauser.money = 300_000;
room = makeRoom(pauser, t0);
check(!room.manager.isPaused(pauser.id, t0), 'Stalls are not paused without an incident');
refuses(() => room.manager.pauseStalls(pauser, t0), 'Chưa có ai', 'Pausing without a notice is refused');
room.manager.start(police, t0);
refuses(() => room.manager.pauseStalls(away, t0 + SEC), 'Chưa có ai', 'Only the owner can pause');
room.manager.pauseStalls(pauser, t0 + 10 * SEC);
check(room.manager.isPaused(pauser.id, t0 + 20 * SEC) && room.manager.isPaused(pauser.id, t0 + 69 * SEC), 'The owner\'s stalls are paused for 60 seconds');
check(!room.manager.isPaused('someone-else', t0 + 20 * SEC), 'Other players\' stalls are not paused');
refuses(() => room.manager.pauseStalls(pauser, t0 + 11 * SEC), 'đã dọn tạm', 'Pausing twice is refused');
room.manager.tick(t0 + 31 * SEC);
check(pauser.money === 300_000, 'Pausing prevents the fine');
check(room.sent.some((s) => s.type === 'incident' && s.payload.phase === 'paused' && s.payload.endsAt === t0 + 70 * SEC), 'The paused phase is pushed with its end time');
room.manager.tick(t0 + 70 * SEC);
check(!room.manager.isPaused(pauser.id, t0 + 70 * SEC), 'The pause ends after 60 seconds');
check(results(room, pauser.id).length === 1 && results(room, pauser.id)[0].payload.money === 0, 'A no-fine result is pushed when the pause is over');
check(!I.incidentDay(pauser, t0 + 70 * SEC).fined, 'A paused reminder does not use up the daily fine');

// ---- Scheduler ----
const sched = login('incidents-sched-device', 'Lịch');
sched.money = 100_000; sched.level = 3;
room = makeRoom(sched, t0, () => 0);
room.manager.tick(t0 + 60 * SEC);
check(!room.sent.length, 'No incident before the first check');
room.manager.tick(t0 + 180 * SEC);
check(room.sent.some((s) => s.type === 'incident' && s.payload.phase === 'notice'), 'The scheduler starts an incident when the dice say so');
room.manager.pauseStalls(sched, t0 + 181 * SEC);
room.manager.tick(t0 + 241 * SEC); // the pause is over: the incident ends
const sentBefore = room.sent.length;
for (let t = 241; t < 241 + INCIDENT_RULES.minGapSeconds - 1; t += 10) room.manager.tick(t0 + t * SEC);
check(room.sent.length === sentBefore, 'No new incident within the minimum gap of the previous one');
room.manager.tick(t0 + (241 + INCIDENT_RULES.minGapSeconds) * SEC);
check(room.sent.length > sentBefore, 'After the gap the next incident can start');
const busy = makeRoom(sched, t0, () => 0.99);
busy.manager.tick(t0 + 180 * SEC);
check(!busy.sent.length, 'A bad roll starts nothing');
const npcOwner = { ...sched, isNpc: true } as Profile;
const npcRoom = makeRoom(npcOwner, t0, () => 0);
npcRoom.manager.tick(t0 + 180 * SEC);
check(!npcRoom.sent.length, 'NPC streets never get incidents');

// ---- Communal cleanup ----
const host = login('incidents-host-device', 'Chủ dọn');
host.level = 3; host.money = 0; host.fame = 0;
const guests = Array.from({ length: 12 }, (_, i) => { const g = login(`incidents-guest-${i}`, `Khách ${i}`); g.level = 2; g.money = 0; return g; });
const baby = login('incidents-baby-device', 'Mới'); baby.level = 1;
room = makeRoom(host, t0);
room.present = [host, ...guests, baby];
check(room.manager.start(cleanup, t0), 'A cleanup starts when the owner is present');
check(room.sent[0].to === '*' && room.sent[0].payload.phase === 'active' && room.sent[0].payload.endsAt === t0 + 180 * SEC, 'The cleanup is announced to the whole room for 3 minutes');
refuses(() => room.manager.joinCleanup(baby, t0 + SEC), 'cấp 2', 'Level 1 accounts cannot join');
refuses(() => room.manager.joinCleanup(login('incidents-outsider', 'Xa'), t0 + SEC), 'không ở trong phố', 'Only players present in the room can join');
room.manager.joinCleanup(guests[0], t0 + SEC);
check(guests[0].money === 8_000, 'A participant earns 8,000đ');
check(host.fame === 1, 'The owner earns 1 fame for a joining visitor');
refuses(() => room.manager.joinCleanup(guests[0], t0 + 2 * SEC), 'đã tham gia', 'One join per event');
room.manager.joinCleanup(host, t0 + 3 * SEC);
check(host.money === 8_000 && host.fame === 1, 'The owner is rewarded too, but gets no fame for joining their own cleanup');

// fame cap
for (let i = 1; i < 12; i++) room.manager.joinCleanup(guests[i], t0 + (4 + i) * SEC);
check(host.fame === INCIDENT_RULES.cleanupFamePerDay, `Cleanup fame stops at the daily cap of ${INCIDENT_RULES.cleanupFamePerDay}`);
check(guests[11].money === 8_000, 'Visitors still get their money once the owner hit the fame cap');
room.manager.tick(t0 + 180 * SEC);
const ownerResult = results(room, host.id).at(-1);
check(ownerResult?.payload.fame === INCIDENT_RULES.cleanupFamePerDay, 'The owner gets a result line naming the fame earned');
check(room.sent.at(-1)?.payload.phase === 'ended', 'The cleanup ends with an "ended" broadcast');

// reward cap per player per day
const runner = login('incidents-runner-device', 'Chạy dọn');
runner.level = 3; runner.money = 0;
let t = t0 + DAY;
for (let i = 0; i < 4; i++) {
  const r = makeRoom(host, t);
  r.present = [host, runner];
  r.manager.start(cleanup, t);
  if (i < 3) r.manager.joinCleanup(runner, t + SEC);
  else refuses(() => r.manager.joinCleanup(runner, t + SEC), 'đủ 3 lần', 'The 4th cleanup of the day pays nothing');
  t += 200 * SEC;
}
check(runner.money === 24_000, 'A player earns the cleanup reward at most 3 times a day');
const next = makeRoom(host, t0 + 2 * DAY);
next.present = [host, runner];
next.manager.start(cleanup, t0 + 2 * DAY);
next.manager.joinCleanup(runner, t0 + 2 * DAY + SEC);
check(runner.money === 32_000, 'The cleanup cap resets the next day');

// fame: the same visitor gives fame only once a day, even across events
const repeat = login('incidents-repeat-device', 'Lặp'); repeat.level = 3;
const owner2 = login('incidents-owner2-device', 'Chủ 2'); owner2.level = 3; owner2.fame = 0;
t = t0 + 3 * DAY;
for (let i = 0; i < 3; i++) {
  const r = makeRoom(owner2, t);
  r.present = [owner2, repeat];
  r.manager.start(cleanup, t);
  r.manager.joinCleanup(repeat, t + SEC);
  t += 200 * SEC;
}
check(owner2.fame === 1, 'One visitor gives the owner fame once a day, not once per event');

P.flushNow();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll incident checks passed');
process.exit(failures ? 1 : 0);

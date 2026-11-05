// Simulates two players against a running server to check the game rules.
//   npm start   (in another terminal)   then   npm test
import { Client } from '@colyseus/sdk';

const URL = process.env.URL || 'http://localhost:2567';
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };

async function login(name: string) {
  const r = await fetch(`${URL}/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deviceId: `simulation-${name}-${Date.now()}`, name }),
  });
  return r.json() as Promise<{ token: string; id: string; name: string }>;
}

async function joinStreet(account: { token: string }, ownerId: string, district = 0) {
  const client = new Client(URL);
  const room = await client.joinOrCreate<any>('street', { token: account.token, ownerId, district });
  const ctx = { room, profile: null as any, errors: [] as string[], sales: 0 };
  room.onMessage('profile', (p) => { ctx.profile = p; });
  room.onMessage('error', (m) => { ctx.errors.push(m.text); });
  room.onMessage('sale', () => { ctx.sales++; });
  room.onMessage('*', () => {});
  await wait(300);
  return ctx;
}

const a = await login('An');
const b = await login('Bình');

const A = await joinStreet(a, a.id);
check(A.profile?.money === 500000, 'An starts with 500,000đ');
check(A.profile?.districts[0].lots.length === 4 && A.profile?.appearance === null, 'An has 4 empty lots and no character yet');
check(A.room.state.lots.size === 4 && A.room.state.districtName === 'Bãi đất', 'The street shows the empty land');
A.room.send('createCharacter', { gender: 'female', hair: 1, brows: 0, lips: 2, cheeks: 1, earrings: 3 });
await wait(300);
check(A.profile.appearance?.gender === 'female', 'An creates a character');
check([...A.room.state.players.values()].some((p: any) => p.look === 'female,1,0,2,1,3'), 'The street sees the new look');
A.room.send('plant', { lot: 0, crop: 'banana' });
await wait(300);
check(A.profile.districts[0].lots[0].readyAt > 0 && A.profile.money === 500000, 'First planting is free');
A.room.send('openStall', { slot: 1, productId: 'banana', quantity: 5 });
await wait(300);
check(A.errors.some((t) => t.includes('Kho hết')), 'Cannot sell bananas with an empty store');
check(A.room.state.ownerName === 'An', 'An is on their own street');

const B = await joinStreet(b, a.id);
check(B.room.roomId === A.room.roomId, "Bình joined An's street");
check(A.room.state.players.size === 2, 'Street has 2 players');

// Slot 0 belongs to the street owner, Bình cannot use it
B.room.send('openStall', { slot: 0, productId: 'iced_tea', quantity: 10 });
await wait(300);
check(B.errors.some((t) => t.includes('chủ phố')), "Bình cannot open a stall in the owner's slot");

// Product not unlocked yet
A.room.send('openStall', { slot: 0, productId: 'flowers', quantity: 5 });
await wait(300);
check(A.errors.some((t) => t.includes('Cần cấp')), 'Cannot sell a locked product');

A.room.send('openStall', { slot: 0, productId: 'iced_tea', quantity: 20 });
await wait(300);
check(A.room.state.stalls.get('0')?.remaining === 20, 'An opens an iced tea stall with 20 portions');
check(A.profile.money === 500000 - 20 * 1000, 'Stock cost is deducted');

B.room.send('plant', { lot: 1, crop: 'banana' });
await wait(300);
check(B.errors.some((t) => t.includes('vườn nhà mình')), "Bình cannot plant on An's street");

// Bình hires an employee and has them run a stall on An's street
const candidate = B.profile.candidates[0];
B.room.send('hire', { candidateId: candidate.id });
await wait(300);
check(B.profile.employees.length === 1, `Bình hires ${candidate.name} for ${candidate.hireCost}đ`);
B.room.send('openStall', { slot: 4, productId: 'iced_tea', quantity: 30, employeeId: candidate.id });
await wait(300);
check(A.room.state.stalls.get('4')?.sellerName === candidate.name, "Bình's employee runs the stall in slot 4");
const binhStock = A.room.state.stalls.get('4')?.remaining ?? 0;

// Buy and wear clothes
B.room.send('buyWearable', { wearableId: 'jeans' });
await wait(300);
check(B.errors.some((t) => t.includes('Cần cấp')), 'Cannot buy a wearable above your level');
B.room.send('buyWearable', { wearableId: 'conical' });
await wait(300);
B.room.send('wear', { wearableId: 'conical', employeeId: candidate.id });
await wait(300);
check(B.profile.employees[0].outfit.hat === 'conical', 'Employee wears the conical hat');

// Invite: wait for a customer near An, then invite them to the stall
const moneyBefore = A.profile.money;
let invited = false;
for (let i = 0; i < 60 && !invited; i++) {
  await wait(500);
  const p = [...A.room.state.players.values()].find((x: any) => x.id === a.id);
  const k = [...A.room.state.customers.values()].find((x: any) =>
    x.status === 'walk' && x.wants.includes('iced_tea') && x.group === 'student' && Math.abs(x.x - p.x) < 250);
  if (k) { A.room.send('inviteCustomer', { customerId: k.id }); invited = true; }
}
check(invited, 'A student who wants iced tea came close enough to invite');

console.log('… waiting 40 seconds for customers to buy');
await wait(40000);
check(A.sales > 0, `The street sold ${A.sales} portions`);
check(A.profile.money > moneyBefore, `An earned ${A.profile.money - moneyBefore}đ (sales + sidewalk fees)`);
const binhSold = binhStock - (A.room.state.stalls.get('4')?.remaining ?? 0);
check(binhSold > 0, `Bình's employee sold ${binhSold} iced teas`);
const coSelling = A.profile.log.find((e: any) => e.type === 'co_selling' && e.who === 'Bình');
check(coSelling && coSelling.amount >= binhSold * 3000, `An's log thanks Bình for ${coSelling?.amount}đ of sales`);
check(A.profile.log.some((e: any) => e.type === 'visit'), "An's log records Bình's visit");

// Bình leaves: the employee stall keeps selling
await wait(500);
check(A.room.state.stalls.has('4'), 'After Bình leaves, the employee stall is still selling');

// Friends, helping and the public garden
const friendBefore = A.profile.money;
await B.room.leave();
const B2 = await joinStreet(b, a.id);
check(A.room.state.lots.get('0')?.readyAt > 0, 'Visitors can see the crops');
B2.room.send('addFriend', {});
await wait(200);
check(B2.profile.friends.includes(a.id), 'Bình adds An as a friend');
B2.room.send('water', { lot: 0 });
await wait(300);
check(A.room.state.lots.get('0')?.watered === true, "Bình waters An's crop");
check(A.profile.money >= friendBefore + 5000, 'An is rewarded for being helped');
B2.room.send('water', { lot: 0 });
await wait(300);
check(B2.errors.some((t) => t.includes('đã tưới')), 'Only one helping watering per street per day');
await B2.room.leave();

// Buildings on the street
A.room.send('build', { lot: 1, type: 'store' });
await wait(300);
check(A.room.state.lots.get('1')?.building === 'store', 'An builds a store and the street shows it');

// Street activities
A.room.send('caroStart', {});
await wait(200);
A.room.send('caroMove', { cell: 40 });
await wait(300);
check((A.room.state.caroBoard.match(/[XO]/g) ?? []).length === 2, 'A neighbour answers a caro move');
A.room.send('shuttleStart', {});
await wait(200);
A.room.send('shuttleKick', {});
await wait(1500);
check(A.room.state.shuttleScore >= 2, 'A neighbour keeps the shuttlecock rally going');

// An closes the stall: leftover stock is refunded
const remaining = A.room.state.stalls.get('0')?.remaining ?? 0;
const money = A.profile.money;
A.room.send('closeStall', { slot: 0 });
await wait(300);
check(remaining > 0 && !A.room.state.stalls.has('0') && A.profile.money >= money + remaining * 1000 - 1, `Stall closed, refunded ${remaining * 1000}đ`);

// NPC street
const npcClient = await joinStreet(a, 'npc-street-1');
check(npcClient.room.state.stalls.size === 3, 'An NPC street has stalls running');
await npcClient.room.leave();
const A2 = await joinStreet(a, a.id);
Object.assign(A, A2);

// Leaderboard
const board = await (await fetch(`${URL}/api/leaderboard`)).json();
check(Array.isArray(board.top) && board.top.some((s: any) => s.ownerId === a.id), 'An appears on the leaderboard');

// Bus street list
const streets = await (await fetch(`${URL}/api/streets?token=${encodeURIComponent(b.token)}`)).json();
check(streets.some((s: any) => s.ownerId === a.id && s.isOpen), "Bình sees An's street in the bus list");

await A.room.leave();
console.log(failures ? `\n${failures} checks failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

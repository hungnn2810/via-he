// Checks the season track, weekly quests, the server-wide season goal, leaderboards and the end-of-season rewards on a fake clock.
//   npx tsx test/season.ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'via-he-season-'));
const { SEASON_DAYS } = await import('../src/data.js');
const P = await import('../src/profile.js');
const W = await import('../src/world.js');
const S = await import('../src/season.js');
const { GameError, login, getProfile } = P;

let failures = 0;
const check = (ok: unknown, label: string) => { console.log(`${ok ? '✓' : '✗'} ${label}`); if (!ok) failures++; };
const refuses = (fn: () => void, text: string, label: string) => {
  try { fn(); check(false, label); }
  catch (e) { check(e instanceof GameError && e.message.includes(text), label); }
};
const DAY = 86_400_000;
const SEASON_LENGTH = SEASON_DAYS * DAY;
// Season 20, early in a week (weeks start Thursday 00:00 Vietnam time); the next season starts at SEASON_START + SEASON_LENGTH
const SEASON_START = 20 * SEASON_LENGTH;
const t0 = SEASON_START + DAY;
const nextWeek = t0 + 3 * DAY;
const nextSeason = SEASON_START + SEASON_LENGTH + DAY;

let counter = 0;
const player = (name: string, level: number) => {
  const p = login(`season-device-${counter++}`, name);
  p.level = level;
  return p;
};
const weeklyOf = (p: ReturnType<typeof player>, now: number) => S.seasonView(p, now).weekly;

// Finishes one weekly quest by feeding the events it counts
function finishQuest(p: ReturnType<typeof player>, quest: { id: string; target: number }, now: number) {
  const def = S.WEEKLY_POOL.find((q) => q.id === quest.id)!;
  if (def.distinct) for (let i = 0; i < quest.target; i++) S.seasonEvent(p, quest.id as never, 1, now, `street-${i}`);
  else S.seasonEvent(p, quest.id as never, quest.target, now);
}

// Themes
check(S.seasonTheme(0) === 'Mùa chuối chín' && S.seasonTheme(1) === 'Mùa phố hội' && S.seasonTheme(2) === 'Mùa hàng xóm', 'Season themes follow the season index');
check(S.seasonTheme(S.SEASON_THEMES.length) === S.seasonTheme(0), 'Themes repeat after the list ends');
const first = player('Người mới', 5);
const view0 = S.seasonView(first, t0);
check(view0.index === 20 && view0.theme === S.seasonTheme(20) && view0.endsAt === SEASON_START + SEASON_LENGTH, 'The season view has the index, theme and end time');
check(view0.tiers.length === 10 && view0.tiers[3].sp === 160 && view0.goal.milestones.length === 4, 'The track has 10 tiers of 40 points and the goal has 4 milestones');

// Deterministic weekly quests
const picked = S.pickWeeklyQuests(1000, 'abc').map((q) => q.id);
check(picked.length === 3 && new Set(picked).size === 3, 'Three different weekly quests are chosen');
check(S.pickWeeklyQuests(1000, 'abc').map((q) => q.id).join() === picked.join(), 'The same week and player always get the same quests');
const mixes = new Set(Array.from({ length: 30 }, (_, i) => S.pickWeeklyQuests(1000, `player-${i}`).map((q) => q.id).join()));
check(mixes.size > 3, 'Different players get different mixes');
const weeks = new Set(Array.from({ length: 12 }, (_, i) => S.pickWeeklyQuests(1000 + i, 'abc').map((q) => q.id).join()));
check(weeks.size > 1, 'Different weeks give different quests');
check(weeklyOf(first, t0).map((q) => q.id).join() === S.pickWeeklyQuests(E_week(t0), first.id).map((q) => q.id).join(), 'A player sees the quests picked for this week');
function E_week(now: number) { return Math.floor((now + 7 * 3_600_000 + 3 * DAY) / (7 * DAY)); }

// Level gates
const rookie = player('Tân binh', 1);
const novice = player('Người học việc', 2);
S.seasonEvent(rookie, 'sell', 5, t0);
check(S.seasonGoalProgress(20) === 0 && S.seasonView(rookie, t0).goal.eligible === false, 'A level 1 sale does not count towards the season goal');
check(weeklyOf(rookie, t0).length === 0 && weeklyOf(novice, t0).length === 0, 'Weekly quests need level 3');
S.seasonEvent(novice, 'sell', 3, t0);
check(S.seasonGoalProgress(20) === 3 && S.seasonView(novice, t0).goal.eligible, 'A level 2 sale counts towards the season goal');
refuses(() => S.claimSeasonGoal(rookie, t0), 'Cần cấp', 'A level 1 player cannot claim from the season goal');

// Weekly quest progress and rewards
const hero = player('Chăm chỉ', 6);
hero.money = 0;
const quests = weeklyOf(hero, t0);
check(quests.length === 3 && quests.every((q) => q.progress === 0 && !q.done), 'A level 3+ player gets three fresh weekly quests');
const [q1, q2, q3] = quests;
finishQuest(hero, q1, t0);
check(weeklyOf(hero, t0)[0].done && hero.money === S.SEASON.weeklyMoney && S.seasonView(hero, t0).sp === 20, 'A finished quest pays 50,000đ and 20 points');
finishQuest(hero, q1, t0);
check(hero.money === S.SEASON.weeklyMoney && S.seasonView(hero, t0).sp === 20, 'A finished quest pays only once');
finishQuest(hero, q2, t0);
check(S.seasonView(hero, t0).weeklyBonusClaimed === false && S.seasonView(hero, t0).sp === 40, 'The bonus waits for the third quest');
const done3 = S.seasonEvent(hero, q3.id as never, 1, t0, 'street-x');
finishQuest(hero, q3, t0);
const afterAll = S.seasonView(hero, t0);
check(afterAll.weeklyBonusClaimed && afterAll.sp === 80 && hero.money === 3 * S.SEASON.weeklyMoney, 'Finishing all three adds a 20 point bonus');
check(Array.isArray(done3), 'seasonEvent returns the quests it finished');
check(afterAll.weekly.every((q) => q.done), 'All weekly quests show as done');

// Distinct streets and progress that is not distinct
const helper = player('Người giúp', 5);
const helpQuest = S.WEEKLY_POOL.find((q) => q.id === 'help')!;
let helpWeek = 1;
const withHelp = () => { // find a player-week that has the help quest
  for (let w = E_week(nextWeek); w < E_week(nextWeek) + 50; w++) if (S.pickWeeklyQuests(w, helper.id).some((q) => q.id === 'help')) return w;
  return -1;
};
helpWeek = withHelp();
const helpTime = (helpWeek * 7 * DAY) - 3 * DAY - 7 * 3_600_000 + DAY;
check(helpWeek > 0, 'Found a week with a help quest for the helper');
const helpsBefore = helper.season?.helps ?? 0;
S.seasonEvent(helper, 'help', 1, helpTime, 'street-a');
S.seasonEvent(helper, 'help', 1, helpTime, 'street-a');
S.seasonEvent(helper, 'help', 1, helpTime, 'street-b');
const helpProgress = S.seasonView(helper, helpTime).weekly.find((q) => q.id === 'help')!;
check(helpProgress.progress === 2, 'Helping the same street twice counts once for the quest');
check(helper.season!.helps - helpsBefore === 3, 'Every help action counts for the helpers board');
check(helpQuest.target === 5, 'The help quest asks for 5 different streets');
S.seasonEvent(helper, 'help', 1, helpTime);
check(S.seasonView(helper, helpTime).weekly.find((q) => q.id === 'help')!.progress === 2, 'A help without a street never counts as a different street');

// A new week brings new quests; unfinished progress is not carried over and nothing is lost
const nextView = S.seasonView(hero, nextWeek);
check(nextView.weekly.every((q) => !q.done && q.progress === 0) && !nextView.weeklyBonusClaimed, 'A new week resets the weekly quests');
check(nextView.sp === 80, 'Season points stay across weeks');

// Fame turns into season points: 1 per 5 fame
const famous = player('Nổi tiếng', 4);
S.seasonEvent(famous, 'fame', 12, t0);
check(S.seasonView(famous, t0).sp === 2, '12 fame gives 2 season points');
S.seasonEvent(famous, 'fame', 3, t0);
check(S.seasonView(famous, t0).sp === 3, 'Leftover fame carries over to the next point');
const live = player('Phố vui', 4);
W.addFame(live, 10);
check(S.seasonView(live).sp === 2 && live.fame === 10, 'addFame feeds the season track');
const npcOwner = player('Phố NPC', 5);
npcOwner.isNpc = true;
S.seasonEvent(npcOwner, 'fame', 50, t0);
check((npcOwner.season?.sp ?? 0) === 0, 'NPC streets collect no season points');

// Track claims
const racer = player('Đua mùa', 6);
racer.money = 0;
racer.titles = [];
refuses(() => S.claimSeasonTier(racer, 1, t0), 'Chưa đủ', 'A tier needs its points');
S.seasonEvent(racer, 'fame', 40 * 5, t0); // 40 points
S.claimSeasonTier(racer, 1, t0);
check(racer.money === 10_000, 'Tier 1 pays a little money');
refuses(() => S.claimSeasonTier(racer, 1, t0), 'đã nhận', 'A tier is claimed once');
refuses(() => S.claimSeasonTier(racer, 0, t0), 'không hợp lệ', 'Tier 0 does not exist');
refuses(() => S.claimSeasonTier(racer, 11, t0), 'không hợp lệ', 'Tier 11 does not exist');
refuses(() => S.claimSeasonTier(racer, '2', t0), 'không hợp lệ', 'A tier must be a whole number');
S.seasonEvent(racer, 'fame', 400 * 5, t0); // 400 more points, past the last tier
const reply = S.claimSeasonTier(racer, 2, t0);
check(racer.titles.includes('Mùa 20: Người bán chăm chỉ') && reply.tiers[1].claimed, 'A title tier adds the title and replies with the season state');
S.claimSeasonTier(racer, 4, t0);
check(racer.decorations.includes('season_20_tier_4'), 'A decoration tier adds season_<n>_tier_<k>');
for (const tier of [3, 5, 6, 7, 8, 9, 10]) S.claimSeasonTier(racer, tier, t0);
check(racer.decorations.includes('season_20_tier_10') && racer.titles.includes('Mùa 20: Ngôi sao của mùa'), 'The last tier gives a title and a decoration');
check(S.TRACK_REWARDS.every((r) => (r.money ?? 0) <= 30_000), 'No track tier pays more than 30,000đ');
check(S.seasonView(racer, t0).tiers.every((t) => t.claimed), 'Every tier shows as claimed');

// Season goal milestones
const seller = player('Người bán', 5);
seller.money = 0;
refuses(() => S.claimSeasonGoal(seller, t0), 'ít nhất 1 phần', 'The goal needs at least one sale this season');
S.seasonEvent(seller, 'sell', 1, t0);
refuses(() => S.claimSeasonGoal(seller, t0), 'Chưa có phần thưởng mới', 'No reached milestone means nothing to claim');
const setGoal = (season: number, progress: number) => P.gameDb.prepare('INSERT OR REPLACE INTO season_goal (season, progress) VALUES (?, ?)').run(season, progress);
setGoal(20, 50_000);
check(S.seasonView(seller, t0).goal.milestones.map((m) => m.reached).join() === 'true,false,false,false', '25% of the target reaches milestone 1');
S.claimSeasonGoal(seller, t0);
check(seller.money === 20_000, 'Milestone 1 pays 20,000đ');
refuses(() => S.claimSeasonGoal(seller, t0), 'Chưa có phần thưởng mới', 'A milestone is claimed once');
setGoal(20, 200_000);
const goalReply = S.claimSeasonGoal(seller, t0);
check(seller.money === 80_000 && goalReply.goal.milestones.every((m) => m.claimed), 'The remaining milestones are paid once each');
check(seller.decorations.includes('season_goal_20'), 'The last milestone gives the season_goal_<n> decoration');
const lateComer = player('Người đến sau', 5);
lateComer.money = 0;
S.seasonEvent(lateComer, 'sell', 1, t0);
S.claimSeasonGoal(lateComer, t0);
check(lateComer.money === 80_000 && lateComer.decorations.includes('season_goal_20'), 'A later player can claim every reached milestone');

// Boards
const h1 = player('Giúp nhiều', 5), h2 = player('Giúp vừa', 5), h3 = player('Giúp ít', 5), s1 = player('Giao nhiều', 5);
for (let i = 0; i < 5; i++) S.seasonEvent(h1, 'help', 1, t0, `st-${i}`);
for (let i = 0; i < 3; i++) S.seasonEvent(h2, 'help', 1, t0, `st-${i}`);
S.seasonEvent(h3, 'help', 1, t0, 'st-0');
S.seasonEvent(s1, 'deliver', 100, t0);
P.flushNow(); // boards read the saved players
const helpersBoard = S.leaderboard('helpers', t0);
const names = helpersBoard.top.map((x) => x.name);
check(helpersBoard.board === 'helpers' && names.indexOf('Giúp nhiều') < names.indexOf('Giúp vừa') && names.indexOf('Giúp vừa') < names.indexOf('Giúp ít'), 'The helpers board ranks by help actions');
check(helpersBoard.top.find((x) => x.name === 'Giúp nhiều')!.value === 5, 'Board entries carry their count');
const shippersBoard = S.leaderboard('shippers', t0);
check(shippersBoard.top[0].name === 'Giao nhiều' && shippersBoard.top[0].value === 100, 'The shippers board ranks by deliveries sent');
check(!shippersBoard.top.some((x) => x.name === 'Giúp nhiều'), 'Players with zero count are not listed');
famous.fame = 77;
const fameBoard = S.leaderboard('fame', t0);
check(fameBoard.board === 'fame' && fameBoard.top[0].name === 'Nổi tiếng' && (fameBoard.top[0] as { fame: number }).fame === 77, 'The fame board keeps the old fields');
check(S.leaderboard('nonsense', t0).board === 'fame' && S.leaderboard(undefined, t0).board === 'fame', 'The default board is fame');
h3.banned = true;
check(!S.leaderboard('helpers', t0).top.some((x) => x.name === 'Giúp ít'), 'Banned players are not listed');
h3.banned = false;

// Rollover: new season, reset counters, titles and decorations
const before = S.seasonView(racer, t0);
const after = S.seasonView(racer, nextSeason);
check(before.index === 20 && after.index === 21 && after.sp === 0 && after.tiers.every((t) => !t.claimed), 'A new season resets points and track claims');
check(after.goal.progress === 0 && after.goal.milestones.every((m) => !m.claimed) && !after.goal.eligible, 'A new season starts a new goal');
check(racer.decorations.includes('season_20_tier_10') && racer.titles.includes('Mùa 20: Ngôi sao của mùa'), 'Claimed titles and decorations stay');
check(S.seasonView(h1, nextSeason).sp === 0, 'Another player resets lazily too');

// End-of-season awards (fame board, helpers board, shippers board)
const f1 = player('Hạng nhất', 6), f2 = player('Hạng nhì', 6), f3 = player('Hạng ba', 6), f4 = player('Hạng tư', 6), f5 = player('Không nổi', 6);
f1.fame = 500; f2.fame = 400; f3.fame = 300; f4.fame = 200; f5.fame = 0;
S.seasonEvent(f1, 'deliver', 90, t0);
S.seasonEvent(f2, 'deliver', 80, t0);
S.seasonEvent(h1, 'sell', 1, nextSeason); // h1 already moved on to season 21 before the rollover runs
W.setSeasonForTest(20);
check(W.rolloverSeason(nextSeason) === true, 'The season rolls over');
check(f1.titles.includes('Mùa 20: hạng 1') && f2.titles.includes('Mùa 20: hạng 2'), 'The old fame rank titles are still given');
check(f1.decorations.includes('gold_sign_20') && f2.decorations.includes('gold_sign_20') && f3.decorations.includes('gold_sign_20'), 'The top 3 of the fame board get a gold sign');
check(!f4.decorations.includes('gold_sign_20') && !f5.decorations.includes('gold_sign_20'), 'Other streets get no gold sign');
// The earlier helper player also has 3 help actions, so h2 and h3 land on ranks 2-3 and 4
const rankOf = (p: { titles: string[] }, board: string) => Number(p.titles.find((t) => t.startsWith(`Mùa 20: ${board} hạng `))?.split('hạng ')[1] ?? 0);
// Other test players can tie on counts, so only the order between these three is fixed (5, 3 and 1 helps)
check(rankOf(h1, 'Người giúp xóm') >= 1 && rankOf(h1, 'Người giúp xóm') < rankOf(h2, 'Người giúp xóm') && rankOf(h2, 'Người giúp xóm') < rankOf(h3, 'Người giúp xóm'),
  'The helpers board gives rank titles, even to a player whose counters had already moved to the new season');
check(s1.titles.includes('Mùa 20: Tay giao hàng hạng 1') && f1.titles.includes('Mùa 20: Tay giao hàng hạng 2') && f2.titles.includes('Mùa 20: Tay giao hàng hạng 3'),
  'The shippers board gives rank titles');
check(!f3.titles.some((t) => t.includes('Tay giao hàng')) && !f5.titles.some((t) => t.includes('Người giúp xóm')), 'Players with a zero count get no board title');
check(f1.fame === 0 && f3.fame === 0, 'Fame is reset at rollover');
check(W.rolloverSeason(nextSeason) === false, 'Rolling over twice in one season does nothing');
check(S.leaderboard('helpers', nextSeason).top.every((x) => x.name !== 'Giúp vừa'), 'The new season starts with empty boards');

// Season points never reach other profile data
check(getProfile(hero.id) === hero, 'Profiles stay the same objects');
const privateView = P.privateProfile(hero, 3, 20) as unknown as { season?: { sp: number } };
check(privateView.season !== undefined, 'The season state travels with the private profile');

P.flushNow();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll season checks passed');
process.exit(failures ? 1 : 0);

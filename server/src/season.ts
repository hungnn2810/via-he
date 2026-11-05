// Seasons: a free reward track (season points), weekly quests, a server-wide season goal and three leaderboards.
// Rewards are cosmetic or small money only; none gives a gameplay or ranking advantage, points cannot be bought,
// nobody is punished for being away, and everything that could be farmed with throwaway accounts has a level gate or a daily cap.
// One entry point, seasonEvent(), is called from the few places where something countable happens.
// Every function takes `now` so tests can run on a fake clock.
import { SEASON_DAYS } from './data.js';
import { GameError, allProfiles, gameDb, markDirty, type Profile } from './profile.js';
import { seasonIndex } from './world.js';
import { weekIndex } from './events.js';

const DAY = 86_400_000;

// All numbers are provisional
export const SEASON = {
  goalLevel: 2,            // minimum level for a sale to count towards the server goal (and to claim from it)
  weeklyLevel: 3,          // weekly quests unlock at this level
  weeklyCount: 3,          // quests per week
  weeklySp: 20,            // season points per finished quest
  weeklyMoney: 50_000,     // paid once per finished quest
  weeklyBonusSp: 20,       // extra points for finishing every quest of the week
  tiers: 10,
  spPerTier: 40,
  famePerSp: 5,            // 1 season point per 5 fame gained, within the daily fame caps
  boardTitleRanks: 10,     // top N of each board get a title at the end of the season
  goldSigns: 3,            // top N of the fame board get the gold sign decoration
};

export const SEASON_GOAL = {
  target: 200_000,         // portions sold by every player together
  milestones: [
    { pct: 25, money: 20_000 },
    { pct: 50, money: 20_000 },
    { pct: 75, money: 20_000 },
    { pct: 100, money: 20_000, decoration: true },
  ],
};

// Player-facing theme names, chosen by season index
export const SEASON_THEMES = ['Mùa chuối chín', 'Mùa phố hội', 'Mùa hàng xóm', 'Mùa chợ đêm', 'Mùa mưa phùn', 'Mùa lễ hội'];
export const seasonTheme = (index: number) => SEASON_THEMES[((index % SEASON_THEMES.length) + SEASON_THEMES.length) % SEASON_THEMES.length];
export const seasonEndsAt = (index: number) => (index + 1) * SEASON_DAYS * DAY;

export type SeasonKind = 'sell' | 'help' | 'deliver' | 'cook' | 'cafe' | 'shared' | 'fame';
export type BoardId = 'fame' | 'helpers' | 'shippers';

export const BOARDS: Record<BoardId, { name: string; stat?: 'helps' | 'deliveries' }> = {
  fame: { name: 'Nổi tiếng' },
  helpers: { name: 'Người giúp xóm', stat: 'helps' },
  shippers: { name: 'Tay giao hàng', stat: 'deliveries' },
};

// ---------- Weekly quests ----------

interface QuestDef {
  id: Exclude<SeasonKind, 'fame'>;
  target: number;
  distinct: boolean;                 // counts different streets, not actions
  text: (n: number) => string;       // player-facing
}

export const WEEKLY_POOL: QuestDef[] = [
  { id: 'sell', target: 60, distinct: false, text: (n) => `Bán ${n} phần hàng` },
  { id: 'help', target: 5, distinct: true, text: (n) => `Giúp ${n} phố khác nhau` },
  { id: 'deliver', target: 5, distinct: false, text: (n) => `Gửi ${n} đơn giao hàng` },
  { id: 'cook', target: 4, distinct: false, text: (n) => `Nấu ${n} mẻ món ăn` },
  { id: 'cafe', target: 3, distinct: true, text: (n) => `Ngồi quán cà phê ở ${n} phố khác nhau` },
  { id: 'shared', target: 20, distinct: false, text: (n) => `Góp ${n} phần vào đơn lớn chung` },
];

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// The same player gets the same quests for a whole week, and different players get different mixes
export function pickWeeklyQuests(week: number, playerId: string): QuestDef[] {
  return WEEKLY_POOL
    .map((q) => ({ q, order: hash(`weekly:${week}:${playerId}:${q.id}`) }))
    .sort((a, b) => a.order - b.order || a.q.id.localeCompare(b.q.id))
    .slice(0, SEASON.weeklyCount)
    .map((x) => x.q);
}

// ---------- Season track ----------

interface TrackReward { money?: number; title?: string; decoration?: boolean }

export const TRACK_REWARDS: TrackReward[] = [
  { money: 10_000 },
  { title: 'Người bán chăm chỉ' },
  { money: 15_000 },
  { decoration: true },
  { money: 20_000 },
  { title: 'Hàng xóm thân thiện' },
  { money: 25_000 },
  { decoration: true },
  { money: 30_000 },
  { title: 'Ngôi sao của mùa', decoration: true },
];

export const trackDecorationId = (season: number, tier: number) => `season_${season}_tier_${tier}`;
export const goalDecorationId = (season: number) => `season_goal_${season}`;

function trackReward(season: number, tier: number) {
  const r = TRACK_REWARDS[tier - 1];
  return {
    money: r.money ?? 0,
    title: r.title ? `Mùa ${season}: ${r.title}` : '',
    decoration: r.decoration ? trackDecorationId(season, tier) : '',
  };
}

// ---------- State on the profile ----------

export interface WeeklyQuest { id: string; progress: number; target: number; done: boolean; streets: string[] }

export interface SeasonState {
  index: number;            // the season these counters belong to; they reset lazily when a new season starts
  sp: number;
  fameCarry: number;        // fame gained towards the next season point
  tiersClaimed: number[];
  goalClaimed: number;      // milestones already paid (they are paid in order)
  sold: number;
  helps: number;
  deliveries: number;
  last: { index: number; helps: number; deliveries: number } | null; // the finished season, for the end-of-season boards
  weekly: { week: number; quests: WeeklyQuest[]; bonus: boolean } | null; // weeks do not reset with seasons
}

const emptyState = (index: number): SeasonState => ({
  index, sp: 0, fameCarry: 0, tiersClaimed: [], goalClaimed: 0, sold: 0, helps: 0, deliveries: 0, last: null, weekly: null,
});

function stateOf(profile: Profile, now: number): SeasonState {
  const index = seasonIndex(now);
  let s = profile.season;
  if (!s) s = profile.season = emptyState(index);
  if (s.index !== index) {
    const last = s.index < index ? { index: s.index, helps: s.helps, deliveries: s.deliveries } : s.last;
    Object.assign(s, { ...emptyState(index), weekly: s.weekly, last });
  }
  return s;
}

// Points a finished season left behind: the live counters, or the snapshot taken when the next season started
function statOf(profile: Profile, index: number, stat: 'helps' | 'deliveries') {
  const s = profile.season;
  if (!s) return 0;
  if (s.index === index) return s[stat];
  return s.last?.index === index ? s.last[stat] : 0;
}

// ---------- Server-wide goal ----------

gameDb.exec('CREATE TABLE IF NOT EXISTS season_goal (season INTEGER PRIMARY KEY, progress INTEGER)');
const qGoal = gameDb.prepare('SELECT progress FROM season_goal WHERE season = ?');
const qGoalAdd = gameDb.prepare('INSERT INTO season_goal (season, progress) VALUES (?, ?) ON CONFLICT(season) DO UPDATE SET progress = progress + excluded.progress');

export const seasonGoalProgress = (season: number) => (qGoal.get(season) as { progress: number } | undefined)?.progress ?? 0;
const milestoneAt = (i: number) => Math.round(SEASON_GOAL.target * SEASON_GOAL.milestones[i].pct / 100);
const milestonesReached = (progress: number) => SEASON_GOAL.milestones.filter((_, i) => progress >= milestoneAt(i)).length;

// ---------- Counting ----------

function addSp(s: SeasonState, points: number) {
  s.sp += points;
}

export interface QuestDone { id: string; text: string; sp: number; money: number; bonusSp: number }

function weeklyOf(profile: Profile, s: SeasonState, now: number) {
  if (profile.level < SEASON.weeklyLevel) return null;
  const week = weekIndex(now);
  if (!s.weekly || s.weekly.week !== week) {
    s.weekly = {
      week, bonus: false,
      quests: pickWeeklyQuests(week, profile.id).map((q) => ({ id: q.id, progress: 0, target: q.target, done: false, streets: [] })),
    };
  }
  return s.weekly;
}

const questDef = (id: string) => WEEKLY_POOL.find((q) => q.id === id)!;

// The one entry point. `key` names the street for kinds that count different streets (help, cafe).
// Returns the weekly quests this call finished; their rewards are already paid.
export function seasonEvent(profile: Profile, kind: SeasonKind, amount = 1, now = Date.now(), key = ''): QuestDone[] {
  amount = Math.floor(amount);
  if (profile.isNpc || profile.banned || !(amount > 0)) return [];
  const s = stateOf(profile, now);
  if (kind === 'fame') {
    s.fameCarry += amount;
    const points = Math.floor(s.fameCarry / SEASON.famePerSp);
    s.fameCarry -= points * SEASON.famePerSp;
    addSp(s, points);
    return [];
  }
  if (profile.level < SEASON.goalLevel) return [];
  if (kind === 'sell') { s.sold += amount; qGoalAdd.run(s.index, amount); }
  else if (kind === 'help') s.helps += amount;
  else if (kind === 'deliver') s.deliveries += amount;
  markDirty(profile);

  const weekly = weeklyOf(profile, s, now);
  const quest = weekly?.quests.find((q) => q.id === kind && !q.done);
  if (!weekly || !quest) return [];
  if (questDef(kind).distinct) {
    if (!key || quest.streets.includes(key)) return [];
    quest.streets.push(key);
    quest.progress = quest.streets.length;
  } else {
    quest.progress = Math.min(quest.target, quest.progress + amount);
  }
  if (quest.progress < quest.target) return [];
  quest.done = true;
  profile.money += SEASON.weeklyMoney;
  addSp(s, SEASON.weeklySp);
  let bonusSp = 0;
  if (!weekly.bonus && weekly.quests.every((q) => q.done)) {
    weekly.bonus = true;
    bonusSp = SEASON.weeklyBonusSp;
    addSp(s, bonusSp);
  }
  return [{ id: quest.id, text: questDef(quest.id).text(quest.target), sp: SEASON.weeklySp, money: SEASON.weeklyMoney, bonusSp }];
}

// ---------- Claims ----------

function addUnique(list: string[], item: string) {
  if (!list.includes(item)) list.push(item);
}

export function claimSeasonTier(profile: Profile, tier: unknown, now = Date.now()) {
  const s = stateOf(profile, now);
  if (!Number.isInteger(tier) || (tier as number) < 1 || (tier as number) > SEASON.tiers) throw new GameError('Mốc thưởng không hợp lệ');
  const t = tier as number;
  if (s.tiersClaimed.includes(t)) throw new GameError('Bạn đã nhận phần thưởng này rồi');
  if (s.sp < t * SEASON.spPerTier) throw new GameError('Chưa đủ điểm mùa để nhận mốc này');
  const reward = trackReward(s.index, t);
  s.tiersClaimed.push(t);
  profile.money += reward.money;
  if (reward.title) addUnique(profile.titles, reward.title);
  if (reward.decoration) addUnique(profile.decorations, reward.decoration);
  markDirty(profile);
  return seasonView(profile, now);
}

// Pays every milestone reached since the last claim; each one is paid once
export function claimSeasonGoal(profile: Profile, now = Date.now()) {
  const s = stateOf(profile, now);
  if (profile.level < SEASON.goalLevel) throw new GameError(`Cần cấp ${SEASON.goalLevel} để nhận quà mục tiêu mùa`);
  if (s.sold < 1) throw new GameError('Hãy bán ít nhất 1 phần hàng trong mùa này để nhận quà');
  const reached = milestonesReached(seasonGoalProgress(s.index));
  if (reached <= s.goalClaimed) throw new GameError('Chưa có phần thưởng mới');
  for (let i = s.goalClaimed; i < reached; i++) {
    const m = SEASON_GOAL.milestones[i];
    profile.money += m.money;
    if ('decoration' in m && m.decoration) addUnique(profile.decorations, goalDecorationId(s.index));
  }
  s.goalClaimed = reached;
  markDirty(profile);
  return seasonView(profile, now);
}

// ---------- View ----------

export function seasonView(profile: Profile, now = Date.now()) {
  const s = stateOf(profile, now);
  const progress = seasonGoalProgress(s.index);
  const weekly = weeklyOf(profile, s, now);
  return {
    index: s.index,
    theme: seasonTheme(s.index),
    endsAt: seasonEndsAt(s.index),
    sp: s.sp,
    tiers: Array.from({ length: SEASON.tiers }, (_, i) => ({
      tier: i + 1, sp: (i + 1) * SEASON.spPerTier, reward: trackReward(s.index, i + 1), claimed: s.tiersClaimed.includes(i + 1),
    })),
    goal: {
      progress, target: SEASON_GOAL.target, sold: s.sold, eligible: profile.level >= SEASON.goalLevel && s.sold >= 1,
      milestones: SEASON_GOAL.milestones.map((m, i) => ({
        at: milestoneAt(i), reached: progress >= milestoneAt(i), claimed: s.goalClaimed > i, money: m.money,
        decoration: 'decoration' in m && m.decoration ? goalDecorationId(s.index) : '',
      })),
    },
    weekly: (weekly?.quests ?? []).map((q) => ({ id: q.id, text: questDef(q.id).text(q.target), progress: q.progress, target: q.target, done: q.done })),
    weeklyBonusClaimed: weekly?.bonus ?? false,
    weeklyReward: { sp: SEASON.weeklySp, money: SEASON.weeklyMoney, bonusSp: SEASON.weeklyBonusSp },
    weeklyLevel: SEASON.weeklyLevel,
    goalLevel: SEASON.goalLevel,
  };
}

// ---------- Leaderboards ----------

export const isBoard = (id: unknown): id is BoardId => typeof id === 'string' && Object.hasOwn(BOARDS, id);

export function leaderboard(board: unknown, now = Date.now(), limit = 50) {
  const id: BoardId = isBoard(board) ? board : 'fame';
  const index = seasonIndex(now);
  const stat = BOARDS[id].stat;
  const players = allProfiles().filter((p) => !p.isNpc && !p.banned);
  const top = players
    .map((p) => ({ p, value: stat ? statOf(p, index, stat) : p.fame }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit)
    .map(({ p, value }) => (stat
      ? { ownerId: p.id, name: p.name, level: p.level, value }
      : { ownerId: p.id, name: p.name, level: p.level, fame: p.fame, value }));
  return { board: id, top };
}

// Called when a season ends, before fame is reset. `byFame` is every real player, most famous first.
// The fame board's rank titles stay as they were (see rolloverSeason); this adds the gold signs and the other boards' titles.
export function awardSeasonBoards(finished: number, byFame: Profile[]) {
  const players = byFame.filter((p) => !p.isNpc && !p.banned);
  players.filter((p) => p.fame > 0).slice(0, SEASON.goldSigns).forEach((p) => addUnique(p.decorations, `gold_sign_${finished}`));
  for (const id of ['helpers', 'shippers'] as const) {
    const stat = BOARDS[id].stat!;
    players
      .map((p) => ({ p, value: statOf(p, finished, stat) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, SEASON.boardTitleRanks)
      .forEach(({ p }, rank) => { addUnique(p.titles, `Mùa ${finished}: ${BOARDS[id].name} hạng ${rank + 1}`); markDirty(p); });
  }
}

// One room = one player's street (that player is the owner). Anyone can visit someone else's street
// to co-sell from a stall there; the owner collects a sidewalk fee on every portion sold and the street gains fame.
import { Room, type Client } from '@colyseus/core';
import { randomUUID } from 'node:crypto';
import { StreetState, Player, Stall, Customer, LotState } from '../schema.js';
import {
  BALANCE, BUILDINGS, CROPS, CUSTOMER_GROUPS, DAILY_TASKS, DECORATIONS, DISTRICTS, FAME, LOOK_OPTIONS, MAX_DISTRICTS, MEETING_CHOICES, NPC_STREETS,
  ORDER_KINDS, PRODUCTS, PROFESSIONS, PUBLIC_DISTRICTS, RECIPES, TOURIST, VEHICLES, getProduct, getPublicDistrict, groupOfProduct, WEARABLES, WEAR_SLOTS, type BuildingType, type WearSlot,
} from '../data.js';
import {
  addFame, addFriend, addProfessionWork, awardFinishedBuildings, build, buyDecoration, buyDistrict, buyVehicle, chooseProfession,
  claimCommunity, clearCrop, collectCooking, collectDeliveries, collectIncome, cook, dayIndex, demolish, donateBananas, footTraffic, giveGift,
  harvestCrop, hasBuilding, helpWater, maxEmployees, payWages, plantCrop, professionHelp, progressTask, recordStreetSales, recordVisit, tendNpcGarden,
  refreshDaily, refreshOrders, removeFriend, sendDelivery, storeCapacity, takeFromStore, traderBonusPct, upgrade, useVehicle, waterCrop,
} from '../world.js';
import { meetingOpen, mergeRules, pickStreetEvent, scheduledEvent, seasonalEvent, weekIndex, type GameEvent } from '../events.js';
import { currentWeather, dayClock } from '../weather.js';
import { NEIGHBOURS, finishQuest, giveNeighbourGift, questEvent } from '../stories.js';
import { emptyBoard, hasFive, npcMove, placeMark, shuttleReward } from '../activities.js';
import { FORTUNES, checkEmote, drawFortune, fortuneView, fortuneXp, shareFortune } from '../fortune.js';
import { CafeSeats, regenStamina } from '../cafe.js';
import { IncidentManager } from '../incidents.js';
import {
  markSeen, maybeRecruit, pickAppearingRegular, recordRegularSale, regularById, regularLook, regularSaleView, regularWants, regularsView,
  rollSecondPortion, tierBonusPct,
} from '../regulars.js';
import {
  type Appearance, type Profile, type Outfit, GameError, addLogEntry, addReport, addXp, advanceTutorial, buyWearable, castVote, changeLook,
  claimPlayerOrder, communityProgress, createCharacter, fireEmployee, getProfile, hireEmployee, listPlayerOrders, markDirty, outfitBonus,
  postPlayerOrder, privateProfile, randomLook, takeOff, track, verifyToken, wear,
} from '../profile.js';
import {
  buyWholesale, claimSharedOrder, contributeSharedOrder, marketPrices, refundStall, settleDebt, sharedOrderView, stockStall, type StallStock,
} from '../market.js';
import { claimSeasonGoal, claimSeasonTier, seasonEvent, seasonView, type SeasonKind } from '../season.js';

type Auth = { id: string };
type StreetClient = Client<{ auth: Auth }>;

// Which room each online player is in (a player is on one street at a time)
const online = new Map<string, { room: StreetRoom; client: StreetClient }>();
// Employees currently running a stall (on any street): employee id → room id
const employeesAtWork = new Map<string, string>();

// Vietnamese profanity filter (player content, so the words stay Vietnamese)
const BANNED_WORDS = ['đm', 'dm', 'đmm', 'vcl', 'vl', 'vkl', 'clm', 'địt', 'dit', 'lồn', 'cặc', 'buồi', 'đéo', 'đĩ', 'cứt'];
const filterWords = (s: string) => s.split(/(\s+)/).map((w) => (BANNED_WORDS.includes(w.toLowerCase()) ? '***' : w)).join('');

const CUSTOMER_SPEED = 90;
const MAX_WAIT_SECONDS = 8;

function postPlayerOrderBack(order: { buyer: string; price: number }) {
  // The seller could not deliver: the buyer gets the held money back rather than losing it
  const buyer = getProfile(order.buyer);
  if (buyer) { buyer.money += order.price; markDirty(buyer); }
}

export class StreetRoom extends Room<{ state: StreetState }> {
  state = new StreetState();
  maxClients = 30;
  autoDispose = false;

  private owner!: Profile;
  private district = 0;
  private shard = 0;
  private publicDef: ReturnType<typeof getPublicDistrict>; // set when this room is a server-owned public district
  private passedStalls = new Map<string, Set<number>>(); // customer → slots already passed (each stall gets one try)
  private waitingSince = new Map<string, number>();      // customer → when it started waiting at a stall
  private pendingProfiles = new Set<string>();
  private staminaTimer = 0;
  private closeCheckTimer = 0;
  private syncTimer = 0;
  private streetEvent: GameEvent | null = null;
  private streetEventEndsAt = 0;
  private nextStreetEventAt = 0;
  private orderProgress = new Map<string, number>(); // player → portions sold during a shipper order
  private stallStock = new Map<number, StallStock>();  // slot → how the stall's stock was obtained (see market.ts)
  private cafe!: CafeSeats;
  private incidents!: IncidentManager;
  private secondPortions = new Set<string>();      // regulars who already got their second portion this visit

  private get isPublic() { return !!this.publicDef; }

  onCreate(options: { ownerId?: string; district?: number; shard?: number }) {
    const owner = options.ownerId && getProfile(options.ownerId);
    if (!owner) throw new Error('Street does not exist');
    const district = Number(options.district) || 0;
    if (!owner.districts[district] || district >= MAX_DISTRICTS) throw new Error('District does not exist');
    this.owner = owner;
    this.district = district;
    this.publicDef = getPublicDistrict(owner.id);
    this.shard = this.publicDef ? Math.max(0, Math.floor(Number(options.shard)) || 0) : 0;
    this.cafe = new CafeSeats(district);
    this.state.district = district;
    this.state.districtName = this.publicDef ? this.publicDef.name : DISTRICTS[district].name;
    this.state.isPublic = this.isPublic;
    this.state.shard = this.shard;
    this.state.ownerId = owner.id;
    this.state.ownerName = owner.name;
    this.state.ownerLevel = owner.level;
    this.state.length = BALANCE.streetLength;
    this.state.slotCount = this.isPublic ? BALANCE.publicSlots : BALANCE.slotsPerStreet;
    this.state.ownerSlots = this.isPublic ? 0 : BALANCE.ownerSlots;
    this.nextStreetEventAt = Date.now() + BALANCE.streetEventEverySeconds * 1000 * (0.5 + Math.random());
    this.incidents = new IncidentManager({
      owner,
      present: () => [...this.state.players.values()].map((p) => getProfile(p.id)).filter((p): p is Profile => !!p),
      ownerHasOpenStall: () => [...this.state.stalls.values()].some((s) => s.ownerId === owner.id && !s.employeeId),
      send: (id, type, payload) => { const o = online.get(id); if (o?.room === this) o.client.send(type, payload); },
      broadcast: (type, payload) => this.broadcast(type, payload),
      changed: (p) => { markDirty(p); this.sendProfile(p.id); },
    });
    const npcStreet = owner.isNpc && !this.isPublic;
    if (npcStreet) tendNpcGarden(owner);
    this.syncStreet();
    this.updateMetadata();
    if (npcStreet) this.openNpcStalls();

    this.onMessage('move', (c: StreetClient, m: { x: number }) => {
      const p = this.state.players.get(c.sessionId);
      if (p && Number.isFinite(m?.x)) p.targetX = Math.max(0, Math.min(this.state.length, m.x));
    });
    this.onMessage('say', (c: StreetClient, m: { text: string }) => {
      const p = this.state.players.get(c.sessionId);
      if (!p || typeof m?.text !== 'string') return;
      p.speech = filterWords(m.text.trim().slice(0, 80));
      p.speechAt = Date.now();
    });

    this.handle('sitCafe', (pr, c, m: { district: number; lot: number }) => {
      this.cafe.sit(this.owner, pr, this.district, m.district, m.lot);
      this.trackSeason(pr, 'cafe', 1, this.owner.id);
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
      this.broadcast('cafeSeats', this.cafe.view());
    });
    this.handle('leaveCafe', (_pr, c) => { if (this.cafe.leave(c.auth!.id)) this.broadcast('cafeSeats', this.cafe.view()); });

    this.handle('openStall', (pr, c, m: { slot: number; productId: string; quantity: number; employeeId?: string }) => this.openStall(pr, c, m));
    this.handle('closeStall', (pr, _c, m: { slot: number }) => this.closeStall(m.slot, pr.id));
    this.handle('inviteCustomer', (pr, c, m: { customerId: string }) => this.inviteCustomer(pr, c, m.customerId));
    this.handle('createCharacter', (pr, c, m: Partial<Appearance>) => {
      createCharacter(pr, m);
      const p = this.state.players.get(c.sessionId);
      if (p) p.look = this.lookString(pr);
    });
    this.handle('plant', (pr, _c, m: { lot: number; crop: string }) => { this.requireOwnStreet(pr); plantCrop(pr, this.district, m.lot, m.crop || 'banana'); track(pr.id, 'plant'); });
    this.handle('water', (pr, _c, m: { lot: number }) => {
      if (pr.id === this.owner.id) { waterCrop(pr, this.district, m.lot); return; }
      helpWater(pr, this.owner, this.district, m.lot);
      questEvent(pr, 'help', '');
      this.trackSeason(pr, 'help', 1, this.owner.id);
      addLogEntry(this.owner, { type: 'help', who: pr.name, amount: BALANCE.helpReward });
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
      track(pr.id, 'help');
    });
    this.handle('harvest', (pr, _c, m: { lot: number }) => {
      this.requireOwnStreet(pr);
      const crop = harvestCrop(pr, this.district, m.lot);
      questEvent(pr, 'harvest', crop);
      this.grantXp(pr, BALANCE.harvestXp + progressTask(pr, 'harvest'));
      track(pr.id, 'harvest');
    });
    this.handle('clearCrop', (pr, _c, m: { lot: number }) => { this.requireOwnStreet(pr); clearCrop(pr, this.district, m.lot); });
    this.handle('build', (pr, _c, m: { lot: number; type: BuildingType }) => {
      this.requireOwnStreet(pr);
      build(pr, this.district, m.lot, m.type);
      questEvent(pr, 'build', m.type);
      this.grantXp(pr, BALANCE.buildXp);
      track(pr.id, 'build');
    });
    this.handle('upgradeLot', (pr, _c, m: { lot: number }) => { this.requireOwnStreet(pr); upgrade(pr, this.district, m.lot); });
    this.handle('demolish', (pr, _c, m: { lot: number }) => { this.requireOwnStreet(pr); demolish(pr, this.district, m.lot); });
    this.handle('collectIncome', (pr, c) => {
      this.requireOwnStreet(pr);
      c.send('income', { amount: collectIncome(pr) });
    });
    this.handle('buyDistrict', (pr) => { buyDistrict(pr); track(pr.id, 'district', pr.districts.length); });
    this.handle('cook', (pr, _c, m: { lot: number; recipe: string }) => { this.requireOwnStreet(pr); cook(pr, this.district, m.lot, m.recipe); });
    this.handle('collectCooking', (pr, _c, m: { lot: number }) => {
      this.requireOwnStreet(pr);
      const item = collectCooking(pr, this.district, m.lot);
      questEvent(pr, 'cook', item);
      this.trackSeason(pr, 'cook');
      this.grantXp(pr, 10);
      track(pr.id, 'cook');
    });
    this.handle('chooseProfession', (pr, _c, m: { id: string }) => chooseProfession(pr, m.id));
    this.handle('professionHelp', (pr) => {
      professionHelp(pr, this.owner, this.district);
      questEvent(pr, 'help', '');
      this.trackSeason(pr, 'help', 1, this.owner.id);
      addLogEntry(this.owner, { type: 'help', who: pr.name, amount: 0 });
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
    });
    this.handle('finishQuest', (pr, _c, m: { id: string }) => this.grantXp(pr, finishQuest(pr, m.id, (item, n) => takeFromStore(pr, item, n))));
    this.handle('neighbourGift', (pr, _c, m: { id: string }) => giveNeighbourGift(pr, m.id, dayIndex(), (item, n) => takeFromStore(pr, item, n)));
    this.handle('buyVehicle', (pr, c, m: { id: string }) => { buyVehicle(pr, m.id); this.refreshVehicle(pr, c); });
    this.handle('useVehicle', (pr, c, m: { id: string }) => { useVehicle(pr, m.id); this.refreshVehicle(pr, c); });
    this.handle('sendDelivery', (pr, _c, m: { orderId: string }) => {
      const kind = sendDelivery(pr, m.orderId);
      questEvent(pr, 'deliver', kind);
      this.trackSeason(pr, 'deliver');
      track(pr.id, 'delivery');
    });
    this.handle('collectDeliveries', (pr, c) => c.send('income', { amount: collectDeliveries(pr).total }));
    this.handle('postOrder', (pr, _c, m: { item: string; quantity: number; price: number }) => {
      const product = getProduct(m.item);
      if (!product) throw new GameError('Không có món này');
      postPlayerOrder(pr, product.id, m.quantity, m.price, product.price);
    });
    this.handle('fulfilOrder', (pr, _c, m: { id: number }) => {
      const order = claimPlayerOrder(m.id, pr.id);
      try { takeFromStore(pr, order.item, order.quantity); }
      catch (e) { postPlayerOrderBack(order); throw e; }
      pr.money += order.price;
      const buyer = getProfile(order.buyer);
      if (buyer) { buyer.store[order.item] = (buyer.store[order.item] ?? 0) + order.quantity; markDirty(buyer); this.sendProfile(buyer.id); }
    });
    this.onMessage('playerOrders', () => listPlayerOrders());
    this.onMessage('marketPrices', () => marketPrices());
    this.handle('marketBuy', (pr, _c, m: { item: string; quantity: number; credit?: boolean }) => { buyWholesale(pr, m.item, m.quantity, !!m.credit); track(pr.id, 'market_buy', m.quantity); });
    this.handle('marketCredit', (pr, _c, m: { item: string; quantity: number }) => { buyWholesale(pr, m.item, m.quantity, true); track(pr.id, 'market_credit', m.quantity); });
    this.onMessage('sharedOrder', (c: StreetClient) => { const pr = c.auth && getProfile(c.auth.id); return pr ? sharedOrderView(pr) : null; });
    this.handle('contributeSharedOrder', (pr, c, m: { quantity: number }) => {
      const given = contributeSharedOrder(pr, m.quantity);
      this.trackSeason(pr, 'shared', given.quantity);
      c.send('sharedOrderGiven', given);
      track(pr.id, 'shared_order', m.quantity);
    });
    this.onMessage('season', (c: StreetClient) => { const pr = c.auth && getProfile(c.auth.id); return pr ? seasonView(pr) : null; });
    this.handle('claimSeasonGoal', (pr, c) => c.send('season', claimSeasonGoal(pr)));
    this.handle('claimSeasonTier', (pr, c, m: { tier: number }) => c.send('season', claimSeasonTier(pr, m.tier)));
    this.handle('claimSharedOrder', (pr, c) => c.send('sharedOrderClaimed', claimSharedOrder(pr)));
    this.handle('vote', (pr, _c, m: { choice: string }) => {
      if (!meetingOpen()) throw new GameError('Họp tổ dân phố vào tối Chủ nhật');
      if (!MEETING_CHOICES.some((x) => x.id === m.choice)) throw new GameError('Lựa chọn không hợp lệ');
      castVote(weekIndex(), pr.id, m.choice);
      pr.money += BALANCE.helpReward;
    });
    this.handle('startWedding', (pr) => {
      this.requireOwnStreet(pr);
      const now = Date.now();
      if (now - pr.lastWeddingAt < BALANCE.weddingCooldownDays * 86_400_000) throw new GameError('Mỗi tuần chỉ tổ chức một đám cưới');
      pr.lastWeddingAt = now;
      pr.wedding = { endsAt: now + 86_400_000, progress: 0, givers: [] };
    });
    this.handle('weddingGive', (pr, _c, m: { item: string; quantity: number }) => this.giveToWedding(pr, m.item, m.quantity));
    this.handle('shuttleStart', (pr) => this.startShuttle(pr));
    this.handle('shuttleKick', (pr) => this.kickShuttle(pr));
    this.handle('caroStart', (pr) => this.startCaro(pr));
    this.handle('caroMove', (pr, _c, m: { cell: number }) => this.moveCaro(pr, m.cell));
    this.handle('setGardener', (pr, _c, m: { employeeId: string }) => {
      if (m.employeeId && !pr.employees.some((e) => e.id === m.employeeId)) throw new GameError('Không có nhân viên này');
      pr.gardenerId = m.employeeId || '';
    });
    this.handle('changeLook', (pr, c, m: Partial<Appearance>) => {
      if (!hasBuilding(this.owner, this.district, 'barber')) throw new GameError('Phố này chưa có tiệm cắt tóc');
      if (pr.money < BALANCE.barberCost) throw new GameError('Không đủ tiền');
      changeLook(pr, m);
      pr.money -= BALANCE.barberCost;
      if (pr.id !== this.owner.id) { this.owner.money += BALANCE.barberCost; markDirty(this.owner); this.sendProfile(this.owner.id); }
      const p = this.state.players.get(c.sessionId);
      if (p) p.look = this.lookString(pr);
    });
    this.handle('buyDecoration', (pr, _c, m: { id: string }) => { this.requireOwnStreet(pr); buyDecoration(pr, m.id, this.activeRules()); });
    this.handle('giveGift', (pr) => {
      this.requirePlayerStreet();
      giveGift(pr, this.owner, this.activeRules());
      this.trackSeason(pr, 'help', 1, this.owner.id);
      addLogEntry(this.owner, { type: 'help', who: pr.name, amount: BALANCE.giftReward });
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
    });
    this.handle('donateBananas', (pr, _c, m: { quantity: number }) => {
      donateBananas(pr, seasonalEvent()?.id ?? '', this.activeRules(), m.quantity);
      track(pr.id, 'donate', m.quantity);
    });
    this.handle('claimCommunity', (pr) => claimCommunity(pr, seasonalEvent()?.id ?? '', this.activeRules()));
    this.handle('pauseStalls', (pr) => this.incidents.pauseStalls(pr));
    this.handle('joinCleanup', (pr) => this.incidents.joinCleanup(pr));
    this.handle('addFriend', (pr) => { this.requirePlayerStreet(); addFriend(pr, this.owner.id); });
    this.handle('removeFriend', (pr, _c, m: { friendId: string }) => removeFriend(pr, m.friendId));
    this.handle('report', (pr, _c, m: { targetId: string; reason: string }) => {
      addReport(pr.id, String(m.targetId || '').slice(0, 64), String(m.reason || '').slice(0, 200));
    });
    this.handle('tidyStreet', (pr) => {
      if (!this.state.event.split(',').includes('green_sunday')) throw new GameError('Chỉ dọn phố vào Chủ nhật xanh');
      if (pr.lastTidyDay === Math.floor(Date.now() / 86_400_000)) throw new GameError('Hôm nay bạn đã dọn phố rồi');
      pr.lastTidyDay = Math.floor(Date.now() / 86_400_000);
      addFame(this.owner, FAME.help);
      this.grantXp(pr, 10);
    });
    this.handle('buyWearable', (pr, _c, m: { wearableId: string }) => buyWearable(pr, m.wearableId));
    this.handle('wear', (pr, c, m: { wearableId: string; employeeId?: string }) => { wear(pr, m.wearableId, m.employeeId); this.refreshLooks(pr, c); });
    this.handle('takeOff', (pr, c, m: { slot: WearSlot; employeeId?: string }) => { takeOff(pr, m.slot, m.employeeId); this.refreshLooks(pr, c); });
    this.handle('hire', (pr, _c, m: { candidateId: string }) => hireEmployee(pr, m.candidateId, maxEmployees(pr)));
    this.handle('fire', (pr, _c, m: { employeeId: string }) => {
      if (employeesAtWork.has(m.employeeId)) throw new GameError('Nhân viên đang đứng sạp, dọn sạp trước đã');
      fireEmployee(pr, m.employeeId);
    });
    this.handle('drawFortune', (pr, c) => { c.send('fortune', drawFortune(pr)); });
    this.handle('shareFortune', (pr, _c, m: { friendId: string }) => {
      const friend = getProfile(String(m.friendId ?? ''));
      shareFortune(pr, friend);
      markDirty(friend!);
      this.sendProfile(friend!.id);
      online.get(friend!.id)?.client.send('fortuneShared', { from: pr.id, fromName: pr.name, fortune: fortuneView(friend!) });
    });
    this.handle('emote', (pr, _c, m: { targetId: string; kind: string }) => {
      const target = getProfile(String(m.targetId ?? ''));
      const { text } = checkEmote(pr, target, m.kind);
      online.get(target!.id)?.client.send('emote', { from: pr.id, fromName: pr.name, kind: m.kind, text });
    });
    this.onMessage('regulars', () => regularsView(this.owner, this.district));
    this.onMessage('catalog', () => ({ products: PRODUCTS, wearables: WEARABLES, balance: BALANCE, lookOptions: LOOK_OPTIONS, dailyTasks: DAILY_TASKS, decorations: DECORATIONS,
      districts: DISTRICTS, publicDistricts: PUBLIC_DISTRICTS, maxDistricts: MAX_DISTRICTS, meetingChoices: MEETING_CHOICES,
      crops: Object.entries(CROPS).map(([id, c]) => ({ id, ...c })),
      recipes: Object.entries(RECIPES).map(([id, r]) => ({ id, ...r, inputList: Object.entries(r.inputs).map(([item, amount]) => ({ item, amount })) })),
      professions: Object.entries(PROFESSIONS).map(([id, p]) => ({ id, ...p })),
      vehicles: Object.entries(VEHICLES).map(([id, v]) => ({ id, ...v })),
      orderKinds: Object.entries(ORDER_KINDS).map(([id, k]) => ({ id, ...k })),
      neighbours: NEIGHBOURS,
      fortunes: FORTUNES,
      buildings: Object.entries(BUILDINGS).map(([id, b]) => ({ id, ...b })) }));

    this.setSimulationInterval((dt) => this.tick(dt / 1000), 100);
  }

  // Handler wrapper: load the profile, send rule errors back to the client, mark the profile for saving + resending
  private handle<M>(type: string, fn: (profile: Profile, c: StreetClient, m: M) => void) {
    this.onMessage(type, (c: StreetClient, m: M) => {
      const profile = c.auth && getProfile(c.auth.id);
      if (!profile) return;
      try {
        fn(profile, c, (m ?? {}) as M);
        markDirty(profile);
        this.sendProfile(profile.id);
        this.syncStreet();
      } catch (e) {
        if (e instanceof GameError) c.send('error', { text: e.message });
        else throw e;
      }
    });
  }

  onAuth(_client: Client, options: { token?: string }) {
    const id = verifyToken(options?.token);
    const profile = id ? getProfile(id) : null;
    if (!id || !profile) throw new Error('Đăng nhập lại');
    if (profile.banned) throw new Error('Tài khoản đã bị khóa');
    return { id } satisfies Auth;
  }

  onJoin(client: StreetClient) {
    const profile = getProfile(client.auth!.id)!;
    // Logging in somewhere else kicks the old session
    const old = online.get(profile.id);
    if (old) old.client.leave(4000);
    online.set(profile.id, { room: this, client });

    const p = new Player();
    p.id = profile.id;
    p.name = profile.name;
    p.level = profile.level;
    p.x = p.targetX = 80 + Math.random() * 60; // gets off the bus at the start of the street
    p.outfit = this.outfitString(profile.outfit);
    p.look = this.lookString(profile);
    p.vehicle = profile.vehicle === 'walk' ? '' : profile.vehicle;
    p.isOwner = profile.id === this.owner.id;
    this.state.players.set(client.sessionId, p);

    payWages(profile);
    settleDebt(profile);
    refreshDaily(profile);
    refreshOrders(profile);
    track(profile.id, 'session');
    if (!p.isOwner && !this.isPublic) {
      addLogEntry(this.owner, { type: 'visit', who: profile.name, amount: 0 });
      recordVisit(this.owner, profile);
      questEvent(profile, 'visit', '');
      this.grantXp(profile, progressTask(profile, 'visit'));
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
      this.syncStreet();
    }
    markDirty(profile);
    client.send('profile', privateProfile(profile, maxEmployees(profile), storeCapacity(profile)));
    client.send('cafeSeats', this.cafe.view());
    this.incidents.sendCurrent(profile.id);
    this.updateMetadata();
  }

  onLeave(client: StreetClient) {
    const id = client.auth?.id;
    this.state.players.delete(client.sessionId);
    if (id && this.cafe.leave(id)) this.broadcast('cafeSeats', this.cafe.view());
    if (id && online.get(id)?.client === client) online.delete(id);
    // A stall the owner runs in person closes when they leave; stalls run by employees keep selling
    if (id) for (const s of [...this.state.stalls.values()]) if (s.ownerId === id && !s.employeeId) this.closeStall(s.slot, id);
    this.updateMetadata();
  }

  private disposing = false;
  onDispose() {
    this.disposing = true;
    for (const s of [...this.state.stalls.values()]) this.closeStall(s.slot, s.ownerId);
  }

  // ---------- Stalls ----------

  private slotX(slot: number) {
    const span = this.state.length - BALANCE.firstSlotX - BALANCE.lastSlotMargin;
    return BALANCE.firstSlotX + (slot * span) / (this.state.slotCount - 1);
  }

  private openStall(profile: Profile, c: StreetClient, m: { slot: number; productId: string; quantity: number; employeeId?: string }) {
    const slot = Math.floor(m.slot);
    if (!(slot >= 0 && slot < this.state.slotCount)) throw new GameError('Ô không hợp lệ');
    if (this.state.stalls.has(String(slot))) throw new GameError('Ô này đã có người dọn');
    if (slot < this.state.ownerSlots && profile.id !== this.owner.id) throw new GameError('Ô này của chủ phố');
    const product = getProduct(m.productId);
    if (!product) throw new GameError('Không có món này');
    if (profile.level < product.unlockLevel) throw new GameError(`Cần cấp ${product.unlockLevel} để bán ${product.name}`);
    if (product.seasonal && !this.activeRules().products?.includes(product.id)) throw new GameError('Món này chỉ bán trong dịp lễ');

    let sellerName = profile.name, outfit = profile.outfit, strength = profile.level * 2;
    if (m.employeeId) {
      const e = profile.employees.find((x) => x.id === m.employeeId);
      if (!e) throw new GameError('Không có nhân viên này');
      if (employeesAtWork.has(e.id)) throw new GameError(`${e.name} đang đứng sạp khác`);
      sellerName = e.name; outfit = e.outfit; strength = e.strength;
    } else {
      let sellingInPerson = false;
      this.state.stalls.forEach((s) => { if (s.ownerId === profile.id && !s.employeeId) sellingInPerson = true; });
      if (sellingInPerson) throw new GameError('Bạn đang đứng một sạp rồi, giao sạp mới cho nhân viên');
    }

    const capacity = BALANCE.baseStallCapacity + Math.floor(strength / 2);
    const quantity = Math.max(1, Math.min(capacity, Math.floor(m.quantity) || 0));
    let stock = quantity;
    let bought: StallStock | undefined;
    if (product.homegrown) {
      stock = Math.min(quantity, profile.store[product.id] ?? 0);
      if (stock < 1) throw new GameError(`Kho hết ${product.name}`);
      takeFromStore(profile, product.id, stock);
      advanceTutorial(profile, 4);
    } else {
      bought = stockStall(profile, product, quantity);
    }

    const s = new Stall();
    s.slot = slot;
    s.x = this.slotX(slot);
    s.productId = product.id;
    s.remaining = stock;
    s.price = product.price;
    s.ownerId = profile.id;
    s.ownerName = profile.name;
    s.employeeId = m.employeeId || '';
    s.sellerName = sellerName;
    s.sellerOutfit = this.outfitString(outfit);
    s.sellerLook = m.employeeId ? profile.employees.find((x) => x.id === m.employeeId)!.look : this.lookString(profile);
    this.state.stalls.set(String(slot), s);
    if (bought) this.stallStock.set(slot, bought);
    if (s.employeeId) employeesAtWork.set(s.employeeId, this.roomId);
    else {
      // selling in person: walk to the stall
      const p = this.state.players.get(c.sessionId);
      if (p) p.targetX = s.x;
    }
    this.updateMetadata();
  }

  // Close a stall: leftover stock is refunded at cost
  private closeStall(slot: number, byId: string) {
    const s = this.state.stalls.get(String(slot));
    if (!s) return;
    if (s.ownerId !== byId) throw new GameError('Không phải sạp của bạn');
    const profile = getProfile(s.ownerId);
    const product = getProduct(s.productId);
    if (profile && product && s.remaining > 0) {
      if (product.homegrown) profile.store[product.id] = (profile.store[product.id] ?? 0) + s.remaining;
      else refundStall(profile, product, s.remaining, this.stallStock.get(slot));
      markDirty(profile);
      this.sendProfile(profile.id);
    }
    this.stallStock.delete(slot);
    if (s.employeeId) employeesAtWork.delete(s.employeeId);
    this.state.customers.forEach((k) => { if (k.targetSlot === slot) this.customerMoveOn(k); });
    this.state.stalls.delete(String(slot));
    this.updateMetadata();
  }

  // Seller stats: Charm attracts customers, Skill sells faster
  private sellerStats(s: Stall) {
    const profile = getProfile(s.ownerId);
    if (profile?.isNpc) return { charm: 40, skill: 40, moneyPct: 0, xpPct: 0 };
    if (!profile) return { charm: 0, skill: 0, moneyPct: 0, xpPct: 0 };
    if (s.employeeId) {
      const e = profile.employees.find((x) => x.id === s.employeeId);
      if (e) {
        const b = outfitBonus(e.outfit);
        const charm = e.charm + b.charm + (e.trait === 'smooth' ? 15 : e.trait === 'gossip' ? 25 : 0);
        const skill = e.skill + (e.trait === 'quick' ? 40 : e.trait === 'gossip' ? -30 : 0);
        return { charm, skill, moneyPct: b.moneyPct, xpPct: b.xpPct };
      }
    }
    const b = outfitBonus(profile.outfit);
    return { charm: profile.level * 3 + b.charm, skill: profile.level * 3, moneyPct: b.moneyPct, xpPct: b.xpPct };
  }

  // A player invites a passing customer to their own stall (including one queuing at someone else's stall = poaching)
  private inviteCustomer(profile: Profile, c: StreetClient, customerId: string) {
    const k = this.state.customers.get(customerId);
    const p = this.state.players.get(c.sessionId);
    if (!k || !p || k.status === 'buy' || k.status === 'leave') throw new GameError('Khách đi mất rồi');
    if (Math.abs(k.x - p.x) > BALANCE.inviteRange) throw new GameError('Khách ở xa quá, lại gần hơn');
    if (profile.stamina < 1) throw new GameError('Hết sức rồi, nghỉ chút đã');
    const wants = k.wants.split(',');
    let best: Stall | null = null;
    this.state.stalls.forEach((s) => {
      if (s.ownerId !== profile.id || s.remaining < 1 || !wants.includes(s.productId) || s.slot === k.targetSlot) return;
      if (!best || Math.abs(s.x - k.x) < Math.abs(best.x - k.x)) best = s;
    });
    if (!best) throw new GameError('Sạp của bạn không có món khách này muốn');
    profile.stamina -= 1;
    k.targetSlot = (best as Stall).slot;
    k.status = 'queue';
    this.waitingSince.delete(k.id);
    this.broadcast('inviteCustomer', { playerId: profile.id, customerId: k.id });
  }

  // ---------- Game loop ----------

  private tick(dt: number) {
    const now = Date.now();
    const st = this.state;

    st.players.forEach((p) => {
      const d = p.targetX - p.x;
      const step = BALANCE.playerSpeed * (VEHICLES[p.vehicle]?.speedPct ?? 100) / 100 * dt;
      p.x = Math.abs(d) <= step ? p.targetX : p.x + Math.sign(d) * step;
      if (p.speech && now - p.speechAt > 5000) p.speech = '';
    });

    if (this.owner.isNpc && !this.isPublic && tendNpcGarden(this.owner, now)) this.syncStreet();
    this.runEvents(now);
    this.incidents.tick(now);
    this.spawnCustomer(dt * (this.activeRules().spawnFactor ?? 1) * this.trafficFactor());
    this.runActivities(now);

    for (const k of [...st.customers.values()]) {
      if (k.targetSlot >= 0) {
        const s = st.stalls.get(String(k.targetSlot));
        if (!s || s.remaining < 1) { this.customerMoveOn(k); continue; }
        const d = s.x - k.x;
        if (Math.abs(d) > 12) { k.x += Math.sign(d) * CUSTOMER_SPEED * 1.3 * dt; continue; }
        if (k.status === 'buy') continue;
        if (!s.servingCustomerId && !this.incidents.isPaused(s.ownerId, now)) {
          s.servingCustomerId = k.id;
          const product = getProduct(s.productId)!;
          s.saleEndsAt = now + product.sellSeconds * 1000 * Math.max(0.35, 1 - this.sellerStats(s).skill / 250);
          k.status = 'buy';
          this.waitingSince.delete(k.id);
        } else {
          if (!this.waitingSince.has(k.id)) this.waitingSince.set(k.id, now);
          if (now - this.waitingSince.get(k.id)! > MAX_WAIT_SECONDS * 1000) this.customerMoveOn(k);
        }
        continue;
      }

      k.x += k.dir * CUSTOMER_SPEED * dt;
      if (k.x < -50 || k.x > st.length + 50) { this.removeCustomer(k.id); continue; }
      if (k.status !== 'walk' || !k.wants) continue;
      // Passing a stall that sells something it wants, the customer may stop by
      const passed = this.passedStalls.get(k.id)!;
      const wants = k.wants.split(',');
      st.stalls.forEach((s) => {
        if (k.targetSlot >= 0 || passed.has(s.slot) || s.remaining < 1 || !wants.includes(s.productId) || this.incidents.isPaused(s.ownerId, now)) return;
        const ahead = (s.x - k.x) * k.dir;
        if (ahead < 0 || ahead > 60) return;
        passed.add(s.slot);
        if (Math.random() < 0.5 + Math.min(0.45, this.sellerStats(s).charm / 200)) {
          k.targetSlot = s.slot; k.status = 'queue';
        }
      });
    }

    for (const s of [...st.stalls.values()]) {
      if (s.servingCustomerId && now >= s.saleEndsAt) this.completeSale(s);
    }

    if (this.cafe.expire(this.owner, now)) this.broadcast('cafeSeats', this.cafe.view());

    this.staminaTimer += dt;
    if (this.staminaTimer >= BALANCE.staminaRegenSeconds) {
      this.staminaTimer = 0;
      st.players.forEach((p) => {
        const profile = getProfile(p.id);
        if (profile && profile.stamina < BALANCE.maxStamina) { profile.stamina = regenStamina(profile.stamina, this.cafe.isSeated(p.id)); markDirty(profile); this.sendProfile(profile.id); }
      });
    }

    this.syncTimer += dt;
    if (this.syncTimer >= 5) { this.syncTimer = 0; this.syncStreet(); }

    for (const id of this.pendingProfiles) {
      const o = online.get(id);
      const profile = getProfile(id);
      if (o && profile) o.client.send('profile', privateProfile(profile, maxEmployees(profile), storeCapacity(profile)));
    }
    this.pendingProfiles.clear();

    // Close the room when the street is empty and no employee stall is still selling
    this.closeCheckTimer += dt;
    if (this.closeCheckTimer >= 5) {
      this.closeCheckTimer = 0;
      if (this.clients.length === 0 && (st.stalls.size === 0 || (this.owner.isNpc && !this.isPublic))) this.disconnect();
    }
  }

  private spawnCustomer(dt: number) {
    const st = this.state;
    if (st.customers.size >= BALANCE.maxCustomers || Math.random() > dt / BALANCE.customerSpawnSeconds) return;
    const k = new Customer();
    k.id = randomUUID().slice(0, 8);
    k.dir = Math.random() < 0.5 ? 1 : -1;
    k.x = k.dir === 1 ? -30 : st.length + 30;
    k.look = Math.floor(Math.random() * 12);
    // Most customers want something already sold on the street, a few want something else (and just walk by).
    // A customer belongs to one group and only shops for that group's products.
    const onSale = [...new Set([...st.stalls.values()].map((s) => s.productId))];
    const rules = this.activeRules();
    const possible = PRODUCTS.filter((p) => p.unlockLevel <= Math.max(3, st.ownerLevel) && (!p.seasonal || rules.products?.includes(p.id))).map((p) => p.id);
    const pickFrom = (list: string[]) => list[Math.floor(Math.random() * list.length)];
    const boosted = (rules.boost ?? []).filter((id) => onSale.includes(id));
    const first = pickFrom(boosted.length && Math.random() < 0.6 ? boosted : onSale.length && Math.random() < 0.75 ? onSale : possible);
    const touristPct = this.publicDef ? this.publicDef.touristPct : DISTRICTS[this.district].touristPct ?? 0;
    const touristChance = rules.tourists ? 0.6 : Math.max(this.owner.fame >= FAME.touristsAt ? 0.1 : 0, touristPct / 100);
    k.group = Math.random() < touristChance ? TOURIST : groupOfProduct(first);
    const wants = new Set([first]);
    if (Math.random() < 0.35) {
      const sameGroup = possible.filter((id) => k.group === TOURIST || CUSTOMER_GROUPS[k.group].includes(id));
      if (sameGroup.length) wants.add(pickFrom(sameGroup));
    }
    k.wants = [...wants].join(',');
    if (k.group === TOURIST) k.touristLook = randomLook();
    this.applyRegular(k, possible);
    st.customers.set(k.id, k);
    this.passedStalls.set(k.id, new Set());
  }

  // Sometimes a regular of this street shows up instead of an anonymous customer
  private applyRegular(k: Customer, possible: string[]) {
    const busy = new Set([...this.state.customers.values()].map((c) => c.regularId).filter(Boolean));
    const regular = pickAppearingRegular(this.owner, this.district, busy);
    if (!regular) return;
    markSeen(this.owner, regular);
    k.regularId = regular.id;
    k.group = regular.group;
    k.touristLook = '';
    k.look = regularLook(regular);
    k.wants = regularWants(regular, possible).join(',');
  }

  private customerMoveOn(k: Customer) {
    const s = this.state.stalls.get(String(k.targetSlot));
    if (s?.servingCustomerId === k.id) s.servingCustomerId = '';
    this.passedStalls.get(k.id)?.add(k.targetSlot);
    k.targetSlot = -1;
    k.status = 'walk';
    this.waitingSince.delete(k.id);
  }

  private removeCustomer(id: string) {
    this.state.customers.delete(id);
    this.passedStalls.delete(id);
    this.waitingSince.delete(id);
    this.secondPortions.delete(id);
  }

  private completeSale(s: Stall) {
    const k = this.state.customers.get(s.servingCustomerId);
    s.servingCustomerId = '';
    const profile = getProfile(s.ownerId);
    const product = getProduct(s.productId);
    if (!profile || !product) return;

    const stats = this.sellerStats(s);
    const touristPct = k?.group === TOURIST ? BALANCE.touristPricePct / 100 : 1;
    const regular = k?.regularId ? regularById(this.owner, k.regularId) : undefined;
    const regularPct = regular ? tierBonusPct(regular.loyalty) : 0;
    const revenue = Math.round(s.price * touristPct * (1 + (stats.moneyPct + traderBonusPct(profile)) / 100) * (100 + regularPct) / 100);
    const isOwner = profile.id === this.owner.id;
    const feePct = this.activeRules().sidewalkFeePct ?? BALANCE.sidewalkFeePct;
    const fee = isOwner || this.isPublic ? 0 : Math.round(revenue * feePct / 100);
    s.remaining--;
    profile.money += revenue - fee;
    profile.totalSales += revenue;
    this.grantXp(profile, Math.round(product.xp * (1 + stats.xpPct / 100)) + progressTask(profile, 'sell'));
    recordStreetSales(this.owner, revenue);
    questEvent(profile, 'sell', product.id);
    this.trackSeason(profile, 'sell');
    addProfessionWork(profile, 'trader');
    this.state.fame = this.owner.fame;
    this.advanceOrder(profile);
    if (product.homegrown) advanceTutorial(profile, 5);
    markDirty(profile);
    this.sendProfile(profile.id);

    if (!isOwner && !this.isPublic) {
      this.owner.money += fee;
      addLogEntry(this.owner, { type: 'co_selling', who: profile.name, amount: revenue });
      addLogEntry(profile, { type: 'sidewalk_fee', who: this.owner.name, amount: fee });
      markDirty(this.owner);
      this.sendProfile(this.owner.id);
    }
    this.broadcast('sale', { slot: s.slot, amount: revenue, ownerId: profile.id });

    let second = false;
    if (k && regular) {
      const result = recordRegularSale(this.owner, profile, regular, s.productId, regularPct);
      if (result.xp) this.grantXp(profile, result.xp);
      if (result.gift) this.sendProfile(this.owner.id);
      second = s.remaining >= 1 && !this.secondPortions.has(k.id) && rollSecondPortion(regular);
      online.get(profile.id)?.client.send('regularSale', regularSaleView(result));
    } else if (k && !k.regularId) {
      const recruit = maybeRecruit(this.owner, this.district, k.group, s.productId);
      if (recruit) k.regularId = recruit.id;
    }

    if (k) {
      k.wants = k.wants.split(',').filter((w) => w !== s.productId).join(',');
      if (second) {
        // A second portion: the customer stays at the same stall
        this.secondPortions.add(k.id);
        k.wants = [s.productId, ...k.wants.split(',').filter(Boolean)].join(',');
        k.status = 'queue';
      } else {
        this.customerMoveOn(k);
        if (!k.wants) k.status = 'leave';
      }
    }
    if (s.remaining < 1) this.closeStall(s.slot, s.ownerId);
  }

  // ---------- Events ----------

  private activeEvents() {
    return [seasonalEvent(), scheduledEvent(), this.streetEvent].filter((e): e is GameEvent => !!e);
  }

  // Events plus the time of day and the weather, which change demand the same way
  private activeRules() {
    return mergeRules([...this.activeEvents(), dayClock().phase, currentWeather().event]);
  }

  private runSky(now: number) {
    const st = this.state;
    const clock = dayClock(now);
    const weather = currentWeather(now);
    const minute = clock.gameMinute - (clock.gameMinute % 5);
    if (st.gameMinute !== minute) st.gameMinute = minute;
    if (st.dayPhase !== clock.phase.id) { st.dayPhase = clock.phase.id; st.dayPhaseName = clock.phase.name; }
    const boost = [...new Set(mergeRules([clock.phase, weather.event]).boost ?? [])].join(',');
    if (st.skyBoost !== boost) st.skyBoost = boost;
    if (st.weather === weather.id && st.weatherName === weather.name && st.weatherEndsAt === weather.endsAt) return;
    const startsRaining = st.weather !== weather.id && !!weather.event.rules.autoWater;
    st.weather = weather.id;
    st.weatherName = weather.name;
    st.weatherDialogue = weather.dialogue;
    st.weatherEndsAt = weather.endsAt;
    if (startsRaining) this.rainOnGarden(now);
  }

  private runEvents(now: number) {
    this.runSky(now);
    if (this.streetEvent && now >= this.streetEventEndsAt) {
      this.streetEvent = null;
      this.orderProgress.clear();
    }
    if (!this.streetEvent && now >= this.nextStreetEventAt) {
      this.nextStreetEventAt = now + BALANCE.streetEventEverySeconds * 1000 * (0.5 + Math.random());
      this.streetEvent = pickStreetEvent(this.owner.fame);
      this.streetEventEndsAt = now + (this.streetEvent.seconds ?? 300) * 1000;
      if (this.streetEvent.rules.autoWater) this.rainOnGarden(now);
    }
    const events = this.activeEvents();
    const ids = events.map((e) => e.id).join(',');
    if (this.state.event !== ids) {
      const rules = mergeRules(events);
      this.state.event = ids;
      this.state.eventName = events.map((e) => e.name).join(' · ');
      this.state.eventEndsAt = this.streetEvent ? this.streetEventEndsAt : 0;
      this.state.eventProducts = (rules.products ?? []).join(',');
      this.state.eventDecorations = (rules.decorations ?? []).join(',');
      this.state.eventGift = rules.gift ?? '';
      this.state.communityId = rules.community ? seasonalEvent()?.id ?? '' : '';
      this.state.communityTarget = rules.community?.target ?? 0;
    }
  }

  private rainOnGarden(now: number) {
    for (const lot of this.owner.districts[this.district].lots) {
      if (!lot.crop || lot.watered || now >= lot.readyAt) continue;
      lot.readyAt -= Math.round((lot.readyAt - now) * BALANCE.waterCutPct / 100);
      lot.watered = true;
    }
    markDirty(this.owner);
    this.sendProfile(this.owner.id);
    this.syncStreet();
  }

  private advanceOrder(profile: Profile) {
    const order = this.activeRules().order;
    if (!order) return;
    const sold = (this.orderProgress.get(profile.id) ?? 0) + 1;
    this.orderProgress.set(profile.id, sold);
    if (sold !== order.quantity) return;
    profile.money += order.reward;
    online.get(profile.id)?.client.send('orderDone', { reward: order.reward });
  }

  // ---------- NPC streets ----------

  private openNpcStalls() {
    const products = NPC_STREETS.find((s) => s.id === this.owner.id)?.products ?? [];
    products.forEach((id, i) => {
      const product = getProduct(id)!;
      const s = new Stall();
      s.slot = this.state.ownerSlots + i * 2 - 2;
      s.x = this.slotX(s.slot);
      s.productId = product.id;
      s.remaining = 999;
      s.price = product.price;
      s.ownerId = this.owner.id;
      s.ownerName = this.owner.name;
      s.employeeId = 'npc';
      s.sellerName = 'Hàng xóm';
      s.sellerOutfit = ',,,';
      s.sellerLook = randomLook();
      this.state.stalls.set(String(s.slot), s);
    });
    // Crops that always need water, so visitors can practise helping out
    const now = Date.now();
    this.owner.districts[0].lots.forEach((l) => { l.crop = 'banana'; l.plantedAt = now; l.readyAt = now + 86_400_000; l.watered = false; });
    this.syncStreet();
  }

  // ---------- Helpers ----------

  // The owner's garden and buildings are public, so they are mirrored into the synced state
  private syncStreet() {
    const st = this.state;
    awardFinishedBuildings(this.owner);
    st.fame = this.owner.fame;
    st.decorations = this.owner.decorations.join(',');
    if (st.communityId) st.communityProgress = communityProgress(st.communityId);
    st.weddingProgress = this.owner.wedding.progress;
    st.weddingEndsAt = this.owner.wedding.endsAt;
    this.owner.districts[this.district].lots.forEach((lot, i) => {
      let view = st.lots.get(String(i));
      if (!view) { view = new LotState(); st.lots.set(String(i), view); }
      view.crop = lot.crop; view.plantedAt = lot.plantedAt; view.readyAt = lot.readyAt; view.watered = lot.watered;
      view.building = lot.building; view.level = lot.level; view.recipe = lot.recipe; view.cookReadyAt = lot.cookReadyAt;
    });
  }

  private refreshVehicle(profile: Profile, c: StreetClient) {
    const p = this.state.players.get(c.sessionId);
    if (p) p.vehicle = profile.vehicle === 'walk' ? '' : profile.vehicle;
  }

  // ---------- Activities ----------

  private rewardActivity(profile: Profile, kind: 'shuttle' | 'caro', money: number) {
    const today = dayIndex();
    if (profile.activityDay.day !== today) profile.activityDay = { day: today, shuttle: 0, caro: 0 };
    if (profile.activityDay[kind] >= BALANCE.activityRewardsPerDay) return;
    profile.activityDay[kind]++;
    profile.money += money;
    markDirty(profile);
    this.sendProfile(profile.id);
  }

  // Anyone on the street joins the rally; a player alone plays with a neighbour
  private startShuttle(profile: Profile) {
    const st = this.state;
    const players = st.shuttlePlayers ? st.shuttlePlayers.split(',') : [];
    if (players.includes(profile.id)) return;
    if (!players.length) {
      st.shuttlePlayers = `${profile.id},npc`;
      st.shuttleScore = 0;
      st.shuttleTurn = profile.id;
      st.shuttleDeadline = Date.now() + BALANCE.shuttleSeconds * 1000;
      return;
    }
    st.shuttlePlayers = [profile.id, ...players.filter((p) => p !== 'npc')].join(',');
  }

  private passShuttle() {
    const st = this.state;
    const players = st.shuttlePlayers.split(',');
    st.shuttleScore++;
    st.shuttleTurn = players[(players.indexOf(st.shuttleTurn) + 1) % players.length];
    st.shuttleDeadline = Date.now() + BALANCE.shuttleSeconds * 1000;
  }

  private kickShuttle(profile: Profile) {
    if (this.state.shuttleTurn !== profile.id) throw new GameError('Chưa tới lượt bạn');
    this.passShuttle();
  }

  private endShuttle() {
    const st = this.state;
    for (const id of st.shuttlePlayers.split(',')) {
      const profile = id === 'npc' ? null : getProfile(id);
      if (profile) this.rewardActivity(profile, 'shuttle', shuttleReward(st.shuttleScore));
    }
    if (st.shuttleScore >= 20 && !this.owner.isNpc) addFame(this.owner, FAME.help);
    st.shuttlePlayers = ''; st.shuttleTurn = ''; st.shuttleDeadline = 0;
  }

  private startCaro(profile: Profile) {
    const st = this.state;
    if (st.caroX && !st.caroWinner) {
      if (st.caroO === 'npc' && st.caroX !== profile.id && st.caroBoard === emptyBoard()) { st.caroO = profile.id; return; }
      throw new GameError('Ván cờ đang diễn ra');
    }
    st.caroBoard = emptyBoard();
    st.caroX = profile.id;
    st.caroO = 'npc';
    st.caroTurn = profile.id;
    st.caroWinner = '';
  }

  private moveCaro(profile: Profile, cell: number) {
    const st = this.state;
    if (st.caroWinner || st.caroTurn !== profile.id) throw new GameError('Chưa tới lượt bạn');
    const mark = profile.id === st.caroX ? 'X' : 'O';
    const board = placeMark(st.caroBoard, cell, mark);
    if (!board) throw new GameError('Ô này đã có quân');
    st.caroBoard = board;
    if (hasFive(board, cell)) { this.endCaro(profile.id); return; }
    if (st.caroO !== 'npc') { st.caroTurn = mark === 'X' ? st.caroO : st.caroX; return; }
    const reply = npcMove(board, 'O', 'X');
    if (reply < 0) { this.endCaro('draw'); return; }
    st.caroBoard = placeMark(board, reply, 'O')!;
    if (hasFive(st.caroBoard, reply)) this.endCaro('npc');
  }

  private endCaro(winner: string) {
    this.state.caroWinner = winner;
    this.state.caroTurn = '';
    const profile = getProfile(winner);
    if (profile) this.rewardActivity(profile, 'caro', BALANCE.caroWinMoney);
  }

  private giveToWedding(profile: Profile, item: string, quantity: number) {
    const w = this.owner.wedding;
    if (Date.now() >= w.endsAt) throw new GameError('Phố này chưa có đám cưới');
    if (!getProduct(item)?.homegrown) throw new GameError('Món này không góp được');
    const amount = Math.min(Math.floor(quantity) || 0, profile.store[item] ?? 0, BALANCE.weddingGoal - w.progress);
    if (amount < 1) throw new GameError('Kho không đủ hàng');
    takeFromStore(profile, item, amount);
    w.progress += amount;
    if (!w.givers.includes(profile.id)) w.givers.push(profile.id);
    markDirty(this.owner);
    if (w.progress < BALANCE.weddingGoal) return;
    for (const id of w.givers) {
      const giver = getProfile(id);
      if (!giver) continue;
      giver.money += BALANCE.weddingReward;
      markDirty(giver);
      this.sendProfile(id);
    }
    w.endsAt = 0;
    addFame(this.owner, FAME.visit);
  }

  private runActivities(now: number) {
    const st = this.state;
    if (st.shuttleDeadline && st.shuttleTurn === 'npc' && now > st.shuttleDeadline - BALANCE.shuttleSeconds * 500) this.passShuttle();
    else if (st.shuttleDeadline && now >= st.shuttleDeadline) this.endShuttle();
  }

  // Counts an action for the season (see season.ts) and tells the player when a weekly quest is finished
  private trackSeason(profile: Profile, kind: SeasonKind, amount = 1, key = '') {
    for (const done of seasonEvent(profile, kind, amount, Date.now(), key)) online.get(profile.id)?.client.send('seasonQuestDone', done);
  }

  private requireOwnStreet(profile: Profile) {
    if (profile.id !== this.owner.id) throw new GameError('Chỉ làm được ở vườn nhà mình');
  }

  // Friends, gifts and fame go to a street's owner, and a public district has no player owner
  private requirePlayerStreet() {
    if (this.isPublic) throw new GameError('Khu phố chung không có chủ phố');
  }

  // Customers per second multiplier: a player's street grows with its buildings, a public district has a fixed crowd
  private trafficFactor() {
    if (this.publicDef) return this.publicDef.trafficPct / 100;
    return this.owner.isNpc ? 1 : footTraffic(this.owner, this.district);
  }

  private grantXp(profile: Profile, xp: number) {
    if (!addXp(profile, fortuneXp(profile, xp))) return;
    this.state.players.forEach((p) => { if (p.id === profile.id) p.level = profile.level; });
    if (profile.id === this.owner.id) this.state.ownerLevel = profile.level;
    this.broadcast('levelUp', { id: profile.id, name: profile.name, level: profile.level });
  }

  private lookString(profile: Profile) {
    const a = profile.appearance;
    return a ? [a.gender, a.hair, a.brows, a.lips, a.cheeks, a.earrings].join(',') : '';
  }

  private outfitString(outfit: Outfit) {
    return WEAR_SLOTS.map((slot) => outfit[slot] || '').join(',');
  }

  private refreshLooks(profile: Profile, c: StreetClient) {
    const p = this.state.players.get(c.sessionId);
    if (p) p.outfit = this.outfitString(profile.outfit);
    this.state.stalls.forEach((s) => {
      if (s.ownerId !== profile.id) return;
      const e = s.employeeId ? profile.employees.find((x) => x.id === s.employeeId) : null;
      s.sellerOutfit = this.outfitString(e ? e.outfit : profile.outfit);
    });
  }

  private sendProfile(id: string) {
    this.pendingProfiles.add(id);
    // If that player is on another street, ask that room to send it
    const o = online.get(id);
    if (o && o.room !== this) o.room.pendingProfiles.add(id);
  }

  private updateMetadata() {
    if (this.disposing) return;
    this.setMetadata({
      ownerId: this.owner.id,
      ownerName: this.owner.name,
      ownerLevel: this.owner.level,
      district: this.district,
      isPublic: this.isPublic,
      shard: this.shard,
      playerCount: this.state.players.size,
      stallCount: this.state.stalls.size,
    }).catch(() => {});
  }
}

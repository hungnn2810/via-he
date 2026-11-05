// Light street incidents. They are small, short surprises that ask for a quick reaction; none of them can take
// more than a small fine, and nobody is ever punished while absent:
//  - police_reminder: the ward police remind the owner of a stall. A "Dọn tạm" (pauseStalls) within the notice window
//    avoids the fine; ignoring it costs a small fine, capped by the money the owner has, at most once a day, and only
//    while the owner is online and standing in their own street.
//  - communal_cleanup: the neighbourhood cleans the street together; everyone present joins once for a small reward.
// The room owns one IncidentManager and forwards its tick, two messages and the stall pause check to it.
import { GameError, markDirty, type Profile } from './profile.js';
import { addFame, dayIndex } from './world.js';

export interface IncidentDef {
  id: string;
  name: string;            // player-facing
  kind: 'police' | 'cleanup';
  seconds: number;         // how long the notice / event lasts
  pauseSeconds?: number;   // police: how long "Dọn tạm" pauses the owner's stalls
  fine?: number;           // police: fine for ignoring the notice
  reward?: number;         // cleanup: money for each participant
  minLevel?: number;       // cleanup: level needed to join
}

export const INCIDENTS: Record<string, IncidentDef> = {
  police_reminder: { id: 'police_reminder', name: 'Công an phường nhắc nhở', kind: 'police', seconds: 30, pauseSeconds: 60, fine: 20000 },
  communal_cleanup: { id: 'communal_cleanup', name: 'Dọn vệ sinh chung', kind: 'cleanup', seconds: 180, reward: 8000, minLevel: 2 },
};

export const INCIDENT_RULES = {
  minGapSeconds: 600,          // no incident within this time of the previous one in the same room
  firstCheckSeconds: 180,      // first chance after the room opens
  checkEverySeconds: 30,       // how often the scheduler rolls the dice
  chancePerCheck: 0.08,        // about one incident every 6 minutes after the gap
  cleanupRewardsPerDay: 3,     // cleanup rewards per player per day, across all streets
  cleanupFamePerVisitor: 1,    // fame for the owner for each distinct visitor who joins
  cleanupFamePerDay: 10,       // fame an owner can earn from cleanups in a day (the visitor fame cap is 20)
};

// Per-day counters live on the profile JSON (extra keys are kept by the save and the loader)
interface IncidentDay { day: number; fined: boolean; cleanups: number; cleanupFame: number; cleanupVisitors: string[] }
type WithIncidents = Profile & { incidentDay?: IncidentDay };

export function incidentDay(profile: Profile, now = Date.now()): IncidentDay {
  const p = profile as WithIncidents;
  const today = dayIndex(now);
  if (!p.incidentDay || p.incidentDay.day !== today) p.incidentDay = { day: today, fined: false, cleanups: 0, cleanupFame: 0, cleanupVisitors: [] };
  return p.incidentDay;
}

const vnd = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

// What the manager needs from its room, so it can be driven without a running server
export interface IncidentHost {
  owner: Profile;
  present(): Profile[];                                  // profiles of the players standing in this room
  ownerHasOpenStall(): boolean;                          // a stall the owner runs in person
  send(profileId: string, type: string, payload: unknown): void;
  broadcast(type: string, payload: unknown): void;
  changed(profile: Profile): void;                       // save and resend the profile
}

type Phase = 'notice' | 'paused' | 'active';
interface Current { def: IncidentDef; phase: Phase; endsAt: number; participants: Set<string>; fameGiven: number }

export class IncidentManager {
  private current: Current | null = null;
  private pausedUntil = 0;
  private lastEndedAt = -Infinity;
  private nextCheckAt: number;

  constructor(private host: IncidentHost, now = Date.now(), private random = Math.random) {
    this.nextCheckAt = now + INCIDENT_RULES.firstCheckSeconds * 1000;
  }

  // The owner's stalls do not serve customers while paused
  isPaused(ownerId: string, now = Date.now()) {
    return ownerId === this.host.owner.id && now < this.pausedUntil;
  }

  tick(now = Date.now()) {
    if (this.host.owner.isNpc) return;
    if (this.current) { this.advance(now); return; }
    if (now < this.nextCheckAt) return;
    this.nextCheckAt = now + INCIDENT_RULES.checkEverySeconds * 1000;
    if (now - this.lastEndedAt < INCIDENT_RULES.minGapSeconds * 1000) return;
    const options = Object.values(INCIDENTS).filter((d) => this.eligible(d, now));
    if (!options.length || this.random() >= INCIDENT_RULES.chancePerCheck) return;
    this.start(options[Math.floor(this.random() * options.length)], now);
  }

  // Start one right away (used by the scheduler and by tests); returns false when it cannot run now
  start(def: IncidentDef, now = Date.now()) {
    if (this.current || !this.eligible(def, now)) return false;
    const endsAt = now + def.seconds * 1000;
    this.current = { def, phase: def.kind === 'police' ? 'notice' : 'active', endsAt, participants: new Set(), fameGiven: 0 };
    if (def.kind === 'police') this.host.send(this.host.owner.id, 'incident', this.view());
    else this.host.broadcast('incident', this.view());
    return true;
  }

  private eligible(def: IncidentDef, now: number) {
    const owner = this.host.owner;
    if (owner.isNpc || !this.ownerPresent()) return false;
    if (def.kind === 'police') return this.host.ownerHasOpenStall() && !incidentDay(owner, now).fined && owner.money > 0;
    return owner.level >= (def.minLevel ?? 1);
  }

  private ownerPresent() {
    return this.host.present().some((p) => p.id === this.host.owner.id);
  }

  private view() {
    const c = this.current!;
    return { id: c.def.id, name: c.def.name, phase: c.phase, endsAt: c.endsAt, fine: c.def.fine ?? 0, reward: c.def.reward ?? 0, pauseSeconds: c.def.pauseSeconds ?? 0 };
  }

  // A client that joins the room mid-incident learns about it
  sendCurrent(profileId: string) {
    const c = this.current;
    if (!c) return;
    if (c.def.kind === 'police' && profileId !== this.host.owner.id) return;
    this.host.send(profileId, 'incident', this.view());
  }

  private advance(now: number) {
    const c = this.current!;
    const owner = this.host.owner;
    if (!this.ownerPresent()) { this.finish(now); return; } // nobody is punished for being away
    if (c.def.kind === 'police' && c.phase === 'notice' && !this.host.ownerHasOpenStall()) { this.finish(now); return; } // closed up in time
    if (now < c.endsAt) return;

    if (c.def.kind === 'police') {
      if (c.phase === 'notice') {
        const day = incidentDay(owner, now);
        const fine = Math.min(c.def.fine ?? 0, Math.max(0, owner.money));
        day.fined = true;
        owner.money -= fine;
        this.result(owner.id, c.def, fine > 0 ? `Bạn không dọn tạm nên bị phạt ${vnd(fine)}.` : 'Công an phường nhắc nhở bạn lần này.', -fine);
        this.host.changed(owner);
      } else {
        this.result(owner.id, c.def, 'Đã dọn tạm xong, bạn không bị phạt. Mời bán tiếp nhé!', 0);
      }
    } else if (c.participants.size > 0) {
      const text = c.fameGiven > 0
        ? `Tổ dân phố cảm ơn ${c.participants.size} người đã dọn phố, phố bạn được thêm ${c.fameGiven} danh tiếng.`
        : `Tổ dân phố cảm ơn ${c.participants.size} người đã dọn phố.`;
      this.result(owner.id, c.def, text, 0, c.fameGiven);
    }
    this.finish(now);
  }

  private finish(now: number) {
    const c = this.current!;
    this.current = null;
    this.lastEndedAt = now;
    const ended = { id: c.def.id, name: c.def.name, phase: 'ended', endsAt: now, fine: 0, reward: 0, pauseSeconds: 0 };
    if (c.def.kind === 'police') this.host.send(this.host.owner.id, 'incident', ended);
    else this.host.broadcast('incident', ended);
  }

  private result(profileId: string, def: IncidentDef, text: string, money: number, fame = 0) {
    this.host.send(profileId, 'incidentResult', { id: def.id, name: def.name, text, money, fame });
  }

  // "Dọn tạm": the owner's stalls stop serving for a while and nothing is lost
  pauseStalls(profile: Profile, now = Date.now()) {
    const c = this.current;
    if (!c || c.def.kind !== 'police' || profile.id !== this.host.owner.id) throw new GameError('Chưa có ai nhắc nhở bạn');
    if (c.phase !== 'notice') throw new GameError('Bạn đã dọn tạm rồi');
    c.phase = 'paused';
    c.endsAt = now + (c.def.pauseSeconds ?? 60) * 1000;
    this.pausedUntil = c.endsAt;
    this.host.send(profile.id, 'incident', this.view());
  }

  // "Tham gia dọn": one reward per event, a few per day across all streets
  joinCleanup(profile: Profile, now = Date.now()) {
    const c = this.current;
    if (!c || c.def.kind !== 'cleanup') throw new GameError('Chưa có buổi dọn vệ sinh nào');
    if (!this.host.present().some((p) => p.id === profile.id)) throw new GameError('Bạn không ở trong phố này');
    if (profile.level < (c.def.minLevel ?? 1)) throw new GameError(`Cần cấp ${c.def.minLevel} để tham gia dọn phố`);
    if (c.participants.has(profile.id)) throw new GameError('Bạn đã tham gia buổi dọn này rồi');
    const day = incidentDay(profile, now);
    if (day.cleanups >= INCIDENT_RULES.cleanupRewardsPerDay) throw new GameError(`Hôm nay bạn đã dọn phố đủ ${INCIDENT_RULES.cleanupRewardsPerDay} lần rồi`);

    c.participants.add(profile.id);
    day.cleanups++;
    const reward = c.def.reward ?? 0;
    profile.money += reward;
    this.host.changed(profile);
    this.result(profile.id, c.def, `Cảm ơn bạn đã dọn phố, nhận ${vnd(reward)}.`, reward);

    // The owner earns fame for visitors only, once per visitor per day, under a daily cap
    const owner = this.host.owner;
    if (profile.id === owner.id) return;
    const ownerDay = incidentDay(owner, now);
    if (ownerDay.cleanupVisitors.includes(profile.id) || ownerDay.cleanupFame >= INCIDENT_RULES.cleanupFamePerDay) return;
    ownerDay.cleanupVisitors.push(profile.id);
    ownerDay.cleanupFame += INCIDENT_RULES.cleanupFamePerVisitor;
    addFame(owner, INCIDENT_RULES.cleanupFamePerVisitor);
    c.fameGiven += INCIDENT_RULES.cleanupFamePerVisitor;
    markDirty(owner);
  }
}

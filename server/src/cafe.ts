// Shared café: a finished café lot has seats. Anyone on the street (owner or visitor) can sit to regain stamina faster.
// Seats live in room memory (one CafeSeats per street room). The owner is paid per visitor sitting session, with daily caps.
// Every function takes `now` so tests can run on a fake clock.
import { BALANCE, FAME } from './data.js';
import { GameError, markDirty, type Profile } from './profile.js';
import { addFame, dayIndex, isBuilt, landAt } from './world.js';

export const CAFE = {
  baseSeats: 4,            // seats at level 1
  seatsPerExtraLevel: 2,
  minLevel: 2,             // minimum player level to sit (same as FAME.minVisitorLevel)
  maxSitSeconds: 600,      // one continuous sit ends after this long
  ownerPayout: 3000,       // paid to the owner per sitting session a visitor starts
  maxPaidSessionsPerDay: 10,
  regenMultiplier: 2,      // stamina regained per tick while seated
};

export interface CafeSeat {
  lot: number;
  index: number;
  playerId: string;
  name: string;
  since: number;
}

export const cafeSeatCount = (level: number) => CAFE.baseSeats + Math.max(0, level - 1) * CAFE.seatsPerExtraLevel;

// Stamina after one regen tick: a seated player regains twice as much
export const regenStamina = (stamina: number, seated: boolean, max = BALANCE.maxStamina) =>
  Math.min(max, stamina + (seated ? CAFE.regenMultiplier : 1));

function refreshCafeDay(owner: Profile, now: number) {
  const today = dayIndex(now);
  if (owner.cafeDay.day !== today) owner.cafeDay = { day: today, sessions: 0, visitors: [] };
}

export class CafeSeats {
  private seats: CafeSeat[] = [];

  constructor(private streetDistrict: number) {}

  isSeated = (playerId: string) => this.seats.some((s) => s.playerId === playerId);

  // Payload of the `cafeSeats` message
  view() {
    return { seats: this.seats.map((s) => ({ lot: s.lot, index: s.index, playerId: s.playerId, name: s.name })) };
  }

  // Sit on the first free seat of the café on this lot. Pays the owner when a visitor sits.
  sit(owner: Profile, player: Profile, streetDistrict: number, district: unknown, lot: unknown, now = Date.now()) {
    if (district !== streetDistrict) throw new GameError('Quán cà phê không ở phố này');
    const land = landAt(owner, district, lot);
    if (land.building !== 'cafe' || !isBuilt(land, now)) throw new GameError('Cần một Quán cà phê đã xây xong');
    if (player.level < CAFE.minLevel) throw new GameError(`Cần cấp ${CAFE.minLevel} để ngồi quán`);
    if (this.isSeated(player.id)) throw new GameError('Bạn đang ngồi ở quán rồi');
    const taken = new Set(this.seats.filter((s) => s.lot === lot).map((s) => s.index));
    let index = 0;
    while (taken.has(index)) index++;
    if (index >= cafeSeatCount(land.level)) throw new GameError('Quán hết chỗ rồi');
    this.seats.push({ lot: lot as number, index, playerId: player.id, name: player.name, since: now });
    const paid = player.id === owner.id ? 0 : this.payOwner(owner, player, now);
    return { index, paid };
  }

  private payOwner(owner: Profile, visitor: Profile, now: number) {
    refreshCafeDay(owner, now);
    const day = owner.cafeDay;
    if (!day.visitors.includes(visitor.id) && day.visitors.length < FAME.maxVisitorsPerDay) {
      day.visitors.push(visitor.id);
      addFame(owner, 1);
    }
    let paid = 0;
    if (day.sessions < CAFE.maxPaidSessionsPerDay) {
      day.sessions++;
      paid = CAFE.ownerPayout;
      owner.money += paid;
    }
    markDirty(owner);
    return paid;
  }

  leave(playerId: string) {
    const before = this.seats.length;
    this.seats = this.seats.filter((s) => s.playerId !== playerId);
    return this.seats.length !== before;
  }

  // Frees seats whose sit ran out, or whose café was demolished or has fewer seats now. Returns true if anything changed.
  expire(owner: Profile, now = Date.now()) {
    const before = this.seats.length;
    this.seats = this.seats.filter((s) => {
      if (now - s.since >= CAFE.maxSitSeconds * 1000) return false;
      const land = owner.districts[this.streetDistrict]?.lots[s.lot];
      return !!land && land.building === 'cafe' && isBuilt(land, now) && s.index < cafeSeatCount(land.level);
    });
    return this.seats.length !== before;
  }
}

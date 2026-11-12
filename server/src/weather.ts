// Time of day and weather. Both are worked out from the clock alone, so every street (and every server) agrees
// without sharing state: one game day runs through four phases, and the weather changes every few minutes.
// Like events, they only shift which products customers ask for and how busy the street is.
import type { GameEvent } from './events.js';

export type DayPhaseId = 'morning' | 'noon' | 'afternoon' | 'evening';
export type WeatherId = 'sunny' | 'cloudy' | 'hot' | 'rain';

export interface DayPhase extends GameEvent {
  id: DayPhaseId;
  minutes: number;   // real minutes this phase lasts
  fromHour: number;  // in-game clock shown to players
  toHour: number;    // may pass 24: the evening runs to 5 in the morning
}

// One game day = 44 real minutes. The evening is the longest phase because street food sells best at night.
export const DAY_PHASES: DayPhase[] = [
  { id: 'morning', name: 'Sáng', minutes: 12, fromHour: 5, toHour: 11, rules: { spawnFactor: 1.1, boost: ['banh_mi', 'sticky_rice', 'fresh_milk'] } },
  { id: 'noon', name: 'Trưa', minutes: 8, fromHour: 11, toHour: 14, rules: { spawnFactor: 0.9, boost: ['tofu_noodles', 'iced_tea'] } },
  { id: 'afternoon', name: 'Chiều', minutes: 10, fromHour: 14, toHour: 18, rules: { boost: ['sweet_soup', 'popsicle', 'fried_banana', 'banana_cake'] } },
  { id: 'evening', name: 'Tối', minutes: 14, fromHour: 18, toHour: 29, rules: { boost: ['banana_soup', 'tofu_noodles', 'flowers'] } },
];

export const DAY_MINUTES = DAY_PHASES.reduce((sum, p) => sum + p.minutes, 0);
export const WEATHER_MINUTES = 10;   // the weather can change this often
const WEATHER_STICKY_PCT = 35;       // chance the next spell keeps the same weather

interface WeatherDef {
  id: WeatherId;
  name: string;
  nightName?: string;                      // shown in the evening instead
  weights: Record<DayPhaseId, number>;     // how likely per phase; 0 = never
  rules: GameEvent['rules'];
  dialogue?: string;                       // bystander line key in dialogues (shared with the old weather events)
}

export const WEATHERS: WeatherDef[] = [
  { id: 'sunny', name: 'Nắng đẹp', nightName: 'Trời quang', weights: { morning: 4, noon: 3, afternoon: 3, evening: 4 }, rules: {} },
  { id: 'cloudy', name: 'Trời râm', weights: { morning: 3, noon: 2, afternoon: 3, evening: 3 }, rules: {} },
  { id: 'hot', name: 'Nắng gắt', weights: { morning: 1, noon: 4, afternoon: 3, evening: 0 }, dialogue: 'hot_sun',
    rules: { boost: ['iced_tea', 'popsicle', 'fresh_cane', 'sugarcane_juice'] } },
  { id: 'rain', name: 'Trời mưa', weights: { morning: 2, noon: 1, afternoon: 2, evening: 2 }, dialogue: 'rain',
    rules: { spawnFactor: 0.7, autoWater: true, boost: ['sweet_soup', 'sticky_rice', 'banana_soup'] } },
];

export interface Clock {
  phase: DayPhase;
  gameMinute: number;   // 0..1439, the in-game time of day
  phaseEndsAt: number;
}

export function dayClock(now = Date.now()): Clock {
  let t = (now / 60_000) % DAY_MINUTES;
  const dayStart = now - t * 60_000;
  let start = 0;
  for (const phase of DAY_PHASES) {
    if (t < phase.minutes) {
      const hour = phase.fromHour + (t / phase.minutes) * (phase.toHour - phase.fromHour);
      return { phase, gameMinute: Math.floor((hour % 24) * 60), phaseEndsAt: dayStart + (start + phase.minutes) * 60_000 };
    }
    t -= phase.minutes;
    start += phase.minutes;
  }
  const last = DAY_PHASES[DAY_PHASES.length - 1];
  return { phase: last, gameMinute: (last.toHour % 24) * 60, phaseEndsAt: dayStart + DAY_MINUTES * 60_000 };
}

// Small integer hash, so a weather spell is the same on every server
function roll(spell: number, salt: number): number {
  let h = (spell * 374_761_393 + salt * 668_265_263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1_274_126_177);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

function weatherOfSpell(spell: number, depth = 0): WeatherDef {
  const phase = dayClock(spell * WEATHER_MINUTES * 60_000).phase.id;
  if (depth < 6 && roll(spell, 1) * 100 < WEATHER_STICKY_PCT) {
    const previous = weatherOfSpell(spell - 1, depth + 1);
    if (previous.weights[phase] > 0) return previous;
  }
  const total = WEATHERS.reduce((sum, w) => sum + w.weights[phase], 0);
  let pick = roll(spell, 2) * total;
  for (const w of WEATHERS) {
    pick -= w.weights[phase];
    if (pick < 0) return w;
  }
  return WEATHERS[0];
}

export interface Weather {
  id: WeatherId;
  name: string;
  endsAt: number;
  dialogue: string;
  event: GameEvent;   // rules merged with the street's events
}

export function currentWeather(now = Date.now()): Weather {
  const spell = Math.floor(now / (WEATHER_MINUTES * 60_000));
  const phase = dayClock(now).phase.id;
  // A spell can run past a phase change; weather that cannot happen in the new phase (hot sun at night) clears up
  const picked = weatherOfSpell(spell);
  const w = picked.weights[phase] > 0 ? picked : WEATHERS[0];
  const name = phase === 'evening' && w.nightName ? w.nightName : w.name;
  return { id: w.id, name, endsAt: (spell + 1) * WEATHER_MINUTES * 60_000, dialogue: w.dialogue ?? '', event: { id: `weather_${w.id}`, name, rules: w.rules } };
}

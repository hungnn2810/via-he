// Checks the day clock and the weather: phases cycle in order, the weather is deterministic and fits the phase
import { DAY_MINUTES, DAY_PHASES, WEATHER_MINUTES, currentWeather, dayClock } from '../src/weather.js';
import { mergeRules } from '../src/events.js';

function check(ok: boolean, msg: string) {
  if (!ok) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✓ ${msg}`);
}

const start = Date.UTC(2026, 10, 12, 3, 0, 0);

// Walk one full day minute by minute
const seenPhases: string[] = [];
let lastMinute = -1;
let wrapped = 0;
for (let m = 0; m < DAY_MINUTES; m++) {
  const c = dayClock(start + m * 60_000);
  if (seenPhases[seenPhases.length - 1] !== c.phase.id) seenPhases.push(c.phase.id);
  if (c.gameMinute < lastMinute) wrapped++;
  lastMinute = c.gameMinute;
  if (c.gameMinute < 0 || c.gameMinute >= 1440) check(false, `game minute in range (${c.gameMinute})`);
  if (c.phaseEndsAt <= start + m * 60_000) check(false, 'phase ends in the future');
}
const ids = DAY_PHASES.map((p) => p.id);
const rotated = [...seenPhases.slice(seenPhases.indexOf('morning')), ...seenPhases.slice(0, seenPhases.indexOf('morning'))];
check(new Set(seenPhases).size === 4 && rotated.slice(0, 4).join() === ids.join(), 'All four phases run in order over one day');
check(wrapped <= 2, 'Game clock only wraps around midnight / day start');

const morning = DAY_PHASES[0];
const atMorning = dayClock(Math.ceil(start / (DAY_MINUTES * 60_000)) * DAY_MINUTES * 60_000);
check(atMorning.phase.id === 'morning' && atMorning.gameMinute === morning.fromHour * 60, 'A game day starts at 05:00 in the morning');

// Weather over two simulated weeks
const counts: Record<string, number> = {};
let hotAtNight = 0;
for (let m = 0; m < 14 * 24 * 60; m += 3) {
  const now = start + m * 60_000;
  const w = currentWeather(now);
  counts[w.id] = (counts[w.id] ?? 0) + 1;
  if (w.id === 'hot' && dayClock(now).phase.id === 'evening') hotAtNight++;
  if (w.endsAt <= now || w.endsAt - now > WEATHER_MINUTES * 60_000) check(false, 'weather spell ends within its window');
}
console.log('  weather share:', counts);
check(Object.keys(counts).length === 4, 'Every kind of weather happens');
check(hotAtNight === 0, 'No hot sun in the evening');
check(currentWeather(start).id === currentWeather(start).id && currentWeather(start + 1000).endsAt === currentWeather(start).endsAt, 'Weather is deterministic within a spell');

// Rules merge with events
const rainy = [...Array(2000).keys()].map((i) => start + i * WEATHER_MINUTES * 60_000).find((t) => currentWeather(t).id === 'rain')!;
const rules = mergeRules([dayClock(rainy).phase, currentWeather(rainy).event]);
check(!!rules.autoWater && (rules.spawnFactor ?? 1) < 1 && rules.boost!.includes('sweet_soup'), 'Rain waters gardens, slows the street and boosts hot desserts');

console.log('All weather checks passed');

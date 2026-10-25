/**
 * Plays full seasons with the auto-play bot, buying Armory upgrades as it goes, and
 * reports win rate by chapter next to a baseline that never spends:
 *   npm run data:season -- [--runs 16] [--smart-bot] [--difficulty normal]
 * Also compares picking games by most energy with the smart-pick score.
 */
import { rules, type Difficulty } from '../src/rules';
import { loadSeasonFile } from './load-season';
import { simulateSeasons, type SeasonWeek } from './season-lib';
import { DEFAULT_PICK_WEIGHTS } from '../src/app/smartPick';

const arg = (name: string, d: number) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : d);
const data = loadSeasonFile();
const runs = arg('--runs', 16);
// The lookahead bot plays like a strong human but is ~50x slower than the heuristic bot.
const bot = process.argv.includes('--smart-bot') ? 'smart' : 'fast';
const difficulty = (process.argv.includes('--difficulty') ? process.argv[process.argv.indexOf('--difficulty') + 1] : 'hard') as Difficulty;

const spending = simulateSeasons(data, runs, 'greedy', 'energy', undefined, bot, 'none', difficulty);
const smart = simulateSeasons(data, runs, 'greedy', 'smart', DEFAULT_PICK_WEIGHTS, bot, 'none', difficulty);
const aware = simulateSeasons(data, runs, 'greedy', 'smart', undefined, bot, 'none', difficulty);
const renting = simulateSeasons(data, runs, 'greedy', 'smart', undefined, bot, 'rent', difficulty);
const baseline = simulateSeasons(data, runs, 'none', 'energy', undefined, bot, 'none', difficulty);

const pct = (ws: SeasonWeek[]) => (ws.length ? `${((ws.filter((w) => w.won).length / ws.length) * 100).toFixed(0)}%` : '–');
const chapters = [...new Set(spending.map((w) => w.chapter))].sort((a, b) => a - b);
const avg = (ws: SeasonWeek[], f: (w: SeasonWeek) => number) => (ws.length ? ws.reduce((t, w) => t + f(w), 0) / ws.length : 0);

console.log(
  `${data.synthetic ? '[SYNTHETIC DATA] ' : ''}${bot} bot · ${runs} seasons of ${data.weeks.length} weeks (chapter scaling +${rules.progression.chapterScaling * 100}% each)`,
);
console.log('Chapter  Horde   Win (energy)  Win (smart)  Win (smart, encounter-aware)  Win (no upgrades)  PP spent per hero by chapter end');
for (const ch of chapters) {
  const s = spending.filter((w) => w.chapter === ch);
  const b = baseline.filter((w) => w.chapter === ch);
  const m = smart.filter((w) => w.chapter === ch);
  const a = aware.filter((w) => w.chapter === ch);
  const lastWeek = Math.max(...s.map((w) => w.week));
  const spent = avg(
    s.filter((w) => w.week === lastWeek),
    (w) => w.spentPerHero,
  );
  console.log(
    `${String(ch).padEnd(9)}+${String(Math.round(rules.progression.chapterScaling * (ch - 1) * 100)).padEnd(3)}%  ${pct(s).padEnd(14)}${pct(m).padEnd(13)}${pct(a).padEnd(30)}${pct(b).padEnd(19)}${spent.toFixed(0)}`,
  );
}
console.log(
  `Whole season: ${pct(spending)} most energy, ${pct(smart)} smart pick, ${pct(aware)} encounter-aware smart pick, ${pct(baseline)} without spending · avg ${avg(spending, (w) => w.rounds).toFixed(1)} rounds`,
);
const encs = [...new Set(spending.map((w) => w.encounter))];
for (const [label, ws] of [
  ['most energy', spending],
  ['smart', smart],
  ['encounter-aware', aware],
] as const)
  console.log(`By encounter (${label}): ${encs.map((e) => `${e} ${pct(ws.filter((w) => w.encounter === e))}`).join(' · ')}`);
// Gold: ten-day contracts for heroes whose player has no game (encounter-aware smart pick).
const perRun = (ws: SeasonWeek[], f: (w: SeasonWeek) => number) => ws.reduce((t, w) => t + f(w), 0) / runs;
const lastGold = [...new Map(renting.map((w) => [w.run, w.gold])).values()];
console.log(
  `Gold: ${pct(renting)} with ten-day contracts vs ${pct(aware)} without · weak spots per week (below Good or no game) ${avg(aware, (w) => w.sittingOut).toFixed(2)} → ${avg(renting, (w) => w.sittingOut).toFixed(2)} · ${perRun(renting, (w) => w.rented).toFixed(1)} contracts a season · ${(lastGold.reduce((t, g) => t + g, 0) / lastGold.length).toFixed(0)} gold left at the end`,
);

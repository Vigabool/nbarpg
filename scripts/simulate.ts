/**
 * Plays many battles with the auto-play bot to check balance:
 *   npm run data:simulate -- [--battles 300] [--seed 1]
 *
 * Each battle: a random week, the strongest available player for each class
 * among a random draw, and each hero's best game that week (greedy hindsight).
 */
import { CLASSES, rules, type HeroClass } from '../src/rules';
import { autoplay } from '../src/engine/autoplay';
import { eligiblePlayers } from '../src/engine/calibration';
import type { HeroGamePick } from '../src/engine/horde';
import { computePool, seasonTier } from '../src/engine/rating';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { tierIndex } from '../src/rules';
import { loadSeasonFile } from './load-season';

const arg = (name: string, d: number) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : d);
const battles = arg('--battles', 300);
let seed = arg('--seed', 1);
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

const data = loadSeasonFile();
const pool = eligiblePlayers(data);
const results = { won: 0, lost: 0, rounds: 0, waves: [0, 0, 0, 0], fallen: 0, roundCap: 0, pools: [] as number[], horde: 0, goblins: 0 };

for (let b = 0; b < battles; b++) {
  const week = data.weeks[Math.floor(rand() * data.weeks.length)];
  // A plausible roster: from a random third of the league, the best fit for each class.
  const draw = pool.filter(() => rand() < 0.33);
  const used = new Set<number>();
  const picks: HeroGamePick[] = [];
  for (const c of CLASSES as readonly HeroClass[]) {
    const best = draw
      .filter((p) => !used.has(p.id) && playerGamesInWeek(data, week, p.id).length > 0)
      .sort((a, b) => tierIndex(seasonTier(c, b.avg)) - tierIndex(seasonTier(c, a.avg)))[0];
    if (!best) continue;
    used.add(best.id);
    const games = playerGamesInWeek(data, week, best.id);
    const gameId = games
      .map((g) => ({ g, pool: computePool(c, data.games[g].lines.find((l) => l.playerId === best.id)!).pool }))
      .sort((a, b) => b.pool - a.pool)[0].g;
    picks.push({ heroClass: c, playerId: best.id, gameId });
  }
  if (picks.length === 0) continue;
  const prepared = prepareBattle(picks, data);
  results.horde += prepared.horde.waves.flat().length;
  results.goblins += prepared.horde.waves.flat().filter((m) => m.kind === 'goblin').length;
  for (const p of Object.values(prepared.pools)) results.pools.push(p!.pool);
  const end = autoplay(prepared.battle);
  if (end.phase === 'won') results.won++;
  else results.lost++;
  if (end.outcomeReason?.includes('rounds')) results.roundCap++;
  results.rounds += end.round;
  results.waves[end.stats.wavesCleared]++;
  results.fallen += end.heroes.filter((h) => !h.alive).length;
}

const n = results.won + results.lost;
const avgPool = results.pools.reduce((a, b) => a + b, 0) / results.pools.length;
console.log(`${data.synthetic ? '[SYNTHETIC DATA] ' : ''}${n} battles with the auto-play bot (round cap ${rules.combat.roundCap})`);
console.log(`Win rate: ${((results.won / n) * 100).toFixed(1)}%  (losses to round cap: ${results.roundCap})`);
console.log(`Average rounds: ${(results.rounds / n).toFixed(1)}  ·  heroes fallen per battle: ${(results.fallen / n).toFixed(2)}`);
console.log(`Waves cleared: ${results.waves.map((c, i) => `${i}: ${c}`).join('  ')}`);
console.log(`Average pool: ${avgPool.toFixed(1)}  ·  monsters per battle: ${(results.horde / n).toFixed(1)} (goblins ${(results.goblins / n).toFixed(1)})`);

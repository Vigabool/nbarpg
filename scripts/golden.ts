/**
 * Refactor safety net: plays a fixed set of battles in every encounter with both bots,
 * plus a few short seasons, and fingerprints every battle log and final state.
 *   npm run check:golden            compare with scripts/golden.json
 *   npm run check:golden -- --update   record a new baseline (after an intended rules change)
 * A pure refactor must reproduce the fingerprints exactly.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { autoplay } from '../src/engine/autoplay';
import { eligiblePlayers } from '../src/engine/calibration';
import { encounterIds } from '../src/engine/encounter';
import type { HeroGamePick } from '../src/engine/horde';
import { computePool, seasonTier } from '../src/engine/rating';
import { smartAutoplay } from '../src/engine/smartBot';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { CLASSES, tierIndex } from '../src/rules';
import { loadSeasonFile } from './load-season';
import { simulateSeasons } from './season-lib';

const FILE = new URL('./golden.json', import.meta.url);
const data = loadSeasonFile();
const players = eligiblePlayers(data);

function lineups(n: number, seedIn: number): HeroGamePick[][] {
  let seed = seedIn;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const out: HeroGamePick[][] = [];
  while (out.length < n) {
    const week = data.weeks[Math.floor(rand() * data.weeks.length)];
    const draw = players.filter(() => rand() < 0.33);
    const used = new Set<number>();
    const picks: HeroGamePick[] = [];
    for (const c of CLASSES) {
      const best = draw
        .filter((p) => !used.has(p.id) && playerGamesInWeek(data, week, p.id).length > 0)
        .sort((a, b) => tierIndex(seasonTier(c, b.avg)) - tierIndex(seasonTier(c, a.avg)))[0];
      if (!best) continue;
      used.add(best.id);
      const games = playerGamesInWeek(data, week, best.id);
      const gameId = games
        .map((g) => ({
          g,
          pool: computePool(
            c,
            data.games[g].lines.find((l) => l.playerId === best.id)!,
          ).pool,
        }))
        .sort((a, b) => b.pool - a.pool)[0].g;
      picks.push({ heroClass: c, playerId: best.id, gameId });
    }
    if (picks.length) out.push(picks);
  }
  return out;
}

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const result: Record<string, { fingerprint: string; wins: number; battles: number }> = {};
for (const enc of encounterIds()) {
  for (const [bot, n] of [
    ['fast', 120],
    ['smart', 8],
  ] as const) {
    const ends = lineups(n, 11).map((picks) => {
      const b = prepareBattle(picks, data, undefined, enc).battle;
      return bot === 'smart' ? smartAutoplay(b) : autoplay(b);
    });
    result[`${enc}/${bot}`] = {
      fingerprint: hash(ends.map((e) => [e.log, e.heroes, e.enemies.map((x) => [x.id, x.hp, x.alive])])),
      wins: ends.filter((e) => e.phase === 'won').length,
      battles: n,
    };
  }
}
const seasons = simulateSeasons(data, 4, 'greedy', 'smart');
result['seasons/fast'] = { fingerprint: hash(seasons), wins: seasons.filter((w) => w.won).length, battles: seasons.length };

if (process.argv.includes('--update') || !existsSync(FILE)) {
  writeFileSync(FILE, JSON.stringify(result, null, 2) + '\n');
  console.log(
    'Recorded golden baseline:',
    Object.entries(result)
      .map(([k, v]) => `${k} ${v.wins}/${v.battles}`)
      .join(' · '),
  );
} else {
  const want = JSON.parse(readFileSync(FILE, 'utf8')) as typeof result;
  let ok = true;
  for (const [k, v] of Object.entries(want)) {
    const got = result[k];
    const same = got && got.fingerprint === v.fingerprint;
    if (!same) ok = false;
    console.log(`${same ? '✓' : '✗'} ${k.padEnd(22)} ${got ? `${got.wins}/${got.battles}` : 'missing'}${same ? '' : `  (baseline ${v.wins}/${v.battles})`}`);
  }
  if (!ok) {
    console.error('Golden check failed: battle results changed.');
    process.exit(1);
  }
  console.log('Golden check passed.');
}

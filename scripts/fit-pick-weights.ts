/**
 * Learns what each game-choice factor is worth in each encounter, for Smart pick:
 *   npm run data:fit-picks -- [--battles 3000]
 * Plays random lineups with random game choices, fits a logistic regression of
 * win/loss on hero energy, unlocks and the horde's strength, converts the
 * coefficients into starting-energy points and writes src/rules/pickWeights.json.
 */
import { writeFileSync } from 'node:fs';
import { autoplay } from '../src/engine/autoplay';
import { eligiblePlayers } from '../src/engine/calibration';
import { encounterIds } from '../src/engine/encounter';
import type { HeroGamePick, Horde } from '../src/engine/horde';
import { seasonTier } from '../src/engine/rating';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { CLASSES, tierIndex, type ChampionKind, type HeroClass } from '../src/rules';
import { loadSeasonFile } from './load-season';

const arg = (name: string, d: number) => (process.argv.includes(name) ? Number(process.argv[process.argv.indexOf(name) + 1]) : d);
const BATTLES = arg('--battles', 3000);
const ROLES: ChampionKind[] = ['ogre', 'warlock', 'hunter', 'assassin', 'shaman'];
// Feature order: energy per class (÷10), double-doubles, triple-doubles, Champion tier per role, boss tier, traits, Fumbles.
const NAMES = [...CLASSES.map((c) => `energy:${c}`), 'doubleDouble', 'tripleDouble', ...ROLES.map((r) => `tier:${r}`), 'bossTier', 'trait', 'fumble'];

function features(
  picks: HeroGamePick[],
  pools: Partial<Record<HeroClass, { pool: number; doubleDouble: boolean; tripleDouble: boolean }>>,
  horde: Horde,
): number[] {
  const energy = CLASSES.map((c) => (pools[c]?.pool ?? 0) / 10);
  const dd = picks.filter((p) => pools[p.heroClass]?.doubleDouble && !pools[p.heroClass]?.tripleDouble).length;
  const td = picks.filter((p) => pools[p.heroClass]?.tripleDouble).length;
  const tier = ROLES.map((r) => tierIndex(horde.champions.find((m) => m.kind === r)?.tier ?? 'average'));
  const all = [...horde.champions, horde.warlord];
  return [
    ...energy,
    dd,
    td,
    ...tier,
    tierIndex(horde.warlord.tier ?? 'cold'),
    all.reduce((t, m) => t + (m.traits?.length ?? 0), 0),
    all.reduce((t, m) => t + m.fumbles, 0),
  ];
}

/** Plain logistic regression by gradient descent, with a little L2 to steady noisy coefficients. */
function fit(X: number[][], y: number[]): number[] {
  const n = X[0].length;
  const mean = Array.from({ length: n }, (_, j) => X.reduce((t, r) => t + r[j], 0) / X.length);
  const sd = Array.from({ length: n }, (_, j) => Math.sqrt(X.reduce((t, r) => t + (r[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / sd[j]));
  let w = new Array(n).fill(0);
  let b = 0;
  for (let it = 0; it < 3000; it++) {
    const g = new Array(n).fill(0);
    let gb = 0;
    for (let i = 0; i < Z.length; i++) {
      const p = 1 / (1 + Math.exp(-(b + Z[i].reduce((t, v, j) => t + v * w[j], 0))));
      const e = p - y[i];
      for (let j = 0; j < n; j++) g[j] += e * Z[i][j];
      gb += e;
    }
    w = w.map((v, j) => v - 0.5 * (g[j] / Z.length + 0.01 * v));
    b -= 0.5 * (gb / Z.length);
  }
  return w.map((v, j) => v / sd[j]); // back to raw feature units
}

const data = loadSeasonFile();
const players = eligiblePlayers(data);
const out: Record<string, unknown> = {};
for (const enc of encounterIds()) {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const X: number[][] = [];
  const y: number[] = [];
  for (let b = 0; b < BATTLES; b++) {
    const week = data.weeks[Math.floor(rand() * data.weeks.length)];
    const draw = players.filter(() => rand() < 0.33);
    const used = new Set<number>();
    const picks: HeroGamePick[] = [];
    for (const c of CLASSES) {
      const best = draw
        .filter((p) => !used.has(p.id) && playerGamesInWeek(data, week, p.id).length > 0)
        .sort((a, b2) => tierIndex(seasonTier(c, b2.avg)) - tierIndex(seasonTier(c, a.avg)))[0];
      if (!best) continue;
      used.add(best.id);
      const games = playerGamesInWeek(data, week, best.id);
      picks.push({ heroClass: c, playerId: best.id, gameId: games[Math.floor(rand() * games.length)] });
    }
    if (picks.length < 5) continue;
    const prepared = prepareBattle(picks, data, undefined, enc);
    const end = autoplay(prepared.battle);
    X.push(features(picks, prepared.pools as never, prepared.horde));
    y.push(end.phase === 'won' ? 1 : 0);
  }
  const w = fit(X, y);
  // One energy point is worth the average class's energy coefficient (features count energy in tens).
  const point = CLASSES.reduce((t, _, i) => t + w[i], 0) / CLASSES.length / 10;
  const pts = (v: number) => Math.round((v / point) * 10) / 10;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  out[enc] = {
    battles: X.length,
    winRate: Math.round((y.reduce((t, v) => t + v, 0) / y.length) * 1000) / 1000,
    energy: Object.fromEntries(CLASSES.map((c, i) => [c, Math.round(clamp(w[i] / 10 / point, 0.3, 2.5) * 100) / 100])),
    doubleDouble: clamp(pts(w[5]), 0, 25),
    tripleDouble: clamp(pts(w[6]), 0, 60),
    championTier: Object.fromEntries(ROLES.map((r, i) => [r, clamp(-pts(w[7 + i]), 0, 40)])),
    bossTier: clamp(-pts(w[12]), 0, 40),
    trait: clamp(-pts(w[13]), 0, 20),
    fumble: clamp(pts(w[14]), 0, 15),
  };
  console.log(enc, JSON.stringify(out[enc]));
  console.log('  raw:', NAMES.map((n, i) => `${n} ${w[i].toFixed(3)}`).join(', '));
}
writeFileSync(new URL('../src/rules/pickWeights.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('Wrote src/rules/pickWeights.json');

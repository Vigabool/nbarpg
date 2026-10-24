/**
 * Battle simulation with the auto-play bot, shared by simulate.ts and tuning
 * sweeps. Each battle: a random week, the strongest available player for each
 * class among a random draw, and each hero's best game that week.
 */
import { CLASSES, type HeroClass } from '../src/rules';
import { autoplay, type BotPolicy } from '../src/engine/autoplay';
import { eligiblePlayers } from '../src/engine/calibration';
import type { HeroGamePick } from '../src/engine/horde';
import { computePool, seasonTier } from '../src/engine/rating';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { tierIndex } from '../src/rules';
import type { SeasonData } from '../src/data/types';

export interface SimResult {
  battles: number;
  winRate: number;
  avgRounds: number;
  fallenPerBattle: number;
  roundCapLosses: number;
  wavesCleared: number[];
  avgPool: number;
  monsters: number;
  goblins: number;
  /** Goblin attacks that landed on a hero or summon, per battle. */
  goblinAttacks: number;
  goblinDamage: number;
  /** Champions knocked down by Topple (the Giant's Hall), per battle. */
  topplesPerBattle: number;
}

export function simulate(data: SeasonData, battles: number, seedIn = 1, encounter?: string, policy: BotPolicy = {}): SimResult {
  let seed = seedIn;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const pool = eligiblePlayers(data);
  const r = { won: 0, lost: 0, rounds: 0, waves: [0, 0, 0, 0], fallen: 0, roundCap: 0, pools: [] as number[], horde: 0, goblins: 0, gobAttacks: 0, gobDamage: 0, topples: 0 };
  for (let b = 0; b < battles; b++) {
    const week = data.weeks[Math.floor(rand() * data.weeks.length)];
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
    const prepared = prepareBattle(picks, data, undefined, encounter);
    r.horde += prepared.horde.waves.flat().length;
    r.goblins += prepared.horde.waves.flat().filter((m) => m.kind === 'goblin').length;
    for (const p of Object.values(prepared.pools)) r.pools.push(p!.pool);
    const end = autoplay(prepared.battle, undefined, policy);
    if (end.phase === 'won') r.won++;
    else r.lost++;
    if (end.outcomeReason?.includes('rounds')) r.roundCap++;
    r.rounds += end.round;
    r.waves[Math.min(3, end.stats.wavesCleared)]++;
    r.fallen += end.heroes.filter((h) => !h.alive).length;
    r.topples += end.log.filter((l) => l.short === '⛰️ Toppled').length;
    for (const l of end.log) {
      const actor = end.enemies.find((e) => e.id === l.actorId);
      if (l.side !== 'enemy' || actor?.kind !== 'goblin' || !l.short?.startsWith('→')) continue;
      r.gobAttacks++;
      r.gobDamage += Number(l.short.match(/(\d+)/)?.[1] ?? 0);
    }
  }
  const n = r.won + r.lost;
  return {
    battles: n,
    winRate: r.won / n,
    avgRounds: r.rounds / n,
    fallenPerBattle: r.fallen / n,
    roundCapLosses: r.roundCap,
    wavesCleared: r.waves,
    avgPool: r.pools.reduce((a, b) => a + b, 0) / r.pools.length,
    monsters: r.horde / n,
    goblins: r.goblins / n,
    goblinAttacks: r.gobAttacks / n,
    topplesPerBattle: r.topples / n,
    goblinDamage: r.gobDamage / n,
  };
}

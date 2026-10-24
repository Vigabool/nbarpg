import type { SeasonData, Week } from '../data/types';
import { rules as defaultRules, type HeroClass, type Rules } from '../rules';
import { createBattle, type BattleState, type HeroSetup } from './combat';
import { buildHorde, playerLine, type HeroGamePick, type Horde } from './horde';
import { computePool, gearDamage, type PoolBreakdown } from './rating';

/** Games a player appeared in during a week. */
export function playerGamesInWeek(data: SeasonData, week: Week, playerId: number): string[] {
  return week.gameIds.filter((gid) => data.games[gid].lines.some((l) => l.playerId === playerId));
}

export interface PreparedBattle {
  picks: HeroGamePick[];
  pools: Partial<Record<HeroClass, PoolBreakdown>>;
  heroes: HeroSetup[];
  horde: Horde;
  battle: BattleState;
}

export function prepareBattle(picks: HeroGamePick[], data: SeasonData, rules: Rules = defaultRules, encounter?: string): PreparedBattle {
  const pools: Partial<Record<HeroClass, PoolBreakdown>> = {};
  const heroes: HeroSetup[] = picks.map((p) => {
    const line = playerLine(data, p.gameId, p.playerId);
    if (!line) throw new Error(`Player ${p.playerId} has no line in game ${p.gameId}`);
    const pool = computePool(p.heroClass, line, rules);
    pools[p.heroClass] = pool;
    const player = data.players[p.playerId];
    return { heroClass: p.heroClass, playerId: p.playerId, playerName: player.name, gear: gearDamage(p.heroClass, player.avg, rules), pool };
  });
  const horde = buildHorde(picks, data, rules, encounter);
  return { picks, pools, heroes, horde, battle: createBattle(heroes, horde.waves, rules, encounter ?? rules.encounters.default) };
}

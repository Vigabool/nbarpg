import type { SeasonData, Week } from '../data/types';
import { rules as defaultRules, type Difficulty, type HeroClass, type HeroProgress, type Rules } from '../rules';
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

export interface PrepareOptions {
  /** Armory purchases per hero. */
  progress?: Partial<Record<HeroClass, HeroProgress>>;
  /** Chapter (1-based): Champions and bosses grow stronger each chapter after the first. */
  chapter?: number;
  /** Difficulty (see rules/difficulty.json). Hard, the full-strength tuning, when absent. */
  difficulty?: Difficulty;
}

/** Chapter scaling: +X% HP and damage for every Champion and boss per chapter after the first. */
export function scaleHorde(horde: Horde, chapter: number, rules: Rules = defaultRules): Horde {
  const f = 1 + rules.progression.chapterScaling * Math.max(0, chapter - 1);
  if (f === 1) return horde;
  const scale = (m: Horde['waves'][number][number]) => (m.kind === 'goblin' ? m : { ...m, hp: Math.round(m.hp * f), damage: Math.round(m.damage * f) });
  const waves = horde.waves.map((w) => w.map(scale));
  const byId = new Map(waves.flat().map((m) => [m.id, m]));
  return { waves, champions: horde.champions.map((c) => byId.get(c.id) ?? scale(c)), warlord: byId.get(horde.warlord.id) ?? scale(horde.warlord) };
}

/** Difficulty: scales the horde's Champions and bosses (and minions, if set) for this encounter. Hard leaves it as is. */
export function difficultyHorde(horde: Horde, encounter: string, difficulty: Difficulty, rules: Rules = defaultRules): Horde {
  const d = rules.difficulty.levels[difficulty]?.encounters[encounter];
  if (!d || (!d.champions && !d.minions)) return horde;
  const scale = (m: Horde['waves'][number][number]) => {
    const f = m.kind === 'goblin' ? d.minions : d.champions;
    return f ? { ...m, hp: Math.max(1, Math.round(m.hp * f.hp)), damage: Math.max(1, Math.round(m.damage * f.damage)) } : m;
  };
  const waves = horde.waves.map((w) => w.map(scale));
  const byId = new Map(waves.flat().map((m) => [m.id, m]));
  return { waves, champions: horde.champions.map((c) => byId.get(c.id) ?? scale(c)), warlord: byId.get(horde.warlord.id) ?? scale(horde.warlord) };
}

export function prepareBattle(
  picks: HeroGamePick[],
  data: SeasonData,
  rules: Rules = defaultRules,
  encounter?: string,
  opts: PrepareOptions = {},
): PreparedBattle {
  const pools: Partial<Record<HeroClass, PoolBreakdown>> = {};
  const heroes: HeroSetup[] = picks.map((p) => {
    const line = playerLine(data, p.gameId, p.playerId);
    if (!line) throw new Error(`Player ${p.playerId} has no line in game ${p.gameId}`);
    const pool = computePool(p.heroClass, line, rules);
    pools[p.heroClass] = pool;
    const player = data.players[p.playerId];
    return {
      heroClass: p.heroClass,
      playerId: p.playerId,
      playerName: player.name,
      gear: gearDamage(p.heroClass, player.avg, rules),
      pool,
      progress: opts.progress?.[p.heroClass],
    };
  });
  const enc = encounter ?? rules.encounters.default;
  const horde = difficultyHorde(scaleHorde(buildHorde(picks, data, rules, encounter), opts.chapter ?? 1, rules), enc, opts.difficulty ?? 'hard', rules);
  return { picks, pools, heroes, horde, battle: createBattle(heroes, horde.waves, rules, encounter ?? rules.encounters.default) };
}

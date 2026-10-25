import type { SeasonData } from '../data/types';
import { buildHorde, playerLine, type HeroGamePick, type Horde, type MonsterSpec } from '../engine/horde';
import { computePool } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules as defaultRules, tierIndex, type HeroClass, type Rules } from '../rules';
import { bestGames } from './autoAssign';
import { currentWeek, type SaveGame } from './game';

/** What each factor is worth, in starting-energy points. */
export interface PickWeights {
  doubleDouble: number;
  tripleDouble: number;
  /** Per tier of a mirrored Champion (Cold 0 … Elite 4). */
  championTier: number;
  /** Per tier of the boss. */
  bossTier: number;
  /** Per trait on a Champion or the boss. */
  trait: number;
  /** Per Fumble the party gets to spend. */
  fumble: number;
}

export const DEFAULT_PICK_WEIGHTS: PickWeights = { doubleDouble: 8, tripleDouble: 16, championTier: 3, bossTier: 5, trait: 6, fumble: 4 };

/** How dangerous a horde is, in energy points: Champion and boss tiers and traits, less the Fumbles it hands you. */
function hordeThreat(h: Horde, w: PickWeights): number {
  const one = (m: MonsterSpec, perTier: number) => perTier * tierIndex(m.tier ?? 'cold') + w.trait * (m.traits?.length ?? 0) - w.fumble * m.fumbles;
  return h.champions.reduce((t, m) => t + one(m, w.championTier), 0) + one(h.warlord, w.bossTier);
}

/** The value of a set of game picks: hero energy and Signature/Legendary unlocks, less the horde they bring. */
export function picksValue(picks: HeroGamePick[], data: SeasonData, encounter: string | undefined, w: PickWeights = DEFAULT_PICK_WEIGHTS, rules: Rules = defaultRules): number {
  if (picks.length === 0) return 0;
  let value = 0;
  for (const p of picks) {
    const pool = computePool(p.heroClass, playerLine(data, p.gameId, p.playerId)!, rules);
    value += pool.pool + (pool.tripleDouble ? w.tripleDouble : pool.doubleDouble ? w.doubleDouble : 0);
  }
  return value - hordeThreat(buildHorde(picks, data, rules, encounter), w);
}

/**
 * Smart pick: start from the most-energy games, then improve one hero at a time,
 * keeping a different game whenever the whole lineup (energy, unlocks, and the horde
 * it builds, including who becomes the boss) scores better.
 */
export function smartGames(game: SaveGame, data: SeasonData, w: PickWeights = DEFAULT_PICK_WEIGHTS, rules: Rules = defaultRules): Partial<Record<HeroClass, string>> {
  const week = currentWeek(game, data);
  const picks = { ...bestGames(game, data) };
  if (!week) return picks;
  const toList = (p: Partial<Record<HeroClass, string>>): HeroGamePick[] =>
    CLASSES.filter((c) => p[c] && game.assignments[c] !== undefined).map((c) => ({ heroClass: c, playerId: game.assignments[c]!, gameId: p[c]! }));
  let best = picksValue(toList(picks), data, game.encounter, w, rules);
  for (let pass = 0; pass < 2; pass++) {
    let improved = false;
    for (const c of CLASSES) {
      const pid = game.assignments[c];
      if (pid === undefined) continue;
      for (const g of playerGamesInWeek(data, week, pid)) {
        if (g === picks[c]) continue;
        const trial = { ...picks, [c]: g };
        const v = picksValue(toList(trial), data, game.encounter, w, rules);
        if (v > best) {
          best = v;
          picks[c] = g;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return picks;
}

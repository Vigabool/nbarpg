import type { SeasonData } from '../data/types';
import { buildHorde, playerLine, type HeroGamePick, type Horde, type MonsterSpec } from '../engine/horde';
import { computePool } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import fitted from '../rules/pickWeights.json';
import { CLASSES, rules as defaultRules, tierIndex, type ChampionKind, type HeroClass, type Rules } from '../rules';
import { bestGames } from './autoAssign';
import { currentWeek, type SaveGame } from './game';

/** What each factor is worth, in starting-energy points. */
export interface PickWeights {
  /** How much one point of each class's energy is worth (1 = average), e.g. the Wizard's AoE matters more against goblins. */
  energy?: Partial<Record<HeroClass, number>>;
  doubleDouble: number;
  tripleDouble: number;
  /** Per tier of a mirrored Champion (Cold 0 … Elite 4), overall or per role. */
  championTier: number | Partial<Record<ChampionKind, number>>;
  /** Per tier of the boss. */
  bossTier: number;
  /** Per trait on a Champion or the boss. */
  trait: number;
  /** Per Fumble the party gets to spend. */
  fumble: number;
}

export const DEFAULT_PICK_WEIGHTS: PickWeights = { doubleDouble: 8, tripleDouble: 16, championTier: 3, bossTier: 5, trait: 6, fumble: 4 };

/**
 * How far to trust the fitted danger and bonus weights over the defaults. The fit uses random
 * lineups, which overstate threats for real picks; in season simulations, half-way did best
 * (58% bot wins, vs 55% with defaults alone and 56% with the raw fit).
 */
const FIT_TRUST = 0.5;

/**
 * Weights for an encounter: the per-class energy values learned by `npm run data:fit-picks`
 * (a logistic regression over simulated battles), with danger and bonus weights blended
 * half-way toward the hand-set defaults. Unfitted encounters use the defaults.
 */
export function encounterWeights(encounter: string | undefined, rules: Rules = defaultRules): PickWeights {
  const fit = (fitted as Record<string, PickWeights | undefined>)[encounter ?? rules.encounters.default];
  if (!fit) return DEFAULT_PICK_WEIGHTS;
  const d = DEFAULT_PICK_WEIGHTS;
  const mix = (f: number, base: number) => base + (f - base) * FIT_TRUST;
  const perRole = fit.championTier as Partial<Record<ChampionKind, number>>;
  return {
    energy: fit.energy,
    doubleDouble: mix(fit.doubleDouble, d.doubleDouble),
    tripleDouble: mix(fit.tripleDouble, d.tripleDouble),
    championTier: Object.fromEntries(Object.entries(perRole).map(([k, v]) => [k, mix(v ?? 0, d.championTier as number)])),
    bossTier: mix(fit.bossTier, d.bossTier),
    trait: mix(fit.trait, d.trait),
    fumble: mix(fit.fumble, d.fumble),
  };
}

const tierWeight = (w: PickWeights, kind: MonsterSpec['kind']) =>
  typeof w.championTier === 'number' ? w.championTier : (w.championTier[kind as ChampionKind] ?? 0);

/** How dangerous a horde is, in energy points: Champion and boss tiers and traits, less the Fumbles it hands you. */
function hordeThreat(h: Horde, w: PickWeights): number {
  const one = (m: MonsterSpec, perTier: number) => perTier * tierIndex(m.tier ?? 'cold') + w.trait * (m.traits?.length ?? 0) - w.fumble * m.fumbles;
  return h.champions.reduce((t, m) => t + one(m, tierWeight(w, m.kind)), 0) + one(h.warlord, w.bossTier);
}

/** The value of a set of game picks: hero energy and Signature/Legendary unlocks, less the horde they bring. */
export function picksValue(picks: HeroGamePick[], data: SeasonData, encounter: string | undefined, w: PickWeights = DEFAULT_PICK_WEIGHTS, rules: Rules = defaultRules): number {
  if (picks.length === 0) return 0;
  let value = 0;
  for (const p of picks) {
    const pool = computePool(p.heroClass, playerLine(data, p.gameId, p.playerId)!, rules);
    value += pool.pool * (w.energy?.[p.heroClass] ?? 1) + (pool.tripleDouble ? w.tripleDouble : pool.doubleDouble ? w.doubleDouble : 0);
  }
  return value - hordeThreat(buildHorde(picks, data, rules, encounter), w);
}

/**
 * Smart pick: start from the most-energy games, then improve one hero at a time,
 * keeping a different game whenever the whole lineup (energy, unlocks, and the horde
 * it builds, including who becomes the boss) scores better.
 */
export function smartGames(
  game: SaveGame,
  data: SeasonData,
  w: PickWeights = encounterWeights(game.encounter),
  rules: Rules = defaultRules,
): Partial<Record<HeroClass, string>> {
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

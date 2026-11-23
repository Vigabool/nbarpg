/**
 * Suggested heroes and game picks for the play-calling game. The main game's helpers score energy
 * and main-game threats (traits, Fumbles); these score what matters here: the hero's tier, touches,
 * defense tier and double-double/triple-double special, less the Champions and goblins the games bring.
 * Node-safe, so the simulator uses the same picks as the setup screens.
 */
import type { SeasonData } from '../../../../src/data/types';
import { buildHorde, playerLine } from '../../../../src/engine/horde';
import { computePool, seasonTier } from '../../../../src/engine/rating';
import { playerGamesInWeek } from '../../../../src/engine/week';
import { rules, tierIndex as mainTierIndex, type HeroClass } from '../../../../src/rules';
import type { EnemyKind } from '../content';
import { ROLE_OF } from '../engine';
import { ENCOUNTER, SETUP_CLASSES, defRating, defTierOf, teamOf, touchesOf } from './buildWeek';

export interface PickWeights {
  /** Per touch. */
  touch: number;
  /** Per tier step (cold 0 … elite 4): each step is roughly +15% on the hero's moves. */
  tier: number;
  /** Per defense tier step, for the turns the hero defends. */
  defense: number;
  doubleDouble: number;
  tripleDouble: number;
  /** Per tier step of a Champion the games bring, by its role here. */
  threat: Partial<Record<EnemyKind, number>>;
  /** Per tier step of the boss. */
  boss: number;
  /** Per goblin. */
  goblin: number;
}

/**
 * Tuned with the built-roster simulator (ROSTERS=8, all four draft modes, 32 rosters): weighing the
 * horde three times heavier than a first guess did best (expert bot +7.5 a game on Normal, against
 * −0.6 with the main game's energy picks); weighing touches more did worse.
 */
export const PICK_WEIGHTS: PickWeights = {
  touch: 1,
  tier: 1.5,
  defense: 0.75,
  doubleDouble: 1.5,
  tripleDouble: 3,
  threat: { shaman: 3.6, hexer: 1.8, ogre: 2.4, cutthroat: 2.4, sharpshooter: 2.4 },
  boss: 4.5,
  goblin: 0.75,
};

type Picks = Partial<Record<HeroClass, string>>;
const tierStep = (t: string) => mainTierIndex(t as never);

/** A hero's value from one game: tier, touches, defense and special. */
export function heroValue(data: SeasonData, cls: HeroClass, playerId: number, gameId: string, w: PickWeights = PICK_WEIGHTS): number {
  const l = playerLine(data, gameId, playerId)!;
  const pool = computePool(cls, l);
  return (
    w.touch * touchesOf(l) +
    w.tier * tierStep(pool.tier) +
    w.defense * tierStep(defTierOf(defRating(l))) +
    (pool.tripleDouble ? w.tripleDouble : pool.doubleDouble ? w.doubleDouble : 0)
  );
}

/** How much the horde these picks bring is worth to the horde: Champions by role and tier, the boss, goblins. */
export function hordeThreat(data: SeasonData, assignments: Partial<Record<HeroClass, number>>, picks: Picks, w: PickWeights = PICK_WEIGHTS): number {
  const list = SETUP_CLASSES.filter((c) => picks[c] && assignments[c] !== undefined).map((c) => ({
    heroClass: c,
    playerId: assignments[c]!,
    gameId: picks[c]!,
  }));
  if (!list.length) return 0;
  const h = buildHorde(list, data, rules, ENCOUNTER);
  const champs = h.champions.reduce((s, m) => s + (w.threat[ROLE_OF[m.kind]] ?? 0.8) * tierStep(m.tier ?? 'average'), 0);
  const goblins = list.reduce((s, p) => s + teamOf(data, p.playerId, p.gameId).goblins, 0);
  return champs + w.boss * tierStep(h.warlord.tier ?? 'average') + w.goblin * goblins;
}

const totalValue = (data: SeasonData, a: Partial<Record<HeroClass, number>>, picks: Picks, w: PickWeights) =>
  SETUP_CLASSES.reduce((s, c) => s + (picks[c] && a[c] !== undefined ? heroValue(data, c, a[c]!, picks[c]!, w) : 0), 0) - hordeThreat(data, a, picks, w);

/** Smart pick: the best game for each hero, then two passes that also weigh the horde the games bring together. */
export function smartPicks(data: SeasonData, weekIndex: number, assignments: Partial<Record<HeroClass, number>>, w: PickWeights = PICK_WEIGHTS): Picks {
  const week = data.weeks.find((x) => x.index === weekIndex)!;
  const options = (c: HeroClass) => (assignments[c] === undefined ? [] : playerGamesInWeek(data, week, assignments[c]!));
  const picks: Picks = {};
  for (const c of SETUP_CLASSES) {
    const best = options(c).sort((a, b) => heroValue(data, c, assignments[c]!, b, w) - heroValue(data, c, assignments[c]!, a, w))[0];
    if (best) picks[c] = best;
  }
  let best = totalValue(data, assignments, picks, w);
  for (let pass = 0; pass < 2; pass++) {
    for (const c of SETUP_CLASSES) {
      for (const gid of options(c)) {
        if (gid === picks[c]) continue;
        const trial = { ...picks, [c]: gid };
        const v = totalValue(data, assignments, trial, w);
        if (v > best) {
          best = v;
          Object.assign(picks, trial);
        }
      }
    }
  }
  return picks;
}

/** Each hero's game with the most touches (ties: the higher tier). */
export function mostTouches(data: SeasonData, weekIndex: number, assignments: Partial<Record<HeroClass, number>>): Picks {
  const week = data.weeks.find((x) => x.index === weekIndex)!;
  const picks: Picks = {};
  for (const c of SETUP_CLASSES) {
    const pid = assignments[c];
    if (pid === undefined) continue;
    const key = (g: string) => {
      const l = playerLine(data, g, pid)!;
      return touchesOf(l) * 10 + tierStep(computePool(c, l).tier);
    };
    const best = playerGamesInWeek(data, week, pid).sort((a, b) => key(b) - key(a))[0];
    if (best) picks[c] = best;
  }
  return picks;
}

/**
 * Suggested heroes: the assignment of rostered players to the five heroes with the highest total
 * season value in play-calling terms (class tier, touches, defense). Players with a game this week come first.
 * `data` should be the week's form view (ratings as of that week).
 */
export function suggestHeroes(
  data: SeasonData,
  full: SeasonData,
  weekIndex: number,
  roster: number[],
  w: PickWeights = PICK_WEIGHTS,
): Partial<Record<HeroClass, number>> {
  const week = full.weeks.find((x) => x.index === weekIndex)!;
  const value = new Map<string, number>();
  for (const id of roster) {
    const p = data.players[id];
    const plays = playerGamesInWeek(full, week, id).length > 0;
    for (const c of SETUP_CLASSES) {
      const v = p ? w.tier * tierStep(seasonTier(c, p.avg)) + w.touch * touchesOf(p.avg) + w.defense * tierStep(defTierOf(defRating(p.avg))) : -50;
      value.set(`${c}:${id}`, v + (plays ? 100 : 0));
    }
  }
  let best: { v: number; a: Partial<Record<HeroClass, number>> } = { v: -Infinity, a: {} };
  const walk = (i: number, used: Set<number>, a: Partial<Record<HeroClass, number>>, v: number) => {
    if (i === SETUP_CLASSES.length || used.size === roster.length) {
      if (v > best.v) best = { v, a: { ...a } };
      return;
    }
    const c = SETUP_CLASSES[i];
    for (const id of roster) {
      if (used.has(id)) continue;
      used.add(id);
      a[c] = id;
      walk(i + 1, used, a, v + value.get(`${c}:${id}`)!);
      delete a[c];
      used.delete(id);
    }
  };
  walk(0, new Set(), {}, 0);
  return best.a;
}

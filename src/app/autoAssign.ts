import type { SeasonData } from '../data/types';
import { playerLine } from '../engine/horde';
import { computePool, seasonTier } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, tierIndex, type HeroClass } from '../rules';
import { currentWeek, type SaveGame } from './game';

/**
 * Suggested hero assignments for the week: players with a game first, then the
 * best season tier in each class. Classes with the fewest strong options pick first.
 */
export function autoAssign(game: SaveGame, data: SeasonData): Partial<Record<HeroClass, number>> {
  const week = currentWeek(game, data);
  const games = (id: number) => (week ? playerGamesInWeek(data, week, id).length : 0);
  const next: Partial<Record<HeroClass, number>> = {};
  const used = new Set<number>();
  const order = [...CLASSES].sort(
    (a, b) =>
      game.roster.filter((id) => tierIndex(seasonTier(a, data.players[id].avg)) >= 2).length -
      game.roster.filter((id) => tierIndex(seasonTier(b, data.players[id].avg)) >= 2).length,
  );
  for (const c of order) {
    const best = game.roster
      .filter((id) => !used.has(id))
      .sort(
        (a, b) =>
          Number(games(b) > 0) - Number(games(a) > 0) || tierIndex(seasonTier(c, data.players[b].avg)) - tierIndex(seasonTier(c, data.players[a].avg)),
      )[0];
    if (best !== undefined) {
      next[c] = best;
      used.add(best);
    }
  }
  return next;
}

/** For each assigned hero, the game this week that gives them the most starting energy. */
export function bestGames(game: SaveGame, data: SeasonData): Partial<Record<HeroClass, string>> {
  const week = currentWeek(game, data);
  const picks: Partial<Record<HeroClass, string>> = {};
  if (!week) return picks;
  for (const c of CLASSES) {
    const pid = game.assignments[c];
    if (pid === undefined) continue;
    const best = playerGamesInWeek(data, week, pid)
      .map((g) => ({ g, pool: computePool(c, playerLine(data, g, pid)!).pool }))
      .sort((a, b) => b.pool - a.pool)[0];
    if (best) picks[c] = best.g;
  }
  return picks;
}

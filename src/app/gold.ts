import type { SeasonData } from '../data/types';
import { eligiblePlayers } from '../engine/calibration';
import { computeSalary } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules as defaultRules, type Rules } from '../rules';
import { currentWeek, type SaveGame } from './game';

/**
 * Gold: the party's currency, earned every battle and spent on the roster. Salaries and
 * the cap are priced in gold too, so raising the cap is a straight gold-for-cap purchase.
 */

/** The salary cap, plus any cap room bought with gold. */
export function capOf(game: SaveGame, rules: Rules = defaultRules): number {
  return rules.salary.cap + (game.capBonus ?? 0);
}

/** Players who can be assigned this week: the roster plus any ten-day contracts. */
export function weekRoster(game: SaveGame): number[] {
  return [...game.roster, ...(game.tenDay ?? []).map((t) => t.playerId)];
}

export const isTenDay = (game: SaveGame, playerId: number) => !!game.tenDay?.some((t) => t.playerId === playerId);

/** A ten-day contract's fee: a fraction of the player's salary, with a floor. */
export function tenDayFee(data: SeasonData, playerId: number, rules: Rules = defaultRules): number {
  const t = rules.salary.gold.tenDay;
  return Math.max(t.minFee, Math.round(computeSalary(data.players[playerId].avg, rules).salary * t.feeFraction));
}

/** Why the party can't sign a ten-day contract right now, or null if it can (fee aside). */
export function tenDayBlocked(game: SaveGame, rules: Rules = defaultRules): string | null {
  if (game.phase !== 'assign' && game.phase !== 'select') return 'Only before the battle';
  if ((game.tenDay?.length ?? 0) >= rules.salary.gold.tenDay.perWeek) return `Up to ${rules.salary.gold.tenDay.perWeek} a week`;
  return null;
}

/** Free agents worth a ten-day contract this week: eligible, not rostered, with a game this week. */
export function tenDayCandidates(game: SaveGame, data: SeasonData): number[] {
  const week = currentWeek(game, data);
  if (!week) return [];
  const taken = new Set(weekRoster(game));
  return eligiblePlayers(data)
    .filter((p) => !taken.has(p.id) && playerGamesInWeek(data, week, p.id).length > 0)
    .map((p) => p.id);
}

/** Signs a player for this week only: no cap space or roster move, just the fee. */
export function signTenDay(game: SaveGame, data: SeasonData, playerId: number, rules: Rules = defaultRules): SaveGame {
  const blocked = tenDayBlocked(game, rules);
  if (blocked) throw new Error(blocked);
  if (!tenDayCandidates(game, data).includes(playerId)) throw new Error('Not available for a ten-day contract');
  const fee = tenDayFee(data, playerId, rules);
  if ((game.gold ?? 0) < fee) throw new Error(`Needs ${fee} gold`);
  return { ...game, gold: (game.gold ?? 0) - fee, tenDay: [...(game.tenDay ?? []), { playerId, fee }] };
}

/** Cancels a ten-day contract before the battle, refunding the fee and freeing the hero they were on. */
export function releaseTenDay(game: SaveGame, playerId: number): SaveGame {
  const contract = game.tenDay?.find((t) => t.playerId === playerId);
  if (!contract || (game.phase !== 'assign' && game.phase !== 'select')) return game;
  const assignments = { ...game.assignments };
  const gamePicks = { ...game.gamePicks };
  for (const c of CLASSES)
    if (assignments[c] === playerId) {
      delete assignments[c];
      delete gamePicks[c];
    }
  return {
    ...game,
    gold: (game.gold ?? 0) + contract.fee,
    tenDay: game.tenDay!.filter((t) => t.playerId !== playerId),
    assignments,
    gamePicks,
  };
}

/** Buys a step of permanent cap room. */
export function raiseCap(game: SaveGame, rules: Rules = defaultRules): SaveGame {
  const r = rules.salary.gold.capRaise;
  if ((game.gold ?? 0) < r.cost) throw new Error(`Needs ${r.cost} gold`);
  return { ...game, gold: (game.gold ?? 0) - r.cost, capBonus: (game.capBonus ?? 0) + r.step };
}

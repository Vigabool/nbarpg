import { buy, priceOf, type Purchase } from '../src/app/armory';
import { autoAssign, bestGames } from '../src/app/autoAssign';
import { smartGames, type PickWeights } from '../src/app/smartPick';
import { autoDraft, DRAFT_MODES, type DraftMode } from '../src/app/autoDraft';
import { chapterOf, currentWeek, finishBattle, newGame, nextWeek, readyPicks, startBattle, type SaveGame } from '../src/app/game';
import type { SeasonData } from '../src/data/types';
import { autoplay } from '../src/engine/autoplay';
import { smartAutoplay } from '../src/engine/smartBot';
import { encounterIds } from '../src/engine/encounter';
import { CLASSES, rules, tierIndex, type HeroClass } from '../src/rules';
import { signTenDay, tenDayBlocked, tenDayCandidates, tenDayFee } from '../src/app/gold';
import { seasonTier } from '../src/engine/rating';
import { playerGamesInWeek } from '../src/engine/week';

/** How the bot spends PP between weeks. */
export type SpendPolicy = 'none' | 'greedy';
/** How the bot picks each hero's game: the most energy, or the smart-pick score. */
export type PickPolicy = 'energy' | 'smart';
// 'smart' uses the encounter's fitted weights unless `weights` is given.

export interface SeasonWeek {
  run: number;
  week: number;
  chapter: number;
  encounter: string;
  won: boolean;
  rounds: number;
  /** PP spent per hero so far this run, averaged over the five heroes. */
  spentPerHero: number;
  /** Heroes on a fill-in below Good in their class, or with no game (after any ten-day contracts). */
  sittingOut: number;
  /** Ten-day contracts signed this week, and the gold left after the battle. */
  rented: number;
  gold: number;
}

/** How the bot uses gold: never, or ten-day contracts for heroes whose player has no game. */
export type GoldPolicy = 'none' | 'rent';

/**
 * Rents for the weakest spots first: a hero whose player has no game, or a fill-in below Good in
 * that class, gets the best affordable free agent if they're at least two tiers better.
 */
function rentForGaps(game: SaveGame, data: SeasonData): SaveGame {
  const week = currentWeek(game, data)!;
  const tierOf = (c: HeroClass, id: number | undefined) =>
    id === undefined || playerGamesInWeek(data, week, id).length === 0 ? -1 : tierIndex(seasonTier(c, data.players[id].avg));
  let g = game;
  const weakest = [...CLASSES].sort((a, b) => tierOf(a, g.assignments[a]) - tierOf(b, g.assignments[b]));
  for (const c of weakest) {
    const now = tierOf(c, g.assignments[c]);
    if (now >= tierIndex('good') || tenDayBlocked(g)) continue;
    const pick = tenDayCandidates(g, data)
      .filter((x) => tenDayFee(data, x) <= g.gold)
      .sort((a, b) => tierOf(c, b) - tierOf(c, a) || tenDayFee(data, a) - tenDayFee(data, b))[0];
    if (pick === undefined || tierOf(c, pick) < now + 2) continue;
    g = signTenDay(g, data, pick);
    g = { ...g, assignments: { ...g.assignments, [c]: pick } };
  }
  return g;
}

/** Everything a hero could buy, in the order the greedy bot prefers. */
function shoppingList(c: HeroClass): Purchase[] {
  const p = rules.progression;
  const list: Purchase[] = [{ kind: 'weapon' }];
  if (c === 'warrior') list.push({ kind: 'shield' });
  const gear = Object.entries(p.gear)
    .filter(([, g]) => g.heroClass === c)
    .sort((a, b) => a[1].cost - b[1].cost);
  for (const [id] of gear) list.push({ kind: 'gear', id });
  for (const [id, f] of Object.entries(p.feats)) if (f.heroClass === c) list.push({ kind: 'feat', id });
  return list;
}

/** Greedy: buy the first affordable thing on each hero's list until nothing is affordable. */
function spend(game: SaveGame): SaveGame {
  let g = game;
  for (const c of CLASSES) {
    for (let guard = 0; guard < 20; guard++) {
      const next = shoppingList(c).find((x) => {
        const price = priceOf(g, c, x);
        return price !== null && price <= g.pp[c];
      });
      if (!next) break;
      g = buy(g, c, next);
    }
  }
  return g;
}

/**
 * Plays whole seasons through the real game flow: auto-draft, weekly assignments and
 * game picks, auto-played battles, rewards, and (optionally) Armory purchases.
 * Runs vary by draft mode and by where the encounter rotation starts.
 */
export function simulateSeasons(
  data: SeasonData,
  runs: number,
  policy: SpendPolicy = 'greedy',
  pick: PickPolicy = 'energy',
  weights?: PickWeights | ((encounter: string) => PickWeights),
  bot: 'fast' | 'smart' = 'fast',
  gold: GoldPolicy = 'none',
): SeasonWeek[] {
  const encounters = encounterIds();
  const out: SeasonWeek[] = [];
  for (let run = 0; run < runs; run++) {
    const mode: DraftMode = DRAFT_MODES[run % DRAFT_MODES.length].id;
    const offset = Math.floor(run / DRAFT_MODES.length) % encounters.length;
    const first = data.weeks[0];
    let game: SaveGame | null = newGame(data.season, first.index);
    const draft = autoDraft(data, first, mode);
    if (!draft) continue;
    game = { ...game, roster: [...CLASSES.map((c) => draft.slots[c]), ...draft.reserves], assignments: draft.slots, phase: 'assign' };
    let spent = 0;
    for (let w = 0; game; w++) {
      game = { ...game, assignments: autoAssign(game, data), gamePicks: {} };
      if (gold === 'rent' && currentWeek(game, data)) game = rentForGaps({ ...game, phase: 'assign' }, data);
      game = { ...game, encounter: encounters[(w + offset) % encounters.length] };
      game = {
        ...game,
        gamePicks: pick === 'smart' ? smartGames(game, data, typeof weights === 'function' ? weights(game.encounter!) : weights) : bestGames(game, data),
      };
      if (readyPicks(game, data).length === 0 || !currentWeek(game, data)) {
        game = nextWeek(game, data);
        continue;
      }
      const chapter = chapterOf(game);
      const week = currentWeek(game, data)!;
      const sittingOut = CLASSES.filter((c) => {
        const id = game!.assignments[c];
        return id === undefined || playerGamesInWeek(data, week, id).length === 0 || tierIndex(seasonTier(c, data.players[id].avg)) < tierIndex('good');
      }).length;
      const rented = game.tenDay.length;
      game = startBattle(game, data);
      game = finishBattle({ ...game, battle: bot === 'smart' ? smartAutoplay(game.battle!) : autoplay(game.battle!) });
      const result = game.history.at(-1)!;
      if (policy === 'greedy') {
        const before = CLASSES.reduce((t, c) => t + game!.pp[c], 0);
        game = spend(game);
        spent += before - CLASSES.reduce((t, c) => t + game!.pp[c], 0);
      }
      out.push({
        run,
        week: w,
        chapter,
        encounter: game.encounter!,
        won: result.outcome === 'won',
        rounds: result.rounds,
        spentPerHero: spent / CLASSES.length,
        sittingOut,
        rented,
        gold: game.gold,
      });
      game = nextWeek(game, data);
    }
  }
  return out;
}

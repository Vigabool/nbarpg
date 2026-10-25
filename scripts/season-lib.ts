import { buy, priceOf, type Purchase } from '../src/app/armory';
import { autoAssign, bestGames } from '../src/app/autoAssign';
import { smartGames, type PickWeights } from '../src/app/smartPick';
import { autoDraft, DRAFT_MODES, type DraftMode } from '../src/app/autoDraft';
import { chapterOf, currentWeek, finishBattle, newGame, nextWeek, readyPicks, startBattle, type SaveGame } from '../src/app/game';
import type { SeasonData } from '../src/data/types';
import { autoplay } from '../src/engine/autoplay';
import { smartAutoplay } from '../src/engine/smartBot';
import { encounterIds } from '../src/engine/encounter';
import { CLASSES, rules, type HeroClass } from '../src/rules';

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
}

/** Everything a hero could buy, in the order the greedy bot prefers. */
function shoppingList(c: HeroClass): Purchase[] {
  const p = rules.progression;
  const list: Purchase[] = [{ kind: 'weapon' }];
  if (c === 'warrior') list.push({ kind: 'shield' });
  const gear = Object.entries(p.gear).filter(([, g]) => g.heroClass === c).sort((a, b) => a[1].cost - b[1].cost);
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
      game = { ...game, encounter: encounters[(w + offset) % encounters.length] };
      game = { ...game, gamePicks: pick === 'smart' ? smartGames(game, data, typeof weights === 'function' ? weights(game.encounter!) : weights) : bestGames(game, data) };
      if (readyPicks(game, data).length === 0 || !currentWeek(game, data)) {
        game = nextWeek(game, data);
        continue;
      }
      const chapter = chapterOf(game);
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
      });
      game = nextWeek(game, data);
    }
  }
  return out;
}

import type { SeasonData, Week } from '../data/types';
import type { BattleState } from '../engine/combat';
import type { HeroGamePick } from '../engine/horde';
import type { PoolBreakdown } from '../engine/rating';
import { computeRewards, type Rewards } from '../engine/rewards';
import { computeSalary } from '../engine/rating';
import { playerGamesInWeek, prepareBattle } from '../engine/week';
import { CLASSES, emptyProgress, rules, type HeroClass, type HeroProgress } from '../rules';
import { SAVE_VERSION } from './saves';

/** A week runs encounter → assign → select → battle → result; chapters open with roster moves first. */
export type Phase = 'roster' | 'encounter' | 'assign' | 'select' | 'battle' | 'result';

export interface WeekResult {
  weekIndex: number;
  /** Encounter fought (absent in saves from before it was recorded). */
  encounter?: string;
  outcome: 'won' | 'lost';
  rounds: number;
  rewards: Rewards;
}

export interface SaveGame {
  /** Save format version (see saves.ts). */
  version: typeof SAVE_VERSION;
  season: string;
  weekIndex: number;
  phase: Phase;
  roster: number[];
  /** Roster at the start of the chapter, to count moves made between chapters. */
  chapterRoster: number[] | null;
  assignments: Partial<Record<HeroClass, number>>;
  gamePicks: Partial<Record<HeroClass, string>>;
  battle: BattleState | null;
  battlePools: Partial<Record<HeroClass, PoolBreakdown>> | null;
  /** Encounter for the coming battle (a testing choice until weekly selection is designed). */
  encounter?: string;
  /** Unspent progression points per hero (whole numbers). */
  pp: Record<HeroClass, number>;
  /** What each hero has bought in the Armory (absent in saves from before progression). */
  progress?: Record<HeroClass, HeroProgress>;
  /** The party's gold (see gold.ts). */
  gold: number;
  /** Cap room bought with gold, on top of the salary cap. */
  capBonus: number;
  /** Ten-day contracts for this week only, with the fee paid (refunded if released before the battle). */
  tenDay: { playerId: number; fee: number }[];
  history: WeekResult[];
}

export const CHAPTER_WEEKS = 4;
export const MOVES_PER_CHAPTER = 3;

export function newGame(season: string, weekIndex: number): SaveGame {
  return {
    version: SAVE_VERSION,
    season,
    weekIndex,
    phase: 'roster',
    roster: [],
    chapterRoster: null,
    assignments: {},
    gamePicks: {},
    battle: null,
    battlePools: null,
    pp: Object.fromEntries(CLASSES.map((c) => [c, 0])) as Record<HeroClass, number>,
    progress: Object.fromEntries(CLASSES.map((c) => [c, emptyProgress()])) as Record<HeroClass, HeroProgress>,
    gold: rules.salary.gold.starting,
    capBonus: 0,
    tenDay: [],
    history: [],
  };
}

export function progressOf(game: SaveGame, c: HeroClass): HeroProgress {
  return game.progress?.[c] ?? emptyProgress();
}

/** Chapter number (1-based): every CHAPTER_WEEKS weeks from the run's first week. */
export function chapterOf(game: SaveGame): number {
  const startWeek = game.history[0]?.weekIndex ?? game.weekIndex;
  return Math.floor((game.weekIndex - startWeek) / CHAPTER_WEEKS) + 1;
}

export function currentWeek(game: SaveGame, data: SeasonData): Week | undefined {
  return data.weeks.find((w) => w.index === game.weekIndex);
}

export function rosterCost(roster: number[], data: SeasonData): number {
  return roster.reduce((s, id) => s + (data.players[id] ? computeSalary(data.players[id].avg).salary : 0), 0);
}

export function rosterMoves(game: SaveGame, roster: number[]): number {
  if (!game.chapterRoster) return 0;
  return roster.filter((id) => !game.chapterRoster!.includes(id)).length;
}

/** Heroes whose bound player played this week, with their chosen game. */
export function readyPicks(game: SaveGame, data: SeasonData): HeroGamePick[] {
  const week = currentWeek(game, data);
  if (!week) return [];
  const picks: HeroGamePick[] = [];
  for (const c of CLASSES) {
    const playerId = game.assignments[c];
    const gameId = game.gamePicks[c];
    if (playerId === undefined || !gameId) continue;
    if (!playerGamesInWeek(data, week, playerId).includes(gameId)) continue;
    picks.push({ heroClass: c, playerId, gameId });
  }
  return picks;
}

export function startBattle(game: SaveGame, data: SeasonData): SaveGame {
  const progress = Object.fromEntries(CLASSES.map((c) => [c, progressOf(game, c)])) as Record<HeroClass, HeroProgress>;
  const prepared = prepareBattle(readyPicks(game, data), data, undefined, game.encounter, { progress, chapter: chapterOf(game) });
  return { ...game, phase: 'battle', battle: prepared.battle, battlePools: prepared.pools };
}

export function finishBattle(game: SaveGame): SaveGame {
  const b = game.battle;
  if (!b || b.phase === 'party') return game;
  const rewards = computeRewards(b, game.battlePools ?? {});
  const pp = { ...game.pp };
  for (const c of CLASSES) pp[c] += rewards.perHero[c];
  return {
    ...game,
    phase: 'result',
    pp,
    gold: (game.gold ?? 0) + (rewards.gold?.total ?? 0),
    history: [
      ...game.history,
      { weekIndex: game.weekIndex, encounter: game.encounter ?? rules.encounters.default, outcome: b.phase, rounds: b.round, rewards },
    ],
  };
}

export function isChapterBoundary(weekIndex: number, startWeek: number): boolean {
  return (weekIndex - startWeek) % CHAPTER_WEEKS === 0;
}

export function nextWeek(game: SaveGame, data: SeasonData): SaveGame | null {
  const idx = data.weeks.findIndex((w) => w.index === game.weekIndex);
  const next = data.weeks[idx + 1];
  if (!next) return null;
  const startWeek = game.history[0]?.weekIndex ?? game.weekIndex;
  const chapterEnds = isChapterBoundary(next.index, startWeek);
  // Ten-day contracts end with the week.
  const assignments = Object.fromEntries(Object.entries(game.assignments).filter(([, id]) => game.roster.includes(id!)));
  return {
    ...game,
    assignments,
    tenDay: [],
    weekIndex: next.index,
    phase: chapterEnds ? 'roster' : 'encounter',
    chapterRoster: chapterEnds ? [...game.roster] : null,
    gamePicks: {},
    battle: null,
    battlePools: null,
  };
}

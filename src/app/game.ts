import type { SeasonData, Week } from '../data/types';
import type { BattleState } from '../engine/combat';
import type { HeroGamePick } from '../engine/horde';
import type { PoolBreakdown } from '../engine/rating';
import { computeRewards, type Rewards } from '../engine/rewards';
import { computeSalary } from '../engine/rating';
import { playerGamesInWeek, prepareBattle } from '../engine/week';
import { CLASSES, type HeroClass } from '../rules';

export type Phase = 'roster' | 'assign' | 'select' | 'battle' | 'result';

export interface WeekResult {
  weekIndex: number;
  outcome: 'won' | 'lost';
  rounds: number;
  rewards: Rewards;
}

export interface SaveGame {
  version: 1;
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
  pp: Record<HeroClass, number>;
  history: WeekResult[];
}

export const CHAPTER_WEEKS = 4;
export const MOVES_PER_CHAPTER = 3;

export function newGame(season: string, weekIndex: number): SaveGame {
  return {
    version: 1,
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
    history: [],
  };
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
  const prepared = prepareBattle(readyPicks(game, data), data);
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
    history: [...game.history, { weekIndex: game.weekIndex, outcome: b.phase, rounds: b.round, rewards }],
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
  return {
    ...game,
    weekIndex: next.index,
    phase: chapterEnds ? 'roster' : 'assign',
    chapterRoster: chapterEnds ? [...game.roster] : null,
    gamePicks: {},
    battle: null,
    battlePools: null,
  };
}


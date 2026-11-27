/**
 * The week the game is played from: the heroes (one game each), the Champions those games bring,
 * and the opposing teams. It starts as the fixed week in week.json, and the setup flow (roster,
 * encounter, heroes, games) replaces it with one built from the player's choices (see setup/buildWeek.ts).
 */
import fixed from './week.json';

export interface WeekLine {
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg3m: number;
  fgm: number;
  fga: number;
  fta: number;
  ftm: number;
  oreb: number;
  dreb: number;
}

export interface WeekHero {
  cls: string;
  player: string;
  team: string;
  opp: string;
  date: string;
  home: boolean;
  line: WeekLine;
  tier: string;
  rating: number;
  doubleDouble: boolean;
  tripleDouble: boolean;
  defRating: number;
  defTier: string;
  trueUsage: number;
  touches: number;
  /** No game this week: the hero sits out the whole game. */
  out?: boolean;
}

export interface WeekChampion {
  kind: string;
  player: string;
  team: string;
  tier: string;
  hp: number;
  damage: number;
  mirrorOf: string | null;
  boss: boolean;
  line: WeekLine;
}

export interface WeekTeam {
  team: string;
  pts: number;
  fgPct: number;
  goblins: number;
}

export interface WeekData {
  season: string;
  /** The encounter this week is played as (the Goblin Horde when absent). */
  encounter?: string;
  week: { index: number; start: string; end: string };
  heroes: WeekHero[];
  champions: WeekChampion[];
  teams: WeekTeam[];
  calibration: { defThresholds: { average: number; good: number; great: number; elite: number }; usagePerTouch: number };
}

export const FIXED_WEEK = fixed as WeekData;
let current: WeekData = FIXED_WEEK;

/** The week the next game is built from. */
export const getWeek = (): WeekData => current;
export function setWeek(w: WeekData) {
  current = w;
}

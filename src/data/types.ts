export const STAT_KEYS = [
  'min', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'stl', 'blk', 'tov', 'pts',
] as const;
export type StatKey = (typeof STAT_KEYS)[number];
export type StatLine = Record<StatKey, number>;

/** One player's line in one game. */
export interface BoxLine extends StatLine {
  playerId: number;
  team: string;
}

export interface Game {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  home: string;
  away: string;
  lines: BoxLine[];
}

export interface PlayerSummary {
  id: number;
  name: string;
  /** Most recent team. */
  team: string;
  gp: number;
  /** Per-game season averages (in a form view: the form window's averages). */
  avg: StatLine;
  /** In a form view, how many of the window's games came from this season and from the prior one. */
  form?: { current: number; prior: number };
}

export interface Week {
  index: number;
  /** Monday, ISO date. */
  start: string;
  /** Sunday, ISO date. */
  end: string;
  gameIds: string[];
}

export interface SeasonData {
  season: string;
  source: string;
  generatedAt: string;
  /** True when the data is the synthetic test fixture, never real games. */
  synthetic: boolean;
  weeks: Week[];
  games: Record<string, Game>;
  players: Record<number, PlayerSummary>;
  /**
   * A live season's prior regular season: each current player's most recent prior games, oldest
   * first. When present, ratings come from each week's form window (src/data/form.ts) instead of
   * whole-season averages.
   */
  prior?: PriorSeason;
  /** Last date (ISO, Eastern time) the data fully covers; weeks after it are left out until they finish. */
  throughDate?: string;
}

export interface PriorSeason {
  season: string;
  lines: Record<number, StatLine[]>;
}

/** The raw dump written by scripts/fetch_gamelogs.py (an nba_api LeagueGameLog result set). */
export interface RawGameLog {
  season: string;
  source: string;
  fetchedAt: string;
  synthetic?: boolean;
  /** Set by the live fetcher: the last date (Eastern time) whose games are all final. */
  throughDate?: string;
  headers: string[];
  rows: (string | number | null)[][];
}

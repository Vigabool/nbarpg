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
  /** Per-game season averages. */
  avg: StatLine;
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
}

/** The raw dump written by scripts/fetch_gamelogs.py (an nba_api LeagueGameLog result set). */
export interface RawGameLog {
  season: string;
  source: string;
  fetchedAt: string;
  synthetic?: boolean;
  headers: string[];
  rows: (string | number | null)[][];
}

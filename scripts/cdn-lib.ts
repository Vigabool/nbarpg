/**
 * Parsing for the NBA's public CDN feeds (cdn.nba.com), which serve the schedule and each game's
 * box score as static JSON. Turns them into the same raw game log scripts/fetch_gamelogs.py
 * writes, so the rest of the pipeline doesn't care where the data came from.
 */
import type { RawGameLog } from '../src/data/types';

export const SCHEDULE_URL = 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json';
export const boxscoreUrl = (gameId: string) => `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;

/** Same columns, in the same order, as scripts/fetch_gamelogs.py. */
export const COLUMNS = [
  'PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GAME_ID', 'GAME_DATE', 'MATCHUP',
  'MIN', 'FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA', 'OREB', 'DREB', 'REB',
  'AST', 'STL', 'BLK', 'TOV', 'PTS',
]; // prettier-ignore

/** gameStatus in both feeds: 1 scheduled (or postponed), 2 in progress, 3 final. */
export const FINAL = 3;
const LIVE = 2;

export interface ScheduledGame {
  gameId: string;
  /** Eastern-time date, YYYY-MM-DD. */
  date: string;
  status: number;
  home: string;
  away: string;
}

/** Regular-season games only: IDs start 002 (001 preseason, 004 playoffs, 005 play-in, 006 the NBA Cup final, which doesn't count). */
export const isRegularSeason = (gameId: string) => gameId.startsWith('002');

function need<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) throw new Error(`CDN feed changed shape: missing ${what}`);
  return value;
}

/** "10/21/2025 00:00:00" → "2025-10-21". */
function scheduleDate(s: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (!m) throw new Error(`CDN feed changed shape: unexpected gameDate ${s}`);
  return `${m[3]}-${m[1]}-${m[2]}`;
}

export function parseSchedule(json: unknown): { season: string; games: ScheduledGame[] } {
  const ls = need((json as { leagueSchedule?: Record<string, unknown> }).leagueSchedule, 'leagueSchedule');
  const season = need(ls.seasonYear as string | undefined, 'leagueSchedule.seasonYear');
  const games: ScheduledGame[] = [];
  for (const day of need(ls.gameDates as { gameDate: string; games: Record<string, unknown>[] }[] | undefined, 'leagueSchedule.gameDates')) {
    const date = scheduleDate(need(day.gameDate, 'gameDate'));
    for (const g of day.games ?? []) {
      const gameId = need(g.gameId as string | undefined, 'gameId');
      if (!isRegularSeason(gameId)) continue;
      const home = (g.homeTeam as { teamTricode?: string | null } | undefined)?.teamTricode;
      const away = (g.awayTeam as { teamTricode?: string | null } | undefined)?.teamTricode;
      // NBA Cup knockout games are on the schedule before their teams are known.
      if (!home || !away) continue;
      games.push({ gameId, date, status: Number(need(g.gameStatus, 'gameStatus')), home, away });
    }
  }
  return { season, games };
}

/**
 * The last date whose games are all in: the day before `today`, stepped back past any date that
 * still has a game in progress. Postponed games stay "scheduled" forever, so they don't hold it back.
 */
export function throughDate(games: ScheduledGame[], today: string): string {
  let through = addDays(today, -1);
  while (games.some((g) => g.status === LIVE && g.date <= through)) through = addDays(through, -1);
  return through;
}

/** "PT34M12.00S" → 34 (whole minutes, as LeagueGameLog reports them). */
export function parseMinutes(iso: string | undefined): number {
  const m = /^PT(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  return Math.round(Number(m[1] ?? 0) + Number(m[2] ?? 0) / 60);
}

interface CdnPlayer {
  personId: number;
  name: string;
  played?: string;
  statistics: Record<string, number | string>;
}

/** One final box score → raw rows (COLUMNS order) for every player who got in the game. */
export function boxscoreRows(json: unknown, date: string): (string | number)[][] {
  const game = need((json as { game?: Record<string, unknown> }).game, 'game');
  const gameId = need(game.gameId as string | undefined, 'game.gameId');
  const home = need(game.homeTeam as { teamTricode: string; players: CdnPlayer[] } | undefined, 'game.homeTeam');
  const away = need(game.awayTeam as { teamTricode: string; players: CdnPlayer[] } | undefined, 'game.awayTeam');
  const rows: (string | number)[][] = [];
  for (const [team, matchup] of [
    [home, `${home.teamTricode} vs. ${away.teamTricode}`],
    [away, `${away.teamTricode} @ ${home.teamTricode}`],
  ] as const) {
    for (const p of need(team.players, `${team.teamTricode} players`)) {
      if (p.played !== '1') continue;
      const s = need(p.statistics, `statistics for ${p.personId}`);
      const n = (k: string) => Number(need(s[k], `statistics.${k}`));
      rows.push([
        p.personId,
        p.name,
        team.teamTricode,
        gameId,
        date,
        matchup,
        parseMinutes(s.minutes as string),
        n('fieldGoalsMade'),
        n('fieldGoalsAttempted'),
        n('threePointersMade'),
        n('threePointersAttempted'),
        n('freeThrowsMade'),
        n('freeThrowsAttempted'),
        n('reboundsOffensive'),
        n('reboundsDefensive'),
        n('reboundsTotal'),
        n('assists'),
        n('steals'),
        n('blocks'),
        n('turnovers'),
        n('points'),
      ]);
    }
  }
  return rows;
}

/** Combines fresh box scores with an existing raw log: refetched games replace their old rows. */
export function mergeRows(existing: RawGameLog | null, fresh: Map<string, (string | number)[][]>): (string | number | null)[][] {
  const gameCol = COLUMNS.indexOf('GAME_ID');
  const dateCol = COLUMNS.indexOf('GAME_DATE');
  const kept = (existing?.rows ?? []).filter((r) => !fresh.has(String(r[gameCol])));
  return [...kept, ...[...fresh.values()].flat()].sort(
    (a, b) => String(a[dateCol]).localeCompare(String(b[dateCol])) || String(a[gameCol]).localeCompare(String(b[gameCol])),
  );
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today's date in US Eastern time, where the NBA keeps its calendar. */
export function easternToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

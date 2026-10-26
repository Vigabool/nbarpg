import { STAT_KEYS, type BoxLine, type Game, type PlayerSummary, type PriorSeason, type RawGameLog, type SeasonData, type StatLine, type Week } from './types';

const RAW_COLUMNS: Record<string, keyof BoxLine | 'gameId' | 'date' | 'matchup' | 'playerName'> = {
  PLAYER_ID: 'playerId',
  PLAYER_NAME: 'playerName',
  TEAM_ABBREVIATION: 'team',
  GAME_ID: 'gameId',
  GAME_DATE: 'date',
  MATCHUP: 'matchup',
  MIN: 'min',
  FGM: 'fgm',
  FGA: 'fga',
  FG3M: 'fg3m',
  FG3A: 'fg3a',
  FTM: 'ftm',
  FTA: 'fta',
  OREB: 'oreb',
  DREB: 'dreb',
  REB: 'reb',
  AST: 'ast',
  STL: 'stl',
  BLK: 'blk',
  TOV: 'tov',
  PTS: 'pts',
};

export function emptyStatLine(): StatLine {
  return Object.fromEntries(STAT_KEYS.map((k) => [k, 0])) as StatLine;
}

/** nba_api reports MIN as a number, or "MM:SS" in some endpoints. */
function parseMinutes(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.includes(':')) {
    const [m, s] = v.split(':').map(Number);
    return m + s / 60;
  }
  return Number(v) || 0;
}

/** Monday on or before the given ISO date. */
export function mondayOf(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** How many prior-season games each player carries: enough to fill a whole form window. */
export const PRIOR_GAMES = 15;

function parseGames(raw: RawGameLog) {
  const idx: Record<string, number> = {};
  raw.headers.forEach((h, i) => (idx[h] = i));
  for (const col of Object.keys(RAW_COLUMNS)) {
    if (!(col in idx)) throw new Error(`Raw game log is missing column ${col}`);
  }

  const games: Record<string, Game> = {};
  const names: Record<number, string> = {};
  const latest: Record<number, { date: string; team: string }> = {};

  for (const row of raw.rows) {
    const get = (col: string) => row[idx[col]];
    const playerId = Number(get('PLAYER_ID'));
    const team = String(get('TEAM_ABBREVIATION'));
    const gameId = String(get('GAME_ID'));
    const date = String(get('GAME_DATE')).slice(0, 10);
    const matchup = String(get('MATCHUP'));

    const line = { playerId, team } as BoxLine;
    for (const k of STAT_KEYS) line[k] = k === 'min' ? parseMinutes(get('MIN')) : Number(get(k.toUpperCase())) || 0;

    let game = games[gameId];
    if (!game) game = games[gameId] = { id: gameId, date, home: '', away: '', lines: [] };
    // "BOS vs. NYK" is a home game for BOS; "BOS @ NYK" is an away game.
    const [, opp] = matchup.split(/ vs\. | @ /);
    if (matchup.includes(' vs. ')) {
      game.home = team;
      game.away = opp;
    } else {
      game.away = team;
      game.home = opp;
    }
    game.lines.push(line);

    names[playerId] = String(get('PLAYER_NAME'));
    if (!latest[playerId] || latest[playerId].date <= date) latest[playerId] = { date, team };
  }
  return { games, names, latest };
}

/**
 * Builds the app's season file from a raw game log. With `prior` (the previous regular season),
 * each current player also carries their last PRIOR_GAMES prior games for the form window.
 */
export function buildSeason(raw: RawGameLog, prior?: RawGameLog): SeasonData {
  const { games: allGames, names, latest } = parseGames(raw);
  // A live log can end mid-week: leave that week out until it's over.
  const games = raw.throughDate
    ? Object.fromEntries(Object.entries(allGames).filter(([, g]) => addDays(mondayOf(g.date), 6) <= raw.throughDate!))
    : allGames;

  const totals: Record<number, { gp: number; sum: StatLine }> = {};
  for (const g of Object.values(games)) {
    for (const l of g.lines) {
      const t = (totals[l.playerId] ??= { gp: 0, sum: emptyStatLine() });
      t.gp++;
      for (const k of STAT_KEYS) t.sum[k] += l[k];
    }
  }
  const players: Record<number, PlayerSummary> = {};
  for (const [id, t] of Object.entries(totals)) {
    const avg = emptyStatLine();
    for (const k of STAT_KEYS) avg[k] = t.sum[k] / t.gp;
    players[Number(id)] = { id: Number(id), name: names[Number(id)], team: latest[Number(id)].team, gp: t.gp, avg };
  }

  const weeksByStart: Record<string, string[]> = {};
  for (const g of Object.values(games)) (weeksByStart[mondayOf(g.date)] ??= []).push(g.id);
  const weeks: Week[] = Object.keys(weeksByStart)
    .sort()
    .map((start, i) => ({
      index: i + 1,
      start,
      end: addDays(start, 6),
      gameIds: weeksByStart[start].sort((a, b) => games[a].date.localeCompare(games[b].date) || a.localeCompare(b)),
    }));

  return {
    season: raw.season,
    source: raw.source,
    generatedAt: new Date().toISOString(),
    synthetic: raw.synthetic ?? false,
    weeks,
    games,
    players,
    ...(prior ? { prior: priorLines(prior, players) } : {}),
    ...(raw.throughDate ? { throughDate: raw.throughDate } : {}),
  };
}

function priorLines(prior: RawGameLog, players: Record<number, PlayerSummary>): PriorSeason {
  const byPlayer: Record<number, { date: string; line: StatLine }[]> = {};
  for (const g of Object.values(parseGames(prior).games))
    for (const l of g.lines) {
      if (!players[l.playerId]) continue;
      const line = emptyStatLine();
      for (const k of STAT_KEYS) line[k] = l[k];
      (byPlayer[l.playerId] ??= []).push({ date: g.date, line });
    }
  const lines: Record<number, StatLine[]> = {};
  for (const [id, list] of Object.entries(byPlayer))
    lines[Number(id)] = list
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-PRIOR_GAMES)
      .map((x) => x.line);
  return { season: prior.season, lines };
}

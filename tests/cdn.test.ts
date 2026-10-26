import { describe, expect, it } from 'vitest';
import { buildSeason } from '../src/data/build';
import { COLUMNS, boxscoreRows, easternToday, mergeRows, parseMinutes, parseSchedule, throughDate } from '../scripts/cdn-lib';

// Trimmed copies of the CDN's shapes (scheduleLeagueV2.json and boxscore_<id>.json).
const schedule = {
  leagueSchedule: {
    seasonYear: '2026-27',
    gameDates: [
      {
        gameDate: '10/12/2026 00:00:00',
        games: [{ gameId: '0012600001', gameStatus: 3, homeTeam: { teamTricode: 'BOS' }, awayTeam: { teamTricode: 'NYK' } }],
      },
      {
        gameDate: '10/20/2026 00:00:00',
        games: [
          { gameId: '0022600001', gameStatus: 3, homeTeam: { teamTricode: 'BOS' }, awayTeam: { teamTricode: 'NYK' } },
          { gameId: '0022600002', gameStatus: 1, homeTeam: { teamTricode: 'LAL' }, awayTeam: { teamTricode: 'GSW' } },
        ],
      },
      { gameDate: '10/24/2026 00:00:00', games: [{ gameId: '0022600003', gameStatus: 2, homeTeam: { teamTricode: 'MIA' }, awayTeam: { teamTricode: 'ORL' } }] },
    ],
  },
};

const stats = (over: Record<string, number | string> = {}) => ({
  minutes: 'PT34M40.00S',
  fieldGoalsMade: 9,
  fieldGoalsAttempted: 18,
  threePointersMade: 3,
  threePointersAttempted: 7,
  freeThrowsMade: 4,
  freeThrowsAttempted: 5,
  reboundsOffensive: 1,
  reboundsDefensive: 6,
  reboundsTotal: 7,
  assists: 5,
  steals: 2,
  blocks: 1,
  turnovers: 3,
  points: 25,
  ...over,
});

const boxscore = {
  game: {
    gameId: '0022600001',
    homeTeam: {
      teamTricode: 'BOS',
      players: [
        { personId: 1628369, name: 'Jayson Tatum', played: '1', statistics: stats() },
        { personId: 1, name: 'Bench Guy', played: '0', statistics: stats({ minutes: 'PT00M00.00S', points: 0 }) },
      ],
    },
    awayTeam: {
      teamTricode: 'NYK',
      players: [{ personId: 1628973, name: 'Jalen Brunson', played: '1', statistics: stats({ minutes: 'PT36M05.00S', points: 31 }) }],
    },
  },
};

describe('CDN feed', () => {
  it('reads regular-season games from the schedule', () => {
    const s = parseSchedule(schedule);
    expect(s.season).toBe('2026-27');
    expect(s.games.map((g) => g.gameId)).toEqual(['0022600001', '0022600002', '0022600003']);
    expect(s.games[0]).toEqual({ gameId: '0022600001', date: '2026-10-20', status: 3, home: 'BOS', away: 'NYK' });
  });

  it('fails loudly if the feed changes shape', () => {
    expect(() => parseSchedule({})).toThrow(/leagueSchedule/);
    expect(() =>
      boxscoreRows(
        {
          game: {
            gameId: 'x',
            homeTeam: { teamTricode: 'BOS', players: [{ personId: 1, played: '1', statistics: {} }] },
            awayTeam: { teamTricode: 'NYK', players: [] },
          },
        },
        '2026-10-20',
      ),
    ).toThrow(/statistics/);
  });

  it('is complete through yesterday, minus any day with a game still on', () => {
    const { games } = parseSchedule(schedule);
    expect(throughDate(games, '2026-10-24')).toBe('2026-10-23'); // the postponed LAL game doesn't hold it back
    expect(throughDate(games, '2026-10-25')).toBe('2026-10-23'); // MIA–ORL still in progress
  });

  it('turns a box score into raw rows for players who got in', () => {
    const rows = boxscoreRows(boxscore, '2026-10-20');
    expect(rows).toHaveLength(2);
    const row = Object.fromEntries(COLUMNS.map((c, i) => [c, rows[0][i]]));
    expect(row).toMatchObject({
      PLAYER_ID: 1628369,
      PLAYER_NAME: 'Jayson Tatum',
      TEAM_ABBREVIATION: 'BOS',
      GAME_DATE: '2026-10-20',
      MATCHUP: 'BOS vs. NYK',
      MIN: 35,
      PTS: 25,
      REB: 7,
    });
    expect(rows[1][COLUMNS.indexOf('MATCHUP')]).toBe('NYK @ BOS');
  });

  it('parses ISO minutes', () => {
    expect(parseMinutes('PT34M12.00S')).toBe(34);
    expect(parseMinutes('PT05M45.00S')).toBe(6);
    expect(parseMinutes('PT00M00.00S')).toBe(0);
    expect(parseMinutes(undefined)).toBe(0);
  });

  it('replaces refetched games and keeps the rest', () => {
    const old = { season: '2026-27', source: 't', fetchedAt: '', headers: COLUMNS, rows: [...boxscoreRows(boxscore, '2026-10-20')] };
    const corrected = boxscoreRows({ game: { ...boxscore.game, awayTeam: { ...boxscore.game.awayTeam, players: [] } } }, '2026-10-20');
    expect(mergeRows(old, new Map([['0022600001', corrected]]))).toHaveLength(1);
    expect(mergeRows(old, new Map([['0022600009', corrected]]))).toHaveLength(3);
  });

  it('builds into the same season data as a LeagueGameLog file', () => {
    const data = buildSeason({
      season: '2026-27',
      source: 't',
      fetchedAt: '',
      throughDate: '2026-10-26',
      headers: COLUMNS,
      rows: boxscoreRows(boxscore, '2026-10-20'),
    });
    expect(data.games['0022600001']).toMatchObject({ home: 'BOS', away: 'NYK' });
    expect(data.players[1628973].avg.pts).toBe(31);
  });

  it('dates by the Eastern calendar', () => {
    expect(easternToday(new Date('2026-10-26T03:00:00Z'))).toBe('2026-10-25'); // 11pm Sunday in New York
  });
});

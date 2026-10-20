import { describe, expect, it } from 'vitest';
import { autoplay } from '../src/engine/autoplay';
import { buildSeason, mondayOf } from '../src/data/build';
import { decodeSeason, encodeSeason } from '../src/data/format';
import { eligiblePlayers } from '../src/engine/calibration';
import { playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { CLASSES } from '../src/rules';
import { makeSyntheticSeason } from './fixtures/synthetic';

const data = buildSeason(makeSyntheticSeason({ teams: 10, weeks: 3, seed: 7 }));

describe('season data', () => {
  it('groups games into Monday–Sunday weeks', () => {
    expect(mondayOf('2025-10-26')).toBe('2025-10-20'); // Sunday
    expect(mondayOf('2025-10-27')).toBe('2025-10-27'); // Monday
    expect(data.weeks.length).toBe(3);
    for (const w of data.weeks) for (const g of w.gameIds) expect(mondayOf(data.games[g].date)).toBe(w.start);
  });

  it('reads home and away from the matchup', () => {
    const g = Object.values(data.games)[0];
    expect(new Set(g.lines.map((l) => l.team))).toEqual(new Set([g.home, g.away]));
  });

  it('round-trips through the compact format', () => {
    const back = decodeSeason(JSON.parse(JSON.stringify(encodeSeason(data))));
    const id = Object.keys(data.games)[3];
    expect(back.games[id].lines[2]).toEqual(data.games[id].lines[2]);
    expect(Object.keys(back.players).length).toBe(Object.keys(data.players).length);
  });
});

describe('full battles on the synthetic season', () => {
  it('always finish without errors', () => {
    const players = eligiblePlayers(data);
    for (const week of data.weeks) {
      for (let offset = 0; offset < 8; offset++) {
        const picks = CLASSES.map((c, i) => {
          const p = players[(offset * 5 + i * 7) % players.length];
          const games = playerGamesInWeek(data, week, p.id);
          return games.length ? { heroClass: c, playerId: p.id, gameId: games[0] } : null;
        }).filter((x) => x !== null);
        if (!picks.length) continue;
        const end = autoplay(prepareBattle(picks, data).battle);
        expect(['won', 'lost']).toContain(end.phase);
      }
    }
  });
});

import { describe, expect, it } from 'vitest';
import { buildSeason } from '../src/data/build';
import { formView } from '../src/data/form';
import { decodeSeason, encodeSeason } from '../src/data/format';
import type { RawGameLog } from '../src/data/types';
import { eligiblePlayers } from '../src/engine/calibration';
import { chapterStartWeek, newGame } from '../src/app/game';
import { rules } from '../src/rules';
import { COLUMNS } from '../scripts/cdn-lib';

/** A raw log from [playerId, date, points] nights; every night is 30 minutes, BOS vs. NYK. */
function rawLog(season: string, nights: [number, string, number][], extra: Partial<RawGameLog> = {}): RawGameLog {
  const rows = nights.map(([pid, date, pts]) => {
    const row: Record<string, string | number> = Object.fromEntries(COLUMNS.map((c) => [c, 0]));
    Object.assign(row, {
      PLAYER_ID: pid,
      PLAYER_NAME: `Player ${pid}`,
      TEAM_ABBREVIATION: 'BOS',
      GAME_ID: `g-${date}`,
      GAME_DATE: date,
      MATCHUP: 'BOS vs. NYK',
      MIN: 30,
      PTS: pts,
    });
    return COLUMNS.map((c) => row[c]);
  });
  return { season, source: 'test', fetchedAt: '2026-01-01T00:00:00+00:00', headers: COLUMNS, rows, ...extra };
}

const day = (start: string, n: number) => {
  const d = new Date(`${start}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Last season: player 1 has 20 games of 10 points (the last 15 carry over); player 9 retired.
const prior = rawLog('2025-26', [...Array.from({ length: 20 }, (_, i) => [1, day('2026-03-01', i), 10] as [number, string, number]), [9, '2026-03-01', 40]]);
// This season, from Monday 2026-10-19: two games a week. Player 2 is a rookie.
const nights: [number, string, number][] = [];
for (let w = 0; w < 3; w++)
  for (const d of [1, 3]) {
    nights.push([1, day('2026-10-19', w * 7 + d), 30]);
    nights.push([2, day('2026-10-19', w * 7 + d), 20]);
  }
const live = buildSeason(rawLog('2026-27', nights), [prior]);

describe('form window', () => {
  it('carries each current player’s last prior games, and only current players', () => {
    expect(live.prior?.season).toBe('2025-26');
    expect(live.prior?.lines[1]).toHaveLength(15);
    expect(live.prior?.lines[9]).toBeUndefined();
  });

  it('starts the season on last season’s games, without looking at the week itself', () => {
    const p = formView(live, 1).players[1];
    expect(p.gp).toBe(15);
    expect(p.avg.pts).toBe(10);
    expect(p.form).toEqual({ current: 0, prior: 15 });
  });

  it('tops up this season’s games with last season’s to fill the window', () => {
    const p = formView(live, 2).players[1];
    expect(p.form).toEqual({ current: 2, prior: 13 });
    expect(p.avg.pts).toBeCloseTo((2 * 30 + 13 * 10) / 15);
  });

  it('uses this season alone once it fills the window', () => {
    const small = { ...rules, salary: { ...rules.salary, eligibility: { ...rules.salary.eligibility, formGames: 3 } } };
    const p = formView(live, 3, small).players[1];
    expect(p.form).toEqual({ current: 4, prior: 0 });
    expect(p.avg.pts).toBe(30);
  });

  it('leaves out players without a full window, such as rookies', () => {
    const ids = eligiblePlayers(formView(live, 3)).map((p) => p.id);
    expect(ids).toContain(1);
    expect(ids).not.toContain(2);
  });

  it('reaches back a second season for a player who missed most of the last one', () => {
    // Player 3: 20 games of 8 points in 2024-25, then 3 games of 20 points in 2025-26.
    const older = rawLog(
      '2024-25',
      Array.from({ length: 20 }, (_, i) => [3, day('2025-02-01', i), 8] as [number, string, number]),
    );
    const last = rawLog('2025-26', [
      [3, '2026-04-01', 20],
      [3, '2026-04-03', 20],
      [3, '2026-04-05', 20],
    ]);
    const data = buildSeason(rawLog('2026-27', [...nights, [3, day('2026-10-19', 1), 0]]), [last, older]);
    expect(data.prior?.lines[3]).toHaveLength(15);
    expect(data.prior?.lines[3].at(-1)?.pts).toBe(20); // most recent last
    const p = formView(data, 1).players[3];
    expect(p.gp).toBe(15);
    expect(p.avg.pts).toBeCloseTo((3 * 20 + 12 * 8) / 15);
  });

  it('leaves a season without prior data on whole-season averages', () => {
    const sandbox = buildSeason(rawLog('2026-27', nights));
    expect(formView(sandbox, 2)).toBe(sandbox);
    expect(sandbox.players[1].avg.pts).toBe(30);
  });

  it('round-trips the prior games and through date in the compact format', () => {
    const withDate = buildSeason(rawLog('2026-27', nights, { throughDate: '2026-11-08' }), [prior]);
    const back = decodeSeason(JSON.parse(JSON.stringify(encodeSeason(withDate))));
    expect(back.prior).toEqual(withDate.prior);
    expect(back.throughDate).toBe('2026-11-08');
    expect(formView(back, 2).players[1].avg.pts).toBeCloseTo(formView(withDate, 2).players[1].avg.pts);
  });
});

describe('live calendar', () => {
  it('leaves out a week that hasn’t finished', () => {
    // Through Wednesday of week 3: week 3's Tuesday game is in the log, but the week isn't over.
    const partial = buildSeason(rawLog('2026-27', nights, { throughDate: day('2026-10-19', 16) }), [prior]);
    expect(partial.weeks.map((w) => w.index)).toEqual([1, 2]);
    expect(Object.values(partial.games).every((g) => g.date <= day('2026-10-19', 13))).toBe(true);
    expect(buildSeason(rawLog('2026-27', nights, { throughDate: day('2026-10-19', 20) }), [prior]).weeks).toHaveLength(3);
  });
});

describe('chapter ratings', () => {
  it('rate a chapter from its first week', () => {
    const history = (weeks: number[]) => weeks.map((weekIndex) => ({ weekIndex }) as never);
    expect(chapterStartWeek(newGame('2026-27', 3))).toBe(3);
    expect(chapterStartWeek({ ...newGame('2026-27', 6), history: history([3, 4, 5]) })).toBe(3);
    expect(chapterStartWeek({ ...newGame('2026-27', 8), history: history([3, 4, 5, 6, 7]) })).toBe(7);
  });
});

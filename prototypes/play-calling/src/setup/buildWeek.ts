/**
 * Builds the week the game is played from out of the player's choices: each hero's player and game.
 * It follows scripts/pick-week.ts, which built the original fixed week, and uses the main game's own
 * rules for class ratings (computePool) and for the Champions each game brings (buildHorde).
 */
import type { SeasonData, StatLine } from '../../../../src/data/types';
import { buildHorde, opponentOf, playerLine, type HeroGamePick } from '../../../../src/engine/horde';
import { computePool } from '../../../../src/engine/rating';
import { rules, type HeroClass } from '../../../../src/rules';
import { FIXED_WEEK, type WeekData, type WeekHero, type WeekLine } from '../week';
import { DEFAULT_TUNING } from '../engine';

export const SETUP_CLASSES: HeroClass[] = ['warrior', 'cleric', 'rogue', 'wizard', 'ranger'];
export const ENCOUNTER = 'goblin-horde';

/** Season-wide calibration (defense tiers, touches per usage), measured once when the fixed week was built. */
const CAL = FIXED_WEEK.calibration;

export const trueUsage = (l: StatLine) => l.fga + 0.44 * l.fta + l.tov + l.ast;
export const defRating = (l: StatLine) => 3 * l.stl + 3 * l.blk + l.dreb;
export function defTierOf(r: number): string {
  const t = CAL.defThresholds;
  return r >= t.elite ? 'elite' : r >= t.great ? 'great' : r >= t.good ? 'good' : r >= t.average ? 'average' : 'cold';
}
/** Touches a game gives, on the same scale the game uses (DEFAULT_TUNING.usagePerTouch; at least 2). */
export const touchesOf = (l: StatLine) => Math.max(2, Math.round(trueUsage(l) / DEFAULT_TUNING.usagePerTouch));

const lineOf = (l: StatLine): WeekLine => ({
  min: l.min,
  pts: l.pts,
  reb: l.reb,
  ast: l.ast,
  stl: l.stl,
  blk: l.blk,
  tov: l.tov,
  fg3m: l.fg3m,
  fgm: l.fgm,
  fga: l.fga,
  fta: l.fta,
  ftm: l.ftm,
  oreb: l.oreb,
  dreb: l.dreb,
});
const ZERO: WeekLine = { min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fg3m: 0, fgm: 0, fga: 0, fta: 0, ftm: 0, oreb: 0, dreb: 0 };

/** Everything a hero gets from one game, for the Pick games cards and for the week itself. */
export function heroFromGame(data: SeasonData, cls: HeroClass, playerId: number, gameId: string): WeekHero {
  const g = data.games[gameId];
  const l = playerLine(data, gameId, playerId)!;
  const pool = computePool(cls, l);
  const tu = trueUsage(l);
  return {
    cls,
    player: data.players[playerId]?.name ?? `Player ${playerId}`,
    team: l.team,
    opp: opponentOf(l.team, g),
    date: g.date,
    home: g.home === l.team,
    line: lineOf(l),
    tier: pool.tier,
    rating: pool.rating,
    doubleDouble: pool.doubleDouble,
    tripleDouble: pool.tripleDouble,
    defRating: defRating(l),
    defTier: defTierOf(defRating(l)),
    trueUsage: Math.round(tu * 10) / 10,
    touches: touchesOf(l),
  };
}

/**
 * The week from each hero's player and game. A hero with no game sits out (no touches, on the
 * bench all game). At least one hero has to play: the horde is built from their opponents.
 */
export function buildWeek(
  data: SeasonData,
  weekIndex: number,
  assignments: Partial<Record<HeroClass, number>>,
  gamePicks: Partial<Record<HeroClass, string>>,
): WeekData {
  const week = data.weeks.find((w) => w.index === weekIndex)!;
  const picks: HeroGamePick[] = SETUP_CLASSES.filter((c) => assignments[c] !== undefined && gamePicks[c]).map((c) => ({
    heroClass: c,
    playerId: assignments[c]!,
    gameId: gamePicks[c]!,
  }));
  const horde = buildHorde(picks, data, rules, ENCOUNTER);
  const heroes: WeekHero[] = SETUP_CLASSES.map((c) => {
    const pick = picks.find((p) => p.heroClass === c);
    if (pick) return heroFromGame(data, c, pick.playerId, pick.gameId);
    const id = assignments[c];
    const p = id !== undefined ? data.players[id] : undefined;
    return {
      cls: c,
      player: p?.name ?? 'No player',
      team: p?.team ?? '',
      opp: '',
      date: '',
      home: false,
      line: ZERO,
      tier: 'cold',
      rating: 0,
      doubleDouble: false,
      tripleDouble: false,
      defRating: 0,
      defTier: 'cold',
      trueUsage: 0,
      touches: 0,
      out: true,
    };
  });
  const champions = [...horde.champions, horde.warlord].map((m) => ({
    kind: m.kind,
    player: data.players[m.source!.playerId]?.name ?? '?',
    team: m.source!.team,
    tier: m.tier ?? 'average',
    hp: m.hp,
    damage: m.damage,
    mirrorOf: m.source!.mirrorOf ?? null,
    boss: m.isWarlord,
    line: lineOf(m.source!.line),
  }));
  const teams = picks.map((p) => teamOf(data, p.playerId, p.gameId));
  return {
    season: data.season,
    week: { index: week.index, start: week.start, end: week.end },
    heroes,
    champions,
    teams,
    calibration: CAL,
  };
}

/** The opposing team in a hero's game: its points (goblins) and FG% (the ram). */
export function teamOf(data: SeasonData, playerId: number, gameId: string) {
  const g = data.games[gameId];
  const own = playerLine(data, gameId, playerId)!.team;
  const opp = opponentOf(own, g);
  const ls = g.lines.filter((x) => x.team === opp);
  const pts = ls.reduce((s, x) => s + x.pts, 0);
  const fgm = ls.reduce((s, x) => s + x.fgm, 0);
  const fga = ls.reduce((s, x) => s + x.fga, 0);
  return { team: opp, pts, fgPct: Math.round((fgm / Math.max(1, fga)) * 1000) / 1000, goblins: Math.floor(pts / rules.horde.minions.teamPointsPerGoblin) };
}

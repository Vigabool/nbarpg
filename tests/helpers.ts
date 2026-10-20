import { emptyStatLine } from '../src/data/build';
import type { BoxLine, SeasonData, StatLine } from '../src/data/types';
import { createBattle, type BattleState, type HeroSetup } from '../src/engine/combat';
import type { MonsterSpec } from '../src/engine/horde';
import { computePool } from '../src/engine/rating';
import { CLASSES, type HeroClass } from '../src/rules';

export function stats(partial: Partial<StatLine> = {}): StatLine {
  const s = { ...emptyStatLine(), min: 30, ...partial };
  if (partial.reb === undefined) s.reb = s.oreb + s.dreb;
  return s;
}

export function boxLine(playerId: number, team: string, partial: Partial<StatLine> = {}): BoxLine {
  return { playerId, team, ...stats(partial) };
}

export function heroSetup(heroClass: HeroClass, line: Partial<StatLine> = {}, gear = 4): HeroSetup {
  return { heroClass, playerId: CLASSES.indexOf(heroClass) + 1, playerName: heroClass, gear, pool: computePool(heroClass, stats(line)) };
}

let n = 0;
export function monster(partial: Partial<MonsterSpec> = {}): MonsterSpec {
  return { id: `t${++n}`, kind: 'goblin', name: `Goblin ${n}`, hp: 8, damage: 3, isWarlord: false, extraActions: 0, staggers: 0, ...partial };
}

/** A full party with average nights (pool 20) and 4 gear damage. */
export function party(lines: Partial<Record<HeroClass, Partial<StatLine>>> = {}): HeroSetup[] {
  const avg: Record<HeroClass, Partial<StatLine>> = {
    warrior: { dreb: 8 },
    ranger: { pts: 12 },
    cleric: { ast: 4 },
    rogue: { stl: 1, ftm: 2 },
    wizard: { fg3m: 2 },
  };
  return CLASSES.map((c) => heroSetup(c, lines[c] ?? avg[c]));
}

export function battle(waves: MonsterSpec[][], heroes: HeroSetup[] = party()): BattleState {
  return createBattle(heroes, waves);
}

export function season(games: { id: string; date: string; home: string; away: string; lines: BoxLine[] }[], names: Record<number, string> = {}): SeasonData {
  const players: SeasonData['players'] = {};
  for (const g of games)
    for (const l of g.lines) players[l.playerId] ??= { id: l.playerId, name: names[l.playerId] ?? `P${l.playerId}`, team: l.team, gp: 1, avg: stats() };
  return {
    season: 'test',
    source: 'test',
    generatedAt: '',
    synthetic: true,
    weeks: [{ index: 1, start: '2025-10-20', end: '2025-10-26', gameIds: games.map((g) => g.id) }],
    games: Object.fromEntries(games.map((g) => [g.id, g])),
    players,
  };
}

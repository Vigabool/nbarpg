import { describe, expect, it } from 'vitest';
import { newGame } from '../src/app/game';
import { migrateSave } from '../src/app/saves';
import { buildSeason } from '../src/data/build';
import { eligiblePlayers } from '../src/engine/calibration';
import type { HeroGamePick } from '../src/engine/horde';
import { difficultyHorde, playerGamesInWeek, prepareBattle } from '../src/engine/week';
import { CLASSES, rules } from '../src/rules';
import { makeSyntheticSeason } from './fixtures/synthetic';

const data = buildSeason(makeSyntheticSeason({ teams: 10, weeks: 3, seed: 7 }));

function picks(): HeroGamePick[] {
  const week = data.weeks[0];
  const players = eligiblePlayers(data).filter((p) => playerGamesInWeek(data, week, p.id).length);
  return CLASSES.map((c, i) => ({ heroClass: c, playerId: players[i].id, gameId: playerGamesInWeek(data, week, players[i].id)[0] }));
}

describe('difficulty', () => {
  it('Normal scales Champions and bosses by the encounter’s setting; minions are untouched', () => {
    const hard = prepareBattle(picks(), data, undefined, 'crypt', { difficulty: 'hard' }).horde;
    const normal = prepareBattle(picks(), data, undefined, 'crypt', { difficulty: 'normal' }).horde;
    const f = rules.difficulty.levels.normal.encounters.crypt.champions!;
    const h = hard.waves.flat();
    const n = normal.waves.flat();
    for (let i = 0; i < h.length; i++) {
      if (h[i].kind === 'goblin') expect(n[i]).toEqual(h[i]);
      else {
        expect(n[i].hp).toBe(Math.max(1, Math.round(h[i].hp * f.hp)));
        expect(n[i].damage).toBe(Math.max(1, Math.round(h[i].damage * f.damage)));
      }
    }
    expect(normal.warlord.hp).toBeLessThan(hard.warlord.hp);
  });

  it('Hard, and encounters without a Normal setting, leave the horde as it is', () => {
    const horde = prepareBattle(picks(), data, undefined, 'giants-hall').horde;
    expect(difficultyHorde(horde, 'giants-hall', 'normal')).toBe(horde);
    expect(difficultyHorde(horde, 'crypt', 'hard')).toBe(horde);
  });

  it('new runs default to Normal; runs from before difficulty become Hard', () => {
    expect(newGame('2025-26', 1).difficulty).toBe(rules.difficulty.default);
    expect(rules.difficulty.default).toBe('normal');
    const { difficulty: _d, ...v3 } = { ...newGame('2025-26', 1), version: 3 };
    expect(migrateSave(v3).difficulty).toBe('hard');
  });
});

import { describe, expect, it } from 'vitest';
import { autoplay } from '../src/engine/autoplay';
import { endRound, specialDue, type BattleState } from '../src/engine/combat';
import { evaluate, smartAutoplay } from '../src/engine/smartBot';
import { battle, monster } from './helpers';

const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;

describe('smart bot', () => {
  it('wins an easy battle', () => {
    const end = smartAutoplay(battle([[monster(), monster()], [monster({ kind: 'ogre', hp: 30, damage: 6 })]]));
    expect(end.phase).toBe('won');
  });

  it('spends a Fumble to cancel a big special that is about to fire', () => {
    const o = monster({ kind: 'ogre', id: 'O', hp: 999, damage: 30, fumbles: 1 });
    let s = battle([[o]]);
    while (!specialDue(enemy(s, 'O'), s.round)) s = endRound(s);
    s = { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp })) };
    const before = s.log.length;
    // Play just this round: stop as soon as the round ends.
    const end = smartAutoplay({ ...s, round: s.round });
    const thisRound = end.log.slice(before).filter((l) => l.round === s.round);
    expect(thisRound.some((l) => l.text.includes('fumbles'))).toBe(true);
  });

  it('rates a state with a dead enemy above the same state without the kill', () => {
    const g = monster({ id: 'G', hp: 8, damage: 4 });
    const s = battle([[g, monster({ kind: 'ogre', hp: 999, damage: 0 })]]);
    const killed = { ...s, enemies: s.enemies.map((e) => (e.id === 'G' ? { ...e, hp: 0, alive: false } : e)) };
    expect(evaluate(killed)).toBeGreaterThan(evaluate(s));
  });

  it('beats the heuristic bot on a tough fight', () => {
    const wave = () => [monster({ kind: 'ogre', hp: 70, damage: 14 }), monster({ kind: 'hunter', hp: 40, damage: 12 }), monster(), monster(), monster()];
    const a = smartAutoplay(battle([wave(), wave()]));
    const b = autoplay(battle([wave(), wave()]));
    const score = (x: BattleState) => (x.phase === 'won' ? 1000 : 0) + x.heroes.reduce((t, h) => t + (h.alive ? h.hp : 0), 0);
    expect(score(a)).toBeGreaterThanOrEqual(score(b));
  });
});

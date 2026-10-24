import { describe, expect, it } from 'vitest';
import { activeSpecial, endRound, performAction, specialDue, type BattleState } from '../src/engine/combat';
import { battle, monster, party } from './helpers';

const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const setHp = (s: BattleState, id: string, hp: number): BattleState => ({ ...s, enemies: s.enemies.map((e) => (e.id === id ? { ...e, hp } : e)) });
/** Ends rounds until the enemy's special is due this round. */
const toSpecial = (s: BattleState, id: string): BattleState => {
  while (!specialDue(enemy(s, id), s.round)) s = endRound(s);
  return { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp, poison: null })) };
};

describe('Goblin Horde roles', () => {
  it('the Ogre tosses a goblin at the lowest-HP hero, past taunts', () => {
    const ogre = monster({ kind: 'ogre', hp: 99, damage: 10 });
    const g = monster({ hp: 99, damage: 0 });
    let s = toSpecial(battle([[ogre, g]]), ogre.id);
    expect(activeSpecial(s, enemy(s, ogre.id))?.key).toBe('goblinToss');
    s = endRound(s);
    expect(enemy(s, g.id).alive).toBe(false);
    expect(hero(s, 'wizard').hp).toBe(22 - 15);
  });

  it('with no goblins left, the Ogre falls back to Ground Slam', () => {
    const ogre = monster({ kind: 'ogre', hp: 99, damage: 10 });
    const s = toSpecial(battle([[ogre]]), ogre.id);
    expect(activeSpecial(s, enemy(s, ogre.id))?.key).toBe('ogre');
    expect(endRound(s).log.some((l) => l.text.includes('Ground Slam'))).toBe(true);
  });

  it("the Sharpshooter's Dirty Arrows poison its target", () => {
    const h = monster({ kind: 'hunter', hp: 99, damage: 4 });
    let s = endRound(battle([[h]]));
    expect(hero(s, 'wizard').poison?.rounds).toBe(1);
    expect(hero(s, 'wizard').hp).toBe(22 - 4 - 2);
  });
});

describe('Crypt roles', () => {
  it('the Bone Giant heals when a skeleton crumbles from weapon hits, not from fire', () => {
    const giant = monster({ kind: 'ogre', hp: 50, damage: 0 });
    const a = monster({ hp: 8, damage: 0 });
    const b = monster({ hp: 8, damage: 0 });
    let s = setHp(setHp(setHp(battle([[giant, a, b]], party(), 'crypt'), giant.id, 30), a.id, 1), b.id, 1);
    s = act(s, 'warrior', 'axe', [a.id]);
    expect(enemy(s, giant.id).hp).toBe(32);
    s = act(s, 'wizard', 'fireball', [b.id]);
    expect(enemy(s, b.id).alive).toBe(false);
    expect(enemy(s, giant.id).hp).toBeLessThanOrEqual(32);
  });

  it('the Skeletal Archer reassembles once at half HP, unless burned', () => {
    const archer = monster({ kind: 'hunter', hp: 30, damage: 0 });
    const tank = monster({ kind: 'warlock', hp: 999, damage: 0 });
    let s = setHp(battle([[archer, tank]], party(), 'crypt'), archer.id, 1);
    s = act(s, 'warrior', 'axe', [archer.id]);
    expect(enemy(s, archer.id).pile).toBe(true);
    s = endRound(s);
    expect(enemy(s, archer.id).alive).toBe(true);
    expect(enemy(s, archer.id).hp).toBe(15);
    s = act(setHp(s, archer.id, 1), 'warrior', 'axe', [archer.id]);
    expect(enemy(s, archer.id).alive).toBe(false);
    expect(enemy(s, archer.id).pile).toBeFalsy();

    let t = setHp(battle([[monster({ kind: 'hunter', id: 'A', hp: 30, damage: 0 }), tank]], party(), 'crypt'), 'A', 1);
    t = act(t, 'cleric', 'mace', ['A']);
    expect(enemy(t, 'A').pile).toBeFalsy();
  });
});

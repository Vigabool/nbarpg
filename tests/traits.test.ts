import { describe, expect, it } from 'vitest';
import { endRound, enemyDamage, listActions, performAction, type BattleState } from '../src/engine/combat';
import { rules } from '../src/rules';
import { battle, monster } from './helpers';

const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const targets = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string) =>
  listActions(s, heroId).find((o) => o.def.id === actionId)!.validTargets;

describe('box-score traits', () => {
  it('Swat negates the first hit each round', () => {
    const o = monster({ kind: 'ogre', hp: 99, damage: 0, traits: ['swat'] });
    let s = act(battle([[o]]), 'warrior', 'axe', [o.id]);
    expect(enemy(s, o.id).hp).toBe(99);
    s = act(s, 'rogue', 'dagger', [o.id]);
    expect(enemy(s, o.id).hp).toBeLessThan(99);
    const hp = enemy(s, o.id).hp;
    s = act(endRound(s), 'warrior', 'axe', [o.id]);
    expect(enemy(s, o.id).hp).toBe(hp);
  });

  it('Pickpocket steals energy with each hit', () => {
    const o = monster({ kind: 'ogre', hp: 99, damage: 5, traits: ['pickpocket'] });
    const s0 = battle([[o]]);
    const s = endRound(s0);
    expect(hero(s, 'warrior').pool).toBe(hero(s0, 'warrior').pool - rules.traits.pickpocket.energy!);
  });

  it('Second Chance gets back up once at 25% HP', () => {
    const o = monster({ kind: 'ogre', hp: 20, damage: 0, traits: ['secondChance'] });
    let s = battle([[o], [monster({ hp: 99 })]]);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === o.id ? { ...e, hp: 1 } : e)) };
    s = act(s, 'warrior', 'axe', [o.id]);
    expect(enemy(s, o.id).alive).toBe(true);
    expect(enemy(s, o.id).hp).toBe(5);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === o.id ? { ...e, hp: 1 } : e)) };
    s = act(s, 'rogue', 'dagger', [o.id]);
    expect(enemy(s, o.id).alive).toBe(false);
  });

  it('Floor General gives every other monster +2 damage', () => {
    const fg = monster({ kind: 'shaman', hp: 99, damage: 5, traits: ['floorGeneral'] });
    const g = monster({ damage: 3 });
    const s = battle([[fg, g]]);
    expect(enemyDamage(s, enemy(s, g.id))).toBe(5);
    expect(enemyDamage(s, enemy(s, fg.id))).toBe(5);
  });

  it('Deep Range ignores armor and taunts', () => {
    const o = monster({ kind: 'ogre', hp: 99, damage: 6, traits: ['deepRange'] });
    const s0 = battle([[o]]);
    expect(targets(s0, 'warrior', 'provoke')).not.toContain(o.id);
    expect(hero(s0, 'warrior').armor).toBeGreaterThan(0);
    const s = endRound(s0);
    expect(hero(s, 'warrior').hp).toBe(hero(s0, 'warrior').hp - 6);
  });

  it('Takeover acts twice once below half HP', () => {
    const o = monster({ kind: 'ogre', hp: 40, damage: 1, traits: ['takeover'] });
    const count = (s: BattleState) => s.log.filter((l) => l.actorId === o.id && l.round === s.round - 1).length;
    let s = battle([[o]]);
    expect(count(endRound(s))).toBe(1);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === o.id ? { ...e, hp: 20 } : e)) };
    expect(count(endRound(s))).toBe(2);
  });

  it('Hot Hand builds +2 a round while untouched, up to +6, and resets when hit', () => {
    const o = monster({ kind: 'ogre', hp: 99, damage: 5, traits: ['hotHand'] });
    let s = battle([[o]]);
    s = endRound(endRound(s));
    expect(enemyDamage(s, enemy(s, o.id))).toBe(9);
    s = endRound(endRound(s));
    expect(enemyDamage(s, enemy(s, o.id))).toBe(11);
    s = act(s, 'warrior', 'axe', [o.id]);
    expect(enemyDamage(s, enemy(s, o.id))).toBe(5);
  });
});

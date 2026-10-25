import { describe, expect, it } from 'vitest';
import { endRound, enemyDamage, listActions, performAction, type BattleState } from '../src/engine/combat';
import { buildHorde } from '../src/engine/horde';
import { rules } from '../src/rules';
import { battle, boxLine, monster, party, season } from './helpers';

const CRYPT = 'crypt';
const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const targets = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string) =>
  listActions(s, heroId).find((o) => o.def.id === actionId)!.validTargets;

describe('The Crypt: Wraith', () => {
  const wraith = () => monster({ kind: 'assassin', hp: 30, damage: 5, tier: 'good' });

  it('starts intangible: weapons cannot target it, spells and Cleric attacks can', () => {
    const w = wraith();
    const s = battle([[w]], party(), CRYPT);
    expect(enemy(s, w.id).intangible).toBe(true);
    expect(targets(s, 'warrior', 'axe')).not.toContain(w.id);
    expect(targets(s, 'rogue', 'dagger')).not.toContain(w.id);
    expect(targets(s, 'wizard', 'magic-missile')).toContain(w.id);
    expect(targets(s, 'wizard', 'staff')).not.toContain(w.id);
    expect(targets(s, 'cleric', 'mace')).toContain(w.id);
  });

  it('the first spell or holy hit makes it solid and still deals damage', () => {
    const w = wraith();
    let s = act(battle([[w]], party(), CRYPT), 'wizard', 'magic-missile', [w.id]);
    expect(enemy(s, w.id).intangible).toBe(false);
    expect(enemy(s, w.id).hp).toBe(30 - 6);
    expect(targets(s, 'warrior', 'axe')).toContain(w.id);
    s = act(s, 'warrior', 'axe', [w.id]);
    expect(enemy(s, w.id).hp).toBe(30 - 6 - 4);
  });

  it('drains every hero each round, ignoring armor, and heals itself', () => {
    const w = wraith();
    let s = act(battle([[w]], party(), CRYPT), 'cleric', 'mace', [w.id]);
    const hpAfterHit = enemy(s, w.id).hp;
    s = endRound(s);
    // Good tier drains the same amount from each of 5 heroes, the Warrior's armor included.
    const drain = rules.combat.wraith.drainByTier.good;
    for (const h of s.heroes) expect(h.hp).toBe(h.maxHp - drain);
    expect(enemy(s, w.id).hp).toBe(Math.min(30, hpAfterHit + Math.floor(drain * 5 * rules.combat.wraith.healFraction)));
  });

  it('fades back on its special round', () => {
    const w = wraith();
    let s = act(battle([[w]], party(), CRYPT), 'cleric', 'mace', [w.id]);
    s = endRound(endRound(s)); // round 3 (special every 3 rounds in tests)
    expect(enemy(s, w.id).intangible).toBe(false);
    s = endRound(s);
    expect(enemy(s, w.id).intangible).toBe(true);
  });
});

describe('The Crypt: Restless Dead', () => {
  const skeleton = () => monster({ hp: 8, damage: 0 });
  const tank = () => monster({ kind: 'ogre', hp: 999, damage: 0 });
  /** Drops a skeleton to 1 HP, then finishes it with a weapon (not fire or holy). */
  const smash = (s: BattleState, id: string) => act({ ...s, enemies: s.enemies.map((e) => (e.id === id ? { ...e, hp: 1 } : e)) }, 'warrior', 'axe', [id]);

  it('weapon kills leave a bone pile that reassembles at half HP each time: 8, 4, 2, then gone', () => {
    const sk = skeleton();
    let s = battle([[sk, tank()]], party(), CRYPT);
    for (const hp of [4, 2]) {
      s = smash(s, sk.id);
      expect(enemy(s, sk.id).alive).toBe(false);
      expect(enemy(s, sk.id).pile).toBe(true);
      s = endRound(s);
      expect(enemy(s, sk.id).alive).toBe(true);
      expect(enemy(s, sk.id).hp).toBe(hp);
    }
    s = smash(s, sk.id);
    expect(enemy(s, sk.id).alive).toBe(false);
    expect(enemy(s, sk.id).pile).toBeFalsy();
  });

  it('fire and holy damage destroy skeletons for good', () => {
    const a = skeleton();
    const b = skeleton();
    let s = battle([[a, b, tank()]], party(), CRYPT);
    s = { ...s, enemies: s.enemies.map((e) => (e.kind === 'goblin' ? { ...e, hp: 1 } : e)) };
    s = act(s, 'cleric', 'mace', [a.id]);
    expect(enemy(s, a.id).pile).toBeFalsy();
    expect(enemy(s, a.id).destroyed).toBe(true);
    s = act(s, 'wizard', 'fireball', [b.id]);
    expect(enemy(s, b.id).pile).toBeFalsy();
    expect(enemy(s, b.id).destroyed).toBe(true);
  });

  it('a wave with bone piles is not cleared, and victory waits for them', () => {
    const sk = skeleton();
    let s = smash(battle([[sk]], party(), CRYPT), sk.id);
    expect(s.phase).toBe('party');
    expect(s.stats.wavesCleared).toBe(0);
    s = endRound(s);
    s = act(s, 'cleric', 'mace', [sk.id]);
    expect(s.phase).toBe('won');
  });

  it('Goblin Horde goblins never reassemble', () => {
    const g = skeleton();
    const s = act(battle([[g, tank()]]), 'warrior', 'axe', [g.id]);
    expect(enemy(s, g.id).pile).toBeFalsy();
  });
});

describe('The Crypt: Wight and Lich', () => {
  it('Raise Dead brings crumbled skeletons back at 2 HP, but not fire or holy kills', () => {
    const a = monster({ hp: 8, damage: 0 });
    const b = monster({ hp: 8, damage: 0 });
    const wight = monster({ kind: 'shaman', hp: 999, damage: 0, tier: 'good' });
    let s = battle([[a, b, wight]], party(), CRYPT);
    // a has already crumbled through 8, 4, 2; b is burned.
    s = { ...s, enemies: s.enemies.map((e) => (e.id === a.id ? { ...e, hp: 1, rises: 2 } : e.id === b.id ? { ...e, hp: 1 } : e)) };
    s = act(s, 'warrior', 'axe', [a.id]);
    expect(enemy(s, a.id).pile).toBeFalsy();
    s = act(s, 'wizard', 'fireball', [b.id]);
    s = endRound(endRound(endRound(s))); // Raise Dead in round 3
    expect(enemy(s, a.id).alive).toBe(true);
    expect(enemy(s, a.id).hp).toBe(2);
    expect(enemy(s, b.id).alive).toBe(false);
  });

  it('Unholy Vigor: skeletons hit +1 while the Wight lives', () => {
    const sk = monster({ damage: 3 });
    const wight = monster({ kind: 'shaman', hp: 999, damage: 0 });
    const s = battle([[sk, wight]], party(), CRYPT);
    expect(enemyDamage(s, enemy(s, sk.id))).toBe(4);
    const dead = { ...s, enemies: s.enemies.map((e) => (e.id === wight.id ? { ...e, alive: false, hp: 0 } : e)) };
    expect(enemyDamage(dead, enemy(dead, sk.id))).toBe(3);
  });

  it('the Phylactery hides behind skeletons, halves damage to the Lich, and shatters with it', () => {
    const sk = monster({ hp: 8, damage: 0 });
    const lich = monster({ kind: 'lich', hp: 99, damage: 0, isWarlord: true, extraActions: 1 });
    const phyl = monster({ kind: 'phylactery', hp: 99, damage: 0 });
    let s = battle([[sk, lich, phyl]], party(), CRYPT);
    expect(targets(s, 'warrior', 'axe')).not.toContain(phyl.id);
    const hp = enemy(s, lich.id).hp;
    s = act(s, 'warrior', 'axe', [lich.id]);
    const halved = hp - enemy(s, lich.id).hp;
    s = { ...s, enemies: s.enemies.map((e) => (e.id === sk.id ? { ...e, alive: false, hp: 0, destroyed: true } : e)) };
    expect(targets(s, 'ranger', 'longbow')).toContain(phyl.id);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === phyl.id ? { ...e, hp: 1 } : e)) };
    s = act(s, 'ranger', 'longbow', [phyl.id]);
    expect(enemy(s, phyl.id).alive).toBe(false);
    const before = enemy(s, lich.id).hp;
    s = act(s, 'rogue', 'dagger', [lich.id]);
    expect(before - enemy(s, lich.id).hp).toBeGreaterThan(halved);
    // A fresh fight: killing the Lich shatters its Phylactery.
    let t = battle(
      [[monster({ kind: 'lich', id: 'L', hp: 1, damage: 0, isWarlord: true }), monster({ kind: 'phylactery', id: 'P', hp: 99, damage: 0 })]],
      party(),
      CRYPT,
    );
    t = { ...t, enemies: t.enemies.map((e) => (e.id === 'L' ? { ...e, hp: 1 } : e)) };
    t = act(t, 'warrior', 'axe', ['L']);
    expect(enemy(t, 'P').alive).toBe(false);
    expect(t.phase).toBe('won');
  });

  it('Death Bolt hits the lowest-HP hero for 1.5x, ignoring armor', () => {
    const lich = monster({ kind: 'lich', hp: 999, damage: 10, isWarlord: true, extraActions: 0 });
    let s = endRound(endRound(battle([[lich]], party(), CRYPT)));
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'rogue' ? { ...h, hp: 20 } : { ...h, hp: h.maxHp })) };
    s = endRound(s);
    expect(hero(s, 'rogue').hp).toBe(20 - 15);
  });
});

describe('The Crypt: horde', () => {
  it('uses Crypt names and the Lich as boss', () => {
    const aaa = [1, 2, 3, 4, 5].map((id) => boxLine(id, 'AAA', { pts: 10, fgm: 4, fga: 9 }));
    const bbb = [101, 102, 103, 104, 105].map((id, i) => boxLine(id, 'BBB', { pts: 30 - i * 4, dreb: 3 + i, ast: 2 + i, stl: i, fgm: 8, fga: 16 }));
    const data = season([{ id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [...aaa, ...bbb] }]);
    const h = buildHorde(
      [
        { heroClass: 'ranger', playerId: 2, gameId: 'g1' },
        { heroClass: 'rogue', playerId: 4, gameId: 'g1' },
      ],
      data,
      undefined,
      CRYPT,
    );
    expect(h.warlord.kind).toBe('lich');
    expect(h.warlord.name.startsWith('Lich · ')).toBe(true);
    const names = h.waves.flat().map((m) => m.name.split(' · ')[0].split(' (')[0]);
    expect(names).toContain('Skeleton');
    expect(h.waves.at(-1)!.some((m) => m.kind === 'phylactery')).toBe(true);
  });
});

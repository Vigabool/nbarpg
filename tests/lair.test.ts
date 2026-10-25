import { describe, expect, it } from 'vitest';
import { activeSpecial, endRound, enemyDamage, listActions, performAction, specialDue, type BattleState } from '../src/engine/combat';
import { buildHorde } from '../src/engine/horde';
import { rules } from '../src/rules';
import { battle, boxLine, monster, party, season } from './helpers';

const LAIR = 'dragon-lair';
const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const option = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string) => listActions(s, heroId).find((o) => o.def.id === actionId)!;
const dragon = () => monster({ kind: 'dragon', id: 'D', hp: 60, damage: 10, isWarlord: true, extraActions: 1, sleeps: true });
const tank = () => monster({ kind: 'warlock', hp: 999, damage: 0 });
const toSpecial = (s: BattleState, id: string): BattleState => {
  while (!specialDue(enemy(s, id), s.round)) s = endRound(s);
  return { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp })) };
};

describe("Dragon's Lair: the sleeping Dragon", () => {
  it('sleeps through the early waves, untouched by area attacks and summons', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    expect(enemy(s, 'D').asleep).toBe(true);
    expect(option(s, 'ranger', 'volley').validTargets).not.toContain('D'); // hits every enemy
    expect(option(s, 'warrior', 'axe').validTargets).toContain('D');
    s = endRound(s);
    expect(s.log.some((l) => l.actorId === 'D')).toBe(false);
    expect(s.heroes.every((h) => h.hp === h.maxHp)).toBe(true);
  });

  it('once a hit stirs it, area attacks hit it too (with the ambush bonus)', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    // Volley is the Ranger's Signature: unlock it as if their player had a double-double.
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'ranger' ? { ...h, signatureUnlocked: true, signatureReady: true } : h)) };
    expect(option(s, 'ranger', 'volley').validTargets).not.toContain('D');
    s = act(s, 'warrior', 'axe', ['D']);
    expect(enemy(s, 'D').waking).toBe(true);
    expect(option(s, 'ranger', 'volley').validTargets).toContain('D');
    const before = enemy(s, 'D').hp;
    s = act(s, 'ranger', 'volley');
    expect(enemy(s, 'D').hp).toBe(before - Math.floor(6 * rules.combat.dragonSleep.damageMultiplier));
  });

  it('a sleeping Dragon does not hold waves back or count as a foe on the field', () => {
    const k = monster({ hp: 1, damage: 0 });
    let s = battle([[dragon(), k], [monster({ id: 'W2' })], [monster()]], party(), LAIR);
    s = act(s, 'warrior', 'axe', [k.id]);
    expect(s.stats.wavesCleared).toBe(1);
    s = endRound(s);
    expect(s.enemies.some((e) => e.id === 'W2')).toBe(true);
  });

  it('an ambush deals extra damage, and the Dragon wakes at the end of the round and seals the hoard', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    s = act(s, 'warrior', 'axe', ['D']);
    expect(enemy(s, 'D').hp).toBe(60 - Math.floor(rules.combat.dragonSleep.damageMultiplier * hero(s, 'warrior').gear));
    expect(enemy(s, 'D').asleep).toBe(true);
    s = endRound(s);
    expect(enemy(s, 'D').asleep).toBe(false);
    expect(s.hoard!.sealed).toBe(true);
    s = endRound(s);
    expect(s.log.some((l) => l.actorId === 'D' && l.round === s.round - 1)).toBe(true);
  });

  it('a Dragon that survives an ambush answers at once with Rude Awakening, then stays groggy', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    s = act(s, 'warrior', 'axe', ['D']);
    const before = s.heroes.map((h) => h.hp);
    s = endRound(s);
    const r = rules.combat.dragonSleep.rudeAwakening;
    const breath = s.log.find((l) => l.actorId === 'D' && l.text.includes(r.name))!;
    expect(breath).toBeDefined();
    expect(breath.round).toBe(1);
    // Every hero takes the breath (minus armor): 10 damage × the multiplier.
    expect(breath.text).toContain(`${Math.round(10 * r.damageMultiplier)} to`);
    expect(s.heroes.every((h, i) => h.hp < before[i])).toBe(true);
    expect(enemy(s, 'D').groggy).toBe(r.groggy);
  });

  it('a Dragon killed in its sleep never breathes', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === 'D' ? { ...e, hp: 1 } : e)) };
    s = act(s, 'warrior', 'axe', ['D']);
    s = endRound(s);
    expect(s.log.some((l) => l.actorId === 'D')).toBe(false);
  });

  it('the final wave wakes it', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    while (s.pendingWaves.length > 0) s = endRound(s);
    expect(s.waveIndex).toBe(2);
    expect(enemy(s, 'D').asleep).toBe(false);
  });
});

describe("Dragon's Lair: the hoard", () => {
  it('kobolds tithe a coin each round while the Dragon sleeps; every 3 coins is +1 Dragon damage', () => {
    let s = battle([[dragon(), tank(), monster({ damage: 0 }), monster({ damage: 0 }), monster({ damage: 0 })], [monster()], [monster()]], party(), LAIR);
    s = endRound(s);
    expect(s.hoard!.coins).toBe(3);
    expect(enemyDamage(s, enemy(s, 'D'))).toBe(11);
    s = { ...s, hoard: { coins: 40, sealed: false } };
    expect(enemyDamage(s, enemy(s, 'D'))).toBe(10 + rules.combat.hoardTithe.maxBonus);
  });

  it('the Scale Priest adds coins while the hoard is open, and has no special once it is sealed', () => {
    const p = monster({ kind: 'shaman', id: 'P', hp: 999, damage: 0 });
    let s = toSpecial(battle([[dragon(), p], [monster()], [monster()]], party(), LAIR), 'P');
    const before = s.hoard!.coins;
    s = endRound(s);
    expect(s.log.some((l) => l.actorId === 'P' && l.text.includes('Tithe Blessing'))).toBe(true);
    expect(s.hoard!.coins).toBeGreaterThanOrEqual(before + rules.combat.specials.titheBlessing.coins);
    s = { ...s, hoard: { ...s.hoard!, sealed: true } };
    expect(activeSpecial(s, enemy(s, 'P'))).toBeNull();
  });

  it('the Wyrmling adds a coin when it drains energy', () => {
    const w = monster({ kind: 'assassin', hp: 99, damage: 3 });
    const s = endRound(battle([[dragon(), w], [monster()], [monster()]], party(), LAIR));
    expect(s.hoard!.coins).toBe(1);
  });
});

describe("Dragon's Lair: roles", () => {
  it('Dragonscale halves fire on dragonkin, not on kobolds', () => {
    const drake = monster({ kind: 'ogre', id: 'K', hp: 99, damage: 0 });
    const kob = monster({ id: 'B', hp: 99, damage: 0 });
    const s = act(battle([[drake, kob]], party(), LAIR), 'wizard', 'fireball', ['K', 'B']);
    expect(99 - enemy(s, 'K').hp).toBe(Math.floor((99 - enemy(s, 'B').hp) / 2));
  });

  it('Molten Hide burns weapon users, not spellcasters', () => {
    const drake = monster({ kind: 'ogre', id: 'K', hp: 99, damage: 0 });
    let s = act(battle([[drake]], party(), LAIR), 'rogue', 'dagger', ['K']);
    expect(hero(s, 'rogue').hp).toBe(hero(s, 'rogue').maxHp - 2);
    s = act(s, 'wizard', 'magic-missile', ['K']);
    expect(hero(s, 'wizard').hp).toBe(hero(s, 'wizard').maxHp);
  });

  it("the Trapper's Net Shot stops its target attacking next round", () => {
    const t = monster({ kind: 'hunter', id: 'T', hp: 99, damage: 2 });
    let s = endRound(toSpecial(battle([[t]], party(), LAIR), 'T'));
    const netted = s.heroes.find((h) => h.nettedRound === s.round)!;
    expect(netted).toBeDefined();
    const attack = listActions(s, netted.id).find((o) => o.attack)!;
    expect(attack.available).toBe(false);
    expect(attack.reason).toContain('Netted');
  });

  it('Fire Breath hits every hero', () => {
    let s = battle([[dragon(), tank()], [monster()], [monster()]], party(), LAIR);
    s = endRound(act(s, 'warrior', 'axe', ['D']));
    s = toSpecial(s, 'D');
    s = endRound(s);
    expect(s.log.some((l) => l.text.includes('breathes fire'))).toBe(true);
  });

  it('the horde puts a sleeping Dragon in wave 1, with fragile kobolds', () => {
    const aaa = [1, 2, 3, 4, 5].map((id) => boxLine(id, 'AAA', { pts: 10, fgm: 4, fga: 9 }));
    const bbb = [101, 102, 103, 104, 105, 106].map((id, i) => boxLine(id, 'BBB', { pts: 30 - i * 4, dreb: 3 + i, ast: 2 + i, stl: i, fgm: 8, fga: 16 }));
    const data = season([{ id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [...aaa, ...bbb] }]);
    const h = buildHorde([{ heroClass: 'ranger', playerId: 2, gameId: 'g1' }], data, undefined, LAIR);
    expect(h.waves[0].some((m) => m.kind === 'dragon' && m.sleeps)).toBe(true);
    expect(h.waves.flat().find((m) => m.kind === 'goblin')?.hp).toBe(6);
  });
});

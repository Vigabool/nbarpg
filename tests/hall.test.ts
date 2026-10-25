import { describe, expect, it } from 'vitest';
import { endRound, landingWarning, performAction, specialDue, toppleThreshold, type BattleState } from '../src/engine/combat';
import { buildHorde } from '../src/engine/horde';
import { rules } from '../src/rules';
import { battle, boxLine, monster, party, season } from './helpers';

const HALL = 'giants-hall';
const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const patch = (s: BattleState, id: string, p: Partial<BattleState['enemies'][number]>): BattleState => ({
  ...s,
  enemies: s.enemies.map((e) => (e.id === id ? { ...e, ...p } : e)),
});
const toSpecial = (s: BattleState, id: string): BattleState => {
  while (!specialDue(enemy(s, id), s.round)) s = endRound(s);
  return { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp })) };
};

describe("Giant's Hall: Topple", () => {
  it('half its max HP in one round topples a giant: it loses its next action, and the landing hurts every hero', () => {
    const g = monster({ kind: 'ogre', id: 'G', hp: 100, damage: 10 });
    let s = battle([[g]], party(), HALL);
    expect(toppleThreshold(s, enemy(s, 'G'))).toBe(50);
    s = act(patch(s, 'G', { toppleDamage: 49 }), 'warrior', 'axe', ['G']);
    expect(enemy(s, 'G').toppled).toBe(true);
    const crash = rules.combat.topple.crashDamage;
    expect(s.heroes.every((h) => h.hp === h.maxHp - crash)).toBe(true);
    s = { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp })) };
    s = endRound(s);
    expect(s.heroes.every((h) => h.hp === h.maxHp)).toBe(true);
    expect(s.log.some((l) => l.text.includes('is down and loses its turn'))).toBe(true);
    expect(enemy(s, 'G').toppled).toBe(false);
  });

  it('the count resets each round', () => {
    const g = monster({ kind: 'ogre', id: 'G', hp: 100, damage: 0 });
    let s = act(battle([[g]], party(), HALL), 'warrior', 'axe', ['G']);
    expect(enemy(s, 'G').toppleDamage).toBeGreaterThan(0);
    s = endRound(s);
    expect(enemy(s, 'G').toppleDamage).toBe(0);
  });

  it('wolves never topple; the Lord needs 60% but loses both actions', () => {
    const w = monster({ id: 'W', hp: 12 });
    const lord = monster({ kind: 'giantLord', id: 'L', hp: 100, damage: 10, isWarlord: true, extraActions: 1 });
    let s = battle([[w, lord]], party(), HALL);
    expect(toppleThreshold(s, enemy(s, 'W'))).toBeNull();
    expect(toppleThreshold(s, enemy(s, 'L'))).toBe(60);
    s = act(patch(s, 'L', { toppleDamage: 59 }), 'warrior', 'axe', ['L']);
    s = endRound(s);
    expect(s.log.filter((l) => l.actorId === 'L' && l.side === 'enemy' && l.round === 1).map((l) => l.short)).toEqual(['⛰️ Toppled']);
  });

  it("the Skald's Rallying Saga raises every threshold by 5", () => {
    const g = monster({ kind: 'ogre', id: 'G', hp: 100, damage: 0 });
    const skald = monster({ kind: 'shaman', id: 'S', hp: 50, damage: 0 });
    const s = battle([[g, skald]], party(), HALL);
    expect(toppleThreshold(s, enemy(s, 'G'))).toBe(55);
  });
});

describe("Giant's Hall: roles", () => {
  it('the Frost Troll regenerates unless toppled or burned that round', () => {
    const t = monster({ kind: 'assassin', id: 'T', hp: 60, damage: 0 });
    let s = endRound(patch(battle([[t]], party(), HALL), 'T', { hp: 40 }));
    expect(enemy(s, 'T').hp).toBe(44);
    s = endRound(act(s, 'wizard', 'fireball', ['T']));
    expect(enemy(s, 'T').burnedRound).toBe(s.round - 1);
    const hp = enemy(s, 'T').hp;
    s = endRound(s);
    expect(enemy(s, 'T').hp).toBe(Math.min(60, hp + 4));
  });

  it("the Stone Giant's Boulder Toss skips the Warrior and knocks its target prone", () => {
    const g = monster({ kind: 'ogre', id: 'G', hp: 999, damage: 8 });
    let s = toSpecial(battle([[g]], party(), HALL), 'G');
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'warrior' ? { ...h, hp: 5 } : h)) };
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(5);
    expect(hero(s, 'wizard').hp).toBe(22 - 10);
    expect(hero(s, 'wizard').prone).toBe(true);
  });

  it("the Giant Lord's Avalanche hits everyone and drains energy", () => {
    const lord = monster({ kind: 'giantLord', id: 'L', hp: 999, damage: 10, isWarlord: true, extraActions: 0 });
    let s = toSpecial(battle([[lord]], party(), HALL), 'L');
    const pool = hero(s, 'wizard').pool;
    s = endRound(s);
    expect(hero(s, 'wizard').hp).toBe(22 - 7);
    expect(hero(s, 'wizard').pool).toBe(pool - 2);
  });

  it('the horde has scaled giants and a few tough wolves', () => {
    const aaa = [1, 2, 3, 4, 5].map((id) => boxLine(id, 'AAA', { pts: 10, fgm: 4, fga: 9 }));
    const bbb = [101, 102, 103, 104, 105, 106].map((id, i) => boxLine(id, 'BBB', { pts: 30 - i * 4, dreb: 3 + i, ast: 2 + i, stl: i, fgm: 8, fga: 16 }));
    const data = season([{ id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [...aaa, ...bbb] }]);
    const h = buildHorde([{ heroClass: 'warrior', playerId: 3, gameId: 'g1' }], data, undefined, HALL);
    // The Dragon's Lair leaves Champions at normal size.
    const plain = buildHorde([{ heroClass: 'warrior', playerId: 3, gameId: 'g1' }], data, undefined, 'dragon-lair');
    const scale = rules.encounters.encounters[HALL].statScale!.hp;
    const ogre = (x: typeof h) => x.waves.flat().find((m) => m.kind === 'ogre')!;
    expect(ogre(h).hp).toBe(Math.round(ogre(plain).hp * scale));
    expect(h.warlord.kind).toBe('giantLord');
    for (const m of h.waves.flat().filter((m) => m.kind === 'goblin')) expect(m.hp).toBe(rules.encounters.encounters[HALL].minionHp);
  });

  it('Ice Wolves go for the most injured hero, unless taunted', () => {
    const w = monster({ id: 'W', hp: 99, damage: 4 });
    let s = battle([[w]], party(), HALL);
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'warrior' ? { ...h, hp: 25 } : h.id === 'wizard' ? { ...h, hp: 18 } : h)) };
    s = endRound(s);
    // Warrior is missing 15, the Wizard 4: the wolf picks the Warrior despite the Wizard's lower HP.
    expect(s.log.some((l) => l.actorId === 'W' && l.targetIds?.includes('warrior'))).toBe(true);
  });

  it('Ice Wolves hit for 4-5 by team shooting', () => {
    expect(rules.encounters.encounters[HALL].minionDamage).toEqual([4, 4, 5]);
  });
});

describe("Giant's Hall: landing warning", () => {
  const crash = rules.combat.topple.crashDamage;
  const setup = (toppleDamage: number, wizardHp: number) => {
    const g = monster({ kind: 'ogre', id: 'G', hp: 100, damage: 0 });
    const s = patch(battle([[g]], party(), HALL), 'G', { toppleDamage });
    return { ...s, heroes: s.heroes.map((h) => (h.id === 'wizard' ? { ...h, hp: wizardHp } : h)) };
  };

  it('names the heroes the landing would drop when one more hit could topple the giant', () => {
    const s = setup(49, crash);
    expect(landingWarning(s, enemy(s, 'G')).map((h) => h.id)).toEqual(['wizard']);
    // And that's what happens.
    const after = act(s, 'warrior', 'axe', ['G']);
    expect(hero(after, 'wizard').alive).toBe(false);
  });

  it('stays quiet when the topple is out of reach this turn, or nobody is low enough', () => {
    expect(landingWarning(setup(0, crash), enemy(setup(0, crash), 'G'))).toEqual([]);
    const healthy = setup(49, crash + 1);
    expect(landingWarning(healthy, enemy(healthy, 'G'))).toEqual([]);
  });

  it('Last Stand heroes are safe: they hold at 1 HP', () => {
    const s = setup(49, crash);
    const stand = { ...s, heroes: s.heroes.map((h) => (h.id === 'wizard' ? { ...h, lastStand: true } : h)) };
    expect(landingWarning(stand, enemy(stand, 'G'))).toEqual([]);
  });
});

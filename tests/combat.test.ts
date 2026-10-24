import { describe, expect, it } from 'vitest';
import { canFumble, endRound, livingEnemies, spendFumble, specialDue, listActions, nextWaveRound, performAction, previewEnemyPhase, previewRound, actionDamage, commandBonus, enemyDamage, isGuarded, packBonus, type BattleState } from '../src/engine/combat';
import { rules } from '../src/rules';
import { battle, heroSetup, monster, party } from './helpers';

const act = (s: BattleState, heroId: BattleState['heroes'][number]['id'], actionId: string, targetIds: string[] = []) =>
  performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;

describe('hero actions', () => {
  it('spends pool and deals damage', () => {
    const g = monster({ hp: 30 });
    let s = battle([[g]]);
    s = act(s, 'wizard', 'lightning-bolt', [g.id]);
    expect(enemy(s, g.id).hp).toBe(16);
    expect(hero(s, 'wizard').pool).toBe(13);
    expect(hero(s, 'wizard').acted).toBe(true);
    expect(() => act(s, 'wizard', 'staff', [g.id])).toThrow(/Already attacked/);
  });

  it('refuses abilities the pool cannot pay for', () => {
    const s = battle([[monster()]], party({ wizard: { fg3m: 0 } })); // pool 12
    const opts = listActions(s, 'wizard');
    expect(opts.find((o) => o.def.id === 'fireball')!.available).toBe(true);
    const after = act(s, 'wizard', 'fireball', [s.enemies[0].id]);
    expect(hero(after, 'wizard').pool).toBe(2);
  });

  it('locks Signature behind a double-double and allows one use', () => {
    const s = battle([[monster(), monster()]]);
    expect(listActions(s, 'wizard').find((o) => o.def.id === 'chain-lightning')!.reason).toBe('Needs a double-double');
    const dd = battle([[monster({ hp: 30 }), monster({ hp: 30 })]], party({ wizard: { fg3m: 4, pts: 20, ast: 10 } }));
    const after = act(dd, 'wizard', 'chain-lightning');
    expect(after.enemies.map((e) => e.hp)).toEqual([20, 20]);
    expect(hero(after, 'wizard').pool).toBe(dd.heroes.find((h) => h.id === 'wizard')!.pool);
    const next = endRound(after);
    expect(listActions(next, 'wizard').find((o) => o.def.id === 'chain-lightning')!.reason).toBe('Already used');
  });

  it('applies armor from Shaman shields unless the attack pierces', () => {
    const g = monster({ hp: 30 });
    let s = battle([[g]]);
    s = { ...s, enemies: s.enemies.map((e) => ({ ...e, shield: { armor: 2, rounds: 1 } })) };
    s = act(s, 'warrior', 'axe', [g.id]);
    expect(enemy(s, g.id).hp).toBe(28);
    s = act(s, 'wizard', 'magic-missile', [g.id]);
    expect(enemy(s, g.id).hp).toBe(22);
  });

  it('Ready Crit doubles the next attack only', () => {
    const g = monster({ hp: 50 });
    let s = battle([[g]]);
    s = act(s, 'rogue', 'ready-crit');
    s = endRound(s);
    s = act(s, 'rogue', 'dagger', [g.id]);
    expect(enemy(s, g.id).hp).toBe(50 - 8);
    expect(hero(s, 'rogue').nextAttackMultiplier).toBe(1);
  });

  it('Empower stacks with Ready Crit', () => {
    const g = monster({ hp: 50 });
    let s = battle([[g]]);
    s = act(s, 'rogue', 'ready-crit');
    s = act(s, 'cleric', 'empower', ['rogue']);
    s = endRound(s);
    s = act(s, 'rogue', 'dagger', [g.id]);
    expect(enemy(s, g.id).hp).toBe(50 - 12);
  });

  it('Backstab doubles against a target taunted by someone else', () => {
    const g = monster({ hp: 50 });
    let s = battle([[g]]);
    s = act(s, 'warrior', 'provoke', [g.id]);
    s = act(s, 'rogue', 'backstab', [g.id]);
    expect(enemy(s, g.id).hp).toBe(30);
  });

  it('Double Strike moves to the weakest enemy if the first target falls', () => {
    const a = monster({ hp: 3 });
    const b = monster({ hp: 20 });
    const c = monster({ hp: 10 });
    let s = battle([[a, b, c]]);
    s = act(s, 'ranger', 'double-strike', [a.id]);
    expect(enemy(s, a.id).alive).toBe(false);
    expect(enemy(s, c.id).hp).toBe(6);
  });

  it('Longsword needs an enemy that attacked the Ranger last round', () => {
    const h = monster({ kind: 'assassin', hp: 40, damage: 2 });
    let s = battle([[h]], party({ warrior: { dreb: 0 } }));
    expect(listActions(s, 'ranger').find((o) => o.def.id === 'longsword')!.available).toBe(false);
    // Make the ranger the lowest-HP hero so the Assassin hits it.
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'ranger' ? { ...x, hp: 5 } : x)) };
    s = endRound(s);
    const sword = listActions(s, 'ranger').find((o) => o.def.id === 'longsword')!;
    expect(sword.available).toBe(true);
    s = act(s, 'ranger', 'longsword', [h.id]);
    expect(enemy(s, h.id).hp).toBe(40 - 7);
    // The Assassin's hit drained 2; the Longsword cost 1.
    expect(hero(s, 'ranger').pool).toBe(20 - 2 - 1);
  });

  it('Resurrect revives at half HP', () => {
    let s = battle([[monster({ hp: 50 })]]);
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'wizard' ? { ...x, hp: 0, alive: false } : x)) };
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'cleric' ? { ...x, pool: 12 } : x)) };
    s = act(s, 'cleric', 'resurrect', ['wizard']);
    expect(hero(s, 'wizard').alive).toBe(true);
    expect(hero(s, 'wizard').hp).toBe(11);
  });
});

describe('attacks and utilities', () => {
  it('allows one attack but any number of utilities per round', () => {
    const a = monster({ hp: 99 });
    const b = monster({ hp: 99 });
    let s = battle([[a, b]]);
    s = act(s, 'warrior', 'provoke', [a.id]);
    s = act(s, 'warrior', 'provoke', [b.id]);
    expect(hero(s, 'warrior').acted).toBe(false);
    s = act(s, 'warrior', 'axe', [a.id]);
    expect(hero(s, 'warrior').acted).toBe(true);
    // Two Provokes (−8), and the Axe gains 2.
    expect(hero(s, 'warrior').pool).toBe(20 - 8 + 2);
    expect(enemy(s, a.id).tauntedBy).toBe('warrior');
    expect(enemy(s, b.id).tauntedBy).toBe('warrior');
    expect(() => act(s, 'warrior', 'axe', [b.id])).toThrow(/Already attacked/);
  });

  it('lets a Cleric heal twice and still attack', () => {
    const g = monster({ hp: 99 });
    let s = battle([[g]]);
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'wizard' ? { ...x, hp: 5 } : x)) };
    s = act(s, 'cleric', 'cure-wounds', ['wizard']);
    s = act(s, 'cleric', 'cure-wounds', ['wizard']);
    s = act(s, 'cleric', 'mace', [g.id]);
    expect(hero(s, 'wizard').hp).toBe(21);
    expect(hero(s, 'cleric').pool).toBe(20 - 6 + 2);
    expect(enemy(s, g.id).hp).toBe(95);
  });

  it('still allows utilities after the attack, until energy runs out', () => {
    const g = monster({ hp: 99 });
    let s = battle([[g]]);
    s = act(s, 'warrior', 'axe', [g.id]);
    s = act(s, 'warrior', 'provoke', [g.id]);
    for (let i = 0; i < 4; i++) s = act(s, 'cleric', 'cure-wounds', ['warrior']);
    expect(hero(s, 'cleric').pool).toBe(20 - 12);
    for (let i = 0; i < 3; i++) s = act(s, 'warrior', 'second-wind');
    expect(hero(s, 'warrior').pool).toBe(22 - 4 - 18);
    expect(listActions(s, 'warrior').find((o) => o.def.id === 'second-wind')!.reason).toBe('Needs 6 energy');
  });

  it('the same buff does not stack with itself', () => {
    let s = battle([[monster({ hp: 99 })]]);
    s = act(s, 'warrior', 'parry');
    expect(hero(s, 'warrior').armor).toBe(2 + 6);
    expect(listActions(s, 'warrior').find((o) => o.def.id === 'parry')!.reason).toBe('Already active this round');
    s = act(s, 'cleric', 'empower', ['rogue']);
    expect(listActions(s, 'cleric').find((o) => o.def.id === 'empower')!.validTargets).not.toContain('rogue');
    // Different buffs still combine.
    s = act(s, 'rogue', 'ready-crit');
    expect(hero(s, 'rogue').nextAttackMultiplier).toBe(3);
    expect(listActions(s, 'rogue').find((o) => o.def.id === 'ready-crit')!.reason).toBe('Already active this round');
    // Parry is available again next round.
    s = endRound(s);
    expect(listActions(s, 'warrior').find((o) => o.def.id === 'parry')!.available).toBe(true);
  });

  it('classifies damage and kills as attacks, everything else as utility', () => {
    const s = battle([[monster()]]);
    const kinds = Object.fromEntries(listActions(s, 'rogue').map((o) => [o.def.id, o.attack]));
    expect(kinds).toMatchObject({ dagger: true, backstab: true, 'venom-strike': true, assassinate: true, 'ready-crit': false, shadowstep: false });
  });

  it('Ready Crit and an attack combine in the same round', () => {
    const g = monster({ hp: 50 });
    let s = battle([[g]]);
    s = act(s, 'rogue', 'ready-crit');
    s = act(s, 'rogue', 'dagger', [g.id]);
    expect(enemy(s, g.id).hp).toBe(50 - 8);
  });
});

describe('weapon attacks and energy', () => {
  it('basic attacks gain 2 energy', () => {
    const g = monster({ hp: 99 });
    const s = act(battle([[g]]), 'wizard', 'staff', [g.id]);
    expect(hero(s, 'wizard').pool).toBe(22);
    expect(enemy(s, g.id).hp).toBe(95);
  });

  it('advanced attacks cost energy and add an effect', () => {
    const g = monster({ hp: 99 });
    let s = battle([[g]]);
    s = act(s, 'wizard', 'magic-missile', [g.id]);
    expect(hero(s, 'wizard').pool).toBe(19);
    expect(enemy(s, g.id).hp).toBe(99 - 6);
    s = act(s, 'warrior', 'shield-bash', [g.id]);
    expect(enemy(s, g.id).tauntedBy).toBe('warrior');
    expect(enemy(s, g.id).hp).toBe(99 - 6 - 6);
    s = act(s, 'rogue', 'poisoned-blade', [g.id]);
    expect(enemy(s, g.id).poison).toEqual({ perRound: 2, rounds: 2 });
  });

  it('Holy Strike heals the most injured ally', () => {
    const g = monster({ hp: 99 });
    let s = battle([[g]]);
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'rogue' ? { ...x, hp: 10 } : x.id === 'wizard' ? { ...x, hp: 20 } : x)) };
    s = act(s, 'cleric', 'holy-strike', [g.id]);
    expect(hero(s, 'rogue').hp).toBe(13);
    expect(hero(s, 'wizard').hp).toBe(20);
    expect(hero(s, 'cleric').pool).toBe(18);
  });

  it('advanced attacks need the energy', () => {
    let s = battle([[monster({ hp: 99 })]]);
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'warrior' ? { ...x, pool: 1 } : x)) };
    expect(listActions(s, 'warrior').find((o) => o.def.id === 'shield-bash')!.reason).toBe('Needs 2 energy');
  });
});

describe('the horde', () => {
  it('attacks the Warrior by default, then the lowest HP', () => {
    const g = monster({ damage: 5, hp: 50 });
    const s = endRound(battle([[g]]));
    // Warrior has 2 armor from the Shield.
    expect(hero(s, 'warrior').hp).toBe(40 - 3);
    const noWarrior = battle([[monster({ id: 'x1', damage: 5, hp: 50 })]], party().filter((h) => h.heroClass !== 'warrior'));
    const after = endRound(noWarrior);
    expect(hero(after, 'wizard').hp).toBe(22 - 5);
  });

  it('Hunters ignore taunt and pick the lowest-armor hero', () => {
    const h = monster({ kind: 'hunter', damage: 6, hp: 40 });
    let s = battle([[h]]);
    s = act(s, 'warrior', 'shield-bash', [h.id]);
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(40);
    // Ties on armor (0) go to the lowest HP: the Wizard (22).
    expect(hero(s, 'wizard').hp).toBe(16);
  });

  it('Assassins drain pool on each hit', () => {
    const a = monster({ kind: 'assassin', damage: 5, hp: 40 });
    const s = endRound(battle([[a]]));
    expect(hero(s, 'wizard').pool).toBe(18);
  });

  it('Warlocks curse the whole party every 3rd round', () => {
    const w = monster({ kind: 'warlock', damage: 4, hp: 99 });
    let s = battle([[w]]);
    s = endRound(endRound(s));
    expect(s.round).toBe(3);
    s = endRound(s);
    expect(s.heroes.every((h) => h.curse?.amount === 2)).toBe(true);
    // The curse reduces hero damage for the next two party phases.
    s = act(s, 'warrior', 'axe', [w.id]);
    expect(enemy(s, w.id).hp).toBe(99 - 2);
    s = endRound(endRound(s));
    expect(hero(s, 'warrior').curse).toBeNull();
  });

  it('Ogres knock their target prone every 3rd round', () => {
    const o = monster({ kind: 'ogre', damage: 6, hp: 99 });
    let s = endRound(endRound(endRound(battle([[o]]))));
    expect(s.round).toBe(4);
    expect(hero(s, 'warrior').acted).toBe(true);
    expect(listActions(s, 'warrior').every((x) => !x.available)).toBe(true);
  });

  it('Shamans heal the most injured monster and shield the horde', () => {
    const g = monster({ hp: 30 });
    const sh = monster({ kind: 'shaman', hp: 20, damage: 2, tier: 'good' });
    let s = battle([[g, sh]]);
    s = act(s, 'wizard', 'lightning-bolt', [g.id]);
    s = endRound(s);
    expect(enemy(s, g.id).hp).toBe(16 + 6);
    expect(enemy(s, g.id).shield?.armor).toBe(2);
  });

  it('Fumbles do nothing until the party spends one; then the enemy loses its next action', () => {
    const o = monster({ kind: 'ogre', damage: 9, hp: 99, fumbles: 2 });
    let s = battle([[o]]);
    expect(hero(endRound(s), 'warrior').hp).toBeLessThan(40);
    s = spendFumble(s, o.id);
    expect(enemy(s, o.id).fumbles).toBe(1);
    expect(canFumble(s, enemy(s, o.id))).toBe(false); // one per action
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(40);
    expect(s.log.some((l) => l.text.includes('fumbles and loses its action'))).toBe(true);
    expect(canFumble(s, enemy(s, o.id))).toBe(true);
  });

  it('a Fumble on a special round cancels the special', () => {
    const o = monster({ kind: 'ogre', damage: 9, hp: 99, fumbles: 1 });
    let s = battle([[o]]);
    while (!specialDue(enemy(s, o.id), s.round)) s = endRound(s);
    s = { ...s, heroes: s.heroes.map((h) => ({ ...h, hp: h.maxHp })) };
    s = endRound(spendFumble(s, o.id));
    expect(s.heroes.every((h) => h.hp === h.maxHp)).toBe(true);
  });

  it('the Warlord acts twice', () => {
    const w = monster({ kind: 'ogre', damage: 6, hp: 99, isWarlord: true, extraActions: 1 });
    const s = endRound(battle([[w]]));
    expect(hero(s, 'warrior').hp).toBe(40 - 4 - 4);
  });

  it('poison ticks at the start of the enemy phase', () => {
    const g = monster({ hp: 30, damage: 0 });
    let s = battle([[g]]);
    s = act(s, 'rogue', 'venom-strike', [g.id]);
    expect(enemy(s, g.id).hp).toBe(26);
    s = endRound(s);
    expect(enemy(s, g.id).hp).toBe(23);
    s = endRound(endRound(endRound(s)));
    expect(enemy(s, g.id).hp).toBe(17);
  });

  it('Curse reduces monster damage for two rounds', () => {
    const o = monster({ kind: 'ogre', damage: 7, hp: 99 });
    let s = act(battle([[o]]), 'cleric', 'curse', [o.id]);
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(40 - 2);
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(40 - 4);
    s = endRound(s); // round 3: curse over; Ground Slam hits everyone for 7 − 2, less the Warrior's 2 armor
    expect(hero(s, 'warrior').hp).toBe(40 - 4 - 3);
  });

  it('Last Stand keeps the Warrior at 1 HP', () => {
    const big = monster({ kind: 'ogre', damage: 99, hp: 99 });
    let s = battle([[big]], [heroSetup('warrior', { dreb: 10, pts: 10, ast: 10 })]);
    s = act(s, 'warrior', 'last-stand');
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(1);
    expect(s.phase).toBe('party');
  });
});

describe('Wizard Shield', () => {
  it('gives the Wizard +5 armor for the round, once', () => {
    const h = monster({ kind: 'hunter', hp: 99, damage: 9 });
    let s = battle([[h]]);
    s = act(s, 'wizard', 'shield');
    expect(hero(s, 'wizard').armor).toBe(5);
    expect(hero(s, 'wizard').pool).toBe(17);
    expect(listActions(s, 'wizard').find((o) => o.def.id === 'shield')!.reason).toBe('Already active this round');
    // The Hunter picks the lowest-armor hero, which is no longer the Wizard.
    s = endRound(s);
    expect(hero(s, 'wizard').hp).toBe(22);
  });
});

describe('taunt immunity', () => {
  it('Provoke cannot target a Hunter', () => {
    const h = monster({ kind: 'hunter', hp: 40, damage: 6 });
    const g = monster({ hp: 40 });
    const s = battle([[h, g]]);
    const provoke = listActions(s, 'warrior').find((o) => o.def.id === 'provoke')!;
    expect(provoke.validTargets).toEqual([g.id]);
  });

  it('Shield Bash still hits a Hunter but the taunt does not take', () => {
    const h = monster({ kind: 'hunter', hp: 40, damage: 6 });
    let s = act(battle([[h]]), 'warrior', 'shield-bash', [h.id]);
    expect(enemy(s, h.id).hp).toBe(40 - 6);
    expect(enemy(s, h.id).tauntedBy).toBeNull();
    expect(s.log.at(-1)!.text).toContain('ignores the taunt');
    s = endRound(s);
    expect(hero(s, 'wizard').hp).toBe(22 - 6);
  });

  it('Bulwark taunts everything except the Hunter', () => {
    const h = monster({ kind: 'hunter', hp: 40, damage: 6 });
    const g = monster({ hp: 40 });
    const s = act(battle([[h, g]], party({ warrior: { dreb: 10, pts: 10 } })), 'warrior', 'bulwark');
    expect(enemy(s, g.id).tauntedBy).toBe('warrior');
    expect(enemy(s, h.id).tauntedBy).toBeNull();
  });
});

describe('summons', () => {
  it('Bears taunt the hardest hitter and bite the weakest enemy', () => {
    const weak = monster({ hp: 4, damage: 1 });
    const strong = monster({ kind: 'ogre', hp: 60, damage: 8 });
    let s = battle([[weak, strong]], party({ ranger: { pts: 30 } }));
    s = act(s, 'ranger', 'summon-bear');
    s = endRound(s);
    expect(enemy(s, weak.id).alive).toBe(false);
    // The Ogre hit the Bear, not the Warrior.
    expect(s.summons[0].hp).toBe(25 - 8);
    expect(hero(s, 'warrior').hp).toBe(40);
  });
});

describe('battle flow', () => {
  it('clearing the field early brings the next wave at the start of next round', () => {
    const a = monster({ hp: 4 });
    const b = monster({ hp: 50, damage: 9 });
    let s = battle([[a], [b]]);
    s = act(s, 'warrior', 'axe', [a.id]);
    expect(livingEnemies(s)).toEqual([]);
    expect(s.phase).toBe('party');
    expect(nextWaveRound(s)).toBe(2);
    // Heroes who haven't acted can still use utilities in the lull.
    s = act(s, 'warrior', 'parry');
    s = endRound(s);
    expect(s.heroes.every((h) => h.hp === h.maxHp)).toBe(true);
    expect(livingEnemies(s).map((e) => e.id)).toEqual([b.id]);
    // It fights the round it arrives.
    s = endRound(s);
    expect(hero(s, 'warrior').hp).toBe(40 - 7);
  });

  it('lets every living hero act again after a round ends early', () => {
    const g = monster({ hp: 999, damage: 1 });
    let s = battle([[g]]);
    s = act(s, 'warrior', 'axe', [g.id]);
    s = act(s, 'ranger', 'longbow', [g.id]);
    s = act(s, 'cleric', 'mace', [g.id]);
    s = endRound(s);
    expect(s.round).toBe(2);
    expect(s.heroes.every((h) => !h.acted)).toBe(true);
  });

  it('advances waves and wins when the last wave falls', () => {
    const a = monster({ hp: 4 });
    const b = monster({ hp: 4 });
    let s = battle([[a], [b]]);
    s = act(s, 'warrior', 'axe', [a.id]);
    s = endRound(s);
    expect(s.waveIndex).toBe(1);
    expect(livingEnemies(s).map((e) => e.id)).toEqual([b.id]);
    s = act(s, 'wizard', 'staff', [b.id]);
    expect(s.phase).toBe('won');
    expect(s.stats.wavesCleared).toBe(2);
  });

  it('loses at the round cap', () => {
    let s = battle([[monster({ hp: 999, damage: 0 })]]);
    for (let i = 0; i < 12; i++) s = endRound(s);
    expect(s.phase).toBe('lost');
    expect(s.round).toBe(12);
  });

  it('loses when every hero falls', () => {
    const s = endRound(battle([[monster({ hp: 999, damage: 99 })]], [heroSetup('wizard', { fg3m: 2 })]));
    expect(s.phase).toBe('lost');
  });

  it('previews the enemy phase without changing state', () => {
    const s = battle([[monster({ damage: 5 })]]);
    const preview = previewEnemyPhase(s);
    expect(preview[0].text).toContain('3 to Warrior');
    expect(hero(s, 'warrior').hp).toBe(40);
  });
});

describe('action damage', () => {
  it('shows effective damage, including gear and buffs', () => {
    let s = battle([[monster({ hp: 99 })]]);
    const dmg = (heroId: string, id: string) => {
      const h = s.heroes.find((x) => x.id === heroId)!;
      const def = [...rules.classes[h.heroClass].gear, ...rules.classes[h.heroClass].abilities].find((a) => a.id === id)!;
      return actionDamage(def, h);
    };
    expect(dmg('warrior', 'axe')).toBe('4');
    expect(dmg('wizard', 'fireball')).toBe('8×3');
    expect(dmg('wizard', 'chain-lightning')).toBe('10');
    expect(dmg('ranger', 'double-strike')).toBe('2×4');
    expect(dmg('warrior', 'parry')).toBeNull();
    s = act(s, 'rogue', 'ready-crit');
    expect(dmg('rogue', 'dagger')).toBe('8');
  });
});

describe('the wave clock', () => {
  it('brings waves in at rounds 3 and 5 even if the field is not clear', () => {
    const tank = monster({ hp: 999, damage: 0 });
    let s = battle([[tank], [monster({ hp: 50, damage: 0 })], [monster({ hp: 50, damage: 0 })]]);
    s = endRound(s);
    expect(livingEnemies(s).length).toBe(1);
    s = endRound(s); // into round 3
    expect(s.round).toBe(3);
    expect(s.waveIndex).toBe(1);
    expect(livingEnemies(s).length).toBe(2);
    s = endRound(endRound(s)); // round 5
    expect(s.waveIndex).toBe(2);
    expect(livingEnemies(s).length).toBe(3);
  });

  it('waves arriving on the clock attack that same round', () => {
    const g = monster({ hp: 999, damage: 0 });
    let s = battle([[g], [monster({ hp: 50, damage: 5 })]]);
    s = endRound(endRound(s));
    s = endRound(s);
    // 5 damage, +1 Pack Tactics (one other goblin), −2 Shield.
    expect(hero(s, 'warrior').hp).toBe(40 - 4);
  });

  it('credits each wave as it is cleared, even when waves overlap', () => {
    const a = monster({ hp: 999, damage: 0 });
    const b = monster({ hp: 4, damage: 0 });
    let s = battle([[a], [b]]);
    s = endRound(endRound(s));
    s = act(s, 'warrior', 'axe', [b.id]);
    expect(s.stats.wavesCleared).toBe(1);
    expect(s.clearedWaves).toEqual([1]);
    expect(s.phase).toBe('party');
  });
});

describe('champion specials (every 3rd round)', () => {
  const toRound3 = (s: BattleState) => endRound(endRound(s));

  it('Hunter Volley hits the two lowest-armor heroes', () => {
    const h = monster({ kind: 'hunter', hp: 99, damage: 5 });
    const s = endRound(toRound3(battle([[h]])));
    const hit = s.heroes.filter((x) => x.hp < x.maxHp).map((x) => x.id);
    expect(hit.length).toBe(2);
    expect(hit).not.toContain('warrior');
  });

  it('Assassin Execute doubles damage on a hero below half HP', () => {
    const a = monster({ kind: 'assassin', hp: 99, damage: 4 });
    let s = toRound3(battle([[a]]));
    s = { ...s, heroes: s.heroes.map((x) => (x.id === 'wizard' ? { ...x, hp: 10 } : x)) };
    s = endRound(s);
    expect(hero(s, 'wizard').hp).toBe(2);
  });

  it('Warlock Hex curses and damages every hero through armor', () => {
    const w = monster({ kind: 'warlock', hp: 99, damage: 4 });
    let s = toRound3(battle([[w]]));
    const before = Object.fromEntries(s.heroes.map((x) => [x.id, x.hp]));
    s = endRound(s);
    for (const x of s.heroes) {
      expect(x.curse?.amount).toBe(2);
      expect(before[x.id] - x.hp).toBe(3);
    }
  });

  it('Shaman War Drum adds +2 damage to the whole horde that round', () => {
    // The goblin is listed first, but the drummer still goes first.
    const g = monster({ hp: 999, damage: 5 });
    const sh = monster({ kind: 'shaman', hp: 99, damage: 0, tier: 'good' });
    let s = toRound3(battle([[g, sh]]));
    const hp3 = hero(s, 'warrior').hp;
    s = endRound(s); // round 3: drum, then the goblin hits for 5 + 2 − 2 armor
    expect(hero(s, 'warrior').hp).toBe(hp3 - 5);
    const hp4 = hero(s, 'warrior').hp;
    s = endRound(s); // round 4: back to 5 − 2
    expect(hero(s, 'warrior').hp).toBe(hp4 - 3);
  });

  it('Double Strike can split its two hits between enemies', () => {
    const a = monster({ hp: 20 });
    const b = monster({ hp: 20 });
    let s = battle([[a, b]]);
    s = act(s, 'ranger', 'double-strike', [a.id, b.id]);
    expect(enemy(s, a.id).hp).toBe(16);
    expect(enemy(s, b.id).hp).toBe(16);
    expect(hero(s, 'ranger').pool).toBe(20 - 6);
    s = act(s, 'wizard', 'staff', [a.id]);
    expect(() => act(s, 'ranger', 'double-strike', [a.id, b.id])).toThrow();
  });

  it('the Warlord enrages at half HP', () => {
    const w = monster({ kind: 'ogre', hp: 20, damage: 6, isWarlord: true, extraActions: 1 });
    let s = battle([[w]], party({ wizard: { fg3m: 6 } }));
    s = act(s, 'wizard', 'lightning-bolt', [w.id]);
    expect(enemy(s, w.id).enraged).toBe(true);
    expect(enemyDamage(s, enemy(s, w.id))).toBe(9);
    expect(s.log.some((l) => l.text.includes('enraged'))).toBe(true);
  });
});

describe('Pack Tactics', () => {
  it('gives each goblin +1 damage per other living goblin', () => {
    const gs = [monster({ damage: 3 }), monster({ damage: 3 }), monster({ damage: 3 })];
    let s = battle([gs]);
    expect(enemyDamage(s, enemy(s, gs[0].id))).toBe(5);
    s = act(s, 'wizard', 'lightning-bolt', [gs[1].id]);
    expect(enemyDamage(s, enemy(s, gs[0].id))).toBe(4);
    // Champions don't get it.
    expect(packBonus(s, { ...enemy(s, gs[0].id), kind: 'ogre' })).toBe(0);
  });
});

describe('Guarded by the Pack', () => {
  it('protects the Shaman from targeted attacks while 2+ goblins live', () => {
    const sh = monster({ kind: 'shaman', hp: 30, damage: 0, tier: 'good' });
    const g1 = monster({ hp: 4, damage: 0 });
    const g2 = monster({ hp: 4, damage: 0 });
    let s = battle([[sh, g1, g2]], party({ wizard: { fg3m: 6, pts: 10, ast: 10 } }));
    expect(isGuarded(s, enemy(s, sh.id))).toBe(true);
    const bolt = listActions(s, 'wizard').find((o) => o.def.id === 'lightning-bolt')!;
    expect(bolt.validTargets).not.toContain(sh.id);
    expect(listActions(s, 'wizard').find((o) => o.def.id === 'fireball')!.validTargets).not.toContain(sh.id);
    // Hits on every enemy still land.
    s = act(s, 'wizard', 'chain-lightning');
    expect(enemy(s, sh.id).hp).toBe(20);
    // Both goblins fell to the chain: the guard is down.
    expect(isGuarded(s, enemy(s, sh.id))).toBe(false);
    expect(listActions(s, 'warrior').find((o) => o.def.id === 'axe')!.validTargets).toContain(sh.id);
  });

  it('drops once fewer than 2 goblins remain', () => {
    const sh = monster({ kind: 'shaman', hp: 30, damage: 0, tier: 'good' });
    const g1 = monster({ hp: 4, damage: 0 });
    const g2 = monster({ hp: 40, damage: 0 });
    let s = battle([[sh, g1, g2]]);
    s = act(s, 'warrior', 'axe', [g1.id]);
    expect(isGuarded(s, enemy(s, sh.id))).toBe(false);
  });
});

describe('Goblin Chieftain', () => {
  it("Chieftain's Command gives every goblin +1, but not the Ogre", () => {
    const chief = monster({ kind: 'chieftain', hp: 80, damage: 14, isWarlord: true, extraActions: 1 });
    const g = monster({ hp: 8, damage: 3 });
    const hexer = monster({ kind: 'warlock', hp: 30, damage: 10 });
    const ogre = monster({ kind: 'ogre', hp: 50, damage: 12 });
    let s = battle([[chief, g, hexer, ogre]]);
    expect(commandBonus(s, enemy(s, g.id))).toBe(1);
    expect(commandBonus(s, enemy(s, hexer.id))).toBe(1);
    expect(commandBonus(s, enemy(s, ogre.id))).toBe(0);
    expect(commandBonus(s, enemy(s, chief.id))).toBe(0);
    expect(enemyDamage(s, enemy(s, hexer.id))).toBe(11);
    // Pack Tactics counts goblin minions only: the lone goblin gets none.
    expect(packBonus(s, enemy(s, g.id))).toBe(0);
    s = { ...s, enemies: s.enemies.map((e) => (e.id === chief.id ? { ...e, alive: false, hp: 0 } : e)) };
    expect(enemyDamage(s, enemy(s, hexer.id))).toBe(10);
  });

  it('Call the Pack brings two goblins that fight from next round', () => {
    const chief = monster({ kind: 'chieftain', hp: 999, damage: 0, isWarlord: true, extraActions: 1 });
    let s = endRound(endRound(battle([[chief]]))); // round 3 is its special round
    const before = livingEnemies(s).length;
    s = endRound(s);
    expect(livingEnemies(s).length).toBe(before + 2);
    expect(livingEnemies(s).filter((e) => e.kind === 'goblin').every((e) => e.arrivedRound === 3)).toBe(true);
  });
});

describe('fall prediction', () => {
  it('the preview shows who falls and how much each enemy deals them', () => {
    const a = monster({ kind: 'ogre', hp: 99, damage: 12 });
    const b = monster({ hp: 99, damage: 5 });
    let s = battle([[a, b]]);
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'warrior' ? { ...h, hp: 15, armor: 0 } : h)) };
    const { log, after } = previewRound(s);
    const toWarrior = log.filter((l) => l.hits?.warrior).map((l) => [l.actorId, l.hits!.warrior]);
    expect(toWarrior).toEqual([
      [a.id, 12],
      [b.id, 5],
    ]);
    expect(after.heroes.find((h) => h.id === 'warrior')!.alive).toBe(false);
    expect(s.pendingHits).toBeUndefined();
  });
});

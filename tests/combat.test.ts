import { describe, expect, it } from 'vitest';
import { endRound, listActions, performAction, previewEnemyPhase, type BattleState } from '../src/engine/combat';
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
    expect(() => act(s, 'wizard', 'staff', [g.id])).toThrow(/Already acted/);
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
    expect(enemy(s, h.id).hp).toBe(40 - 6);
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
    s = act(s, 'warrior', 'provoke', [h.id]);
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

  it('staggered champions skip their first action', () => {
    const o = monster({ kind: 'ogre', damage: 9, hp: 99, staggers: 1 });
    const s = endRound(battle([[o]]));
    expect(hero(s, 'warrior').hp).toBe(40);
    expect(s.log.some((l) => l.text.includes('staggered'))).toBe(true);
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
    s = endRound(s); // round 3: no curse, prone round
    expect(hero(s, 'warrior').hp).toBe(40 - 4 - 5);
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
  it('advances waves and wins when the last wave falls', () => {
    const a = monster({ hp: 4 });
    const b = monster({ hp: 4 });
    let s = battle([[a], [b]]);
    s = act(s, 'warrior', 'axe', [a.id]);
    expect(s.waveIndex).toBe(1);
    expect(s.enemies[0].id).toBe(b.id);
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

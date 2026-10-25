import { describe, expect, it } from 'vitest';
import { buy, priceOf, respec, respecRefund } from '../src/app/armory';
import { chapterOf, newGame, type SaveGame } from '../src/app/game';
import { migrateSave } from '../src/app/saves';
import { endRound, listActions, performAction, specialDue, type BattleState, type HeroSetup } from '../src/engine/combat';
import { buildHorde } from '../src/engine/horde';
import { computeRewards } from '../src/engine/rewards';
import { scaleHorde } from '../src/engine/week';
import { emptyProgress, rules, type HeroClass, type HeroProgress } from '../src/rules';
import { battle, boxLine, monster, party, season } from './helpers';

const act = (s: BattleState, heroId: HeroClass, actionId: string, targetIds: string[] = []) => performAction(s, { heroId, actionId, targetIds });
const hero = (s: BattleState, id: string) => s.heroes.find((h) => h.id === id)!;
const enemy = (s: BattleState, id: string) => s.enemies.find((e) => e.id === id)!;
const option = (s: BattleState, heroId: HeroClass, id: string) => listActions(s, heroId).find((o) => o.def.id === id);
/** A party where one hero has bought some upgrades. */
const withProgress = (c: HeroClass, p: Partial<HeroProgress>): HeroSetup[] =>
  party().map((h) => (h.heroClass === c ? { ...h, progress: { ...emptyProgress(), ...p } } : h));
const P = rules.progression;

describe('earning PP', () => {
  it('pays whole numbers per hero: waves, victory (less if fallen), Elite foes and big nights', () => {
    const elite = monster({ id: 'E', kind: 'ogre', hp: 1, damage: 0, tier: 'elite' });
    let s = battle([[elite]]);
    s = act(s, 'warrior', 'axe', ['E']);
    expect(s.phase).toBe('won');
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'wizard' ? { ...h, alive: false, hp: 0 } : h)) };
    const pools = { ranger: { tier: 'elite', doubleDouble: true, tripleDouble: false } } as never;
    const r = computeRewards(s, pools);
    const party = P.earn.perWaveCleared * s.stats.wavesCleared + P.earn.eliteDefeated;
    expect(r.perHero.warrior).toBe(party + P.earn.winStanding);
    expect(r.perHero.wizard).toBe(party + P.earn.winFallen);
    expect(r.perHero.ranger).toBe(party + P.earn.winStanding + P.earn.eliteNight + P.earn.doubleDouble);
    for (const v of Object.values(r.perHero)) expect(Number.isInteger(v)).toBe(true);
  });

  it('old saves round to whole PP and get an empty Armory', () => {
    const old = { ...newGame('2025-26', 0), version: 1, pp: { warrior: 4.6, wizard: 1.2, ranger: 0, rogue: 0, cleric: 0 }, progress: undefined };
    const g = migrateSave(old);
    expect(g.pp.warrior).toBe(5);
    expect(g.progress!.wizard).toEqual(emptyProgress());
  });
});

describe('the Armory', () => {
  const rich = (): SaveGame => ({ ...migrateSave(newGame('2025-26', 0)), pp: { warrior: 1000, wizard: 1000, ranger: 1000, rogue: 1000, cleric: 1000 } });

  it('respec is free: weapon levels, gear and feats all come back for a full refund', () => {
    let g = rich();
    g = buy(g, 'cleric', { kind: 'weapon' });
    g = buy(g, 'cleric', { kind: 'gear', id: 'amulet-of-healing' });
    g = buy(g, 'cleric', { kind: 'feat', id: 'smite' });
    const before = g.pp.cleric;
    const spent = P.weapon.costs[0] + P.gear['amulet-of-healing'].cost + P.feats.smite.cost;
    expect(respecRefund(g, 'cleric')).toBe(spent);
    g = respec(g, 'cleric');
    expect(g.pp.cleric).toBe(before + spent);
    expect(g.pp.cleric).toBe(1000);
    expect(g.progress!.cleric).toEqual(emptyProgress());
    // Other heroes are untouched, and the feat can be bought again (or another one).
    expect(g.pp.warrior).toBe(1000);
    expect(priceOf(g, 'cleric', { kind: 'feat', id: 'smite' })).toBe(P.feats.smite.cost);
    expect(respec(g, 'cleric')).toBe(g);
    // The Warrior's shield levels come back too.
    let w = buy(buy(rich(), 'warrior', { kind: 'shield' }), 'warrior', { kind: 'shield' });
    expect(respecRefund(w, 'warrior')).toBe(P.shield.costs[0] + P.shield.costs[1]);
    w = respec(w, 'warrior');
    expect(w.pp.warrior).toBe(1000);
    expect(w.progress!.warrior.shield).toBe(0);
  });

  it('weapon levels cost 100, 200, 300 and then max out', () => {
    let g = rich();
    for (const cost of P.weapon.costs) {
      expect(priceOf(g, 'ranger', { kind: 'weapon' })).toBe(cost);
      g = buy(g, 'ranger', { kind: 'weapon' });
    }
    expect(priceOf(g, 'ranger', { kind: 'weapon' })).toBeNull();
    expect(g.pp.ranger).toBe(1000 - 600);
  });

  it('gear and feats belong to their class, are bought once, and need the PP', () => {
    let g = rich();
    expect(priceOf(g, 'wizard', { kind: 'gear', id: 'plate-armor' })).toBeNull();
    g = buy(g, 'warrior', { kind: 'feat', id: 'cleave' });
    expect(priceOf(g, 'warrior', { kind: 'feat', id: 'cleave' })).toBeNull();
    const poor = { ...g, pp: { ...g.pp, cleric: 10 } };
    expect(() => buy(poor, 'cleric', { kind: 'gear', id: 'chain-mail' })).toThrow('Needs');
    expect(priceOf(g, 'wizard', { kind: 'shield' })).toBeNull();
  });

  it('chapters count every 4 weeks', () => {
    const g = { ...newGame('2025-26', 10), history: [{ weekIndex: 10 } as never] };
    expect(chapterOf({ ...g, weekIndex: 13 })).toBe(1);
    expect(chapterOf({ ...g, weekIndex: 14 })).toBe(2);
  });
});

describe('upgrades in battle', () => {
  const dummy = () => monster({ id: 'D', kind: 'ogre', hp: 999, damage: 0 });

  it('weapon levels add damage; the shield and armor gear add armor every round', () => {
    const s = battle([[dummy()]], withProgress('warrior', { weapon: 2, shield: 1, gear: ['plate-armor'] }));
    const base = battle([[dummy()]]);
    expect(hero(s, 'warrior').gear).toBe(hero(base, 'warrior').gear + 2);
    expect(hero(s, 'warrior').armor).toBe(hero(base, 'warrior').armor + 2);
  });

  it('starting-energy gear adds to the pool', () => {
    const s = battle([[dummy()]], withProgress('wizard', { gear: ['spellbook'] }));
    expect(hero(s, 'wizard').pool).toBe(hero(battle([[dummy()]]), 'wizard').pool + 3);
  });

  it('Amulet of Healing and Blessed Ward boost heals', () => {
    let s = battle([[dummy()]], withProgress('cleric', { gear: ['amulet-of-healing'], feats: ['blessed-ward'] }));
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'wizard' ? { ...h, hp: 5 } : h)) };
    const armor = hero(s, 'wizard').armor;
    s = act(s, 'cleric', 'cure-wounds', ['wizard']);
    expect(hero(s, 'wizard').hp).toBeGreaterThan(5 + 2);
    expect(hero(s, 'wizard').armor).toBe(armor + 2);
  });

  it('Quiver of Plenty and Arcane Surge cut costs', () => {
    const r = battle([[dummy()]], withProgress('ranger', { gear: ['quiver-of-plenty'] }));
    expect(option(r, 'ranger', 'double-strike')!.cost).toBe(5);
    let w = battle([[dummy()]], withProgress('wizard', { feats: ['arcane-surge'] }));
    expect(option(w, 'wizard', 'lightning-bolt')!.cost).toBe(6);
    const pool = hero(w, 'wizard').pool;
    w = act(w, 'wizard', 'lightning-bolt', ['D']);
    expect(hero(w, 'wizard').pool).toBe(pool - 6);
    expect(option(w, 'wizard', 'fireball')!.cost).toBe(10); // only the first spell each round
  });

  it('Shadow Cloak makes the first enemy hit on the Rogue miss', () => {
    const a = monster({ kind: 'assassin', id: 'A', hp: 999, damage: 9 });
    let s = battle([[a]], withProgress('rogue', { gear: ['shadow-cloak'] }));
    s = endRound({ ...s, heroes: s.heroes.map((h) => (h.id === 'rogue' ? { ...h, hp: 10 } : h)) });
    expect(hero(s, 'rogue').hp).toBe(10);
    expect(hero(s, 'rogue').cloakUsed).toBe(true);
  });

  it("Poisoner's Kit adds a round of poison", () => {
    const s = act(battle([[dummy()]], withProgress('rogue', { gear: ['poisoners-kit'] })), 'rogue', 'poisoned-blade', ['D']);
    const plain = act(battle([[dummy()]]), 'rogue', 'poisoned-blade', ['D']);
    expect(enemy(s, 'D').poison!.rounds).toBe(enemy(plain, 'D').poison!.rounds + 1);
  });

  it('Focus Crystal and Evocation add spell damage', () => {
    const hits = (p: Partial<HeroProgress>) => 999 - enemy(act(battle([[dummy()]], withProgress('wizard', p)), 'wizard', 'fireball', ['D']), 'D').hp;
    expect(hits({ gear: ['focus-crystal'] })).toBe(hits({}) + 1);
    expect(hits({ gear: ['focus-crystal'], feats: ['evocation'] })).toBe(hits({}) + 2);
  });

  it('Cleave hits a second enemy for half', () => {
    const a = monster({ id: 'A', hp: 99, damage: 0 });
    const b = monster({ id: 'B', hp: 99, damage: 0 });
    const s = act(battle([[a, b]], withProgress('warrior', { feats: ['cleave'] })), 'warrior', 'axe', ['A']);
    expect(99 - enemy(s, 'B').hp).toBe(Math.floor((99 - enemy(s, 'A').hp) / 2));
  });

  it('Intercept: the Warrior takes a hit meant for an ally below 25% HP', () => {
    const a = monster({ kind: 'assassin', id: 'A', hp: 999, damage: 5 });
    let s = battle([[a]], withProgress('warrior', { feats: ['intercept'] }));
    s = { ...s, heroes: s.heroes.map((h) => (h.id === 'rogue' ? { ...h, hp: 3 } : h)) };
    s = endRound(s);
    expect(hero(s, 'rogue').hp).toBe(3);
    expect(hero(s, 'warrior').hp).toBeLessThan(hero(s, 'warrior').maxHp);
  });

  it('Smite adds damage against the undead', () => {
    const hit = (p: Partial<HeroProgress>, enc?: string) =>
      999 - enemy(act(battle([[dummy()]], withProgress('cleric', p), enc), 'cleric', 'mace', ['D']), 'D').hp;
    expect(hit({ feats: ['smite'] }, 'crypt')).toBe(hit({}, 'crypt') + 3);
    expect(hit({ feats: ['smite'] })).toBe(hit({}));
  });

  it("Hunter's Mark appears only with the feat, and marked foes take +2 per hit", () => {
    expect(option(battle([[dummy()]]), 'ranger', 'hunters-mark')).toBeUndefined();
    let s = battle([[dummy()]], withProgress('ranger', { feats: ['hunters-mark'] }));
    s = act(s, 'ranger', 'hunters-mark', ['D']);
    const plain = 999 - enemy(act(battle([[dummy()]]), 'warrior', 'axe', ['D']), 'D').hp;
    s = act(s, 'warrior', 'axe', ['D']);
    expect(999 - enemy(s, 'D').hp).toBe(plain + 2);
  });

  it('Quick Draw: the Longbow gains 3 energy', () => {
    const s0 = battle([[dummy()]], withProgress('ranger', { feats: ['quick-draw'] }));
    const s = act(s0, 'ranger', 'longbow', ['D']);
    expect(hero(s, 'ranger').pool).toBe(hero(s0, 'ranger').pool + 3);
  });

  it('Opportunist adds damage against taunted foes', () => {
    const hit = (p: Partial<HeroProgress>) => {
      let s = battle([[dummy()]], withProgress('rogue', p));
      s = act(s, 'warrior', 'provoke', ['D']);
      const before = enemy(s, 'D').hp;
      return before - enemy(act(s, 'rogue', 'dagger', ['D']), 'D').hp;
    };
    expect(hit({ feats: ['opportunist'] })).toBe(hit({}) + 3);
  });

  it('the log credits feats and gear where they change a result', () => {
    const last = (st: BattleState) => st.log.at(-1)!.text;
    expect(last(act(battle([[dummy()]], withProgress('cleric', { feats: ['smite'] }), 'crypt'), 'cleric', 'mace', ['D']))).toContain('(+3 Smite)');
    expect(last(act(battle([[dummy()]], withProgress('ranger', { feats: ['quick-draw'] })), 'ranger', 'longbow', ['D']))).toContain('(+1 Quick Draw)');
    let s = battle([[dummy()]], withProgress('cleric', { gear: ['amulet-of-healing'], feats: ['blessed-ward'] }));
    s = act({ ...s, heroes: s.heroes.map((h) => (h.id === 'wizard' ? { ...h, hp: 5 } : h)) }, 'cleric', 'cure-wounds', ['wizard']);
    expect(last(s)).toMatch(/\(\+\d+ Amulet of Healing\).*\(Blessed Ward\)/);
    // No credit without the feat.
    expect(last(act(battle([[dummy()]], undefined, 'crypt'), 'cleric', 'mace', ['D']))).not.toContain('Smite');
  });

  it('Vanish works once per battle', () => {
    let s = battle([[dummy()]], withProgress('rogue', { feats: ['vanish'] }));
    s = act(s, 'rogue', 'vanish');
    expect(hero(s, 'rogue').untargetableRounds).toBe(1);
    expect(option(s, 'rogue', 'vanish')!.reason).toContain('Already used');
  });
});

describe('chapter scaling', () => {
  it('Champions and bosses grow each chapter; minions do not', () => {
    const aaa = [1, 2, 3, 4, 5].map((id) => boxLine(id, 'AAA', { pts: 10, fgm: 4, fga: 9 }));
    const bbb = [101, 102, 103, 104, 105, 106].map((id, i) => boxLine(id, 'BBB', { pts: 30 - i * 4, dreb: 3 + i, ast: 2 + i, stl: i, fgm: 8, fga: 16 }));
    const data = season([{ id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [...aaa, ...bbb] }]);
    const h = buildHorde([{ heroClass: 'warrior', playerId: 3, gameId: 'g1' }], data);
    const h3 = scaleHorde(h, 3);
    const ogre = (x: typeof h) => x.waves.flat().find((m) => m.kind === 'ogre')!;
    const f = 1 + 2 * rules.progression.chapterScaling;
    expect(ogre(h3).hp).toBe(Math.round(ogre(h).hp * f));
    expect(h3.warlord.damage).toBe(Math.round(h.warlord.damage * f));
    const gob = (x: typeof h) => x.waves.flat().find((m) => m.kind === 'goblin')!;
    expect(gob(h3).hp).toBe(gob(h).hp);
    void specialDue;
  });
});

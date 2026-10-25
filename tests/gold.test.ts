import { describe, expect, it } from 'vitest';
import { autoAssign } from '../src/app/autoAssign';
import { autoDraft } from '../src/app/autoDraft';
import { finishBattle, newGame, nextWeek, type SaveGame } from '../src/app/game';
import { capOf, raiseCap, releaseTenDay, signTenDay, tenDayBlocked, tenDayCandidates, tenDayFee, weekRoster } from '../src/app/gold';
import { migrateSave } from '../src/app/saves';
import { buildSeason } from '../src/data/build';
import { goldFor } from '../src/engine/rewards';
import { computeSalary } from '../src/engine/rating';
import { CLASSES, rules } from '../src/rules';
import { makeSyntheticSeason } from './fixtures/synthetic';
import { battle, monster } from './helpers';

const data = buildSeason(makeSyntheticSeason({ teams: 12, weeks: 4, seed: 3 }));
const G = rules.salary.gold;

/** A drafted run in the assign phase of week 1, with some gold. */
function run(gold = 100): SaveGame {
  const week = data.weeks[0];
  const d = autoDraft(data, week)!;
  const g = newGame(data.season, week.index);
  return { ...g, gold, roster: [...CLASSES.map((c) => d.slots[c]), ...d.reserves], assignments: d.slots, phase: 'assign' };
}

describe('gold: earning', () => {
  it('every battle pays: more for a win, a little per wave', () => {
    const won = { ...battle([[monster()]]), phase: 'won' as const, stats: { wavesCleared: 3, warlordDefeated: true, anyHeroFell: false, signaturesUsed: 0 } };
    const lost = { ...won, phase: 'lost' as const, stats: { ...won.stats, wavesCleared: 1 } };
    expect(goldFor(won).total).toBe(G.earn.win + 3 * G.earn.perWaveCleared);
    expect(goldFor(lost).total).toBe(G.earn.loss + G.earn.perWaveCleared);
  });

  it('finishing a battle adds it to the treasury', () => {
    const g = { ...run(7), phase: 'battle' as const, battle: { ...battle([[monster()]]), phase: 'won' as const }, battlePools: {} };
    expect(finishBattle(g).gold).toBe(7 + G.earn.win);
  });
});

describe('gold: ten-day contracts', () => {
  it('signs a free agent with a game this week for a fraction of their salary', () => {
    const g = run();
    const id = tenDayCandidates(g, data)[0];
    const fee = tenDayFee(data, id);
    expect(fee).toBe(Math.max(G.tenDay.minFee, Math.round(computeSalary(data.players[id].avg).salary * G.tenDay.feeFraction)));
    const s = signTenDay(g, data, id);
    expect(s.gold).toBe(100 - fee);
    expect(weekRoster(s)).toContain(id);
    expect(s.roster).not.toContain(id);
    expect(tenDayCandidates(s, data)).not.toContain(id);
  });

  it('candidates exclude rostered players and players without a game this week', () => {
    const g = run();
    for (const id of tenDayCandidates(g, data)) expect(g.roster).not.toContain(id);
  });

  it('is limited per week, needs the fee, and only before the battle', () => {
    let g = run();
    const ids = tenDayCandidates(g, data);
    for (let i = 0; i < G.tenDay.perWeek; i++) g = signTenDay(g, data, ids[i]);
    expect(tenDayBlocked(g)).not.toBeNull();
    expect(() => signTenDay(g, data, ids[G.tenDay.perWeek])).toThrow();
    expect(() => signTenDay(run(0), data, ids[0])).toThrow(/gold/);
    expect(tenDayBlocked({ ...run(), phase: 'battle' })).not.toBeNull();
  });

  it('releasing before the battle refunds the fee and frees the hero', () => {
    const g = run();
    const id = tenDayCandidates(g, data)[0];
    let s = signTenDay(g, data, id);
    s = { ...s, assignments: { ...s.assignments, wizard: id }, gamePicks: { wizard: 'x' } };
    s = releaseTenDay(s, id);
    expect(s.gold).toBe(100);
    expect(s.assignments.wizard).toBeUndefined();
    expect(s.gamePicks.wizard).toBeUndefined();
    expect(s.tenDay).toEqual([]);
  });

  it('auto-assign can use a ten-day player, and the contract ends with the week', () => {
    let g = run();
    // Take the Wizard's player away and rent the best Wizard on the market instead.
    const id = tenDayCandidates(g, data)[0];
    g = signTenDay({ ...g, roster: g.roster.filter((x) => x !== g.assignments.wizard) }, data, id);
    expect(Object.values(autoAssign(g, data))).toContain(id);
    g = { ...g, assignments: { ...g.assignments, wizard: id }, phase: 'result' };
    const next = nextWeek(g, data)!;
    expect(next.tenDay).toEqual([]);
    expect(Object.values(next.assignments)).not.toContain(id);
  });
});

describe('gold: cap room', () => {
  it('buys permanent cap room in steps', () => {
    const g = raiseCap(run(20));
    expect(g.gold).toBe(20 - G.capRaise.cost);
    expect(capOf(g)).toBe(rules.salary.cap + G.capRaise.step);
    expect(() => raiseCap(run(G.capRaise.cost - 1))).toThrow();
  });
});

describe('gold: saves', () => {
  it('a version 2 save gets the starting purse', () => {
    const { gold: _g, capBonus: _c, tenDay: _t, ...v2 } = { ...newGame('2025-26', 1), version: 2 };
    const g = migrateSave(v2);
    expect(g.gold).toBe(G.starting);
    expect(g.capBonus).toBe(0);
    expect(g.tenDay).toEqual([]);
  });
});

describe('weekly flow', () => {
  it('each new week starts by choosing the encounter, and the result records which one was fought', () => {
    let g: SaveGame = { ...run(), encounter: 'crypt', phase: 'battle' as const, battle: { ...battle([[monster()]]), phase: 'won' as const }, battlePools: {} };
    g = finishBattle(g);
    expect(g.history.at(-1)!.encounter).toBe('crypt');
    const next = nextWeek(g, data)!;
    expect(next.phase).toBe('encounter');
    expect(next.encounter).toBe('crypt');
  });
});

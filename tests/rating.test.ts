import { describe, expect, it } from 'vitest';
import { computePool, computeSalary, gearDamage, tierFor } from '../src/engine/rating';
import { rules } from '../src/rules';
import { stats } from './helpers';

describe('pool calculation', () => {
  it('maps Rating to tier to pool', () => {
    expect(computePool('wizard', stats({ fg3m: 0 })).pool).toBe(12);
    expect(computePool('wizard', stats({ fg3m: 2 })).tier).toBe('average');
    expect(computePool('ranger', stats({ pts: 35 })).tier).toBe('elite');
    expect(computePool('warrior', stats({ dreb: 5, oreb: 2, blk: 1 })).rating).toBe(5 + 4 + 3);
    expect(computePool('rogue', stats({ stl: 3, ftm: 3 })).rating).toBe(12);
  });

  it('applies the 3P% modifier only with 5+ attempts', () => {
    expect(computePool('wizard', stats({ fg3m: 4, fg3a: 8 })).pool).toBe(36 + 4);
    expect(computePool('wizard', stats({ fg3m: 1, fg3a: 4 })).pool).toBe(12);
    expect(computePool('wizard', stats({ fg3m: 2, fg3a: 8 })).pool).toBe(20 - 4);
  });

  it('applies the FG% modifier only with 10+ attempts', () => {
    expect(computePool('ranger', stats({ pts: 20, fgm: 6, fga: 10 })).pool).toBe(28 + 4);
    expect(computePool('ranger', stats({ pts: 20, fgm: 3, fga: 9 })).pool).toBe(28);
    expect(computePool('ranger', stats({ pts: 20, fgm: 3, fga: 10 })).pool).toBe(28 - 4);
  });

  it('gives two free turnovers, and the Cleric pays for every one', () => {
    expect(computePool('wizard', stats({ fg3m: 2, tov: 2 })).pool).toBe(20);
    expect(computePool('wizard', stats({ fg3m: 2, tov: 4 })).pool).toBe(16);
    // Cleric, 3 TO: −2 × 3 (class) and −2 × 1 (universal).
    expect(computePool('cleric', stats({ ast: 4, tov: 3 })).pool).toBe(20 - 6 - 2);
  });

  it('rewards double- and triple-doubles', () => {
    const dd = computePool('cleric', stats({ ast: 10, pts: 12 }));
    expect(dd.doubleDouble).toBe(true);
    expect(dd.tripleDouble).toBe(false);
    expect(dd.pool).toBe(36 + 6);
    const td = computePool('cleric', stats({ ast: 12, pts: 20, reb: 10 }));
    expect(td.tripleDouble).toBe(true);
    expect(td.pool).toBe(45 + 12);
  });

  it('never goes below zero', () => {
    expect(computePool('cleric', stats({ ast: 0, tov: 9 })).pool).toBe(0);
  });
});

describe('salary and gear', () => {
  it('uses thresholds as minimums', () => {
    const t = rules.tiers.thresholds.ranger;
    expect(tierFor(t.good - 0.01, t)).toBe('average');
    expect(tierFor(t.good, t)).toBe('good');
  });

  it('prices by best season tier plus a versatility premium', () => {
    // Elite scorer only.
    expect(computeSalary(stats({ pts: 36 })).salary).toBe(40);
    // Elite scorer who is also a Great playmaker: +$5M.
    const s = computeSalary(stats({ pts: 36, ast: 9 }));
    expect(s.versatileClasses).toEqual(['ranger', 'cleric']);
    expect(s.salary).toBe(45);
    expect(computeSalary(stats()).salary).toBe(4);
  });

  it('derives gear damage from the season tier', () => {
    expect(gearDamage('wizard', stats({ fg3m: 3.4 }))).toBe(5);
    expect(gearDamage('wizard', stats({ fg3m: 0.5 }))).toBe(3);
  });
});

import { describe, expect, it } from 'vitest';
import { autoDraft } from '../src/app/autoDraft';
import { buildSeason } from '../src/data/build';
import { computeSalary } from '../src/engine/rating';
import { playerGamesInWeek } from '../src/engine/week';
import { CLASSES, rules } from '../src/rules';
import { makeSyntheticSeason } from './fixtures/synthetic';

const data = buildSeason(makeSyntheticSeason({ teams: 12, weeks: 4, seed: 3 }));

describe('auto-draft', () => {
  it('fills every slot under the cap with players who play that week', () => {
    const week = data.weeks[0];
    const d = autoDraft(data, week)!;
    const ids = [...CLASSES.map((c) => d.slots[c]), ...d.reserves];
    expect(new Set(ids).size).toBe(8);
    const cost = ids.reduce((s, id) => s + computeSalary(data.players[id].avg).salary, 0);
    expect(cost).toBe(d.cost);
    expect(cost).toBeLessThanOrEqual(rules.salary.cap);
    for (const id of ids) expect(playerGamesInWeek(data, week, id).length).toBeGreaterThan(0);
  });

  it('spends on starters, not reserves', () => {
    const d = autoDraft(data, data.weeks[0])!;
    const sal = (id: number) => computeSalary(data.players[id].avg).salary;
    const minStarter = Math.min(...CLASSES.map((c) => sal(d.slots[c])));
    for (const r of d.reserves) expect(sal(r)).toBeLessThanOrEqual(minStarter);
  });
});

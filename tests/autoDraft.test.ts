import { describe, expect, it } from 'vitest';
import { DRAFT_MODES, autoDraft, type DraftMode } from '../src/app/autoDraft';
import { buildSeason } from '../src/data/build';
import { computeSalary, seasonTier } from '../src/engine/rating';
import { playerGamesInWeek } from '../src/engine/week';
import { CLASSES, rules, tierIndex, type HeroClass } from '../src/rules';
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

  const week = data.weeks[0];
  const drafts = Object.fromEntries(DRAFT_MODES.map((m) => [m.id, autoDraft(data, week, m.id)!])) as Record<DraftMode, NonNullable<ReturnType<typeof autoDraft>>>;
  const tier = (d: (typeof drafts)[DraftMode], c: HeroClass) => tierIndex(seasonTier(c, data.players[d.slots[c]].avg));
  const tierSum = (d: (typeof drafts)[DraftMode], cs: HeroClass[]) => cs.reduce((t, c) => t + tier(d, c), 0);
  const roles = (id: number) => CLASSES.filter((c) => tierIndex(seasonTier(c, data.players[id].avg)) >= tierIndex('good')).length;

  it('every mode builds a legal roster', () => {
    for (const d of Object.values(drafts)) {
      const ids = [...CLASSES.map((c) => d.slots[c]), ...d.reserves];
      expect(new Set(ids).size).toBe(8);
      expect(d.cost).toBeLessThanOrEqual(rules.salary.cap);
    }
  });

  it('offense and defense spend on their classes', () => {
    const off: HeroClass[] = ['wizard', 'ranger', 'rogue'];
    const def: HeroClass[] = ['warrior', 'cleric'];
    expect(tierSum(drafts.offense, off)).toBeGreaterThanOrEqual(tierSum(drafts.defense, off));
    expect(tierSum(drafts.defense, def)).toBeGreaterThanOrEqual(tierSum(drafts.offense, def));
  });

  it('balance keeps the lineup even', () => {
    const spread = (d: (typeof drafts)[DraftMode]) => Math.max(...CLASSES.map((c) => tier(d, c))) - Math.min(...CLASSES.map((c) => tier(d, c)));
    expect(spread(drafts.balance)).toBeLessThanOrEqual(Math.min(spread(drafts.offense), spread(drafts.defense)));
  });

  it('flexibility picks starters who fit more heroes', () => {
    const avgRoles = (d: (typeof drafts)[DraftMode]) => CLASSES.reduce((t, c) => t + roles(d.slots[c]), 0);
    for (const m of ['offense', 'defense', 'balance'] as const) expect(avgRoles(drafts.flexibility)).toBeGreaterThanOrEqual(avgRoles(drafts[m]));
  });
});

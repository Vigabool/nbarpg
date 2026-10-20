import type { SeasonData, Week } from '../data/types';
import { eligiblePlayers } from '../engine/calibration';
import { computeRating, computeSalary, seasonTier } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules as defaultRules, tierIndex, type HeroClass, type Rules } from '../rules';

export interface Draft {
  slots: Record<HeroClass, number>;
  reserves: number[];
  cost: number;
}

/** Points per class-fit tier. Concave, so five Great starters beat three Elites and an Average. */
const FIT_POINTS = [0, 1, 3, 5, 6];

/**
 * A quick roster for testing: the cheapest reserves who play this week, then
 * the strongest affordable starter for each class. Starters are scored by
 * season tier in their class first, then by salary, so the cap goes to them.
 */
export function autoDraft(data: SeasonData, week: Week | undefined, rules: Rules = defaultRules, candidatesPerClass = 12): Draft | null {
  const plays = (id: number) => !week || playerGamesInWeek(data, week, id).length > 0;
  const pool = eligiblePlayers(data, rules)
    .filter((p) => plays(p.id))
    .map((p) => ({ p, salary: computeSalary(p.avg, rules).salary }));
  const reserveCount = rules.salary.rosterSize - rules.salary.heroSlots;

  const reserves = [...pool]
    .sort((a, b) => a.salary - b.salary || b.p.avg.min - a.p.avg.min)
    .slice(0, reserveCount);
  const reserveIds = new Set(reserves.map((r) => r.p.id));
  const budget = rules.salary.cap - reserves.reduce((s, r) => s + r.salary, 0);

  // Per class: the top players by season rating, plus the best few at each
  // salary level so a cheaper fit is always available if the stars don't fit.
  const candidates = CLASSES.map((c) => {
    const ranked = pool
      .filter((x) => !reserveIds.has(x.p.id))
      .map((x) => ({ ...x, fit: FIT_POINTS[tierIndex(seasonTier(c, x.p.avg, rules))], rating: computeRating(rules.classes[c].rating, x.p.avg) }))
      .sort((a, b) => b.rating - a.rating);
    const chosen = new Set(ranked.slice(0, candidatesPerClass));
    const perSalary = new Map<number, number>();
    for (const x of ranked) {
      const n = perSalary.get(x.salary) ?? 0;
      if (n < 3) {
        chosen.add(x);
        perSalary.set(x.salary, n + 1);
      }
    }
    return [...chosen];
  });

  let best: { score: number; ids: number[]; cost: number } | null = null;
  const pick: number[] = [];
  const search = (ci: number, cost: number, fit: number) => {
    if (cost > budget) return;
    if (ci === CLASSES.length) {
      const score = fit * 1000 + cost;
      if (!best || score > best.score) best = { score, ids: [...pick], cost };
      return;
    }
    for (const x of candidates[ci]) {
      if (pick.includes(x.p.id)) continue;
      pick.push(x.p.id);
      search(ci + 1, cost + x.salary, fit + x.fit);
      pick.pop();
    }
  };
  search(0, 0, 0);
  if (!best) return null;
  const found = best as { score: number; ids: number[]; cost: number };
  const slots = Object.fromEntries(CLASSES.map((c, i) => [c, found.ids[i]])) as Record<HeroClass, number>;
  return { slots, reserves: reserves.map((r) => r.p.id), cost: found.cost + (rules.salary.cap - budget) };
}

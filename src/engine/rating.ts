import type { StatLine } from '../data/types';
import { CLASSES, TIERS, rules as defaultRules, tierIndex, type HeroClass, type RatingFormula, type Rules, type Thresholds, type Tier } from '../rules';

export function computeRating(formula: RatingFormula, line: StatLine): number {
  let r = 0;
  for (const [k, w] of Object.entries(formula)) r += (line[k as keyof StatLine] ?? 0) * (w ?? 0);
  return r;
}

export function tierFor(rating: number, t: Thresholds): Tier {
  if (rating >= t.elite) return 'elite';
  if (rating >= t.great) return 'great';
  if (rating >= t.good) return 'good';
  if (rating >= t.average) return 'average';
  return 'cold';
}

export function shiftTier(t: Tier, by: number): Tier {
  return TIERS[Math.max(0, Math.min(TIERS.length - 1, tierIndex(t) + by))];
}

export function countDoubles(line: StatLine, rules: Rules = defaultRules): number {
  return rules.pool.doubleDoubleStats.filter((k) => line[k] >= 10).length;
}

export interface PoolBreakdown {
  heroClass: HeroClass;
  rating: number;
  tier: Tier;
  basePool: number;
  modifiers: { label: string; amount: number }[];
  pool: number;
  doubleDouble: boolean;
  tripleDouble: boolean;
}

/** A hero's resource pool for one battle, from the bound player's line in the chosen game. */
export function computePool(heroClass: HeroClass, line: StatLine, rules: Rules = defaultRules): PoolBreakdown {
  const cls = rules.classes[heroClass];
  const rating = computeRating(cls.rating, line);
  const tier = tierFor(rating, rules.tiers.thresholds[heroClass]);
  const basePool = rules.tiers.pool[tier];
  const modifiers: { label: string; amount: number }[] = [];

  for (const m of cls.modifiers) {
    if (m.type === 'percentage') {
      const att = line[m.attempts];
      if (att < m.minAttempts) continue;
      const pct = line[m.made] / att;
      if (pct >= m.bonusAtOrAbove) modifiers.push({ label: `${m.label} ${(pct * 100).toFixed(0)}%`, amount: m.bonus });
      else if (pct < m.penaltyBelow) modifiers.push({ label: `${m.label} ${(pct * 100).toFixed(0)}%`, amount: m.penalty });
    } else if (m.type === 'perTurnover' && line.tov > 0) {
      modifiers.push({ label: `${m.label} (${line.tov})`, amount: m.amount * line.tov });
    }
  }

  const extraTov = Math.max(0, line.tov - rules.pool.freeTurnovers);
  if (extraTov > 0) modifiers.push({ label: `Turnovers above ${rules.pool.freeTurnovers}`, amount: extraTov * rules.pool.penaltyPerExtraTurnover });

  const doubles = countDoubles(line, rules);
  const tripleDouble = doubles >= 3;
  const doubleDouble = doubles >= 2;
  if (tripleDouble) modifiers.push({ label: 'Triple-double', amount: rules.pool.tripleDouble.pool });
  else if (doubleDouble) modifiers.push({ label: 'Double-double', amount: rules.pool.doubleDouble.pool });

  const pool = Math.max(rules.pool.minimumPool, basePool + modifiers.reduce((s, m) => s + m.amount, 0));
  return { heroClass, rating, tier, basePool, modifiers, pool, doubleDouble, tripleDouble };
}

/** Season-average tier in a class; sets gear damage and salary. */
export function seasonTier(heroClass: HeroClass, avg: StatLine, rules: Rules = defaultRules): Tier {
  return tierFor(computeRating(rules.classes[heroClass].rating, avg), rules.tiers.thresholds[heroClass]);
}

export function gearDamage(heroClass: HeroClass, avg: StatLine, rules: Rules = defaultRules): number {
  return rules.tiers.gearDamage[seasonTier(heroClass, avg, rules)];
}

export interface SalaryBreakdown {
  salary: number;
  classTiers: Record<HeroClass, Tier>;
  bestTier: Tier;
  bestClasses: HeroClass[];
  versatileClasses: HeroClass[];
}

export function computeSalary(avg: StatLine, rules: Rules = defaultRules): SalaryBreakdown {
  const classTiers = Object.fromEntries(CLASSES.map((c) => [c, seasonTier(c, avg, rules)])) as Record<HeroClass, Tier>;
  const best = Math.max(...CLASSES.map((c) => tierIndex(classTiers[c])));
  const bestTier = TIERS[best];
  const bestClasses = CLASSES.filter((c) => tierIndex(classTiers[c]) === best);
  const minIdx = tierIndex(rules.salary.versatility.minTier);
  const versatileClasses = CLASSES.filter((c) => tierIndex(classTiers[c]) >= minIdx);
  const extra = Math.max(0, versatileClasses.length - 1);
  const salary = rules.salary.byTier[bestTier] + extra * rules.salary.versatility.premiumPerExtraClass;
  return { salary, classTiers, bestTier, bestClasses, versatileClasses };
}

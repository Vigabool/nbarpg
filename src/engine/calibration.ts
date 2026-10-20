import type { SeasonData } from '../data/types';
import { CLASSES, TIERS, rules as defaultRules, type HeroClass, type Rules, type Thresholds, type Tier } from '../rules';
import { computeRating, computeSalary, tierFor } from './rating';

export interface ClassCalibration {
  heroClass: HeroClass;
  sampleSize: number;
  percentiles: Record<Exclude<Tier, 'cold'>, number>;
  suggested: Thresholds;
  current: Thresholds;
  /** Share of sample nights landing in each tier, under current and suggested thresholds. */
  currentShare: Record<Tier, number>;
  suggestedShare: Record<Tier, number>;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function share(values: number[], t: Thresholds): Record<Tier, number> {
  const out = Object.fromEntries(TIERS.map((x) => [x, 0])) as Record<Tier, number>;
  for (const v of values) out[tierFor(v, t)]++;
  for (const x of TIERS) out[x] = values.length ? out[x] / values.length : 0;
  return out;
}

/**
 * Tier thresholds from league percentiles: a night at or above the 20th
 * percentile of the class's comparison pool is Average, 50th Good, 75th Great,
 * 92nd Elite (percentiles set in rules/calibration.json).
 */
export function calibrate(data: SeasonData, rules: Rules = defaultRules): ClassCalibration[] {
  const cal = rules.calibration;
  return CLASSES.map((heroClass) => {
    const pool = cal.comparisonPools[heroClass];
    const eligible = new Set(
      Object.values(data.players)
        .filter((p) => Object.entries(pool.seasonMin).every(([k, min]) => p.avg[k as keyof typeof p.avg] >= (min ?? 0)))
        .map((p) => p.id),
    );
    const values: number[] = [];
    for (const g of Object.values(data.games))
      for (const l of g.lines)
        if (l.min >= cal.minMinutes && eligible.has(l.playerId)) values.push(computeRating(rules.classes[heroClass].rating, l));
    values.sort((a, b) => a - b);

    const percentiles = {
      average: percentile(values, cal.percentiles.average),
      good: percentile(values, cal.percentiles.good),
      great: percentile(values, cal.percentiles.great),
      elite: percentile(values, cal.percentiles.elite),
    };
    // Ratings are whole numbers; keep each tier at least one point above the last.
    const suggested = { average: Math.max(1, Math.round(percentiles.average)) } as Thresholds;
    suggested.good = Math.max(suggested.average + 1, Math.round(percentiles.good));
    suggested.great = Math.max(suggested.good + 1, Math.round(percentiles.great));
    suggested.elite = Math.max(suggested.great + 1, Math.round(percentiles.elite));

    const current = rules.tiers.thresholds[heroClass];
    return {
      heroClass,
      sampleSize: values.length,
      percentiles,
      suggested,
      current,
      currentShare: share(values, current),
      suggestedShare: share(values, suggested),
    };
  });
}

export interface SalarySummary {
  eligiblePlayers: number;
  byTier: Record<Tier, number>;
  versatile: number;
  top8Cost: number;
}

export function eligiblePlayers(data: SeasonData, rules: Rules = defaultRules) {
  const e = rules.salary.eligibility;
  return Object.values(data.players).filter((p) => p.gp >= e.minGames && p.avg.min >= e.minMinutesPerGame);
}

export function summarizeSalaries(data: SeasonData, rules: Rules = defaultRules): SalarySummary {
  const players = eligiblePlayers(data, rules);
  const byTier = Object.fromEntries(TIERS.map((t) => [t, 0])) as Record<Tier, number>;
  let versatile = 0;
  const salaries: number[] = [];
  for (const p of players) {
    const s = computeSalary(p.avg, rules);
    byTier[s.bestTier]++;
    if (s.versatileClasses.length > 1) versatile++;
    salaries.push(s.salary);
  }
  salaries.sort((a, b) => b - a);
  return { eligiblePlayers: players.length, byTier, versatile, top8Cost: salaries.slice(0, 8).reduce((a, b) => a + b, 0) };
}

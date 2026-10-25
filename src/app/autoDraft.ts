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

export type DraftMode = 'offense' | 'defense' | 'balance' | 'flexibility';

export const DRAFT_MODES: { id: DraftMode; icon: string; label: string; blurb: string }[] = [
  { id: 'offense', icon: '⚔️', label: 'Offense', blurb: 'Spend on the Wizard, Ranger and Rogue' },
  { id: 'defense', icon: '🛡️', label: 'Defense', blurb: 'Spend on the Warrior and Cleric' },
  { id: 'balance', icon: '⚖️', label: 'Balance', blurb: 'Solid at every slot, a star at none' },
  { id: 'flexibility', icon: '🔀', label: 'Flexibility', blurb: 'Players who can fill several heroes' },
];

/** Points per class-fit tier. Concave, so five Great starters beat three Elites and an Average. */
const FIT_POINTS = [0, 1, 3, 5, 6];
/** Balance: Great is the sweet spot; an Elite fit is worth a little less, so the cap spreads out. */
const BALANCE_POINTS = [0, 1, 3, 5, 4];
const OFFENSE: HeroClass[] = ['wizard', 'ranger', 'rogue'];
const DEFENSE: HeroClass[] = ['warrior', 'cleric'];

interface Candidate {
  id: number;
  salary: number;
  tier: number;
  /** How many classes this player is a Good-or-better fit for. */
  roles: number;
  rating: number;
}

/** A starter's value in a class slot under a mode. */
function slotScore(mode: DraftMode, c: HeroClass, x: Candidate): number {
  switch (mode) {
    case 'offense':
      return FIT_POINTS[x.tier] * (OFFENSE.includes(c) ? 3 : 1);
    case 'defense':
      return FIT_POINTS[x.tier] * (DEFENSE.includes(c) ? 3 : 1);
    case 'balance':
      return BALANCE_POINTS[x.tier];
    case 'flexibility':
      return FIT_POINTS[x.tier] + 2 * (x.roles - 1);
  }
}

/** Balance also penalizes a lopsided lineup: the gap between the best and worst fit. */
function lineupScore(mode: DraftMode, picks: Candidate[], slotTotal: number): number {
  if (mode !== 'balance') return slotTotal;
  const tiers = picks.map((p) => p.tier);
  return slotTotal - 3 * (Math.max(...tiers) - Math.min(...tiers));
}

/**
 * A quick roster for testing: the cheapest reserves who play this week, then
 * the best affordable starters for the chosen mode. Lineups are scored first,
 * then by salary, so the cap goes to the starters.
 */
export function autoDraft(
  data: SeasonData,
  week: Week | undefined,
  mode: DraftMode = 'balance',
  rules: Rules = defaultRules,
  candidatesPerClass = 12,
  /** The cap to draft under, including any cap room bought with gold. */
  cap = rules.salary.cap,
): Draft | null {
  const plays = (id: number) => !week || playerGamesInWeek(data, week, id).length > 0;
  const good = tierIndex('good');
  const pool = eligiblePlayers(data, rules)
    .filter((p) => plays(p.id))
    .map((p) => ({
      p,
      salary: computeSalary(p.avg, rules).salary,
      roles: CLASSES.filter((c) => tierIndex(seasonTier(c, p.avg, rules)) >= good).length,
    }));
  const reserveCount = rules.salary.rosterSize - rules.salary.heroSlots;

  // Reserves: the cheapest players who play this week. Flexibility prefers cheap players who fit more slots.
  const reserves = [...pool]
    .sort((a, b) => a.salary - b.salary || (mode === 'flexibility' ? b.roles - a.roles : 0) || b.p.avg.min - a.p.avg.min)
    .slice(0, reserveCount);
  const reserveIds = new Set(reserves.map((r) => r.p.id));
  const budget = cap - reserves.reduce((s, r) => s + r.salary, 0);

  // Per class: the top players for this mode, plus the best few at each salary
  // level so a cheaper fit is always available if the stars don't fit.
  const candidates = CLASSES.map((c) => {
    const ranked = pool
      .filter((x) => !reserveIds.has(x.p.id))
      .map((x): Candidate => ({
        id: x.p.id,
        salary: x.salary,
        tier: tierIndex(seasonTier(c, x.p.avg, rules)),
        roles: x.roles,
        rating: computeRating(rules.classes[c].rating, x.p.avg),
      }))
      .sort((a, b) => slotScore(mode, c, b) - slotScore(mode, c, a) || b.rating - a.rating);
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

  // Branch and bound: the best slot score still available from each class onward.
  const maxFrom = CLASSES.map((_, i) => CLASSES.slice(i).reduce((t, c, j) => t + Math.max(0, ...candidates[i + j].map((x) => slotScore(mode, c, x))), 0));
  maxFrom.push(0);
  let best: { score: number; ids: number[]; cost: number } | null = null;
  const pick: Candidate[] = [];
  const search = (ci: number, cost: number, total: number) => {
    if (cost > budget) return;
    if (best && (total + maxFrom[ci]) * 1000 + budget < (best as { score: number }).score) return;
    if (ci === CLASSES.length) {
      const score = lineupScore(mode, pick, total) * 1000 + cost;
      if (!best || score > best.score) best = { score, ids: pick.map((x) => x.id), cost };
      return;
    }
    for (const x of candidates[ci]) {
      if (pick.some((y) => y.id === x.id)) continue;
      pick.push(x);
      search(ci + 1, cost + x.salary, total + slotScore(mode, CLASSES[ci], x));
      pick.pop();
    }
  };
  search(0, 0, 0);
  if (!best) return null;
  const found = best as { score: number; ids: number[]; cost: number };
  const slots = Object.fromEntries(CLASSES.map((c, i) => [c, found.ids[i]])) as Record<HeroClass, number>;
  return { slots, reserves: reserves.map((r) => r.p.id), cost: found.cost + (cap - budget) };
}

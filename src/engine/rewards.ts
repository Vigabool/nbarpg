import { CLASSES, rules as defaultRules, type HeroClass, type Rules } from '../rules';
import type { BattleState } from './combat';
import type { PoolBreakdown } from './rating';

export interface RewardLine {
  label: string;
  pp: number;
  heroClass?: HeroClass;
}

export interface Rewards {
  partyLines: RewardLine[];
  spotlightLines: RewardLine[];
  partyTotal: number;
  /** PP per hero: an even share of party PP plus that hero's spotlight PP. */
  perHero: Record<HeroClass, number>;
}

export function computeRewards(
  battle: BattleState,
  pools: Partial<Record<HeroClass, PoolBreakdown>>,
  rules: Rules = defaultRules,
): Rewards {
  const p = rules.progression;
  const partyLines: RewardLine[] = [];
  const waves = Math.min(battle.stats.wavesCleared, 3);
  if (waves) partyLines.push({ label: `Waves cleared (${waves})`, pp: waves * p.perWaveCleared });
  if (battle.stats.warlordDefeated) partyLines.push({ label: 'Warlord defeated', pp: p.warlordDefeated });
  const standing = battle.heroes.filter((h) => h.alive).length;
  if (standing) partyLines.push({ label: `Heroes standing (${standing})`, pp: standing * p.perHeroStanding });
  if (battle.phase === 'won' && !battle.stats.anyHeroFell) partyLines.push({ label: 'Flawless battle', pp: p.flawless });

  const spotlightLines: RewardLine[] = [];
  for (const c of CLASSES) {
    const pool = pools[c];
    if (!pool) continue;
    if (pool.tier === 'elite') spotlightLines.push({ label: `${rules.classes[c].name}: Elite night`, pp: p.spotlight.eliteTier, heroClass: c });
    if (pool.tripleDouble) spotlightLines.push({ label: `${rules.classes[c].name}: triple-double`, pp: p.spotlight.tripleDouble, heroClass: c });
    else if (pool.doubleDouble) spotlightLines.push({ label: `${rules.classes[c].name}: double-double`, pp: p.spotlight.doubleDouble, heroClass: c });
  }

  const partyTotal = partyLines.reduce((s, l) => s + l.pp, 0);
  const perHero = Object.fromEntries(CLASSES.map((c) => [c, partyTotal / CLASSES.length])) as Record<HeroClass, number>;
  for (const l of spotlightLines) perHero[l.heroClass!] += l.pp;
  return { partyLines, spotlightLines, partyTotal, perHero };
}

import { CLASSES, rules as defaultRules, type HeroClass, type Rules } from '../rules';
import type { BattleState } from './combat';
import type { PoolBreakdown } from './rating';

export interface RewardLine {
  label: string;
  pp: number;
  heroClass?: HeroClass;
}

export interface Rewards {
  /** PP every hero who fought earns (waves cleared, Elite foes defeated). */
  partyLines: RewardLine[];
  /** PP for one hero: the victory share and their player's big nights. */
  heroLines: RewardLine[];
  /** Whole PP per hero who fought. */
  perHero: Record<HeroClass, number>;
}

/** Monsters worth an Elite bounty: Elite-tier Champions and bosses (not minions or the Phylactery). */
function eliteFoesDefeated(battle: BattleState): number {
  return battle.enemies.filter((e) => !e.alive && e.tier === 'elite' && e.kind !== 'goblin' && e.kind !== 'phylactery').length;
}

export function computeRewards(
  battle: BattleState,
  pools: Partial<Record<HeroClass, PoolBreakdown>>,
  rules: Rules = defaultRules,
): Rewards {
  const p = rules.progression.earn;
  const partyLines: RewardLine[] = [];
  const waves = Math.min(battle.stats.wavesCleared, 3);
  if (waves) partyLines.push({ label: `Waves cleared (${waves})`, pp: waves * p.perWaveCleared });
  const elites = eliteFoesDefeated(battle);
  if (elites) partyLines.push({ label: `Elite foes defeated (${elites})`, pp: elites * p.eliteDefeated });

  const heroLines: RewardLine[] = [];
  for (const h of battle.heroes) {
    const name = rules.classes[h.heroClass].name;
    if (battle.phase === 'won')
      heroLines.push(
        h.alive
          ? { label: `${name}: victory`, pp: p.winStanding, heroClass: h.heroClass }
          : { label: `${name}: victory (fallen)`, pp: p.winFallen, heroClass: h.heroClass },
      );
    const pool = pools[h.heroClass];
    if (!pool) continue;
    if (pool.tier === 'elite') heroLines.push({ label: `${name}: Elite night`, pp: p.eliteNight, heroClass: h.heroClass });
    if (pool.tripleDouble) heroLines.push({ label: `${name}: triple-double`, pp: p.tripleDouble, heroClass: h.heroClass });
    else if (pool.doubleDouble) heroLines.push({ label: `${name}: double-double`, pp: p.doubleDouble, heroClass: h.heroClass });
  }

  const party = partyLines.reduce((s, l) => s + l.pp, 0);
  const fought = new Set(battle.heroes.map((h) => h.heroClass));
  const perHero = Object.fromEntries(CLASSES.map((c) => [c, fought.has(c) ? party : 0])) as Record<HeroClass, number>;
  for (const l of heroLines) perHero[l.heroClass!] += l.pp;
  return { partyLines, heroLines, perHero };
}

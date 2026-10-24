import type { StatKey } from '../data/types';
import tiersJson from './tiers.json';
import poolJson from './pool.json';
import salaryJson from './salary.json';
import calibrationJson from './calibration.json';
import progressionJson from './progression.json';
import combatJson from './combat.json';
import classesJson from './classes.json';
import summonsJson from './summons.json';
import monstersJson from './monsters.json';
import hordeJson from './horde.json';
import encountersJson from './encounters.json';

/**
 * All game rules live in the JSON files next to this one, so tuning is a data
 * edit. This module only adds types.
 */

export const TIERS = ['cold', 'average', 'good', 'great', 'elite'] as const;
export type Tier = (typeof TIERS)[number];
export const CLASSES = ['warrior', 'ranger', 'cleric', 'rogue', 'wizard'] as const;
export type HeroClass = (typeof CLASSES)[number];
export type ChampionKind = 'ogre' | 'warlock' | 'hunter' | 'assassin' | 'shaman';
export type MonsterKind = 'goblin' | ChampionKind | 'chieftain';

export type RatingFormula = Partial<Record<StatKey, number>>;
/** Minimum Rating for each tier above Cold. */
export type Thresholds = Record<Exclude<Tier, 'cold'>, number>;

export interface TiersConfig {
  order: Tier[];
  pool: Record<Tier, number>;
  gearDamage: Record<Tier, number>;
  thresholdSource: string;
  thresholds: Record<HeroClass, Thresholds>;
}

export type PoolModifier =
  | {
      type: 'percentage';
      label: string;
      made: StatKey;
      attempts: StatKey;
      minAttempts: number;
      bonusAtOrAbove: number;
      bonus: number;
      penaltyBelow: number;
      penalty: number;
    }
  | { type: 'perTurnover'; label: string; amount: number };

export type TargetSpec =
  | { type: 'enemy'; nonBoss?: boolean; attackedSelfLastRound?: boolean }
  | { type: 'enemies'; count: number }
  | { type: 'allEnemies' }
  | { type: 'ally' }
  | { type: 'allAllies' }
  | { type: 'self' }
  | { type: 'fallenAlly' }
  | { type: 'allFallen' }
  | { type: 'none' };

export type Effect =
  | { type: 'damage'; amount: number | 'gear'; bonus?: number; pierce?: boolean; doubleIfTauntedByOther?: boolean }
  | { type: 'gearAttack'; times: number }
  | { type: 'poison'; perRound: number; rounds: number }
  | { type: 'nextAttackMultiplier'; multiplier: number }
  | { type: 'untargetable'; rounds: number }
  | { type: 'heal'; amount: number; on?: 'mostInjuredAlly' }
  | { type: 'gainEnergy'; amount: number }
  | { type: 'revive'; fraction: number }
  | { type: 'armor'; amount: number; on?: 'self' }
  | { type: 'taunt' }
  | { type: 'weaken'; amount: number; rounds: number }
  | { type: 'summon'; unit: SummonKind; count: number }
  | { type: 'instakill' }
  | { type: 'lastStand' };

export interface ActionDef {
  id: string;
  name: string;
  description: string;
  /** Energy cost. Absent for basic attacks and Signature/Legendary abilities. */
  cost?: number;
  /** Signature needs a double-double, Legendary a triple-double. */
  unlock?: 'signature' | 'legendary';
  target: TargetSpec;
  effects: Effect[];
}

export interface PassiveDef {
  type: 'armorPerRound';
  name: string;
  description: string;
  amount: number;
}

export interface ClassDef {
  name: string;
  role: string;
  poolName: string;
  hp: number;
  rating: RatingFormula;
  ratingLabel: string;
  modifiers: PoolModifier[];
  gear: ActionDef[];
  passives: PassiveDef[];
  abilities: ActionDef[];
}

export type SummonKind = 'wolf' | 'bear';
export interface SummonDef {
  name: string;
  hp: number;
  damage: number;
  tauntsPerRound: number;
}

export interface MonsterDef {
  name: string;
  behavior: 'default' | ChampionKind | 'chieftain';
  /** Taunts (Provoke, Bulwark, Shield Bash, the Bear) have no effect. */
  ignoresTaunt?: boolean;
  mirrors?: HeroClass;
  description: string;
  hp?: number;
  hpByTier?: number[];
  damageByTier?: number[];
}

export interface HordeConfig {
  mirrors: { heroClass: HeroClass; champion: ChampionKind; rankBy: StatKey; rank: number }[];
  championRating: Record<
    ChampionKind,
    {
      rating: RatingFormula;
      thresholds: HeroClass;
      tierShift?: { made: StatKey; attempts: StatKey; minAttempts: number; upAtOrAbove: number; downBelow: number };
    }
  >;
  minions: {
    teamPointsPerGoblin: number;
    waveShare: number[];
    damageByTeamFgPct: { below: number; damage: number }[];
  };
  warlord: { score: RatingFormula; hpMultiplier: number; damageBonus: number; extraActions: number };
  /** Champions that always join a specific wave (1-based), e.g. the Shaman in wave 1. */
  championWave?: Partial<Record<ChampionKind, number>>;
  turnoversPerStagger: number;
}

/** An encounter re-skins the monster roles and supplies its boss and twist. */
export interface EncounterDef {
  name: string;
  tagline: string;
  /** Boss monster kind; without one the classic Warlord (a boosted Champion) is used. */
  boss?: MonsterKind;
  /** Monster kinds that count as goblins for the Chieftain's Command. */
  goblinKin: MonsterKind[];
  monsters: Record<MonsterKind, { name: string; short: string; icon: string; flavor?: string }>;
}

export interface Rules {
  tiers: TiersConfig;
  pool: {
    freeTurnovers: number;
    penaltyPerExtraTurnover: number;
    doubleDouble: { pool: number };
    tripleDouble: { pool: number };
    doubleDoubleStats: StatKey[];
    minimumPool: number;
  };
  salary: typeof salaryJson & { byTier: Record<Tier, number>; versatility: { minTier: Tier; premiumPerExtraClass: number } };
  calibration: {
    minMinutes: number;
    percentiles: Record<Exclude<Tier, 'cold'>, number>;
    comparisonPools: Record<HeroClass, { description: string; seasonMin: Partial<Record<StatKey, number>> }>;
  };
  progression: typeof progressionJson;
  combat: typeof combatJson & { shaman: { healByTier: Record<Tier, number>; shieldArmor: number } };
  classes: Record<HeroClass, ClassDef>;
  summons: Record<SummonKind, SummonDef>;
  monsters: Record<MonsterKind, MonsterDef>;
  horde: HordeConfig;
  encounters: { default: string; encounters: Record<string, EncounterDef> };
}

export const rules: Rules = {
  tiers: tiersJson as TiersConfig,
  pool: poolJson as unknown as Rules['pool'],
  salary: salaryJson as Rules['salary'],
  calibration: calibrationJson as Rules['calibration'],
  progression: progressionJson,
  combat: combatJson as Rules['combat'],
  classes: classesJson as unknown as Record<HeroClass, ClassDef>,
  summons: summonsJson as Record<SummonKind, SummonDef>,
  monsters: monstersJson as unknown as Record<MonsterKind, MonsterDef>,
  horde: hordeJson as unknown as HordeConfig,
  encounters: encountersJson as unknown as Rules['encounters'],
};

export function tierIndex(t: Tier): number {
  return TIERS.indexOf(t);
}

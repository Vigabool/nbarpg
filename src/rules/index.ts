import type { StatKey } from '../data/types';
import tiersJson from './tiers.json';
import poolJson from './pool.json';
import salaryJson from './salary.json';
import calibrationJson from './calibration.json';
import progressionJson from './progression.json';
import combatJson from './combat.json';
import traitsJson from './traits.json';
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
export type MonsterKind = 'goblin' | ChampionKind | 'chieftain' | 'lich' | 'phylactery' | 'dragon' | 'giantLord';
export type Behavior = 'default' | ChampionKind | 'chieftain' | 'lich' | 'wraith' | 'phylactery' | 'dragon' | 'giantLord' | 'wolf';
export type Twist = 'packTactics' | 'packGuard' | 'restlessDead' | 'hoardTithe' | 'dragonscale' | 'topple';

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
  | { type: 'lastStand' }
  | { type: 'mark'; amount: number };

export interface ActionDef {
  id: string;
  name: string;
  description: string;
  /** Energy cost. Absent for basic attacks and Signature/Legendary abilities. */
  cost?: number;
  /** Signature needs a double-double, Legendary a triple-double. */
  unlock?: 'signature' | 'legendary';
  /** Spells can touch intangible foes; fire (like holy) destroys restless dead for good. */
  tags?: ('spell' | 'fire')[];
  /** Only available once the hero has bought this feat (see progression.json). */
  feat?: string;
  /** Usable once per battle. */
  oncePerBattle?: boolean;
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
  behavior: Behavior;
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
  turnoversPerFumble: number;
}

/** An encounter re-skins the monster roles and supplies its boss and twist. */
export interface EncounterDef {
  name: string;
  tagline: string;
  /** Boss monster kind; without one the classic Warlord (a boosted Champion) is used. */
  boss?: MonsterKind;
  /** The boss lies asleep on the field from round 1 until the final wave (the Dragon). */
  bossSleeps?: boolean;
  /** Arrives beside the boss at its tier (e.g. the Lich's Phylactery). */
  bossCompanion?: MonsterKind;
  /** Overrides horde.minions.teamPointsPerGoblin (e.g. fewer, tougher skeletons). */
  teamPointsPerMinion?: number;
  /** Overrides the minion's HP (e.g. fragile kobolds). */
  minionHp?: number;
  /** Overrides minion damage per team-FG% band (e.g. hard-hitting ice wolves). */
  minionDamage?: number[];
  /** Scales every role Champion's HP and damage (e.g. the Giant's Hall: few foes, each a mountain). */
  statScale?: { hp: number; damage: number };
  /** Monster kinds that count as goblins for the Chieftain's Command. */
  goblinKin: MonsterKind[];
  /** Encounter rules in play, e.g. Pack Tactics for goblins or Restless Dead for the Crypt. */
  twists: Twist[];
  monsters: Partial<Record<MonsterKind, EncounterMonster>>;
}

export interface EncounterMonster {
  name: string;
  /** Plural when it isn't name + "s" (e.g. Ice Wolves). */
  plural?: string;
  short: string;
  icon: string;
  flavor?: string;
  /** Overrides the role's behavior and description (e.g. the Crypt's Wraith). */
  behavior?: Behavior;
  description?: string;
  /** Overrides which special it uses (a key of combat.specials), or just its name. */
  special?: string;
  specialName?: string;
  specialShort?: string;
  /** While it lives, every minion deals extra damage (e.g. the Wight's Unholy Vigor). */
  aura?: { name: string; bonus: number; description: string };
  /** Its hits also poison heroes (e.g. the Goblin Sharpshooter's Dirty Arrows). */
  poisonOnHit?: { name: string; perRound: number; rounds: number; description: string };
  /** Heals whenever a minion crumbles from weapon hits (e.g. the Bone Giant). */
  boneHarvest?: { name: string; heal: number; description: string };
  /** Reassembles like a skeleton after a weapon kill, this many times (e.g. the Skeletal Archer). */
  restless?: { name: string; rises: number; description: string };
  /** Dragonkin: Dragonscale halves fire damage. */
  dragonkin?: boolean;
  /** Burns heroes who hit it with a weapon (e.g. the Magma Drake). */
  moltenHide?: { name: string; damage: number; description: string };
  /** Energy it drains also adds coins to the hoard (e.g. the Wyrmling). */
  shinyThief?: { name: string; description: string };
  /** Heals each round unless toppled or burned that round (e.g. the Frost Troll). */
  regenerate?: { name: string; amount: number; description: string };
  /** While it lives, every giant's topple threshold rises (e.g. the Skald). */
  rallyingSaga?: { name: string; bonus: number; description: string };
}

/** A box-score trait: a standout stat on the mirrored player's night gives its monster an ability. */
export type TraitId = 'swat' | 'pickpocket' | 'secondChance' | 'floorGeneral' | 'deepRange' | 'takeover' | 'hotHand';
export type TraitTrigger =
  | { stat: StatKey; atLeast: number; label: string }
  | { made: StatKey; attempts: StatKey; minAttempts: number; pctAtLeast: number; label: string };
export interface TraitDef {
  name: string;
  icon: string;
  trigger: TraitTrigger;
  description: string;
  counter: string;
  energy?: number;
  hpFraction?: number;
  bonus?: number;
  max?: number;
}

/** A one-time gear purchase from the Armory. */
export interface GearDef {
  heroClass: HeroClass;
  name: string;
  icon: string;
  cost: number;
  description: string;
  armorPerRound?: number;
  startingEnergy?: number;
  healBonus?: number;
  costReduction?: { action: string; amount: number };
  poisonRounds?: number;
  spellDamage?: number;
}

/** A feat: a new capability bought in the Armory. */
export interface FeatDef {
  heroClass: HeroClass;
  name: string;
  icon: string;
  cost: number;
  description: string;
}

export interface ProgressionConfig {
  earn: {
    perWaveCleared: number;
    winStanding: number;
    winFallen: number;
    eliteDefeated: number;
    eliteNight: number;
    doubleDouble: number;
    tripleDouble: number;
  };
  weapon: { costs: number[]; damagePerLevel: number };
  shield: { costs: number[]; armorPerLevel: number };
  /** Champions and bosses gain this much HP and damage per chapter after the first. */
  chapterScaling: number;
  gear: Record<string, GearDef>;
  feats: Record<string, FeatDef>;
}

/** What a hero has bought in the Armory. Progress belongs to the hero, not the player. */
export interface HeroProgress {
  weapon: number;
  shield: number;
  gear: string[];
  feats: string[];
}

export const emptyProgress = (): HeroProgress => ({ weapon: 0, shield: 0, gear: [], feats: [] });

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
  progression: ProgressionConfig;
  traits: Record<TraitId, TraitDef>;
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
  progression: progressionJson as unknown as ProgressionConfig,
  combat: combatJson as Rules['combat'],
  traits: traitsJson as Record<TraitId, TraitDef>,
  classes: classesJson as unknown as Record<HeroClass, ClassDef>,
  summons: summonsJson as Record<SummonKind, SummonDef>,
  monsters: monstersJson as unknown as Record<MonsterKind, MonsterDef>,
  horde: hordeJson as unknown as HordeConfig,
  encounters: encountersJson as unknown as Rules['encounters'],
};

export function tierIndex(t: Tier): number {
  return TIERS.indexOf(t);
}

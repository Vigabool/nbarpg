import type { ActionDef, Behavior, EncounterDef, Rules } from '../../rules';
import type { BattleState, EnemyState, HeroState, Target } from '../combat';
import type { SpecialInfo } from '../encounter';

/** Damage kinds that some rules care about (fire stops regeneration; fire and holy destroy skeletons). */
export interface DamageSource {
  fire?: boolean;
  holy?: boolean;
}

/** Someone buffing an enemy's damage (the Chieftain, a minion aura), as shown on its card. */
export interface BuffSource {
  icon: string;
  name: string;
  bonus: number;
}

/**
 * An encounter rule that plugs into core combat (src/engine/combat.ts). Core combat calls
 * every hook of every mechanic in play, in registry order (see ./index.ts); a mechanic is
 * in play when `appliesTo` says so for the battle's encounter. All hooks are optional and
 * may change the state they're given (core combat has already cloned it).
 */
export interface Mechanic {
  id: string;
  /** In play for this encounter: usually a twist, a monster flag or the boss setup. */
  appliesTo(enc: EncounterDef): boolean;

  // ---- Setup and the round clock ----
  /** Once, before the first wave is placed. */
  initBattle?(state: BattleState, rules: Rules): void;
  /** Each enemy as it enters (first wave, later waves). */
  initEnemy?(state: BattleState, e: EnemyState, rules: Rules): void;
  /** After a wave arrives and is logged. */
  onWaveArrived?(state: BattleState, arrivedRound: number, rules: Rules): void;
  /** Start of each round, before waves on the clock arrive. */
  onRoundStart?(state: BattleState, rules: Rules): void;
  /** After the horde acts and the party survives, before durations tick down. */
  onRoundEnd?(state: BattleState, rules: Rules): void;

  // ---- Damage to enemies ----
  /** Scales a hit before armor (Ambush, Dragonscale, the Phylactery). */
  incomingDamage?(state: BattleState, e: EnemyState, amount: number, source: DamageSource, rules: Rules): number;
  /** After a hit lands on an enemy still standing or just dropped to 0 HP (Topple). */
  afterEnemyHit?(state: BattleState, e: EnemyState, dealt: number, rules: Rules): void;
  /** An enemy was defeated (Restless Dead, the Lich and its Phylactery). */
  onEnemyDefeated?(state: BattleState, e: EnemyState, source: DamageSource, rules: Rules): void;
  /** A hero's attack hit this enemy (Molten Hide). Push log text onto `parts`. */
  afterHeroStrike?(state: BattleState, hero: HeroState, e: EnemyState, def: ActionDef, parts: string[], rules: Rules): void;
  /** Smite's bonus applies against this enemy (undead, dragonkin). */
  smiteVulnerable?(state: BattleState, e: EnemyState, rules: Rules): boolean;

  // ---- Enemies ----
  /** Can't be targeted by single-target attacks right now (the Pack, the Phylactery). */
  guarded?(state: BattleState, e: EnemyState, rules: Rules): boolean;
  /** Flat damage added to each of this enemy's hits (Pack Tactics, the hoard). */
  damageBonus?(state: BattleState, e: EnemyState, rules: Rules): number;
  /** Named damage buffs on this enemy, shown on its card and added to its hits. */
  buffSources?(state: BattleState, e: EnemyState, rules: Rules): BuffSource[];
  /** This enemy loses its whole turn (a toppled giant). Log why and return true. */
  skipsTurn?(state: BattleState, e: EnemyState, rules: Rules): boolean;
  /** An enemy drained a hero's energy; returns log text to append (Shiny Thief). */
  onEnergyDrained?(state: BattleState, e: EnemyState, hero: HeroState, drained: number, rules: Rules): string;
  /** An enemy's hit landed on a hero; returns log text to append (Dirty Arrows). */
  onHeroHit?(state: BattleState, e: EnemyState, hero: HeroState, dealt: number, rules: Rules): string;

  // ---- Lookahead bot ----
  /**
   * For the smart bot: adjusts its score of `after` (the state once this round ends, from `state`)
   * for what this mechanic adds, e.g. bone piles, hoard coins, topple progress. Returns the new score.
   */
  botScore?(state: BattleState, after: BattleState, score: number, rules: Rules): number;

  /** Specials this module defines, by key (see rules/combat.json `specials`). Available to every encounter. */
  specials?: Record<string, SpecialHandler>;
  /** Behaviors this module defines (see rules/monsters.json and encounter overrides). Available to every encounter. */
  behaviors?: Partial<Record<Behavior, BehaviorHandler>>;
}

/** A champion's every-few-rounds special. */
export interface SpecialHandler {
  /** The special it would actually use now, or null if none (Goblin Toss falls back to Ground Slam). */
  resolve?(state: BattleState, e: EnemyState, info: SpecialInfo, rules: Rules): SpecialInfo | null;
  /** Acts before the rest of the horde on the round it fires (the War Drum). */
  actsFirst?: boolean;
  /** Does it and logs it; false if it can't (no target), so the enemy acts normally. `dmg` is its hit damage now. */
  run(state: BattleState, e: EnemyState, dmg: number, rules: Rules): boolean;
}

/** How an enemy with a given behavior acts, beyond the default "hit the Warrior, else the weakest". */
export interface BehaviorHandler {
  /** Starting state as it enters (the Wraith starts intangible). */
  init?(state: BattleState, e: EnemyState, rules: Rules): void;
  /** Never acts (the Phylactery). */
  idle?: boolean;
  /** Replaces its hit damage (the Wraith's drain). */
  damage?(state: BattleState, e: EnemyState, rules: Rules): number;
  /** Replaces its normal action; return false to attack normally (the Shaman heals when someone is hurt). */
  act?(state: BattleState, e: EnemyState, rules: Rules): boolean;
  /** Who it hits when not taunted; undefined falls back to the default. */
  target?(state: BattleState, e: EnemyState, all: Target[], heroes: Target[], rules: Rules): Target | undefined;
  /** Extra effect of each hit on a hero; returns log text to append (the Assassin's energy drain). */
  onHit?(state: BattleState, e: EnemyState, hero: HeroState, rules: Rules): string;
}

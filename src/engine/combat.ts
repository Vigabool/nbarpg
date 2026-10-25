import { CLASSES, emptyProgress, rules as defaultRules, type ActionDef, type Effect, type HeroClass, type HeroProgress, type Rules, type SummonKind, type TraitId } from '../rules';
import { behaviorOf, encounterOf, monsterName, specialFor, type SpecialInfo } from './encounter';
import { behaviorHandler, mechanicsFor, specialHandler, type BuffSource, type DamageSource } from './encounters';
import type { MonsterSpec } from './horde';

// Encounter rules live in ./encounters; these are part of the combat API.
export { packBonus } from './encounters/goblinHorde';
export { phylactery } from './encounters/crypt';
export { hoardBonus } from './encounters/dragonLair';
export { toppleThreshold } from './encounters/giantsHall';
import type { PoolBreakdown } from './rating';

/**
 * Deterministic, turn-based battle engine. Every function returns a new state;
 * nothing is mutated in place, so the UI can keep history and preview outcomes.
 */

export interface HeroSetup {
  heroClass: HeroClass;
  playerId: number;
  playerName: string;
  gear: number;
  pool: PoolBreakdown;
  /** Armory purchases (weapon and shield levels, gear, feats). */
  progress?: HeroProgress;
}

export interface HeroState {
  id: HeroClass;
  heroClass: HeroClass;
  name: string;
  playerId: number;
  hp: number;
  maxHp: number;
  pool: number;
  startingPool: number;
  gear: number;
  armor: number;
  alive: boolean;
  /** Used this round's attack. Utilities stay available while the pool lasts. */
  acted: boolean;
  /** Knocked prone last round: no attack or utilities this round. */
  prone?: boolean;
  /** Knocked prone: skips the next party phase. */
  skipNextTurn: boolean;
  nextAttackMultiplier: number;
  /** Sources of the pending next-attack multiplier; the same ability doesn't stack with itself. */
  attackBuffs?: Record<string, number>;
  /** Armor abilities applied this round; the same ability doesn't stack with itself. */
  buffs?: string[];
  untargetableRounds: number;
  lastStand: boolean;
  /** Damage reduction from the Warlock's curse, counted in party phases. */
  curse: { amount: number; rounds: number } | null;
  /** Net Shot: the round this hero can't use an attack. */
  nettedRound?: number;
  /** Poison from an enemy's hits (e.g. Dirty Arrows), ticking after the horde acts. */
  poison?: { perRound: number; rounds: number; sourceId: string } | null;
  signatureUnlocked: boolean;
  legendaryUnlocked: boolean;
  signatureReady: boolean;
  legendaryReady: boolean;
  attackedByThisRound: string[];
  attackedByLastRound: string[];
  /** Armory purchases this hero brings to the battle. */
  progress?: HeroProgress;
  /** Once-per-battle abilities already used (e.g. Vanish). */
  usedOnce?: string[];
  /** Shadow Cloak: the first enemy hit already missed. */
  cloakUsed?: boolean;
  /** Arcane Surge: the last round a spell was cast. */
  lastSpellRound?: number;
  /** Intercept: the last round the Warrior took a hit for an ally. */
  interceptRound?: number;
}

export interface SummonState {
  id: string;
  kind: SummonKind;
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  tauntsPerRound: number;
  alive: boolean;
}

export interface EnemyState {
  id: string;
  kind: MonsterSpec['kind'];
  name: string;
  hp: number;
  maxHp: number;
  damage: number;
  tier?: MonsterSpec['tier'];
  isWarlord: boolean;
  extraActions: number;
  /** Fumbles from its player's turnovers: the party can spend one to cancel its next action. */
  fumbles: number;
  /** A Fumble was spent: it loses its next action. */
  fumbled?: boolean;
  alive: boolean;
  shield: { armor: number; rounds: number } | null;
  poison: { perRound: number; rounds: number } | null;
  weaken: { amount: number; rounds: number } | null;
  tauntedBy: string | null;
  spec: MonsterSpec;
  /** Round the enemy entered. Enemies that arrive mid-round act from the next round. */
  arrivedRound: number;
  /** Which wave (0-based) the enemy came with. */
  wave: number;
  /** Warlord below half HP: hits harder for the rest of the battle. */
  enraged?: boolean;
  /** Shaman's War Drum: bonus damage during the given round's enemy phase. */
  drum?: { amount: number; round: number } | null;
  /** Wraith: only spells and holy (Cleric) attacks can touch it. */
  intangible?: boolean;
  /** Restless Dead: a destroyed skeleton waiting to reassemble next round, and how often it has. */
  pile?: boolean;
  rises?: number;
  /** Destroyed for good by fire or holy damage: even Raise Dead can't bring it back. */
  destroyed?: boolean;
  /** The Dragon sleeping on its hoard; `waking` once a hero hits it (it wakes at round end). */
  asleep?: boolean;
  waking?: boolean;
  /** Woken early by a hit: one action a round until the final wave arrives. */
  groggy?: boolean;
  /** Topple: damage taken this round, and whether it's down (loses its next action). */
  toppleDamage?: number;
  toppled?: boolean;
  toppledRound?: number;
  /** The last round it took fire damage (stops a Frost Troll regenerating). */
  burnedRound?: number;
  /** Hunter's Mark: extra damage from every hit during this round. */
  mark?: { round: number; amount: number };
  /** Box-score traits (see rules/traits.json). */
  traits?: TraitId[];
  /** Swat: the round it last negated a hit. */
  swatRound?: number;
  secondChanceUsed?: boolean;
  /** Hot Hand: bonus damage built up over rounds it wasn't hit. */
  hotStacks?: number;
  /** The last round anything hit it. */
  hitRound?: number;
}

export interface LogEntry {
  round: number;
  side: 'hero' | 'summon' | 'enemy' | 'system';
  text: string;
  actorId?: string;
  targetIds?: string[];
  /** A compact version for the enemy card, e.g. "→ Warrior 20" or "⚠ Slam: all heroes". */
  short?: string;
  /** Damage each hero took from this action (after armor), by hero id. */
  hits?: Record<string, number>;
}

export interface BattleState {
  round: number;
  phase: 'party' | 'won' | 'lost';
  outcomeReason?: string;
  /** Highest wave (0-based) that has arrived. Waves can overlap. */
  waveIndex: number;
  waveCount: number;
  clearedWaves?: number[];
  /** Hoard Tithe: coins on the sleeping Dragon's hoard; sealed once it wakes. */
  hoard?: { coins: number; sealed: boolean };
  /** Encounter id (see rules/encounters.json); the default when absent. */
  encounter?: string;
  pendingWaves: MonsterSpec[][];
  heroes: HeroState[];
  summons: SummonState[];
  enemies: EnemyState[];
  log: LogEntry[];
  /** Hero damage dealt since the last log entry; the next entry takes it as `hits`. */
  pendingHits?: Record<string, number>;
  nextSummonId: number;
  stats: {
    wavesCleared: number;
    warlordDefeated: boolean;
    anyHeroFell: boolean;
    signaturesUsed: number;
  };
}

export interface HeroAction {
  heroId: HeroClass;
  actionId: string;
  targetIds: string[];
}

export interface ActionOption {
  def: ActionDef;
  source: 'gear' | 'ability';
  available: boolean;
  /** Attacks are limited to one per round; utilities only by the pool. */
  attack: boolean;
  reason?: string;
  validTargets: string[];
  /** Energy it costs this hero right now (after Quiver of Plenty, Arcane Surge). */
  cost?: number;
}

const clone = <T>(v: T): T => structuredClone(v);

export function makeEnemy(spec: MonsterSpec, arrivedRound: number, wave: number): EnemyState {
  return {
    arrivedRound,
    wave,
    drum: null,
    id: spec.id,
    kind: spec.kind,
    name: spec.name,
    hp: spec.hp,
    maxHp: spec.hp,
    damage: spec.damage,
    tier: spec.tier,
    isWarlord: spec.isWarlord,
    extraActions: spec.extraActions,
    fumbles: spec.fumbles,
    traits: spec.traits ?? [],
    alive: true,
    shield: null,
    poison: null,
    weaken: null,
    tauntedBy: null,
    spec,
  };
}

export function createBattle(heroes: HeroSetup[], waves: MonsterSpec[][], rules: Rules = defaultRules, encounter?: string): BattleState {
  const ordered = structuredClone(heroes).sort((a, b) => CLASSES.indexOf(a.heroClass) - CLASSES.indexOf(b.heroClass));
  // Armory: weapon levels add damage, gear adds starting energy.
  for (const h of ordered) {
    const prog = h.progress ?? emptyProgress();
    h.gear += prog.weapon * rules.progression.weapon.damagePerLevel;
    const bonus = prog.gear.reduce((t, id) => t + (rules.progression.gear[id]?.startingEnergy ?? 0), 0);
    if (bonus) h.pool = { ...h.pool, pool: h.pool.pool + bonus };
  }
  const state: BattleState = {
    round: 1,
    phase: 'party',
    waveIndex: 0,
    waveCount: waves.length,
    pendingWaves: clone(waves.slice(1)),
    heroes: ordered.map((h) => ({
      id: h.heroClass,
      heroClass: h.heroClass,
      name: h.playerName,
      playerId: h.playerId,
      hp: rules.classes[h.heroClass].hp,
      maxHp: rules.classes[h.heroClass].hp,
      pool: h.pool.pool,
      startingPool: h.pool.pool,
      gear: h.gear,
      armor: 0,
      alive: true,
      acted: false,
      skipNextTurn: false,
      nextAttackMultiplier: 1,
      untargetableRounds: 0,
      lastStand: false,
      curse: null,
      signatureUnlocked: h.pool.doubleDouble,
      legendaryUnlocked: h.pool.tripleDouble,
      signatureReady: h.pool.doubleDouble,
      legendaryReady: h.pool.tripleDouble,
      attackedByThisRound: [],
      attackedByLastRound: [],
      progress: h.progress ?? emptyProgress(),
    })),
    summons: [],
    enemies: waves[0].map((m) => makeEnemy(m, 0, 0)),
    clearedWaves: [],
    encounter,
    log: [],
    nextSummonId: 1,
    stats: { wavesCleared: 0, warlordDefeated: false, anyHeroFell: false, signaturesUsed: 0 },
  };
  for (const m of mechanicsFor(state, rules)) m.initBattle?.(state, rules);
  for (const e of state.enemies) initEnemy(state, e, rules);
  log(state, 'system', `Wave 1 of ${waves.length}: ${describeWave(state.enemies, state.encounter, rules)}`);
  startRound(state, rules);
  return state;
}

function describeWave(enemies: EnemyState[], encounter: string | undefined, rules: Rules): string {
  const minions = enemies.filter((e) => e.kind === 'goblin');
  const named = enemies.filter((e) => e.kind !== 'goblin').map((e) => e.name);
  const n = minions.length;
  const one = monsterName('goblin', encounter, rules);
  const many = encounterOf(encounter, rules).monsters.goblin?.plural ?? `${one}s`;
  return [n ? `${n} ${(n > 1 ? many : one).toLowerCase()}` : '', ...named].filter(Boolean).join(', ');
}

export function log(state: BattleState, side: LogEntry['side'], text: string, actorId?: string, targetIds?: string[], short?: string) {
  const hits = state.pendingHits;
  delete state.pendingHits;
  state.log.push({ round: state.round, side, text, actorId, targetIds, short, ...(hits && { hits }) });
}

/** The behavior an enemy uses in this battle's encounter. */
export const behaviorFor = (state: BattleState, e: EnemyState, rules: Rules = defaultRules) => behaviorOf(e.kind, state.encounter, rules);

/** Spells and Cleric (holy) attacks can touch intangible enemies; all Cleric damage is holy. */
function touchesIntangible(hero: HeroState, def: ActionDef): boolean {
  return hero.heroClass === 'cleric' || !!def.tags?.includes('spell');
}

function damageSource(hero: HeroState, def: ActionDef): DamageSource {
  return { fire: !!def.tags?.includes('fire'), holy: hero.heroClass === 'cleric' };
}

/** Sets per-encounter starting state (the Wraith starts intangible, the Dragon asleep). */
function initEnemy(state: BattleState, e: EnemyState, rules: Rules) {
  behaviorHandler(behaviorFor(state, e, rules))?.init?.(state, e, rules);
  for (const m of mechanicsFor(state, rules)) m.initEnemy?.(state, e, rules);
}

/** Enemies that are awake and fighting: a sleeping Dragon doesn't count. */
export const awake = (state: BattleState) => state.enemies.filter((e) => e.alive && !e.asleep);

/** No living enemies and no bone piles about to rise. */
function fieldEmpty(state: BattleState): boolean {
  return !state.enemies.some((e) => (e.alive && !e.asleep) || e.pile);
}

/** "Ogre · Anthony Davis" → "Ogre". */
export const shortName = (name: string) => name.split(' · ')[0];

/** Round a wave (0-based index) arrives on the clock, or null if it only comes when the field is clear. */
export function waveArrivalRound(wave: number, rules: Rules = defaultRules): number | null {
  return rules.combat.waveArrivalRounds[wave - 1] ?? null;
}

/**
 * The round the next wave arrives: its clock round, or the next round if the
 * field is already clear. Null once every wave has arrived.
 */
export function nextWaveRound(state: BattleState, rules: Rules = defaultRules): number | null {
  if (state.pendingWaves.length === 0) return null;
  const clock = waveArrivalRound(state.waveIndex + 1, rules);
  if (fieldEmpty(state)) return Math.min(clock ?? Infinity, state.round + 1);
  return clock;
}

function spawnNextWave(state: BattleState, arrivedRound: number, rules: Rules) {
  const next = state.pendingWaves.shift();
  if (!next) return;
  state.waveIndex++;
  const fresh = next.map((m) => makeEnemy(m, arrivedRound, state.waveIndex));
  for (const e of fresh) initEnemy(state, e, rules);
  state.enemies.push(...fresh);
  const label = `Wave ${state.waveIndex + 1} of ${state.waveCount}`;
  log(state, 'system', `${label} arrives: ${describeWave(fresh, state.encounter, rules)}.`);
  for (const m of mechanicsFor(state, rules)) m.onWaveArrived?.(state, arrivedRound, rules);
}

function startRound(state: BattleState, rules: Rules) {
  if (state.round > 1) log(state, 'system', `Round ${state.round} begins. Every hero can act again.`);
  for (const m of mechanicsFor(state, rules)) m.onRoundStart?.(state, rules);
  // Waves on the clock arrive at the start of their round, before the party acts, and fight this round.
  // An empty field also brings the next wave in now.
  while (state.pendingWaves.length > 0) {
    const clock = waveArrivalRound(state.waveIndex + 1, rules);
    if (awake(state).length > 0 && (clock === null || state.round < clock)) break;
    spawnNextWave(state, state.round - 1, rules);
  }
  for (const h of state.heroes) {
    h.armor = 0;
    h.buffs = [];
    if (!h.alive) continue;
    for (const p of rules.classes[h.heroClass].passives) if (p.type === 'armorPerRound') h.armor += p.amount;
    h.armor += armoryArmor(h, rules);
    h.acted = h.skipNextTurn;
    h.prone = h.skipNextTurn;
    if (h.skipNextTurn) log(state, 'system', `${rules.classes[h.heroClass].name} is prone and skips this turn.`, h.id);
    h.skipNextTurn = false;
  }
}

// ---------- Queries ----------

export function livingEnemies(state: BattleState): EnemyState[] {
  return state.enemies.filter((e) => e.alive);
}

/** True for enemies that entered this round; they hold their attack until next round. */
export function justArrived(state: BattleState, e: EnemyState): boolean {
  return (e.arrivedRound ?? 0) >= state.round;
}

export function enemyArmor(e: EnemyState): number {
  return e.shield && e.shield.rounds > 0 ? e.shield.armor : 0;
}

function findUnit(state: BattleState, id: string): HeroState | SummonState | EnemyState | undefined {
  return state.heroes.find((h) => h.id === id) ?? state.summons.find((s) => s.id === id) ?? state.enemies.find((e) => e.id === id);
}

/** Can't be targeted by single-target attacks right now (guarded by the Pack, a Phylactery behind its skeletons). */
export function isGuarded(state: BattleState, e: EnemyState, rules: Rules = defaultRules): boolean {
  return mechanicsFor(state, rules).some((m) => m.guarded?.(state, e, rules));
}

/** Enemies that weapon attacks and summons can pick: not guarded, not intangible. */
export function pickableEnemies(state: BattleState, rules: Rules = defaultRules): EnemyState[] {
  return livingEnemies(state).filter((e) => !isGuarded(state, e, rules) && !e.intangible && !e.asleep);
}

/** Enemies a given action can aim at; spells and Cleric attacks also reach intangible ones. */
function aimable(state: BattleState, hero: HeroState, def: ActionDef, rules: Rules): EnemyState[] {
  return livingEnemies(state).filter((e) => !isGuarded(state, e, rules) && (!e.intangible || touchesIntangible(hero, def)));
}

export function ignoresTaunt(e: EnemyState, rules: Rules = defaultRules): boolean {
  return !!rules.monsters[e.kind].ignoresTaunt || hasTrait(e, 'deepRange');
}

export const hasTrait = (e: EnemyState, id: TraitId) => !!e.traits?.includes(id);

/** Takeover: a second action once below half HP. */
export function actionsThisRound(e: EnemyState): number {
  if (e.groggy) return 1;
  return 1 + e.extraActions + (hasTrait(e, 'takeover') && e.hp <= e.maxHp / 2 ? 1 : 0);
}

function validTargets(state: BattleState, hero: HeroState, def: ActionDef, rules: Rules = defaultRules): string[] {
  const t = def.target;
  switch (t.type) {
    case 'enemy': {
      let es = aimable(state, hero, def, rules);
      if (t.nonBoss) es = es.filter((e) => !e.isWarlord);
      if (t.attackedSelfLastRound) es = es.filter((e) => hero.attackedByLastRound.includes(e.id));
      // A pure taunt (Provoke) can't target an enemy that ignores taunts.
      if (def.effects.every((x) => x.type === 'taunt')) es = es.filter((e) => !ignoresTaunt(e, rules));
      return es.map((e) => e.id);
    }
    case 'enemies':
      return aimable(state, hero, def, rules).map((e) => e.id);
    case 'allEnemies':
      // Area attacks pass a sleeping Dragon by: waking it is always a deliberate choice.
      return livingEnemies(state).filter((e) => !e.asleep).map((e) => e.id);
    case 'ally': {
      let allies = state.heroes.filter((h) => h.alive);
      // Empower doesn't stack with itself: skip allies who already have it.
      if (def.effects.some((e) => e.type === 'nextAttackMultiplier')) allies = allies.filter((h) => !h.attackBuffs?.[def.id]);
      return allies.map((h) => h.id);
    }
    case 'allAllies':
      return state.heroes.filter((h) => h.alive).map((h) => h.id);
    case 'fallenAlly':
    case 'allFallen':
      return state.heroes.filter((h) => !h.alive).map((h) => h.id);
    case 'self':
      return [hero.id];
    case 'none':
      return [];
  }
}

/** Self and party buffs (Parry, Shield Wall, Ready Crit) don't stack with themselves. */
function alreadyActive(def: ActionDef, hero: HeroState): boolean {
  const t = def.target.type;
  if (t !== 'self' && t !== 'allAllies') return false;
  if (def.effects.some((e) => e.type === 'armor') && (hero.buffs ?? []).includes(def.id)) return true;
  if (def.effects.some((e) => e.type === 'nextAttackMultiplier') && hero.attackBuffs?.[def.id]) return true;
  return false;
}

/** Energy an action gives back (basic weapon attacks), or 0. */
export function energyGain(def: ActionDef): number {
  return def.effects.reduce((s, e) => s + (e.type === 'gainEnergy' ? e.amount : 0), 0);
}

/** An attack deals damage or defeats an enemy; everything else is a utility. */
export function isAttack(def: ActionDef): boolean {
  return def.effects.some((e) => e.type === 'damage' || e.type === 'gearAttack' || e.type === 'instakill');
}

export function listActions(state: BattleState, heroId: HeroClass, rules: Rules = defaultRules): ActionOption[] {
  const hero = state.heroes.find((h) => h.id === heroId);
  if (!hero) return [];
  const cls = rules.classes[hero.heroClass];
  const opts: ActionOption[] = [];
  const over = state.phase !== 'party' ? 'Battle is over' : !hero.alive ? 'Fallen' : hero.prone ? 'Prone this round' : undefined;
  const blockedFor = (def: ActionDef) =>
    over ??
    (isAttack(def) && hero.acted ? 'Already attacked this round' : isAttack(def) && hero.nettedRound === state.round ? 'Netted: no attack this round' : undefined);
  for (const def of cls.gear) {
    const targets = validTargets(state, hero, def, rules);
    let reason = blockedFor(def);
    if (!reason && targets.length === 0)
      reason = def.target.type === 'enemy' && def.target.attackedSelfLastRound ? 'No enemy attacked you last round' : 'No targets';
    const cost = actionCost(state, hero, def, rules);
    if (!reason && def.oncePerBattle && hero.usedOnce?.includes(def.id)) reason = 'Already used this battle';
    if (!reason && cost !== undefined && cost > hero.pool) reason = `Needs ${cost} energy`;
    opts.push({
      def,
      source: 'gear',
      attack: isAttack(def),
      available: !reason,
      reason,
      validTargets: targets,
      cost,
    });
  }
  for (const def of cls.abilities) {
    // Feat abilities appear once the hero has bought the feat.
    if (def.feat && !hasFeat(hero, def.feat)) continue;
    const targets = validTargets(state, hero, def, rules);
    let reason = blockedFor(def);
    if (!reason && def.unlock === 'signature' && !hero.signatureReady)
      reason = hero.signatureUnlocked ? 'Already used' : 'Needs a double-double';
    if (!reason && def.unlock === 'legendary' && !hero.legendaryReady)
      reason = hero.legendaryUnlocked ? 'Already used' : 'Needs a triple-double';
    if (!reason && alreadyActive(def, hero)) reason = 'Already active this round';
    const cost = actionCost(state, hero, def, rules);
    if (!reason && def.oncePerBattle && hero.usedOnce?.includes(def.id)) reason = 'Already used this battle';
    if (!reason && cost !== undefined && cost > hero.pool) reason = `Needs ${cost} energy`;
    if (!reason && def.target.type !== 'none' && targets.length === 0) reason = 'No valid targets';
    opts.push({ def, source: 'ability', attack: isAttack(def), available: !reason, reason, validTargets: targets, cost });
  }
  return opts;
}

// ---------- Hero actions ----------

function damageEnemy(
  state: BattleState,
  enemy: EnemyState,
  amount: number,
  pierce: boolean,
  rules: Rules = defaultRules,
  source: DamageSource = {},
): number {
  // Hunter's Mark: every hit this round lands harder.
  if (amount > 0 && enemy.mark?.round === state.round) amount += enemy.mark.amount;
  if (amount > 0) {
    enemy.hitRound = state.round;
    enemy.hotStacks = 0;
    // Swat: the first hit each round is batted away.
    if (hasTrait(enemy, 'swat') && enemy.swatRound !== state.round) {
      enemy.swatRound = state.round;
      log(state, 'system', `✋ ${enemy.name} swats the hit away.`, enemy.id);
      return 0;
    }
  }
  const mechanics = mechanicsFor(state, rules);
  for (const m of mechanics) if (m.incomingDamage) amount = m.incomingDamage(state, enemy, amount, source, rules);
  const dealt = Math.max(0, Math.floor(amount) - (pierce ? 0 : enemyArmor(enemy)));
  enemy.hp = Math.max(0, enemy.hp - dealt);
  if (source.fire && dealt > 0) enemy.burnedRound = state.round;
  for (const m of mechanics) m.afterEnemyHit?.(state, enemy, dealt, rules);
  if (enemy.hp === 0 && enemy.alive && hasTrait(enemy, 'secondChance') && !enemy.secondChanceUsed) {
    // Second Chance: back up once, at a fraction of its HP.
    enemy.secondChanceUsed = true;
    enemy.hp = Math.max(1, Math.round(enemy.maxHp * rules.traits.secondChance.hpFraction!));
    log(state, 'system', `🔁 ${enemy.name} grabs a second chance and gets back up at ${enemy.hp} HP!`, enemy.id);
  }
  if (enemy.hp === 0 && enemy.alive) {
    enemy.alive = false;
    if (enemy.isWarlord) state.stats.warlordDefeated = true;
    for (const m of mechanics) m.onEnemyDefeated?.(state, enemy, source, rules);
  }
  const rage = rules.combat.warlordEnrage;
  if (enemy.isWarlord && enemy.alive && !enemy.enraged && enemy.hp <= enemy.maxHp * rage.atHpFraction) {
    enemy.enraged = true;
    log(state, 'system', `${enemy.name} is enraged: +${rage.damageBonus} damage for the rest of the battle!`, enemy.id);
  }
  return dealt;
}

/** The special this enemy would use now: Goblin Toss needs a goblin to throw, else it's Ground Slam. */
export function activeSpecial(state: BattleState, e: EnemyState, rules: Rules = defaultRules): SpecialInfo | null {
  const sp = specialOf(e, state.encounter, rules);
  const resolve = specialHandler(sp?.key)?.resolve;
  return sp && resolve ? resolve(state, e, sp, rules) : sp;
}

/** Chieftain's Command: bonus damage for every goblin while a Chieftain lives. */
export function commandBonus(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  return commandSources(state, e, rules).reduce((t, s) => t + s.bonus, 0);
}

/** Who is buffing this enemy: the Chieftain (every goblin), a minion aura such as the Wight's Unholy Vigor, a Floor General. */
export function commandSources(state: BattleState, e: EnemyState, rules: Rules = defaultRules): BuffSource[] {
  const out: BuffSource[] = [];
  for (const m of mechanicsFor(state, rules)) if (m.buffSources) out.push(...m.buffSources(state, e, rules));
  for (const x of awake(state))
    if (x.id !== e.id && hasTrait(x, 'floorGeneral')) {
      const t = rules.traits.floorGeneral;
      out.push({ icon: t.icon, name: `${t.name} (${x.name.split(' · ')[0]})`, bonus: t.bonus! });
    }
  return out;
}

/**
 * What one hit from this enemy deals this round, after enrage, War Drum, encounter bonuses (Pack
 * Tactics, the hoard), the Chieftain and curses; for a Wraith, the drain each hero takes.
 */
export function enemyDamage(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  const own = behaviorHandler(behaviorFor(state, e, rules))?.damage;
  if (own) return own(state, e, rules);
  let rage = (e.enraged ? rules.combat.warlordEnrage.damageBonus : 0) + commandBonus(state, e, rules) + (e.hotStacks ?? 0);
  for (const m of mechanicsFor(state, rules)) if (m.damageBonus) rage += m.damageBonus(state, e, rules);
  const drum = e.drum && e.drum.round === state.round ? e.drum.amount : 0;
  const weaken = e.weaken && e.weaken.rounds > 0 ? e.weaken.amount : 0;
  return Math.max(0, e.damage + rage + drum - weaken);
}

/** The champion's every-few-rounds special move in this encounter, if it has one. */
export function specialOf(e: EnemyState, encounter?: string, rules: Rules = defaultRules): SpecialInfo | null {
  return specialFor(e.kind, encounter, rules);
}

/**
 * True when the enemy's special lands in the given round. Each champion runs
 * on its own clock: its Nth round on the field, then every N rounds, so the
 * warning can always show a round ahead.
 */
export function specialDue(e: EnemyState, round: number, rules: Rules = defaultRules): boolean {
  const n = rules.combat.specialEveryNRounds;
  const firstActs = (e.arrivedRound ?? 0) + 1;
  return round >= firstActs && (round - firstActs) % n === n - 1;
}

/**
 * The damage an action would deal right now, for its tile: "7", "8×3" for
 * multi-target, "2×6" for multi-hit, or null if it deals no damage. Includes
 * the hero's gear and any pending crit, Empower or curse.
 */
export function actionDamage(def: ActionDef, hero: HeroState): string | null {
  for (const e of def.effects) {
    if (e.type === 'damage') {
      const hit = heroHitAmount(hero, (e.amount === 'gear' ? hero.gear : e.amount) + (e.bonus ?? 0) + armoryDamage(hero, def, defaultRules));
      return def.target.type === 'enemies' ? `${hit}×${def.target.count}` : `${hit}`;
    }
    if (e.type === 'gearAttack') return `${e.times}×${heroHitAmount(hero, hero.gear)}`;
  }
  return null;
}

// ---------- Armory (progression) ----------

export const hasFeat = (h: HeroState, id: string) => !!h.progress?.feats.includes(id);

/** Armor every round from the shield's upgrade levels and armor gear. */
function armoryArmor(h: HeroState, rules: Rules): number {
  const prog = h.progress;
  if (!prog) return 0;
  const shield = h.heroClass === 'warrior' ? prog.shield * rules.progression.shield.armorPerLevel : 0;
  return shield + prog.gear.reduce((t, id) => t + (rules.progression.gear[id]?.armorPerRound ?? 0), 0);
}

/** Energy an action costs this hero now: Quiver of Plenty and Arcane Surge make some cheaper. */
export function actionCost(state: BattleState, hero: HeroState, def: ActionDef, rules: Rules = defaultRules): number | undefined {
  if (def.cost === undefined) return undefined;
  let cost = def.cost;
  for (const id of hero.progress?.gear ?? []) {
    const r = rules.progression.gear[id]?.costReduction;
    if (r && r.action === def.id) cost -= r.amount;
  }
  if (hasFeat(hero, 'arcane-surge') && def.tags?.includes('spell') && hero.lastSpellRound !== state.round) cost -= 1;
  return Math.max(0, cost);
}

/** Flat damage the Armory adds to every hit of an action: Focus Crystal and Evocation on spells. */
function armoryDamage(hero: HeroState, def: ActionDef, rules: Rules): number {
  if (!def.tags?.includes('spell')) return 0;
  const crystal = (hero.progress?.gear ?? []).reduce((t, id) => t + (rules.progression.gear[id]?.spellDamage ?? 0), 0);
  const multi = def.target.type === 'enemies' || def.target.type === 'allEnemies';
  return crystal + (multi && hasFeat(hero, 'evocation') ? 1 : 0);
}

/** Damage that depends on the target: Smite against undead and dragonkin, Opportunist against helpless foes. */
function featDamageVs(state: BattleState, hero: HeroState, e: EnemyState, rules: Rules): number {
  let bonus = 0;
  if (hero.heroClass === 'cleric' && hasFeat(hero, 'smite')) {
    if (mechanicsFor(state, rules).some((m) => m.smiteVulnerable?.(state, e, rules))) bonus += 3;
  }
  if (hero.heroClass === 'rogue' && hasFeat(hero, 'opportunist') && (e.toppled || e.tauntedBy || (e.weaken && e.weaken.rounds > 0))) bonus += 3;
  return bonus;
}

function heroHitAmount(hero: HeroState, base: number): number {
  const curse = hero.curse && hero.curse.rounds > 0 ? hero.curse.amount : 0;
  return Math.max(0, Math.floor(base * hero.nextAttackMultiplier) - curse);
}

/** The party can spend one of this enemy's Fumbles: it has one left and none is pending. */
export function canFumble(state: BattleState, e: EnemyState): boolean {
  return state.phase === 'party' && e.alive && (e.fumbles ?? 0) > 0 && !e.fumbled;
}

/** Spends a Fumble: the enemy loses its next action (a special due then doesn't fire). Free for the party. */
export function spendFumble(prev: BattleState, enemyId: string): BattleState {
  const state = clone(prev);
  const e = state.enemies.find((x) => x.id === enemyId);
  if (!e || !canFumble(state, e)) throw new Error(`Can't fumble ${enemyId}`);
  e.fumbles--;
  e.fumbled = true;
  log(state, 'hero', `${e.name} fumbles: it will lose its next action.`, undefined, [e.id]);
  return state;
}

export function performAction(prev: BattleState, action: HeroAction, rules: Rules = defaultRules): BattleState {
  const state = clone(prev);
  const hero = state.heroes.find((h) => h.id === action.heroId);
  if (!hero) throw new Error(`No hero ${action.heroId}`);
  const option = listActions(state, hero.id, rules).find((o) => o.def.id === action.actionId);
  if (!option) throw new Error(`Unknown action ${action.actionId}`);
  if (!option.available) throw new Error(`${option.def.name} unavailable: ${option.reason}`);

  const def = option.def;
  const spec = def.target;
  let targets: string[];
  if (spec.type === 'allEnemies' || spec.type === 'allAllies' || spec.type === 'allFallen') targets = option.validTargets;
  else if (spec.type === 'self') targets = [hero.id];
  else if (spec.type === 'none') targets = [];
  else {
    const max = spec.type === 'enemies' ? spec.count : 1;
    targets = [...new Set(action.targetIds)];
    if (targets.length < 1 || targets.length > max) throw new Error(`${def.name} needs ${max === 1 ? '1 target' : `1–${max} targets`}`);
    for (const t of targets) if (!option.validTargets.includes(t)) throw new Error(`Invalid target ${t}`);
  }

  hero.pool -= option.cost ?? 0;
  if (def.tags?.includes('spell')) hero.lastSpellRound = state.round;
  if (def.oncePerBattle) hero.usedOnce = [...(hero.usedOnce ?? []), def.id];
  if (def.unlock === 'signature') {
    hero.signatureReady = false;
    state.stats.signaturesUsed++;
  }
  if (def.unlock === 'legendary') hero.legendaryReady = false;
  if (isAttack(def)) hero.acted = true;

  const parts: string[] = [];
  let attacked = false;
  for (const effect of def.effects) {
    attacked = applyEffect(state, hero, effect, targets, parts, rules, def) || attacked;
  }
  // Ready Crit / Empower / Shadowstep are consumed by the next attack, not the one that grants them.
  if (attacked && !def.effects.some((e) => e.type === 'nextAttackMultiplier')) {
    hero.nextAttackMultiplier = 1;
    hero.attackBuffs = {};
  }

  const heroName = rules.classes[hero.heroClass].name;
  log(state, 'hero', `${heroName} uses ${def.name}${parts.length ? `: ${parts.join('; ')}` : ''}.`, hero.id, targets);
  afterDamage(state);
  return state;
}

function nameOf(state: BattleState, id: string, rules: Rules): string {
  const u = findUnit(state, id);
  if (!u) return id;
  if ('heroClass' in u) return rules.classes[u.heroClass].name;
  return u.name;
}

function applyEffect(
  state: BattleState,
  hero: HeroState,
  effect: Effect,
  targets: string[],
  parts: string[],
  rules: Rules,
  def: ActionDef,
): boolean {
  const defId = def.id;
  const source = damageSource(hero, def);
  // Amulet of Healing adds to every heal; Blessed Ward also gives the healed ally armor this round.
  const heal = (h: HeroState) => {
    if (effect.type !== 'heal') return;
    const bonus = (hero.progress?.gear ?? []).reduce((t, g) => t + (rules.progression.gear[g]?.healBonus ?? 0), 0);
    const healed = Math.min(effect.amount + bonus, h.maxHp - h.hp);
    h.hp += healed;
    let text = `${nameOf(state, h.id, rules)} +${healed} HP`;
    if (hasFeat(hero, 'blessed-ward') && !(h.buffs ?? []).includes('blessed-ward')) {
      h.armor += 2;
      h.buffs = [...(h.buffs ?? []), 'blessed-ward'];
      text += ', +2 armor';
    }
    parts.push(text);
  };
  const endText = (e: EnemyState) => (e.alive ? '' : e.pile ? ' (falls, will reassemble)' : ' (defeated)');
  switch (effect.type) {
    case 'damage': {
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        // Intangible foes: weapons pass through; spells and holy attacks make them solid and still hit.
        let solidified = false;
        if (e.intangible) {
          if (!touchesIntangible(hero, def)) {
            parts.push(`passes through ${e.name}`);
            continue;
          }
          e.intangible = false;
          solidified = true;
        }
        let base = (effect.amount === 'gear' ? hero.gear : effect.amount) + (effect.bonus ?? 0) + armoryDamage(hero, def, rules) + featDamageVs(state, hero, e, rules);
        if (effect.doubleIfTauntedByOther && e.tauntedBy && e.tauntedBy !== hero.id) base *= 2;
        const amount = heroHitAmount(hero, base);
        const dealt = damageEnemy(state, e, amount, !!effect.pierce, rules, source);
        parts.push(`${dealt} to ${e.name}${solidified ? ' (now solid)' : ''}${endText(e)}`);
        for (const m of mechanicsFor(state, rules)) m.afterHeroStrike?.(state, hero, e, def, parts, rules);
        // Cleave: the Axe also hits a second enemy for half.
        if (def.id === 'axe' && hasFeat(hero, 'cleave')) {
          const second = pickableEnemies(state, rules).filter((x) => x.id !== e.id).sort((a, b) => a.hp - b.hp)[0];
          if (second) {
            const cleft = damageEnemy(state, second, Math.floor(amount / 2), false, rules, source);
            parts.push(`cleaves ${cleft} into ${second.name}${endText(second)}`);
          }
        }
      }
      return true;
    }
    case 'gearAttack': {
      const gearDef = rules.classes[hero.heroClass].gear[0];
      const gearEffect = gearDef.effects.find((x) => x.type === 'damage');
      const gearBase = gearEffect && gearEffect.type === 'damage' && gearEffect.amount !== 'gear' ? gearEffect.amount : hero.gear;
      for (let i = 0; i < effect.times; i++) {
        // Hits cycle through the chosen targets; if one has fallen, the hit goes to the weakest enemy left.
        let e = state.enemies.find((x) => x.id === targets[i % targets.length] && x.alive);
        if (!e || e.intangible) e = [...pickableEnemies(state, rules)].sort((a, b) => a.hp - b.hp)[0];
        if (!e) break;
        const dealt = damageEnemy(state, e, heroHitAmount(hero, gearBase + featDamageVs(state, hero, e, rules)), false, rules, source);
        parts.push(`${dealt} to ${e.name}${endText(e)}`);
        for (const m of mechanicsFor(state, rules)) m.afterHeroStrike?.(state, hero, e, def, parts, rules);
      }
      return true;
    }
    case 'poison':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        const rounds = effect.rounds + (hero.progress?.gear ?? []).reduce((t, g) => t + (rules.progression.gear[g]?.poisonRounds ?? 0), 0);
        e.poison = { perRound: Math.max(effect.perRound, e.poison?.perRound ?? 0), rounds: Math.max(rounds, e.poison?.rounds ?? 0) };
        parts.push(`${e.name} poisoned`);
      }
      return false;
    case 'nextAttackMultiplier':
      for (const id of targets) {
        const h = state.heroes.find((x) => x.id === id);
        if (!h) continue;
        // The same ability refreshes rather than stacks; different ones (Ready Crit + Empower) combine.
        h.attackBuffs = { ...(h.attackBuffs ?? {}), [defId]: effect.multiplier };
        h.nextAttackMultiplier = Object.values(h.attackBuffs).reduce((m, x) => m * x, 1);
      }
      parts.push(`next attack ×${effect.multiplier}`);
      return false;
    case 'untargetable':
      hero.untargetableRounds = Math.max(hero.untargetableRounds, effect.rounds);
      parts.push('untargetable');
      return false;
    case 'heal':
      if (effect.on === 'mostInjuredAlly') {
        const h = state.heroes
          .filter((x) => x.alive && x.hp < x.maxHp)
          .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
        if (h) heal(h);
        return false;
      }
      for (const id of targets) {
        const h = state.heroes.find((x) => x.id === id);
        if (h && h.alive) heal(h);
      }
      return false;
    case 'revive':
      for (const id of targets) {
        const h = state.heroes.find((x) => x.id === id);
        if (!h || h.alive) continue;
        h.alive = true;
        h.hp = Math.max(1, Math.ceil(h.maxHp * effect.fraction));
        parts.push(`${nameOf(state, id, rules)} revived at ${h.hp} HP`);
      }
      return false;
    case 'armor': {
      const ids = effect.on === 'self' ? [hero.id] : targets;
      for (const id of ids) {
        const h = state.heroes.find((x) => x.id === id);
        if (!h || !h.alive || (h.buffs ?? []).includes(defId)) continue;
        h.armor += effect.amount;
        h.buffs = [...(h.buffs ?? []), defId];
      }
      parts.push(`+${effect.amount} armor${ids.length > 1 ? ' to all allies' : ''}`);
      return false;
    }
    case 'taunt': {
      const taunted: string[] = [];
      const immune: string[] = [];
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        if (ignoresTaunt(e, rules)) immune.push(e.name);
        else {
          e.tauntedBy = hero.id;
          taunted.push(e.name);
        }
      }
      if (taunted.length) parts.push(`taunts ${taunted.length > 1 ? `${taunted.length} enemies` : taunted[0]}`);
      if (immune.length) parts.push(`${immune.join(', ')} ignore${immune.length > 1 ? '' : 's'} the taunt`);
      return false;
    }
    case 'weaken':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (e && e.alive) e.weaken = { amount: effect.amount, rounds: effect.rounds };
      }
      parts.push(`${nameOf(state, targets[0], rules)} deals −${effect.amount} for ${effect.rounds} rounds`);
      return false;
    case 'summon':
      for (let i = 0; i < effect.count; i++) {
        const d = rules.summons[effect.unit];
        state.summons.push({
          id: `s${state.nextSummonId++}`,
          kind: effect.unit,
          name: d.name,
          hp: d.hp,
          maxHp: d.hp,
          damage: d.damage,
          tauntsPerRound: d.tauntsPerRound,
          alive: true,
        });
      }
      parts.push(`summons ${effect.count > 1 ? `${effect.count} ` : 'a '}${rules.summons[effect.unit].name}${effect.count > 1 ? 's' : ''}`);
      return false;
    case 'instakill':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive || e.isWarlord) continue;
        e.hp = 0;
        e.alive = false;
        parts.push(`${e.name} defeated`);
      }
      return false;
    case 'gainEnergy': {
      const gain = effect.amount + (def.id === 'longbow' && hasFeat(hero, 'quick-draw') ? 1 : 0);
      hero.pool += gain;
      parts.push(`+${gain} energy`);
      return false;
    }
    case 'mark':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        e.mark = { round: state.round, amount: effect.amount };
        parts.push(`${e.name} marked: +${effect.amount} from every hit this round`);
      }
      return false;
    case 'lastStand':
      hero.lastStand = true;
      parts.push('cannot drop below 1 HP');
      return false;
  }
}

/** Credits cleared waves, brings in the next wave if the field is empty, and checks for victory. */
function afterDamage(state: BattleState) {
  if (state.phase !== 'party') return;
  const cleared = (state.clearedWaves ??= []);
  for (;;) {
    for (let w = 0; w <= state.waveIndex; w++) {
      if (cleared.includes(w) || state.enemies.some((e) => e.wave === w && (e.alive || e.pile))) continue;
      cleared.push(w);
      state.stats.wavesCleared++;
      log(state, 'system', `Wave ${w + 1} cleared!`);
    }
    if (!fieldEmpty(state)) return;
    if (state.pendingWaves.length === 0) {
      state.phase = 'won';
      state.outcomeReason = 'The horde is defeated.';
      log(state, 'system', 'Victory! The horde is defeated.');
    }
    // Otherwise the field is clear and the next wave arrives at the start of next round.
    return;
  }
}

// ---------- Summons and enemy phase ----------

const HERO_ORDER: HeroClass[] = [...CLASSES];

export type Target = { kind: 'hero'; unit: HeroState } | { kind: 'summon'; unit: SummonState };

function targetable(state: BattleState): Target[] {
  const heroes: Target[] = state.heroes
    .filter((h) => h.alive && h.untargetableRounds <= 0)
    .sort((a, b) => HERO_ORDER.indexOf(a.heroClass) - HERO_ORDER.indexOf(b.heroClass))
    .map((h) => ({ kind: 'hero', unit: h }));
  const summons: Target[] = state.summons.filter((s) => s.alive).map((s) => ({ kind: 'summon', unit: s }));
  return [...heroes, ...summons];
}

export function lowestHp(list: Target[]): Target | undefined {
  return list.reduce<Target | undefined>((best, t) => (!best || t.unit.hp < best.unit.hp ? t : best), undefined);
}

export function chooseEnemyTarget(state: BattleState, enemy: EnemyState, rules: Rules = defaultRules): Target | undefined {
  const all = targetable(state);
  if (all.length === 0) return undefined;
  const heroes = all.filter((t) => t.kind === 'hero');
  const behavior = behaviorFor(state, enemy, rules);

  if (!ignoresTaunt(enemy, rules) && enemy.tauntedBy) {
    const taunter = all.find((t) => t.unit.id === enemy.tauntedBy);
    if (taunter) return taunter;
  }
  const own = behaviorHandler(behavior)?.target?.(state, enemy, all, heroes, rules);
  if (own) return own;
  const warrior = heroes.find((t) => t.kind === 'hero' && t.unit.heroClass === 'warrior');
  if (warrior) return warrior;
  const pool = rules.combat.summonsAppearInLowestHpTargeting ? all : heroes.length ? heroes : all;
  return lowestHp(pool);
}

interface Hit {
  text: string;
  /** Short target label with damage, e.g. "Warrior 20". */
  short: string;
}

export function hitHero(state: BattleState, enemy: EnemyState, h: HeroState, raw: number, rules: Rules, ignoreArmor = false): Hit {
  // Shadow Cloak: the first enemy hit on the Rogue each battle misses.
  if (raw > 0 && !h.cloakUsed && h.progress?.gear.includes('shadow-cloak')) {
    h.cloakUsed = true;
    const name = rules.classes[h.heroClass].name;
    return { text: `misses the ${name} (Shadow Cloak)`, short: `${name} miss` };
  }
  const dealt = Math.max(0, raw - (ignoreArmor || hasTrait(enemy, 'deepRange') ? 0 : h.armor));
  h.hp -= dealt;
  if (dealt > 0) (state.pendingHits ??= {})[h.id] = (state.pendingHits[h.id] ?? 0) + dealt;
  if (h.lastStand && h.hp < 1) h.hp = 1;
  if (!h.attackedByThisRound.includes(enemy.id)) h.attackedByThisRound.push(enemy.id);
  let text = `${dealt} to ${rules.classes[h.heroClass].name}`;
  text += behaviorHandler(behaviorFor(state, enemy, rules))?.onHit?.(state, enemy, h, rules) ?? '';
  if (hasTrait(enemy, 'pickpocket')) {
    const stolen = Math.min(h.pool, rules.traits.pickpocket.energy!);
    h.pool -= stolen;
    if (stolen) text += `, steals ${stolen} energy`;
  }
  for (const m of mechanicsFor(state, rules)) if (m.onHeroHit) text += m.onHeroHit(state, enemy, h, dealt, rules);
  if (h.hp <= 0) {
    h.hp = 0;
    h.alive = false;
    state.stats.anyHeroFell = true;
    text += ` — ${rules.classes[h.heroClass].name} falls`;
  }
  return { text, short: `${rules.classes[h.heroClass].name} ${dealt}${h.alive ? '' : ' 💀'}` };
}

export function hitTarget(state: BattleState, enemy: EnemyState, target: Target, rules: Rules, raw = enemyDamage(state, enemy, rules)): Hit {
  if (target.kind === 'summon') {
    const s = target.unit;
    s.hp = Math.max(0, s.hp - raw);
    if (s.hp === 0) s.alive = false;
    return { text: `${raw} to ${s.name}${s.alive ? '' : ' (defeated)'}`, short: `${s.name} ${raw}` };
  }
  // Intercept: once per round the Warrior steps in front of an attack on an ally below 25% HP.
  const ally = target.unit;
  const warrior = state.heroes.find((h) => h.heroClass === 'warrior' && h.alive && h.untargetableRounds <= 0 && hasFeat(h, 'intercept'));
  if (warrior && ally !== warrior && ally.hp < ally.maxHp * 0.25 && warrior.interceptRound !== state.round) {
    warrior.interceptRound = state.round;
    const hit = hitHero(state, enemy, warrior, raw, rules);
    return { text: `${hit.text} (the Warrior intercepts the blow meant for the ${rules.classes[ally.heroClass].name})`, short: hit.short };
  }
  return hitHero(state, enemy, target.unit, raw, rules);
}

export function targetableHeroes(state: BattleState): HeroState[] {
  return state.heroes
    .filter((h) => h.alive && h.untargetableRounds <= 0)
    .sort((a, b) => HERO_ORDER.indexOf(a.heroClass) - HERO_ORDER.indexOf(b.heroClass));
}

/** Champion specials on the every-Nth-round beat (see SpecialHandler). Returns true if the special replaced the action. */
function doSpecial(state: BattleState, enemy: EnemyState, rules: Rules): boolean {
  const run = specialHandler(activeSpecial(state, enemy, rules)?.key)?.run;
  return !!run && run(state, enemy, enemyDamage(state, enemy, rules), rules);
}

function enemyAct(state: BattleState, enemy: EnemyState, actionNumber: number, rules: Rules) {
  const behavior = behaviorHandler(behaviorFor(state, enemy, rules));
  if (!enemy.alive || behavior?.idle) return;
  if (enemy.fumbled) {
    enemy.fumbled = false;
    log(state, 'enemy', `${enemy.name} fumbles and loses its action.`, enemy.id, undefined, '💫 Fumbles');
    return;
  }
  if (actionNumber === 0 && specialDue(enemy, state.round, rules) && doSpecial(state, enemy, rules)) return;
  if (behavior?.act?.(state, enemy, rules)) return;
  const target = chooseEnemyTarget(state, enemy, rules);
  if (!target) {
    log(state, 'enemy', `${enemy.name} finds no target.`, enemy.id, undefined, 'No target');
    return;
  }
  const hit = hitTarget(state, enemy, target, rules);
  log(state, 'enemy', `${enemy.name} attacks: ${hit.text}.`, enemy.id, [target.unit.id], `→ ${hit.short}`);
}

/** "Necromancer · CJ McCollum" → "Necromancer"; minions keep their team tag. */
const foeLabel = (e: EnemyState) => e.name.split(' · ')[0];

function summonsAct(state: BattleState) {
  for (const s of state.summons) {
    if (!s.alive || state.phase !== 'party') continue;
    for (let i = 0; i < s.tauntsPerRound; i++) {
      const pick = awake(state)
        .filter((e) => !e.tauntedBy && !ignoresTaunt(e))
        .sort((a, b) => b.damage - a.damage)[0];
      if (pick) {
        pick.tauntedBy = s.id;
        log(state, 'summon', `${s.name} taunts ${pick.name}.`, s.id, [pick.id], `⚑ ${foeLabel(pick)}`);
      }
    }
    const target = [...pickableEnemies(state)].sort((a, b) => a.hp - b.hp)[0];
    if (!target) continue;
    const dealt = damageEnemy(state, target, s.damage, false);
    log(state, 'summon', `${s.name} bites ${target.name} for ${dealt}${target.alive ? '' : ' (defeated)'}.`, s.id, [target.id], `→ ${foeLabel(target)} ${dealt}`);
    afterDamage(state);
  }
}

/** Ends the party phase: summons act, then the horde, then the round wraps up. */
export function endRound(prev: BattleState, rules: Rules = defaultRules): BattleState {
  const state = clone(prev);
  if (state.phase !== 'party') return state;

  // Hero-side durations count party phases.
  for (const h of state.heroes) {
    if (h.curse) {
      h.curse.rounds--;
      if (h.curse.rounds <= 0) h.curse = null;
    }
  }

  summonsAct(state);
  if (state.phase !== 'party') return state;

  // Enemy phase: poison ticks first.
  for (const e of livingEnemies(state)) {
    if (!e.poison) continue;
    const dealt = damageEnemy(state, e, e.poison.perRound, true);
    log(state, 'enemy', `Poison deals ${dealt} to ${e.name}${e.alive ? '' : ' (defeated)'}.`, undefined, [e.id]);
    e.poison.rounds--;
    if (e.poison.rounds <= 0) e.poison = null;
  }
  afterDamage(state);
  if (state.phase !== 'party') return state;

  // A special that acts first (the Shaman's War Drum) goes before the rest so the whole horde hits with it this round.
  const first = (e: EnemyState) => !!specialHandler(specialOf(e, state.encounter, rules)?.key)?.actsFirst && specialDue(e, state.round, rules);
  const order = [...awake(state)].sort((a, b) => Number(first(b)) - Number(first(a)));
  const mechanics = mechanicsFor(state, rules);
  for (const enemy of order) {
    if (justArrived(state, enemy)) continue;
    if (mechanics.some((m) => m.skipsTurn?.(state, enemy, rules))) continue;
    for (let a = 0; a < actionsThisRound(enemy); a++) enemyAct(state, enemy, a, rules);
  }

  // Poison on heroes ticks once the horde has acted.
  for (const h of state.heroes) {
    if (!h.alive || !h.poison) continue;
    const p = h.poison;
    const dealt = Math.min(p.perRound, h.hp - (h.lastStand ? 1 : 0));
    h.hp -= Math.max(0, dealt);
    if (dealt > 0) (state.pendingHits ??= {})[h.id] = dealt;
    const name = rules.classes[h.heroClass].name;
    if (h.hp <= 0) {
      h.hp = 0;
      h.alive = false;
      state.stats.anyHeroFell = true;
    }
    log(state, 'enemy', `☣ Poison deals ${dealt} to the ${name}${h.alive ? '' : ` — ${name} falls`}.`, p.sourceId, [h.id], `☣ ${name} ${dealt}${h.alive ? '' : ' 💀'}`);
    h.poison = --p.rounds > 0 && h.alive ? p : null;
  }

  if (state.heroes.every((h) => !h.alive)) {
    state.phase = 'lost';
    state.outcomeReason = 'Every hero has fallen.';
    log(state, 'system', 'Defeat. Every hero has fallen.');
    return state;
  }

  // Round end: encounter rules (the Dragon wakes or the hoard grows, trolls regenerate), then durations tick down.
  for (const m of mechanics) m.onRoundEnd?.(state, rules);
  const hot = rules.traits.hotHand;
  for (const e of state.enemies) {
    if (e.alive && hasTrait(e, 'hotHand') && e.hitRound !== state.round) e.hotStacks = Math.min(hot.max!, (e.hotStacks ?? 0) + hot.bonus!);
    e.tauntedBy = null;
    if (e.weaken && --e.weaken.rounds <= 0) e.weaken = null;
    if (e.shield && --e.shield.rounds <= 0) e.shield = null;
    if (e.drum && e.drum.round <= state.round) e.drum = null;
  }
  for (const h of state.heroes) {
    if (h.untargetableRounds > 0) h.untargetableRounds--;
    h.attackedByLastRound = h.attackedByThisRound;
    h.attackedByThisRound = [];
  }
  if (state.round >= rules.combat.roundCap) {
    state.phase = 'lost';
    state.outcomeReason = `The horde survived ${rules.combat.roundCap} rounds.`;
    log(state, 'system', `Defeat. The horde holds out past round ${rules.combat.roundCap}.`);
    return state;
  }
  state.round++;
  startRound(state, rules);
  return state;
}

/** What the horde would do if the party phase ended right now. */
export function previewEnemyPhase(state: BattleState, rules: Rules = defaultRules): LogEntry[] {
  return previewRound(state, rules).log;
}

/** What ending the round now would do: this round's summon and enemy actions, and the state after. */
export function previewRound(state: BattleState, rules: Rules = defaultRules): { log: LogEntry[]; after: BattleState } {
  if (state.phase !== 'party') return { log: [], after: state };
  const after = endRound(state, rules);
  return { log: after.log.slice(state.log.length).filter((l) => l.round === state.round && l.side !== 'system'), after };
}

export function heroesReadyToAct(state: BattleState): HeroState[] {
  return state.heroes.filter((h) => h.alive && !h.acted && !h.prone);
}

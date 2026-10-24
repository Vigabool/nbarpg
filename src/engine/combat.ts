import { CLASSES, rules as defaultRules, type ActionDef, type Effect, type HeroClass, type Rules, type SummonKind } from '../rules';
import { behaviorOf, encounterOf, hasTwist, isGoblinKin, monsterIcon, monsterName, specialFor, type SpecialInfo } from './encounter';
import type { MonsterSpec } from './horde';
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
  signatureUnlocked: boolean;
  legendaryUnlocked: boolean;
  signatureReady: boolean;
  legendaryReady: boolean;
  attackedByThisRound: string[];
  attackedByLastRound: string[];
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
  staggers: number;
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
}

const clone = <T>(v: T): T => structuredClone(v);

function makeEnemy(spec: MonsterSpec, arrivedRound: number, wave: number): EnemyState {
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
    staggers: spec.staggers,
    alive: true,
    shield: null,
    poison: null,
    weaken: null,
    tauntedBy: null,
    spec,
  };
}

export function createBattle(heroes: HeroSetup[], waves: MonsterSpec[][], rules: Rules = defaultRules, encounter?: string): BattleState {
  const ordered = [...heroes].sort((a, b) => CLASSES.indexOf(a.heroClass) - CLASSES.indexOf(b.heroClass));
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
    })),
    summons: [],
    enemies: waves[0].map((m) => makeEnemy(m, 0, 0)),
    clearedWaves: [],
    encounter,
    log: [],
    nextSummonId: 1,
    stats: { wavesCleared: 0, warlordDefeated: false, anyHeroFell: false, signaturesUsed: 0 },
  };
  for (const e of state.enemies) initEnemy(state, e, rules);
  log(state, 'system', `Wave 1 of ${waves.length}: ${describeWave(state.enemies, state.encounter, rules)}`);
  startRound(state, rules);
  return state;
}

function describeWave(enemies: EnemyState[], encounter: string | undefined, rules: Rules): string {
  const minions = enemies.filter((e) => e.kind === 'goblin');
  const named = enemies.filter((e) => e.kind !== 'goblin').map((e) => e.name);
  const n = minions.length;
  return [n ? `${n} ${monsterName('goblin', encounter, rules).toLowerCase()}${n > 1 ? 's' : ''}` : '', ...named].filter(Boolean).join(', ');
}

function log(state: BattleState, side: LogEntry['side'], text: string, actorId?: string, targetIds?: string[], short?: string) {
  const hits = state.pendingHits;
  delete state.pendingHits;
  state.log.push({ round: state.round, side, text, actorId, targetIds, short, ...(hits && { hits }) });
}

/** The behavior an enemy uses in this battle's encounter. */
const behaviorFor = (state: BattleState, e: EnemyState, rules: Rules = defaultRules) => behaviorOf(e.kind, state.encounter, rules);

/** Damage kinds that matter to the Crypt: fire and holy destroy skeletons for good. */
interface DamageSource {
  fire?: boolean;
  holy?: boolean;
}

/** Spells and Cleric (holy) attacks can touch intangible enemies; all Cleric damage is holy. */
function touchesIntangible(hero: HeroState, def: ActionDef): boolean {
  return hero.heroClass === 'cleric' || !!def.tags?.includes('spell');
}

function damageSource(hero: HeroState, def: ActionDef): DamageSource {
  return { fire: !!def.tags?.includes('fire'), holy: hero.heroClass === 'cleric' };
}

/** Sets per-encounter starting state (the Wraith starts intangible). */
function initEnemy(state: BattleState, e: EnemyState, rules: Rules) {
  if (behaviorFor(state, e, rules) === 'wraith') e.intangible = true;
}

/** No living enemies and no bone piles about to rise. */
function fieldEmpty(state: BattleState): boolean {
  return !state.enemies.some((e) => e.alive || e.pile);
}

/** "Ogre · Anthony Davis" → "Ogre". */
const shortName = (name: string) => name.split(' · ')[0];

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
}

/** Each time a skeleton reassembles it comes back with half its last HP: 8, 4, 2. */
function riseHp(e: EnemyState): number {
  return Math.floor(e.maxHp / 2 ** ((e.rises ?? 0) + 1));
}

function startRound(state: BattleState, rules: Rules) {
  if (state.round > 1) log(state, 'system', `Round ${state.round} begins. Every hero can act again.`);
  // Restless Dead: bone piles reassemble at half HP and fight this round.
  const rising = state.enemies.filter((e) => e.pile);
  for (const e of rising) {
    e.pile = false;
    e.alive = true;
    e.hp = riseHp(e);
    e.rises = (e.rises ?? 0) + 1;
    e.arrivedRound = state.round - 1;
    e.poison = null;
    e.weaken = null;
  }
  if (rising.length) log(state, 'system', `🦴 ${rising.length} ${rising.length > 1 ? 'skeletons reassemble' : 'skeleton reassembles'}.`, undefined, rising.map((e) => e.id));
  // Waves on the clock arrive at the start of their round, before the party acts, and fight this round.
  // An empty field also brings the next wave in now.
  while (state.pendingWaves.length > 0) {
    const clock = waveArrivalRound(state.waveIndex + 1, rules);
    if (livingEnemies(state).length > 0 && (clock === null || state.round < clock)) break;
    spawnNextWave(state, state.round - 1, rules);
  }
  for (const h of state.heroes) {
    h.armor = 0;
    h.buffs = [];
    if (!h.alive) continue;
    for (const p of rules.classes[h.heroClass].passives) if (p.type === 'armorPerRound') h.armor += p.amount;
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

/** Guarded by the Pack: can't be targeted while enough goblins are alive. */
export function isGuarded(state: BattleState, e: EnemyState, rules: Rules = defaultRules): boolean {
  // The Phylactery hides behind any skeleton still standing.
  if (behaviorFor(state, e, rules) === 'phylactery') return state.enemies.some((x) => x.alive && x.kind === 'goblin');
  const g = rules.combat.packGuard;
  if (!hasTwist('packGuard', state.encounter, rules)) return false;
  if (!g.guarded.includes(behaviorFor(state, e, rules))) return false;
  return state.enemies.filter((x) => x.alive && x.kind === 'goblin').length >= g.minGoblins;
}

/** Enemies that weapon attacks and summons can pick: not guarded, not intangible. */
export function pickableEnemies(state: BattleState, rules: Rules = defaultRules): EnemyState[] {
  return livingEnemies(state).filter((e) => !isGuarded(state, e, rules) && !e.intangible);
}

/** Enemies a given action can aim at; spells and Cleric attacks also reach intangible ones. */
function aimable(state: BattleState, hero: HeroState, def: ActionDef, rules: Rules): EnemyState[] {
  return livingEnemies(state).filter((e) => !isGuarded(state, e, rules) && (!e.intangible || touchesIntangible(hero, def)));
}

export function ignoresTaunt(e: EnemyState, rules: Rules = defaultRules): boolean {
  return !!rules.monsters[e.kind].ignoresTaunt;
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
      return livingEnemies(state).map((e) => e.id);
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
  const blockedFor = (def: ActionDef) => over ?? (isAttack(def) && hero.acted ? 'Already attacked this round' : undefined);
  for (const def of cls.gear) {
    const targets = validTargets(state, hero, def, rules);
    let reason = blockedFor(def);
    if (!reason && targets.length === 0)
      reason = def.target.type === 'enemy' && def.target.attackedSelfLastRound ? 'No enemy attacked you last round' : 'No targets';
    if (!reason && def.cost !== undefined && def.cost > hero.pool) reason = `Needs ${def.cost} energy`;
    opts.push({
      def,
      source: 'gear',
      attack: isAttack(def),
      available: !reason,
      reason,
      validTargets: targets,
    });
  }
  for (const def of cls.abilities) {
    const targets = validTargets(state, hero, def, rules);
    let reason = blockedFor(def);
    if (!reason && def.unlock === 'signature' && !hero.signatureReady)
      reason = hero.signatureUnlocked ? 'Already used' : 'Needs a double-double';
    if (!reason && def.unlock === 'legendary' && !hero.legendaryReady)
      reason = hero.legendaryUnlocked ? 'Already used' : 'Needs a triple-double';
    if (!reason && alreadyActive(def, hero)) reason = 'Already active this round';
    if (!reason && def.cost !== undefined && def.cost > hero.pool) reason = `Needs ${def.cost} energy`;
    if (!reason && def.target.type !== 'none' && targets.length === 0) reason = 'No valid targets';
    opts.push({ def, source: 'ability', attack: isAttack(def), available: !reason, reason, validTargets: targets });
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
  // Phylactery: the Lich takes reduced damage while its soul is safe.
  if (behaviorFor(state, enemy, rules) === 'lich' && phylactery(state, rules)) amount *= rules.combat.phylactery.damageTaken;
  const dealt = Math.max(0, Math.floor(amount) - (pierce ? 0 : enemyArmor(enemy)));
  enemy.hp = Math.max(0, enemy.hp - dealt);
  if (enemy.hp === 0 && enemy.alive) {
    enemy.alive = false;
    if (enemy.isWarlord) state.stats.warlordDefeated = true;
    // Restless Dead: skeletons leave a bone pile, halving each time, unless fire or holy damage ended them.
    if (enemy.kind === 'goblin' && hasTwist('restlessDead', state.encounter, rules)) {
      if (source.fire || source.holy) enemy.destroyed = true;
      else if (riseHp(enemy) >= rules.combat.restlessDead.minHp) enemy.pile = true;
    }
    const behavior = behaviorFor(state, enemy, rules);
    if (behavior === 'lich') {
      const p = phylactery(state, rules);
      if (p) {
        p.alive = false;
        p.hp = 0;
        log(state, 'system', `With the Lich gone, ${p.name} shatters.`, p.id);
      }
    }
    if (behavior === 'phylactery') log(state, 'system', `${enemy.name} shatters: the Lich takes full damage now!`, enemy.id);
  }
  const rage = rules.combat.warlordEnrage;
  if (enemy.isWarlord && enemy.alive && !enemy.enraged && enemy.hp <= enemy.maxHp * rage.atHpFraction) {
    enemy.enraged = true;
    log(state, 'system', `${enemy.name} is enraged: +${rage.damageBonus} damage for the rest of the battle!`, enemy.id);
  }
  return dealt;
}

/** The Lich's Phylactery, while it stands. */
export function phylactery(state: BattleState, rules: Rules = defaultRules): EnemyState | undefined {
  return state.enemies.find((x) => x.alive && behaviorFor(state, x, rules) === 'phylactery');
}

/** Pack Tactics: bonus damage a goblin gets from the other goblins on the field. */
export function packBonus(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  if (e.kind !== 'goblin' || !hasTwist('packTactics', state.encounter, rules)) return 0;
  const others = state.enemies.filter((x) => x.alive && x.kind === 'goblin' && x.id !== e.id).length;
  return others * rules.combat.packTactics.bonusPerOtherGoblin;
}

/** Chieftain's Command: bonus damage for every goblin while a Chieftain lives. */
export function commandBonus(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  return commandSources(state, e, rules).reduce((t, s) => t + s.bonus, 0);
}

/** Who is buffing this enemy: the Chieftain (every goblin) or a minion aura such as the Wight's Unholy Vigor. */
export function commandSources(state: BattleState, e: EnemyState, rules: Rules = defaultRules): { icon: string; name: string; bonus: number }[] {
  const out: { icon: string; name: string; bonus: number }[] = [];
  const living = state.enemies.filter((x) => x.alive);
  if (isGoblinKin(e.kind, state.encounter, rules) && living.some((x) => behaviorFor(state, x, rules) === 'chieftain'))
    out.push({ icon: '👑', name: rules.combat.chieftainCommand.name, bonus: rules.combat.chieftainCommand.bonus });
  if (e.kind === 'goblin') {
    const enc = encounterOf(state.encounter, rules);
    for (const kind of new Set(living.map((x) => x.kind))) {
      const aura = enc.monsters[kind]?.aura;
      if (aura) out.push({ icon: monsterIcon(kind, state.encounter, rules), name: aura.name, bonus: aura.bonus });
    }
  }
  return out;
}

/** What an enemy hits for this round, after enrage, War Drum, Pack Tactics, the Chieftain and curses. */
/** What one hit from this enemy deals; for a Wraith, the drain each hero takes. */
export function enemyDamage(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  if (behaviorFor(state, e, rules) === 'wraith') return wraithDrain(e, rules);
  const rage = (e.enraged ? rules.combat.warlordEnrage.damageBonus : 0) + packBonus(state, e, rules) + commandBonus(state, e, rules);
  const drum = e.drum && e.drum.round === state.round ? e.drum.amount : 0;
  const weaken = e.weaken && e.weaken.rounds > 0 ? e.weaken.amount : 0;
  return Math.max(0, e.damage + rage + drum - weaken);
}

/** The champion's every-few-rounds special move in this encounter, if it has one. */
export function specialOf(e: EnemyState, encounter?: string, rules: Rules = defaultRules): SpecialInfo | null {
  return specialFor(e.kind, encounter, rules);
}

function wraithDrain(e: EnemyState, rules: Rules): number {
  const weaken = e.weaken && e.weaken.rounds > 0 ? e.weaken.amount : 0;
  return Math.max(0, rules.combat.wraith.drainByTier[e.tier ?? 'cold'] - weaken);
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
      const hit = heroHitAmount(hero, (e.amount === 'gear' ? hero.gear : e.amount) + (e.bonus ?? 0));
      return def.target.type === 'enemies' ? `${hit}×${def.target.count}` : `${hit}`;
    }
    if (e.type === 'gearAttack') return `${e.times}×${heroHitAmount(hero, hero.gear)}`;
  }
  return null;
}

function heroHitAmount(hero: HeroState, base: number): number {
  const curse = hero.curse && hero.curse.rounds > 0 ? hero.curse.amount : 0;
  return Math.max(0, Math.floor(base * hero.nextAttackMultiplier) - curse);
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

  if (def.cost) hero.pool -= def.cost;
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
        let base = (effect.amount === 'gear' ? hero.gear : effect.amount) + (effect.bonus ?? 0);
        if (effect.doubleIfTauntedByOther && e.tauntedBy && e.tauntedBy !== hero.id) base *= 2;
        const dealt = damageEnemy(state, e, heroHitAmount(hero, base), !!effect.pierce, rules, source);
        parts.push(`${dealt} to ${e.name}${solidified ? ' (now solid)' : ''}${endText(e)}`);
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
        const dealt = damageEnemy(state, e, heroHitAmount(hero, gearBase), false, rules, source);
        parts.push(`${dealt} to ${e.name}${endText(e)}`);
      }
      return true;
    }
    case 'poison':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        e.poison = { perRound: Math.max(effect.perRound, e.poison?.perRound ?? 0), rounds: Math.max(effect.rounds, e.poison?.rounds ?? 0) };
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
        if (h) {
          const healed = Math.min(effect.amount, h.maxHp - h.hp);
          h.hp += healed;
          parts.push(`${nameOf(state, h.id, rules)} +${healed} HP`);
        }
        return false;
      }
      for (const id of targets) {
        const h = state.heroes.find((x) => x.id === id);
        if (!h || !h.alive) continue;
        const healed = Math.min(effect.amount, h.maxHp - h.hp);
        h.hp += healed;
        parts.push(`${nameOf(state, id, rules)} +${healed} HP`);
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
    case 'gainEnergy':
      hero.pool += effect.amount;
      parts.push(`+${effect.amount} energy`);
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

type Target = { kind: 'hero'; unit: HeroState } | { kind: 'summon'; unit: SummonState };

function targetable(state: BattleState): Target[] {
  const heroes: Target[] = state.heroes
    .filter((h) => h.alive && h.untargetableRounds <= 0)
    .sort((a, b) => HERO_ORDER.indexOf(a.heroClass) - HERO_ORDER.indexOf(b.heroClass))
    .map((h) => ({ kind: 'hero', unit: h }));
  const summons: Target[] = state.summons.filter((s) => s.alive).map((s) => ({ kind: 'summon', unit: s }));
  return [...heroes, ...summons];
}

function lowestHp(list: Target[]): Target | undefined {
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
  switch (behavior) {
    case 'hunter': {
      const pick = heroes.reduce<Target | undefined>((best, t) => {
        if (!best) return t;
        const a = (t.unit as HeroState).armor;
        const b = (best.unit as HeroState).armor;
        return a < b || (a === b && t.unit.hp < best.unit.hp) ? t : best;
      }, undefined);
      return pick ?? lowestHp(all);
    }
    case 'assassin':
      return lowestHp(heroes) ?? lowestHp(all);
    case 'warlock': {
      const backline = heroes.filter((t) => t.kind === 'hero' && (t.unit.heroClass === 'wizard' || t.unit.heroClass === 'cleric'));
      if (backline.length) return lowestHp(backline);
      break;
    }
  }
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

function hitHero(state: BattleState, enemy: EnemyState, h: HeroState, raw: number, rules: Rules, ignoreArmor = false): Hit {
  const dealt = Math.max(0, raw - (ignoreArmor ? 0 : h.armor));
  h.hp -= dealt;
  if (dealt > 0) (state.pendingHits ??= {})[h.id] = (state.pendingHits[h.id] ?? 0) + dealt;
  if (h.lastStand && h.hp < 1) h.hp = 1;
  if (!h.attackedByThisRound.includes(enemy.id)) h.attackedByThisRound.push(enemy.id);
  let text = `${dealt} to ${rules.classes[h.heroClass].name}`;
  if (behaviorFor(state, enemy, rules) === 'assassin') {
    const drained = Math.min(h.pool, rules.combat.assassinDrain);
    h.pool -= drained;
    if (drained) text += `, drains ${drained} energy`;
  }
  if (h.hp <= 0) {
    h.hp = 0;
    h.alive = false;
    state.stats.anyHeroFell = true;
    text += ` — ${rules.classes[h.heroClass].name} falls`;
  }
  return { text, short: `${rules.classes[h.heroClass].name} ${dealt}${h.alive ? '' : ' 💀'}` };
}

function hitTarget(state: BattleState, enemy: EnemyState, target: Target, rules: Rules, raw = enemyDamage(state, enemy, rules)): Hit {
  if (target.kind === 'summon') {
    const s = target.unit;
    s.hp = Math.max(0, s.hp - raw);
    if (s.hp === 0) s.alive = false;
    return { text: `${raw} to ${s.name}${s.alive ? '' : ' (defeated)'}`, short: `${s.name} ${raw}` };
  }
  return hitHero(state, enemy, target.unit, raw, rules);
}

function targetableHeroes(state: BattleState): HeroState[] {
  return state.heroes
    .filter((h) => h.alive && h.untargetableRounds <= 0)
    .sort((a, b) => HERO_ORDER.indexOf(a.heroClass) - HERO_ORDER.indexOf(b.heroClass));
}

/** Champion specials on the every-Nth-round beat. Returns true if the special replaced the action. */
function doSpecial(state: BattleState, enemy: EnemyState, rules: Rules): boolean {
  const sp = rules.combat.specials;
  const dmg = enemyDamage(state, enemy, rules);
  switch (specialOf(enemy, state.encounter, rules)?.key) {
    case 'warlock': {
      const c = rules.combat.warlockCurse;
      const hits: string[] = [];
      for (const h of targetableHeroes(state)) {
        h.curse = { amount: c.damageReduction, rounds: c.rounds };
        hits.push(hitHero(state, enemy, h, sp.warlock.damage, rules, true).text);
      }
      log(state, 'enemy', `${enemy.name} casts ${sp.warlock.name}: −${c.damageReduction} damage for ${c.rounds} turns; ${hits.join('; ')}.`, enemy.id, undefined, `⚠ ${sp.warlock.short}: all heroes`);
      return true;
    }
    case 'ogre': {
      const target = chooseEnemyTarget(state, enemy, rules);
      const hits = targetableHeroes(state).map((h) => hitHero(state, enemy, h, Math.max(0, dmg - sp.ogre.splashPenalty), rules).text);
      let text = `${enemy.name} uses ${sp.ogre.name}: ${hits.join('; ')}`;
      if (target?.kind === 'hero' && target.unit.alive) {
        target.unit.skipNextTurn = true;
        text += `; ${rules.classes[target.unit.heroClass].name} knocked prone`;
      }
      log(state, 'enemy', `${text}.`, enemy.id, undefined, `⚠ ${sp.ogre.short}: all heroes`);
      return true;
    }
    case 'hunter': {
      const picks = [...targetableHeroes(state)].sort((a, b) => a.armor - b.armor || a.hp - b.hp).slice(0, sp.hunter.targets);
      if (!picks.length) return false;
      const hits = picks.map((h) => hitHero(state, enemy, h, dmg, rules));
      log(
        state,
        'enemy',
        `${enemy.name} fires a ${sp.hunter.name}: ${hits.map((x) => x.text).join('; ')}.`,
        enemy.id,
        picks.map((h) => h.id),
        `⚠ ${sp.hunter.short} → ${hits.map((x) => x.short).join(', ')}`,
      );
      return true;
    }
    case 'assassin': {
      const target = chooseEnemyTarget(state, enemy, rules);
      if (!target) return false;
      const low = target.kind === 'hero' && target.unit.hp < target.unit.maxHp * sp.assassin.belowHpFraction;
      const raw = low ? dmg * sp.assassin.multiplier : dmg;
      const hit = hitTarget(state, enemy, target, rules, raw);
      log(
        state,
        'enemy',
        `${enemy.name} attempts an ${sp.assassin.name}${low ? '' : ' (no effect above half HP)'}: ${hit.text}.`,
        enemy.id,
        [target.unit.id],
        low ? `⚠ ${sp.assassin.short} → ${hit.short}` : `→ ${hit.short}`,
      );
      return true;
    }
    case 'fade': {
      if (enemy.intangible) return false;
      enemy.intangible = true;
      log(state, 'enemy', `${enemy.name} fades: only spells and Cleric attacks can touch it again.`, enemy.id, undefined, '⚠ Fade: intangible');
      return true;
    }
    case 'raiseDead': {
      // Skeletons that crumbled from weapon hits; bone piles rise on their own, fire and holy kills stay down.
      const dead = state.enemies.filter((e) => e.kind === 'goblin' && !e.alive && !e.pile && !e.destroyed);
      if (!dead.length) return false;
      for (const e of dead) {
        e.alive = true;
        e.hp = Math.min(e.maxHp, rules.combat.restlessDead.minHp);
        e.arrivedRound = state.round;
        e.poison = null;
        e.weaken = null;
      }
      const sp = specialOf(enemy, state.encounter, rules)!;
      log(state, 'enemy', `${enemy.name} casts ${sp.name}: ${dead.length} skeletons reassemble and fight from next round.`, enemy.id, dead.map((e) => e.id), `⚠ ${sp.short}: +${dead.length} skeletons`);
      return true;
    }
    case 'lich': {
      const target = [...targetableHeroes(state)].sort((a, b) => a.hp - b.hp)[0];
      if (!target) return false;
      const raw = Math.round(dmg * sp.lich.multiplier);
      const hit = hitHero(state, enemy, target, raw, rules, true);
      log(state, 'enemy', `${enemy.name} hurls a ${sp.lich.name}: ${hit.text}.`, enemy.id, [target.id], `⚠ ${sp.lich.short} → ${hit.short}`);
      return true;
    }
    case 'chieftain': {
      const n = sp.chieftain.goblins;
      const fresh: string[] = [];
      for (let i = 0; i < n; i++) {
        const spec: MonsterSpec = {
          id: `${enemy.id}-r${state.round}-${i + 1}`,
          kind: 'goblin',
          name: monsterName('goblin', state.encounter, rules),
          hp: rules.monsters.goblin.hp!,
          damage: rules.horde.minions.damageByTeamFgPct[1].damage,
          isWarlord: false,
          extraActions: 0,
          staggers: 0,
        };
        // They join now and fight from next round.
        state.enemies.push(makeEnemy(spec, state.round, enemy.wave));
        fresh.push(spec.id);
      }
      log(state, 'enemy', `${enemy.name} uses ${sp.chieftain.name}: ${n} goblins join the fight.`, enemy.id, fresh, `⚠ ${sp.chieftain.short}: +${n} goblins`);
      return true;
    }
    case 'shaman': {
      for (const e of livingEnemies(state)) e.drum = { amount: sp.shaman.bonus, round: state.round };
      log(state, 'enemy', `${enemy.name} beats the ${sp.shaman.name}: the horde deals +${sp.shaman.bonus} damage this round.`, enemy.id, undefined, `⚠ ${sp.shaman.short}: horde +${sp.shaman.bonus}`);
      return true;
    }
  }
  return false;
}

function enemyAct(state: BattleState, enemy: EnemyState, actionNumber: number, rules: Rules) {
  if (!enemy.alive || behaviorFor(state, enemy, rules) === 'phylactery') return;
  if (enemy.staggers > 0) {
    enemy.staggers--;
    log(state, 'enemy', `${enemy.name} is staggered and loses its action.`, enemy.id, undefined, '💫 Staggered');
    return;
  }
  const behavior = behaviorFor(state, enemy, rules);
  if (actionNumber === 0 && specialDue(enemy, state.round, rules) && doSpecial(state, enemy, rules)) return;
  if (behavior === 'wraith') {
    // Life drain: every hero loses a little, ignoring armor, and the Wraith heals.
    const w = rules.combat.wraith;
    const amount = wraithDrain(enemy, rules);
    const heroes = targetableHeroes(state);
    const hits = heroes.map((h) => hitHero(state, enemy, h, amount, rules, true).text);
    const healed = Math.min(enemy.maxHp - enemy.hp, Math.floor(amount * heroes.length * w.healFraction));
    enemy.hp += healed;
    log(state, 'enemy', `${enemy.name} drains the party: ${hits.join('; ')}${healed ? `; heals ${healed}` : ''}.`, enemy.id, heroes.map((h) => h.id), `Drain: all heroes ${amount}`);
    return;
  }
  if (behavior === 'shaman') {
    const injured = livingEnemies(state)
      .filter((e) => e.hp < e.maxHp)
      .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
    if (injured) {
      const heal = Math.min(rules.combat.shaman.healByTier[enemy.tier ?? 'cold'], injured.maxHp - injured.hp);
      injured.hp += heal;
      for (const e of livingEnemies(state)) e.shield = { armor: rules.combat.shaman.shieldArmor, rounds: 2 };
      log(
        state,
        'enemy',
        `${enemy.name} heals ${injured.name} for ${heal} and shields the horde (+${rules.combat.shaman.shieldArmor} armor).`,
        enemy.id,
        [injured.id],
        `✚ ${shortName(injured.name)} +${heal}, ⛨ horde`,
      );
      return;
    }
  }
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
      const pick = livingEnemies(state)
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

  // A Shaman beating the War Drum goes first so the whole horde hits with it this round.
  const drummer = (e: EnemyState) => specialOf(e, state.encounter, rules)?.key === 'shaman' && specialDue(e, state.round, rules);
  const order = [...livingEnemies(state)].sort((a, b) => Number(drummer(b)) - Number(drummer(a)));
  for (const enemy of order) {
    if (justArrived(state, enemy)) continue;
    for (let a = 0; a <= enemy.extraActions; a++) enemyAct(state, enemy, a, rules);
  }

  if (state.heroes.every((h) => !h.alive)) {
    state.phase = 'lost';
    state.outcomeReason = 'Every hero has fallen.';
    log(state, 'system', 'Defeat. Every hero has fallen.');
    return state;
  }

  // Round end.
  for (const e of state.enemies) {
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

import { CLASSES, rules as defaultRules, type ActionDef, type Effect, type HeroClass, type Rules, type SummonKind } from '../rules';
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
}

export interface LogEntry {
  round: number;
  side: 'hero' | 'summon' | 'enemy' | 'system';
  text: string;
  actorId?: string;
  targetIds?: string[];
}

export interface BattleState {
  round: number;
  phase: 'party' | 'won' | 'lost';
  outcomeReason?: string;
  waveIndex: number;
  waveCount: number;
  pendingWaves: MonsterSpec[][];
  heroes: HeroState[];
  summons: SummonState[];
  enemies: EnemyState[];
  log: LogEntry[];
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

function makeEnemy(spec: MonsterSpec, arrivedRound: number): EnemyState {
  return {
    arrivedRound,
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

export function createBattle(heroes: HeroSetup[], waves: MonsterSpec[][], rules: Rules = defaultRules): BattleState {
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
    enemies: waves[0].map((m) => makeEnemy(m, 0)),
    log: [],
    nextSummonId: 1,
    stats: { wavesCleared: 0, warlordDefeated: false, anyHeroFell: false, signaturesUsed: 0 },
  };
  log(state, 'system', `Wave 1 of ${waves.length}: ${describeWave(state.enemies)}`);
  startRound(state, rules);
  return state;
}

function describeWave(enemies: EnemyState[]): string {
  const goblins = enemies.filter((e) => e.kind === 'goblin').length;
  const named = enemies.filter((e) => e.kind !== 'goblin').map((e) => e.name);
  return [goblins ? `${goblins} goblin${goblins > 1 ? 's' : ''}` : '', ...named].filter(Boolean).join(', ');
}

function log(state: BattleState, side: LogEntry['side'], text: string, actorId?: string, targetIds?: string[]) {
  state.log.push({ round: state.round, side, text, actorId, targetIds });
}

function startRound(state: BattleState, rules: Rules) {
  if (state.round > 1) log(state, 'system', `Round ${state.round} begins. Every hero can act again.`);
  for (const h of state.heroes) {
    h.armor = 0;
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

function validTargets(state: BattleState, hero: HeroState, def: ActionDef): string[] {
  const t = def.target;
  switch (t.type) {
    case 'enemy': {
      let es = livingEnemies(state);
      if (t.nonBoss) es = es.filter((e) => !e.isWarlord);
      if (t.attackedSelfLastRound) es = es.filter((e) => hero.attackedByLastRound.includes(e.id));
      return es.map((e) => e.id);
    }
    case 'enemies':
    case 'allEnemies':
      return livingEnemies(state).map((e) => e.id);
    case 'ally':
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
    const targets = validTargets(state, hero, def);
    const blocked = blockedFor(def);
    opts.push({
      def,
      source: 'gear',
      attack: isAttack(def),
      available: !blocked && targets.length > 0,
      reason: blocked ?? (targets.length === 0 ? (def.target.type === 'enemy' && def.target.attackedSelfLastRound ? 'No enemy attacked you last round' : 'No targets') : undefined),
      validTargets: targets,
    });
  }
  for (const def of cls.abilities) {
    const targets = validTargets(state, hero, def);
    let reason = blockedFor(def);
    if (!reason && def.unlock === 'signature' && !hero.signatureReady)
      reason = hero.signatureUnlocked ? 'Already used' : 'Needs a double-double';
    if (!reason && def.unlock === 'legendary' && !hero.legendaryReady)
      reason = hero.legendaryUnlocked ? 'Already used' : 'Needs a triple-double';
    if (!reason && def.cost !== undefined && def.cost > hero.pool) reason = `Needs ${def.cost} points`;
    if (!reason && def.target.type !== 'none' && targets.length === 0) reason = 'No valid targets';
    opts.push({ def, source: 'ability', attack: isAttack(def), available: !reason, reason, validTargets: targets });
  }
  return opts;
}

// ---------- Hero actions ----------

function damageEnemy(state: BattleState, enemy: EnemyState, amount: number, pierce: boolean): number {
  const dealt = Math.max(0, Math.floor(amount) - (pierce ? 0 : enemyArmor(enemy)));
  enemy.hp = Math.max(0, enemy.hp - dealt);
  if (enemy.hp === 0 && enemy.alive) {
    enemy.alive = false;
    if (enemy.isWarlord) state.stats.warlordDefeated = true;
  }
  return dealt;
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
    attacked = applyEffect(state, hero, effect, targets, parts, rules) || attacked;
  }
  // Ready Crit / Empower / Shadowstep are consumed by the next attack, not the one that grants them.
  if (attacked && !def.effects.some((e) => e.type === 'nextAttackMultiplier')) hero.nextAttackMultiplier = 1;

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
): boolean {
  switch (effect.type) {
    case 'damage': {
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (!e || !e.alive) continue;
        let base = (effect.amount === 'gear' ? hero.gear : effect.amount) + (effect.bonus ?? 0);
        if (effect.doubleIfTauntedByOther && e.tauntedBy && e.tauntedBy !== hero.id) base *= 2;
        const dealt = damageEnemy(state, e, heroHitAmount(hero, base), !!effect.pierce);
        parts.push(`${dealt} to ${e.name}${e.alive ? '' : ' (defeated)'}`);
      }
      return true;
    }
    case 'gearAttack': {
      const gearDef = rules.classes[hero.heroClass].gear[0];
      const gearEffect = gearDef.effects.find((x) => x.type === 'damage');
      const gearBase = gearEffect && gearEffect.type === 'damage' && gearEffect.amount !== 'gear' ? gearEffect.amount : hero.gear;
      let targetId = targets[0];
      for (let i = 0; i < effect.times; i++) {
        let e = state.enemies.find((x) => x.id === targetId && x.alive);
        // If the first target falls, follow-up attacks go to the weakest remaining enemy.
        if (!e) e = [...livingEnemies(state)].sort((a, b) => a.hp - b.hp)[0];
        if (!e) break;
        targetId = e.id;
        const dealt = damageEnemy(state, e, heroHitAmount(hero, gearBase), false);
        parts.push(`${dealt} to ${e.name}${e.alive ? '' : ' (defeated)'}`);
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
        if (h) h.nextAttackMultiplier *= effect.multiplier;
      }
      parts.push(`next attack ×${effect.multiplier}`);
      return false;
    case 'untargetable':
      hero.untargetableRounds = Math.max(hero.untargetableRounds, effect.rounds);
      parts.push('untargetable');
      return false;
    case 'heal':
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
        if (h && h.alive) h.armor += effect.amount;
      }
      parts.push(`+${effect.amount} armor${ids.length > 1 ? ' to all allies' : ''}`);
      return false;
    }
    case 'taunt':
      for (const id of targets) {
        const e = state.enemies.find((x) => x.id === id);
        if (e && e.alive) e.tauntedBy = hero.id;
      }
      parts.push(`taunts ${targets.length > 1 ? `${targets.length} enemies` : nameOf(state, targets[0], rules)}`);
      return false;
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
    case 'lastStand':
      hero.lastStand = true;
      parts.push('cannot drop below 1 HP');
      return false;
  }
}

/** Clears a finished wave, brings in the next one, and checks for victory. */
function afterDamage(state: BattleState) {
  if (state.phase !== 'party') return;
  while (livingEnemies(state).length === 0) {
    state.stats.wavesCleared++;
    log(state, 'system', `Wave ${state.waveIndex + 1} cleared!`);
    const next = state.pendingWaves.shift();
    if (!next) {
      state.phase = 'won';
      state.outcomeReason = 'The horde is defeated.';
      log(state, 'system', 'Victory! The horde is defeated.');
      return;
    }
    state.waveIndex++;
    state.enemies = next.map((m) => makeEnemy(m, state.round));
    log(
      state,
      'system',
      `Wave ${state.waveIndex + 1} of ${state.waveCount}: ${describeWave(state.enemies)}. They act from round ${state.round + 1}.`,
    );
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
  const behavior = rules.monsters[enemy.kind].behavior;

  if (behavior !== 'hunter' && enemy.tauntedBy) {
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

function hitTarget(state: BattleState, enemy: EnemyState, target: Target, rules: Rules): string {
  const weaken = enemy.weaken && enemy.weaken.rounds > 0 ? enemy.weaken.amount : 0;
  const raw = Math.max(0, enemy.damage - weaken);
  if (target.kind === 'summon') {
    const s = target.unit;
    s.hp = Math.max(0, s.hp - raw);
    if (s.hp === 0) s.alive = false;
    return `${raw} to ${s.name}${s.alive ? '' : ' (defeated)'}`;
  }
  const h = target.unit;
  const dealt = Math.max(0, raw - h.armor);
  h.hp -= dealt;
  if (h.lastStand && h.hp < 1) h.hp = 1;
  if (!h.attackedByThisRound.includes(enemy.id)) h.attackedByThisRound.push(enemy.id);
  let text = `${dealt} to ${rules.classes[h.heroClass].name}`;
  if (rules.monsters[enemy.kind].behavior === 'assassin') {
    const drained = Math.min(h.pool, rules.combat.assassinDrain);
    h.pool -= drained;
    if (drained) text += `, drains ${drained} points`;
  }
  if (h.hp <= 0) {
    h.hp = 0;
    h.alive = false;
    state.stats.anyHeroFell = true;
    text += ` — ${rules.classes[h.heroClass].name} falls`;
  }
  return text;
}

function enemyAct(state: BattleState, enemy: EnemyState, actionNumber: number, rules: Rules) {
  if (!enemy.alive) return;
  if (enemy.staggers > 0) {
    enemy.staggers--;
    log(state, 'enemy', `${enemy.name} is staggered and loses its action.`, enemy.id);
    return;
  }
  const behavior = rules.monsters[enemy.kind].behavior;
  const special = actionNumber === 0 && state.round % rules.combat.specialEveryNRounds === 0;

  if (behavior === 'warlock' && special) {
    const c = rules.combat.warlockCurse;
    for (const h of state.heroes) if (h.alive) h.curse = { amount: c.damageReduction, rounds: c.rounds };
    log(state, 'enemy', `${enemy.name} curses the party: −${c.damageReduction} damage for ${c.rounds} rounds.`, enemy.id, state.heroes.filter((h) => h.alive).map((h) => h.id));
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
      log(state, 'enemy', `${enemy.name} heals ${injured.name} for ${heal} and shields the horde (+${rules.combat.shaman.shieldArmor} armor).`, enemy.id, [injured.id]);
      return;
    }
  }
  const target = chooseEnemyTarget(state, enemy, rules);
  if (!target) {
    log(state, 'enemy', `${enemy.name} finds no target.`, enemy.id);
    return;
  }
  let text = `${enemy.name} attacks: ${hitTarget(state, enemy, target, rules)}`;
  if (behavior === 'ogre' && special && target.kind === 'hero' && target.unit.alive) {
    target.unit.skipNextTurn = true;
    text += `, knocked prone`;
  }
  log(state, 'enemy', `${text}.`, enemy.id, [target.unit.id]);
}

function summonsAct(state: BattleState) {
  for (const s of state.summons) {
    if (!s.alive || state.phase !== 'party') continue;
    for (let i = 0; i < s.tauntsPerRound; i++) {
      const pick = livingEnemies(state)
        .filter((e) => !e.tauntedBy)
        .sort((a, b) => b.damage - a.damage)[0];
      if (pick) {
        pick.tauntedBy = s.id;
        log(state, 'summon', `${s.name} taunts ${pick.name}.`, s.id, [pick.id]);
      }
    }
    const target = [...livingEnemies(state)].sort((a, b) => a.hp - b.hp)[0];
    if (!target) continue;
    const dealt = damageEnemy(state, target, s.damage, false);
    log(state, 'summon', `${s.name} bites ${target.name} for ${dealt}${target.alive ? '' : ' (defeated)'}.`, s.id, [target.id]);
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
    log(state, 'enemy', `Poison deals ${dealt} to ${e.name}${e.alive ? '' : ' (defeated)'}.`, e.id, [e.id]);
    e.poison.rounds--;
    if (e.poison.rounds <= 0) e.poison = null;
  }
  afterDamage(state);
  if (state.phase !== 'party') return state;

  for (const enemy of [...livingEnemies(state)]) {
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
  if (state.phase !== 'party') return [];
  const after = endRound(state, rules);
  return after.log.slice(state.log.length).filter((l) => l.round === state.round && l.side !== 'system');
}

export function heroesReadyToAct(state: BattleState): HeroState[] {
  return state.heroes.filter((h) => h.alive && !h.acted && !h.prone);
}

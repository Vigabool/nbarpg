import { rules as defaultRules, type Rules } from '../../rules';
import {
  actionDamage,
  actionsThisRound,
  enemyDamage,
  hitHero,
  listActions,
  log,
  lowestHp,
  targetableHeroes,
  type BattleState,
  type EnemyState,
  type HeroState,
  type Target,
} from '../combat';
import { encounterOf } from '../encounter';
import type { Mechanic } from './types';

/** Topple: damage a giant must take in one round to fall, or null if it can't be toppled. */
export function toppleThreshold(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number | null {
  const enc = encounterOf(state.encounter, rules);
  if (!enc.twists.includes('topple') || e.kind === 'goblin') return null;
  const t = rules.combat.topple;
  // Rallying Saga: while the Skald lives, every giant is harder to topple.
  const saga = state.enemies.reduce((sum, x) => sum + (x.alive ? (enc.monsters[x.kind]?.rallyingSaga?.bonus ?? 0) : 0), 0);
  return Math.ceil(e.maxHp * (e.isWarlord ? t.bossThreshold : t.threshold)) + saga;
}

/** Heroes a landing would drop right now: the crash hits every hero, and Last Stand holds at 1 HP. */
export function landingVictims(state: BattleState, rules: Rules = defaultRules): HeroState[] {
  const crash = rules.combat.topple.crashDamage;
  return state.heroes.filter((h) => h.alive && !h.lastStand && h.hp <= crash);
}

/** The biggest hit a hero who can still attack this round could land on this enemy (before armor). */
export function bestHitOn(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  let best = 0;
  for (const h of state.heroes) {
    if (!h.alive || h.acted || h.prone) continue;
    for (const o of listActions(state, h.id, rules)) {
      if (!o.available || !o.attack || !o.validTargets.includes(e.id)) continue;
      const d = actionDamage(o.def, h);
      if (!d) continue;
      const [a, b] = d.split('×').map(Number);
      // "8×3" spreads over targets (8 each); "2×6" is six hits that can all land on one.
      best = Math.max(best, o.def.target.type === 'enemies' || o.def.target.type === 'allEnemies' ? a : a * (b || 1));
    }
  }
  return best;
}

/**
 * Landing warning: when one more hit this round could topple this giant, the heroes its landing
 * would drop. Empty when no topple is in reach or nobody is that low.
 */
export function landingWarning(state: BattleState, e: EnemyState, rules: Rules = defaultRules): HeroState[] {
  const t = toppleThreshold(state, e, rules);
  if (t === null || !e.alive || e.toppled || state.phase !== 'party') return [];
  const victims = landingVictims(state, rules);
  if (!victims.length) return [];
  return t - (e.toppleDamage ?? 0) <= bestHitOn(state, e, rules) ? victims : [];
}

/**
 * Topple: enough damage to a giant in one round knocks it down. It loses its next turn, and
 * the hall shakes as it lands: every hero takes a little damage.
 */
const topple: Mechanic = {
  id: 'topple',
  appliesTo: (enc) => enc.twists.includes('topple'),
  onRoundStart(state) {
    for (const e of state.enemies) e.toppleDamage = 0;
  },
  afterEnemyHit(state, enemy, dealt, rules) {
    const threshold = toppleThreshold(state, enemy, rules);
    if (threshold === null || enemy.hp <= 0 || enemy.toppled || dealt <= 0) return;
    enemy.toppleDamage = (enemy.toppleDamage ?? 0) + dealt;
    if (enemy.toppleDamage < threshold) return;
    enemy.toppled = true;
    enemy.toppledRound = state.round;
    const crash = rules.combat.topple.crashDamage;
    const shaken: string[] = [];
    for (const h of state.heroes) {
      if (!h.alive) continue;
      const hurt = Math.min(crash, h.hp - (h.lastStand ? 1 : 0));
      if (hurt <= 0) continue;
      h.hp -= hurt;
      if (h.hp <= 0) {
        h.hp = 0;
        h.alive = false;
        state.stats.anyHeroFell = true;
        shaken.push(`the ${rules.classes[h.heroClass].name} falls`);
      }
    }
    log(
      state,
      'system',
      `⛰️ ${enemy.name} is toppled and loses its next ${enemy.extraActions ? 'turn' : 'action'}! The hall shakes: ${crash} damage to every hero${shaken.length ? `; ${shaken.join(', ')}` : ''}.`,
      enemy.id,
    );
  },
  // A toppled giant spends its whole turn getting up (the Giant Lord loses both actions).
  skipsTurn(state, enemy) {
    if (!enemy.toppled) return false;
    enemy.toppled = false;
    log(state, 'enemy', `${enemy.name} is down and loses its turn.`, enemy.id, undefined, '⛰️ Toppled');
    return true;
  },
  // Topple needs several heroes in one round: credit partial progress, squared so piling onto one giant beats spreading out.
  botScore(state, _after, score, rules) {
    let v = score;
    for (const e of state.enemies) {
      const t = toppleThreshold(state, e, rules);
      if (t === null || !e.alive || e.toppled || !e.toppleDamage) continue;
      v += 3 * (e.toppleDamage / t) ** 2 * enemyDamage(state, e, rules) * actionsThisRound(e);
    }
    return v;
  },
};

/** Regenerate (the Frost Troll): heals each round unless it was toppled or burned that round. */
const regenerate: Mechanic = {
  id: 'regenerate',
  appliesTo: (enc) => Object.values(enc.monsters).some((m) => m?.regenerate),
  onRoundEnd(state, rules) {
    for (const e of state.enemies) {
      const regen = encounterOf(state.encounter, rules).monsters[e.kind]?.regenerate;
      if (!regen || !e.alive || e.hp >= e.maxHp || e.toppledRound === state.round || e.burnedRound === state.round) continue;
      const healed = Math.min(regen.amount, e.maxHp - e.hp);
      e.hp += healed;
      log(state, 'system', `♻️ ${e.name} regenerates ${healed} HP.`, e.id);
    }
  },
};

const hallRoles: Mechanic = {
  id: 'hallRoles',
  appliesTo: () => false,
  behaviors: {
    // Pack hunters (Ice Wolves): the most injured hero (most HP missing), then the lowest HP.
    wolf: {
      target(_state, _e, all, heroes) {
        const hurt = heroes.reduce<Target | undefined>((best, t) => {
          const missing = (t.unit as HeroState).maxHp - t.unit.hp;
          const bestMissing = best ? (best.unit as HeroState).maxHp - best.unit.hp : -1;
          return missing > bestMissing || (missing === bestMissing && best && t.unit.hp < best.unit.hp) ? t : best;
        }, undefined);
        return hurt && (hurt.unit as HeroState).maxHp > hurt.unit.hp ? hurt : (lowestHp(heroes) ?? lowestHp(all));
      },
    },
  },
  specials: {
    // Over the front line: the lowest-HP hero who isn't the Warrior, if there is one, knocked prone.
    boulderToss: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials.boulderToss;
        const heroes = targetableHeroes(state);
        const target = [...(heroes.some((h) => h.heroClass !== 'warrior') ? heroes.filter((h) => h.heroClass !== 'warrior') : heroes)].sort(
          (a, b) => a.hp - b.hp,
        )[0];
        if (!target) return false;
        const hit = hitHero(state, enemy, target, Math.round(dmg * sp.multiplier), rules);
        const name = rules.classes[target.heroClass].name;
        if (target.alive) target.skipNextTurn = true;
        log(
          state,
          'enemy',
          `${enemy.name} hurls a boulder: ${hit.text}${target.alive ? `; the ${name} is knocked prone` : ''}.`,
          enemy.id,
          [target.id],
          `⚠ ${sp.short} → ${hit.short}`,
        );
        return true;
      },
    },
    spearThrow: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials.spearThrow;
        const target = [...targetableHeroes(state)].sort((a, b) => a.armor - b.armor || a.hp - b.hp)[0];
        if (!target) return false;
        const hit = hitHero(state, enemy, target, Math.round(dmg * sp.multiplier), rules);
        log(state, 'enemy', `${enemy.name} throws a spear: ${hit.text}.`, enemy.id, [target.id], `⚠ ${sp.short} → ${hit.short}`);
        return true;
      },
    },
    // Avalanche: every hero, a little less than a normal hit, and some energy.
    giantLord: {
      run(state, enemy, dmg, rules) {
        const a = rules.combat.specials.giantLord;
        const hits = targetableHeroes(state).map((h) => {
          const hit = hitHero(state, enemy, h, Math.max(0, dmg - a.penalty), rules);
          const lost = Math.min(h.pool, a.energyLoss);
          h.pool -= lost;
          return `${hit.text}${lost ? `, −${lost} energy` : ''}`;
        });
        if (!hits.length) return false;
        log(
          state,
          'enemy',
          `${enemy.name} brings down an ${a.name}: ${hits.join('; ')}.`,
          enemy.id,
          undefined,
          `⚠ ${a.short}: all heroes ${Math.max(0, dmg - a.penalty)}, −${a.energyLoss} energy`,
        );
        return true;
      },
    },
  },
};

export const giantsHall: Mechanic[] = [topple, regenerate, hallRoles];

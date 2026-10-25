import { rules as defaultRules, type Rules } from '../../rules';
import { awake, behaviorFor, hitHero, log, specialOf, targetableHeroes, type BattleState, type EnemyState } from '../combat';
import { encounterOf, monsterIcon } from '../encounter';
import type { Mechanic } from './types';

/** Each time a skeleton reassembles it comes back with half its last HP: 8, 4, 2. */
function riseHp(e: EnemyState): number {
  return Math.floor(e.maxHp / 2 ** ((e.rises ?? 0) + 1));
}

/** Bone Harvest: a skeleton crumbling from weapon hits feeds any living Bone Giant. */
function boneHarvest(state: BattleState, rules: Rules) {
  const enc = encounterOf(state.encounter, rules);
  for (const x of state.enemies) {
    const bh = enc.monsters[x.kind]?.boneHarvest;
    if (!bh || !x.alive || x.hp >= x.maxHp) continue;
    const healed = Math.min(bh.heal, x.maxHp - x.hp);
    x.hp += healed;
    log(state, 'system', `🦴 ${x.name} absorbs the bones and heals ${healed}.`, x.id);
  }
}

/**
 * Restless Dead: skeletons (and other restless dead, like the Skeletal Archer) leave a bone
 * pile that reassembles next round, halving each time, unless fire or holy damage ended them.
 */
const restlessDead: Mechanic = {
  id: 'restlessDead',
  appliesTo: (enc) => enc.twists.includes('restlessDead'),
  onRoundStart(state) {
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
    if (rising.length)
      log(
        state,
        'system',
        `🦴 ${rising.length} ${rising.length > 1 ? 'skeletons reassemble' : 'skeleton reassembles'}.`,
        undefined,
        rising.map((e) => e.id),
      );
  },
  onEnemyDefeated(state, enemy, source, rules) {
    const restless = encounterOf(state.encounter, rules).monsters[enemy.kind]?.restless;
    if (enemy.kind !== 'goblin' && !restless) return;
    if (source.fire || source.holy) enemy.destroyed = true;
    else if (enemy.kind === 'goblin' ? riseHp(enemy) >= rules.combat.restlessDead.minHp : (enemy.rises ?? 0) < restless!.rises) enemy.pile = true;
    if (enemy.kind === 'goblin' && !enemy.destroyed) boneHarvest(state, rules);
  },
  // Everything in the Crypt is undead.
  smiteVulnerable: () => true,
  // Bone piles come back: count part of what they'll return with.
  botScore: (_state, after, score) => after.enemies.reduce((v, e) => (e.pile ? v - 3 : v), score),
  specials: {
    // Raise Dead: skeletons that crumbled from weapon hits; bone piles rise on their own, fire and holy kills stay down.
    raiseDead: {
      run(state, enemy, _dmg, rules) {
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
        log(
          state,
          'enemy',
          `${enemy.name} casts ${sp.name}: ${dead.length} skeletons reassemble and fight from next round.`,
          enemy.id,
          dead.map((e) => e.id),
          `⚠ ${sp.short}: +${dead.length} skeletons`,
        );
        return true;
      },
    },
  },
};

/** A minion aura (the Wight's Unholy Vigor): every minion deals extra damage while it lives. */
const aura: Mechanic = {
  id: 'aura',
  appliesTo: (enc) => Object.values(enc.monsters).some((m) => m?.aura),
  buffSources(state, e, rules) {
    if (e.kind !== 'goblin') return [];
    const enc = encounterOf(state.encounter, rules);
    const out = [];
    for (const kind of new Set(awake(state).map((x) => x.kind))) {
      const a = enc.monsters[kind]?.aura;
      if (a) out.push({ icon: monsterIcon(kind, state.encounter, rules), name: a.name, bonus: a.bonus });
    }
    return out;
  },
};

function wraithDrain(e: EnemyState, rules: Rules): number {
  const weaken = e.weaken && e.weaken.rounds > 0 ? e.weaken.amount : 0;
  return Math.max(0, rules.combat.wraith.drainByTier[e.tier ?? 'cold'] - weaken);
}

/** The Wraith: intangible to weapons, drains every hero a little each turn, and Fades back out. */
const wraith: Mechanic = {
  id: 'wraith',
  appliesTo: () => false,
  behaviors: {
    wraith: {
      init: (_state, e) => {
        e.intangible = true;
      },
      damage: (_state, e, rules) => wraithDrain(e, rules),
      // Life drain: every hero loses a little, ignoring armor, and the Wraith heals.
      act(state, enemy, rules) {
        const w = rules.combat.wraith;
        const amount = wraithDrain(enemy, rules);
        const heroes = targetableHeroes(state);
        const hits = heroes.map((h) => hitHero(state, enemy, h, amount, rules, true).text);
        const healed = Math.min(enemy.maxHp - enemy.hp, Math.floor(amount * heroes.length * w.healFraction));
        enemy.hp += healed;
        log(
          state,
          'enemy',
          `${enemy.name} drains the party: ${hits.join('; ')}${healed ? `; heals ${healed}` : ''}.`,
          enemy.id,
          heroes.map((h) => h.id),
          `Drain: all heroes ${amount}`,
        );
        return true;
      },
    },
  },
  specials: {
    fade: {
      run(state, enemy) {
        if (enemy.intangible) return false;
        enemy.intangible = true;
        log(state, 'enemy', `${enemy.name} fades: only spells and Cleric attacks can touch it again.`, enemy.id, undefined, '⚠ Fade: intangible');
        return true;
      },
    },
  },
};

/** The Lich's Phylactery, while it stands. */
export function phylactery(state: BattleState, rules: Rules = defaultRules): EnemyState | undefined {
  return state.enemies.find((x) => x.alive && behaviorFor(state, x, rules) === 'phylactery');
}

/**
 * The Lich and its Phylactery: the Lich takes reduced damage while its soul is safe, the
 * Phylactery hides behind any skeleton still standing, and it shatters when the Lich dies.
 */
const lich: Mechanic = {
  id: 'lich',
  appliesTo: () => true,
  guarded: (state, e, rules) => behaviorFor(state, e, rules) === 'phylactery' && state.enemies.some((x) => x.alive && x.kind === 'goblin'),
  incomingDamage: (state, e, amount, _source, rules) =>
    behaviorFor(state, e, rules) === 'lich' && phylactery(state, rules) ? amount * rules.combat.phylactery.damageTaken : amount,
  onEnemyDefeated(state, enemy, _source, rules) {
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
  },
  behaviors: { phylactery: { idle: true } },
  specials: {
    lich: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials;
        const target = [...targetableHeroes(state)].sort((a, b) => a.hp - b.hp)[0];
        if (!target) return false;
        const hit = hitHero(state, enemy, target, Math.round(dmg * sp.lich.multiplier), rules, true);
        log(state, 'enemy', `${enemy.name} hurls a ${sp.lich.name}: ${hit.text}.`, enemy.id, [target.id], `⚠ ${sp.lich.short} → ${hit.short}`);
        return true;
      },
    },
  },
};

export const crypt: Mechanic[] = [restlessDead, aura, wraith, lich];

import { rules as defaultRules, type Rules } from '../../rules';
import { behaviorFor, enemyDamage, hitHero, log, targetableHeroes, type BattleState, type EnemyState } from '../combat';
import { encounterOf } from '../encounter';
import type { Mechanic } from './types';

/** Wakes a sleeping boss and seals the hoard, if there is one. */
function wake(state: BattleState, e: EnemyState, arrivedRound: number, why: string) {
  e.asleep = false;
  e.waking = false;
  e.arrivedRound = arrivedRound;
  if (state.hoard) state.hoard.sealed = true;
  log(state, 'system', `🐉 ${e.name} wakes ${why}! The hoard is sealed at ${state.hoard?.coins ?? 0} coins.`, e.id);
}

/**
 * A sleeping boss (the Dragon) lies on the field from round 1 but belongs to the final wave.
 * A hit wakes it at round end (it takes extra damage from that ambush, then stays groggy,
 * one action a round, until the final wave); otherwise the final wave wakes it.
 */
const sleepingBoss: Mechanic = {
  id: 'sleepingBoss',
  // Driven by the monster spec (`sleeps`), so it works in any encounter.
  appliesTo: () => true,
  initEnemy(state, e) {
    if (!e.spec.sleeps) return;
    e.asleep = true;
    e.wave = state.waveCount - 1;
  },
  incomingDamage(_state, e, amount, _source, rules) {
    if (!e.asleep || amount <= 0) return amount;
    e.waking = true;
    return amount * rules.combat.dragonSleep.damageMultiplier;
  },
  onWaveArrived(state, arrivedRound) {
    if (state.pendingWaves.length > 0) return;
    for (const e of state.enemies) {
      if (e.alive && e.asleep) wake(state, e, arrivedRound, 'as the final wave arrives');
      if (e.groggy) {
        e.groggy = false;
        log(state, 'system', `🐉 ${e.name} shakes off its grogginess: two actions a round from now on.`, e.id);
      }
    }
  },
  onRoundEnd(state, rules) {
    for (const e of state.enemies)
      if (e.alive && e.asleep && e.waking) {
        wake(state, e, state.round, 'with a roar');
        // Rude Awakening: an ambush that doesn't finish it is answered with fire at once.
        const r = rules.combat.dragonSleep.rudeAwakening;
        const dmg = Math.round(enemyDamage(state, e, rules) * r.damageMultiplier);
        const heroes = targetableHeroes(state);
        if (heroes.length) {
          const hits = heroes.map((h) => hitHero(state, e, h, dmg, rules));
          log(
            state,
            'enemy',
            `${e.name} answers the ambush with fire (${r.name}): ${hits.map((h) => h.text).join('; ')}.`,
            e.id,
            heroes.map((h) => h.id),
            `⚠ ${r.name}: all heroes ${dmg}`,
          );
        }
        // Rudely awakened before the final wave, it's groggy: one action a round until then.
        if (state.pendingWaves.length > 0 && r.groggy) e.groggy = true;
      }
  },
};

/** Hoard Tithe: the Dragon's bonus damage from its hoard. */
export function hoardBonus(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  if (!state.hoard || behaviorFor(state, e, rules) !== 'dragon') return 0;
  const h = rules.combat.hoardTithe;
  return Math.min(h.maxBonus, Math.floor(state.hoard.coins / h.coinsPerDamage));
}

/** Hoard Tithe: while the Dragon sleeps, every kobold adds a coin each round; coins make the Dragon hit harder. */
const hoardTithe: Mechanic = {
  id: 'hoardTithe',
  appliesTo: (enc) => enc.twists.includes('hoardTithe'),
  initBattle(state) {
    state.hoard = { coins: 0, sealed: false };
  },
  damageBonus: hoardBonus,
  onRoundEnd(state) {
    if (!state.hoard || state.hoard.sealed || !state.enemies.some((e) => e.alive && e.asleep)) return;
    const n = state.enemies.filter((e) => e.alive && e.kind === 'goblin').length;
    if (n > 0) {
      state.hoard.coins += n;
      log(state, 'system', `💰 ${n} kobold${n > 1 ? 's tithe' : ' tithes'} to the hoard (${state.hoard.coins} coins).`);
    }
  },
  // Coins make the Dragon hit harder later.
  botScore: (_state, after, score) => (after.hoard && !after.hoard.sealed ? score - 1.5 * after.hoard.coins : score),
  // Shiny Thief: energy it drains also goes on the hoard.
  onEnergyDrained(state, enemy, _hero, drained, rules) {
    if (!drained || !state.hoard || state.hoard.sealed || !encounterOf(state.encounter, rules).monsters[enemy.kind]?.shinyThief) return '';
    state.hoard.coins += 1;
    return ' (+1 coin to the hoard)';
  },
  specials: {
    titheBlessing: {
      resolve: (state, _e, info) => (state.hoard && !state.hoard.sealed ? info : null),
      run(state, enemy, _dmg, rules) {
        const sp = rules.combat.specials.titheBlessing;
        state.hoard!.coins += sp.coins;
        log(
          state,
          'enemy',
          `${enemy.name} offers a ${sp.name}: +${sp.coins} coins to the hoard (${state.hoard!.coins}).`,
          enemy.id,
          undefined,
          `⚠ ${sp.short}: +${sp.coins} coins`,
        );
        return true;
      },
    },
  },
};

const isDragonkin = (state: BattleState, e: EnemyState, rules: Rules) => !!encounterOf(state.encounter, rules).monsters[e.kind]?.dragonkin;

/** Dragonkin: Dragonscale halves fire damage, and Smite hits them harder. */
const dragonkin: Mechanic = {
  id: 'dragonkin',
  appliesTo: (enc) => Object.values(enc.monsters).some((m) => m?.dragonkin),
  incomingDamage: (state, e, amount, source, rules) =>
    source.fire && encounterOf(state.encounter, rules).twists.includes('dragonscale') && isDragonkin(state, e, rules)
      ? amount * rules.combat.dragonscale.fireMultiplier
      : amount,
  smiteVulnerable: isDragonkin,
};

/** Molten Hide: a hero who strikes it with a weapon (not a spell) gets burned. */
const moltenHide: Mechanic = {
  id: 'moltenHide',
  appliesTo: (enc) => Object.values(enc.monsters).some((m) => m?.moltenHide),
  afterHeroStrike(state, hero, e, def, parts, rules) {
    const mh = encounterOf(state.encounter, rules).monsters[e.kind]?.moltenHide;
    if (!mh || def.tags?.includes('spell') || !hero.alive) return;
    const burn = Math.min(mh.damage, hero.hp - (hero.lastStand ? 1 : 0));
    if (burn <= 0) return;
    hero.hp -= burn;
    const name = rules.classes[hero.heroClass].name;
    if (hero.hp <= 0) {
      hero.hp = 0;
      hero.alive = false;
      state.stats.anyHeroFell = true;
    }
    parts.push(`the ${name} is burned for ${burn}${hero.alive ? '' : ` and falls`}`);
  },
};

const lairSpecials: Mechanic = {
  id: 'lairSpecials',
  appliesTo: () => false,
  specials: {
    // Net Shot: the least-armored hero can't attack next round.
    netShot: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials.netShot;
        const target = [...targetableHeroes(state)].sort((a, b) => a.armor - b.armor || a.hp - b.hp)[0];
        if (!target) return false;
        const hit = hitHero(state, enemy, target, dmg, rules);
        if (target.alive) target.nettedRound = state.round + 1;
        const name = rules.classes[target.heroClass].name;
        log(
          state,
          'enemy',
          `${enemy.name} fires a ${sp.name}: ${hit.text}${target.alive ? `; the ${name} is netted and can't attack next round` : ''}.`,
          enemy.id,
          [target.id],
          `⚠ ${sp.short} → ${hit.short}`,
        );
        return true;
      },
    },
    // Fire Breath: every hero.
    dragon: {
      run(state, enemy, dmg, rules) {
        const hits = targetableHeroes(state).map((h) => hitHero(state, enemy, h, dmg, rules).text);
        if (!hits.length) return false;
        log(
          state,
          'enemy',
          `${enemy.name} breathes fire: ${hits.join('; ')}.`,
          enemy.id,
          undefined,
          `⚠ ${rules.combat.specials.dragon.short}: all heroes ${dmg}`,
        );
        return true;
      },
    },
  },
};

export const dragonLair: Mechanic[] = [sleepingBoss, hoardTithe, dragonkin, moltenHide, lairSpecials];

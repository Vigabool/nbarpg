import { chooseEnemyTarget, hitHero, hitTarget, livingEnemies, log, lowestHp, shortName, targetableHeroes, type HeroState, type Target } from '../combat';
import { mechanicsFor } from './index';
import type { Mechanic } from './types';

/**
 * The classic champion roles every encounter re-skins: the Ogre, Warlock, Hunter, Assassin
 * and Shaman, with their targeting, actions and specials.
 */
export const roles: Mechanic = {
  id: 'roles',
  appliesTo: () => false,
  behaviors: {
    hunter: {
      // The least-armored hero, then the lowest HP.
      target: (_state, _e, all, heroes) =>
        heroes.reduce<Target | undefined>((best, t) => {
          if (!best) return t;
          const a = (t.unit as HeroState).armor;
          const b = (best.unit as HeroState).armor;
          return a < b || (a === b && t.unit.hp < best.unit.hp) ? t : best;
        }, undefined) ?? lowestHp(all),
    },
    assassin: {
      target: (_state, _e, all, heroes) => lowestHp(heroes) ?? lowestHp(all),
      onHit(state, e, h, rules) {
        const drained = Math.min(h.pool, rules.combat.assassinDrain);
        h.pool -= drained;
        if (!drained) return '';
        let text = `, drains ${drained} energy`;
        for (const m of mechanicsFor(state, rules)) text += m.onEnergyDrained?.(state, e, h, drained, rules) ?? '';
        return text;
      },
    },
    warlock: {
      // The backline casters first.
      target: (_state, _e, _all, heroes) => {
        const backline = heroes.filter((t) => t.kind === 'hero' && (t.unit.heroClass === 'wizard' || t.unit.heroClass === 'cleric'));
        return backline.length ? lowestHp(backline) : undefined;
      },
    },
    shaman: {
      // Heals the most injured enemy and shields the horde; attacks only when nobody is hurt.
      act(state, enemy, rules) {
        const injured = livingEnemies(state)
          .filter((e) => e.hp < e.maxHp)
          .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
        if (!injured) return false;
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
        return true;
      },
    },
  },
  specials: {
    ogre: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials;
        const target = chooseEnemyTarget(state, enemy, rules);
        const hits = targetableHeroes(state).map((h) => hitHero(state, enemy, h, Math.max(0, dmg - sp.ogre.splashPenalty), rules).text);
        let text = `${enemy.name} uses ${sp.ogre.name}: ${hits.join('; ')}`;
        if (target?.kind === 'hero' && target.unit.alive) {
          target.unit.skipNextTurn = true;
          text += `; ${rules.classes[target.unit.heroClass].name} knocked prone`;
        }
        log(state, 'enemy', `${text}.`, enemy.id, undefined, `⚠ ${sp.ogre.short}: all heroes`);
        return true;
      },
    },
    warlock: {
      run(state, enemy, _dmg, rules) {
        const sp = rules.combat.specials;
        const c = rules.combat.warlockCurse;
        const hits: string[] = [];
        for (const h of targetableHeroes(state)) {
          h.curse = { amount: c.damageReduction, rounds: c.rounds };
          hits.push(hitHero(state, enemy, h, sp.warlock.damage, rules, true).text);
        }
        log(
          state,
          'enemy',
          `${enemy.name} casts ${sp.warlock.name}: −${c.damageReduction} damage for ${c.rounds} turns; ${hits.join('; ')}.`,
          enemy.id,
          undefined,
          `⚠ ${sp.warlock.short}: all heroes`,
        );
        return true;
      },
    },
    hunter: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials;
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
      },
    },
    assassin: {
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials;
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
      },
    },
    shaman: {
      // The War Drum: the Shaman acts first so the whole horde hits with it this round.
      actsFirst: true,
      run(state, enemy, _dmg, rules) {
        const sp = rules.combat.specials;
        for (const e of livingEnemies(state)) e.drum = { amount: sp.shaman.bonus, round: state.round };
        log(
          state,
          'enemy',
          `${enemy.name} beats the ${sp.shaman.name}: the horde deals +${sp.shaman.bonus} damage this round.`,
          enemy.id,
          undefined,
          `⚠ ${sp.shaman.short}: horde +${sp.shaman.bonus}`,
        );
        return true;
      },
    },
  },
};

export const common: Mechanic[] = [roles];

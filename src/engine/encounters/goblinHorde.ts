import { rules as defaultRules, type Rules } from '../../rules';
import { awake, behaviorFor, hitHero, log, makeEnemy, targetableHeroes, type BattleState, type EnemyState } from '../combat';
import { encounterOf, isGoblinKin, monsterName } from '../encounter';
import type { MonsterSpec } from '../horde';
import type { Mechanic } from './types';

/** Pack Tactics: bonus damage a goblin gets from the other goblins on the field. */
export function packBonus(state: BattleState, e: EnemyState, rules: Rules = defaultRules): number {
  if (e.kind !== 'goblin' || !encounterOf(state.encounter, rules).twists.includes('packTactics')) return 0;
  const others = state.enemies.filter((x) => x.alive && x.kind === 'goblin' && x.id !== e.id).length;
  return others * rules.combat.packTactics.bonusPerOtherGoblin;
}

const packTactics: Mechanic = {
  id: 'packTactics',
  appliesTo: (enc) => enc.twists.includes('packTactics'),
  damageBonus: packBonus,
};

/** Guarded by the Pack: some champions can't be targeted while enough goblins are alive. */
const packGuard: Mechanic = {
  id: 'packGuard',
  appliesTo: (enc) => enc.twists.includes('packGuard'),
  guarded(state, e, rules) {
    const g = rules.combat.packGuard;
    if (!g.guarded.includes(behaviorFor(state, e, rules))) return false;
    return state.enemies.filter((x) => x.alive && x.kind === 'goblin').length >= g.minGoblins;
  },
};

/** Chieftain's Command: every goblin (and goblin kin) hits harder while a Chieftain lives. */
const chieftainCommand: Mechanic = {
  id: 'chieftainCommand',
  appliesTo: () => true,
  buffSources(state, e, rules) {
    if (!isGoblinKin(e.kind, state.encounter, rules) || !awake(state).some((x) => behaviorFor(state, x, rules) === 'chieftain')) return [];
    return [{ icon: '👑', name: rules.combat.chieftainCommand.name, bonus: rules.combat.chieftainCommand.bonus }];
  },
  specials: {
    // Call to Arms: fresh goblins join now and fight from next round.
    chieftain: {
      run(state, enemy, _dmg, rules) {
        const sp = rules.combat.specials;
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
            fumbles: 0,
          };
          state.enemies.push(makeEnemy(spec, state.round, enemy.wave));
          fresh.push(spec.id);
        }
        log(state, 'enemy', `${enemy.name} uses ${sp.chieftain.name}: ${n} goblins join the fight.`, enemy.id, fresh, `⚠ ${sp.chieftain.short}: +${n} goblins`);
        return true;
      },
    },
  },
};

/** Goblin Toss: the Ogre throws its weakest goblin at the weakest hero; with no goblins left it's Ground Slam. */
const goblinToss: Mechanic = {
  id: 'goblinToss',
  appliesTo: () => false,
  specials: {
    goblinToss: {
      resolve(state, _e, info, rules) {
        if (state.enemies.some((x) => x.alive && x.kind === 'goblin')) return info;
        const slam = rules.combat.specials.ogre;
        return { key: 'ogre', name: slam.name, short: slam.short, description: slam.description };
      },
      run(state, enemy, dmg, rules) {
        const sp = rules.combat.specials;
        // The weakest goblin is spent as the projectile; taunts can't stop a throw.
        const goblin = state.enemies.filter((x) => x.alive && x.kind === 'goblin').sort((a, b) => a.hp - b.hp)[0];
        const target = [...targetableHeroes(state)].sort((a, b) => a.hp - b.hp)[0];
        if (!goblin || !target) return false;
        goblin.alive = false;
        goblin.hp = 0;
        const hit = hitHero(state, enemy, target, Math.round(dmg * sp.goblinToss.multiplier), rules);
        log(state, 'enemy', `${enemy.name} hurls ${goblin.name} at the ${rules.classes[target.heroClass].name}: ${hit.text}.`, enemy.id, [target.id, goblin.id], `⚠ ${sp.goblinToss.short} → ${hit.short}`);
        return true;
      },
    },
  },
};

/** Dirty Arrows (and any `poisonOnHit` monster): hits that draw blood also poison. */
const poisonOnHit: Mechanic = {
  id: 'poisonOnHit',
  appliesTo: (enc) => Object.values(enc.monsters).some((m) => m?.poisonOnHit),
  onHeroHit(state, enemy, h, dealt, rules) {
    const dirty = encounterOf(state.encounter, rules).monsters[enemy.kind]?.poisonOnHit;
    if (!dirty || dealt <= 0 || h.hp <= 0) return '';
    h.poison = { perRound: dirty.perRound, rounds: dirty.rounds, sourceId: enemy.id };
    return ', poisoned';
  },
};

export const goblinHorde: Mechanic[] = [packTactics, packGuard, chieftainCommand, goblinToss, poisonOnHit];

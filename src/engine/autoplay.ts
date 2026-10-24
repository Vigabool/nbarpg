import { rules as defaultRules, type Rules } from '../rules';
import { actionDamage, canFumble, endRound, justArrived, listActions, livingEnemies, pickableEnemies, performAction, spendFumble, type ActionOption, type BattleState, type HeroAction, type HeroState } from './combat';

/**
 * A simple rule-based player used by the batch simulator and tests. It is not
 * optimal; it gives a baseline for balance (a thoughtful human should beat it).
 */
export function chooseAction(
  state: BattleState,
  hero: HeroState,
  rules: Rules = defaultRules,
  exclude: Set<string> = new Set(),
): HeroAction | null {
  const opts = listActions(state, hero.id, rules).filter((o) => o.available && !exclude.has(o.def.id));
  if (opts.length === 0) return null;
  const has = (id: string) => opts.find((o) => o.def.id === id);
  // Only enemies a single-target attack can pick (the guarded Shaman is skipped).
  const enemies = pickableEnemies(state, rules);
  const byHpAsc = [...enemies].sort((a, b) => a.hp - b.hp);
  // An exposed Phylactery comes first: it halves damage to the Lich.
  const phyl = (e: { kind: string }) => (e.kind === 'phylactery' ? 1 : 0);
  const byThreat = [...enemies].sort((a, b) => phyl(b) - phyl(a) || b.damage - a.damage || b.hp - a.hp);
  const allies = state.heroes.filter((h) => h.alive);
  const fallen = state.heroes.filter((h) => !h.alive);
  const act = (o: ActionOption | undefined, targetIds: string[] = []): HeroAction | null =>
    o ? { heroId: hero.id, actionId: o.def.id, targetIds } : null;
  // Weapon attacks: spend on the advanced one while energy is comfortable, else build energy.
  const gear = () => {
    const advanced = opts.find((o) => o.source === 'gear' && o.def.cost !== undefined);
    if (advanced && hero.pool >= 10) {
      const target = [...advanced.validTargets].sort((a, b) => hpOf(a) - hpOf(b))[0];
      return act(advanced, [target]);
    }
    const g = opts.find((o) => o.source === 'gear' && o.def.cost === undefined && o.validTargets.length);
    return g && byHpAsc.length ? act(g, [byHpAsc[0].id]) : null;
  };
  const hpOf = (id: string) => enemies.find((e) => e.id === id)?.hp ?? Infinity;
  const totalEnemyHp = enemies.reduce((s, e) => s + e.hp, 0);

  switch (hero.heroClass) {
    case 'warrior': {
      if (has('last-stand') && hero.hp < hero.maxHp * 0.5) return act(has('last-stand'));
      if (has('bulwark') && enemies.length >= 4) return act(has('bulwark'));
      if (has('second-wind') && hero.hp <= hero.maxHp - 14) return act(has('second-wind'));
      const provoke = has('provoke');
      const threat = byThreat.find((e) => e.kind !== 'goblin' && !phyl(e) && !e.tauntedBy && provoke?.validTargets.includes(e.id));
      if (provoke && threat && hero.hp > hero.maxHp * 0.4) return act(provoke, [threat.id]);
      if (has('shield-wall') && enemies.length >= 5 && hero.pool >= 14) return act(has('shield-wall'));
      return gear();
    }
    case 'cleric': {
      if (has('divine-intervention') && fallen.length >= 2) return act(has('divine-intervention'));
      if (has('resurrect') && fallen.length) return act(has('resurrect'), [fallen[0].id]);
      const missing = allies.reduce((s, h) => s + (h.maxHp - h.hp), 0);
      if (has('sanctuary') && missing >= 35) return act(has('sanctuary'));
      const injured = allies.filter((h) => h.maxHp - h.hp >= 5);
      if (has('cure-all') && injured.length >= 3) return act(has('cure-all'));
      const worst = [...allies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (has('cure-wounds') && worst && worst.hp <= worst.maxHp * 0.6) return act(has('cure-wounds'), [worst.id]);
      const champ = byThreat.find((e) => e.kind !== 'goblin' && !phyl(e) && !e.weaken);
      if (has('curse') && champ && champ.damage >= 7) return act(has('curse'), [champ.id]);
      return gear();
    }
    case 'wizard': {
      // Make an intangible foe (the Crypt's Wraith) solid so the party can hit it.
      const ghost = livingEnemies(state).find((e) => e.intangible);
      const missile = has('magic-missile');
      if (ghost && missile?.validTargets.includes(ghost.id)) return act(missile, [ghost.id]);
      if (has('meteor') && totalEnemyHp >= 60) return act(has('meteor'));
      if (has('chain-lightning') && enemies.length >= 4) return act(has('chain-lightning'));
      if (has('fireball') && enemies.length >= 3) return act(has('fireball'), byHpAsc.slice(0, 3).map((e) => e.id));
      const big = byThreat.find((e) => e.hp >= 12);
      if (has('lightning-bolt') && big) return act(has('lightning-bolt'), [big.id]);
      const lowestArmor = Math.min(...state.heroes.filter((h) => h.alive).map((h) => h.armor));
      const hunterOut = enemies.some((e) => e.kind === 'hunter');
      if (has('shield') && hunterOut && hero.armor <= lowestArmor && hero.pool >= 12) return act(has('shield'));
      return gear();
    }
    case 'rogue': {
      const nonBoss = byThreat.find((e) => !e.isWarlord && e.kind !== 'goblin');
      if (has('assassinate') && nonBoss) return act(has('assassinate'), [nonBoss.id]);
      const taunted = byThreat.find((e) => e.tauntedBy && e.tauntedBy !== hero.id);
      if (has('backstab') && taunted) return act(has('backstab'), [taunted.id]);
      const tanky = byThreat.find((e) => e.hp >= 16 && !e.poison);
      if (has('venom-strike') && tanky) return act(has('venom-strike'), [tanky.id]);
      if (has('backstab') && byThreat[0] && byThreat[0].hp >= 10) return act(has('backstab'), [byThreat[0].id]);
      return gear();
    }
    case 'ranger': {
      if (has('call-of-the-pack')) return act(has('call-of-the-pack'));
      if (has('volley') && enemies.length >= 4) return act(has('volley'));
      if (has('summon-bear') && state.summons.filter((s) => s.alive).length < 2) return act(has('summon-bear'));
      if (has('summon-wolf') && state.summons.filter((s) => s.alive).length < 2 && hero.pool >= 14) return act(has('summon-wolf'));
      const big = byThreat.find((e) => e.hp >= 12);
      if (has('aimed-shot') && big) return act(has('aimed-shot'), [big.id]);
      if (has('double-strike') && byHpAsc.length) return act(has('double-strike'), byHpAsc.slice(0, 2).map((e) => e.id));
      return gear();
    }
  }
}

/** How the bot plays choices the simulator wants to compare. */
export interface BotPolicy {
  /** Open the battle with every hero's biggest single-target attack on a sleeping Dragon. */
  ambushDragon?: boolean;
}

/** Rough damage of an attack on one target, for picking the biggest hit (e.g. "12×2" → 24). */
const hitSize = (o: ActionOption, hero: HeroState) => {
  const d = actionDamage(o.def, hero);
  if (!d) return 0;
  const [a, b] = d.split('×').map(Number);
  return o.def.target.type === 'enemies' ? a : a * (b || 1);
};

function ambush(state: BattleState, rules: Rules): BattleState {
  const dragon = state.enemies.find((e) => e.alive && e.asleep);
  if (!dragon) return state;
  for (const h of state.heroes) {
    if (!h.alive || h.acted || h.prone) continue;
    const hero = state.heroes.find((x) => x.id === h.id)!;
    const best = listActions(state, h.id, rules)
      .filter((o) => o.available && o.attack && o.validTargets.includes(dragon.id))
      .sort((a, b) => hitSize(b, hero) - hitSize(a, hero))[0];
    if (best) state = performAction(state, { heroId: h.id, actionId: best.def.id, targetIds: [dragon.id] }, rules);
  }
  return state;
}

export function autoplay(initial: BattleState, rules: Rules = defaultRules, policy: BotPolicy = {}): BattleState {
  let state = initial;
  let guard = 0;
  if (policy.ambushDragon) state = ambush(state, rules);
  while (state.phase === 'party' && guard++ < 1000) {
    const order = ['warrior', 'cleric', 'ranger', 'rogue', 'wizard'];
    const ready = state.heroes.filter((h) => h.alive && !h.acted && !h.prone).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    const first = ready[0];
    if (!first) {
      // Spend every Fumble on an enemy that acts this round; they're lost when it dies.
      for (const e of state.enemies) if (canFumble(state, e) && !justArrived(state, e)) state = spendFumble(state, e.id);
      state = endRound(state, rules);
      continue;
    }
    // Utilities first (each at most once a round, to keep the bot simple), then one attack.
    const used = new Set<string>();
    for (let i = 0; i < 8 && state.phase === 'party'; i++) {
      const hero = state.heroes.find((h) => h.id === first.id)!;
      if (hero.acted || !hero.alive) break;
      const action = chooseAction(state, hero, rules, used);
      if (!action) break;
      state = performAction(state, action, rules);
      used.add(action.actionId);
    }
    // Nothing left worth doing: treat the hero as done for this round.
    state = { ...state, heroes: state.heroes.map((h) => (h.id === first.id ? { ...h, acted: true } : h)) };
  }
  return state;
}

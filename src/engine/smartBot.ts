import { rules as defaultRules, type Rules } from '../rules';
import {
  actionsThisRound,
  canFumble,
  endRound,
  enemyDamage,
  justArrived,
  listActions,
  performAction,
  previewRound,
  specialDue,
  spendFumble,
  toppleThreshold,
  type BattleState,
  type EnemyState,
  type HeroAction,
} from './combat';
import { mechanicsFor } from './encounters';

/** One thing the party can do right now. */
type Step = { kind: 'action'; action: HeroAction } | { kind: 'fumble'; enemyId: string };
/** A move is one step, or a buff followed by the attack that cashes it in (Ready Crit → Backstab). */
type Move = Step[];

/** What the evaluation cares about, in rough "HP" units. */
const W = {
  win: 10000,
  heroAlive: 40,
  heroHp: 1,
  energy: 0.25,
  /** Enemy HP left is the work still to do: worth more than a point of hero HP, so the bot presses on. */
  enemyHp: 1.5,
  /** Per point of damage an enemy deals per round (its threat). */
  enemyDamage: 1,
  /** A sleeping Dragon is less of a threat until it wakes. */
  asleepFactor: 0.5,
};

/**
 * How good a state is for the party, judged after the round ends: the round preview
 * plays the summons' and the horde's turn exactly as the game would.
 */
export function evaluate(state: BattleState, rules: Rules = defaultRules): number {
  const { after } = previewRound(state, rules);
  if (after.phase === 'won') return W.win - after.round;
  if (after.phase === 'lost') return -W.win;
  let v = 0;
  for (const h of after.heroes) if (h.alive) v += W.heroAlive + W.heroHp * h.hp + W.energy * h.pool;
  for (const e of after.enemies) {
    if (!e.alive) continue;
    const poison = e.poison ? e.poison.perRound * e.poison.rounds : 0;
    const threat = enemyDamage(after, e, rules) * actionsThisRound(e) * (e.asleep ? W.asleepFactor : 1);
    v -= W.enemyHp * Math.max(0, e.hp - poison) + W.enemyDamage * threat;
  }
  // Encounter rules add their own terms (bone piles, hoard coins, topple progress).
  for (const m of mechanicsFor(state, rules)) if (m.botScore) v = m.botScore(state, after, v, rules);
  return v;
}

/** Enemies worth aiming at: the most threatening, the weakest, and any about to topple or fire a special. */
function focusTargets(state: BattleState, valid: string[], rules: Rules, k = 4): string[] {
  const es = valid.map((id) => state.enemies.find((e) => e.id === id)!).filter(Boolean);
  const score = (e: EnemyState) => enemyDamage(state, e, rules) * actionsThisRound(e) + (specialDue(e, state.round, rules) ? 20 : 0);
  const toGo = (e: EnemyState) => {
    const t = toppleThreshold(state, e, rules);
    return t === null || e.toppled ? Infinity : t - (e.toppleDamage ?? 0);
  };
  const picks = new Set<string>();
  for (const sort of [
    (a: EnemyState, b: EnemyState) => score(b) - score(a),
    (a: EnemyState, b: EnemyState) => a.hp - b.hp,
    (a: EnemyState, b: EnemyState) => toGo(a) - toGo(b),
  ])
    for (const e of [...es].sort(sort).slice(0, 2)) picks.add(e.id);
  return [...picks].slice(0, k);
}

/** Every sensible move right now, with targets narrowed so the search stays fast. */
function steps(state: BattleState, rules: Rules): Step[] {
  const out: Step[] = [];
  for (const h of state.heroes) {
    if (!h.alive || h.prone) continue;
    for (const o of listActions(state, h.id, rules)) {
      if (!o.available) continue;
      const t = o.def.target;
      const act = (targetIds: string[]) => out.push({ kind: 'action', action: { heroId: h.id, actionId: o.def.id, targetIds } });
      // Next-attack buffs only count together with the attack that uses them (see moves()).
      if (o.def.effects.some((e) => e.type === 'nextAttackMultiplier') && !o.attack) continue;
      switch (t.type) {
        case 'enemy':
          for (const id of focusTargets(state, o.validTargets, rules)) act([id]);
          break;
        case 'enemies': {
          // A few groupings: the most threatening, the weakest.
          const byThreat = focusTargets(state, o.validTargets, rules, o.validTargets.length);
          const byHp = [...o.validTargets].sort((a, b) => state.enemies.find((e) => e.id === a)!.hp - state.enemies.find((e) => e.id === b)!.hp);
          for (const group of [byThreat.slice(0, t.count), byHp.slice(0, t.count)]) if (group.length) act(group);
          break;
        }
        case 'ally': {
          const allies = o.validTargets
            .map((id) => state.heroes.find((x) => x.id === id)!)
            .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp) || b.gear - a.gear)
            .slice(0, 2);
          for (const a of allies) act([a.id]);
          break;
        }
        case 'fallenAlly':
          for (const id of o.validTargets.slice(0, 2)) act([id]);
          break;
        default:
          act([]);
      }
    }
  }
  for (const e of state.enemies) if (canFumble(state, e) && !justArrived(state, e)) out.push({ kind: 'fumble', enemyId: e.id });
  return out;
}

/** Single steps, plus each next-attack buff (Ready Crit, Empower) paired with the buffed hero's attacks. */
function moves(state: BattleState, rules: Rules): Move[] {
  const out: Move[] = steps(state, rules).map((s) => [s]);
  for (const h of state.heroes) {
    if (!h.alive || h.prone) continue;
    for (const o of listActions(state, h.id, rules)) {
      if (!o.available || o.attack || !o.def.effects.some((e) => e.type === 'nextAttackMultiplier')) continue;
      const targets =
        o.def.target.type === 'self'
          ? [h.id]
          : o.validTargets.filter((id) => {
              const a = state.heroes.find((x) => x.id === id);
              return a && a.alive && !a.acted && !a.prone && a.id !== h.id;
            });
      for (const t of targets.slice(0, 3)) {
        const buff: Step = { kind: 'action', action: { heroId: h.id, actionId: o.def.id, targetIds: o.def.target.type === 'self' ? [] : [t] } };
        let buffed: BattleState;
        try {
          buffed = apply(state, [buff], rules);
        } catch {
          continue;
        }
        for (const s of steps(buffed, rules))
          if (s.kind === 'action' && s.action.heroId === t && listActions(buffed, t, rules).find((x) => x.def.id === s.action.actionId)?.attack)
            out.push([buff, s]);
      }
    }
  }
  return out;
}

function apply(state: BattleState, m: Move, rules: Rules): BattleState {
  let s = state;
  for (const step of m) s = step.kind === 'fumble' ? spendFumble(s, step.enemyId) : performAction(s, step.action, rules);
  return s;
}

/**
 * A one-step lookahead player: at each step it tries every sensible move, previews how the
 * round would end, and takes the best one; it ends the round when no move beats ending it now.
 * Slower than the heuristic bot (autoplay), but it plays much more like a thoughtful human.
 */
export function smartAutoplay(initial: BattleState, rules: Rules = defaultRules): BattleState {
  let state = initial;
  for (let guard = 0; state.phase === 'party' && guard < 400; guard++) {
    const now = evaluate(state, rules);
    let best: { state: BattleState; v: number } | null = null;
    for (const m of moves(state, rules)) {
      let next: BattleState;
      try {
        next = apply(state, m, rules);
      } catch {
        continue;
      }
      const v = next.phase === 'won' ? W.win : evaluate(next, rules);
      if (!best || v > best.v) best = { state: next, v };
    }
    if (best && best.v > now + 0.5) state = best.state;
    else state = endRound(state, rules);
  }
  return state;
}

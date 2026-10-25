import { landingWarning, toppleThreshold, hoardBonus, type BattleState, type EnemyState } from '../../engine/combat';
import { rules } from '../../rules';
import { behaviorOf } from '../../engine/encounter';

/** Topple: damage this round toward knocking a giant down. */
export function ToppleBar({ e, state }: { e: EnemyState; state: BattleState }) {
  const t = toppleThreshold(state, e);
  if (t === null) return null;
  if (e.toppled) return <div className="topple-bar down">⛰️ Toppled: loses its next turn</div>;
  const n = Math.min(t, e.toppleDamage ?? 0);
  // One more hit could topple it, and the landing would drop someone.
  const drops = landingWarning(state, e).map((h) => rules.classes[h.heroClass].name);
  const warn = drops.length ? ` · landing drops the ${drops.join(', the ')}` : '';
  return (
    <div
      className={`topple-bar${warn ? ' danger' : ''}`}
      role="meter"
      aria-label={`Topple: ${n} of ${t} damage this round${warn}`}
      aria-valuenow={n}
      aria-valuemax={t}
      title={warn ? `Toppling it now: the landing deals ${rules.combat.topple.crashDamage} to every hero` : undefined}
    >
      <span style={{ width: `${(n / t) * 100}%` }} />
      <b className="num">
        ⛰️ {n}/{t}
        {warn && ' ☠'}
      </b>
    </div>
  );
}

/** Hoard Tithe: coins on the sleeping Dragon's hoard and what they're worth. */
export function HoardTag({ state }: { state: BattleState }) {
  const h = state.hoard!;
  const dragon = state.enemies.find((e) => behaviorOf(e.kind, state.encounter) === 'dragon');
  const bonus = dragon ? hoardBonus(state, dragon) : 0;
  return (
    <span
      className={`tag static hoard${h.sealed ? ' sealed' : ''}`}
      aria-label={`Hoard: ${h.coins} coins, Dragon +${bonus} damage${h.sealed ? ', sealed' : ''}`}
      title={rules.combat.hoardTithe.description}
    >
      💰 {h.coins} · Dragon +{bonus}
      {h.sealed ? ' · sealed' : ''}
    </span>
  );
}

export const sleepText = (e: EnemyState) =>
  e.waking
    ? `💢 Stirring: wakes at the end of this round and breathes fire (${rules.combat.dragonSleep.rudeAwakening.name})`
    : `💤 Asleep · hits deal ×${rules.combat.dragonSleep.damageMultiplier} and wake it`;

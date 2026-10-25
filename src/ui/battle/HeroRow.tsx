import type { BattleState, HeroState, SummonState } from '../../engine/combat';
import { rules } from '../../rules';
import { CLASS_ICON } from '../common';
import { Meter, Tag, foeShort, foeIcon } from './parts';

export function HeroRow({
  h,
  netted,
  doomed,
  threatOn,
  onThreat,
  selected,
  targetable,
  onClick,
}: {
  h: HeroState;
  netted: boolean;
  doomed: boolean;
  threatOn: boolean;
  onThreat: () => void;
  selected: boolean;
  targetable: boolean;
  onClick: () => void;
}) {
  const cls = rules.classes[h.heroClass];
  const state = !h.alive ? 'fallen' : h.prone ? 'done prone' : h.acted ? 'done' : 'ready';
  return (
    <div
      className={`hero-row ${state}${selected ? ' selected' : ''}${targetable ? ' target' : ''}${threatOn ? ' threat' : ''}`}
      onClick={onClick}
      role="button"
      aria-pressed={selected}
    >
      <div className="h-name">
        <span className="h-class">
          {CLASS_ICON[h.heroClass]} {cls.name}
          {state === 'done' && (
            <span className="h-state" aria-label="Done">
              ✓
            </span>
          )}
          {state === 'fallen' && (
            <span className="h-state" aria-label="Fallen">
              💀
            </span>
          )}
          {doomed && (
            <button
              type="button"
              className={`doom${threatOn ? ' on' : ''}`}
              aria-label={`${cls.name} falls if the round ends now: show where the damage comes from`}
              aria-pressed={threatOn}
              onClick={(ev) => {
                ev.stopPropagation();
                onThreat();
              }}
            >
              ☠
            </button>
          )}
        </span>
        <span className="h-player">{h.name}</span>
      </div>
      <div className="h-hp">
        <Meter kind="hp" value={h.hp} max={h.maxHp} />
      </div>
      <div className="h-pool">
        <Meter kind="pool" value={h.pool} max={Math.max(h.startingPool, 1)} />
      </div>
      <div className="h-tags">
        <Tag passThrough icon={`⚔${h.gear}`} text={`Gear attacks deal ${h.gear}`} />
        {h.armor > 0 && <Tag passThrough icon={`⛨${h.armor}`} text={`+${h.armor} armor this round`} tone="shield" />}
        {h.nextAttackMultiplier > 1 && (
          <Tag passThrough icon={`✦×${h.nextAttackMultiplier}`} text={`Next attack deals ×${h.nextAttackMultiplier}`} tone="good" />
        )}
        {h.curse && <Tag passThrough icon={`↓${h.curse.amount}`} text={`Cursed: −${h.curse.amount} damage for ${h.curse.rounds} turns`} tone="curse" />}
        {h.poison && (
          <Tag
            passThrough
            icon={`☣${h.poison.perRound}`}
            text={`Poisoned: ${h.poison.perRound} damage after the horde acts, ${h.poison.rounds} more time${h.poison.rounds > 1 ? 's' : ''}`}
            tone="poison"
          />
        )}
        {h.prone && <Tag passThrough icon="⤵" text="Prone: can't act this round" tone="warn" />}
        {netted && <Tag passThrough icon="🪤" text="Netted: no attack this round (utilities still work)" tone="warn" />}
        {h.skipNextTurn && <Tag passThrough icon="⤵" text="Knocked prone: skips next round" tone="warn" />}
        {h.untargetableRounds > 0 && <Tag passThrough icon="👻" text="Untargetable this round" tone="good" />}
        {h.lastStand && <Tag passThrough icon="⚑" text="Last Stand: can't drop below 1 HP" tone="taunt" />}
        {h.signatureReady && <Tag passThrough icon="★" text="Signature ability ready (double-double)" tone="taunt" />}
        {h.legendaryReady && <Tag passThrough icon="✪" text="Legendary ability ready (triple-double)" tone="taunt" />}
      </div>
    </div>
  );
}

/** Where the damage that drops a hero this round comes from. */
export function ThreatCallout({ h, from, state, onClose }: { h: HeroState; from: Record<string, number>; state: BattleState; onClose: () => void }) {
  const total = Object.values(from).reduce((t, n) => t + n, 0);
  // Minions of one team hit as a group, like their card.
  const rows = new Map<string, { icon: string; label: string; count: number; dmg: number }>();
  for (const [id, dmg] of Object.entries(from)) {
    const e = state.enemies.find((x) => x.id === id);
    if (!e) continue;
    const key = e.kind === 'goblin' ? `g:${e.name}` : id;
    const row = rows.get(key) ?? { icon: foeIcon(e, state.encounter), label: e.kind === 'goblin' ? e.name : foeShort(e, state.encounter), count: 0, dmg: 0 };
    row.count++;
    row.dmg += dmg;
    rows.set(key, row);
  }
  return (
    <div className="threat-callout" role="status">
      <div className="spread">
        <strong className="small">
          ☠ {rules.classes[h.heroClass].name} falls: {total} incoming, {h.hp} HP
        </strong>
        <button className="btn ghost small" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {[...rows.values()]
          .sort((a, b) => b.dmg - a.dmg)
          .map((r) => (
            <span key={r.label} className="tag static threat-src num">
              {r.icon} {r.label}
              {r.count > 1 ? ` ×${r.count}` : ''} <b>{r.dmg}</b>
            </span>
          ))}
      </div>
      <span className="tiny muted">Heal, shield, taunt or kill these before ending the round.</span>
    </div>
  );
}

export function SummonRow({ s, state, intent }: { s: SummonState; state: BattleState; intent?: string[] }) {
  const taunting = state.enemies.filter((e) => e.alive && e.tauntedBy === s.id).length;
  return (
    <div className="hero-row summon">
      <div className="h-name">
        <span className="h-class">
          {s.kind === 'bear' ? '🐻' : '🐺'} {s.name}
        </span>
        <span className="h-player">{intent?.length ? <span className="u-intent">{intent.join(' · ')}</span> : 'Summon'}</span>
      </div>
      <div className="h-hp">
        <Meter kind="hp" value={s.hp} max={s.maxHp} />
      </div>
      <div className="h-tags">
        <Tag icon={`⚔${s.damage}`} text={`Bites the weakest enemy for ${s.damage} each round`} />
        {taunting > 0 && <Tag icon={`⚑${taunting}`} text={`Taunting ${taunting} enemies`} tone="taunt" />}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeasonData } from '../data/types';
import { finishBattle, type SaveGame } from '../app/game';
import {
  endRound,
  enemyArmor,
  listActions,
  performAction,
  previewEnemyPhase,
  type ActionOption,
  type BattleState,
  type EnemyState,
  type HeroState,
  type SummonState,
} from '../engine/combat';
import { rules, type HeroClass } from '../rules';
import { Bar, CLASS_ICON, MONSTER_ICON, TierChip } from './common';

export function BattleScreen({ game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const state = game.battle!;
  const [selected, setSelected] = useState<HeroClass | null>(() => firstReady(state));
  const [action, setAction] = useState<ActionOption | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [undo, setUndo] = useState<BattleState[]>([]);
  const [error, setError] = useState<string | null>(null);

  const setBattle = (b: BattleState) => onChange({ ...game, battle: b });
  const intents = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const l of previewEnemyPhase(state)) {
      const e = state.enemies.find((x) => x.id === l.actorId);
      if (!e) continue;
      const text = l.text.startsWith(e.name) ? l.text.slice(e.name.length + 1) : l.text;
      (map[e.id] ??= []).push(text.replace(/^attacks: /, '').replace(/\.$/, ''));
    }
    return map;
  }, [state]);

  const hero = selected ? state.heroes.find((h) => h.id === selected) : undefined;
  const options = hero ? listActions(state, hero.id) : [];
  const targeting = action && ['enemy', 'enemies', 'ally', 'fallenAlly'].includes(action.def.target.type);

  const run = (opt: ActionOption, targetIds: string[]) => {
    try {
      const next = performAction(state, { heroId: hero!.id, actionId: opt.def.id, targetIds });
      setUndo((u) => [...u, state]);
      setBattle(next);
      setAction(null);
      setMulti([]);
      setError(null);
      setSelected(firstReady(next));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const chooseAction = (opt: ActionOption) => {
    setError(null);
    setMulti([]);
    const t = opt.def.target.type;
    if (t === 'none' || t === 'self' || t === 'allEnemies' || t === 'allAllies' || t === 'allFallen') run(opt, []);
    else setAction(opt);
  };

  const clickTarget = (id: string) => {
    if (!action || !action.validTargets.includes(id)) return;
    if (action.def.target.type === 'enemies') {
      const max = action.def.target.count;
      setMulti((m) => (m.includes(id) ? m.filter((x) => x !== id) : m.length < max ? [...m, id] : m));
    } else run(action, [id]);
  };

  const doEndRound = () => {
    const next = endRound(state);
    setUndo([]);
    setAction(null);
    setBattle(next);
    setSelected(firstReady(next));
  };

  const over = state.phase !== 'party';
  const waiting = state.heroes.filter((h) => h.alive && !h.acted).length;

  return (
    <div className="stack">
      <div className="battle-head spread">
        <div>
          <h2>
            Wave {state.waveIndex + 1}/{state.waveCount} · Round {state.round}/{rules.combat.roundCap}
          </h2>
          <div className="tiny muted">The party acts in any order, then summons, then the horde.</div>
        </div>
        <div className="row">
          <button
            className="btn small"
            disabled={undo.length === 0 || over}
            onClick={() => {
              const prev = undo.at(-1)!;
              setUndo((u) => u.slice(0, -1));
              setBattle(prev);
              setAction(null);
              setSelected(firstReady(prev));
            }}
          >
            ↶ Undo
          </button>
          <button className="btn primary small" disabled={over} onClick={doEndRound}>
            {waiting > 0 ? `End round (${waiting} waiting)` : 'End round'}
          </button>
        </div>
      </div>

      {over && (
        <div className="card stack" style={{ borderColor: state.phase === 'won' ? 'var(--good)' : 'var(--danger)' }}>
          <h1 className="serif">{state.phase === 'won' ? 'Victory!' : 'Defeat'}</h1>
          <p className="muted">{state.outcomeReason}</p>
          <button className="btn primary" onClick={() => onChange(finishBattle(game))}>
            See rewards →
          </button>
        </div>
      )}

      <section className="stack" style={{ gap: 8 }}>
        <div className="spread">
          <h3>The horde</h3>
          {targeting && action?.def.target.type.startsWith('enemy') && (
            <span className="small" style={{ color: 'var(--info)' }}>
              Choose {action.def.target.type === 'enemies' ? `up to ${action.def.target.count} targets` : 'a target'} for {action.def.name}
            </span>
          )}
        </div>
        <div className="enemy-grid">
          {state.enemies.filter((e) => e.alive).map((e) => (
            <EnemyCard
              key={e.id}
              e={e}
              state={state}
              intent={intents[e.id]}
              targetable={!!(targeting && action!.validTargets.includes(e.id) && action!.def.target.type.startsWith('enem'))}
              targeted={multi.includes(e.id)}
              onClick={() => clickTarget(e.id)}
            />
          ))}
        </div>
        {state.enemies.some((e) => !e.alive) && (
          <div className="tiny faint">{state.enemies.filter((e) => !e.alive).length} defeated this wave</div>
        )}
        {state.pendingWaves.length > 0 && (
          <div className="tiny faint">
            Still to come:{' '}
            {state.pendingWaves
              .map((w, i) => `Wave ${state.waveIndex + 2 + i} (${w.length} monsters${w.some((m) => m.isWarlord) ? ', incl. the Warlord' : ''})`)
              .join(' · ')}
          </div>
        )}
        {action?.def.target.type === 'enemies' && (
          <div className="row">
            <button className="btn primary small" disabled={multi.length === 0} onClick={() => run(action, multi)}>
              Cast {action.def.name} on {multi.length}
            </button>
            <button className="btn ghost small" onClick={() => setAction(null)}>
              Cancel
            </button>
          </div>
        )}
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <h3>Your party</h3>
        <div className="hero-grid">
          {state.heroes.map((h) => {
            const allyTarget = !!(targeting && (action!.def.target.type === 'ally' || action!.def.target.type === 'fallenAlly') && action!.validTargets.includes(h.id));
            return (
              <HeroCard
                key={h.id}
                h={h}
                selected={selected === h.id && !allyTarget}
                targetable={allyTarget}
                onClick={() => {
                  if (allyTarget) return run(action!, [h.id]);
                  if (!over && h.alive) {
                    setSelected(h.id);
                    setAction(null);
                  }
                }}
              />
            );
          })}
          {state.summons.filter((s) => s.alive).map((s) => (
            <SummonCard key={s.id} s={s} state={state} />
          ))}
        </div>
      </section>

      <BattleLog state={state} />

      {hero && !over && (
        <section className="action-sheet stack">
          <div className="spread">
            <h3>
              {CLASS_ICON[hero.heroClass]} {rules.classes[hero.heroClass].name} · {hero.name}
            </h3>
            <span className="row">
              <span className="small num" style={{ color: 'var(--info)' }}>
                {hero.pool} {rules.classes[hero.heroClass].poolName.toLowerCase()}
              </span>
              <button className="btn ghost small" aria-label="Hide actions" onClick={() => { setSelected(null); setAction(null); }}>
                ✕
              </button>
            </span>
          </div>
          {action && targeting && action.def.target.type !== 'enemies' && (
            <div className="row small">
              <span style={{ color: 'var(--info)' }}>Choose a target for {action.def.name}.</span>
              <button className="btn ghost small" onClick={() => setAction(null)}>
                Cancel
              </button>
            </div>
          )}
          {error && <div className="warn small">{error}</div>}
          <div className="actions">
            {options.map((o) => (
              <button
                key={o.def.id}
                className={`btn action${o.def.unlock ? ' sig' : ''}${action?.def.id === o.def.id ? ' selected' : ''}`}
                disabled={!o.available}
                onClick={() => chooseAction(o)}
                title={o.reason}
              >
                <span className="spread">
                  <strong>{o.def.name}</strong>
                  <span className="cost tiny">
                    {o.source === 'gear' ? 'Gear' : o.def.unlock ? (o.def.unlock === 'signature' ? 'Signature' : 'Legendary') : o.def.cost}
                  </span>
                </span>
                <span className="tiny muted">{o.def.description.replace(/\bG\b/g, String(hero.gear))}</span>
                {!o.available && o.reason && <span className="tiny faint">{o.reason}</span>}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function firstReady(s: BattleState): HeroClass | null {
  return s.heroes.find((h) => h.alive && !h.acted)?.id ?? null;
}

function nameOf(state: BattleState, id: string): string {
  const h = state.heroes.find((x) => x.id === id);
  if (h) return rules.classes[h.heroClass].name;
  return state.summons.find((s) => s.id === id)?.name ?? id;
}

function EnemyCard({
  e,
  state,
  intent,
  targetable,
  targeted,
  onClick,
}: {
  e: EnemyState;
  state: BattleState;
  intent?: string[];
  targetable: boolean;
  targeted: boolean;
  onClick: () => void;
}) {
  const [kindName, playerName] = e.name.split(' · ');
  const weaken = e.weaken?.amount ?? 0;
  return (
    <div
      className={`card unit${e.alive ? '' : ' dead'}${e.isWarlord ? ' warlord' : e.kind !== 'goblin' ? ' champion' : ' minion'}${targetable ? ' target' : ''}${targeted ? ' targeted' : ''}`}
      onClick={targetable ? onClick : undefined}
      role={targetable ? 'button' : undefined}
    >
      <div className="spread" style={{ alignItems: 'flex-start' }}>
        <div className="name">
          {MONSTER_ICON[e.kind]} {kindName}
          {playerName && <div className="tiny muted">{playerName}</div>}
        </div>
        {e.tier && <TierChip tier={e.tier} />}
      </div>
      <Bar kind="hp" value={e.hp} max={e.maxHp} label={<><span>HP</span><span>{e.hp}/{e.maxHp}</span></>} />
      <div className="row tiny">
        <span className="chip">⚔ {Math.max(0, e.damage - weaken)}{e.isWarlord ? ' ×2' : ''}</span>
        {e.tauntedBy && <span className="chip status-taunt">Taunted: {nameOf(state, e.tauntedBy)}</span>}
        {e.poison && <span className="chip status-poison">Poison {e.poison.perRound}×{e.poison.rounds}</span>}
        {e.weaken && <span className="chip status-curse">−{e.weaken.amount} dmg ({e.weaken.rounds}r)</span>}
        {enemyArmor(e) > 0 && <span className="chip status-shield">+{enemyArmor(e)} armor</span>}
        {e.staggers > 0 && <span className="chip">Stagger ×{e.staggers}</span>}
      </div>
      {e.alive && intent && intent.length > 0 && <div className="intent">→ {intent.join(' · ')}</div>}
    </div>
  );
}

function HeroCard({ h, selected, targetable, onClick }: { h: HeroState; selected: boolean; targetable: boolean; onClick: () => void }) {
  const cls = rules.classes[h.heroClass];
  return (
    <div
      className={`card unit hero-card selectable${selected ? ' selected' : ''}${targetable ? ' target' : ''}${h.alive ? '' : ' dead'}`}
      onClick={onClick}
      role="button"
      style={!h.alive && targetable ? { opacity: 1 } : undefined}
    >
      <div className="name">
        {CLASS_ICON[h.heroClass]} {cls.name}
        <div className="tiny muted">{h.name}</div>
      </div>
      {h.alive && h.acted && <span className="chip acted">Done</span>}
      {!h.alive && <span className="chip acted warn">Fallen</span>}
      <Bar kind="hp" value={h.hp} max={h.maxHp} label={<><span>HP</span><span>{h.hp}/{h.maxHp}</span></>} />
      <Bar kind="pool" value={h.pool} max={Math.max(h.startingPool, 1)} label={<><span>{cls.poolName}</span><span>{h.pool}</span></>} />
      <div className="row tiny">
        <span className="chip">Gear {h.gear}</span>
        {h.armor > 0 && <span className="chip status-shield">+{h.armor} armor</span>}
        {h.nextAttackMultiplier > 1 && <span className="chip status-good">Next ×{h.nextAttackMultiplier}</span>}
        {h.curse && <span className="chip status-curse">Cursed −{h.curse.amount}</span>}
        {h.skipNextTurn && <span className="chip warn">Prone</span>}
        {h.untargetableRounds > 0 && <span className="chip status-good">Untargetable</span>}
        {h.lastStand && <span className="chip status-taunt">Last Stand</span>}
        {h.signatureReady && <span className="chip status-taunt">Signature</span>}
        {h.legendaryReady && <span className="chip status-taunt">Legendary</span>}
      </div>
    </div>
  );
}

function SummonCard({ s, state }: { s: SummonState; state: BattleState }) {
  const taunting = state.enemies.filter((e) => e.alive && e.tauntedBy === s.id).length;
  return (
    <div className="card unit flat">
      <div className="name">
        {s.kind === 'bear' ? '🐻' : '🐺'} {s.name} <span className="tiny muted">summon</span>
      </div>
      <Bar kind="hp" value={s.hp} max={s.maxHp} label={<><span>HP</span><span>{s.hp}/{s.maxHp}</span></>} />
      <div className="row tiny">
        <span className="chip">⚔ {s.damage}/round</span>
        {taunting > 0 && <span className="chip status-taunt">Taunting {taunting}</span>}
      </div>
    </div>
  );
}

function BattleLog({ state }: { state: BattleState }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [state.log.length]);
  return (
    <details className="card flat" open>
      <summary className="small muted" style={{ cursor: 'pointer' }}>
        Battle log
      </summary>
      <div className="log" ref={ref}>
        {state.log.map((l, i) => (
          <div key={i} className={l.side}>
            <span className="faint num">R{l.round}</span> {l.text}
          </div>
        ))}
      </div>
    </details>
  );
}

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeasonData } from '../data/types';
import { finishBattle, type SaveGame } from '../app/game';
import {
  endRound,
  enemyArmor,
  justArrived,
  listActions,
  performAction,
  previewEnemyPhase,
  actionDamage,
  energyGain,
  enemyDamage,
  packBonus,
  specialDue,
  nextWaveRound,
  specialOf,
  ignoresTaunt,
  isGuarded,
  type ActionOption,
  type BattleState,
  type EnemyState,
  type HeroState,
  type LogEntry,
  type SummonState,
} from '../engine/combat';
import { rules, type HeroClass, type Tier } from '../rules';
import { CLASS_ICON, ConfirmButton, MONSTER_ICON, TIER_LABEL, TierChip, statLine, weekLabel } from './common';

interface Props {
  data: SeasonData;
  game: SaveGame;
  onChange: (g: SaveGame) => void;
  onHelp: () => void;
  onQuit: () => void;
}

export function BattleScreen({ data, game, onChange, onHelp, onQuit }: Props) {
  const state = game.battle!;
  const [selected, setSelected] = useState<HeroClass | null>(() => firstReady(state));
  const [action, setAction] = useState<ActionOption | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [undo, setUndo] = useState<BattleState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const setBattle = (b: BattleState) => onChange({ ...game, battle: b });
  const intents = useMemo(() => {
    const map: Record<string, Intent> = {};
    for (const l of previewEnemyPhase(state)) {
      const e = state.enemies.find((x) => x.id === l.actorId);
      if (!e) continue;
      const i = (map[e.id] ??= { short: [], full: [] });
      i.short.push(l.short ?? l.text);
      i.full.push(l.text);
    }
    return map;
  }, [state]);
  const [detail, setDetail] = useState<string[] | null>(null);

  const hero = selected ? state.heroes.find((h) => h.id === selected) : undefined;
  const options = hero ? listActions(state, hero.id) : [];
  const targetType = action?.def.target.type;
  const targeting = !!action && (targetType === 'enemy' || targetType === 'enemies' || targetType === 'ally' || targetType === 'fallenAlly');
  const enemyTargeting = targeting && (targetType === 'enemy' || targetType === 'enemies');

  const run = (opt: ActionOption, targetIds: string[]) => {
    try {
      const next = performAction(state, { heroId: hero!.id, actionId: opt.def.id, targetIds });
      setUndo((u) => [...u, state]);
      setBattle(next);
      setAction(null);
      setMulti([]);
      setError(null);
      // After an attack, move on to the next hero; after a utility, stay to allow more.
      if (opt.attack) setSelected(firstReady(next));
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
    setMulti([]);
    setBattle(next);
    setSelected(firstReady(next));
  };

  const over = state.phase !== 'party';
  const waiting = state.heroes.filter((h) => h.alive && !h.acted && !h.prone).length;
  const living = state.enemies.filter((e) => e.alive);
  const champions = living.filter((e) => e.kind !== 'goblin');
  const goblinGroups = groupGoblins(living.filter((e) => e.kind === 'goblin'));
  const isEnemyTarget = (id: string) => enemyTargeting && action!.validTargets.includes(id);
  const next = state.pendingWaves[0];
  const nextAt = nextWaveRound(state);
  const inRounds = nextAt === null ? null : nextAt - state.round;

  return (
    <div className="battle">
      <header className="battle-bar">
        <div className="bar-status num">
          <strong>
            W{state.waveIndex + 1}/{state.waveCount} · R{state.round}/{rules.combat.roundCap}
          </strong>
          {next && inRounds !== null && (
            <span className={`chip${inRounds <= 1 ? ' wave-soon' : ''}`} title={`Wave ${state.waveIndex + 2}: ${next.length} monsters`}>
              W{state.waveIndex + 2} {inRounds <= 1 ? 'next round' : `in ${inRounds}`} · {next.length}
              {next.some((m) => m.isWarlord) ? ' + Warlord' : ''}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <button
            className="btn small icon-only"
            aria-label="Undo last action"
            title="Undo last action"
            disabled={undo.length === 0 || over}
            onClick={() => {
              const prev = undo.at(-1)!;
              setUndo((u) => u.slice(0, -1));
              setBattle(prev);
              setAction(null);
              setMulti([]);
              setSelected(firstReady(prev));
            }}
          >
            ↶
          </button>
          <button className="btn primary small" disabled={over} onClick={doEndRound}>
            End round{waiting > 0 && <span className="badge">{waiting}</span>}
          </button>
          <div className="menu-wrap">
            <button className="btn small icon-only" aria-label="Menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              ☰
            </button>
            {menuOpen && (
              <div className="menu" role="menu">
                <div className="tiny muted">{weekLabel(data, game.weekIndex)}</div>
                <button
                  className="btn ghost small block"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onHelp();
                  }}
                >
                  How to play
                </button>
                <button
                  className="btn ghost small block"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    setLogOpen(true);
                  }}
                >
                  Battle log
                </button>
                <ConfirmButton className="btn ghost small block" confirmLabel="Tap again to abandon run" onConfirm={onQuit}>
                  Quit run
                </ConfirmButton>
              </div>
            )}
          </div>
        </div>
      </header>

      <Ticker log={state.log} onOpen={() => setLogOpen(true)} />

      {over && (
        <div className="card stack" style={{ borderColor: state.phase === 'won' ? 'var(--good)' : 'var(--danger)' }}>
          <h1 className="serif">{state.phase === 'won' ? 'Victory!' : 'Defeat'}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {state.outcomeReason}
          </p>
          <button className="btn primary" onClick={() => onChange(finishBattle(game))}>
            See rewards →
          </button>
        </div>
      )}

      <div className="section-label">Horde</div>
      <div className="enemy-grid">
        {champions.map((e) => (
          <EnemyCard
            key={e.id}
            e={e}
            state={state}
            intent={intents[e.id]}
            targetable={isEnemyTarget(e.id)}
            targeted={multi.includes(e.id)}
            onClick={() => (isEnemyTarget(e.id) ? clickTarget(e.id) : setDetail([e.id]))}
          />
        ))}
        {goblinGroups.map((g) => (
          <GoblinStack
            key={g[0].id}
            goblins={g}
            state={state}
            intents={intents}
            isTarget={isEnemyTarget}
            targeted={multi}
            onPick={clickTarget}
            onDetail={() => setDetail(g.map((x) => x.id))}
          />
        ))}
      </div>

      <div className="section-label">Party</div>
      <div className="party">
        {state.heroes.map((h) => {
          const allyTarget = targeting && (targetType === 'ally' || targetType === 'fallenAlly') && action!.validTargets.includes(h.id);
          return (
            <HeroRow
              key={h.id}
              h={h}
              selected={selected === h.id && !allyTarget}
              targetable={allyTarget}
              onClick={() => {
                if (allyTarget) return run(action!, [h.id]);
                if (!over && h.alive) {
                  setSelected(h.id);
                  setAction(null);
                  setMulti([]);
                }
              }}
            />
          );
        })}
        {state.summons
          .filter((s) => s.alive)
          .map((s) => (
            <SummonRow key={s.id} s={s} state={state} />
          ))}
      </div>

      {hero && !over && (
        <section className="action-sheet" aria-label={`${rules.classes[hero.heroClass].name} actions`}>
          <div className="sheet-head">
            {targeting ? (
              <span className="small" style={{ color: 'var(--info)', minWidth: 0 }}>
                {targetType === 'enemies'
                  ? `${action!.def.name}: pick up to ${(action!.def.target as { count: number }).count} targets`
                  : `${action!.def.name}: pick a target`}
              </span>
            ) : (
              <strong className="small" style={{ minWidth: 0 }}>
                {CLASS_ICON[hero.heroClass]} {rules.classes[hero.heroClass].name}{' '}
                <span className="muted">· {hero.pool} energy</span>
              </strong>
            )}
            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              {targetType === 'enemies' && (
                <button className="btn primary small" disabled={multi.length === 0} onClick={() => run(action!, multi)}>
                  Cast on {multi.length}
                </button>
              )}
              {targeting ? (
                <button
                  className="btn ghost small"
                  onClick={() => {
                    setAction(null);
                    setMulti([]);
                  }}
                >
                  Cancel
                </button>
              ) : (
                <button
                  className={`btn ghost small icon-only${details ? ' on' : ''}`}
                  aria-pressed={details}
                  aria-label="Show ability details"
                  title="Show ability details"
                  onClick={() => setDetails((d) => !d)}
                >
                  ⓘ
                </button>
              )}
              <button
                className="btn ghost small icon-only"
                aria-label="Hide actions"
                onClick={() => {
                  setSelected(null);
                  setAction(null);
                  setMulti([]);
                }}
              >
                ✕
              </button>
            </div>
          </div>
          {error && <div className="warn small">{error}</div>}
          {!targeting && (
            <>
              <div className="action-group">
                <span>Attack</span>
                <span className="faint">{hero.acted ? 'used this round' : '1 per round'}</span>
              </div>
              <div className={`actions${details ? ' detailed' : ''}`}>
                {options.filter((o) => o.attack).map((o) => (
                  <ActionTile key={o.def.id} o={o} hero={hero} details={details} onPick={chooseAction} />
                ))}
              </div>
              <div className="action-group">
                <span>Utility</span>
                <span className="faint">any number, while energy lasts</span>
              </div>
              <div className={`actions${details ? ' detailed' : ''}`}>
                {options.filter((o) => !o.attack).map((o) => (
                  <ActionTile key={o.def.id} o={o} hero={hero} details={details} onPick={chooseAction} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {logOpen && <LogDrawer log={state.log} onClose={() => setLogOpen(false)} />}
      {detail && (
        <EnemyDetail
          enemies={detail.map((id) => state.enemies.find((e) => e.id === id)!).filter((e) => e && e.alive)}
          state={state}
          intents={intents}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function firstReady(s: BattleState): HeroClass | null {
  return s.heroes.find((h) => h.alive && !h.acted && !h.prone)?.id ?? null;
}

function ActionTile({
  o,
  hero,
  details,
  onPick,
}: {
  o: ActionOption;
  hero: HeroState;
  details: boolean;
  onPick: (o: ActionOption) => void;
}) {
  const dmg = actionDamage(o.def, hero);
  const gain = energyGain(o.def);
  const description = o.def.description.replace(/\bG\b/g, String(hero.gear));
  return (
    <button
      className={`btn action${o.def.unlock ? ' sig' : ''}`}
      disabled={!o.available}
      onClick={() => onPick(o)}
      title={`${description}${o.reason ? ` (${o.reason})` : ''}`}
    >
      <span className="action-top">
        <span className="action-name">{o.def.name}</span>
        {dmg && (
          <span className="action-dmg num" title="Damage">
            ⚔{dmg}
          </span>
        )}
        {gain ? (
          <span className="cost gain" title={`Gains ${gain} energy`}>
            +{gain}
          </span>
        ) : (
          <span className="cost">{o.def.unlock ? (o.def.unlock === 'signature' ? 'DD' : 'TD') : o.def.cost}</span>
        )}
      </span>
      {details && <span className="tiny muted">{description}</span>}
      {details && !o.available && o.reason && <span className="tiny faint">{o.reason}</span>}
    </button>
  );
}

/** Goblins with the same team and damage share one card. */
function groupGoblins(goblins: EnemyState[]): EnemyState[][] {
  const groups = new Map<string, EnemyState[]>();
  for (const g of goblins) {
    const key = `${g.name}|${g.damage}`;
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return [...groups.values()];
}

// ---------- Small pieces ----------

function Meter({ value, max, kind }: { value: number; max: number; kind: 'hp' | 'pool' }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`meter ${kind}${kind === 'hp' && pct > 50 ? ' ok' : ''}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <span style={{ width: `${pct}%` }} />
      <b className="num">{kind === 'hp' ? `${value}/${max}` : value}</b>
    </div>
  );
}

/** A compact status marker. Tap to show what it means. */
function Tag({ icon, text, tone = '', passThrough = false }: { icon: ReactNode; text: string; tone?: string; passThrough?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={`tag ${tone}`}
      title={text}
      aria-label={text}
      onClick={(e) => {
        // On hero rows the tap also selects the hero; on enemy cards it must not pick a target.
        if (!passThrough) e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {icon}
      {open && <span className="tag-text">{text}</span>}
    </button>
  );
}

function TierDot({ tier }: { tier: Tier }) {
  return <span className={`tier-dot tier-${tier}`} title={`${TIER_LABEL[tier]} night`} aria-label={`${TIER_LABEL[tier]} night`} />;
}

interface Intent {
  short: string[];
  full: string[];
}

/** Compact, non-interactive status icons for enemy cards. Details live in the detail sheet. */
function EnemyIcons({ e, state }: { e: EnemyState; state: BattleState }) {
  const special = specialOf(e);
  const rage = rules.combat.warlordEnrage;
  const icons: { icon: string; tone: string; label: string }[] = [];
  if (special && specialDue(e, state.round + 1)) icons.push({ icon: `⚠ ${special.short}`, tone: 'warn', label: `${special.name} next round` });
  if (e.enraged) icons.push({ icon: `🔥+${rage.damageBonus}`, tone: 'warn', label: 'Enraged' });
  if (e.drum && e.drum.round >= state.round) icons.push({ icon: `🥁+${e.drum.amount}`, tone: 'warn', label: 'War Drum' });
  if (isGuarded(state, e)) icons.push({ icon: '🔒', tone: 'shield', label: 'Guarded by the pack' });
  if (ignoresTaunt(e)) icons.push({ icon: '⊘⚑', tone: '', label: 'Ignores taunts' });
  if (e.tauntedBy) icons.push({ icon: '⚑', tone: 'taunt', label: 'Taunted' });
  if (e.poison) icons.push({ icon: `☣${e.poison.perRound}`, tone: 'poison', label: 'Poisoned' });
  if (e.weaken) icons.push({ icon: `↓${e.weaken.amount}`, tone: 'curse', label: 'Cursed' });
  if (enemyArmor(e) > 0) icons.push({ icon: `⛨${enemyArmor(e)}`, tone: 'shield', label: 'Shielded' });
  if (e.staggers > 0) icons.push({ icon: `💫${e.staggers}`, tone: '', label: 'Staggered' });
  return (
    <>
      {icons.map((i) => (
        <span key={i.label} className={`tag static ${i.tone}`} aria-label={i.label}>
          {i.icon}
        </span>
      ))}
    </>
  );
}

function IntentLine({ e, state, intent }: { e: EnemyState; state: BattleState; intent?: Intent }) {
  if (justArrived(state, e)) return <div className="u-intent muted">Arrived · acts next round</div>;
  if (!intent?.short.length) return null;
  return <div className="u-intent">{intent.short.join(' · ')}</div>;
}

const kindLabel = (e: EnemyState) => (e.isWarlord ? 'Warlord' : rules.monsters[e.kind].name);

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
  intent?: Intent;
  targetable: boolean;
  targeted: boolean;
  onClick: () => void;
}) {
  const dmg = enemyDamage(state, e);
  return (
    <div
      className={`unit-c${e.isWarlord ? ' warlord' : ' champion'}${targetable ? ' target' : ''}${targeted ? ' targeted' : ''}`}
      onClick={onClick}
      role="button"
      aria-label={targetable ? `Target ${e.name}` : `${e.name}: details`}
    >
      <div className="u-top">
        <span className="u-name">
          {MONSTER_ICON[e.kind]} {kindLabel(e)}
          {e.tier && <TierDot tier={e.tier} />}
        </span>
        <span className="u-dmg num">
          ⚔{dmg}
          {e.isWarlord ? '×2' : ''}
        </span>
      </div>
      <Meter kind="hp" value={e.hp} max={e.maxHp} />
      <IntentLine e={e} state={state} intent={intent} />
      <div className="u-foot">
        <EnemyIcons e={e} state={state} />
      </div>
    </div>
  );
}

function GoblinStack({
  goblins,
  state,
  intents,
  isTarget,
  targeted,
  onPick,
  onDetail,
}: {
  goblins: EnemyState[];
  state: BattleState;
  intents: Record<string, Intent>;
  isTarget: (id: string) => boolean;
  targeted: string[];
  onPick: (id: string) => void;
  onDetail: () => void;
}) {
  const first = goblins[0];
  const valid = goblins.filter((g) => isTarget(g.id));
  const targetable = valid.length > 0;
  // Tapping the card picks the weakest goblin not already chosen.
  const pickWeakest = () => {
    const pick = [...valid].filter((g) => !targeted.includes(g.id)).sort((a, b) => a.hp - b.hp)[0] ?? valid[0];
    if (pick) onPick(pick.id);
  };
  const counts = new Map<string, number>();
  for (const g of goblins) for (const i of intents[g.id]?.short ?? []) counts.set(i, (counts.get(i) ?? 0) + 1);
  const dmg = enemyDamage(state, first);
  const pack = packBonus(state, first);
  return (
    <div
      className={`unit-c minion${targetable ? ' target' : ''}${goblins.some((g) => targeted.includes(g.id)) ? ' targeted' : ''}`}
      onClick={targetable ? pickWeakest : onDetail}
      role="button"
    >
      <div className="u-top">
        <span className="u-name">
          {MONSTER_ICON.goblin} {first.name}
          {goblins.length > 1 && <span className="count">×{goblins.length}</span>}
        </span>
        <span className="u-dmg num">⚔{dmg}</span>
      </div>
      <div className="pips">
        {goblins.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`pip${targeted.includes(g.id) ? ' on' : ''}${g.tauntedBy ? ' taunted' : ''}${g.poison ? ' poisoned' : ''}`}
            aria-label={`Goblin ${g.hp}/${g.maxHp} HP`}
            disabled={!isTarget(g.id)}
            onClick={(ev) => {
              ev.stopPropagation();
              onPick(g.id);
            }}
          >
            <span style={{ width: `${(g.hp / g.maxHp) * 100}%` }} />
            <b className="num">{g.hp}</b>
          </button>
        ))}
      </div>
      {pack > 0 && (
        <div className="u-foot">
          <span className="tag static" aria-label={`Pack Tactics +${pack}`}>
            🐺+{pack}
          </span>
        </div>
      )}
      {justArrived(state, first) ? (
        <div className="u-intent muted">Arrived · acts next round</div>
      ) : (
        counts.size > 0 && (
          <div className="u-intent">{[...counts].map(([t, n]) => (n > 1 ? `${t} ×${n}` : t)).join(' · ')}</div>
        )
      )}
    </div>
  );
}

/** Full details for an enemy (or a goblin stack), opened by tapping its card. */
function EnemyDetail({
  enemies,
  state,
  intents,
  onClose,
}: {
  enemies: EnemyState[];
  state: BattleState;
  intents: Record<string, Intent>;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (enemies.length === 0) return null;
  const e = enemies[0];
  const def = rules.monsters[e.kind];
  const special = specialOf(e);
  const [, player] = e.name.split(' · ');
  const rage = rules.combat.warlordEnrage;
  const n = rules.combat.specialEveryNRounds;
  let nextSpecial: number | null = null;
  if (special) for (let r = state.round; r < state.round + n + 1; r++) if (specialDue(e, r)) { nextSpecial = r; break; }
  const statuses: string[] = [];
  if (e.enraged) statuses.push(`Enraged: +${rage.damageBonus} damage for the rest of the battle`);
  if (e.drum && e.drum.round >= state.round) statuses.push(`War Drum: +${e.drum.amount} damage ${e.drum.round === state.round ? 'this round' : 'next round'}`);
  if (e.tauntedBy) {
    const h = state.heroes.find((x) => x.id === e.tauntedBy);
    statuses.push(`Taunted by ${h ? rules.classes[h.heroClass].name : state.summons.find((x) => x.id === e.tauntedBy)?.name ?? 'an ally'}`);
  }
  if (e.poison) statuses.push(`Poisoned: ${e.poison.perRound} damage for ${e.poison.rounds} more rounds`);
  if (e.weaken) statuses.push(`Cursed: deals ${e.weaken.amount} less damage for ${e.weaken.rounds} rounds`);
  if (enemyArmor(e) > 0) statuses.push(`Shielded: +${enemyArmor(e)} armor`);
  if (isGuarded(state, e))
    statuses.push(`${rules.combat.packGuard.name}: can't be targeted while ${rules.combat.packGuard.minGoblins}+ goblins are alive. Attacks that hit every enemy still land.`);
  if (packBonus(state, e) > 0)
    statuses.push(`${rules.combat.packTactics.name}: +${packBonus(state, e)} damage from the other goblins on the field`);
  if (e.staggers > 0) statuses.push(`Staggered: loses its next ${e.staggers > 1 ? `${e.staggers} actions` : 'action'}`);
  const plan = enemies.flatMap((x) => intents[x.id]?.full ?? []);
  return (
    <div className="modal-backdrop drawer" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={e.name} onClick={(ev) => ev.stopPropagation()}>
        <div className="spread">
          <h2>
            {MONSTER_ICON[e.kind]} {e.isWarlord ? `Warlord ${def.name}` : def.name}
            {enemies.length > 1 && ` ×${enemies.length}`}
          </h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body stack" style={{ gap: 10 }}>
          <div className="row small">
            {player && <span>{player}</span>}
            {e.tier && <TierChip tier={e.tier} />}
            <span className="chip">⚔ {enemyDamage(state, e)}{e.isWarlord ? ' ×2 actions' : ''}</span>
            <span className="chip">
              {enemies.length > 1 ? enemies.map((x) => x.hp).join(' / ') : `${e.hp}/${e.maxHp}`} HP
            </span>
          </div>
          {e.spec.source && <div className="tiny muted">{statLine(e.spec.source.line)}</div>}
          <p className="small" style={{ margin: 0 }}>{def.description.split('. Special:')[0]}.</p>
          {e.isWarlord && (
            <p className="small" style={{ margin: 0 }}>
              Warlord: double HP, +{rules.horde.warlord.damageBonus} damage, two actions a round; enrages below half HP (+{rage.damageBonus}).
            </p>
          )}
          {special && (
            <div className="small">
              <strong>⚠ {special.name}</strong>
              <span className="muted">
                {' '}
                ({nextSpecial === state.round ? 'this round' : nextSpecial === state.round + 1 ? 'next round' : `round ${nextSpecial}`})
              </span>
              <div className="muted">{special.description}.</div>
            </div>
          )}
          {statuses.length > 0 && (
            <ul className="small detail-list">
              {statuses.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          <div className="small">
            <strong>This round</strong>
            <div className="muted">
              {justArrived(state, e) ? 'Just arrived: acts next round.' : plan.length ? plan.join(' ') : 'Nothing planned.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroRow({ h, selected, targetable, onClick }: { h: HeroState; selected: boolean; targetable: boolean; onClick: () => void }) {
  const cls = rules.classes[h.heroClass];
  const state = !h.alive ? 'fallen' : h.prone ? 'done prone' : h.acted ? 'done' : 'ready';
  return (
    <div
      className={`hero-row ${state}${selected ? ' selected' : ''}${targetable ? ' target' : ''}`}
      onClick={onClick}
      role="button"
      aria-pressed={selected}
    >
      <div className="h-name">
        <span className="h-class">
          {CLASS_ICON[h.heroClass]} {cls.name}
          {state === 'done' && <span className="h-state" aria-label="Done">✓</span>}
          {state === 'fallen' && <span className="h-state" aria-label="Fallen">💀</span>}
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
        {h.nextAttackMultiplier > 1 && <Tag passThrough icon={`✦×${h.nextAttackMultiplier}`} text={`Next attack deals ×${h.nextAttackMultiplier}`} tone="good" />}
        {h.curse && <Tag passThrough icon={`↓${h.curse.amount}`} text={`Cursed: −${h.curse.amount} damage for ${h.curse.rounds} turns`} tone="curse" />}
        {h.prone && <Tag passThrough icon="⤵" text="Prone: can't act this round" tone="warn" />}
        {h.skipNextTurn && <Tag passThrough icon="⤵" text="Knocked prone: skips next round" tone="warn" />}
        {h.untargetableRounds > 0 && <Tag passThrough icon="👻" text="Untargetable this round" tone="good" />}
        {h.lastStand && <Tag passThrough icon="⚑" text="Last Stand: can't drop below 1 HP" tone="taunt" />}
        {h.signatureReady && <Tag passThrough icon="★" text="Signature ability ready (double-double)" tone="taunt" />}
        {h.legendaryReady && <Tag passThrough icon="✪" text="Legendary ability ready (triple-double)" tone="taunt" />}
      </div>
    </div>
  );
}

function SummonRow({ s, state }: { s: SummonState; state: BattleState }) {
  const taunting = state.enemies.filter((e) => e.alive && e.tauntedBy === s.id).length;
  return (
    <div className="hero-row summon">
      <div className="h-name">
        <span className="h-class">
          {s.kind === 'bear' ? '🐻' : '🐺'} {s.name}
        </span>
        <span className="h-player">Summon</span>
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

const isRoundStart = (l: LogEntry) => l.side === 'system' && /^Round \d+ begins/.test(l.text);

function Ticker({ log, onOpen }: { log: LogEntry[]; onOpen: () => void }) {
  const last = [...log].reverse().find((l) => !isRoundStart(l));
  return (
    <button className="ticker" onClick={onOpen} aria-label="Open battle log">
      <span className={`ticker-text ${last?.side ?? ''}`}>{last ? last.text : 'The battle begins.'}</span>
      <span className="ticker-more">Log ›</span>
    </button>
  );
}

function LogDrawer({ log, onClose }: { log: LogEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop drawer" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Battle log" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2>Battle log</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="log modal-body" ref={ref}>
          {log.map((l, i) => (
            <div key={i} className={l.side}>
              <span className="faint num">R{l.round}</span> {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

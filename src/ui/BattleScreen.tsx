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
  commandBonus,
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
import { EnemyHead, Feature, monsterBehavior, monsterPassives, type EnemyPage, type TutorialTopic } from './Tutorial';
import { encounterOf, monsterIcon, monsterName, monsterShort } from '../engine/encounter';
import { CLASS_ICON, ConfirmButton, TIER_LABEL, TierChip, statLine, weekLabel } from './common';

interface Props {
  data: SeasonData;
  game: SaveGame;
  onChange: (g: SaveGame) => void;
  /** Opens How to play, optionally at a class, ability or enemy page. */
  onHelp: (topic?: TutorialTopic) => void;
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

      <div className="section-label">{encounterOf(state.encounter).name}</div>
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
              <button
                className="btn ghost small icon-only"
                aria-label={action ? `How ${action.def.name} works` : `How the ${rules.classes[hero.heroClass].name} works`}
                title="How to play"
                onClick={() => onHelp({ tab: 'classes', heroClass: hero.heroClass, abilityId: action?.def.id })}
              >
                ?
              </button>
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
          groups={[...champions.map((e) => [e]), ...goblinGroups]}
          initialId={detail[0]}
          state={state}
          intents={intents}
          onClose={() => setDetail(null)}
          onHelp={(enemy) => {
            setDetail(null);
            onHelp({ tab: 'enemies', enemy });
          }}
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
  if (commandBonus(state, e) > 0) icons.push({ icon: `👑+${commandBonus(state, e)}`, tone: 'warn', label: "Chieftain's Command" });
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

/** A classic Warlord is a boosted Champion; an encounter boss (e.g. the Chieftain) is its own kind. */
const isClassicWarlord = (e: EnemyState) => e.isWarlord && rules.monsters[e.kind].behavior !== 'chieftain';
const foeShort = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? 'Warlord' : monsterShort(e.kind, enc));
const foeName = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? `Warlord ${monsterName(e.kind, enc)}` : monsterName(e.kind, enc));
const foeIcon = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? '👑' : monsterIcon(e.kind, enc));

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
          {foeIcon(e, state.encounter)} {foeShort(e, state.encounter)}
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
          {monsterIcon('goblin', state.encounter)} {first.name}
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
      {(pack > 0 || commandBonus(state, first) > 0) && (
        <div className="u-foot">
          {pack > 0 && (
            <span className="tag static" aria-label={`Pack Tactics +${pack}`}>
              🐺+{pack}
            </span>
          )}
          {commandBonus(state, first) > 0 && (
            <span className="tag static warn" aria-label="Chieftain's Command">
              👑+{commandBonus(state, first)}
            </span>
          )}
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

/** Full details for the horde, opened by tapping a card. Tabs flip between every foe on the field. */
function EnemyDetail({
  groups,
  initialId,
  state,
  intents,
  onClose,
  onHelp,
}: {
  groups: EnemyState[][];
  initialId: string;
  state: BattleState;
  intents: Record<string, Intent>;
  onClose: () => void;
  onHelp: (enemy: EnemyPage) => void;
}) {
  const [idx, setIdx] = useState(() => Math.max(0, groups.findIndex((g) => g.some((e) => e.id === initialId))));
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  if (groups.length === 0) return null;
  const enemies = groups[Math.min(idx, groups.length - 1)];
  const e = enemies[0];
  const special = specialOf(e);
  const [, player] = e.name.split(' · ');
  const rage = rules.combat.warlordEnrage;
  const n = rules.combat.specialEveryNRounds;
  let nextSpecial: number | null = null;
  if (special) for (let r = state.round; r < state.round + n + 1; r++) if (specialDue(e, r)) { nextSpecial = r; break; }
  const when = nextSpecial === state.round ? 'this round' : nextSpecial === state.round + 1 ? 'next round' : `round ${nextSpecial}`;

  const now: { text: string; tone: string }[] = [];
  if (e.enraged) now.push({ text: `🔥 Enraged +${rage.damageBonus}`, tone: 'warn' });
  if (e.drum && e.drum.round >= state.round) now.push({ text: `🥁 War Drum +${e.drum.amount} ${e.drum.round === state.round ? 'this round' : 'next round'}`, tone: 'warn' });
  if (isGuarded(state, e)) now.push({ text: '🔒 Guarded now', tone: 'shield' });
  if (packBonus(state, e) > 0) now.push({ text: `🐺 Pack +${packBonus(state, e)}`, tone: '' });
  if (commandBonus(state, e) > 0) now.push({ text: `👑 Chieftain's Command +${commandBonus(state, e)}`, tone: 'warn' });
  if (e.tauntedBy) {
    const h = state.heroes.find((x) => x.id === e.tauntedBy);
    now.push({ text: `⚑ Taunted by ${h ? rules.classes[h.heroClass].name : state.summons.find((x) => x.id === e.tauntedBy)?.name ?? 'an ally'}`, tone: 'taunt' });
  }
  if (e.poison) now.push({ text: `☣ Poison ${e.poison.perRound} × ${e.poison.rounds} rounds`, tone: 'poison' });
  if (e.weaken) now.push({ text: `↓ Cursed −${e.weaken.amount} for ${e.weaken.rounds} rounds`, tone: 'curse' });
  if (enemyArmor(e) > 0) now.push({ text: `⛨ Shielded +${enemyArmor(e)}`, tone: 'shield' });
  if (e.staggers > 0) now.push({ text: `💫 Staggered: loses ${e.staggers > 1 ? `${e.staggers} actions` : 'its next action'}`, tone: '' });

  const short = enemies.flatMap((x) => intents[x.id]?.short ?? []);
  const full = enemies.flatMap((x) => intents[x.id]?.full ?? []);
  const label = (g: EnemyState[]) => foeShort(g[0], state.encounter);
  return (
    <div className="modal-backdrop drawer" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="The horde" onClick={(ev) => ev.stopPropagation()}>
        <div className="spread">
          <h2>The horde</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="foe-picker" role="tablist" aria-label="Foes on the field">
          {groups.map((g, i) => (
            <button key={g[0].id} role="tab" aria-selected={i === idx} className={`class-pick${i === idx ? ' active' : ''}`} onClick={() => setIdx(i)}>
              <span className="class-pick-icon" aria-hidden>
                {foeIcon(g[0], state.encounter)}
              </span>
              <span>
                {label(g)}
                {g.length > 1 ? ` ×${g.length}` : ''}
              </span>
              <span className="foe-hp" style={{ width: `${(g.reduce((t, x) => t + x.hp, 0) / g.reduce((t, x) => t + x.maxHp, 0)) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="modal-body class-panel">
          <EnemyHead
            icon={foeIcon(e, state.encounter)}
            name={`${foeName(e, state.encounter)}${enemies.length > 1 ? ` ×${enemies.length}` : ''}`}
            sub={
              <span className="row" style={{ gap: 6 }}>
                {player ? <span>{player}</span> : <span>{e.name}</span>}
                {e.tier && <TierChip tier={e.tier} />}
              </span>
            }
          />
          <div className="row" style={{ gap: 6 }}>
            <span className="chip">❤ {enemies.length > 1 ? enemies.map((x) => x.hp).join(' / ') : `${e.hp}/${e.maxHp}`} HP</span>
            <span className="chip">⚔ {enemyDamage(state, e)}</span>
            {e.isWarlord && <span className="chip">{e.extraActions + 1} actions a round</span>}
          </div>
          {e.spec.source && <div className="tiny muted">{statLine(e.spec.source.line)}</div>}
          <p className="small" style={{ margin: 0 }}>
            {monsterBehavior(e.kind)}.
          </p>
          {now.length > 0 && (
            <div className="row" style={{ gap: 6 }}>
              {now.map((x) => (
                <span key={x.text} className={`chip now-chip ${x.tone}`}>
                  {x.text}
                </span>
              ))}
            </div>
          )}
          <Feature
            title="This round"
            text={
              justArrived(state, e) ? (
                'Just arrived: acts next round.'
              ) : short.length ? (
                <>
                  <span className="u-intent">{short.join(' · ')}</span>
                  <span className="tiny muted" style={{ display: 'block' }}>
                    {full.join(' ')}
                  </span>
                </>
              ) : (
                'Nothing planned.'
              )
            }
          />
          {special && <Feature title={`⚠ Special · ${special.name} (${when})`} text={`${special.description}.`} warn />}
          {e.isWarlord && (
            <Feature
              title={`Boss · enrages below ${Math.round(rage.atHpFraction * 100)}% HP`}
              text={
                isClassicWarlord(e)
                  ? `Double HP, +${rules.horde.warlord.damageBonus} damage and two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
                  : `The week's best opposing performance. Two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
              }
            />
          )}
          {monsterPassives(e.kind).map((p) => (
            <Feature key={p.title} title={`Passive · ${p.title}`} text={p.text} />
          ))}
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onHelp((e.isWarlord ? 'warlord' : e.kind) as EnemyPage)}>
            More in How to play →
          </button>
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

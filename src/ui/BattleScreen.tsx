import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeasonData } from '../data/types';
import { finishBattle, type SaveGame } from '../app/game';
import {
  endRound,
  enemyArmor,
  justArrived,
  listActions,
  performAction,
  previewRound,
  actionDamage,
  commandSources,
  toppleThreshold,
  actionsThisRound,
  hoardBonus,
  canFumble,
  spendFumble,
  phylactery,
  energyGain,
  enemyDamage,
  packBonus,
  specialDue,
  nextWaveRound,
  activeSpecial,
  ignoresTaunt,
  isGuarded,
  type ActionOption,
  type BattleState,
  type EnemyState,
  type HeroState,
  type LogEntry,
  type SummonState,
} from '../engine/combat';
import { rules, type HeroClass, type Tier, type TraitId } from '../rules';
import { EnemyHead, Feature, monsterBehavior, monsterPassives, type EnemyPage, type TutorialTopic } from './Tutorial';
import { behaviorOf, encounterIds, encounterOf, hasTwist, monsterIcon, monsterName, monsterShort } from '../engine/encounter';
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
  const { intents, summonIntents, doomed, incoming } = useMemo(() => {
    const map: Record<string, Intent> = {};
    const summon: Record<string, string[]> = {};
    const preview = previewRound(state);
    // Heroes who fall if the round ends now, and who hits each hero for how much.
    const doomed = new Set<string>(state.heroes.filter((h) => h.alive && !preview.after.heroes.find((x) => x.id === h.id)?.alive).map((h) => h.id));
    const incoming: Record<string, Record<string, number>> = {};
    for (const l of preview.log)
      for (const [heroId, n] of Object.entries(l.hits ?? {})) {
        const by = (incoming[heroId] ??= {});
        if (l.actorId) by[l.actorId] = (by[l.actorId] ?? 0) + n;
      }
    for (const l of preview.log) {
      if (l.side === 'summon' && l.actorId) {
        (summon[l.actorId] ??= []).push(l.short ?? l.text);
        continue;
      }
      const e = state.enemies.find((x) => x.id === l.actorId);
      if (!e) continue;
      const i = (map[e.id] ??= { short: [], full: [] });
      i.short.push(l.short ?? l.text);
      i.full.push(l.text);
    }
    return { intents: map, summonIntents: summon, doomed, incoming };
  }, [state]);
  // The hero whose fall the player is inspecting (tap their ☠).
  const [threatPick, setThreatPick] = useState<string | null>(null);
  const threat = threatPick && doomed.has(threatPick) ? threatPick : null;
  const threatFrom = threat ? incoming[threat] ?? {} : {};
  const [detail, setDetail] = useState<string[] | null>(null);

  const hero = selected ? state.heroes.find((h) => h.id === selected) : undefined;
  const options = hero ? listActions(state, hero.id) : [];
  const targetType = action?.def.target.type;
  const targeting = !!action && (targetType === 'enemy' || targetType === 'enemies' || targetType === 'ally' || targetType === 'fallenAlly');
  const enemyTargeting = targeting && (targetType === 'enemy' || targetType === 'enemies');

  // Spending a Fumble is free and undoable, like any action.
  const fumble = (enemyId: string) => {
    setUndo((u) => [...u, state]);
    setBattle(spendFumble(state, enemyId));
  };

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
              {next.some((m) => m.isWarlord) ? ` + ${encounterOf(state.encounter).boss ? monsterShort(encounterOf(state.encounter).boss!, state.encounter) : 'Warlord'}` : ''}
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

      <div className="spread">
        <div className="section-label">{encounterOf(state.encounter).name}</div>
        {state.enemies.some((e) => e.pile) && (
          <span className="tag static warn" aria-label="Bone piles">
            🦴 {state.enemies.filter((e) => e.pile).length} reassemble next round
          </span>
        )}
        {state.hoard && <HoardTag state={state} />}
      </div>
      <div className={`enemy-grid${threat ? ' threat-mode' : ''}`}>
        {champions.map((e) => (
          <EnemyCard
            key={e.id}
            e={e}
            state={state}
            intent={intents[e.id]}
            threat={threatFrom[e.id]}
            targetable={isEnemyTarget(e.id)}
            targeted={multi.includes(e.id)}
            onClick={() => (isEnemyTarget(e.id) ? clickTarget(e.id) : setDetail([e.id]))}
            onFumble={() => fumble(e.id)}
            aiming={enemyTargeting}
          />
        ))}
        {goblinGroups.map((g) => (
          <GoblinStack
            key={g[0].id}
            goblins={g}
            state={state}
            intents={intents}
            threat={g.reduce((t, x) => t + (threatFrom[x.id] ?? 0), 0)}
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
            <Fragment key={h.id}>
              <HeroRow
                h={h}
                netted={h.nettedRound === state.round}
                doomed={doomed.has(h.id)}
                threatOn={threat === h.id}
                onThreat={() => setThreatPick(threat === h.id ? null : h.id)}
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
              {threat === h.id && <ThreatCallout h={h} from={threatFrom} state={state} onClose={() => setThreatPick(null)} />}
            </Fragment>
          );
        })}
        {state.summons
          .filter((s) => s.alive)
          .map((s) => (
            <SummonRow key={s.id} s={s} state={state} intent={summonIntents[s.id]} />
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
          onFumble={fumble}
          onClose={() => setDetail(null)}
          onHelp={(enemy) => {
            setDetail(null);
            onHelp({ tab: 'enemies', enemy, encounter: state.encounter });
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
          <span className={`cost${o.cost !== undefined && o.def.cost !== undefined && o.cost < o.def.cost ? ' discounted' : ''}`}>{o.def.unlock ? (o.def.unlock === 'signature' ? 'DD' : 'TD') : o.cost}</span>
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

/** Topple: damage this round toward knocking a giant down. */
function ToppleBar({ e, state }: { e: EnemyState; state: BattleState }) {
  const t = toppleThreshold(state, e);
  if (t === null) return null;
  if (e.toppled) return <div className="topple-bar down">⛰️ Toppled: loses its next turn</div>;
  const n = Math.min(t, e.toppleDamage ?? 0);
  return (
    <div className="topple-bar" role="meter" aria-label={`Topple: ${n} of ${t} damage this round`} aria-valuenow={n} aria-valuemax={t}>
      <span style={{ width: `${(n / t) * 100}%` }} />
      <b className="num">
        ⛰️ {n}/{t}
      </b>
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
  const special = activeSpecial(state, e);
  const rage = rules.combat.warlordEnrage;
  const icons: { icon: string; tone: string; label: string }[] = [];
  // A Wraith that is already intangible has nothing to fade from.
  if (special && !e.asleep && specialDue(e, state.round + 1) && !(special.key === 'fade' && e.intangible)) icons.push({ icon: `⏳ ${special.short} next round`, tone: 'soon', label: `${special.name} next round` });
  if (e.enraged) icons.push({ icon: `🔥+${rage.damageBonus}`, tone: 'warn', label: 'Enraged' });
  if (e.drum && e.drum.round >= state.round) icons.push({ icon: `🥁+${e.drum.amount}`, tone: 'warn', label: 'War Drum' });
  for (const c of commandSources(state, e)) icons.push({ icon: `${c.icon}+${c.bonus}`, tone: 'warn', label: c.name });
  if (behaviorOf(e.kind, state.encounter) === 'lich' && phylactery(state))
    icons.push({ icon: '⚱️ ½', tone: 'shield', label: 'Takes half damage while its Phylactery stands' });
  if (isGuarded(state, e)) icons.push({ icon: '🔒', tone: 'shield', label: 'Guarded by the pack' });
  if (e.intangible) icons.push({ icon: '👻 Intangible', tone: 'ghost', label: 'Intangible: only spells and Cleric attacks can touch it' });
  const ovr = encounterOf(state.encounter).monsters[e.kind];
  if (ovr?.regenerate) icons.push({ icon: `♻️+${ovr.regenerate.amount}`, tone: 'good', label: `${ovr.regenerate.name}: ${ovr.regenerate.description}` });
  if (ovr?.rallyingSaga) icons.push({ icon: `🎶 +${ovr.rallyingSaga.bonus}⛰️`, tone: 'warn', label: `${ovr.rallyingSaga.name}: ${ovr.rallyingSaga.description}` });
  if (e.groggy) icons.push({ icon: '😵 Groggy', tone: '', label: 'Groggy: one action a round until the final wave arrives' });
  const ov = encounterOf(state.encounter).monsters[e.kind];
  if (ov?.dragonkin && hasTwist('dragonscale', state.encounter)) icons.push({ icon: '🔥½', tone: 'shield', label: 'Dragonscale: half damage from fire' });
  if (ov?.moltenHide) icons.push({ icon: `🌋${ov.moltenHide.damage}`, tone: 'warn', label: `${ov.moltenHide.name}: weapon hits burn the attacker for ${ov.moltenHide.damage}` });
  if (behaviorOf(e.kind, state.encounter) === 'assassin')
    icons.push({ icon: `🔋${rules.combat.assassinDrain}`, tone: 'curse', label: `Energy drain: each hit drains ${rules.combat.assassinDrain} energy` });
  if (ignoresTaunt(e)) icons.push({ icon: '⊘⚑', tone: '', label: 'Ignores taunts' });
  if (e.tauntedBy) icons.push({ icon: '⚑', tone: 'taunt', label: 'Taunted' });
  if (e.poison) icons.push({ icon: `☣${e.poison.perRound}`, tone: 'poison', label: 'Poisoned' });
  if (e.weaken) icons.push({ icon: `↓${e.weaken.amount}`, tone: 'curse', label: 'Cursed' });
  if (enemyArmor(e) > 0) icons.push({ icon: `⛨${enemyArmor(e)}`, tone: 'shield', label: 'Shielded' });
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

/** Hoard Tithe: coins on the sleeping Dragon's hoard and what they're worth. */
function HoardTag({ state }: { state: BattleState }) {
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

/** What a trait is doing right now, if anything changes it (used up, built up). */
function traitStatus(e: EnemyState, id: TraitId, state: BattleState): { text: string; spent?: boolean } {
  const t = rules.traits[id];
  if (id === 'swat' && e.swatRound === state.round) return { text: `${t.icon} ${t.name} used`, spent: true };
  if (id === 'secondChance' && e.secondChanceUsed) return { text: `${t.icon} ${t.name} used`, spent: true };
  if (id === 'hotHand' && (e.hotStacks ?? 0) > 0) return { text: `${t.icon} ${t.name} +${e.hotStacks}` };
  if (id === 'takeover' && e.hp <= e.maxHp / 2) return { text: `${t.icon} ${t.name}: 2 actions` };
  return { text: `${t.icon} ${t.name}` };
}

/** Box-score traits: abilities from the mirrored player's standout stats. */
function TraitChips({ e, state }: { e: EnemyState; state: BattleState }) {
  return (
    <>
      {(e.traits ?? []).map((id) => {
        const s = traitStatus(e, id, state);
        return (
          <span key={id} className={`tag static trait${s.spent ? ' spent' : ''}`} aria-label={`${rules.traits[id].name}: ${rules.traits[id].description}`}>
            {s.text}
          </span>
        );
      })}
    </>
  );
}

/** The stat behind a trait on this line, e.g. "4 blocks" or "11-of-16 shooting". */
function traitSource(id: TraitId, e: EnemyState): string {
  const line = e.spec.source?.line;
  const t = rules.traits[id].trigger;
  if (!line) return '';
  return 'stat' in t ? `${line[t.stat]} ${t.label}` : `${line[t.made]}-of-${line[t.attempts]} ${t.label}`;
}

/** Fumbles from the opposing player's turnovers: tap to cancel this enemy's next action. */
function FumbleChip({ e, state, passive, onFumble }: { e: EnemyState; state: BattleState; passive: boolean; onFumble: () => void }) {
  // Two taps to spend: the first arms it, the second confirms. It disarms after a few seconds.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);
  if (e.fumbled) return <span className="tag static fumbled">💫 Fumbling</span>;
  if (!canFumble(state, e)) return null;
  const tov = e.spec.source?.line.tov;
  const label = (
    <>
      💫 {e.fumbles}
      {tov !== undefined && <span className="fumble-tov"> · {tov} TOV</span>}
    </>
  );
  // While aiming an attack, it's just a label so taps land on the card as a target.
  if (passive) return <span className="tag static fumble-idle">{label}</span>;
  return (
    <button
      type="button"
      className={`tag fumble${armed ? ' armed' : ''}`}
      aria-label={
        armed
          ? `Confirm: spend a Fumble so ${e.name} loses its next action`
          : `Spend a Fumble on ${e.name} (${e.fumbles} left${tov !== undefined ? `, from ${tov} turnovers` : ''}); tap twice`
      }
      onClick={(ev) => {
        ev.stopPropagation();
        if (!armed) return setArmed(true);
        setArmed(false);
        onFumble();
      }}
    >
      {armed ? '💫 Spend? Tap again' : label}
    </button>
  );
}

const sleepText = (e: EnemyState) =>
  e.waking ? '💢 Stirring: wakes at the end of this round' : `💤 Asleep · hits deal ×${rules.combat.dragonSleep.damageMultiplier} and wake it`;

/** A special fires this round when the preview of the enemy turn includes it (specials log with ⚠). */
const specialNow = (intent?: Intent) => !!intent?.short.some((s) => s.startsWith('⚠'));

function IntentLine({ e, state, intent }: { e: EnemyState; state: BattleState; intent?: Intent }) {
  if (e.asleep) return <div className="u-intent sleep">{sleepText(e)}</div>;
  if (e.toppled) return null; // the topple bar already says so
  if (justArrived(state, e)) return <div className="u-intent muted">Arrived · acts next round</div>;
  if (!intent?.short.length) return null;
  const special = intent.short.filter((s) => s.startsWith('⚠'));
  const rest = intent.short.filter((s) => !s.startsWith('⚠'));
  return (
    <>
      {special.map((s) => (
        <div key={s} className="special-now-pill">
          ⚠ NOW · {s.replace(/^⚠\s*/, '')}
        </div>
      ))}
      {rest.length > 0 && <div className="u-intent">{rest.join(' · ')}</div>}
    </>
  );
}

/** A classic Warlord is a boosted Champion; an encounter boss (e.g. the Chieftain, the Lich) is its own kind. */
const BOSS_KINDS = new Set(encounterIds().map((id) => encounterOf(id).boss));
const isClassicWarlord = (e: EnemyState) => e.isWarlord && !BOSS_KINDS.has(e.kind);
/** Wraiths drain every hero instead of attacking one, so their number gets a different mark. */
const dmgMark = (e: EnemyState, enc?: string) => (behaviorOf(e.kind, enc) === 'wraith' ? '💧' : '⚔');
const foeShort = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? 'Warlord' : monsterShort(e.kind, enc));
const foeName = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? `Warlord ${monsterName(e.kind, enc)}` : monsterName(e.kind, enc));
const foeIcon = (e: EnemyState, enc?: string) => (isClassicWarlord(e) ? '👑' : monsterIcon(e.kind, enc));

function EnemyCard({
  e,
  state,
  intent,
  threat,
  targetable,
  targeted,
  onClick,
  onFumble,
  aiming,
}: {
  e: EnemyState;
  state: BattleState;
  intent?: Intent;
  onFumble: () => void;
  /** An attack is being aimed: card taps pick targets, so the Fumble chip goes quiet. */
  aiming: boolean;
  /** Damage this enemy deals to the hero whose fall is being inspected. */
  threat?: number;
  targetable: boolean;
  targeted: boolean;
  onClick: () => void;
}) {
  const dmg = enemyDamage(state, e);
  const inert = behaviorOf(e.kind, state.encounter) === 'phylactery';
  return (
    <div
      className={`unit-c${e.isWarlord ? ' warlord' : ' champion'}${e.asleep ? ' asleep' : ''}${specialNow(intent) ? ' special-now' : ''}${e.intangible ? ' intangible' : ''}${threat ? ' threat' : ''}${targetable ? ' target' : ''}${targeted ? ' targeted' : ''}`}
      onClick={onClick}
      role="button"
      aria-label={targetable ? `Target ${e.name}` : `${e.name}: details`}
    >
      {!!threat && <span className="threat-badge num">☠ {threat}</span>}
      <div className="u-top">
        <span className="u-name">
          {foeIcon(e, state.encounter)} {foeShort(e, state.encounter)}
          {e.tier && <TierDot tier={e.tier} />}
        </span>
        {!inert && (
          <span className="u-dmg num">
            {dmgMark(e, state.encounter)}
            {dmg}
            {actionsThisRound(e) > 1 ? `×${actionsThisRound(e)}` : ''}
          </span>
        )}
      </div>
      <Meter kind="hp" value={e.hp} max={e.maxHp} />
      <ToppleBar e={e} state={state} />
      <IntentLine e={e} state={state} intent={intent} />
      <div className="u-foot">
        <TraitChips e={e} state={state} />
        <FumbleChip e={e} state={state} passive={aiming} onFumble={onFumble} />
        <EnemyIcons e={e} state={state} />
      </div>
    </div>
  );
}

function GoblinStack({
  goblins,
  state,
  intents,
  threat,
  isTarget,
  targeted,
  onPick,
  onDetail,
}: {
  goblins: EnemyState[];
  state: BattleState;
  intents: Record<string, Intent>;
  threat: number;
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
      className={`unit-c minion${threat ? ' threat' : ''}${targetable ? ' target' : ''}${goblins.some((g) => targeted.includes(g.id)) ? ' targeted' : ''}`}
      onClick={targetable ? pickWeakest : onDetail}
      role="button"
    >
      {threat > 0 && <span className="threat-badge num">☠ {threat}</span>}
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
      {(pack > 0 || commandSources(state, first).length > 0) && (
        <div className="u-foot">
          {pack > 0 && (
            <span className="tag static" aria-label={`Pack Tactics +${pack}`}>
              🐺+{pack}
            </span>
          )}
          {commandSources(state, first).map((c) => (
            <span key={c.name} className="tag static warn" aria-label={`${c.name} +${c.bonus}`}>
              {c.icon}+{c.bonus}
            </span>
          ))}
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
  onFumble,
  onClose,
  onHelp,
}: {
  groups: EnemyState[][];
  initialId: string;
  state: BattleState;
  intents: Record<string, Intent>;
  onFumble: (enemyId: string) => void;
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
  const special = activeSpecial(state, e);
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
  for (const c of commandSources(state, e)) now.push({ text: `${c.icon} ${c.name} +${c.bonus}`, tone: 'warn' });
  if (behaviorOf(e.kind, state.encounter) === 'lich' && phylactery(state)) now.push({ text: '⚱️ Takes half damage while its Phylactery stands', tone: 'shield' });
  if (e.tauntedBy) {
    const h = state.heroes.find((x) => x.id === e.tauntedBy);
    now.push({ text: `⚑ Taunted by ${h ? rules.classes[h.heroClass].name : state.summons.find((x) => x.id === e.tauntedBy)?.name ?? 'an ally'}`, tone: 'taunt' });
  }
  if (e.poison) now.push({ text: `☣ Poison ${e.poison.perRound} × ${e.poison.rounds} rounds`, tone: 'poison' });
  if (e.weaken) now.push({ text: `↓ Cursed −${e.weaken.amount} for ${e.weaken.rounds} rounds`, tone: 'curse' });
  if (enemyArmor(e) > 0) now.push({ text: `⛨ Shielded +${enemyArmor(e)}`, tone: 'shield' });
  if (e.intangible) now.push({ text: '👻 Intangible: only spells and Cleric attacks can touch it', tone: 'curse' });

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
            <span className="chip">
              {behaviorOf(e.kind, state.encounter) === 'wraith' ? `💧 ${enemyDamage(state, e)} to every hero` : `⚔ ${enemyDamage(state, e)}`}
            </span>
            {e.isWarlord && <span className="chip">{e.extraActions + 1} actions a round</span>}
          </div>
          {e.spec.source && <div className="tiny muted">{statLine(e.spec.source.line)}</div>}
          <p className="small" style={{ margin: 0 }}>
            {monsterBehavior(e.kind, state.encounter)}.
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
              e.asleep ? (
                `${sleepText(e)}. ${rules.combat.dragonSleep.description}.`
              ) : justArrived(state, e) ? (
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
          {(e.traits ?? []).map((id) => {
            const t = rules.traits[id];
            const src = traitSource(id, e);
            return (
              <Feature
                key={id}
                title={`${traitStatus(e, id, state).text} · trait`}
                text={
                  <>
                    {t.description}.{src && ` From ${player ?? 'its player'}'s ${src}.`}
                    <span className="tiny muted" style={{ display: 'block' }}>
                      Counter: {t.counter}.
                    </span>
                  </>
                }
              />
            );
          })}
          {(e.fumbles > 0 || e.fumbled) && (
            <Feature
              title={`💫 Fumbles · ${e.fumbles} left`}
              text={
                <>
                  {player ?? 'Its player'} turned it over {e.spec.source?.line.tov ?? 0} times that night: one Fumble per{' '}
                  {rules.horde.turnoversPerFumble}. Spend one to cancel its next action, a special included. Free for your party, and lost when it
                  dies.
                  {e.fumbled ? (
                    <span className="u-intent" style={{ display: 'block' }}>
                      Fumbling: it loses its next action.
                    </span>
                  ) : (
                    canFumble(state, e) && (
                      <button className="btn small" style={{ display: 'block', marginTop: 6 }} onClick={() => onFumble(e.id)}>
                        💫 Spend a Fumble
                      </button>
                    )
                  )}
                </>
              }
            />
          )}
          {special && <Feature title={`⚠ Special · ${special.name} (${when})`} text={`${special.description}.`} warn />}
          {e.isWarlord && (
            <Feature
              title={`🔥 Boss · enrages below ${Math.round(rage.atHpFraction * 100)}% HP`}
              text={
                isClassicWarlord(e)
                  ? `Double HP, +${rules.horde.warlord.damageBonus} damage and two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
                  : `The week's best opposing performance. Two actions a round. Enraged, it hits +${rage.damageBonus} harder.`
              }
            />
          )}
          {monsterPassives(e.kind, state.encounter).map((p) => (
            <Feature key={p.title} title={`${p.icon ? `${p.icon} ` : ''}Passive · ${p.title}`} text={p.text} />
          ))}
          <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onHelp((e.isWarlord || e.kind === 'phylactery' ? 'warlord' : e.kind) as EnemyPage)}>
            More in How to play →
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroRow({
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
          {state === 'done' && <span className="h-state" aria-label="Done">✓</span>}
          {state === 'fallen' && <span className="h-state" aria-label="Fallen">💀</span>}
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
        {h.nextAttackMultiplier > 1 && <Tag passThrough icon={`✦×${h.nextAttackMultiplier}`} text={`Next attack deals ×${h.nextAttackMultiplier}`} tone="good" />}
        {h.curse && <Tag passThrough icon={`↓${h.curse.amount}`} text={`Cursed: −${h.curse.amount} damage for ${h.curse.rounds} turns`} tone="curse" />}
        {h.poison && (
          <Tag passThrough icon={`☣${h.poison.perRound}`} text={`Poisoned: ${h.poison.perRound} damage after the horde acts, ${h.poison.rounds} more time${h.poison.rounds > 1 ? 's' : ''}`} tone="poison" />
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
function ThreatCallout({ h, from, state, onClose }: { h: HeroState; from: Record<string, number>; state: BattleState; onClose: () => void }) {
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

function SummonRow({ s, state, intent }: { s: SummonState; state: BattleState; intent?: string[] }) {
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

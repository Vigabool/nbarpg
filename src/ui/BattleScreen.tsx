import { Fragment, useEffect, useMemo, useState } from 'react';
import type { SeasonData } from '../data/types';
import { finishBattle, type SaveGame } from '../app/game';
import { endRound, landingWarning, listActions, performAction, spendFumble, nextWaveRound, type ActionOption, type BattleState } from '../engine/combat';
import { rules, type HeroClass } from '../rules';
import type { TutorialTopic } from './Tutorial';
import { encounterOf, monsterShort } from '../engine/encounter';
import { CLASS_ICON, ConfirmButton, weekLabel } from './common';
import { groupGoblins } from './battle/parts';
import { HoardTag } from './battle/EncounterTags';
import { EnemyCard, GoblinStack } from './battle/EnemyCard';
import { EnemyDetail } from './battle/EnemyDetail';
import { HeroRow, ThreatCallout, SummonRow } from './battle/HeroRow';
import { ActionTile } from './battle/ActionTile';
import { Ticker, LogDrawer } from './battle/BattleLog';
import { CoachMarks } from './CoachMarks';
import { roundPreview } from './battle/preview';
import { BATTLE_TIPS, pickTip } from './coachTips';
import { coachUnseen } from '../app/coach';

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
  // No hero is preselected: the player taps the hero they want to act with.
  const [selected, setSelected] = useState<HeroClass | null>(null);
  const [action, setAction] = useState<ActionOption | null>(null);
  const [multi, setMulti] = useState<string[]>([]);
  const [undo, setUndo] = useState<BattleState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const setBattle = (b: BattleState) => onChange({ ...game, battle: b });
  // Heroes a giant's landing would drop, if one more hit this turn could topple it.
  const landing = useMemo(() => new Set<string>(state.enemies.flatMap((e) => landingWarning(state, e).map((h) => h.id))), [state]);
  const { intents, summonIntents, doomed, incoming } = useMemo(() => roundPreview(state), [state]);
  // The hero whose fall the player is inspecting (tap their ☠).
  const [threatPick, setThreatPick] = useState<string | null>(null);
  const threat = threatPick && doomed.has(threatPick) ? threatPick : null;
  const threatFrom = threat ? (incoming[threat] ?? {}) : {};
  const [detail, setDetail] = useState<string[] | null>(null);

  const hero = selected ? state.heroes.find((h) => h.id === selected) : undefined;
  const options = hero ? listActions(state, hero.id) : [];
  const targetType = action?.def.target.type;
  const targeting = !!action && (targetType === 'enemy' || targetType === 'enemies' || targetType === 'ally' || targetType === 'fallenAlly');

  // First-battle tips: the screen arranges itself for the tip about to show (e.g. no action sheet
  // covering the party), and re-checks after each one is dismissed.
  // Paced one at a time: after a tip is dismissed, the next waits until the player does something
  // (the log grows), unless it directly continues the one just read (the opening sequence).
  // A later battle doesn't open with a leftover tip: once the opening sequence is done, the first
  // tip of each battle also waits for the player to act.
  const [coachGate, setCoachGate] = useState(() => ({ logLength: coachUnseen('battle-actions') ? -1 : state.log.length, last: '' }));
  // A replayed walkthrough (the opening tip unseen again) starts fresh, without waiting.
  const gated = !coachUnseen('battle-horde') && (coachGate.last === '' ? coachGate.logLength >= 0 : !coachUnseen(coachGate.last));
  const tips = BATTLE_TIPS.filter((t) => !gated || state.log.length > coachGate.logLength || t.continues === coachGate.last);
  const coachCtx = { state, sheetOpen: !!hero, targeting, doomed };
  const coachTip = state.phase !== 'party' ? undefined : pickTip(tips, coachCtx, coachUnseen, () => true);
  useEffect(() => {
    if (coachTip?.sheet === 'open' && !selected) setSelected(firstReady(state));
  }, [coachTip?.id]);
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
      // After an attack, close the sheet. A buff on an ally's next attack (Empower) opens that ally,
      // ready to use it. Other utilities stay on this hero to allow more.
      const buffedAlly = opt.def.effects.some((e) => e.type === 'nextAttackMultiplier') && opt.def.target.type === 'ally' ? targetIds[0] : undefined;
      if (opt.attack) setSelected(null);
      else if (buffedAlly && buffedAlly !== hero!.id) setSelected(buffedAlly as HeroClass);
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
    setSelected(null);
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
            <span className={`chip${inRounds <= 1 ? ' wave-soon' : ''}`} data-coach="wave" title={`Wave ${state.waveIndex + 2}: ${next.length} monsters`}>
              W{state.waveIndex + 2} {inRounds <= 1 ? 'next round' : `in ${inRounds}`} · {next.length}
              {next.some((m) => m.isWarlord)
                ? ` + ${encounterOf(state.encounter).boss ? monsterShort(encounterOf(state.encounter).boss!, state.encounter) : 'Warlord'}`
                : ''}
            </span>
          )}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <button
            className="btn small undo-btn"
            aria-label="Undo last action"
            title="Undo last action"
            disabled={undo.length === 0 || over}
            onClick={() => {
              const prev = undo.at(-1)!;
              setUndo((u) => u.slice(0, -1));
              setBattle(prev);
              setAction(null);
              setMulti([]);
              setSelected(null);
            }}
          >
            ↶ Undo
          </button>
          <button className="btn primary small" disabled={over} onClick={doEndRound} data-coach="end-round">
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
                    onHelp({ tab: 'glossary' });
                  }}
                >
                  Guide
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
      <div className={`enemy-grid${threat ? ' threat-mode' : ''}`} data-coach="horde">
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
      <div className="party" data-coach="party">
        {state.heroes.map((h) => {
          const allyTarget = targeting && (targetType === 'ally' || targetType === 'fallenAlly') && action!.validTargets.includes(h.id);
          return (
            <Fragment key={h.id}>
              <HeroRow
                h={h}
                netted={h.nettedRound === state.round}
                landing={landing.has(h.id)}
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

      {hero && !over && coachTip?.sheet !== 'closed' && (
        <section className="action-sheet" data-coach="actions" aria-label={`${rules.classes[hero.heroClass].name} actions`}>
          <div className="sheet-head">
            {targeting ? (
              <span className="small" style={{ color: 'var(--info)', minWidth: 0 }}>
                {targetType === 'enemies'
                  ? `${action!.def.name}: pick up to ${(action!.def.target as { count: number }).count} targets`
                  : `${action!.def.name}: pick a target`}
              </span>
            ) : (
              <strong className="small" style={{ minWidth: 0 }}>
                {CLASS_ICON[hero.heroClass]} {rules.classes[hero.heroClass].name} <span className="muted">· {hero.pool} energy</span>
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
                {options
                  .filter((o) => o.attack)
                  .map((o) => (
                    <ActionTile key={o.def.id} o={o} hero={hero} details={details} onPick={chooseAction} />
                  ))}
              </div>
              <div className="action-group">
                <span>Utility</span>
                <span className="faint">any number, while energy lasts</span>
              </div>
              <div className={`actions${details ? ' detailed' : ''}`}>
                {options
                  .filter((o) => !o.attack)
                  .map((o) => (
                    <ActionTile key={o.def.id} o={o} hero={hero} details={details} onPick={chooseAction} />
                  ))}
              </div>
            </>
          )}
        </section>
      )}

      {!over && <CoachMarks tips={tips} ctx={coachCtx} onDismiss={(id) => setCoachGate({ logLength: state.log.length, last: id })} />}
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

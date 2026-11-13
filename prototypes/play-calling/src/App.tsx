import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  CLASS_INFO,
  CLASSES,
  DEFAULT_PLAYBOOK,
  ENEMY_INFO,
  HORDE_PLAYS,
  MOVE,
  MOVES,
  TEMPLATES,
  TIER_MULT,
  isFinisher,
  tierIndex,
  type Cls,
  type Move,
  type Play,
  type PlayStep,
  type Tier,
} from './content';
import {
  DEFAULT_TUNING,
  activeHeroes,
  autoDefense,
  beginLive,
  bestCall,
  describeCarry,
  finishLive,
  liveStep,
  liveStepFast,
  maxPicks,
  armorOf,
  blockUp,
  hasQuick,
  taunter,
  crew,
  defenders,
  freeGoblins,
  halftimeAdjustment,
  holdPossession,
  isoPlay,
  newGame,
  onField,
  opponentsFg,
  passHelps,
  playAvailable,
  project,
  pushing,
  shamanCast,
  warDrum,
  quarterOf,
  startSecondHalf,
  validatePlay,
  type Adjustment,
  type Defense,
  type Difficulty,
  type Enemy,
  type Frame,
  type Game,
  type Carry,
  type Tuning,
} from './engine';
import week from './week.json';

type Screen = 'intro' | 'plan' | 'game' | 'halftime' | 'final';
type Modal =
  | { kind: 'designer'; play?: Play; slot?: number }
  | { kind: 'library'; slot: number }
  | { kind: 'menu' }
  | { kind: 'guide' }
  | { kind: 'enemy'; id: string }
  | { kind: 'hero'; cls: Cls }
  | { kind: 'recap' }
  | { kind: 'horde' };

/** Step: wait for Next at every beat. Auto and Fast advance on a timer. */
type Speed = 'step' | 'auto' | 'fast';
type Proj = { damage: number; kills: number; points: number };
const needsTarget = (m: { targets?: string }) => m.targets === 'primary' || m.targets === 'multi' || m.targets === 'double';
interface Replay {
  frames: Frame[];
  play: Play | null;
  before: Game;
  after: Game;
  possession: number;
}
type Beat = number | 'break';
/** The order beats are revealed: the party's frames, a pause, then the horde's turn. */
function beatsOf(frames: Frame[]): Beat[] {
  const party = frames.flatMap((f, i) => (f.phase === 'party' ? [i] : []));
  const horde = frames.flatMap((f, i) => (f.phase === 'horde' ? [i] : []));
  return horde.length ? [...party, 'break', ...horde] : party;
}
function currentFrame(frames: Frame[], beats: Beat[], beat: number): Frame | null {
  for (let i = Math.min(beat, beats.length) - 1; i >= 0; i--) {
    const b = beats[i];
    if (b !== 'break') return frames[b];
  }
  return null;
}

interface Saved {
  custom?: Play[];
  active?: string[];
  difficulty?: Difficulty;
  manual?: boolean;
  tuning?: Tuning;
  /** Replay pace (the older `speed` field is ignored so everyone starts on Step). */
  pace?: 'step' | 'auto' | 'fast';
}
const KEY = 'play-calling-prototype-v1';
function load(): Saved {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved;
  } catch {
    return {};
  }
}
function store(s: Saved) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Storage can be unavailable; the prototype still works for this visit.
  }
}

type StatLine = (typeof week.heroes)[number]['line'];
/** The 10+ stats behind a double-double or triple-double, e.g. "21 pts · 13 reb · 10 ast". */
const bigNight = (l: StatLine) =>
  (
    [
      ['pts', l.pts],
      ['reb', l.reb],
      ['ast', l.ast],
      ['stl', l.stl],
      ['blk', l.blk],
    ] as const
  )
    .filter(([, v]) => v >= 10)
    .map(([k, v]) => `${v} ${k}`)
    .join(' · ');
const isSpecial = (m: Move) => m.kind === 'signature' || m.kind === 'legendary';
/** A chip saying which big night unlocked this move. */
function SpecialChip(props: { m: Move }) {
  if (!isSpecial(props.m)) return null;
  const td = props.m.kind === 'legendary';
  return <span className={`chip special ${td ? 'td' : ''}`}>{td ? '★★ Triple-double special' : '★ Double-double special'}</span>;
}
/** The extra effect a top defensive tier adds. */
const ELITE_DEFENSE: Partial<Record<Cls, string>> = {
  warrior: 'At Elite, Protect blocks the first hit on that ally outright.',
  rogue: 'At Elite, two goblins are knocked off the ram.',
};
/** What a hero does on the horde's turn when they don't touch the ball. */
function OffBallCard(props: { cls: Cls; defTier: Tier; line: StatLine }) {
  const c = CLASS_INFO[props.cls];
  const elite = ELITE_DEFENSE[props.cls];
  return (
    <div className="offball">
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <strong>Off the ball: {c.defense}</strong>
        <span className={`tier ${props.defTier}`}>Defense {tierLabel(props.defTier)}</span>
      </span>
      <span className="small">{c.defenseText}</span>
      <span className="small muted">
        Automatic when this hero doesn’t touch the ball this possession. Defense rating from {props.line.stl} stl, {props.line.blk} blk, {props.line.dreb} dreb.
        {elite && props.defTier === 'elite' ? ` ${elite}` : ''}
      </span>
    </div>
  );
}

const chainText = (p: Play) => p.steps.map((s) => `${CLASS_INFO[s.cls].icon} ${MOVE[s.move].name}`).join(' → ');
const lastName = (n: string) => n.split(' ').slice(-1)[0];
const tierLabel = (t: Tier) => t[0].toUpperCase() + t.slice(1);
function playForm(p: Play): string {
  const tiers = p.steps.map((s) => week.heroes.find((h) => h.cls === s.cls)!.tier as Tier);
  if (tiers.some((t) => t === 'cold')) return '❄️ a cold hero';
  if (tiers.every((t) => tierIndex(t) >= tierIndex('great'))) return '🔥 every hero Great or better';
  return '';
}

export function App() {
  const saved = useMemo(load, []);
  const [screen, setScreen] = useState<Screen>('intro');
  const [difficulty, setDifficulty] = useState<Difficulty>(saved.difficulty ?? 'normal');
  const [manual, setManual] = useState<boolean>(saved.manual ?? false);
  /** The possession being built: Start, Support, Support, Finish. */
  const [slots, setSlots] = useState<(BuildStep | null)[]>([null, null, null, null]);
  const [editSlot, setEditSlot] = useState<number | null>(null);
  const [aimSlot, setAimSlot] = useState<number | null>(null);
  const [presetName, setPresetName] = useState<string | null>(null);
  /** The builder is open; each possession starts with it closed so the board is in full view. */
  const [planOpen, setPlanOpen] = useState(false);
  /** A note shown while aiming, such as Split asking for one more target. */
  const [aimPrompt, setAimPrompt] = useState<string | null>(null);
  const [tuning, setTuning] = useState<Tuning>({ ...DEFAULT_TUNING, ...(saved.tuning ?? {}) });
  const [custom, setCustom] = useState<Play[]>(saved.custom ?? []);
  const library = useMemo(() => [...TEMPLATES, ...custom], [custom]);
  const [active, setActive] = useState<string[]>(() => {
    const a = (saved.active ?? DEFAULT_PLAYBOOK).filter((id) => [...TEMPLATES, ...(saved.custom ?? [])].some((p) => p.id === id));
    return a.length === 4 ? a : DEFAULT_PLAYBOOK;
  });
  const playbook = useMemo(() => active.map((id) => library.find((p) => p.id === id)!).filter(Boolean), [active, library]);
  const [game, setGame] = useState<Game>(() => newGame(tuning, difficulty));
  const [history, setHistory] = useState<Game[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [beat, setBeat] = useState(0);
  const [lastReplay, setLastReplay] = useState<Replay | null>(null);
  const [speed, setSpeed] = useState<Speed>(saved.pace ?? 'step');
  const frames = replay?.frames ?? null;
  const [override, setOverride] = useState<Defense>({});
  const [modal, setModal] = useState<Modal | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [changesLeft, setChangesLeft] = useState(2);
  const [log, setLog] = useState<string[]>([]);
  const [secs, setSecs] = useState<number[]>([]);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    store({ custom, active, difficulty, manual, tuning, pace: speed });
  }, [custom, active, difficulty, manual, tuning, speed]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    startedAt.current = performance.now();
  }, [game.possession, screen]);

  const beats = useMemo(() => (replay ? beatsOf(replay.frames) : []), [replay]);
  const done = !!replay && beat >= beats.length;
  const curFrame = replay ? currentFrame(replay.frames, beats, beat) : null;
  const shown = replay ? (curFrame?.game ?? replay.before) : game;

  // Step through the possession: automatically at Normal and Fast, on tap at Slow.
  useEffect(() => {
    if (!replay || done || speed === 'step') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const justShown = beats[beat - 1];
    const base = speed === 'fast' ? 650 : 1500;
    const delay = beat === 0 ? 350 : justShown === 'break' ? base * 1.6 : reduce ? base * 0.7 : base;
    const t = setTimeout(() => setBeat((b) => b + 1), delay);
    return () => clearTimeout(t);
  }, [replay, beat, done, speed, beats]);

  function finishPlayback() {
    if (!replay) return;
    const g = replay.after;
    setLastReplay(replay);
    setReplay(null);
    setBeat(0);
    setGame(g);
    if (g.phase === 'halftime') {
      setAdjustment(halftimeAdjustment(g, playbook));
      setChangesLeft(2);
      setHistory([]);
      setScreen('halftime');
    } else if (g.phase === 'final') setScreen('final');
  }

  function startGame() {
    const g = newGame(tuning, difficulty);
    setGame(g);
    setHistory([]);
    setLog([]);
    setSecs([]);
    clearBuild();
    setPlanOpen(false);
    setAdjustment(null);
    setScreen('plan');
  }
  // ---- The possession builder ----
  const finisher = slots[3];
  const primaryId = finisher?.picks?.[0] ?? finisher?.target;
  const filled = slots.map((s, i) => (s ? { s, i } : null)).filter((x): x is { s: BuildStep; i: number } => !!x);
  const inPlay = useMemo(() => new Set<Cls>(slots.filter((s): s is BuildStep => !!s).map((s) => s.cls)), [slots]);
  const defense: Defense = useMemo(() => {
    const auto = autoDefense(game, inPlay);
    return manual ? { ...auto, ...override } : auto;
  }, [game, inPlay, manual, override]);
  /** Play the built steps on a copy of the game (no frames) to project the shot. */
  const sim = useMemo(() => simulateBuild(game, slots, defense), [game, slots, defense]);
  const aimMove = aimSlot !== null && slots[aimSlot] ? MOVE[slots[aimSlot]!.move] : null;
  // The finisher can pick several targets unless the Barrier will still be up when it fires.
  const barrierOnFinisher = (ss: (BuildStep | null)[]) =>
    game.barrierUp && !ss.slice(0, 3).some((st) => st && (MOVE[st.move].damage ?? 0) > 0 && (MOVE[st.move].targets ?? 'none') !== 'none');
  const aimMax = aimSlot === 3 && aimMove && !barrierOnFinisher(slots) ? maxPicks(aimMove, sim.buffs) : 1;
  const aimTaunter = aimSlot === 3 && aimMove && (aimMove.damage ?? 0) > 0 ? taunter(game) : undefined;
  // While aiming the finisher at one target, each enemy shows what the shot would do to it.
  const aimProjections = useMemo(() => {
    if (aimSlot !== 3 || !finisher || aimMax > 1) return new Map<string, Proj>();
    return new Map(
      onField(game).map((e) => {
        const r = simulateBuild(
          game,
          slots.map((s, i) => (i === 3 && s ? { ...s, target: e.id, picks: undefined } : s)),
        );
        return [e.id, r.shot];
      }),
    );
  }, [aimSlot, finisher, aimMax, game, slots]);
  const anyTouches = activeHeroes(game).some((h) => h.touches > 0);

  function clearBuild() {
    setSlots([null, null, null, null]);
    setEditSlot(null);
    setAimSlot(null);
    setPresetName(null);
    setOverride({});
  }
  function setSlotStep(i: number, step: BuildStep | null) {
    setSlots((ss) => ss.map((x, j) => (j === i ? step : x)));
    setPresetName(null);
  }
  /** Fill the slots from a saved play: its last step finishes, the rest start and support. */
  function loadPreset(p: Play, targetId?: string) {
    const next: (BuildStep | null)[] = [null, null, null, null];
    const helpers = p.steps.slice(0, -1);
    helpers.forEach((st, k) => (next[k] = { cls: st.cls, move: st.move }));
    const last = p.steps[p.steps.length - 1];
    next[3] = { cls: last.cls, move: last.move, target: targetId };
    setSlots(next);
    setEditSlot(null);
    setAimSlot(targetId ? null : 3);
    setPresetName(p.name);
  }
  function suggest() {
    const avail = playbook.filter((p) => playAvailable(game, p).ok);
    const pool = avail.length ? avail : CLASSES.map(isoPlay).filter((p) => playAvailable(game, p).ok);
    const b = bestCall(game, pool);
    const p = b && pool.find((x) => x.id === b.playId);
    if (p && b) loadPreset(p, b.targetId);
  }
  function aimAt(id: string) {
    if (aimSlot === null) return;
    const cur = slots[aimSlot];
    if (!cur) return;
    if (aimSlot === 3 && aimMax > 1) {
      if (aimTaunter?.id === id) return; // A Taunting big stays picked.
      const ps = cur.picks ?? (aimTaunter ? [aimTaunter.id] : []);
      const nextPicks = ps.includes(id) ? ps.filter((x) => x !== id) : ps.length < aimMax ? [...ps, id] : ps;
      setSlotStep(3, { ...cur, picks: nextPicks, target: nextPicks[0] });
      return;
    }
    setSlotStep(aimSlot, { ...cur, target: id, picks: undefined });
    setAimSlot(null);
  }
  function runBuild() {
    if (!finisher) return;
    const s = (performance.now() - startedAt.current) / 1000;
    let l = beginLive(game);
    for (const { s: st } of filled) {
      const isFin = st === finisher;
      l = liveStep(l, { cls: st.cls, move: st.move }, st.target ?? primaryId, isFin ? st.picks : undefined);
    }
    const res = finishLive(l, defense);
    const play: Play = { id: 'built', name: presetName ?? 'Your play', steps: filled.map(({ s: st }) => ({ cls: st.cls, move: st.move })), tags: [] };
    const tname = game.enemies.find((e) => e.id === primaryId)?.name ?? '';
    begin(res.game, res.frames, play, `P${game.possession + 1} · ${play.steps.map((x) => MOVE[x.move].name).join(' → ')} on ${tname} (${s.toFixed(1)} s)`, s);
  }
  function hold() {
    const s = (performance.now() - startedAt.current) / 1000;
    const res = holdPossession(game, autoDefense(game, new Set()));
    begin(res.game, res.frames, null, `P${game.possession + 1} · held the ball (${s.toFixed(1)} s)`, s);
  }

  function begin(g: Game, fr: Frame[], play: Play | null, head: string, s: number) {
    setHistory((h) => [...h, game]);
    setReplay({ frames: fr, play, before: game, after: g, possession: game.possession });
    setBeat(speed === 'step' ? 1 : 0);
    clearBuild();
    setPlanOpen(false);
    setSecs((x) => [...x, s]);
    setLog((l) => [...l, head, ...fr.map((f) => `   ${f.text}`), `   Score ${g.score.party}–${g.score.horde}`]);
  }
  function timeout() {
    if (!history.length || game.timeouts <= 0 || frames) return;
    const prev = structuredClone(history[history.length - 1]);
    prev.timeouts = game.timeouts - 1;
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    clearBuild();
    setPlanOpen(false);
    setLog((l) => [...l, `Timeout: possession ${prev.possession + 1} taken back.`]);
  }

  function setSlot(slot: number, id: string) {
    setActive((a) => a.map((x, i) => (i === slot ? id : x)));
  }
  function savePlay(p: Play, slot?: number) {
    setCustom((c) => (c.some((x) => x.id === p.id) ? c.map((x) => (x.id === p.id ? p : x)) : [...c, p]));
    if (slot !== undefined) setSlot(slot, p.id);
  }

  return (
    <>
      {screen === 'intro' && (
        <Intro
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          manual={manual}
          setManual={setManual}
          onStart={startGame}
          onGuide={() => setModal({ kind: 'guide' })}
        />
      )}
      {screen === 'plan' && (
        <PlanScreen
          game={game}
          live={false}
          playbook={playbook}
          onSuggest={() => setActive(DEFAULT_PLAYBOOK)}
          onChange={(slot) => setModal({ kind: 'library', slot })}
          onEdit={(slot) => setModal({ kind: 'designer', play: playbook[slot], slot })}
          onTipOff={() => setScreen('game')}
          onMenu={() => setModal({ kind: 'menu' })}
        />
      )}
      {screen === 'game' && (
        <>
          <Scoreboard
            game={shown}
            onTimeout={timeout}
            canTimeout={!!history.length && game.timeouts > 0 && !frames}
            onMenu={() => setModal({ kind: 'menu' })}
            onLast={lastReplay && !frames ? () => setModal({ kind: 'recap' }) : undefined}
            hordeNext={!replay && game.phase === 'party' ? sim.horde?.points : undefined}
            onHorde={() => setModal({ kind: 'horde' })}
          />
          <div className="wrap">
            <Objectives game={shown} />
            <CallBanner game={shown} />
            <Board
              game={shown}
              projections={aimProjections}
              picking={aimSlot !== null && !frames}
              barrierHidden={aimSlot !== null && barrierBrokenBefore(slots, aimSlot)}
              target={aimSlot !== null ? (slots[aimSlot]?.target ?? null) : null}
              picks={aimSlot === 3 && aimMax > 1 ? (finisher?.picks ?? (aimTaunter ? [aimTaunter.id] : [])) : undefined}
              frame={curFrame}
              onPick={(id) => (aimSlot !== null && !frames ? aimAt(id) : setModal({ kind: 'enemy', id }))}
            />
            {/* While the builder is open its own hero chips are the ones to tap, so the board's row steps aside. */}
            {(replay || !planOpen || game.phase !== 'party') && (
              <HeroRow
                game={shown}
                inPlay={replay ? new Set() : inPlay}
                defense={replay ? null : defense}
                frame={curFrame}
                onTap={(cls) => setModal({ kind: 'hero', cls })}
              />
            )}
            <div className="spacer" style={{ height: replay || planOpen ? '62vh' : '120px' }} />
          </div>
          {replay ? (
            <ReplaySheet
              replay={replay}
              beats={beats}
              beat={beat}
              speed={speed}
              onNext={() => setBeat((b) => Math.min(beats.length, b + 1))}
              onSkip={() => setBeat(beats.length)}
              onSpeed={() => setSpeed((x) => (x === 'step' ? 'auto' : x === 'auto' ? 'fast' : 'step'))}
              onDone={finishPlayback}
            />
          ) : game.phase === 'party' && !planOpen ? (
            <div className="sheet planbar">
              <div className="sheet-inner">
                <span className="small planline">
                  {finisher
                    ? `${filled.map(({ s: st }) => MOVE[st.move].name).join(' → ')}${primaryId ? ` · ${game.enemies.find((e) => e.id === primaryId)?.name.replace('Goblin ', '')}` : ''}${sim.ready ? ` · +${sim.shot.points}` : ''}`
                    : filled.length
                      ? `${filled.map(({ s: st }) => MOVE[st.move].name).join(' → ')} · no finisher yet`
                      : 'Read the board, then tap PLAN to build your possession.'}
                </span>
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  {!anyTouches ? (
                    <button className="btn primary big" onClick={hold}>
                      Hold the ball
                    </button>
                  ) : (
                    <>
                      <button className="btn primary big planbtn" onClick={() => setPlanOpen(true)}>
                        PLAN
                      </button>
                      {sim.ready && (
                        <button className="btn big runbtn" onClick={runBuild}>
                          Run ▸
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : game.phase === 'party' ? (
            <BuilderSheet
              game={game}
              onCollapse={() => setPlanOpen(false)}
              slots={slots}
              sim={sim}
              presetName={presetName}
              playbook={playbook}
              editSlot={editSlot}
              aimSlot={aimSlot}
              aimMax={aimMax}
              aimPrompt={aimPrompt}
              defense={defense}
              manual={manual}
              anyTouches={anyTouches}
              setOverride={setOverride}
              onEdit={(i) => {
                setEditSlot(i);
                setAimSlot(null);
              }}
              onCloseEdit={() => setEditSlot(null)}
              onChoose={(i, step) => {
                setSlotStep(i, step);
                setEditSlot(null);
                setAimPrompt(null);
                // A finisher that needs a target goes straight to aiming.
                if (i === 3 && needsTarget(MOVE[step.move]) && !slots[3]?.target) setAimSlot(3);
                // A helper passing Split gives an aimed finisher one more target: ask for it.
                const fin = slots[3];
                if (i < 3 && MOVE[step.move].enabler?.kind === 'split' && fin && needsTarget(MOVE[fin.move])) {
                  const next = slots.map((x, j) => (j === i ? step : x));
                  if (!barrierOnFinisher(next)) {
                    const have = fin.picks ?? (fin.target ? [fin.target] : []);
                    setSlots((ss) => ss.map((x, j) => (j === i ? step : j === 3 ? { ...fin, picks: have, target: have[0] } : x)));
                    setAimPrompt(`${MOVE[step.move].name} adds Split: pick one more target for ${MOVE[fin.move].name}.`);
                    setAimSlot(3);
                  }
                }
              }}
              onClear={(i) => {
                setSlotStep(i, null);
                setEditSlot(null);
              }}
              onAim={(i) => {
                setEditSlot(null);
                setAimSlot(i);
              }}
              onFollow={(i) => {
                const cur = slots[i];
                if (cur) setSlotStep(i, { ...cur, target: undefined });
                setEditSlot(null);
              }}
              onAimDone={() => {
                setAimSlot(null);
                setAimPrompt(null);
              }}
              onPreset={(p) => loadPreset(p)}
              onSuggest={suggest}
              onClearAll={clearBuild}
              onRun={runBuild}
              onHold={hold}
            />
          ) : null}
        </>
      )}
      {screen === 'halftime' && adjustment && (
        <Halftime
          game={game}
          live={false}
          adjustment={adjustment}
          playbook={playbook}
          library={library}
          changesLeft={changesLeft}
          onSwap={(slot, id) => {
            if (changesLeft <= 0 || playbook[slot].id === id) return;
            setSlot(slot, id);
            setChangesLeft((c) => c - 1);
          }}
          onEdit={(slot) => changesLeft > 0 && setModal({ kind: 'designer', play: playbook[slot], slot })}
          onStart={() => {
            setGame(startSecondHalf(game, adjustment));
            setScreen('game');
          }}
        />
      )}
      {screen === 'final' && (
        <Final
          game={game}
          log={log}
          secs={secs}
          names={{ ...Object.fromEntries(library.map((p) => [p.id, p.name])), built: 'Built plays' }}
          onAgain={startGame}
          onTitle={() => setScreen('intro')}
        />
      )}

      {modal?.kind === 'designer' && (
        <Designer
          tuning={tuning}
          difficulty={difficulty}
          initial={modal.play}
          onClose={() => setModal(null)}
          onSave={(p) => {
            const slot = modal.slot;
            savePlay(p, slot);
            if (screen === 'halftime' && slot !== undefined) setChangesLeft((c) => c - 1);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'library' && (
        <Library
          library={library}
          active={active}
          slot={modal.slot}
          onPick={(id) => {
            setSlot(modal.slot, id);
            setModal(null);
          }}
          onNew={() => setModal({ kind: 'designer', slot: modal.slot })}
          onEdit={(p) => setModal({ kind: 'designer', play: p, slot: modal.slot })}
          onDelete={(id) => setCustom((c) => c.filter((p) => p.id !== id))}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'menu' && (
        <Menu
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          manual={manual}
          setManual={setManual}
          tuning={tuning}
          log={log}
          onApplyTuning={(t) => {
            setTuning(t);
            setModal(null);
            const g = newGame(t, difficulty);
            setGame(g);
            setHistory([]);
            setLog([]);
            setSecs([]);
            setScreen('plan');
          }}
          onRestart={() => {
            setModal(null);
            startGame();
          }}
          onGuide={() => setModal({ kind: 'guide' })}
          onTitle={() => {
            setModal(null);
            setScreen('intro');
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.kind === 'guide' && <Guide onClose={() => setModal(null)} />}
      {modal?.kind === 'horde' && sim.horde && (
        <ModalShell title={`The horde’s next turn: +${sim.horde.points}`} onClose={() => setModal(null)}>
          <p className="small muted">
            What the horde will do after the play you’re building, with{' '}
            {defenders(game, inPlay).length
              ? defenders(game, inPlay)
                  .map((c) => CLASS_INFO[c].name)
                  .join(', ')
              : 'nobody'}{' '}
            on defense (the heroes not in your play). Change the play and this updates.
          </p>
          <div className="hordepanel">
            {sim.horde.lines.map((ln, k) => (
              <span key={k} className={`small hline ${ln.side}`}>
                {ln.t}
              </span>
            ))}
            {!sim.horde.lines.length && <span className="small muted">The horde has nothing to do.</span>}
          </div>
          <div className="panel small">
            <strong>How the horde scores</strong>
            <span>2 when its finisher damages a hero (a hit fully stopped by Armor, a Block or a Slow scores nothing).</span>
            <span>4 for a hero it takes down.</span>
            <span>1 for every 2 damage the ram does to the gate, and 10 when the gate falls.</span>
            <span>After the gate falls, 1 for every goblin on the field each turn.</span>
            <span className="muted">
              Heroes who aren’t in your play defend: the Warrior Protects, the Ranger Closes Out, the Wizard Wards, the Cleric heals and the Rogue Strips the
              Ball off the ram.
            </span>
          </div>
        </ModalShell>
      )}
      {modal?.kind === 'recap' && lastReplay && (
        <ModalShell title={`Possession ${lastReplay.possession + 1}`} onClose={() => setModal(null)}>
          <ReplayBody replay={lastReplay} beats={beatsOf(lastReplay.frames)} beat={Infinity} />
        </ModalShell>
      )}
      {modal?.kind === 'enemy' && <EnemyDetail game={shown} id={modal.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'hero' && <HeroDetail game={shown} cls={modal.cls} onClose={() => setModal(null)} />}
    </>
  );
}

// ---------- Title ----------

function Intro(props: {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  manual: boolean;
  setManual: (m: boolean) => void;
  onStart: () => void;
  onGuide: () => void;
}) {
  return (
    <div className="wrap">
      <div className="hero-title">
        <span className="eyebrow">NBA Fantasy RPG · Prototype</span>
        <h1>
          Play <span>Calling</span>
        </h1>
        <p>
          The Goblin Horde, played as a basketball game: four quarters, twelve possessions. Read the horde’s call, build your possession around one big finish,
          and outscore them.
        </p>
        <p className="muted small">
          Week of {week.week.start} to {week.week.end}, 2025–26. Your heroes are powered by {week.heroes.map((h) => lastName(h.player)).join(', ')}.
        </p>
      </div>
      <div className="panel">
        <span className="eyebrow">Difficulty</span>
        <div className="opt-group">
          {(['normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} className="opt" aria-pressed={props.difficulty === d} onClick={() => props.setDifficulty(d)}>
              {d === 'normal' ? 'Normal' : 'Hard'}
            </button>
          ))}
        </div>
        <DefenseChoice manual={props.manual} setManual={props.setManual} />
      </div>
      <button className="btn primary big" onClick={props.onStart}>
        Game plan
      </button>
      <button className="btn quiet" onClick={props.onGuide}>
        How it works
      </button>
    </div>
  );
}

function DefenseChoice(props: { manual: boolean; setManual: (m: boolean) => void }) {
  const [info, setInfo] = useState(false);
  return (
    <>
      <span className="eyebrow">Defense</span>
      <div className="opt-group" style={{ alignItems: 'center' }}>
        <button className="opt" aria-pressed={!props.manual} onClick={() => props.setManual(false)}>
          Automatic
        </button>
        <button className="opt" aria-pressed={props.manual} onClick={() => props.setManual(true)}>
          Manual
        </button>
        <button
          className="helpbtn"
          aria-expanded={info}
          aria-controls="defense-info"
          aria-label="What's the difference between automatic and manual defense?"
          title="What's the difference?"
          onClick={() => setInfo((x) => !x)}
        >
          ?
        </button>
      </div>
      {info && (
        <p id="defense-info" className="muted small">
          Heroes who don’t touch the ball defend. Automatic picks their targets; Manual lets you choose who the Warrior protects, who the Ranger closes out and
          who the Wizard wards.
        </p>
      )}
    </>
  );
}

// ---------- The possession builder ----------

/** One slot of the builder: a hero, their move, and (for aimed moves) a target or the finisher's picks. */
interface BuildStep {
  cls: Cls;
  move: string;
  target?: string;
  picks?: string[];
}
interface Sim {
  /** The buffs the helpers have built up for the finisher. */
  buffs: Carry;
  /** What the play does: damage, takedowns and points. */
  shot: Proj;
  bucket: boolean;
  notes: { t: string; ok: boolean }[];
  ready: boolean;
  /** Every enemy the whole play damages: HP before and after. */
  hits: { id: string; name: string; before: number; after: number; max: number; ko: boolean }[];
  /** The Barrier soaks the play's first damaging move. */
  barrierBroken: boolean;
  /** The horde's turn that would follow this play (with the current defenders). */
  horde?: { points: number; lines: { t: string; pts?: number; side: string }[] };
}
/** Whether a move earlier than slot i breaks the Barrier, so slot i can aim past it. */
const barrierBrokenBefore = (slots: (BuildStep | null)[], i: number) =>
  slots.slice(0, i).some((st) => st && (MOVE[st.move].damage ?? 0) > 0 && (MOVE[st.move].targets ?? 'none') !== 'none');
const SLOT_ROLE = ['Start', 'Support', 'Support', 'Finish'];

/** Play the built slots on a copy of the game, without frames, to show what the shot will do. */
function simulateBuild(g: Game, slots: (BuildStep | null)[], defense?: Defense): Sim {
  const fin = slots[3];
  const primary = fin?.picks?.[0] ?? fin?.target;
  const finMove = fin ? MOVE[fin.move] : null;
  const ready = !!fin && (!needsTarget(finMove!) || !!primary);
  let l = beginLive(g);
  for (const st of slots.slice(0, 3)) if (st) l = liveStepFast(l, { cls: st.cls, move: st.move }, st.target ?? primary);
  const buffs = l.ctx.carry;
  const before = new Map(l.ctx.g.enemies.map((e) => [e.id, e.hp]));
  const shotsBefore = l.ctx.g.stats.party.shots;
  if (fin && ready) l = liveStepFast(l, { cls: fin.cls, move: fin.move }, primary, fin.picks);
  let damage = 0;
  let kills = 0;
  for (const e of l.ctx.g.enemies) {
    const b0 = g.enemies.find((x) => x.id === e.id)?.hp ?? 0;
    if (b0 > 0) damage += b0 - Math.max(0, e.hp);
    if (b0 > 0 && e.hp <= 0) kills += 1;
  }
  void before;
  const hits = g.enemies
    .filter((e) => e.arrived && e.hp > 0)
    .map((e) => {
      const after = Math.max(0, l.ctx.g.enemies.find((x) => x.id === e.id)?.hp ?? e.hp);
      return { id: e.id, name: e.name.replace('Goblin ', ''), before: e.hp, after, max: e.maxHp, ko: after <= 0 };
    })
    .filter((x) => x.after < x.before);
  const barrierBroken = g.barrierUp && !l.ctx.g.barrierUp;
  const points = l.ctx.g.score.party - g.score.party;
  const bucket = l.ctx.g.stats.party.shots > shotsBefore;

  // Notes on the defenses in the way, and what handles them.
  const notes: { t: string; ok: boolean }[] = [];
  const order = slots.map((s, i) => (s ? { s, i, m: MOVE[s.move] } : null)).filter((x): x is { s: BuildStep; i: number; m: Move } => !!x);
  const deals = (m: Move) => (m.damage ?? 0) > 0 && (m.targets ?? 'none') !== 'none';
  let afterBarrier = order;
  if (g.barrierUp) {
    const first = order.find((x) => deals(x.m));
    order
      .filter((x) => (!first || x.i < first.i) && (x.m.targets ?? 'none') !== 'none' && !deals(x.m))
      .forEach((x) => notes.push({ t: `${x.m.name} is stopped by the Barrier: put a damaging move before it.`, ok: false }));
    if (!first) notes.push({ t: 'The Barrier is up: a damaging move has to break it first.', ok: false });
    else if (first.i === 3) notes.push({ t: `The Barrier will absorb your finisher (no bucket). Put a damaging move in Start.`, ok: false });
    else notes.push({ t: `${first.m.name} breaks the Barrier.`, ok: true });
    afterBarrier = first ? order.filter((x) => x.i > first.i) : [];
  }
  if (blockUp(g)) {
    const first = afterBarrier.find((x) => deals(x.m));
    if (first && first.i === 3) {
      if (first.m.sure || buffs.sure) notes.push({ t: 'Sure: the finisher gets through the Block.', ok: true });
      else notes.push({ t: `The Block will cancel your finisher’s first hit. Add a cheap hit before it, or a Sure pass.`, ok: false });
    } else if (first) notes.push({ t: `${first.m.name} takes the Block.`, ok: true });
  }
  const t = taunter(g);
  if (t && fin && finMove?.targets === 'primary' && primary && primary !== t.id && (finMove.damage ?? 0) > 0)
    notes.push({ t: `The ${t.name.replace('Goblin ', '')} Taunts: your finisher will hit it instead.`, ok: false });
  if (fin && ready && !bucket) {
    const target = g.enemies.find((e) => e.id === primary);
    notes.push({
      t: target?.kind === 'goblin' ? 'No bucket: goblins only score their takedowns.' : 'No bucket: the finisher doesn’t get damage through.',
      ok: false,
    });
  }
  // Play out the horde's turn that would follow.
  let horde: Sim['horde'];
  if (defense) {
    const res = finishLive(l, defense);
    const lines = res.frames
      .filter((f) => f.phase === 'horde' && !/^Possession|^Halftime|^Final/.test(f.text))
      .map((f) => ({ t: f.text, pts: f.side === 'horde' ? f.pts : undefined, side: f.side }));
    horde = { points: res.game.score.horde - g.score.horde, lines };
  }
  return { buffs, shot: { damage, kills, points }, bucket, notes, ready, hits, barrierBroken, horde };
}

function BuilderSheet(props: {
  game: Game;
  slots: (BuildStep | null)[];
  sim: Sim;
  presetName: string | null;
  playbook: Play[];
  editSlot: number | null;
  aimSlot: number | null;
  aimMax: number;
  aimPrompt: string | null;
  defense: Defense;
  manual: boolean;
  anyTouches: boolean;
  setOverride: (f: (d: Defense) => Defense) => void;
  onEdit: (i: number) => void;
  onCloseEdit: () => void;
  onChoose: (i: number, step: BuildStep) => void;
  onClear: (i: number) => void;
  onAim: (i: number) => void;
  onFollow: (i: number) => void;
  onAimDone: () => void;
  onPreset: (p: Play) => void;
  onSuggest: () => void;
  onClearAll: () => void;
  onRun: () => void;
  onHold: () => void;
  onCollapse: () => void;
}) {
  const g = props.game;
  const { slots, sim } = props;
  const [pickHero, setPickHero] = useState<Cls | null>(null);
  const [showDefense, setShowDefense] = useState(false);
  useEffect(() => {
    setPickHero(props.editSlot !== null ? (slots[props.editSlot]?.cls ?? null) : null);
  }, [props.editSlot]); // eslint-disable-line
  const fin = slots[3];
  const primary = fin?.picks?.[0] ?? fin?.target;
  const name = (id?: string) => (id ? (g.enemies.find((e) => e.id === id)?.name.replace('Goblin ', '') ?? '') : '');
  const targetText = (st: BuildStep, i: number) => {
    const m = MOVE[st.move];
    if (!needsTarget(m)) return m.targets === 'all' ? 'every enemy' : '';
    if (i === 3) return st.picks?.length ? `→ ${st.picks.map(name).join(', ')}` : st.target ? `→ ${name(st.target)}` : 'pick a target';
    return st.target ? `→ ${name(st.target)}` : '→ finisher’s target';
  };
  const buffText = (m: Move) => (m.enabler ? (m.enabler.kind === 'armor' ? 'Armor' : m.enablerText?.split(' (')[0]) : '');
  const off = defenders(g, new Set(slots.filter((s): s is BuildStep => !!s).map((s) => s.cls)));
  const roleText = (c: Cls) => {
    const d = props.defense;
    const who = (x?: string) => (x === 'gate' ? 'gate' : x ? (CLASS_INFO[x as Cls]?.name ?? name(x)) : '');
    if (c === 'warrior') return `Protect → ${who(d.protect)}`;
    if (c === 'ranger') return `Close Out → ${who(d.closeOut)}`;
    if (c === 'wizard') return `Ward → ${who(d.ward)}`;
    return CLASS_INFO[c].defense;
  };

  // Aiming: the board is the picker, so the sheet shrinks to a bar.
  if (props.aimSlot !== null) {
    const st = slots[props.aimSlot];
    const m = st ? MOVE[st.move] : null;
    const multi = props.aimSlot === 3 && props.aimMax > 1;
    const n = st?.picks?.length ?? 0;
    return (
      <div className="sheet builder compact">
        <div className="sheet-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              🎯 <strong>{m?.name}</strong>: {multi ? `tap up to ${props.aimMax} targets (${n} picked)` : 'tap a target on the board'}
            </span>
            <button className="btn primary small" disabled={multi && n === 0} onClick={props.onAimDone}>
              {multi ? 'Done' : 'Cancel'}
            </button>
          </div>
          {props.aimPrompt && <span className="small ok">✂️ {props.aimPrompt}</span>}
        </div>
      </div>
    );
  }

  // Picking a hero and move for one slot.
  if (props.editSlot !== null) {
    const i = props.editSlot;
    const cur = slots[i];
    const usedElsewhere = new Set(slots.filter((s, j) => s && j !== i).map((s) => s!.cls));
    const why = (c: Cls) => {
      const h = g.heroes[c];
      if (h.benched > 0 || h.hp <= 0) return 'on the bench';
      if (h.touches <= 0) return 'no touches';
      if (usedElsewhere.has(c)) return 'in the play';
      return '';
    };
    const hero = pickHero ? g.heroes[pickHero] : null;
    const moves = hero
      ? MOVES.filter(
          (m) => m.cls === hero.cls && (i === 3 ? isFinisher(m) : !isFinisher(m)) && (m.kind !== 'signature' || hero.dd) && (m.kind !== 'legendary' || hero.td),
        )
      : [];
    return (
      <div className="sheet builder">
        <div className="sheet-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>
              {SLOT_ROLE[i]}: {pickHero ? 'pick a move' : 'pick a hero'}
            </strong>
            <button className="btn quiet small" onClick={props.onCloseEdit}>
              ✕ Close
            </button>
          </div>
          {cur && (
            <div className="row">
              {i < 3 && needsTarget(MOVE[cur.move]) && (
                <>
                  <button className="btn small" onClick={() => props.onAim(i)}>
                    🎯 Aim {MOVE[cur.move].name}
                  </button>
                  {cur.target && (
                    <button className="btn small quiet" onClick={() => props.onFollow(i)}>
                      Follow the finisher’s target
                    </button>
                  )}
                </>
              )}
              {i === 3 && needsTarget(MOVE[cur.move]) && (
                <button className="btn small" onClick={() => props.onAim(3)}>
                  🎯 Change target
                </button>
              )}
              <button className="btn small quiet" onClick={() => props.onClear(i)}>
                Remove
              </button>
            </div>
          )}
          <div className="livepick">
            {CLASSES.map((c) => {
              const w = why(c);
              return (
                <button key={c} className={`lhero ${pickHero === c ? 'on' : ''}`} disabled={!!w} aria-pressed={pickHero === c} onClick={() => setPickHero(c)}>
                  <span>{CLASS_INFO[c].icon}</span>
                  <strong>{CLASS_INFO[c].name}</strong>
                  <span className="small muted">{lastName(g.heroes[c].player)}</span>
                  <span className="bar hpbar" aria-hidden="true">
                    <i style={{ width: `${(Math.max(0, g.heroes[c].hp) / g.heroes[c].maxHp) * 100}%` }} />
                  </span>
                  <span className="small num">
                    {Math.max(0, g.heroes[c].hp)}/{g.heroes[c].maxHp} HP
                  </span>
                  <span className="small muted">{w || `${g.heroes[c].touches} touches`}</span>
                </button>
              );
            })}
          </div>
          {hero && (
            <div className="movegrid">
              {moves.map((m) => {
                const used = hero.usedSpecial.includes(m.id);
                const chosen = cur?.cls === hero.cls && cur.move === m.id;
                return (
                  <button
                    key={m.id}
                    className={`mcard ${chosen ? 'on' : ''} ${isFinisher(m) ? 'fin' : ''} ${isSpecial(m) ? 'special' : ''}`}
                    disabled={used}
                    onClick={() =>
                      props.onChoose(i, {
                        cls: hero.cls,
                        move: m.id,
                        // A new finisher keeps the target already chosen.
                        target: i === 3 ? cur?.target : undefined,
                        picks: i === 3 && cur && MOVE[cur.move].targets === m.targets ? cur.picks : undefined,
                      })
                    }
                  >
                    <strong>{m.name}</strong>
                    <span className={`mkind ${isSpecial(m) ? 'special' : isFinisher(m) ? 'fin' : ''}`}>
                      {m.kind === 'signature' ? '★ DD special' : m.kind === 'legendary' ? '★★ TD special' : isFinisher(m) ? 'Finisher' : `Buff: ${buffText(m)}`}
                    </span>
                    <span className="small">{m.action}</span>
                    {used && <span className="small err">used this game</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // The builder: saved plays, the four slots, the shot, defense and Run.
  return (
    <div className="sheet builder">
      <div className="sheet-inner">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">Possession builder</span>
          <button className="btn quiet small" onClick={props.onCollapse} aria-label="Close the possession builder">
            ✕ Close
          </button>
        </div>
        <div className="presetrow" aria-label="Saved plays">
          <button className="chipbtn suggest" onClick={props.onSuggest}>
            ✨ Suggest
          </button>
          {props.playbook.map((p) => (
            <button
              key={p.id}
              className={`chipbtn ${props.presetName === p.name ? 'on' : ''}`}
              disabled={!playAvailable(g, p).ok}
              onClick={() => props.onPreset(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="slotstrip">
          {slots.map((st, i) => {
            const m = st ? MOVE[st.move] : null;
            return (
              <button key={i} className={`slot2 ${i === 3 ? 'finish' : ''} ${st ? 'filled' : ''}`} onClick={() => props.onEdit(i)}>
                <span className="slotlabel">{SLOT_ROLE[i]}</span>
                {st && m ? (
                  <>
                    <span className="slotmove">
                      {CLASS_INFO[st.cls].icon} {m.name}
                    </span>
                    {i < 3 && buffText(m) && <span className="slotbuff">+{buffText(m)}</span>}
                    <span className={`slottarget ${i === 3 && !st.target && needsTarget(m) ? 'err' : ''}`}>{targetText(st, i)}</span>
                  </>
                ) : (
                  <span className="slotempty">+ {i === 3 ? 'Finisher' : 'Add'}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="shotpanel">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>
              🏀 <strong>{fin ? MOVE[fin.move].name : 'No finisher yet'}</strong>
              {fin && primary ? ` → ${fin.picks?.length ? fin.picks.map(name).join(', ') : name(primary)}` : ''}
            </span>
            {sim.ready && (
              <span className={`num ${sim.bucket ? 'ok' : 'err'}`}>
                {sim.shot.damage} dmg{sim.shot.kills ? ` · ${sim.shot.kills} KO` : ''} · <strong>+{sim.shot.points}</strong>
              </span>
            )}
          </div>
          <div className="chips">
            {describeCarry(sim.buffs).map((b) => (
              <span key={b} className="chip ball">
                {b}
              </span>
            ))}
            {!describeCarry(sim.buffs).length && <span className="small muted">Helpers add buffs to the finisher: Crit, Pierce, Sure, Split, Armor.</span>}
          </div>
          {sim.notes.map((n) => (
            <span key={n.t} className={`small ${n.ok ? 'ok' : 'warn'}`}>
              {n.ok ? '✓' : '⚠'} {n.t}
            </span>
          ))}
          {(sim.hits.length > 0 || sim.barrierBroken) && (
            <div className="dmglist" aria-label="Damage by target">
              <span className="eyebrow">Damage by target</span>
              {sim.barrierBroken && (
                <span className="dmgrow">
                  <span>✨ Barrier</span>
                  <span className="ok">broken</span>
                </span>
              )}
              {sim.hits.map((h) => (
                <span key={h.id} className="dmgrow">
                  <span>{h.name}</span>
                  <span className="bar horde dmgbar" aria-hidden="true">
                    <i style={{ width: `${(h.after / h.max) * 100}%` }} />
                  </span>
                  <span className="num">
                    −{h.before - h.after} · {h.ko ? <strong className="ok">KO</strong> : `${h.after} left`}
                  </span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="row defline">
          <span className="small">
            <strong>Defending:</strong> {off.length ? off.map((c) => `${CLASS_INFO[c].icon} ${roleText(c)}`).join(' · ') : 'nobody'}
          </span>
          {props.manual && off.length > 0 && (
            <button className="linkish" onClick={() => setShowDefense((x) => !x)}>
              {showDefense ? 'Done' : 'Change'}
            </button>
          )}
        </div>
        {props.manual && showDefense && (
          <div className="defrow">
            {off.map((c) => (
              <DefenseLine
                key={c}
                cls={c}
                game={g}
                defense={props.defense}
                manual={props.manual}
                heroes={activeHeroes(g).map((h) => h.cls)}
                champs={onField(g).filter((e) => e.kind !== 'goblin' && e.kind !== 'wagon')}
                setOverride={props.setOverride}
              />
            ))}
          </div>
        )}
        {props.anyTouches ? (
          <div className="row">
            <button className="btn quiet" onClick={props.onClearAll}>
              Clear
            </button>
            <button className="btn primary big" style={{ flex: 1, width: 'auto' }} disabled={!sim.ready} onClick={props.onRun}>
              Run the play ▸
            </button>
          </div>
        ) : (
          <button className="btn primary big" onClick={props.onHold}>
            Hold the ball (no touches left)
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- Pre-game ----------

function PlanScreen(props: {
  game: Game;
  live: boolean;
  playbook: Play[];
  onSuggest: () => void;
  onChange: (slot: number) => void;
  onEdit: (slot: number) => void;
  onTipOff: () => void;
  onMenu: () => void;
}) {
  const g = props.game;
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  const [tab, setTab] = useState<'heroes' | 'horde'>('heroes');
  const pickTab = (t: 'heroes' | 'horde') => {
    setTab(t);
    setOpen(null);
    window.scrollTo(0, 0);
  };
  const counts: Partial<Record<Cls, number>> = {};
  for (const p of props.playbook) for (const s of p.steps) counts[s.cls] = (counts[s.cls] ?? 0) + 1;
  const warnings = (Object.entries(counts) as [Cls, number][])
    .map(([c, n]) => {
      const h = g.heroes[c];
      const plays = props.playbook.filter((p) => p.steps.some((s) => s.cls === c)).length;
      return plays >= 3 || n > h.touchesMax / 2 ? `${CLASS_INFO[c].name} is in ${plays} of ${props.playbook.length} plays with ${h.touchesMax} touches.` : null;
    })
    .filter(Boolean) as string[];
  const champs = g.enemies.filter((e) => e.kind !== 'goblin' && e.kind !== 'wagon').sort((a, b) => a.quarter - b.quarter);
  const goblins = g.enemies.filter((e) => e.kind === 'goblin');
  const openChamp = champs.find((e) => e.id === open);
  const openHero = CLASSES.find((c) => `hero-${c}` === open);
  const openPlay = HORDE_PLAYS.find((p) => `hp-${p.id}` === open);

  return (
    <>
      <div className="tabbar">
        <div className="tabbar-inner">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow">Game plan · Goblin Horde</span>
            <button className="btn quiet small" onClick={props.onMenu}>
              Menu
            </button>
          </div>
          <div className="bigtabs" role="tablist" aria-label="Game plan">
            {(['heroes', 'horde'] as const).map((t) => (
              <button key={t} role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls="plan-panel" onClick={() => pickTab(t)}>
                {t === 'heroes' ? 'Heroes' : 'Horde'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="wrap" id="plan-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        <p className="small muted">Tap anything for details.</p>
        {tab === 'horde' && (
          <>
            <section className="stack">
              <span className="eyebrow">The horde</span>
              <div className="mini-grid">
                {champs.map((e) => (
                  <button key={e.id} className={`mini ${open === e.id ? 'on' : ''}`} aria-expanded={open === e.id} onClick={() => toggle(e.id)}>
                    <span className="mini-top">
                      <span>{ENEMY_INFO[e.kind].icon}</span>
                      <span className={`tier ${e.tier}`}>{tierLabel(e.tier!)}</span>
                    </span>
                    <strong>{e.name.replace('Goblin ', '')}</strong>
                    <span className="small muted">
                      {lastName(e.player ?? '')} · Q{e.quarter}
                    </span>
                  </button>
                ))}
                <button className={`mini ${open === 'goblins' ? 'on' : ''}`} aria-expanded={open === 'goblins'} onClick={() => toggle('goblins')}>
                  <span className="mini-top">
                    <span>👺</span>
                    <span className="tier">×{goblins.length}</span>
                  </span>
                  <strong>Goblins</strong>
                  <span className="small muted">crew the ram</span>
                </button>
              </div>
              {openChamp && (
                <div className="panel detail">
                  <strong>
                    {openChamp.name}
                    {openChamp.boss ? ' · boss' : ''}
                  </strong>
                  <span className="small muted">
                    {openChamp.player} ({openChamp.team}) · mirrors your {ENEMY_INFO[openChamp.kind].mirrors} · arrives in Q{openChamp.quarter}
                  </span>
                  <span className="small num">
                    {openChamp.maxHp} HP · hits for {openChamp.damage} · worth 🏀 {openChamp.points}
                  </span>
                  <span className="small">{ENEMY_INFO[openChamp.kind].job}</span>
                </div>
              )}
              {open === 'goblins' && (
                <div className="panel detail">
                  <strong>{goblins.length} goblins</strong>
                  <span className="small muted">
                    1 per 40 opposing points ({week.teams.map((t) => `${t.team} ${t.pts}`).join(', ')}). Q1 {goblins.filter((x) => x.quarter === 1).length}, Q2{' '}
                    {goblins.filter((x) => x.quarter === 2).length}, Q3 {goblins.filter((x) => x.quarter === 3).length}.
                  </span>
                  <span className="small num">{g.tuning.goblinHp} HP · worth 🏀 1</span>
                  <span className="small">{ENEMY_INFO.goblin.job}</span>
                </div>
              )}
            </section>

            <section className="stack">
              <span className="eyebrow">Objectives</span>
              <div className="mini-grid">
                <button className={`mini ${open === 'gate' ? 'on' : ''}`} aria-expanded={open === 'gate'} onClick={() => toggle('gate')}>
                  <span>🚪</span>
                  <strong>Storm the Gate</strong>
                  <span className="small muted">theirs · ram hits {g.ramBase}</span>
                </button>
                <button className={`mini ${open === 'bounty' ? 'on' : ''}`} aria-expanded={open === 'bounty'} onClick={() => toggle('bounty')}>
                  <span>🎯</span>
                  <strong>Shaman bounty</strong>
                  <span className="small muted">+{g.tuning.bountyPoints} by end of Q1</span>
                </button>
                <button className={`mini ${open === 'wagon' ? 'on' : ''}`} aria-expanded={open === 'wagon'} onClick={() => toggle('wagon')}>
                  <span>📦</span>
                  <strong>Loot wagon</strong>
                  <span className="small muted">Q2 · points and gold</span>
                </button>
              </div>
              {open === 'gate' && (
                <div className="panel detail small">
                  The ram needs 4 goblins pushing. It hits the {g.gate.max}-HP gate for {g.ramBase} each enemy turn, +1 per extra goblin (the opponents shot{' '}
                  {(opponentsFg() * 100).toFixed(1)}% this week). The horde scores 1 per 2 gate damage and 10 when it falls; after that, every goblin on the
                  field pillages for 1 a turn.
                </div>
              )}
              {open === 'bounty' && (
                <div className="panel detail small">
                  Take down the Goblin Shaman before the end of the first quarter for +{g.tuning.bountyPoints} on top of its takedown. It also stops the
                  reinforcements at the source.
                </div>
              )}
              {open === 'wagon' && (
                <div className="panel detail small">Arrives in Q2 with 15 HP. Armor 2. Breaking it scores 3 and 5 gold, but hitting it makes no bucket.</div>
              )}
            </section>

            <section className="stack">
              <span className="eyebrow">Their playbook</span>
              <div className="stack" style={{ gap: 4 }}>
                {HORDE_PLAYS.map((p, i) => (
                  <button
                    key={p.id}
                    className={`linerow ${open === `hp-${p.id}` ? 'on' : ''}`}
                    aria-expanded={open === `hp-${p.id}`}
                    onClick={() => toggle(`hp-${p.id}`)}
                  >
                    <span className="num muted">{i + 1}</span>
                    <strong>{p.name}</strong>
                    <span className="small muted">{p.short}</span>
                  </button>
                ))}
              </div>
              {openPlay && (
                <div className="panel detail small">
                  Called {openPlay.when === 'otherwise' ? 'when nothing else fits' : `when ${openPlay.when}`}:{' '}
                  {openPlay.steps.map((s) => s.actors.map((a) => ENEMY_INFO[a].name.replace('Goblin ', '')).join(' or ')).join(' → ')}. Only their call shows
                  during the game; if your play breaks it, they switch to the next play that fits, in this order.
                </div>
              )}
            </section>
          </>
        )}
        {tab === 'heroes' && (
          <>
            <section className="stack">
              <span className="eyebrow">Your week</span>
              <div className="hero-grid">
                {CLASSES.map((c) => {
                  const h = g.heroes[c];
                  return (
                    <button
                      key={c}
                      className={`mini ${open === `hero-${c}` ? 'on' : ''}`}
                      aria-expanded={open === `hero-${c}`}
                      onClick={() => toggle(`hero-${c}`)}
                    >
                      <span>{CLASS_INFO[c].icon}</span>
                      <strong>{CLASS_INFO[c].name}</strong>
                      <span className="small muted">{lastName(h.player)}</span>
                      <span className="small muted">{h.touchesMax} touches</span>
                    </button>
                  );
                })}
              </div>
              {openHero &&
                (() => {
                  const h = g.heroes[openHero];
                  const l = h.line;
                  return (
                    <div className="panel detail">
                      <strong>
                        {CLASS_INFO[openHero].name} · {h.player}
                      </strong>
                      <span className="small muted num">
                        vs {h.opp}: {l.pts} pts, {l.reb} reb, {l.ast} ast, {l.stl} stl, {l.blk} blk, {l.fg3m} 3PM, {l.tov} tov, {l.min} min
                      </span>
                      <span className="row">
                        <span className={`tier ${h.tier}`}>Offense {tierLabel(h.tier)}</span>
                        <span className={`tier ${h.defTier}`}>Defense {tierLabel(h.defTier)}</span>
                      </span>
                      <span className="small">
                        {h.touchesMax} touches · {CLASS_INFO[openHero].defense} on defense
                        {h.td ? ' · triple-double: signature and legendary finishers' : h.dd ? ' · double-double: signature finisher' : ''}
                      </span>
                      <span className="chips">
                        {MOVES.filter((m) => m.cls === openHero && (m.kind !== 'signature' || h.dd) && (m.kind !== 'legendary' || h.td)).map((m) => (
                          <span key={m.id} className={`chip ${isSpecial(m) ? `special ${m.kind === 'legendary' ? 'td' : ''}` : isFinisher(m) ? 'ball' : ''}`}>
                            {m.name}
                            {m.kind === 'signature' ? ' ★ DD' : m.kind === 'legendary' ? ' ★★ TD' : ''}
                          </span>
                        ))}
                      </span>
                    </div>
                  );
                })()}
            </section>

            {props.live ? (
              <div className="panel small">
                <strong>Live offense</strong>
                <span>
                  You build each possession during the game: pick a hero, pick a move, pick a target, then pass to the next hero. Up to 4 actions; the last must
                  be a finisher. Tap a hero above to see their moves.
                </span>
              </div>
            ) : (
              <>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <h2>Your playbook</h2>
                  <button className="btn" onClick={props.onSuggest}>
                    Suggest plays
                  </button>
                </div>
                {props.playbook.map((p, i) => (
                  <PlaySlot
                    key={i}
                    play={p}
                    open={open === `slot-${i}`}
                    onToggle={() => toggle(`slot-${i}`)}
                    onChange={() => props.onChange(i)}
                    onEdit={() => props.onEdit(i)}
                  />
                ))}
                {warnings.map((w) => (
                  <p className="warn" key={w}>
                    ⚠ {w}
                  </p>
                ))}
              </>
            )}
          </>
        )}
        <button className="btn primary big" onClick={props.onTipOff}>
          Tip off
        </button>
      </div>
    </>
  );
}

function PlaySlot(props: { play: Play; open: boolean; onToggle: () => void; onChange: () => void; onEdit: () => void }) {
  const p = props.play;
  const form = playForm(p);
  const [step, setStep] = useState<number | null>(null);
  useEffect(() => {
    if (!props.open) setStep(null);
  }, [props.open]);
  const s = step !== null ? p.steps[step] : null;
  const m = s ? MOVE[s.move] : null;
  const next = step !== null && step < p.steps.length - 1 ? p.steps[step + 1] : null;
  const nextMove = next ? MOVE[next.move] : undefined;
  const hero = s ? week.heroes.find((h) => h.cls === s.cls)! : null;
  return (
    <div className="panel slotcard">
      <button className="slothead" aria-expanded={props.open} onClick={props.onToggle}>
        <h3>{p.name}</h3>
        <span className="small muted">{p.steps.map((x) => CLASS_INFO[x.cls].icon).join(' → ')}</span>
        {form && <span className="chip ball">{form.split(' ')[0]}</span>}
      </button>
      {props.open && (
        <div className="stack">
          <div className="steprow" style={{ gridTemplateColumns: `repeat(${p.steps.length}, minmax(0, 1fr))` }}>
            {p.steps.map((x, i) => {
              const mv = MOVE[x.move];
              return (
                <button
                  key={i}
                  className={`stepcard ${step === i ? 'on' : ''} ${isFinisher(mv) ? 'fin' : ''}`}
                  aria-expanded={step === i}
                  onClick={() => setStep(step === i ? null : i)}
                >
                  <span className="sc-top">
                    <span>{CLASS_INFO[x.cls].icon}</span>
                    <span className="sc-n num">{i + 1}</span>
                  </span>
                  <strong>{mv.name}</strong>
                  <span className="small muted">{isFinisher(mv) ? 'Finisher' : CLASS_INFO[x.cls].name}</span>
                </button>
              );
            })}
          </div>
          {s && m && hero ? (
            <div className="panel detail small">
              <strong>
                Step {step! + 1} · {CLASS_INFO[s.cls].name} ({lastName(hero.player)}) · {m.name}
              </strong>
              <span>
                <b>Action:</b> {m.action}.
              </span>
              {isFinisher(m) ? (
                <span>
                  <b>Finisher:</b> ends the play. Scores 2 if it damages a Champion or the boss after their defenses, plus takedown points.
                </span>
              ) : (
                <span>
                  <b>Pass to the {CLASS_INFO[next!.cls].name}:</b> {m.enablerText}.{' '}
                  {passHelps(m, nextMove) ? <span className="ok">✓ boosts {nextMove?.name}</span> : <span className="err">– wasted on {nextMove?.name}</span>}
                </span>
              )}
              {m.note && <span className="muted">{m.note}</span>}
              <span className="muted">
                {lastName(hero.player)} is {hero.tier === 'average' ? 'Average' : tierLabel(hero.tier as Tier)} this week, so numbers are ×
                {TIER_MULT[hero.tier as Tier]}.
              </span>
            </div>
          ) : (
            <span className="small muted">Tap a move for details.</span>
          )}
          <div className="chips">
            {p.tags.map((t) => (
              <span className="chip" key={t}>
                {t}
              </span>
            ))}
            {form && <span className="chip ball">{form}</span>}
          </div>
          {p.blurb && <span className="small muted">{p.blurb}</span>}
          <div className="row">
            <button className="btn" onClick={props.onChange}>
              Change
            </button>
            <button className="btn quiet" onClick={props.onEdit}>
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Game screen ----------

function Scoreboard(props: {
  game: Game;
  onTimeout: () => void;
  canTimeout: boolean;
  onMenu: () => void;
  onLast?: () => void;
  /** What the horde will score on its next turn, if the current plan runs. */
  hordeNext?: number;
  onHorde?: () => void;
}) {
  const g = props.game;
  const q = quarterOf(Math.min(11, g.possession));
  const inQ = Math.min(11, g.possession) % 3;
  return (
    <div className="board">
      <div className="board-inner">
        <div className="side">
          <span className="team">Heroes</span>
          <span className="pts">{g.score.party}</span>
        </div>
        <div className="clock" aria-label={`Quarter ${q}, possession ${inQ + 1} of 3`}>
          <span className="q">Q{q}</span>
          <span className="pips">
            {[0, 1, 2].map((i) => (
              <span key={i} className={`pip ${i <= inQ ? 'on' : ''}`} />
            ))}
          </span>
        </div>
        <div className="side right">
          {props.hordeNext !== undefined && (
            <button className="hordechip" onClick={props.onHorde} aria-label={`The horde will score ${props.hordeNext} on its next turn. Details`}>
              +{props.hordeNext}
            </button>
          )}
          <span className="pts">{g.score.horde}</span>
          <span className="team">Goblins</span>
        </div>
      </div>
      <div className="board-tools">
        <button onClick={props.onTimeout} disabled={!props.canTimeout} title="Take back the last possession">
          Timeouts: {g.timeouts}
        </button>
        <span style={{ whiteSpace: 'nowrap' }}>{Math.min(12, g.possession + 1)} of 12</span>
        <span className="row" style={{ gap: 6 }}>
          {props.onLast && <button onClick={props.onLast}>Recap</button>}
          <button onClick={props.onMenu}>Menu</button>
        </span>
      </div>
    </div>
  );
}

function Objectives(props: { game: Game }) {
  const g = props.game;
  const c = crew(g);
  const p = pushing(g);
  const wagon = g.enemies.find((e) => e.kind === 'wagon');
  return (
    <div className="panel objectives">
      <div className="gate">
        <span title="The city gate">🚪 Gate</span>
        <div className={`bar gate`} role="meter" aria-valuenow={g.gate.hp} aria-valuemin={0} aria-valuemax={g.gate.max} aria-label="Gate HP">
          <i style={{ width: `${(g.gate.hp / g.gate.max) * 100}%` }} />
        </div>
        <span className="num small">{g.gate.breached ? 'Broken: pillage!' : `${g.gate.hp}/${g.gate.max}`}</span>
      </div>
      {!g.gate.breached && (
        <div className="gate">
          <span>🪵 Ram</span>
          <div className="crewpips" aria-label={`${p.length} of 4 crew pushing`}>
            {Array.from({ length: Math.max(4, c.length) }, (_, i) => (
              <span key={i} className={i < p.length ? '' : i < c.length ? 'idle' : 'off'} />
            ))}
          </div>
          <span className="small">
            {p.length >= 4 ? `hits for ${g.ramBase + (p.length - 4) + g.ramBonus + warDrum(g)}${warDrum(g) ? ' (War Drum +2)' : ''}` : 'stalled'} ·{' '}
            {c.length - p.length > 0 ? `${c.length - p.length} pinned · ` : ''}
            {p.length}/4 pushing
          </span>
        </div>
      )}
      <div className="objline">
        <span>
          🎯 Shaman bounty:{' '}
          {g.bounty === 'open' ? (g.possession <= 2 ? `open until Q1 ends (+${g.tuning.bountyPoints})` : 'open') : g.bounty === 'won' ? 'won ✓' : 'expired'}
        </span>
        <span>📦 Wagon: {!wagon?.arrived ? 'arrives Q2' : wagon.hp > 0 ? `${wagon.hp}/15 HP` : 'broken ✓'}</span>
        {g.gold > 0 && <span>🪙 {g.gold} gold</span>}
      </div>
    </div>
  );
}

function CallBanner(props: { game: Game }) {
  const g = props.game;
  if (g.phase !== 'party') return null;
  const cast = shamanCast(g);
  const shamanLine = cast && (
    <span className="small shamanline">
      {cast === 'pack'
        ? '🥁 Shaman will Call the Pack: fewer than 4 goblins are on the ram.'
        : '🥁 Shaman will raise the Barrier for your next possession. If your play leaves fewer than 4 goblins on the ram, it Calls the Pack instead.'}{' '}
      Disable or take it down to stop it.
    </span>
  );
  if (!g.call)
    return (
      <div className="call small">
        The horde has no play to run this turn{g.gate.breached ? '; its goblins keep pillaging.' : '.'}
        {shamanLine}
      </div>
    );
  return (
    <div className="call" aria-live="polite">
      <span className="eyebrow" style={{ color: 'var(--horde)' }}>
        Horde calls
      </span>
      <strong>{g.call.name}</strong>
      <span className="small">{g.call.text}</span>
      {shamanLine}
    </div>
  );
}

function statusChips(g: Game, e: Enemy) {
  const out: { t: string; c: string }[] = [];
  // The defenses in the way, then the statuses heroes have put on it.
  if (e.taunts && !e.disabled) out.push({ t: '🛡 Taunt', c: 'cont' });
  const armor = armorOf(g, e);
  if (armor > 0) out.push({ t: `Armor ${armor}`, c: 'cont' });
  if (hasQuick(e)) out.push({ t: '💨 Quick', c: 'cont' });
  if (e.barrier && !e.disabled) out.push({ t: '🥁 War Drum', c: 'cont' }, { t: '✨ Barrier or Pack', c: 'cont' });
  if (e.block && blockUp(g)) out.push({ t: '✋ Block', c: 'cont' });
  if (e.taunted) out.push({ t: 'Taunted', c: 'ball' });
  if (e.disabled) out.push({ t: 'Disabled', c: 'ball' });
  if (e.exposed > 1) out.push({ t: 'Marked', c: 'ball' });
  else if (e.exposed > 0) out.push({ t: 'Exposed', c: 'ball' });
  if (e.slowed) out.push({ t: 'Slowed', c: 'ball' });
  return out;
}

function projText(p: Proj | undefined) {
  if (!p) return '';
  const bits = [`${p.damage} dmg`];
  if (p.kills) bits.push(`${p.kills} KO`);
  bits.push(p.points ? `+${p.points}` : '+0');
  return bits.join(' · ');
}

function Board(props: {
  game: Game;
  projections: Map<string, Proj>;
  picking: boolean;
  target: string | null;
  /** An earlier move in the play breaks the Barrier, so the board shows the enemies behind it. */
  barrierHidden?: boolean;
  /** Targets picked for a multi-target move, in order. */
  picks?: string[];
  frame: Frame | null;
  onPick: (id: string) => void;
}) {
  const g = props.game;
  const pickNo = (id: string) => (props.picks ? props.picks.indexOf(id) + 1 : 0);
  const isPicked = (id: string) => props.target === id || pickNo(id) > 0;
  const field = onField(g);
  const big = field.filter((e) => e.kind !== 'goblin');
  const ram = field.filter((e) => e.kind === 'goblin' && e.onRam);
  const free = freeGoblins(g);
  const callIdx = (id: string) => (g.call ? g.call.actors.indexOf(id) : -1);
  const hit = (id: string) => props.frame?.target === id;
  const gob = (e: Enemy) => (
    <button
      key={e.id}
      className={`gob ${e.onRam ? 'ram' : ''} ${props.picking ? 'target' : ''} ${isPicked(e.id) ? 'picked' : ''} ${hit(e.id) ? 'hit' : ''}`}
      onClick={() => props.onPick(e.id)}
      aria-label={`Goblin, ${e.hp} HP${e.onRam ? ', on the ram' : ''}`}
    >
      {pickNo(e.id) > 0 && <span className="pickno">{pickNo(e.id)}</span>}
      👺 <span className="num">{e.hp}</span>
      {e.stripped && <span className="chip ball">Stripped</span>}
      {e.exposed > 0 && <span className="chip ball">Exp</span>}
      {props.picking && !props.picks && <span className="proj">+{props.projections.get(e.id)?.points ?? 0}</span>}
    </button>
  );
  const caster = field.find((e) => e.barrier);
  const blocker = blockUp(g) ? field.find((e) => e.block) : undefined;
  return (
    <div className="stack boardwrap">
      {blocker && !g.barrierUp && (
        <div className="blockbanner" role="note">
          <strong>✋ Block</strong>
          <span className="small">The {blocker.name.replace('Goblin ', '')} cancels the first hit on any enemy this possession. Sure moves get through.</span>
        </div>
      )}
      {g.barrierUp && !props.barrierHidden && (
        <button
          className={`barrier ${props.picking ? 'target' : ''} ${props.frame?.target === 'barrier' ? 'hit' : ''}`}
          onClick={() => props.onPick(caster?.id ?? field[0]?.id ?? '')}
          aria-label="The Barrier: the first damaging hit breaks it"
        >
          <span className="barrier-title">✨ Barrier</span>
          <span className="small">
            The Shaman’s wall stands in front of the whole horde. Nothing behind it can be targeted: the first damaging move breaks it.
          </span>
          {props.picking && !props.picks && <span className="proj">Tap to hit the Barrier</span>}
        </button>
      )}
      <div className="enemies">
        {big.map((e) => {
          const ci = callIdx(e.id);
          return (
            <button
              key={e.id}
              className={`ecard ${props.picking ? 'target' : ''} ${isPicked(e.id) ? 'picked' : ''} ${ci >= 0 ? 'inCall' : ''} ${hit(e.id) ? 'hit' : ''}`}
              onClick={() => props.onPick(e.id)}
              aria-pressed={props.picks ? pickNo(e.id) > 0 : undefined}
            >
              {pickNo(e.id) > 0 && <span className="pickno corner">{pickNo(e.id)}</span>}
              {ci >= 0 && <span className="callstep">{ci + 1}</span>}
              <span className="nm">
                {ENEMY_INFO[e.kind].icon} {e.name.replace('Goblin ', '')}
              </span>
              <span className="who">{e.player ? `${e.player} · ${tierLabel(e.tier!)}` : 'Treasure'}</span>
              <div className={`bar ${e.kind === 'wagon' ? 'gate' : 'horde'}`}>
                <i style={{ width: `${(e.hp / e.maxHp) * 100}%` }} />
              </div>
              <div className="meta num">
                <span>
                  {e.hp}/{e.maxHp}
                </span>
                <span>🏀 {e.points}</span>
              </div>
              <div className="chips">
                {statusChips(g, e).map((c) => (
                  <span key={c.t} className={`chip ${c.c}`}>
                    {c.t}
                  </span>
                ))}
              </div>
              {props.picking && !props.picks && <span className="proj">{projText(props.projections.get(e.id))}</span>}
            </button>
          );
        })}
      </div>
      <div className="panel goblins">
        {!g.gate.breached && (
          <div className="gob-row">
            <span className="small" style={{ minWidth: 70 }}>
              On the ram
            </span>
            {ram.length ? ram.map(gob) : <span className="small muted">none</span>}
          </div>
        )}
        <div className="gob-row">
          <span className="small" style={{ minWidth: 70 }}>
            {g.gate.breached ? 'Pillaging' : 'Off the ram'}
          </span>
          {free.length ? free.map(gob) : <span className="small muted">none</span>}
        </div>
        <span className="small muted">
          {(() => {
            const t = taunter(g);
            const b = blockUp(g);
            const bits = [
              t ? `The ${t.name.replace('Goblin ', '')} Taunts: single-target hits go to it.` : '',
              b ? 'The Chieftain’s Block cancels the first hit this possession.' : '',
            ].filter(Boolean);
            return bits.length ? bits.join(' ') : 'Finishers score 2 when they damage a Champion or the boss.';
          })()}
        </span>
      </div>
    </div>
  );
}

function HeroRow(props: { game: Game; inPlay: Set<Cls>; defense: Defense | null; frame: Frame | null; onTap: (c: Cls) => void }) {
  const g = props.game;
  const d = props.defense;
  const off = d ? new Set(defenders(g, props.inPlay)) : new Set<Cls>();
  const roleText = (c: Cls) => {
    if (!d || !off.has(c)) return '';
    const name = (x?: string) =>
      x === 'gate' ? 'gate' : x ? (CLASS_INFO[x as Cls]?.name ?? g.enemies.find((e) => e.id === x)?.name.replace('Goblin ', '') ?? '') : '?';
    if (c === 'warrior') return `Protect → ${name(d.protect)}`;
    if (c === 'ranger') return `Close Out → ${name(d.closeOut)}`;
    if (c === 'wizard') return `Ward → ${name(d.ward)}`;
    return CLASS_INFO[c].defense;
  };
  return (
    <div className="heroes">
      {CLASSES.map((c) => {
        const h = g.heroes[c];
        const benched = h.benched > 0 || h.hp <= 0;
        const acting = props.frame?.actor === c;
        const targeted = props.frame?.target === c || (!props.frame && g.call?.target === c);
        return (
          <button
            key={c}
            className={`hcard ${props.inPlay.has(c) ? 'onball' : ''} ${acting ? 'acting' : ''} ${targeted ? 'targeted' : ''} ${benched ? 'benched' : ''}`}
            onClick={() => props.onTap(c)}
          >
            <span className="ic">{CLASS_INFO[c].icon}</span>
            <span className="cl">{CLASS_INFO[c].name}</span>
            <span className="pl">{lastName(h.player)}</span>
            <div className="bar">
              <i style={{ width: `${(Math.max(0, h.hp) / h.maxHp) * 100}%` }} />
            </div>
            <span className="small num">{benched ? `bench ${h.benched}` : `${h.hp}/${h.maxHp}`}</span>
            <div className="touch" aria-label={`${h.touches} touches left`}>
              {Array.from({ length: h.touchesMax }, (_, i) => (
                <i key={i} className={i < h.touches ? '' : 'used'} />
              ))}
            </div>
            {h.armor > 0 && <span className="chip">+{h.armor} armor</span>}
            {roleText(c) && <span className="role">{roleText(c)}</span>}
          </button>
        );
      })}
    </div>
  );
}

function DefenseLine(props: {
  cls: Cls;
  game: Game;
  defense: Defense;
  manual: boolean;
  heroes: Cls[];
  champs: Enemy[];
  setOverride: (f: (d: Defense) => Defense) => void;
}) {
  const { cls, defense: d } = props;
  const label = `${CLASS_INFO[cls].icon} ${CLASS_INFO[cls].defense}`;
  const sel = (value: string | undefined, options: { v: string; t: string }[], key: keyof Defense) =>
    props.manual ? (
      <select id={`def-${cls}`} value={value ?? ''} onChange={(e) => props.setOverride((o) => ({ ...o, [key]: e.target.value }))}>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.t}
          </option>
        ))}
      </select>
    ) : (
      <span>{options.find((o) => o.v === value)?.t ?? '—'}</span>
    );
  const heroOpts = props.heroes.map((h) => ({ v: h, t: CLASS_INFO[h].name }));
  let body: ReactNode;
  if (cls === 'warrior') body = sel(d.protect, [...heroOpts, ...(props.game.gate.breached ? [] : [{ v: 'gate', t: 'the gate (halves the ram)' }])], 'protect');
  else if (cls === 'ranger')
    body = sel(
      d.closeOut,
      props.champs.map((e) => ({ v: e.id, t: e.name })),
      'closeOut',
    );
  else if (cls === 'wizard') body = sel(d.ward, heroOpts, 'ward');
  else body = <span className="muted">{CLASS_INFO[cls].defenseText}</span>;
  return (
    <>
      <label htmlFor={`def-${cls}`}>{label}</label>
      {body}
    </>
  );
}

function ReplayBody(props: { replay: Replay; beats: Beat[]; beat: number }) {
  const { replay, beats } = props;
  const shownBeats = beats.slice(0, props.beat);
  const shownIdx = new Set(shownBeats.filter((b): b is number => b !== 'break'));
  const fr = replay.frames;
  const partyFrames = fr.map((f, i) => ({ f, i })).filter((x) => x.f.phase === 'party');
  const hordeFrames = fr.map((f, i) => ({ f, i })).filter((x) => x.f.phase === 'horde' && shownIdx.has(x.i));
  const lastShown = [...shownBeats].reverse().find((b) => b !== 'break');
  const pastBreak = shownBeats.includes('break');
  const partyPts = partyFrames.filter((x) => shownIdx.has(x.i)).reduce((s, x) => s + (x.f.side === 'party' ? (x.f.pts ?? 0) : 0), 0);
  const hordePts = hordeFrames.reduce((s, x) => s + (x.f.side === 'horde' ? (x.f.pts ?? 0) : 0), 0);
  const play = replay.play;
  const info = partyFrames.filter((x) => x.f.step === undefined && shownIdx.has(x.i));
  const hordeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    hordeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [hordeFrames.length]);
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow" style={{ color: 'var(--party)' }}>
          Your possession{play && play.name !== 'Your play' ? ` · ${play.name}` : ''}
        </span>
        <span className="floatpts num">+{partyPts}</span>
      </div>
      {info.map((x) => (
        <span key={x.i} className="small muted">
          {x.f.text}
        </span>
      ))}
      {play && (
        <div className="steprow" style={{ gridTemplateColumns: `repeat(${play.steps.length}, minmax(0, 1fr))` }}>
          {play.steps.map((st, si) => {
            const mv = MOVE[st.move];
            const mine = partyFrames.filter((x) => x.f.step === si && shownIdx.has(x.i));
            const main = mine.find((x) => x.f.kind === 'step');
            const kos = mine.filter((x) => x.f.kind === 'ko').length;
            const put = mine.find((x) => x.f.kind === 'putback');
            const pts = mine.reduce((s, x) => s + (x.f.pts ?? 0), 0);
            const current = mine.some((x) => x.i === lastShown) && !pastBreak;
            const next = play.steps[si + 1];
            return (
              <div key={si} className={`stepcard result ${main ? 'done' : 'todo'} ${current ? 'on' : ''}`}>
                <span className="sc-top">
                  <span>{CLASS_INFO[st.cls].icon}</span>
                  <span className="sc-n num">{si + 1}</span>
                </span>
                <strong>{mv.name}</strong>
                {main ? (
                  <>
                    <span className="sc-res">{main.f.result}</span>
                    {put && <span className="sc-res">{put.f.result}</span>}
                    {next && mv.enablerText && (
                      <span className="sc-pass">
                        → {mv.enablerText} to the {CLASS_INFO[next.cls].name}
                      </span>
                    )}
                    {(kos > 0 || pts > 0) && (
                      <span className="sc-pts num">
                        {kos ? `${kos} KO · ` : ''}+{pts}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="small muted">{isFinisher(mv) ? 'Finisher' : CLASS_INFO[st.cls].name}</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {pastBreak && (
        <>
          <div className="row turnhead" style={{ justifyContent: 'space-between' }}>
            <span className="eyebrow" style={{ color: 'var(--horde)' }}>
              Their turn{replay.before.call ? ` · ${replay.before.call.name}` : ''}
            </span>
            <span className="floatpts num" style={{ color: 'var(--horde)' }}>
              +{hordePts}
            </span>
          </div>
          <div className="hordelist">
            {hordeFrames.map((x) => (
              <div key={x.i} className={`hrow ${x.f.side} ${x.i === lastShown ? 'on' : ''}`}>
                <span>{x.f.text}</span>
                {x.f.pts ? <span className="num hpts">+{x.f.pts}</span> : null}
              </div>
            ))}
            <div ref={hordeRef} />
          </div>
        </>
      )}
      {props.beat >= beats.length && (
        <div className="recapline num">
          This possession: Heroes +{partyPts}, Goblins +{hordePts} · Score {replay.after.score.party}–{replay.after.score.horde}
        </div>
      )}
    </div>
  );
}

function ReplaySheet(props: {
  replay: Replay;
  beats: Beat[];
  beat: number;
  speed: Speed;
  onNext: () => void;
  onSkip: () => void;
  onSpeed: () => void;
  onDone: () => void;
}) {
  const done = props.beat >= props.beats.length;
  const after = props.replay.after;
  const doneLabel = after.phase === 'halftime' ? 'To halftime' : after.phase === 'final' ? 'Final score' : 'Next possession';
  return (
    <div className="sheet replay" onClick={() => !done && props.onNext()}>
      <div className="sheet-inner">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="small muted">{done ? 'Recap' : props.speed === 'step' ? 'Waiting for you: tap Next' : 'Playing on its own: tap to step ahead'}</span>
          <button
            className="btn quiet small"
            onClick={(e) => {
              e.stopPropagation();
              props.onSpeed();
            }}
          >
            Pace: {props.speed === 'step' ? 'Step by step' : props.speed === 'fast' ? 'Fast' : 'Auto'}
          </button>
        </div>
        <ReplayBody replay={props.replay} beats={props.beats} beat={props.beat} />
        {done ? (
          <button
            className="btn primary big"
            onClick={(e) => {
              e.stopPropagation();
              props.onDone();
            }}
          >
            {doneLabel}
          </button>
        ) : (
          <div className="row">
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                props.onNext();
              }}
            >
              Next ▸
            </button>
            <button
              className="btn quiet"
              onClick={(e) => {
                e.stopPropagation();
                props.onSkip();
              }}
            >
              Skip to recap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Halftime and final ----------

function BoxScore(props: { game: Game; names: Record<string, string> }) {
  const g = props.game;
  const [tab, setTab] = useState<'team' | 'heroes' | 'plays'>('team');
  const plays = Object.entries(g.stats.plays);
  const nameOf = (id: string) => props.names[id] ?? (id.startsWith('iso-') ? `Iso: ${CLASS_INFO[id.slice(4) as Cls].name}` : id);
  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        {(['team', 'heroes', 'plays'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
            {t === 'team' ? 'Team' : t === 'heroes' ? 'Heroes' : 'Plays'}
          </button>
        ))}
      </div>
      <div className="tablewrap">
        {tab === 'team' && (
          <table>
            <thead>
              <tr>
                <th>Points from</th>
                <th>Heroes</th>
                <th>Goblins</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Shots / open hits</td>
                <td>{g.stats.party.shots}</td>
                <td>{g.stats.horde.hits}</td>
              </tr>
              <tr>
                <td>Takedowns</td>
                <td>{g.stats.party.takedowns}</td>
                <td>{g.stats.horde.takedowns}</td>
              </tr>
              <tr>
                <td>Objectives</td>
                <td>{g.stats.party.objectives}</td>
                <td>{g.stats.horde.gate}</td>
              </tr>
              <tr>
                <td>Pillage</td>
                <td>—</td>
                <td>{g.stats.horde.pillage}</td>
              </tr>
              <tr>
                <th>Total</th>
                <th>{g.score.party}</th>
                <th>{g.score.horde}</th>
              </tr>
            </tbody>
          </table>
        )}
        {tab === 'heroes' && (
          <table>
            <thead>
              <tr>
                <th>Hero</th>
                <th>Pts</th>
                <th>Ast</th>
                <th>Stops</th>
                <th>Touches</th>
                <th>Dmg</th>
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => {
                const s = g.stats.heroes[c];
                const h = g.heroes[c];
                return (
                  <tr key={c}>
                    <td>
                      {CLASS_INFO[c].icon} {lastName(h.player)}
                    </td>
                    <td>{s.pts}</td>
                    <td>{s.ast}</td>
                    <td>{s.stops}</td>
                    <td>
                      {s.touches}/{h.touchesMax}
                    </td>
                    <td>{s.dmg}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {tab === 'plays' && (
          <table>
            <thead>
              <tr>
                <th>Play</th>
                <th>Calls</th>
                <th>Pts</th>
                <th>Per call</th>
              </tr>
            </thead>
            <tbody>
              {plays.length ? (
                plays.map(([id, s]) => (
                  <tr key={id}>
                    <td>{nameOf(id)}</td>
                    <td>{s.calls}</td>
                    <td>{s.pts}</td>
                    <td>{(s.pts / Math.max(1, s.calls)).toFixed(1)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No plays called yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Halftime(props: {
  game: Game;
  live: boolean;
  adjustment: Adjustment;
  playbook: Play[];
  library: Play[];
  changesLeft: number;
  onSwap: (slot: number, id: string) => void;
  onEdit: (slot: number) => void;
  onStart: () => void;
}) {
  const g = props.game;
  const a = props.adjustment;
  const inBook = new Set(props.playbook.map((p) => p.id));
  // Suggestions: plays that dodge the adjustment.
  const suggestions = props.library.filter((p) => {
    if (inBook.has(p.id)) return false;
    if (a.id === 'double' && a.star) return p.steps[p.steps.length - 1].cls !== a.star;
    if (a.id === 'allHands' || a.id === 'lead') return p.tags.some((t) => t.includes('ram') || t.includes('swarm'));
    return true;
  });
  const weakest = (() => {
    if (a.id === 'scout') return props.playbook.findIndex((p) => p.id === a.playId);
    if (a.id === 'double' && a.star) return props.playbook.findIndex((p) => p.steps[p.steps.length - 1].cls === a.star);
    const pts = props.playbook.map((p) => g.stats.plays[p.id]?.pts ?? 0);
    return pts.indexOf(Math.min(...pts));
  })();
  const arrivals = g.enemies.filter((e) => e.quarter === 3 && e.kind !== 'goblin');
  return (
    <div className="wrap">
      <span className="eyebrow">Halftime</span>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="num">
          {g.score.party}–{g.score.horde}
        </h1>
        <span className="muted">{g.score.party >= g.score.horde ? 'Heroes lead' : 'Goblins lead'}</span>
      </div>
      <BoxScore game={g} names={{ ...Object.fromEntries(props.library.map((p) => [p.id, p.name])), live: 'Live possessions' }} />
      <div className="panel adj">
        <span className="eyebrow" style={{ color: 'var(--horde)' }}>
          The horde adjusts
        </span>
        <h3>{a.name}</h3>
        <p>{a.text}</p>
      </div>
      {!props.live && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2>Your adjustments</h2>
            <span className="small">{props.changesLeft} of 2 changes left</span>
          </div>
          {suggestions[0] && weakest >= 0 && props.changesLeft > 0 && (
            <div className="panel">
              <span className="eyebrow">Suggested</span>
              <p>
                Swap <strong>{props.playbook[weakest].name}</strong> for <strong>{suggestions[0].name}</strong>: {suggestions[0].blurb}
              </p>
              <button className="btn" onClick={() => props.onSwap(weakest, suggestions[0].id)}>
                Make this swap
              </button>
            </div>
          )}
          {props.playbook.map((p, i) => (
            <div className="panel" key={i}>
              <div className="slot">
                <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                  <h3>{p.name}</h3>
                  <span className="small">{chainText(p)}</span>
                  <span className="small muted num">
                    {g.stats.plays[p.id]?.calls ?? 0} calls, {g.stats.plays[p.id]?.pts ?? 0} pts
                  </span>
                </div>
                <div className="stack">
                  <select
                    id={`swap-${i}`}
                    aria-label={`Swap ${p.name}`}
                    disabled={props.changesLeft <= 0}
                    value={p.id}
                    onChange={(e) => props.onSwap(i, e.target.value)}
                    style={{ maxWidth: 150, padding: 6, borderRadius: 6 }}
                  >
                    {props.library
                      .filter((x) => x.id === p.id || !inBook.has(x.id))
                      .map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                  </select>
                  <button className="btn quiet" disabled={props.changesLeft <= 0} onClick={() => props.onEdit(i)}>
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
      <div className="panel">
        <span className="eyebrow">Locker room</span>
        <p className="small">Fallen heroes return at half HP; everyone else heals 25% of their max. Touches don’t reset.</p>
        <span className="eyebrow">Second half</span>
        <p className="small">
          Q3 brings {arrivals.map((e) => `the ${e.name} (${e.player})`).join(', ')} and {g.enemies.filter((e) => e.kind === 'goblin' && e.quarter === 3).length}{' '}
          more goblins.
          {g.gate.breached ? ' The gate is down.' : ` The gate is at ${g.gate.hp}/${g.gate.max}.`}
        </p>
      </div>
      <button className="btn primary big" onClick={props.onStart}>
        {props.live ? 'Start the second half' : props.changesLeft === 2 ? 'Keep the game plan' : 'Start the second half'}
      </button>
    </div>
  );
}

function Final(props: { game: Game; log: string[]; secs: number[]; names: Record<string, string>; onAgain: () => void; onTitle: () => void }) {
  const g = props.game;
  const won = g.score.party > g.score.horde;
  const avg = props.secs.length ? props.secs.reduce((s, x) => s + x, 0) / props.secs.length : 0;
  const [copied, setCopied] = useState('');
  const text = [
    `Play Calling prototype · ${g.difficulty} · final ${g.score.party}–${g.score.horde}`,
    `Average seconds per possession: ${avg.toFixed(1)}`,
    ...props.log,
  ].join('\n');
  return (
    <div className="wrap">
      <span className="eyebrow">Final</span>
      <div className="final-score">
        {g.score.party}–{g.score.horde}
      </div>
      <h2>{won ? 'The heroes hold the city.' : g.score.party === g.score.horde ? 'A tie at the buzzer.' : 'The goblins take the city.'}</h2>
      <p className="muted">
        Average {avg.toFixed(1)} seconds per possession (target: about 20). {g.gold ? `${g.gold} gold from the loot wagon.` : ''}
      </p>
      <BoxScore game={g} names={props.names} />
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">Play log</span>
          <button
            className="btn"
            onClick={() => {
              navigator.clipboard
                ?.writeText(text)
                .then(() => setCopied('Copied'))
                .catch(() => setCopied('Copy failed: select the text below'));
            }}
          >
            Copy log
          </button>
        </div>
        {copied && <span className="small">{copied}</span>}
        <pre className="logbox">{text}</pre>
      </div>
      <button className="btn primary big" onClick={props.onAgain}>
        Play again
      </button>
      <button className="btn quiet" onClick={props.onTitle}>
        Back to the title
      </button>
    </div>
  );
}

// ---------- Modals ----------

function ModalShell(props: { title: string; onClose: () => void; children: ReactNode }) {
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    body.current?.scrollTo(0, 0);
  }, [props.title]);
  return (
    <div className="modal-back" onClick={props.onClose}>
      <div className="modal" ref={body} role="dialog" aria-label={props.title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{props.title}</h2>
          <button className="btn quiet" onClick={props.onClose}>
            Close
          </button>
        </div>
        {props.children}
      </div>
    </div>
  );
}

function Library(props: {
  library: Play[];
  active: string[];
  slot: number;
  onPick: (id: string) => void;
  onNew: () => void;
  onEdit: (p: Play) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell title="Your library" onClose={props.onClose}>
      <p className="small muted">Pick a play for slot {props.slot + 1}. Plays already in the playbook are marked.</p>
      <button className="btn primary" onClick={props.onNew}>
        Draw up a new play
      </button>
      {props.library.map((p) => {
        const inBook = props.active.includes(p.id);
        const isCustom = !TEMPLATES.some((t) => t.id === p.id);
        return (
          <div className="panel" key={p.id}>
            <div className="slot">
              <div className="stack" style={{ gap: 3, minWidth: 0 }}>
                <h3>
                  {p.name} {isCustom && <span className="chip">yours</span>}
                </h3>
                <span className="small">{chainText(p)}</span>
                {p.blurb && <span className="small muted">{p.blurb}</span>}
              </div>
              <div className="stack">
                <button className="btn" disabled={inBook} onClick={() => props.onPick(p.id)}>
                  {inBook ? 'In playbook' : 'Use'}
                </button>
                <button className="btn quiet" onClick={() => props.onEdit(p)}>
                  {isCustom ? 'Edit' : 'Copy'}
                </button>
                {isCustom && !inBook && (
                  <button className="btn quiet" onClick={() => props.onDelete(p.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </ModalShell>
  );
}

function Designer(props: { tuning: Tuning; difficulty: Difficulty; initial?: Play; onSave: (p: Play) => void; onClose: () => void }) {
  const isCustom = props.initial && !TEMPLATES.some((t) => t.id === props.initial!.id);
  const [name, setName] = useState(props.initial ? (isCustom ? props.initial.name : `${props.initial.name} (mine)`) : 'New play');
  const [steps, setSteps] = useState<PlayStep[]>(
    props.initial?.steps ?? [
      { cls: 'warrior', move: 'provoke' },
      { cls: 'rogue', move: 'backstab' },
    ],
  );
  const [vs, setVs] = useState<string>('ogre');
  const errors = validatePlay(steps);
  const heroLines = Object.fromEntries(week.heroes.map((h) => [h.cls, h]));
  const setStep = (i: number, s: PlayStep) => setSteps((x) => x.map((y, j) => (j === i ? s : y)));
  const movesFor = (c: Cls) =>
    MOVES.filter(
      (m) =>
        m.cls === c &&
        (m.kind !== 'signature' || heroLines[c].doubleDouble || heroLines[c].tripleDouble) &&
        (m.kind !== 'legendary' || heroLines[c].tripleDouble),
    );

  // Preview against one enemy, with the whole horde on the floor (so Taunt and Block are up; the Barrier is left down).
  const preview = useMemo(() => {
    if (errors.length) return null;
    const play: Play = { id: 'preview', name, steps, tags: [] };
    const base = newGame(props.tuning, props.difficulty);
    for (const e of base.enemies) {
      e.arrived = e.kind !== 'wagon';
      e.onRam = false;
    }
    base.enemies.filter((e) => e.kind === 'goblin').forEach((gb, i) => (gb.onRam = i < 4));
    const target = base.enemies.find((e) => e.kind === vs) ?? base.enemies[0];
    const open = project(base, play, target.id);
    return { target, open };
  }, [steps, vs, errors.length, name, props.tuning, props.difficulty]);

  return (
    <ModalShell title="Play designer" onClose={props.onClose}>
      <label className="stack" htmlFor="play-name">
        <span className="eyebrow">Name</span>
        <input
          id="play-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: 8, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)' }}
        />
      </label>
      {steps.map((s, i) => {
        const m = MOVE[s.move];
        const next = steps[i + 1] ? MOVE[steps[i + 1].move] : undefined;
        return (
          <div key={i} className="stack">
            <div className="step">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className="eyebrow">Step {i + 1}</span>
                {steps.length > 2 && (
                  <button className="linkish" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </div>
              <div className="herochoice">
                {CLASSES.map((c) => (
                  <button
                    key={c}
                    className="opt"
                    aria-pressed={s.cls === c}
                    onClick={() => setStep(i, { cls: c, move: movesFor(c).find((x) => (i === steps.length - 1 ? isFinisher(x) : !isFinisher(x)))!.id })}
                  >
                    {CLASS_INFO[c].icon} {CLASS_INFO[c].name}
                  </button>
                ))}
              </div>
              <div className="movechoice">
                {movesFor(s.cls).map((mv) => (
                  <button key={mv.id} className="mv" aria-pressed={s.move === mv.id} onClick={() => setStep(i, { cls: s.cls, move: mv.id })}>
                    <span className="k">{mv.kind}</span> <strong>{mv.name}</strong>
                    <br />
                    <span className="small">Action: {mv.action}</span>
                    {mv.enablerText && (
                      <>
                        <br />
                        <span className="small">Pass: {mv.enablerText}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
            {i < steps.length - 1 && m && (
              <div className={`pass ${passHelps(m, next) ? 'good' : 'bad'}`}>
                {m.enablerText ? `${m.enablerText} → ${CLASS_INFO[steps[i + 1].cls].name} ` : 'No pass '}
                {passHelps(m, next) ? <span className="ok">✓ boosts {next?.name}</span> : <span className="err">– wasted on {next?.name}</span>}
              </div>
            )}
          </div>
        );
      })}
      {steps.length < 4 && (
        <button
          className="btn"
          onClick={() =>
            setSteps((x) => {
              const last = x[x.length - 1];
              const prevCls = x[x.length - 2].cls;
              const cls: Cls = CLASSES.find((c) => c !== last.cls && c !== prevCls)!;
              const filler = MOVES.find((mv) => mv.cls === cls && mv.kind === 'enabler')!;
              return [...x.slice(0, -1), { cls, move: filler.id }, last];
            })
          }
        >
          Add a step before the finisher
        </button>
      )}
      {errors.map((e) => (
        <p className="err" key={e}>
          {e}
        </p>
      ))}
      <div className="panel">
        <div className="row">
          <span className="eyebrow">Preview vs</span>
          <select id="preview-vs" value={vs} onChange={(e) => setVs(e.target.value)} style={{ padding: 4, borderRadius: 6 }}>
            {(['ogre', 'hexer', 'sharpshooter', 'cutthroat', 'shaman', 'chieftain', 'goblin'] as const).map((k) => (
              <option key={k} value={k}>
                {ENEMY_INFO[k].name}
              </option>
            ))}
          </select>
        </div>
        {preview ? (
          <>
            <p>
              With this week’s numbers: {preview.open.damage} damage
              {preview.open.kills ? `, ${preview.open.kills} takedown${preview.open.kills > 1 ? 's' : ''}` : ''}, +{preview.open.points} points.
            </p>
            <p className="small">
              {preview.open.open
                ? '✓ The finisher gets through and scores a bucket.'
                : preview.target.kind === 'goblin'
                  ? 'Goblins make no bucket: only their takedowns score.'
                  : 'No bucket: the defenses stop the finisher. With the whole horde up, the Ogre’s Taunt and the Chieftain’s Block are in play.'}
            </p>
          </>
        ) : (
          <p className="small muted">Fix the play to see a preview.</p>
        )}
      </div>
      <button
        className="btn primary big"
        disabled={errors.length > 0}
        onClick={() =>
          props.onSave({
            id: isCustom ? props.initial!.id : `mine-${Date.now().toString(36)}`,
            name: name.trim() || 'My play',
            steps,
            tags: ['yours'],
            blurb: undefined,
          })
        }
      >
        Save play
      </button>
    </ModalShell>
  );
}

function Menu(props: {
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
  manual: boolean;
  setManual: (m: boolean) => void;
  tuning: Tuning;
  log: string[];
  onApplyTuning: (t: Tuning) => void;
  onRestart: () => void;
  onGuide: () => void;
  onTitle: () => void;
  onClose: () => void;
}) {
  const [t, setT] = useState<Tuning>(props.tuning);
  const [copied, setCopied] = useState('');
  const fields: { k: keyof Tuning; label: string; step: number }[] = [
    { k: 'gateHp', label: 'Gate HP', step: 5 },
    { k: 'goblinHp', label: 'Goblin HP', step: 1 },
    { k: 'championHp', label: 'Champion HP ×', step: 0.05 },
    { k: 'hordeDamage', label: 'Horde damage ×', step: 0.05 },
    { k: 'shotPoints', label: 'Shot points', step: 1 },
    { k: 'championPoints', label: 'Champion takedown points', step: 1 },
    { k: 'bossPoints', label: 'Chieftain takedown points', step: 1 },
    { k: 'bountyPoints', label: 'Shaman bounty points', step: 1 },
    { k: 'hordeHitPoints', label: 'Horde bucket points', step: 1 },
    { k: 'usagePerTouch', label: 'True usage per touch', step: 0.1 },
  ];
  return (
    <ModalShell title="Menu" onClose={props.onClose}>
      <div className="panel">
        <DefenseChoice manual={props.manual} setManual={props.setManual} />
        <span className="eyebrow">Difficulty (next game)</span>
        <div className="opt-group">
          {(['normal', 'hard'] as Difficulty[]).map((d) => (
            <button key={d} className="opt" aria-pressed={props.difficulty === d} onClick={() => props.setDifficulty(d)}>
              {d === 'normal' ? 'Normal' : 'Hard'}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <button className="btn" onClick={props.onGuide}>
          How it works
        </button>
        <button className="btn" onClick={props.onRestart}>
          Restart the game
        </button>
        <button className="btn quiet" onClick={props.onTitle}>
          Title screen
        </button>
      </div>
      <details className="panel">
        <summary>Tuning</summary>
        <p className="small muted">For testing. Applying restarts the game.</p>
        <div className="tuning">
          {fields.map((f) => (
            <label key={f.k} htmlFor={`tune-${f.k}`} style={{ display: 'contents' }}>
              <span>{f.label}</span>
              <input id={`tune-${f.k}`} type="number" step={f.step} value={t[f.k]} onChange={(e) => setT({ ...t, [f.k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <div className="row">
          <button className="btn primary" onClick={() => props.onApplyTuning(t)}>
            Apply and restart
          </button>
          <button className="btn quiet" onClick={() => setT(DEFAULT_TUNING)}>
            Defaults
          </button>
        </div>
      </details>
      <details className="panel">
        <summary>Play log</summary>
        <button
          className="btn"
          onClick={() =>
            navigator.clipboard
              ?.writeText(props.log.join('\n'))
              .then(() => setCopied('Copied'))
              .catch(() => setCopied('Copy failed: select the text below'))
          }
        >
          Copy log
        </button>
        {copied && <span className="small">{copied}</span>}
        <pre className="logbox">{props.log.join('\n') || 'No possessions yet.'}</pre>
      </details>
    </ModalShell>
  );
}

function Guide(props: { onClose: () => void }) {
  const rows: [string, string][] = [
    [
      'A possession',
      'Build it in four slots: Start, two Supports and a Finish. Tap a slot, pick a hero and a move, and tap a target on the board. Each hero takes part once, and each uses one touch. Then Run the play. Saved plays and Suggest fill the slots for you.',
    ],
    [
      'Buffs',
      'Every helper adds its buff to the finisher, wherever it sits in the play: Crit, Pierce, Sure, Split, or Armor for the finisher. Each buff counts once. Helpers aim at the finisher’s target unless you aim them elsewhere.',
    ],
    ['Start', 'The Start slot hits first, so it takes the Barrier or the Block. The Shot panel shows what each defense will do to your play.'],
    [
      'Scoring',
      'Only finishers score: 2 if the finisher damages a Champion or the boss after their defenses (goblins make no bucket). Takedowns add each enemy’s value (🏀). Enablers break defenses and set up takedowns.',
    ],
    [
      'Defenses',
      'Taunt (the Ogre): single-target hits must go to it. Armor: each hit deals less. Quick: the first hit on it each possession misses. Barrier (the Shaman’s cast on the horde’s turn, when the ram has its 4 goblins): a wall in front of the whole horde for your next possession; the first damaging move breaks it, and nothing behind it can be targeted until then. War Drum (automatic): the ram hits +2 while the Shaman stands. Block (the Chieftain): the first hit on any enemy each possession is cancelled.',
    ],
    ['Passes', 'Armor (protects the next hero), Sure (can’t be evaded or Blocked), Crit (+50% damage), Pierce (ignores Armor), Split (+1 target).'],
    ['Takedowns', 'Each enemy shows its point value (🏀). Taking it down scores it, and stops it scoring.'],
    ['Touches', 'From each player’s true usage this week (shots, free throws, turnovers and assists). Out of touches, a hero can’t be in a play.'],
    [
      'Defense',
      'Heroes not in the play defend: the Warrior Protects, the Ranger Closes Out, the Wizard Wards, the Cleric heals (Triage), and the Rogue Strips the Ball off the ram. Protect and Ward add Armor; Close Out Slows an enemy (half damage).',
    ],
    [
      'The horde',
      'Its goblins push the ram automatically when 4 are on it. Its Champions run one called play each turn and score 2 for a finisher that damages a hero and 4 for a hero they take down.',
    ],
    [
      'Statuses',
      'Taunted: attacks the Warrior. Exposed: +3 from every hit this possession (Marked: through the next one too). Disabled: out of the horde’s next play, and loses its Taunt or Quick. Slowed: loses Quick, and its next hit deals half.',
    ],
    ['Timeouts', 'Two per game. A timeout takes back your last possession.'],
    ['Halftime', 'A box score, the horde’s adjustment, and up to two changes to your playbook. Fallen heroes return.'],
  ];
  return (
    <ModalShell title="How it works" onClose={props.onClose}>
      <div className="list">
        {rows.map(([k, v]) => (
          <div className="li" key={k} style={{ gridTemplateColumns: '1fr' }}>
            <strong>{k}</strong>
            <span className="small">{v}</span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

function EnemyDetail(props: { game: Game; id: string; onClose: () => void }) {
  const e = props.game.enemies.find((x) => x.id === props.id);
  if (!e) return null;
  return (
    <ModalShell title={e.name} onClose={props.onClose}>
      <p>{ENEMY_INFO[e.kind].job}</p>
      {e.player && (
        <p className="small muted">
          {e.player} ({e.team}) · {tierLabel(e.tier!)} · mirrors your {ENEMY_INFO[e.kind].mirrors}
        </p>
      )}
      <p className="num">
        {e.hp}/{e.maxHp} HP · hits for {e.damage} · armor {e.armor} · 🏀 {e.points}
      </p>
      <p className="small">Pick a play first, then tap an enemy to target it.</p>
    </ModalShell>
  );
}

function HeroDetail(props: { game: Game; cls: Cls; onClose: () => void }) {
  const h = props.game.heroes[props.cls];
  const l = h.line;
  const locked = (m: Move) => (m.kind === 'signature' && !h.dd) || (m.kind === 'legendary' && !h.td);
  return (
    <ModalShell title={`${CLASS_INFO[props.cls].name} · ${h.player}`} onClose={props.onClose}>
      <p className="small muted num">
        vs {h.opp}: {l.pts} pts, {l.reb} reb, {l.ast} ast, {l.stl} stl, {l.blk} blk, {l.fg3m} 3PM, {l.tov} tov, {l.min} min
      </p>
      <p>
        Offense {tierLabel(h.tier)} · Defense {tierLabel(h.defTier)} · {h.touches} of {h.touchesMax} touches left
      </p>
      <div className="list">
        {MOVES.filter((m) => m.cls === props.cls).map((m) => (
          <div className="li" key={m.id} style={{ gridTemplateColumns: '1fr', opacity: locked(m) ? 0.55 : 1 }}>
            <strong>
              {m.name} <span className="muted small">({isSpecial(m) ? 'finisher' : m.kind})</span>
            </strong>
            {isSpecial(m) && (
              <span className="specialrow">
                <SpecialChip m={m} />{' '}
                <span className="small muted">
                  {locked(m)
                    ? `needs a ${m.kind === 'legendary' ? 'triple-double' : 'double-double'}: not this week`
                    : `${bigNight(l)} · once per game${h.usedSpecial.includes(m.id) ? ' · used' : ''}`}
                </span>
              </span>
            )}
            <span className="small">
              {m.action}
              {m.enablerText ? ` · pass: ${m.enablerText}` : ''}
            </span>
          </div>
        ))}
      </div>
      <OffBallCard cls={props.cls} defTier={h.defTier} line={l} />
    </ModalShell>
  );
}

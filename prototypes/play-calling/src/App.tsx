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
  isFinisher,
  tierIndex,
  type Cls,
  type Play,
  type PlayStep,
  type Tier,
} from './content';
import {
  DEFAULT_TUNING,
  activeHeroes,
  autoDefense,
  bestCall,
  contestedBase,
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
  quarterOf,
  runPossession,
  startSecondHalf,
  validatePlay,
  type Adjustment,
  type Defense,
  type Difficulty,
  type Enemy,
  type Frame,
  type Game,
  type Projection,
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
  | { kind: 'hero'; cls: Cls };

interface Saved {
  custom?: Play[];
  active?: string[];
  difficulty?: Difficulty;
  manual?: boolean;
  tuning?: Tuning;
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
  const [frames, setFrames] = useState<Frame[] | null>(null);
  const [fi, setFi] = useState(0);
  const pending = useRef<Game | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [tgt, setTgt] = useState<string | null>(null);
  const [override, setOverride] = useState<Defense>({});
  const [modal, setModal] = useState<Modal | null>(null);
  const [adjustment, setAdjustment] = useState<Adjustment | null>(null);
  const [changesLeft, setChangesLeft] = useState(2);
  const [log, setLog] = useState<string[]>([]);
  const [secs, setSecs] = useState<number[]>([]);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    store({ custom, active, difficulty, manual, tuning });
  }, [custom, active, difficulty, manual, tuning]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    startedAt.current = performance.now();
  }, [game.possession, screen]);

  const shown = frames ? frames[Math.min(fi, frames.length - 1)].game : game;

  // Replay the possession's frames.
  useEffect(() => {
    if (!frames) return;
    if (fi >= frames.length - 1) {
      const t = setTimeout(() => finishPlayback(), 900);
      return () => clearTimeout(t);
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const t = setTimeout(() => setFi((i) => i + 1), reduce ? 450 : 800);
    return () => clearTimeout(t);
  });

  function finishPlayback() {
    const g = pending.current;
    if (!g) return;
    pending.current = null;
    setFrames(null);
    setFi(0);
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
    setSel(null);
    setTgt(null);
    setAdjustment(null);
    setScreen('plan');
  }

  const isoPlays = useMemo(() => CLASSES.map(isoPlay), []);
  const allCallable = useMemo(() => [...playbook, ...isoPlays], [playbook, isoPlays]);
  const selPlay = sel ? (allCallable.find((p) => p.id === sel) ?? null) : null;
  const available = playbook.filter((p) => playAvailable(game, p).ok);
  const isoAvailable = isoPlays.filter((p) => playAvailable(game, p).ok);
  const best = useMemo<Projection | null>(
    () => (screen === 'game' && !frames ? bestCall(game, available.length ? available : isoAvailable) : null),
    [game, screen, frames, active],
  ); // eslint-disable-line
  const projections = useMemo(() => {
    if (!selPlay || frames) return new Map<string, Projection>();
    return new Map(onField(game).map((e) => [e.id, project(game, selPlay, e.id)]));
  }, [game, selPlay, frames]);
  const inPlay = useMemo(() => new Set<Cls>(selPlay ? selPlay.steps.map((s) => s.cls) : []), [selPlay]);
  const defense: Defense = useMemo(() => {
    const auto = autoDefense(game, inPlay);
    return manual ? { ...auto, ...override } : auto;
  }, [game, inPlay, manual, override]);

  function choosePlay(id: string) {
    if (frames) return;
    setSel(id === sel ? null : id);
    setTgt(null);
    setOverride({});
  }

  function run() {
    if (!selPlay || !tgt) return;
    const s = (performance.now() - startedAt.current) / 1000;
    const res = runPossession(game, selPlay, tgt, defense);
    begin(res.game, res.frames, `P${game.possession + 1} · ${selPlay.name} on ${game.enemies.find((e) => e.id === tgt)?.name} (${s.toFixed(1)} s)`, s);
  }
  function hold() {
    const s = (performance.now() - startedAt.current) / 1000;
    const res = holdPossession(game, autoDefense(game, new Set()));
    begin(res.game, res.frames, `P${game.possession + 1} · held the ball (${s.toFixed(1)} s)`, s);
  }
  function begin(g: Game, fr: Frame[], head: string, s: number) {
    setHistory((h) => [...h, game]);
    pending.current = g;
    setFrames(fr);
    setFi(0);
    setSel(null);
    setTgt(null);
    setSecs((x) => [...x, s]);
    setLog((l) => [...l, head, ...fr.map((f) => `   ${f.text}`), `   Score ${g.score.party}–${g.score.horde}`]);
  }
  function timeout() {
    if (!history.length || game.timeouts <= 0 || frames) return;
    const prev = structuredClone(history[history.length - 1]);
    prev.timeouts = game.timeouts - 1;
    setHistory((h) => h.slice(0, -1));
    setGame(prev);
    setSel(null);
    setTgt(null);
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
          />
          <div className="wrap">
            <Objectives game={shown} />
            <CallBanner game={shown} />
            <Board
              game={shown}
              projections={projections}
              picking={!!selPlay && !frames}
              target={tgt}
              frame={frames ? frames[Math.min(fi, frames.length - 1)] : null}
              onPick={(id) => (selPlay && !frames ? setTgt(id) : setModal({ kind: 'enemy', id }))}
            />
            <HeroRow
              game={shown}
              inPlay={inPlay}
              defense={selPlay && !frames ? defense : null}
              frame={frames ? frames[Math.min(fi, frames.length - 1)] : null}
              onTap={(cls) => setModal({ kind: 'hero', cls })}
            />
            <Dock game={game} playbook={playbook} isoPlays={isoPlays} sel={sel} best={best} busy={!!frames} onChoose={choosePlay} onHold={hold} />
            <div className="spacer" />
          </div>
          {frames ? (
            <Ticker
              frame={frames[Math.min(fi, frames.length - 1)]}
              index={fi}
              total={frames.length}
              onSkip={() => (fi >= frames.length - 1 ? finishPlayback() : setFi(frames.length - 1))}
            />
          ) : selPlay ? (
            <ConfirmSheet
              game={game}
              play={selPlay}
              target={tgt}
              projection={tgt ? (projections.get(tgt) ?? null) : null}
              bestTarget={[...projections.values()].sort((a, b) => b.value - a.value)[0] ?? null}
              defense={defense}
              manual={manual}
              inPlay={inPlay}
              setOverride={setOverride}
              onTarget={setTgt}
              onRun={run}
              onCancel={() => {
                setSel(null);
                setTgt(null);
              }}
            />
          ) : null}
        </>
      )}
      {screen === 'halftime' && adjustment && (
        <Halftime
          game={game}
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
          names={Object.fromEntries(library.map((p) => [p.id, p.name]))}
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
          The Goblin Horde, played as a basketball game: four quarters, twelve possessions. Draw up your plays, read the horde’s call, then call yours, tap a
          target and run it.
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
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Defense</span>
        <button className="infobtn" aria-expanded={info} aria-controls="defense-info" onClick={() => setInfo((x) => !x)}>
          {info ? 'Hide details' : 'ⓘ What’s the difference?'}
        </button>
      </div>
      <div className="opt-group">
        <button className="opt" aria-pressed={!props.manual} onClick={() => props.setManual(false)}>
          Automatic
        </button>
        <button className="opt" aria-pressed={props.manual} onClick={() => props.setManual(true)}>
          Manual
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

// ---------- Pre-game ----------

function PlanScreen(props: {
  game: Game;
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
    <div className="wrap">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="stack" style={{ gap: 2 }}>
          <span className="eyebrow">Game plan · Goblin Horde</span>
          <h2>Scouting report</h2>
        </div>
        <button className="btn quiet" onClick={props.onMenu}>
          Menu
        </button>
      </div>
      <p className="small muted">Tap anything for details.</p>

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
            {(opponentsFg() * 100).toFixed(1)}% this week). The horde scores 1 per 2 gate damage and 10 when it falls; after that, every goblin on the field
            pillages for 1 a turn.
          </div>
        )}
        {open === 'bounty' && (
          <div className="panel detail small">
            Take down the Goblin Shaman before the end of the first quarter for +{g.tuning.bountyPoints} on top of its takedown. It also stops the
            reinforcements at the source.
          </div>
        )}
        {open === 'wagon' && (
          <div className="panel detail small">Arrives in Q2 with 15 HP. Breaking it scores 3 and 5 gold. It's contested while the Cutthroat stands.</div>
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
            {openPlay.steps.map((s) => s.actors.map((a) => ENEMY_INFO[a].name.replace('Goblin ', '')).join(' or ')).join(' → ')}. Only their call shows during
            the game; if your play breaks it, they switch to the next play that fits, in this order.
          </div>
        )}
      </section>

      <section className="stack">
        <span className="eyebrow">Your week</span>
        <div className="hero-grid">
          {CLASSES.map((c) => {
            const h = g.heroes[c];
            return (
              <button key={c} className={`mini ${open === `hero-${c}` ? 'on' : ''}`} aria-expanded={open === `hero-${c}`} onClick={() => toggle(`hero-${c}`)}>
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
              </div>
            );
          })()}
      </section>

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
      <button className="btn primary big" onClick={props.onTipOff}>
        Tip off
      </button>
    </div>
  );
}

function PlaySlot(props: { play: Play; open: boolean; onToggle: () => void; onChange: () => void; onEdit: () => void }) {
  const p = props.play;
  const form = playForm(p);
  return (
    <div className="panel slotcard">
      <button className="slothead" aria-expanded={props.open} onClick={props.onToggle}>
        <h3>{p.name}</h3>
        <span className="small muted">{p.steps.map((s) => CLASS_INFO[s.cls].icon).join(' → ')}</span>
        {form && <span className="chip ball">{form.split(' ')[0]}</span>}
      </button>
      {props.open && (
        <div className="stack">
          <span className="small">{chainText(p)}</span>
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

function Scoreboard(props: { game: Game; onTimeout: () => void; canTimeout: boolean; onMenu: () => void }) {
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
          <span className="pts">{g.score.horde}</span>
          <span className="team">Goblins</span>
        </div>
      </div>
      <div className="board-tools">
        <button onClick={props.onTimeout} disabled={!props.canTimeout} title="Take back the last possession">
          Timeout ({g.timeouts})
        </button>
        <span>Possession {Math.min(12, g.possession + 1)} of 12</span>
        <button onClick={props.onMenu}>Menu</button>
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
            {p.length >= 4 ? `hits for ${g.ramBase + (p.length - 4) + g.ramBonus}` : 'stalled'} ·{' '}
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
  if (!g.call) return <div className="call small">The horde has no play to run this turn{g.gate.breached ? '; its goblins keep pillaging.' : '.'}</div>;
  return (
    <div className="call" aria-live="polite">
      <span className="eyebrow" style={{ color: 'var(--horde)' }}>
        Horde calls
      </span>
      <strong>{g.call.name}</strong>
      <span className="small">{g.call.text}</span>
    </div>
  );
}

function statusChips(g: Game, e: Enemy) {
  const out: { t: string; c: string }[] = [];
  const cont = contestedBase(g, e);
  if (e.kind !== 'goblin') out.push(cont ? { t: '🛡 contested', c: 'cont' } : { t: '✓ open', c: 'open' });
  if (e.taunted) out.push({ t: 'Taunted', c: 'ball' });
  if (e.disabled) out.push({ t: 'Disabled', c: 'ball' });
  if (e.exposed > 1) out.push({ t: 'Marked', c: 'ball' });
  else if (e.exposed > 0) out.push({ t: 'Exposed', c: 'ball' });
  if (e.poison) out.push({ t: 'Poisoned', c: 'ball' });
  if (e.frost) out.push({ t: 'Frosted', c: 'ball' });
  if (e.pinned) out.push({ t: 'Pinned', c: 'ball' });
  return out;
}

function projText(p: Projection | undefined) {
  if (!p) return '';
  const bits = [`${p.damage} dmg`];
  if (p.kills) bits.push(`${p.kills} KO`);
  bits.push(p.points ? `+${p.points}` : '+0');
  return bits.join(' · ');
}

function Board(props: {
  game: Game;
  projections: Map<string, Projection>;
  picking: boolean;
  target: string | null;
  frame: Frame | null;
  onPick: (id: string) => void;
}) {
  const g = props.game;
  const field = onField(g);
  const big = field.filter((e) => e.kind !== 'goblin');
  const ram = field.filter((e) => e.kind === 'goblin' && e.onRam);
  const free = freeGoblins(g);
  const callIdx = (id: string) => (g.call ? g.call.actors.indexOf(id) : -1);
  const hit = (id: string) => props.frame?.target === id;
  const gob = (e: Enemy) => (
    <button
      key={e.id}
      className={`gob ${e.onRam ? 'ram' : ''} ${props.picking ? 'target' : ''} ${props.target === e.id ? 'picked' : ''} ${hit(e.id) ? 'hit' : ''}`}
      onClick={() => props.onPick(e.id)}
      aria-label={`Goblin, ${e.hp} HP${e.onRam ? ', on the ram' : ''}`}
    >
      👺 <span className="num">{e.hp}</span>
      {e.pinned && <span className="chip ball">Pinned</span>}
      {e.stripped && <span className="chip ball">Stripped</span>}
      {e.exposed > 0 && <span className="chip ball">Exp</span>}
      {props.picking && <span className="proj">+{props.projections.get(e.id)?.points ?? 0}</span>}
    </button>
  );
  return (
    <div className="stack">
      <div className="enemies">
        {big.map((e) => {
          const ci = callIdx(e.id);
          return (
            <button
              key={e.id}
              className={`ecard ${props.picking ? 'target' : ''} ${props.target === e.id ? 'picked' : ''} ${ci >= 0 ? 'inCall' : ''} ${hit(e.id) ? 'hit' : ''}`}
              onClick={() => props.onPick(e.id)}
            >
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
              {props.picking && <span className="proj">{projText(props.projections.get(e.id))}</span>}
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
            {g.gate.breached ? 'Pillaging' : 'Crowding'}
          </span>
          {free.length ? free.map(gob) : <span className="small muted">none</span>}
        </div>
        <span className="small muted">
          {free.length >= g.tuning.crowd || (g.adjustment?.id === 'lead' && free.length >= 1)
            ? `${free.length} free goblins crowd the Champions: they're contested unless your play opens them.`
            : `Fewer than ${g.tuning.crowd} goblins crowding: Champions are open.`}
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

function Dock(props: {
  game: Game;
  playbook: Play[];
  isoPlays: Play[];
  sel: string | null;
  best: Projection | null;
  busy: boolean;
  onChoose: (id: string) => void;
  onHold: () => void;
}) {
  const g = props.game;
  const anyBook = props.playbook.some((p) => playAvailable(g, p).ok);
  const isos = props.isoPlays.filter((p) => playAvailable(g, p).ok);
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="eyebrow">Call a play</span>
        {props.best && !props.busy && <span className="small muted">Glow: the play that fits this moment</span>}
      </div>
      <div className="dock">
        {props.playbook.map((p) => {
          const av = playAvailable(g, p);
          const scouted = g.lastPlayId === p.id;
          return (
            <button
              key={p.id}
              className={`pcard ${props.sel === p.id ? 'sel' : ''} ${props.best?.playId === p.id ? 'glow' : ''}`}
              disabled={!av.ok || props.busy}
              onClick={() => props.onChoose(p.id)}
            >
              <span className="pn">{p.name}</span>
              <span className="chain">{p.steps.map((s) => `${CLASS_INFO[s.cls].icon}`).join(' → ')}</span>
              <div className="chips">
                {p.tags.slice(0, 2).map((t) => (
                  <span className="chip" key={t}>
                    {t}
                  </span>
                ))}
                {scouted && <span className="chip cont">scouted</span>}
              </div>
              {!av.ok && <span className="small err">{av.why}</span>}
            </button>
          );
        })}
      </div>
      <div className="isorow">
        <span className="small muted">Iso (one hero, one finisher):</span>
        {CLASSES.map((c) => {
          const p = props.isoPlays.find((x) => x.id === `iso-${c}`)!;
          const ok = isos.includes(p);
          return (
            <button
              key={c}
              className={`btn ${props.sel === p.id ? 'primary' : ''} ${props.best?.playId === p.id ? 'glow' : ''}`}
              disabled={!ok || props.busy}
              onClick={() => props.onChoose(p.id)}
              title={`${CLASS_INFO[c].name}: ${MOVE[p.steps[0].move].name}`}
              aria-label={`Iso ${CLASS_INFO[c].name}`}
            >
              {CLASS_INFO[c].icon}
            </button>
          );
        })}
        {!anyBook && !isos.length && (
          <button className="btn primary" disabled={props.busy} onClick={props.onHold}>
            Hold the ball
          </button>
        )}
      </div>
    </div>
  );
}

function ConfirmSheet(props: {
  game: Game;
  play: Play;
  target: string | null;
  projection: Projection | null;
  bestTarget: Projection | null;
  defense: Defense;
  manual: boolean;
  inPlay: Set<Cls>;
  setOverride: (f: (d: Defense) => Defense) => void;
  onTarget: (id: string) => void;
  onRun: () => void;
  onCancel: () => void;
}) {
  const g = props.game;
  const t = props.target ? g.enemies.find((e) => e.id === props.target) : null;
  const off = defenders(g, props.inPlay);
  const heroes = activeHeroes(g);
  const champs = onField(g).filter((e) => e.kind !== 'goblin' && e.kind !== 'wagon');
  return (
    <div className="sheet">
      <div className="sheet-inner">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>{props.play.name}</h3>
          <button className="btn quiet" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
        <span className="small">{chainText(props.play)}</span>
        {t && props.projection ? (
          <p>
            On the <strong>{t.name}</strong>: {props.projection.open ? '✓ open look' : '🛡 contested: no shot points'} · {props.projection.damage} damage
            {props.projection.kills ? ` · ${props.projection.kills} takedown${props.projection.kills > 1 ? 's' : ''}` : ''} ·{' '}
            <strong>+{props.projection.points}</strong>
          </p>
        ) : (
          <p className="row">
            <span>Tap a target on the board.</span>
            {props.bestTarget && (
              <button className="linkish" onClick={() => props.onTarget(props.bestTarget!.targetId)}>
                Best target: {g.enemies.find((e) => e.id === props.bestTarget!.targetId)?.name}
              </button>
            )}
          </p>
        )}
        {off.length > 0 && (
          <div className="defrow">
            {off.map((c) => (
              <DefenseLine
                key={c}
                cls={c}
                game={g}
                defense={props.defense}
                manual={props.manual}
                heroes={heroes.map((h) => h.cls)}
                champs={champs}
                setOverride={props.setOverride}
              />
            ))}
          </div>
        )}
        <button className="btn primary big" disabled={!t} onClick={props.onRun}>
          Run it
        </button>
      </div>
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

function Ticker(props: { frame: Frame; index: number; total: number; onSkip: () => void }) {
  const f = props.frame;
  return (
    <div className="sheet ticker" onClick={props.onSkip} role="status" aria-live="polite">
      <div className="sheet-inner">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">{f.side === 'horde' ? 'Horde' : f.side === 'party' ? 'Heroes' : 'Play-by-play'}</span>
          <span className="small muted num">
            {props.index + 1}/{props.total} · tap to skip
          </span>
        </div>
        <p className={`line ${f.side}`}>{f.text}</p>
        {f.pts ? <span className="floatpts">+{f.pts}</span> : null}
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
      <BoxScore game={g} names={Object.fromEntries(props.library.map((p) => [p.id, p.name]))} />
      <div className="panel adj">
        <span className="eyebrow" style={{ color: 'var(--horde)' }}>
          The horde adjusts
        </span>
        <h3>{a.name}</h3>
        <p>{a.text}</p>
      </div>
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
        {props.changesLeft === 2 ? 'Keep the game plan' : 'Start the second half'}
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

  // Preview against one enemy, once with the crowd and once without.
  const preview = useMemo(() => {
    if (errors.length) return null;
    const play: Play = { id: 'preview', name, steps, tags: [] };
    const base = newGame(props.tuning, props.difficulty);
    for (const e of base.enemies) {
      e.arrived = e.kind !== 'wagon';
      e.onRam = false;
    }
    const target = base.enemies.find((e) => e.kind === vs) ?? base.enemies[0];
    const goblins = base.enemies.filter((e) => e.kind === 'goblin');
    goblins.forEach((gb, i) => (gb.onRam = i < 4));
    const open = project(base, play, target.id);
    const crowded = structuredClone(base);
    crowded.enemies.filter((e) => e.kind === 'goblin').forEach((gb, i) => (gb.onRam = i < 2));
    const crowd = project(crowded, play, target.id);
    return { target, open, crowd };
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
                    <span className="k">{mv.kind === 'move' ? 'move' : mv.kind}</span> <strong>{mv.name}</strong>
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
              const filler = MOVES.find((mv) => mv.cls === cls && mv.kind === 'move')!;
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
            {preview.target.kind !== 'goblin' && (
              <p className="small">
                {preview.crowd.open
                  ? '✓ Opens the target even when goblins crowd it.'
                  : '🛡 Against a crowded target this play is contested: half damage on the finisher, no shot points.'}
              </p>
            )}
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
    { k: 'hordeHitPoints', label: 'Horde open-hit points', step: 1 },
    { k: 'crowd', label: 'Free goblins to contest', step: 1 },
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
    ['A possession', 'See the horde’s call, call one of your plays, tap a target, then Run it. Each step uses one touch from that hero.'],
    ['Moves and passes', 'Every move has an action and a pass (enabler) that boosts the next hero in the play. Finishers end the play.'],
    [
      'Open or contested',
      'A finisher on an open target scores 2 (Wizard finishers 3) and deals full damage. Contested: half damage, no shot points. Two or more free goblins crowd every Champion; Provoke, Strip, Read the Defense, Gravity and Drive open a target.',
    ],
    ['Takedowns', 'Each enemy shows its point value (🏀). Taking it down scores it, and stops it scoring.'],
    [
      'Touches',
      'From each player’s true usage this week (shots, free throws, turnovers and assists). Out of touches, a hero can’t be in a play. Iso: one hero, one finisher, always available.',
    ],
    [
      'Defense',
      'Heroes not in the play defend: the Warrior Protects, the Ranger Closes Out, the Wizard Wards, the Cleric heals (Triage), and the Rogue Strips the Ball off the ram. Contested horde hits deal half and score nothing.',
    ],
    [
      'The horde',
      'Its goblins push the ram automatically when 4 are on it. Its Champions run one called play each turn and score 3 for an open hit and 4 for a hero they take down.',
    ],
    [
      'Statuses',
      'Taunted: open, and attacks the Warrior. Exposed: +3 from every hit this possession (Marked: through the next one too). Disabled: open, and out of the horde’s next play. Pinned: off the ram for the enemy turn.',
    ],
    ['Scouted', 'Calling the same play twice in a row: its passes count for half.'],
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
  return (
    <ModalShell title={`${CLASS_INFO[props.cls].name} · ${h.player}`} onClose={props.onClose}>
      <p className="small muted num">
        vs {h.opp}: {l.pts} pts, {l.reb} reb, {l.ast} ast, {l.stl} stl, {l.blk} blk, {l.fg3m} 3PM, {l.tov} tov, {l.min} min
      </p>
      <p>
        Offense {tierLabel(h.tier)} · Defense {tierLabel(h.defTier)} · {h.touches} of {h.touchesMax} touches left
      </p>
      <p className="small">
        On defense: {CLASS_INFO[props.cls].defense}. {CLASS_INFO[props.cls].defenseText}
      </p>
      <div className="list">
        {MOVES.filter((m) => m.cls === props.cls).map((m) => (
          <div className="li" key={m.id} style={{ gridTemplateColumns: '1fr' }}>
            <strong>
              {m.name} <span className="muted small">({m.kind})</span>
            </strong>
            <span className="small">
              {m.action}
              {m.enablerText ? ` · pass: ${m.enablerText}` : ''}
            </span>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

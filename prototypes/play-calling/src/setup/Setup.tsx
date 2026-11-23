/**
 * The setup flow from the main game, rebuilt for the play-calling prototype: Build your roster,
 * Choose your encounter, Assign your heroes, Pick games. The rules come from the main game
 * (salaries, season tiers, auto-draft, suggested assignments, game picks, the horde each game
 * brings); what each choice means is shown in play-calling terms (game tier, touches, defense,
 * the Champions and goblins the horde gets).
 */
import { useMemo, useState, type ReactNode } from 'react';
import seasonRaw from '../../../../public/data/2025-26.json?raw';
import { decodeSeason, type CompactSeason } from '../../../../src/data/format';
import { formView } from '../../../../src/data/form';
import type { SeasonData, StatLine } from '../../../../src/data/types';
import { DRAFT_MODES, autoDraft } from '../../../../src/app/autoDraft';
import { eligiblePlayers } from '../../../../src/engine/calibration';
import { computeSalary, seasonTier } from '../../../../src/engine/rating';
import { playerGamesInWeek } from '../../../../src/engine/week';
import { buildHorde, playerLine } from '../../../../src/engine/horde';
import { encounterIds, encounterOf } from '../../../../src/engine/encounter';
import { teamName } from '../../../../src/data/teams';
import { rules, tierIndex, type HeroClass } from '../../../../src/rules';
import { CLASS_INFO, ENEMY_INFO, type Cls } from '../content';
import { ROLE_OF, ramDamageFromFg, type Difficulty } from '../engine';
import { Rich } from '../terms';
import { mostTouches, smartPicks, suggestHeroes } from './picks';
import { ENCOUNTER, SETUP_CLASSES, defRating, defTierOf, heroFromGame, teamOf, touchesOf } from './buildWeek';

export const SEASON = '2025-26';
let seasonCache: SeasonData | null = null;
/** The season's games, decoded on first use. */
export function seasonData(): SeasonData {
  return (seasonCache ??= decodeSeason(JSON.parse(seasonRaw) as CompactSeason));
}

export type SetupStep = 'roster' | 'encounter' | 'assign' | 'games';
/** The player's choices. The five hero slots are also the week's assignments; the rest of the roster are reserves. */
export interface SetupState {
  weekIndex: number;
  slots: Partial<Record<HeroClass, number>>;
  reserves: number[];
  encounter: string;
  gamePicks: Partial<Record<HeroClass, string>>;
}
export const emptySetup = (weekIndex: number): SetupState => ({ weekIndex, slots: {}, reserves: [], encounter: ENCOUNTER, gamePicks: {} });

const RESERVES = rules.salary.rosterSize - rules.salary.heroSlots;
const CAP = rules.salary.cap;
const tierLabel = (t: string) => t[0].toUpperCase() + t.slice(1);
const roster = (s: SetupState) => [...SETUP_CLASSES.map((c) => s.slots[c]).filter((x): x is number => x !== undefined), ...s.reserves];

function TierChip(props: { t: string; prefix?: string }) {
  return (
    <span className={`tier ${props.t}`}>
      {props.prefix ? `${props.prefix} ` : ''}
      {tierLabel(props.t)}
    </span>
  );
}
const statText = (l: StatLine) =>
  `${l.pts} PTS · ${l.reb} REB · ${l.ast} AST${l.stl ? ` · ${l.stl} STL` : ''}${l.blk ? ` · ${l.blk} BLK` : ''}${l.fg3m ? ` · ${l.fg3m} 3PM` : ''} · ${l.min} MIN`;
const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const weekRange = (w: { start: string; end: string }) =>
  `${new Date(`${w.start}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${new Date(`${w.end}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

function Footer(props: { back?: { label: string; onClick: () => void }; status: ReactNode; next: { label: string; onClick: () => void; disabled?: boolean } }) {
  return (
    <div className="sheet setupbar">
      <div className="sheet-inner">
        <span className="small muted setupstatus">{props.status}</span>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          {props.back && (
            <button className="btn" onClick={props.back.onClick}>
              ← {props.back.label}
            </button>
          )}
          <button className="btn primary setupnext" disabled={props.next.disabled} onClick={props.next.onClick}>
            {props.next.label} →
          </button>
        </div>
      </div>
    </div>
  );
}

function Steps(props: { step: SetupStep }) {
  const steps: [SetupStep, string][] = [
    ['roster', 'Roster'],
    ['encounter', 'Encounter'],
    ['assign', 'Heroes'],
    ['games', 'Games'],
  ];
  const at = steps.findIndex(([s]) => s === props.step);
  return (
    <div className="setupsteps" aria-label={`Step ${at + 1} of 4`}>
      {steps.map(([s, label], i) => (
        <span key={s} className={i === at ? 'on' : i < at ? 'done' : ''}>
          {i < at ? '✓ ' : ''}
          {label}
        </span>
      ))}
    </div>
  );
}

// ---------- Build your roster ----------

type Sort = 'salary' | 'salary-asc' | 'name' | HeroClass;

export function RosterScreen(props: { state: SetupState; onChange: (s: SetupState) => void; onNext: () => void; onBack: () => void }) {
  const { state } = props;
  const full = seasonData();
  const data = formView(full, state.weekIndex);
  const week = full.weeks.find((w) => w.index === state.weekIndex)!;
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const [sort, setSort] = useState<Sort>('salary');
  const [onlyFits, setOnlyFits] = useState(false);
  const [shown, setShown] = useState(40);
  const [draftMenu, setDraftMenu] = useState(false);
  const players = useMemo(
    () => eligiblePlayers(data).map((p) => ({ p, salary: computeSalary(p.avg), games: playerGamesInWeek(full, week, p.id).length })),
    [data, full, week],
  );
  const byId = useMemo(() => new Map(players.map((x) => [x.p.id, x])), [players]);
  const teams = useMemo(() => [...new Set(players.map((x) => x.p.team))].sort((a, b) => teamName(a).localeCompare(teamName(b))), [players]);
  const ros = roster(state);
  const cost = ros.reduce((s, id) => s + (byId.get(id)?.salary.salary ?? (data.players[id] ? computeSalary(data.players[id].avg).salary : 0)), 0);
  const isClass = (s: Sort): s is HeroClass => (SETUP_CLASSES as string[]).includes(s);
  const q = query.trim().toLowerCase();
  const list = players
    .filter((x) => !ros.includes(x.p.id))
    .filter((x) => !team || x.p.team === team)
    .filter((x) => !q || x.p.name.toLowerCase().includes(q) || teamName(x.p.team).toLowerCase().includes(q) || x.p.team.toLowerCase() === q)
    .filter((x) => !onlyFits || !isClass(sort) || tierIndex(x.salary.classTiers[sort]) >= tierIndex('good'))
    .sort((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name);
      if (sort === 'salary') return b.salary.salary - a.salary.salary || a.p.name.localeCompare(b.p.name);
      if (sort === 'salary-asc') return a.salary.salary - b.salary.salary || a.p.name.localeCompare(b.p.name);
      return tierIndex(b.salary.classTiers[sort]) - tierIndex(a.salary.classTiers[sort]) || a.salary.salary - b.salary.salary;
    });

  const set = (patch: Partial<SetupState>) => props.onChange({ ...state, ...patch, gamePicks: {} });
  const toSlot = (c: HeroClass, id: number) => {
    const displaced = state.slots[c];
    const reserves = state.reserves.filter((r) => r !== id);
    if (displaced !== undefined && reserves.length < RESERVES) reserves.push(displaced);
    const slots = Object.fromEntries(Object.entries(state.slots).filter(([, v]) => v !== id));
    set({ slots: { ...slots, [c]: id }, reserves });
  };
  const toReserves = (id: number) => state.reserves.length < RESERVES && set({ reserves: [...state.reserves, id] });
  const remove = (id: number) =>
    set({ slots: Object.fromEntries(Object.entries(state.slots).filter(([, v]) => v !== id)), reserves: state.reserves.filter((r) => r !== id) });
  const findFor = (c: HeroClass) => {
    setSort(c);
    setOnlyFits(true);
    setShown(40);
    document.getElementById('player-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const problems: string[] = [];
  const empty = SETUP_CLASSES.filter((c) => state.slots[c] === undefined);
  if (empty.length) problems.push(`Need a ${empty.map((c) => CLASS_INFO[c as Cls].name).join(', ')}`);
  if (state.reserves.length < RESERVES) problems.push(`${RESERVES - state.reserves.length} reserve${RESERVES - state.reserves.length > 1 ? 's' : ''} to go`);
  if (cost > CAP) problems.push(`${cost - CAP} gold over the cap`);

  const who = (id: number, c?: HeroClass) => {
    const x = byId.get(id);
    const p = data.players[id];
    return (
      <span className="stack" style={{ gap: 2, minWidth: 0 }}>
        <strong className="ellip">{p?.name ?? id}</strong>
        <span className="row small muted" style={{ gap: 6 }}>
          {p?.team} · {x?.salary.salary ?? '?'} gold · {x?.games ?? 0} game{x?.games === 1 ? '' : 's'}
          {c && <TierChip t={seasonTier(c, p.avg)} />}
        </span>
      </span>
    );
  };

  return (
    <div className="wrap setup">
      <Steps step="roster" />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Build your roster</h1>
        <div className="draftwrap">
          <button className="btn small" aria-expanded={draftMenu} onClick={() => setDraftMenu((v) => !v)}>
            Auto-draft ▾
          </button>
          {draftMenu && (
            <div className="draftmenu" role="menu">
              {DRAFT_MODES.map((m) => (
                <button
                  key={m.id}
                  role="menuitem"
                  onClick={() => {
                    setDraftMenu(false);
                    const d = autoDraft(data, week, m.id, undefined, undefined, CAP);
                    if (d) set({ slots: d.slots, reserves: d.reserves });
                  }}
                >
                  <strong>
                    {m.icon} {m.label}
                  </strong>
                  <span className="small muted">{m.blurb}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="small muted">
        Sign one player for each hero and {RESERVES} reserves under the {CAP}-gold cap. A player’s game this week sets their hero’s tier, touches and defense,
        and brings the player they faced into the horde.
      </p>
      <label className="row small">
        <span className="eyebrow">Week</span>
        <select
          className="input"
          value={state.weekIndex}
          onChange={(e) => props.onChange({ ...state, weekIndex: Number(e.target.value), gamePicks: {} })}
          aria-label="Week"
        >
          {full.weeks
            .filter((w) => w.gameIds.length > 0)
            .map((w) => (
              <option key={w.index} value={w.index}>
                Week {w.index} · {weekRange(w)}
              </option>
            ))}
        </select>
      </label>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="eyebrow">Salary cap</span>
          <span className={`small num ${cost > CAP ? 'err' : ''}`}>
            {cost} / {CAP} gold
          </span>
        </div>
        <span className="capbar" aria-hidden="true">
          <i className={cost > CAP ? 'over' : ''} style={{ width: `${Math.min(100, (cost / CAP) * 100)}%` }} />
        </span>
        <span className="eyebrow">Heroes</span>
        {SETUP_CLASSES.map((c) => {
          const id = state.slots[c];
          return (
            <div key={c} className="rosterslot">
              <span className="rclass">
                {CLASS_INFO[c as Cls].icon} {CLASS_INFO[c as Cls].name}
              </span>
              {id !== undefined ? (
                <>
                  {who(id, c)}
                  <button className="btn quiet small" onClick={() => remove(id)} aria-label={`Release ${data.players[id]?.name}`}>
                    ✕
                  </button>
                </>
              ) : (
                <button className="btn small" style={{ gridColumn: 'span 2' }} onClick={() => findFor(c)}>
                  Find a {CLASS_INFO[c as Cls].name}
                </button>
              )}
            </div>
          );
        })}
        <span className="eyebrow">Reserves</span>
        {Array.from({ length: RESERVES }, (_, i) => state.reserves[i]).map((id, i) =>
          id !== undefined ? (
            <div key={id} className="rosterslot">
              <span className="rclass">Reserve</span>
              {who(id)}
              <button className="btn quiet small" onClick={() => remove(id)} aria-label={`Release ${data.players[id]?.name}`}>
                ✕
              </button>
            </div>
          ) : (
            <div key={`empty-${i}`} className="rosterslot">
              <span className="rclass">Reserve</span>
              <span className="small muted" style={{ gridColumn: 'span 2' }}>
                Empty: add any player with + Reserve
              </span>
            </div>
          ),
        )}
      </div>

      <div className="panel" id="player-list">
        <span className="eyebrow">Players</span>
        <input className="input" placeholder="Search players or teams" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
        <div className="row">
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            <option value="salary">Salary: high to low</option>
            <option value="salary-asc">Salary: low to high</option>
            <option value="name">Name</option>
            {SETUP_CLASSES.map((c) => (
              <option key={c} value={c}>
                Best {CLASS_INFO[c as Cls].name}
              </option>
            ))}
          </select>
          <select className="input" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
            <option value="">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {teamName(t)}
              </option>
            ))}
          </select>
          {isClass(sort) && (
            <label className="row small">
              <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} /> Good or better only
            </label>
          )}
        </div>
        <p className="small muted">Tap a hero chip to put the player on that hero. Chips show their season tier in each class.</p>
        {list.slice(0, shown).map(({ p, salary, games }) => (
          <div key={p.id} className="playerrow">
            <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'nowrap' }}>
              <span className="stack" style={{ gap: 1, minWidth: 0 }}>
                <strong className="ellip">{p.name}</strong>
                <span className="small muted num">
                  {p.team} · {salary.salary} gold · {games} game{games === 1 ? '' : 's'} this week
                </span>
              </span>
              <button className="btn small" disabled={state.reserves.length >= RESERVES} onClick={() => toReserves(p.id)}>
                + Reserve
              </button>
            </div>
            <div className="classchips">
              {SETUP_CLASSES.map((c) => (
                <button
                  key={c}
                  className={`classchip ${salary.classTiers[c]}`}
                  onClick={() => toSlot(c, p.id)}
                  aria-label={`Make ${p.name} the ${CLASS_INFO[c as Cls].name} (${tierLabel(salary.classTiers[c])})`}
                >
                  {CLASS_INFO[c as Cls].icon} {tierLabel(salary.classTiers[c])}
                </button>
              ))}
            </div>
          </div>
        ))}
        {list.length > shown && (
          <button className="btn" onClick={() => setShown((n) => n + 40)}>
            Show more ({list.length - shown} left)
          </button>
        )}
        {list.length === 0 && <p className="small muted">No players match.</p>}
      </div>
      <Footer
        back={{ label: 'Title', onClick: props.onBack }}
        status={problems.length ? problems.join(' · ') : `Roster set: ${cost} of ${CAP} gold`}
        next={{ label: 'Encounter', onClick: props.onNext, disabled: problems.length > 0 }}
      />
    </div>
  );
}

// ---------- Choose your encounter ----------

const HORDE_FOES: (keyof typeof ENEMY_INFO)[] = ['shaman', 'hexer', 'ogre', 'cutthroat', 'sharpshooter'];

export function EncounterScreen(props: {
  state: SetupState;
  difficulty: Difficulty;
  onChange: (s: SetupState) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { state } = props;
  return (
    <div className="wrap setup">
      <Steps step="encounter" />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Choose your encounter</h1>
        <span className="tier">{props.difficulty === 'hard' ? 'Hard' : 'Normal'}</span>
      </div>
      <p className="small muted">
        Where the party plays this week. Your players’ opponents shape the horde: their box scores decide how strong each Champion is and how many goblins come.
      </p>
      {encounterIds().map((id) => {
        const enc = encounterOf(id);
        const playable = id === ENCOUNTER;
        const chosen = state.encounter === id;
        return (
          <button
            key={id}
            className={`panel enccard ${chosen ? 'on' : ''}`}
            disabled={!playable}
            aria-pressed={chosen}
            onClick={() => props.onChange({ ...state, encounter: id })}
          >
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{enc.name}</h3>
              {chosen ? <span className="chip ball">Chosen</span> : !playable ? <span className="chip">Not in this test yet</span> : null}
            </span>
            <span className="small muted">{enc.tagline}</span>
            {playable ? (
              <>
                <span className="small">
                  {HORDE_FOES.map((k) => (
                    <span key={k} className="foe">
                      {ENEMY_INFO[k].icon} {ENEMY_INFO[k].name.replace('Goblin ', '')}
                    </span>
                  ))}
                </span>
                <span className="small">
                  Boss: {ENEMY_INFO.chieftain.icon} <strong>{ENEMY_INFO.chieftain.name}</strong> · the ram, the gate and a loot wagon
                </span>
                <span className="small muted">
                  <Rich>Four quarters, twelve possessions. The Shaman casts the Barrier or Calls the Pack; the Ogre Taunts; the Chieftain Blocks.</Rich>
                </span>
              </>
            ) : (
              <span className="small muted">Plays in the main game. The play-calling version comes later.</span>
            )}
          </button>
        );
      })}
      <Footer
        back={{ label: 'Roster', onClick: props.onBack }}
        status={encounterOf(state.encounter).name}
        next={{ label: 'Assign heroes', onClick: props.onNext, disabled: state.encounter !== ENCOUNTER }}
      />
    </div>
  );
}

// ---------- Assign your heroes ----------

export function AssignScreen(props: { state: SetupState; onChange: (s: SetupState) => void; onNext: () => void; onBack: () => void }) {
  const { state } = props;
  const full = seasonData();
  const data = formView(full, state.weekIndex);
  const week = full.weeks.find((w) => w.index === state.weekIndex)!;
  const games = (id: number) => playerGamesInWeek(full, week, id).length;
  const ros = roster(state);

  const assign = (c: HeroClass, id: number | undefined) => {
    const slots = { ...state.slots };
    let reserves = [...state.reserves];
    const prev = slots[c];
    const from = SETUP_CLASSES.find((k) => k !== c && slots[k] === id);
    if (id === undefined) {
      delete slots[c];
      if (prev !== undefined) reserves.push(prev);
    } else if (from) {
      // Swap two heroes' players.
      slots[from] = prev as number;
      if (prev === undefined) delete slots[from];
      slots[c] = id;
    } else {
      reserves = reserves.filter((r) => r !== id);
      if (prev !== undefined) reserves.push(prev);
      slots[c] = id;
    }
    const gamePicks = { ...state.gamePicks };
    for (const k of SETUP_CLASSES) if (slots[k] !== state.slots[k]) delete gamePicks[k];
    props.onChange({ ...state, slots, reserves, gamePicks });
  };
  const suggest = () => {
    const next = suggestHeroes(data, full, state.weekIndex, ros);
    const placed = new Set(Object.values(next));
    props.onChange({ ...state, slots: next, reserves: ros.filter((id) => !placed.has(id)), gamePicks: {} });
  };
  const complete = SETUP_CLASSES.every((c) => state.slots[c] !== undefined);
  const playing = SETUP_CLASSES.filter((c) => state.slots[c] !== undefined && games(state.slots[c]!) > 0).length;

  return (
    <div className="wrap setup">
      <Steps step="assign" />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Assign your heroes</h1>
        <button className="btn small" onClick={suggest}>
          Suggest
        </button>
      </div>
      <p className="small muted">
        Put one rostered player on each hero. Their season in that class is a guide; the game you pick next sets the hero’s tier, touches and defense. A player
        with no game this week sits out the whole game.
      </p>
      {SETUP_CLASSES.map((c) => {
        const id = state.slots[c];
        const p = id !== undefined ? data.players[id] : undefined;
        const info = CLASS_INFO[c as Cls];
        return (
          <div key={c} className="panel assigncard">
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {info.icon} {info.name}
              </strong>
              <span className="small muted">
                {info.role} · {info.hp} HP · on defense: <Rich>{info.defense}</Rich>
              </span>
            </span>
            <select
              className="input"
              value={id ?? ''}
              onChange={(e) => assign(c, e.target.value ? Number(e.target.value) : undefined)}
              aria-label={`${info.name}'s player`}
            >
              <option value="">Choose a player…</option>
              {ros.map((pid) => {
                const pl = data.players[pid];
                const other = SETUP_CLASSES.find((k) => k !== c && state.slots[k] === pid);
                return (
                  <option key={pid} value={pid}>
                    {pl.name} — {tierLabel(seasonTier(c, pl.avg))} · {games(pid)} game{games(pid) === 1 ? '' : 's'}
                    {other ? ` (now ${CLASS_INFO[other as Cls].name})` : ''}
                  </option>
                );
              })}
            </select>
            {p && (
              <span className="row" style={{ gap: 6 }}>
                <TierChip t={seasonTier(c, p.avg)} prefix="Season" />
                <span className="chip">🏀 ~{touchesOf(p.avg)} touches</span>
                <TierChip t={defTierOf(defRating(p.avg))} prefix="Defense" />
                {games(p.id) > 0 ? <span className="chip open">{games(p.id)} games this week</span> : <span className="chip ball">No game: sits out</span>}
              </span>
            )}
          </div>
        );
      })}
      <div className="panel">
        <span className="eyebrow">Reserves</span>
        {state.reserves.length ? (
          <span className="row small">
            {state.reserves.map((id) => (
              <span key={id} className="chip">
                {data.players[id]?.name} · {games(id)} game{games(id) === 1 ? '' : 's'}
              </span>
            ))}
          </span>
        ) : (
          <span className="small muted">None: every rostered player is on a hero.</span>
        )}
      </div>
      <Footer
        back={{ label: 'Encounter', onClick: props.onBack }}
        status={complete ? `${playing} of 5 heroes play this week` : 'Assign all five heroes'}
        next={{ label: 'Pick games', onClick: props.onNext, disabled: !complete || playing === 0 }}
      />
    </div>
  );
}

// ---------- Pick games ----------

export function GamesScreen(props: { state: SetupState; onChange: (s: SetupState) => void; onNext: () => void; onBack: () => void }) {
  const { state } = props;
  const full = seasonData();
  const week = full.weeks.find((w) => w.index === state.weekIndex)!;
  const heroes = SETUP_CLASSES.filter((c) => state.slots[c] !== undefined);
  const gamesOf = (c: HeroClass) => playerGamesInWeek(full, week, state.slots[c]!);
  const playing = heroes.filter((c) => gamesOf(c).length > 0);
  const allPicked = playing.every((c) => state.gamePicks[c]);
  const pick = (c: HeroClass, gid: string) => props.onChange({ ...state, gamePicks: { ...state.gamePicks, [c]: gid } });
  // The Champion a single game brings: its opponent, mirrored into the horde.
  const mirror = useMemo(() => {
    const cache = new Map<string, ReturnType<typeof buildHorde>['champions'][number] | undefined>();
    return (c: HeroClass, pid: number, gid: string) => {
      const k = `${c}:${pid}:${gid}`;
      if (!cache.has(k)) {
        const h = buildHorde([{ heroClass: c, playerId: pid, gameId: gid }], full, rules, ENCOUNTER);
        cache.set(
          k,
          [...h.champions, h.warlord].find((m) => m.source?.mirrorOf === c),
        );
      }
      return cache.get(k);
    };
  }, [full]);
  const picks = playing.filter((c) => state.gamePicks[c]).map((c) => ({ heroClass: c, playerId: state.slots[c]!, gameId: state.gamePicks[c]! }));
  const horde = picks.length ? buildHorde(picks, full, rules, ENCOUNTER) : null;
  const teams = picks.map((p) => teamOf(full, p.playerId, p.gameId));
  const goblins = teams.reduce((s, t) => s + t.goblins, 0);
  const fg = teams.length ? teams.reduce((s, t) => s + t.fgPct, 0) / teams.length : 0;

  return (
    <div className="wrap setup">
      <Steps step="games" />
      <h1>Pick games</h1>
      <p className="small muted">
        Each hero plays from one game this week: it sets their tier, <Rich>touches</Rich> and defense, and a double-double or triple-double unlocks a special.
        Every game also sends the player they faced into the horde as a Champion, and the opponent’s points become goblins.
      </p>
      <div className="row">
        <button
          className="btn small"
          onClick={() => props.onChange({ ...state, gamePicks: { ...state.gamePicks, ...smartPicks(full, state.weekIndex, state.slots) } })}
          title="Weighs each game's tier, touches, defense and special against the Champions, boss and goblins the games bring together"
        >
          🧠 Smart pick
        </button>
        <button
          className="btn small quiet"
          onClick={() => props.onChange({ ...state, gamePicks: { ...state.gamePicks, ...mostTouches(full, state.weekIndex, state.slots) } })}
        >
          Most touches for each
        </button>
      </div>
      {heroes.map((c) => {
        const pid = state.slots[c]!;
        const info = CLASS_INFO[c as Cls];
        const gids = gamesOf(c);
        return (
          <section key={c} className="panel">
            <span className="row" style={{ justifyContent: 'space-between' }}>
              <strong>
                {info.icon} {info.name}
              </strong>
              <span className="small muted">{full.players[pid]?.name}</span>
            </span>
            {gids.length === 0 && <span className="small err">No game this week: the {info.name} sits out the whole game.</span>}
            {gids.map((gid) => {
              const h = heroFromGame(full, c, pid, gid);
              const m = mirror(c, pid, gid);
              const t = teamOf(full, pid, gid);
              const kind = m ? ROLE_OF[m.kind] : undefined;
              const selected = state.gamePicks[c] === gid;
              return (
                <button key={gid} className={`gamecard ${selected ? 'on' : ''}`} aria-pressed={selected} onClick={() => pick(c, gid)}>
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <strong className="small">
                      {shortDate(h.date)} · {h.home ? 'vs' : '@'} {h.opp}
                    </strong>
                    <TierChip t={h.tier} />
                  </span>
                  <span className="small muted num">{statText(playerLine(full, gid, pid)!)}</span>
                  <span className="row" style={{ gap: 6 }}>
                    <span className="chip">🏀 {h.touches} touches</span>
                    <TierChip t={h.defTier} prefix="Defense" />
                    {h.tripleDouble ? (
                      <span className="chip special td">★★ TD special</span>
                    ) : h.doubleDouble ? (
                      <span className="chip special">★ DD special</span>
                    ) : null}
                  </span>
                  {m && kind && (
                    <span className="small brings">
                      Brings {ENEMY_INFO[kind].icon} <strong>{ENEMY_INFO[kind].name.replace('Goblin ', '')}</strong> ({full.players[m.source!.playerId]?.name})
                      · {tierLabel(m.tier ?? 'average')} · {m.hp} HP · {t.team} scored {t.pts}: {t.goblins} goblins
                    </span>
                  )}
                </button>
              );
            })}
          </section>
        );
      })}
      {horde && (
        <section className="panel">
          <span className="eyebrow">The horde these games bring</span>
          <span className="row small">
            {[...horde.champions, horde.warlord].map((m) => {
              const kind = ROLE_OF[m.kind];
              if (!kind) return null;
              return (
                <span key={m.id} className={`chip ${m.isWarlord ? 'ball' : ''}`}>
                  {ENEMY_INFO[kind].icon} {ENEMY_INFO[kind].name.replace('Goblin ', '')} · {tierLabel(m.tier ?? 'average')}
                  {m.isWarlord ? ' · boss' : ''}
                </span>
              );
            })}
          </span>
          <span className="small">
            👺 {goblins} goblins (1 per {rules.horde.minions.teamPointsPerGoblin} opposing points) · 🪵 the ram hits for {ramDamageFromFg(fg)} (opponents shot{' '}
            {(fg * 100).toFixed(1)}%)
          </span>
        </section>
      )}
      <Footer
        back={{ label: 'Heroes', onClick: props.onBack }}
        status={
          allPicked
            ? `${picks.length} heroes ready${heroes.length > playing.length ? `, ${heroes.length - playing.length} sitting out` : ''}`
            : 'Pick a game for each hero'
        }
        next={{ label: 'Game plan', onClick: props.onNext, disabled: !allPicked || picks.length === 0 }}
      />
    </div>
  );
}

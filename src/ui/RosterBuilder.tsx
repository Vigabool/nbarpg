import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { SeasonData } from '../data/types';
import { MOVES_PER_CHAPTER, currentWeek, rosterCost, rosterMoves, type SaveGame } from '../app/game';
import { eligiblePlayers } from '../engine/calibration';
import { computeSalary, gearDamage, seasonTier, type SalaryBreakdown } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules, tierIndex, type HeroClass } from '../rules';
import { Bar, CLASS_ICON, TierChip, money } from './common';

type Sort = 'salary' | 'salary-asc' | 'name' | HeroClass;
type Slots = Partial<Record<HeroClass, number>>;
const RESERVES = rules.salary.rosterSize - rules.salary.heroSlots;

const isClassSort = (s: Sort): s is HeroClass => (CLASSES as readonly string[]).includes(s);

/** Splits a saved roster into class slots and reserves. */
function initialSlots(game: SaveGame, data: SeasonData): { slots: Slots; reserves: number[] } {
  const slots: Slots = {};
  for (const c of CLASSES) {
    const id = game.assignments[c];
    if (id !== undefined && game.roster.includes(id)) slots[c] = id;
  }
  const placed = new Set(Object.values(slots));
  const rest = game.roster.filter((id) => !placed.has(id));
  // Older saves have no assignments: fill empty classes with the best fit first.
  for (const c of CLASSES) {
    if (slots[c] !== undefined || rest.length <= RESERVES) continue;
    rest.sort((a, b) => tierIndex(seasonTier(c, data.players[b].avg)) - tierIndex(seasonTier(c, data.players[a].avg)));
    slots[c] = rest.shift();
  }
  return { slots, reserves: rest };
}

export function RosterBuilder({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const init = useMemo(() => initialSlots(game, data), [game, data]);
  const [slots, setSlots] = useState<Slots>(init.slots);
  const [reserves, setReserves] = useState<number[]>(init.reserves);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('salary');
  const [onlyFits, setOnlyFits] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const week = currentWeek(game, data);
  const cap = rules.salary.cap;
  const size = rules.salary.rosterSize;

  const players = useMemo(
    () =>
      eligiblePlayers(data).map((p) => ({
        p,
        salary: computeSalary(p.avg),
        gamesThisWeek: week ? playerGamesInWeek(data, week, p.id).length : 0,
      })),
    [data, week],
  );
  const byId = useMemo(() => new Map(players.map((x) => [x.p.id, x])), [players]);

  const roster = [...CLASSES.map((c) => slots[c]).filter((x): x is number => x !== undefined), ...reserves];
  const cost = rosterCost(roster, data);
  const moves = rosterMoves(game, roster);
  const isChapterMove = game.chapterRoster !== null;
  const q = query.trim().toLowerCase();
  const list = players
    .filter((x) => !roster.includes(x.p.id))
    .filter((x) => !q || x.p.name.toLowerCase().includes(q) || x.p.team.toLowerCase() === q)
    .filter((x) => !onlyFits || !isClassSort(sort) || tierIndex(x.salary.classTiers[sort]) >= tierIndex('good'))
    .sort((a, b) => {
      if (sort === 'name') return a.p.name.localeCompare(b.p.name);
      if (sort === 'salary') return b.salary.salary - a.salary.salary || a.p.name.localeCompare(b.p.name);
      if (sort === 'salary-asc') return a.salary.salary - b.salary.salary || a.p.name.localeCompare(b.p.name);
      return (
        tierIndex(b.salary.classTiers[sort]) - tierIndex(a.salary.classTiers[sort]) ||
        a.salary.salary - b.salary.salary ||
        a.p.name.localeCompare(b.p.name)
      );
    });

  /** Puts a player in a class slot; whoever held it moves to reserves if there's room. */
  const addToClass = (c: HeroClass, id: number) => {
    const displaced = slots[c];
    setSlots({ ...slots, [c]: id });
    const nextReserves = reserves.filter((r) => r !== id);
    if (displaced !== undefined && nextReserves.length < RESERVES) nextReserves.push(displaced);
    setReserves(nextReserves);
  };
  const addToReserves = (id: number) => {
    if (reserves.length < RESERVES) setReserves([...reserves, id]);
  };
  const remove = (id: number) => {
    setSlots(Object.fromEntries(Object.entries(slots).filter(([, v]) => v !== id)) as Slots);
    setReserves(reserves.filter((r) => r !== id));
  };
  const promote = (id: number) => {
    const empty = CLASSES.find((c) => slots[c] === undefined);
    if (!empty) return;
    setReserves(reserves.filter((r) => r !== id));
    setSlots({ ...slots, [empty]: id });
  };
  const findFor = (c: HeroClass) => {
    setSort(c);
    setOnlyFits(true);
    listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const problems: string[] = [];
  const emptyClasses = CLASSES.filter((c) => slots[c] === undefined);
  if (emptyClasses.length) problems.push(`Need ${emptyClasses.map((c) => rules.classes[c].name).join(', ')}`);
  if (reserves.length < RESERVES) problems.push(`${RESERVES - reserves.length} reserve${RESERVES - reserves.length > 1 ? 's' : ''} to go`);
  if (cost > cap) problems.push(`${money(cost - cap)} over the cap`);
  if (isChapterMove && moves > MOVES_PER_CHAPTER) problems.push(`Only ${MOVES_PER_CHAPTER} moves allowed`);

  const mini = (id: number, extra?: ReactNode) => {
    const x = byId.get(id);
    const p = data.players[id];
    return (
      <div className="slot-player">
        <div style={{ minWidth: 0 }}>
          <div className="slot-name">{p?.name ?? id}</div>
          <div className="tiny muted num">
            {p?.team} · {money(x?.salary.salary ?? 0)}
            {x && ` · ${x.gamesThisWeek}g`}
          </div>
          {extra}
        </div>
        <button className="btn ghost small icon-btn" onClick={() => remove(id)} aria-label={`Remove ${p?.name}`}>
          ✕
        </button>
      </div>
    );
  };

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 4 }}>
        <h1>{isChapterMove ? 'New chapter: roster moves' : 'Build your roster'}</h1>
        <p className="muted small">
          {isChapterMove
            ? `Release and sign up to ${MOVES_PER_CHAPTER} players under the cap. Hero progress stays with the heroes.`
            : `Sign one player for each hero and ${RESERVES} reserves, under the ${money(cap)} cap. Tap a class chip on a player to put them in that hero's slot. You can reshuffle heroes every week.`}
        </p>
      </div>

      <div className="card stack">
        <Bar
          kind="cap"
          value={cost}
          max={cap}
          label={
            <>
              <span>
                {roster.length}/{size} players{isChapterMove && ` · ${moves}/${MOVES_PER_CHAPTER} moves`}
              </span>
              <span className={cost > cap ? 'warn' : ''}>
                {money(cost)} / {money(cap)} · {money(Math.max(0, cap - cost))} left
              </span>
            </>
          }
        />
        <div className="slot-grid">
          {CLASSES.map((c) => {
            const id = slots[c];
            const p = id !== undefined ? data.players[id] : undefined;
            return (
              <div key={c} className={`slot${id !== undefined ? ' filled' : ''}`}>
                <div className="slot-head">
                  <span>
                    {CLASS_ICON[c]} {rules.classes[c].name}
                  </span>
                </div>
                {p ? (
                  mini(
                    p.id,
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <TierChip tier={seasonTier(c, p.avg)} />
                      <span className="chip">Gear {gearDamage(c, p.avg)}</span>
                    </div>,
                  )
                ) : (
                  <button className="btn ghost small slot-empty" onClick={() => findFor(c)}>
                    Find a {rules.classes[c].name.toLowerCase()} ↓
                  </button>
                )}
              </div>
            );
          })}
          <div className="slot reserves">
            <div className="slot-head">
              <span>Reserves</span>
              <span className="tiny faint">
                {reserves.length}/{RESERVES}
              </span>
            </div>
            {reserves.map((id) => (
              <div key={id}>
                {mini(
                  id,
                  emptyClasses.length > 0 && (
                    <button className="btn ghost small" style={{ minHeight: 26, padding: '0 6px', marginTop: 2 }} onClick={() => promote(id)}>
                      Make {rules.classes[emptyClasses[0]].name} ↑
                    </button>
                  ),
                )}
              </div>
            ))}
            {reserves.length === 0 && <div className="tiny faint">Tap "Reserve" on any player.</div>}
          </div>
        </div>
      </div>

      <div className="row" ref={listRef} style={{ scrollMarginTop: 12 }}>
        <input className="input" id="player-search" style={{ flex: '1 1 200px' }} placeholder="Search players or team (e.g. BOS)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" id="player-sort" style={{ flex: '0 1 240px' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="salary">Sort: salary (high to low)</option>
          <option value="salary-asc">Sort: salary (low to high)</option>
          <option value="name">Sort: name</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              Best {rules.classes[c].name} fits ({rules.classes[c].ratingLabel})
            </option>
          ))}
        </select>
        {isClassSort(sort) && (
          <label className="row small muted">
            <input type="checkbox" id="only-fits" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} /> Good or better only
          </label>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {list.slice(0, 150).map(({ p, salary, gamesThisWeek }) => (
          <PlayerRow
            key={p.id}
            name={p.name}
            meta={`${p.team} · ${p.gp} GP · ${p.avg.pts.toFixed(1)} PTS ${p.avg.reb.toFixed(1)} REB ${p.avg.ast.toFixed(1)} AST · ${gamesThisWeek}g this week`}
            salary={salary}
            slots={slots}
            reservesFull={reserves.length >= RESERVES}
            highlight={isClassSort(sort) ? sort : undefined}
            onClass={(c) => addToClass(c, p.id)}
            onReserve={() => addToReserves(p.id)}
            overCap={cost + salary.salary > cap}
          />
        ))}
        {list.length > 150 && <p className="muted small">Showing 150 of {list.length}. Search to narrow the list.</p>}
        {list.length === 0 && <p className="muted small">No players match.</p>}
      </div>

      <div className="sticky-bottom">
        <div className="spread">
          <span className="small muted">{problems.length ? problems.join(' · ') : 'Roster ready'}</span>
          <button
            className="btn primary"
            disabled={problems.length > 0}
            onClick={() => {
              const changed = CLASSES.some((c) => slots[c] !== game.assignments[c]);
              onChange({
                ...game,
                roster,
                chapterRoster: null,
                assignments: slots,
                gamePicks: changed ? {} : game.gamePicks,
                phase: 'assign',
              });
            }}
          >
            Confirm heroes →
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerRow({
  name,
  meta,
  salary,
  slots,
  reservesFull,
  highlight,
  overCap,
  onClass,
  onReserve,
}: {
  name: string;
  meta: string;
  salary: SalaryBreakdown;
  slots: Slots;
  reservesFull: boolean;
  highlight?: HeroClass;
  overCap: boolean;
  onClass: (c: HeroClass) => void;
  onReserve: () => void;
}) {
  return (
    <div className="card flat player-row">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 650 }}>{name}</div>
        <div className="tiny muted num">{meta}</div>
      </div>
      <div className={`num salary${overCap ? ' warn' : ''}`} style={{ fontWeight: 700, textAlign: 'right' }} title={overCap ? 'Would put you over the cap' : undefined}>
        {money(salary.salary)}
      </div>
      <div className="tiers">
        {CLASSES.map((c) => (
          <button
            key={c}
            className={`chip tier tier-${salary.classTiers[c]} add-chip${highlight === c ? ' hl' : ''}`}
            onClick={() => onClass(c)}
            title={slots[c] !== undefined ? `Replace your ${rules.classes[c].name}` : `Sign as ${rules.classes[c].name}`}
          >
            + {CLASS_ICON[c]} {salary.classTiers[c][0].toUpperCase() + salary.classTiers[c].slice(1)}
          </button>
        ))}
        <button className="chip add-chip" disabled={reservesFull} onClick={onReserve}>
          + Reserve
        </button>
      </div>
    </div>
  );
}

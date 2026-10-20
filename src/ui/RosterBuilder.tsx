import { useMemo, useState } from 'react';
import type { SeasonData } from '../data/types';
import { MOVES_PER_CHAPTER, currentWeek, rosterCost, rosterMoves, type SaveGame } from '../app/game';
import { eligiblePlayers } from '../engine/calibration';
import { computeSalary } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules, tierIndex, type HeroClass } from '../rules';
import { Bar, CLASS_ICON, TierChip, money } from './common';

type Sort = 'salary' | 'salary-asc' | 'name' | HeroClass;

const isClassSort = (s: Sort): s is HeroClass => (CLASSES as readonly string[]).includes(s);

export function RosterBuilder({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const [roster, setRoster] = useState<number[]>(game.roster);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('salary');
  const [onlyFits, setOnlyFits] = useState(false);
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

  const cost = rosterCost(roster, data);
  const moves = rosterMoves(game, roster);
  const isChapterMove = game.chapterRoster !== null;
  const q = query.trim().toLowerCase();
  const list = players
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

  const toggle = (id: number) =>
    setRoster((r) => (r.includes(id) ? r.filter((x) => x !== id) : r.length < size ? [...r, id] : r));

  const problems: string[] = [];
  if (roster.length !== size) problems.push(`Pick ${size - roster.length} more`);
  if (cost > cap) problems.push(`${money(cost - cap)} over the cap`);
  if (isChapterMove && moves > MOVES_PER_CHAPTER) problems.push(`Only ${MOVES_PER_CHAPTER} moves allowed`);

  return (
    <div className="stack">
      <div className="stack" style={{ gap: 4 }}>
        <h1>{isChapterMove ? 'New chapter: roster moves' : 'Build your roster'}</h1>
        <p className="muted small">
          {isChapterMove
            ? `Release and sign up to ${MOVES_PER_CHAPTER} players under the cap. Hero progress stays with the heroes.`
            : `Sign ${size} players under the ${money(cap)} cap. Five will power heroes each week; three are reserves. Salary comes from each player's best season tier, plus ${money(rules.salary.versatility.premiumPerExtraClass)} for each extra class where they're Great or better.`}
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
                {roster.length}/{size} players
                {isChapterMove && ` · ${moves}/${MOVES_PER_CHAPTER} moves`}
              </span>
              <span className={cost > cap ? 'warn' : ''}>
                {money(cost)} / {money(cap)}
              </span>
            </>
          }
        />
        {roster.length > 0 && (
          <div className="row">
            {roster.map((id) => {
              const x = byId.get(id);
              return (
                <button key={id} className="chip" onClick={() => toggle(id)} title="Remove">
                  {data.players[id]?.name ?? id} · {money(x?.salary.salary ?? 0)} ✕
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="row">
        <input className="input" style={{ flex: '1 1 200px' }} placeholder="Search players or team (e.g. BOS)" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" style={{ flex: '0 1 220px' }} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="salary">Sort: salary (high to low)</option>
          <option value="salary-asc">Sort: salary (low to high)</option>
          <option value="name">Sort: name</option>
          {CLASSES.map((c) => (
            <option key={c} value={c}>
              Sort: {rules.classes[c].name} fit ({rules.classes[c].ratingLabel})
            </option>
          ))}
        </select>
        {isClassSort(sort) && (
          <label className="row small muted">
            <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} /> Good or better only
          </label>
        )}
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {list.slice(0, 150).map(({ p, salary, gamesThisWeek }) => {
          const picked = roster.includes(p.id);
          const full = !picked && roster.length >= size;
          return (
            <div
              key={p.id}
              className={`card flat player-row selectable${picked ? ' selected' : ''}${full ? ' dim' : ''}`}
              onClick={() => !full && toggle(p.id)}
              role="button"
              aria-pressed={picked}
            >
              <div>
                <div style={{ fontWeight: 650 }}>{p.name}</div>
                <div className="tiny muted num">
                  {p.team} · {p.gp} GP · {p.avg.pts.toFixed(1)} PTS {p.avg.reb.toFixed(1)} REB {p.avg.ast.toFixed(1)} AST ·{' '}
                  {gamesThisWeek} game{gamesThisWeek === 1 ? '' : 's'} this week
                </div>
              </div>
              <div className="num salary" style={{ fontWeight: 700, color: 'var(--gold-2)', textAlign: 'right' }}>
                {money(salary.salary)}
              </div>
              <div className="tiers">
                {CLASSES.map((c) => (
                  <TierChip key={c} tier={salary.classTiers[c]} prefix={CLASS_ICON[c]} />
                ))}
              </div>
            </div>
          );
        })}
        {list.length > 150 && <p className="muted small">Showing 150 of {list.length}. Search to narrow the list.</p>}
      </div>

      <div className="sticky-bottom">
        <div className="spread">
          <span className="small muted">{problems.length ? problems.join(' · ') : 'Roster ready'}</span>
          <button
            className="btn primary"
            disabled={problems.length > 0}
            onClick={() => {
              const assignments = Object.fromEntries(Object.entries(game.assignments).filter(([, id]) => roster.includes(id!)));
              onChange({ ...game, roster, chapterRoster: null, assignments, phase: 'assign' });
            }}
          >
            Assign heroes →
          </button>
        </div>
      </div>
    </div>
  );
}

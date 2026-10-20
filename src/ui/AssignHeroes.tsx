import type { SeasonData } from '../data/types';
import { currentWeek, type SaveGame } from '../app/game';
import { gearDamage, seasonTier } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules, tierIndex, type HeroClass } from '../rules';
import { ClassName, TierChip, gamesCount } from './common';

export function AssignHeroes({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const week = currentWeek(game, data);
  const games = (id: number) => (week ? playerGamesInWeek(data, week, id).length : 0);
  const assigned = new Set(Object.values(game.assignments));
  const reserves = game.roster.filter((id) => !assigned.has(id));

  const assign = (c: HeroClass, playerId: number | undefined) => {
    const next = { ...game.assignments };
    // Moving a player to a new hero frees their old slot.
    for (const k of CLASSES) if (next[k] === playerId) delete next[k];
    if (playerId === undefined) delete next[c];
    else next[c] = playerId;
    const gamePicks = { ...game.gamePicks };
    for (const k of CLASSES) if (next[k] !== game.assignments[k]) delete gamePicks[k];
    onChange({ ...game, assignments: next, gamePicks });
  };

  const autoAssign = () => {
    const next: Partial<Record<HeroClass, number>> = {};
    const used = new Set<number>();
    // Fill the classes with the fewest strong options first.
    const order = [...CLASSES].sort(
      (a, b) =>
        game.roster.filter((id) => tierIndex(seasonTier(a, data.players[id].avg)) >= 2).length -
        game.roster.filter((id) => tierIndex(seasonTier(b, data.players[id].avg)) >= 2).length,
    );
    for (const c of order) {
      const best = game.roster
        .filter((id) => !used.has(id))
        .sort(
          (a, b) =>
            Number(games(b) > 0) - Number(games(a) > 0) ||
            tierIndex(seasonTier(c, data.players[b].avg)) - tierIndex(seasonTier(c, data.players[a].avg)),
        )[0];
      if (best !== undefined) {
        next[c] = best;
        used.add(best);
      }
    }
    onChange({ ...game, assignments: next, gamePicks: {} });
  };

  const complete = CLASSES.every((c) => game.assignments[c] !== undefined);
  const playing = CLASSES.filter((c) => game.assignments[c] !== undefined && games(game.assignments[c]!) > 0).length;

  return (
    <div className="stack">
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Assign your heroes</h1>
          <p className="muted small">
            Bind one rostered player to each hero for this week. Season tier in the class sets gear damage. Players without a game this week
            sit out.
          </p>
        </div>
        <button className="btn small" onClick={autoAssign}>
          Suggest assignments
        </button>
      </div>

      <div className="grid">
        {CLASSES.map((c) => {
          const id = game.assignments[c];
          const p = id !== undefined ? data.players[id] : undefined;
          return (
            <div key={c} className="card stack">
              <div className="spread">
                <h2>
                  <ClassName c={c} />
                </h2>
                <span className="tiny muted">{game.pp[c].toFixed(1)} PP</span>
              </div>
              <div className="tiny muted">
                {rules.classes[c].role} · {rules.classes[c].hp} HP · Pool from {rules.classes[c].ratingLabel}
              </div>
              <select className="input" value={id ?? ''} onChange={(e) => assign(c, e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Choose a player…</option>
                {game.roster.map((pid) => {
                  const pl = data.players[pid];
                  const t = seasonTier(c, pl.avg);
                  const other = CLASSES.find((k) => k !== c && game.assignments[k] === pid);
                  return (
                    <option key={pid} value={pid}>
                      {pl.name} — {t[0].toUpperCase() + t.slice(1)} · {gamesCount(games(pid))}{other ? ` (now ${rules.classes[other].name})` : ''}
                    </option>
                  );
                })}
              </select>
              {p && (
                <div className="row small">
                  <TierChip tier={seasonTier(c, p.avg)} prefix="Season" />
                  <span className="chip">Gear {gearDamage(c, p.avg)}</span>
                  {games(p.id) > 0 ? (
                    <span className="chip status-good">{games(p.id)} games this week</span>
                  ) : (
                    <span className="chip warn">No games: sits out</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card flat stack">
        <h3>Reserves</h3>
        {reserves.length === 0 ? (
          <p className="muted small">None: all rostered players are on heroes.</p>
        ) : (
          <div className="row">
            {reserves.map((id) => (
              <span key={id} className="chip">
                {data.players[id].name} · {gamesCount(games(id))}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="sticky-bottom">
        <div className="spread">
          <button className="btn ghost small" onClick={() => onChange({ ...game, phase: 'roster' })} disabled={game.history.length > 0}>
            ← Roster
          </button>
          <span className="small muted">{complete ? `${playing} of 5 heroes play this week` : 'Assign all five heroes'}</span>
          <button className="btn primary" disabled={!complete || playing === 0} onClick={() => onChange({ ...game, phase: 'select' })}>
            Pick games →
          </button>
        </div>
      </div>
    </div>
  );
}

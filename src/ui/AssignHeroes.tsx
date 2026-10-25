import { useState } from 'react';
import type { SeasonData } from '../data/types';
import { Armory } from './Armory';
import { autoAssign } from '../app/autoAssign';
import { currentWeek, type SaveGame } from '../app/game';
import { gearDamage, seasonTier } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules, type HeroClass } from '../rules';
import { ClassName, TierChip, gamesCount } from './common';
import { isTenDay, releaseTenDay, weekRoster } from '../app/gold';
import { TenDayPicker } from './TenDay';
import { SetupBanner } from './SetupBanner';

export function AssignHeroes({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const [armory, setArmory] = useState<HeroClass | null>(null);
  // Ten-day picker: open for a hero (signing also assigns), or for no hero in particular.
  const [tenDay, setTenDay] = useState<{ heroClass?: HeroClass } | null>(null);
  const roster = weekRoster(game);
  const week = currentWeek(game, data);
  const games = (id: number) => (week ? playerGamesInWeek(data, week, id).length : 0);
  const assigned = new Set(Object.values(game.assignments));
  const reserves = roster.filter((id) => !assigned.has(id));

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

  const suggest = () => onChange({ ...game, assignments: autoAssign(game, data), gamePicks: {} });

  const complete = CLASSES.every((c) => game.assignments[c] !== undefined);
  const playing = CLASSES.filter((c) => game.assignments[c] !== undefined && games(game.assignments[c]!) > 0).length;

  return (
    <div className="stack">
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Assign your heroes</h1>
          <p className="muted small">
            Bind one rostered player to each hero for this week. Season tier in the class sets gear damage. Players without a game this week sit out.
          </p>
        </div>
        <button className="btn small" onClick={suggest}>
          Suggest assignments
        </button>
      </div>

      <SetupBanner id="banner-assign">
        <strong>Put a player on each hero.</strong> Their season tier in that class sets the hero's gear damage. A player with no game this week sits out: sign
        a 📝 ten-day contract to cover.
      </SetupBanner>

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
                <button className="btn ghost small" onClick={() => setArmory(c)} title="Spend this hero's PP in the Armory">
                  🛠️ {game.pp[c]} PP
                </button>
              </div>
              <div className="tiny muted">
                {rules.classes[c].role} · {rules.classes[c].hp} HP · Energy from {rules.classes[c].ratingLabel}
              </div>
              <select className="input" value={id ?? ''} onChange={(e) => assign(c, e.target.value ? Number(e.target.value) : undefined)}>
                <option value="">Choose a player…</option>
                {roster.map((pid) => {
                  const pl = data.players[pid];
                  const t = seasonTier(c, pl.avg);
                  const other = CLASSES.find((k) => k !== c && game.assignments[k] === pid);
                  return (
                    <option key={pid} value={pid}>
                      {pl.name}
                      {isTenDay(game, pid) ? ' (10-day)' : ''} — {t[0].toUpperCase() + t.slice(1)} · {gamesCount(games(pid))}
                      {other ? ` (now ${rules.classes[other].name})` : ''}
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
                  {isTenDay(game, p.id) && <span className="chip">📝 10-day</span>}
                </div>
              )}
              {(!p || games(p.id) === 0) && (
                <button className="btn small" onClick={() => setTenDay({ heroClass: c })}>
                  📝 Sign a ten-day contract
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="card flat stack">
        <div className="spread">
          <h3>Ten-day contracts</h3>
          <span className="small muted">💰 {game.gold} gold</span>
        </div>
        <p className="muted small">
          Rent a free agent with a game this week, for this week only: {Math.round(rules.salary.gold.tenDay.feeFraction * 100)}% of their salary in gold, no cap
          space or roster move. Up to {rules.salary.gold.tenDay.perWeek} a week; release before the battle for a refund.
        </p>
        {game.tenDay.length > 0 && (
          <div className="row">
            {game.tenDay.map((t) => (
              <span key={t.playerId} className="chip">
                📝 {data.players[t.playerId].name} · {t.fee} gold{' '}
                <button
                  className="btn ghost small icon-btn"
                  onClick={() => onChange(releaseTenDay(game, t.playerId))}
                  aria-label={`Release ${data.players[t.playerId].name}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        <div>
          <button className="btn small" onClick={() => setTenDay({})}>
            Browse free agents
          </button>
        </div>
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
          <button className="btn ghost small" onClick={() => onChange({ ...game, phase: 'encounter' })}>
            ← Encounter
          </button>
          <span className="small muted">{complete ? `${playing} of 5 heroes play this week` : 'Assign all five heroes'}</span>
          <button className="btn primary" disabled={!complete || playing === 0} onClick={() => onChange({ ...game, phase: 'select' })}>
            Pick games →
          </button>
        </div>
      </div>
      {tenDay && <TenDayPicker data={data} game={game} heroClass={tenDay.heroClass} onChange={onChange} onClose={() => setTenDay(null)} />}
      {armory && <Armory game={game} onChange={onChange} initial={armory} onClose={() => setArmory(null)} />}
    </div>
  );
}

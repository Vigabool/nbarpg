import type { SeasonData } from '../data/types';
import { currentWeek, readyPicks, startBattle, type SaveGame } from '../app/game';
import { buildHorde, opponentOf, playerLine, type MonsterSpec } from '../engine/horde';
import { computePool } from '../engine/rating';
import { playerGamesInWeek } from '../engine/week';
import { CLASSES, rules, type HeroClass } from '../rules';
import { ClassName, MONSTER_ICON, TierChip, formatDate, statLine } from './common';

function mirrorFor(c: HeroClass, playerId: number, gameId: string, data: SeasonData): MonsterSpec | undefined {
  const h = buildHorde([{ heroClass: c, playerId, gameId }], data);
  return [...h.waves.flat()].find((m) => m.source?.mirrorOf === c);
}

export function SelectGames({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const week = currentWeek(game, data)!;
  const heroes = CLASSES.filter((c) => game.assignments[c] !== undefined);
  const picks = readyPicks(game, data);
  const playing = heroes.filter((c) => playerGamesInWeek(data, week, game.assignments[c]!).length > 0);
  const horde = picks.length ? buildHorde(picks, data) : null;
  const allPicked = playing.every((c) => game.gamePicks[c]);

  const pick = (c: HeroClass, gameId: string) => onChange({ ...game, gamePicks: { ...game.gamePicks, [c]: gameId } });
  const pickBest = () => {
    const gamePicks = { ...game.gamePicks };
    for (const c of playing) {
      const pid = game.assignments[c]!;
      gamePicks[c] = playerGamesInWeek(data, week, pid)
        .map((g) => ({ g, pool: computePool(c, playerLine(data, g, pid)!).pool }))
        .sort((a, b) => b.pool - a.pool)[0].g;
    }
    onChange({ ...game, gamePicks });
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="stack" style={{ gap: 4 }}>
          <h1>Choose this week's games</h1>
          <p className="muted small">
            Each hero's pool comes from one game this week. Every game also sends that night's opposing player into the horde as a mirrored
            Champion, and the best opposing performance becomes the Warlord.
          </p>
        </div>
        <button className="btn small" onClick={pickBest}>
          Best pool for each
        </button>
      </div>

      {heroes.map((c) => {
        const pid = game.assignments[c]!;
        const player = data.players[pid];
        const games = playerGamesInWeek(data, week, pid);
        return (
          <section key={c} className="card stack">
            <div className="spread">
              <h2>
                <ClassName c={c} /> <span className="muted small">· {player.name}</span>
              </h2>
              <span className="tiny muted">{rules.classes[c].ratingLabel}</span>
            </div>
            {games.length === 0 && <p className="warn small">No games this week. This hero sits out the battle.</p>}
            <div className="grid">
              {games.map((gid) => {
                const g = data.games[gid];
                const line = playerLine(data, gid, pid)!;
                const pool = computePool(c, line);
                const opp = opponentOf(line.team, g);
                const mirror = mirrorFor(c, pid, gid, data);
                const selected = game.gamePicks[c] === gid;
                return (
                  <button key={gid} className={`card flat selectable game-option stack${selected ? ' selected' : ''}`} style={{ gap: 6 }} onClick={() => pick(c, gid)}>
                    <div className="spread small">
                      <strong>
                        {formatDate(g.date)} · {g.home === line.team ? 'vs' : '@'} {opp}
                      </strong>
                      <span className="num" style={{ fontWeight: 700, color: 'var(--info)' }}>
                        {pool.pool} pts
                      </span>
                    </div>
                    <div className="tiny muted num">{statLine(line)}</div>
                    <div className="row">
                      <TierChip tier={pool.tier} />
                      {pool.tripleDouble ? (
                        <span className="chip status-taunt">Triple-double: Legendary</span>
                      ) : pool.doubleDouble ? (
                        <span className="chip status-taunt">Double-double: Signature</span>
                      ) : null}
                      {pool.modifiers
                        .filter((m) => !/double/i.test(m.label))
                        .map((m) => (
                          <span key={m.label} className={`chip ${m.amount < 0 ? 'warn' : 'status-good'}`}>
                            {m.label} {m.amount > 0 ? '+' : ''}
                            {m.amount}
                          </span>
                        ))}
                    </div>
                    {mirror && (
                      <div className="mirror tiny">
                        Brings {MONSTER_ICON[mirror.kind]} <strong>{mirror.name}</strong> · {statLine(mirror.source!.line)}
                        <br />
                        <TierChip tier={mirror.tier!} /> {mirror.hp} HP · {mirror.damage} dmg
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {horde && (
        <section className="card stack">
          <h2>Horde preview</h2>
          {horde.waves.map((wave, i) => {
            const goblins = wave.filter((m) => m.kind === 'goblin');
            const named = wave.filter((m) => m.kind !== 'goblin');
            return (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <h3 className="small muted">
                  Wave {i + 1} · {wave.reduce((s, m) => s + m.hp, 0)} total HP
                </h3>
                <div className="row">
                  {goblins.length > 0 && (
                    <span className="chip">
                      {MONSTER_ICON.goblin} {goblins.length} goblins ({[...new Set(goblins.map((g) => g.damage))].join('/')} dmg)
                    </span>
                  )}
                  {named.map((m) => (
                    <span key={m.id} className={`chip ${m.isWarlord ? 'warn' : ''}`}>
                      {MONSTER_ICON[m.kind]} {m.name} · {m.hp} HP · {m.damage} dmg{m.isWarlord ? ' ×2 actions' : ''}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="sticky-bottom">
        <div className="spread">
          <button className="btn ghost small" onClick={() => onChange({ ...game, phase: 'assign' })}>
            ← Heroes
          </button>
          <span className="small muted">{allPicked ? `${picks.length} heroes ready` : 'Pick a game for each hero'}</span>
          <button className="btn primary" disabled={!allPicked || picks.length === 0} onClick={() => onChange(startBattle(game, data))}>
            To battle ⚔️
          </button>
        </div>
      </div>
    </div>
  );
}

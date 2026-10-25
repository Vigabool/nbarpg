import type { SeasonData } from '../data/types';
import { chapterOf, currentWeek, readyPicks, startBattle, type SaveGame } from '../app/game';
import { buildHorde, opponentOf, playerLine, type MonsterSpec } from '../engine/horde';
import { computePool } from '../engine/rating';
import { playerGamesInWeek, scaleHorde } from '../engine/week';
import { CLASSES, rules, type HeroClass } from '../rules';
import { encounterIds, encounterOf, monsterIcon, monsterName } from '../engine/encounter';
import { ClassName, TierChip, formatDate, statLine } from './common';

function mirrorFor(c: HeroClass, playerId: number, gameId: string, data: SeasonData, encounter?: string): MonsterSpec | undefined {
  const h = buildHorde([{ heroClass: c, playerId, gameId }], data, undefined, encounter);
  return [...h.waves.flat()].find((m) => m.source?.mirrorOf === c);
}

export function SelectGames({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const week = currentWeek(game, data)!;
  const heroes = CLASSES.filter((c) => game.assignments[c] !== undefined);
  const picks = readyPicks(game, data);
  const playing = heroes.filter((c) => playerGamesInWeek(data, week, game.assignments[c]!).length > 0);
  const chapter = chapterOf(game);
  const horde = picks.length ? scaleHorde(buildHorde(picks, data, undefined, game.encounter), chapter) : null;
  const enc = encounterOf(game.encounter);
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
            Each hero's starting energy comes from one game this week. Every game also sends that night's opposing player into the horde as a mirrored
            Champion; a big night gives it a trait (✋ Swat for 4+ blocks, 📣 Floor General for 10+ assists…). The best opposing line by anyone else
            becomes the boss. Sloppy opponents help: every {rules.horde.turnoversPerFumble}{' '}
            turnovers give you a 💫 Fumble to cancel that Champion's action in battle.
          </p>
        </div>
        <button className="btn small" onClick={pickBest}>
          Most energy for each
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
                const mirror = mirrorFor(c, pid, gid, data, game.encounter);
                const selected = game.gamePicks[c] === gid;
                return (
                  <button key={gid} className={`card flat selectable game-option stack${selected ? ' selected' : ''}`} style={{ gap: 6 }} onClick={() => pick(c, gid)}>
                    <div className="spread small">
                      <strong>
                        {formatDate(g.date)} · {g.home === line.team ? 'vs' : '@'} {opp}
                      </strong>
                      <span className="num" style={{ fontWeight: 700, color: 'var(--info)' }}>
                        {pool.pool} energy
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
                        Brings {monsterIcon(mirror.kind, game.encounter)} <strong>{mirror.name}</strong> · {statLine(mirror.source!.line)}
                        <br />
                        <TierChip tier={mirror.tier!} /> {mirror.hp} HP · {mirror.damage} dmg
                        <FumbleNote m={mirror} />
                        <TraitNote m={mirror} />
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
          <div className="stack" style={{ gap: 2 }}>
            <div className="spread">
              <span className="section-label">This week's encounter</span>
              <label className="row tiny muted" style={{ gap: 6 }}>
                Testing:
                <select
                  className="input"
                  id="encounter-pick"
                  style={{ minHeight: 30, padding: '2px 8px', width: 'auto' }}
                  value={game.encounter ?? rules.encounters.default}
                  onChange={(e) => onChange({ ...game, encounter: e.target.value })}
                >
                  {encounterIds().map((id) => (
                    <option key={id} value={id}>
                      {encounterOf(id).name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <h2>{enc.name}</h2>
            {chapter > 1 && (
              <span className="small warn">
                Chapter {chapter}: Champions and bosses have +{Math.round(rules.progression.chapterScaling * (chapter - 1) * 100)}% HP and damage
              </span>
            )}
            <span className="small muted">{enc.tagline}</span>
          </div>
          {horde.waves.map((wave, i) => {
            const goblins = wave.filter((m) => m.kind === 'goblin');
            const named = wave.filter((m) => m.kind !== 'goblin');
            return (
              <div key={i} className="stack" style={{ gap: 4 }}>
                <h3 className="small muted">
                  Wave {i + 1} · {wave.filter((m) => !m.sleeps).reduce((s, m) => s + m.hp, 0)} total HP
                </h3>
                <div className="row">
                  {goblins.length > 0 && (
                    <span className="chip">
                      {monsterIcon('goblin', game.encounter)} {goblins.length} × {monsterName('goblin', game.encounter)} ({[...new Set(goblins.map((g) => g.damage))].join('/')} dmg)
                    </span>
                  )}
                  {named.map((m) => (
                    <span key={m.id} className={`chip ${m.isWarlord ? 'warn' : ''}`}>
                      {monsterIcon(m.kind, game.encounter)} {m.name} · {m.hp} HP · {m.damage} dmg{m.isWarlord ? ' ×2 actions' : ''}
                      {m.sleeps ? ' · 💤 asleep until the final wave' : ''}
                      {m.fumbles > 0 ? ` · 💫${m.fumbles}` : ''}
                      {(m.traits ?? []).map((id) => ` · ${rules.traits[id].icon} ${rules.traits[id].name}`).join('')}
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

/** The Fumbles a Champion brings: one per few turnovers by its player. */
function FumbleNote({ m }: { m: MonsterSpec }) {
  if (m.fumbles === 0) return null;
  return (
    <span className="fumble-note on">
      {' '}
      · 💫 {m.fumbles} Fumble{m.fumbles > 1 ? 's' : ''} ({m.source?.line.tov ?? 0} TOV)
    </span>
  );
}

/** The trait a big night gives this Champion, and what it does. */
function TraitNote({ m }: { m: MonsterSpec }) {
  if (!m.traits?.length) return null;
  return (
    <>
      {m.traits.map((id) => (
        <span key={id} className="trait-note" style={{ display: 'block' }}>
          {rules.traits[id].icon} <strong>{rules.traits[id].name}:</strong> {rules.traits[id].description}
        </span>
      ))}
    </>
  );
}

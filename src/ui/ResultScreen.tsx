import type { SeasonData } from '../data/types';
import { nextWeek, type SaveGame } from '../app/game';
import { CLASSES, rules } from '../rules';
import { ClassName, weekLabel } from './common';

export function ResultScreen({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const result = game.history.at(-1)!;
  const r = result.rewards;
  const next = nextWeek(game, data);
  const wins = game.history.filter((h) => h.outcome === 'won').length;

  return (
    <div className="stack">
      <div className="card stack" style={{ borderColor: result.outcome === 'won' ? 'var(--good)' : 'var(--danger)' }}>
        <h1 className="serif">{result.outcome === 'won' ? 'Victory' : 'Defeat'}</h1>
        <p className="muted">
          {weekLabel(data, result.weekIndex)} · {result.rounds} rounds · Record {wins}–{game.history.length - wins}
        </p>
      </div>

      <div className="grid">
        <section className="card stack">
          <h2>Party progression points</h2>
          {r.partyLines.length === 0 ? (
            <p className="muted small">No party PP this week.</p>
          ) : (
            <table className="table small">
              <tbody>
                {r.partyLines.map((l) => (
                  <tr key={l.label}>
                    <td>{l.label}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      +{l.pp}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>Total</strong> <span className="muted">(split across 5 heroes)</span>
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    <strong>{r.partyTotal}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {r.spotlightLines.length > 0 && (
            <>
              <h3>Spotlight</h3>
              <table className="table small">
                <tbody>
                  {r.spotlightLines.map((l) => (
                    <tr key={l.label}>
                      <td>{l.label}</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        +{l.pp}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="card stack">
          <h2>Heroes</h2>
          <table className="table small">
            <thead>
              <tr>
                <th>Hero</th>
                <th style={{ textAlign: 'right' }}>This week</th>
                <th style={{ textAlign: 'right' }}>Total PP</th>
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => (
                <tr key={c}>
                  <td>
                    <ClassName c={c} />
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    +{r.perHero[c].toFixed(1)}
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {game.pp[c].toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">
            Spending PP on gear, talents and affinities arrives with progression (milestone 4). Each hero keeps their PP whichever player
            powers them.
          </p>
        </section>
      </div>

      <div className="sticky-bottom">
        <div className="spread">
          <span className="small muted">
            {next
              ? next.phase === 'roster'
                ? `Chapter complete: up to 3 roster moves before ${weekLabel(data, next.weekIndex)}`
                : `Next: ${weekLabel(data, next.weekIndex)}`
              : 'End of the available season.'}
          </span>
          {next && (
            <button className="btn primary" onClick={() => onChange(next)}>
              {next.phase === 'roster' ? 'Roster moves →' : 'Next week →'}
            </button>
          )}
        </div>
      </div>
      <p className="tiny faint">Rules: {rules.tiers.thresholdSource} tier thresholds.</p>
    </div>
  );
}

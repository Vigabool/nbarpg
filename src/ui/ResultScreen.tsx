import { useState } from 'react';
import type { SeasonData } from '../data/types';
import type { RewardLine } from '../engine/rewards';
import { Armory } from './Armory';
import { nextWeek, type SaveGame } from '../app/game';
import { CLASSES, rules } from '../rules';
import { ClassName, weekLabel } from './common';

export function ResultScreen({ data, game, onChange }: { data: SeasonData; game: SaveGame; onChange: (g: SaveGame) => void }) {
  const [armory, setArmory] = useState(false);
  const result = game.history.at(-1)!;
  const r = result.rewards;
  // Saves from before whole-number PP stored "spotlightLines".
  const partyLines = r.partyLines ?? [];
  const heroLines = r.heroLines ?? (r as { spotlightLines?: RewardLine[] }).spotlightLines ?? [];
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
          <h2>Progression points</h2>
          {partyLines.length === 0 && heroLines.length === 0 ? (
            <p className="muted small">No PP this week.</p>
          ) : (
            <table className="table small">
              <tbody>
                {partyLines.map((l) => (
                  <tr key={l.label}>
                    <td>
                      {l.label} <span className="muted">(every hero)</span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      +{l.pp}
                    </td>
                  </tr>
                ))}
                {heroLines.map((l) => (
                  <tr key={l.label}>
                    <td>{l.label}</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      +{l.pp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card stack">
          <div className="spread">
            <h2>Heroes</h2>
            <button className="btn small" onClick={() => setArmory(true)}>
              🛠️ Armory
            </button>
          </div>
          <table className="table small">
            <thead>
              <tr>
                <th>Hero</th>
                <th style={{ textAlign: 'right' }}>This week</th>
                <th style={{ textAlign: 'right' }}>To spend</th>
              </tr>
            </thead>
            <tbody>
              {CLASSES.map((c) => (
                <tr key={c}>
                  <td>
                    <ClassName c={c} />
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    +{Math.round(r.perHero[c] ?? 0)}
                  </td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {game.pp[c]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="tiny muted">Spend PP in the Armory on weapon upgrades, gear and feats. Each hero keeps their PP whichever player powers them.</p>
        </section>
      </div>
      {armory && <Armory game={game} onChange={onChange} onClose={() => setArmory(false)} />}

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

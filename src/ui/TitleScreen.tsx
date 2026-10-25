import { useState } from 'react';
import type { SeasonData } from '../data/types';
import { newGame, type SaveGame } from '../app/game';
import { ConfirmButton, weekLabel } from './common';
import { BUILD } from '../app/build';

export function TitleScreen({
  data,
  saved,
  onStart,
  onImport,
}: {
  data: SeasonData;
  saved: SaveGame | null;
  onStart: (g: SaveGame) => void;
  /** Opens the import dialog to load a save file. */
  onImport: () => void;
}) {
  const [week, setWeek] = useState(data.weeks[0]?.index ?? 1);
  return (
    <div className="title-screen">
      <div className="stack" style={{ maxWidth: 520, width: '100%' }}>
        <h1>NBA Fantasy RPG</h1>
        <p className="muted">
          Five heroes, each powered by a real NBA player. Their box scores power your heroes' energy; their opponents form the horde. The games deal the hand.
          You play it.
        </p>
        {saved && saved.season === data.season && (
          <button className="btn primary block" onClick={() => onStart(saved)}>
            Continue · {weekLabel(data, saved.weekIndex)}
          </button>
        )}
        <div className="card stack" style={{ textAlign: 'left' }}>
          <h2>New sandbox run · {data.season}</h2>
          <label className="stack small" style={{ gap: 4 }}>
            <span className="muted">Starting week</span>
            <select className="input" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {data.weeks.map((w) => (
                <option key={w.index} value={w.index}>
                  {weekLabel(data, w.index)} ({w.gameIds.length} games)
                </option>
              ))}
            </select>
          </label>
          <ConfirmButton
            className="btn primary"
            needsConfirm={!!saved}
            confirmLabel="Tap again: this replaces your saved run"
            onConfirm={() => onStart(newGame(data.season, week))}
          >
            Build your roster
          </ConfirmButton>
        </div>
        <button className="btn ghost" onClick={onImport}>
          Import a save file
        </button>
        <p className="tiny faint">Build {BUILD}</p>
      </div>
    </div>
  );
}

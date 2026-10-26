import { useState } from 'react';
import type { SeasonData } from '../data/types';
import { newGame, type SaveGame } from '../app/game';
import type { SeasonManifest } from '../data/manifest';
import { ConfirmButton, formatDate, weekLabel } from './common';
import { BUILD } from '../app/build';
import { rules, type Difficulty } from '../rules';
import { DifficultyPicker } from './DifficultyPicker';

export function TitleScreen({
  data,
  seasons,
  onSeason,
  saved,
  onStart,
  onImport,
}: {
  data: SeasonData;
  /** Seasons the app can load (from the manifest). */
  seasons: SeasonManifest['seasons'];
  /** Switches the loaded season. */
  onSeason: (season: string) => void;
  saved: SaveGame | null;
  onStart: (g: SaveGame) => void;
  /** Opens the import dialog to load a save file. */
  onImport: () => void;
}) {
  const live = seasons.find((s) => s.season === data.season)?.live ?? false;
  // A live run starts in the latest finished week; a replay starts at the beginning.
  const [week, setWeek] = useState((live ? data.weeks.at(-1) : data.weeks[0])?.index ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>(rules.difficulty.default);
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
        {saved && saved.season !== data.season && seasons.some((s) => s.season === saved.season) && (
          <button className="btn primary block" onClick={() => onSeason(saved.season)}>
            Continue · {saved.season} · Week {saved.weekIndex}
          </button>
        )}
        <div className="card stack" style={{ textAlign: 'left' }}>
          <h2>{live ? `New run · ${data.season}` : `New sandbox run · ${data.season}`}</h2>
          {seasons.length > 1 && (
            <label className="stack small" style={{ gap: 4 }}>
              <span className="muted">Season</span>
              <select className="input" value={data.season} onChange={(e) => onSeason(e.target.value)}>
                {seasons.map((s) => (
                  <option key={s.season} value={s.season}>
                    {s.season} · {s.live ? 'live' : 'replay'}
                  </option>
                ))}
              </select>
            </label>
          )}
          {live && data.throughDate && (
            <p className="small muted" style={{ margin: 0 }}>
              Live season: real games through {formatDate(data.throughDate)}. A new week unlocks once it's been played.
            </p>
          )}
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
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <ConfirmButton
            className="btn primary"
            needsConfirm={!!saved}
            confirmLabel="Tap again: this replaces your saved run"
            onConfirm={() => onStart(newGame(data.season, week, difficulty))}
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

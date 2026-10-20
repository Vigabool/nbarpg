import { useEffect, useState } from 'react';
import { decodeSeason, type CompactSeason } from './data/format';
import type { SeasonData } from './data/types';
import { localSaveStore } from './app/storage';
import type { SaveGame } from './app/game';
import { weekLabel } from './ui/common';
import { TitleScreen } from './ui/TitleScreen';
import { RosterBuilder } from './ui/RosterBuilder';
import { AssignHeroes } from './ui/AssignHeroes';
import { SelectGames } from './ui/SelectGames';
import { BattleScreen } from './ui/BattleScreen';
import { ResultScreen } from './ui/ResultScreen';

const SEASON = '2025-26';

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: SeasonData };

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [game, setGame] = useState<SaveGame | null>(() => localSaveStore.load());

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/${SEASON}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((c: CompactSeason) => setLoad({ status: 'ready', data: decodeSeason(c) }))
      .catch(() => setLoad({ status: 'missing' }));
  }, []);

  const update = (g: SaveGame | null) => {
    setGame(g);
    if (g) localSaveStore.save(g);
    else localSaveStore.clear();
  };

  if (load.status === 'loading') return <div className="app muted">Loading season…</div>;
  if (load.status === 'missing') return <MissingData />;
  const data = load.data;
  const active = game && game.season === data.season ? game : null;

  return (
    <div className={`app${active?.phase === 'battle' ? ' battle' : ''}`}>
      <header className="topbar">
        <span className="brand">NBA Fantasy RPG</span>
        {active && <span className="crumbs">{weekLabel(data, active.weekIndex)}</span>}
        {active && (
          <button
            className="btn ghost small"
            onClick={() => {
              if (confirm('Abandon this run and return to the title screen?')) update(null);
            }}
          >
            Quit
          </button>
        )}
      </header>
      {data.synthetic && (
        <p className="banner small" role="status">
          Synthetic test data: these players and games are not real. Run the fetch script to load the real season.
        </p>
      )}
      {!active ? (
        <TitleScreen data={data} saved={game} onStart={update} />
      ) : active.phase === 'roster' ? (
        <RosterBuilder data={data} game={active} onChange={update} />
      ) : active.phase === 'assign' ? (
        <AssignHeroes data={data} game={active} onChange={update} />
      ) : active.phase === 'select' ? (
        <SelectGames data={data} game={active} onChange={update} />
      ) : active.phase === 'battle' ? (
        <BattleScreen data={data} game={active} onChange={update} />
      ) : (
        <ResultScreen data={data} game={active} onChange={update} />
      )}
    </div>
  );
}

function MissingData() {
  return (
    <div className="app stack">
      <h1 className="serif">NBA Fantasy RPG</h1>
      <div className="card stack">
        <h2>Season data not found</h2>
        <p className="muted">The app loads <code>public/data/{SEASON}.json</code>, which is built from the raw game logs. To create it:</p>
        <ol className="muted">
          <li>
            On your computer, run <code>python3 scripts/fetch_gamelogs.py --season {SEASON}</code> (see README) and commit{' '}
            <code>data/raw/{SEASON}.json</code>.
          </li>
          <li>
            Run <code>npm run data:build</code>, then reload.
          </li>
        </ol>
      </div>
    </div>
  );
}

import { useEffect, useLayoutEffect, useState } from 'react';
import { decodeSeason, type CompactSeason } from './data/format';
import type { SeasonData } from './data/types';
import { localSaveStore } from './app/storage';
import type { SaveGame } from './app/game';
import { ConfirmButton, weekLabel } from './ui/common';
import { TitleScreen } from './ui/TitleScreen';
import { Tutorial, tutorialSeen, type TutorialTopic } from './ui/Tutorial';
import { RosterBuilder } from './ui/RosterBuilder';
import { AssignHeroes } from './ui/AssignHeroes';
import { SelectGames } from './ui/SelectGames';
import { BattleScreen } from './ui/BattleScreen';
import { ResultScreen } from './ui/ResultScreen';
import { SaveFile } from './ui/SaveFile';
import { ChooseEncounter } from './ui/ChooseEncounter';

const SEASON = '2025-26';

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; data: SeasonData };

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [game, setGame] = useState<SaveGame | null>(() => localSaveStore.load());
  const [tutorial, setTutorial] = useState<TutorialTopic | null>(() => (tutorialSeen() ? null : { tab: 'basics' }));
  const [saveFile, setSaveFile] = useState<'export' | 'import' | null>(null);

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

  // A new screen starts at the top: the week's steps, battle, results, title. Otherwise it opens
  // wherever the last screen was scrolled to.
  const screen = game ? `${game.phase}:${game.weekIndex}` : 'title';
  useLayoutEffect(() => window.scrollTo({ top: 0 }), [screen]);

  if (load.status === 'loading') return <div className="app muted">Loading season…</div>;
  if (load.status === 'missing') return <MissingData />;
  const data = load.data;
  const active = game && game.season === data.season ? game : null;

  return (
    <div className={`app${active?.phase === 'battle' ? ' battle' : ''}`}>
      {active?.phase !== 'battle' && (
        <header className="topbar">
          <span className="brand">NBA Fantasy RPG</span>
          {active && <span className="crumbs">{weekLabel(data, active.weekIndex)}</span>}
          <div className="row">
            <button className="btn ghost small" onClick={() => setTutorial({ tab: 'basics' })}>
              How to play
            </button>
            <button className="btn ghost small" onClick={() => setTutorial({ tab: 'classes' })}>
              Guide
            </button>
            {active && (
              <button className="btn ghost small" onClick={() => setSaveFile('export')}>
                Save file
              </button>
            )}
            {active && (
              <ConfirmButton className="btn ghost small" confirmLabel="Tap again to abandon run" onConfirm={() => update(null)}>
                Quit
              </ConfirmButton>
            )}
          </div>
        </header>
      )}
      {saveFile && (
        <SaveFile
          data={data}
          game={active}
          mode={saveFile}
          onImport={(g) => {
            setSaveFile(null);
            update(g);
          }}
          onClose={() => setSaveFile(null)}
        />
      )}
      {tutorial && <Tutorial key={JSON.stringify(tutorial)} topic={tutorial} onClose={() => setTutorial(null)} />}
      {data.synthetic && (
        <p className="banner small" role="status">
          Synthetic test data: these players and games are not real. Run the fetch script to load the real season.
        </p>
      )}
      {!active ? (
        <TitleScreen data={data} saved={game} onStart={update} onImport={() => setSaveFile('import')} />
      ) : active.phase === 'roster' ? (
        <RosterBuilder data={data} game={active} onChange={update} />
      ) : active.phase === 'encounter' ? (
        <ChooseEncounter data={data} game={active} onChange={update} onHelp={setTutorial} />
      ) : active.phase === 'assign' ? (
        <AssignHeroes data={data} game={active} onChange={update} />
      ) : active.phase === 'select' ? (
        <SelectGames data={data} game={active} onChange={update} />
      ) : active.phase === 'battle' ? (
        <BattleScreen data={data} game={active} onChange={update} onHelp={(topic) => setTutorial(topic ?? { tab: 'basics' })} onQuit={() => update(null)} />
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
        <p className="muted">
          The app loads <code>public/data/{SEASON}.json</code>, which is built from the raw game logs. To create it:
        </p>
        <ol className="muted">
          <li>
            On your computer, run <code>python3 scripts/fetch_gamelogs.py --season {SEASON}</code> (see README) and commit <code>data/raw/{SEASON}.json</code>.
          </li>
          <li>
            Run <code>npm run data:build</code>, then reload.
          </li>
        </ol>
      </div>
    </div>
  );
}

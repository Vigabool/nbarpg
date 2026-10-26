import { useEffect, useLayoutEffect, useState } from 'react';
import { decodeSeason, type CompactSeason } from './data/format';
import type { SeasonData } from './data/types';
import { formView } from './data/form';
import { FALLBACK_MANIFEST, type SeasonManifest } from './data/manifest';
import { localSaveStore } from './app/storage';
import { chapterStartWeek, type SaveGame } from './app/game';
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

type Load = { status: 'loading' } | { status: 'missing'; season: string } | { status: 'ready'; data: SeasonData };

const getJson = <T,>(path: string): Promise<T> =>
  fetch(`${import.meta.env.BASE_URL}${path}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

export default function App() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [game, setGame] = useState<SaveGame | null>(() => localSaveStore.load());
  const [tutorial, setTutorial] = useState<TutorialTopic | null>(() => (tutorialSeen() ? null : { tab: 'basics' }));
  const [saveFile, setSaveFile] = useState<'export' | 'import' | null>(null);
  const [manifest, setManifest] = useState<SeasonManifest | null>(null);
  // The season on screen: a saved run's season if it's still available, otherwise the live one.
  const [season, setSeason] = useState<string | null>(null);

  useEffect(() => {
    getJson<SeasonManifest>('data/seasons.json')
      .catch(() => FALLBACK_MANIFEST)
      .then((m) => {
        setManifest(m);
        const saved = localSaveStore.load()?.season;
        setSeason(saved && m.seasons.some((x) => x.season === saved) ? saved : m.current);
      });
  }, []);

  useEffect(() => {
    if (!season) return;
    setLoad({ status: 'loading' });
    getJson<CompactSeason>(`data/${season}.json`)
      .then((c) => setLoad({ status: 'ready', data: decodeSeason(c) }))
      .catch(() => setLoad({ status: 'missing', season }));
  }, [season]);

  const update = (g: SaveGame | null) => {
    setGame(g);
    if (g) localSaveStore.save(g);
    else {
      localSaveStore.clear();
      // With the run over, new runs default to the live season again.
      if (manifest) setSeason(manifest.current);
    }
  };

  // A new screen starts at the top: the week's steps, battle, results, title. Otherwise it opens
  // wherever the last screen was scrolled to.
  const screen = game ? `${game.phase}:${game.weekIndex}` : 'title';
  // Braces matter: an effect must return nothing or a cleanup, and in some hosts (the claude.ai
  // artifact frame) scrollTo returns a value React would then try to call.
  useLayoutEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  if (load.status === 'loading') return <div className="app muted">Loading season…</div>;
  if (load.status === 'missing') return <MissingData season={load.season} />;
  const full = load.data;
  const active = game && game.season === full.season ? game : null;
  // Ratings (salary, season tier, gear) are fixed at the chapter's first week; see src/data/form.ts.
  const data = active ? formView(full, chapterStartWeek(active)) : full;

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
        <TitleScreen
          key={data.season}
          data={data}
          seasons={manifest?.seasons ?? []}
          onSeason={setSeason}
          saved={game}
          onStart={update}
          onImport={() => setSaveFile('import')}
        />
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

function MissingData({ season: SEASON }: { season: string }) {
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
            Fetch the games: <code>npx tsx scripts/fetch-cdn.ts --season {SEASON}</code> (the scheduled Refresh season data workflow does this), or{' '}
            <code>python3 scripts/fetch_gamelogs.py --season {SEASON}</code> on your computer (see README). Commit <code>data/raw/{SEASON}.json</code>.
          </li>
          <li>
            Run <code>npm run data:build</code>, then reload.
          </li>
        </ol>
      </div>
    </div>
  );
}

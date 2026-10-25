import { useEffect, useMemo, useRef, useState } from 'react';
import type { SeasonData } from '../data/types';
import type { SaveGame } from '../app/game';
import { exportFileName, exportSave, importSave, SaveError } from '../app/saves';
import { ConfirmButton, weekLabel } from './common';

/** Keep a run outside the browser: download or copy it, and load it back from a file or pasted text. */
export function SaveFile({
  data,
  game,
  mode,
  onImport,
  onClose,
}: {
  data: SeasonData;
  /** The run in progress (exported, or replaced by an import). */
  game: SaveGame | null;
  mode: 'export' | 'import';
  onImport: (g: SaveGame) => void;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="save-title" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2 id="save-title">{mode === 'export' ? '💾 Save file' : '📂 Import a save'}</h2>
          <button ref={closeRef} className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body stack">
          {mode === 'export' && game ? <Export data={data} game={game} /> : <Import data={data} replacing={!!game} onImport={onImport} />}
        </div>
      </div>
    </div>
  );
}

function Export({ data, game }: { data: SeasonData; game: SaveGame }) {
  const text = useMemo(() => exportSave(game), [game]);
  const [status, setStatus] = useState('');
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(game);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus('Downloaded.');
  };
  const copy = () =>
    navigator.clipboard
      .writeText(text)
      .then(() => setStatus('Copied. Paste it somewhere safe.'))
      .catch(() => setStatus("Couldn't copy here: select the text below and copy it."));
  return (
    <>
      <p className="muted small">
        Your run is saved in this browser. Keep a copy of {weekLabel(data, game.weekIndex)} so clearing site data or switching devices doesn't lose it, then
        load it back with Import on the title screen.
      </p>
      <div className="row">
        <button className="btn primary" onClick={download}>
          Download file
        </button>
        <button className="btn" onClick={copy}>
          Copy text
        </button>
      </div>
      {status && (
        <p className="small" role="status">
          {status}
        </p>
      )}
      <textarea className="input mono tiny" readOnly rows={5} value={text} aria-label="Save file contents" onFocus={(e) => e.currentTarget.select()} />
    </>
  );
}

function Import({ data, replacing, onImport }: { data: SeasonData; replacing: boolean; onImport: (g: SaveGame) => void }) {
  const [text, setText] = useState('');
  const parsed = useMemo((): { game?: SaveGame; error?: string } => {
    if (!text.trim()) return {};
    try {
      const game = importSave(text);
      if (game.season !== data.season) return { error: `That save is for the ${game.season} season; this game is playing ${data.season}.` };
      return { game };
    } catch (e) {
      return { error: e instanceof SaveError ? e.message : 'Not a save file.' };
    }
  }, [text, data.season]);
  const g = parsed.game;
  return (
    <>
      <p className="muted small">Choose a save file you downloaded, or paste its text.</p>
      <input
        type="file"
        accept=".json,application/json"
        className="small"
        aria-label="Save file"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (f) void f.text().then(setText);
        }}
      />
      <textarea
        className="input mono tiny"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="…or paste the save here"
        aria-label="Save text"
      />
      {parsed.error && (
        <p className="small warn" role="alert">
          {parsed.error}
        </p>
      )}
      {g && (
        <div className="card stack small">
          <strong>{weekLabel(data, g.weekIndex)}</strong>
          <span className="muted">
            {g.roster.length} players · {g.history.length} {g.history.length === 1 ? 'battle' : 'battles'} played ·{' '}
            {Object.values(g.pp).reduce((t, n) => t + n, 0)} PP unspent
          </span>
          <ConfirmButton
            className="btn primary"
            needsConfirm={replacing}
            confirmLabel="Tap again: this replaces your current run"
            onConfirm={() => onImport(g)}
          >
            Load this save
          </ConfirmButton>
        </div>
      )}
    </>
  );
}

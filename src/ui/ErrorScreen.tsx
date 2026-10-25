import { Component, useState, type ReactNode } from 'react';
import { errorReport } from '../app/errorReport';
import { exportFileName, exportSave } from '../app/saves';
import { localSaveStore } from '../app/storage';
import { ConfirmButton } from './common';

/** Browser noise that isn't a bug in the game. */
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/];

interface State {
  error: Error | null;
  /** Bumped by "Try again" to remount the app from scratch. */
  attempt: number;
}

/**
 * Crash safety net: anything that throws, while drawing a screen or from a button, lands here
 * instead of a blank page. The player can retry, restart the week's battle, download their save
 * and copy a report to send, or start over.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    window.addEventListener('error', this.onError);
    window.addEventListener('unhandledrejection', this.onRejection);
  }

  componentWillUnmount() {
    window.removeEventListener('error', this.onError);
    window.removeEventListener('unhandledrejection', this.onRejection);
  }

  // React boundaries only see errors while rendering; button handlers (performAction and the like) throw here.
  private onError = (ev: ErrorEvent) => this.show(ev.error instanceof Error ? ev.error : new Error(ev.message));
  private onRejection = (ev: PromiseRejectionEvent) => this.show(ev.reason instanceof Error ? ev.reason : new Error(String(ev.reason)));
  private show(error: Error) {
    if (IGNORED.some((re) => re.test(error.message)) || this.state.error) return;
    this.setState({ error });
  }

  private retry = () => this.setState((s) => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (!this.state.error) return <div key={this.state.attempt}>{this.props.children}</div>;
    return <ErrorScreen error={this.state.error} onRetry={this.retry} />;
  }
}

function ErrorScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [save] = useState(() => localSaveStore.load());
  const [status, setStatus] = useState('');
  const report = errorReport(error, save);
  const inBattle = save?.phase === 'battle';

  const copy = () =>
    navigator.clipboard
      .writeText(report)
      .then(() => setStatus('Report copied. Paste it in a message, with your save file if you can.'))
      .catch(() => setStatus("Couldn't copy here: select the report below and copy it."));
  const download = () => {
    if (!save) return;
    const url = URL.createObjectURL(new Blob([exportSave(save)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFileName(save);
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restartBattle = () => {
    if (!save) return;
    localSaveStore.save({ ...save, phase: 'select', battle: null, battlePools: null });
    onRetry();
  };
  const startOver = () => {
    localSaveStore.clear();
    onRetry();
  };

  return (
    <div className="app">
      <div className="stack" style={{ maxWidth: 560, margin: '0 auto', paddingTop: 24 }}>
        <h1>Something went wrong</h1>
        <p className="muted">
          The game hit an error. Your run is saved as of your last action. Try again first; if it keeps happening, send the report below
          {save ? ' and your save file' : ''} so it can be fixed.
        </p>
        <div className="card stack">
          <button className="btn primary" onClick={onRetry}>
            Try again
          </button>
          {inBattle && (
            <ConfirmButton className="btn" confirmLabel="Tap again: this week's battle starts over" onConfirm={restartBattle}>
              Restart this week's battle
            </ConfirmButton>
          )}
          <div className="row">
            <button className="btn" onClick={copy}>
              Copy error report
            </button>
            {save && (
              <button className="btn" onClick={download}>
                Download save file
              </button>
            )}
          </div>
          {status && (
            <p className="small" role="status">
              {status}
            </p>
          )}
          {save && (
            <ConfirmButton className="btn ghost small" confirmLabel="Tap again: this deletes your run (download the save first)" onConfirm={startOver}>
              Start a new run
            </ConfirmButton>
          )}
        </div>
        <details>
          <summary className="small muted">Error report</summary>
          <textarea className="input mono tiny" readOnly rows={12} value={report} aria-label="Error report" onFocus={(e) => e.currentTarget.select()} />
        </details>
      </div>
    </div>
  );
}

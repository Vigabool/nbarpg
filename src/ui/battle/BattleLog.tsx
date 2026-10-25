import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine/combat';

export const isRoundStart = (l: LogEntry) => l.side === 'system' && /^Round \d+ begins/.test(l.text);

export function Ticker({ log, onOpen }: { log: LogEntry[]; onOpen: () => void }) {
  const last = [...log].reverse().find((l) => !isRoundStart(l));
  return (
    <button className="ticker" onClick={onOpen} aria-label="Open battle log" data-coach="log">
      <span className={`ticker-text ${last?.side ?? ''}`}>{last ? last.text : 'The battle begins.'}</span>
      <span className="ticker-more">Log ›</span>
    </button>
  );
}

export function LogDrawer({ log, onClose }: { log: LogEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-backdrop drawer" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Battle log" onClick={(e) => e.stopPropagation()}>
        <div className="spread">
          <h2>Battle log</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="log modal-body" ref={ref}>
          {log.map((l, i) => (
            <div key={i} className={l.side}>
              <span className="faint num">R{l.round}</span> {l.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

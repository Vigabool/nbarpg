import { useState, type ReactNode } from 'react';
import { coachUnseen, markCoachSeen } from '../app/coach';

/** A one-time "what's this step?" note on a setup screen, dismissed for good with Got it. */
export function SetupBanner({ id, children }: { id: string; children: ReactNode }) {
  const [show, setShow] = useState(() => coachUnseen(id));
  if (!show) return null;
  return (
    <div className="setup-banner" role="note">
      <span className="small">{children}</span>
      <button
        className="btn ghost small"
        onClick={() => {
          markCoachSeen(id);
          setShow(false);
        }}
      >
        Got it
      </button>
    </div>
  );
}

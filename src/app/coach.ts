/**
 * Coach marks and setup banners: which first-time tips this browser has already seen. Stored per
 * browser, not per save, so a new run doesn't repeat them; "Replay the walkthrough" resets them.
 */
const KEY = 'nbarpg.coach';

interface CoachStore {
  seen: string[];
  /** "Skip tips": no more coach marks or banners until the walkthrough is replayed. */
  off: boolean;
}

function read(): CoachStore {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<CoachStore>) : {};
    return { seen: Array.isArray(v.seen) ? v.seen : [], off: !!v.off };
  } catch {
    return { seen: [], off: false };
  }
}

function write(v: CoachStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // Storage blocked: tips just show again next time.
  }
}

/** Tips still to show: not seen, and tips not switched off. */
export function coachUnseen(id: string): boolean {
  const v = read();
  return !v.off && !v.seen.includes(id);
}

export function markCoachSeen(id: string) {
  const v = read();
  if (!v.seen.includes(id)) write({ ...v, seen: [...v.seen, id] });
}

export function skipCoach() {
  write({ ...read(), off: true });
}

/** Turns every tip back on. */
export function resetCoach() {
  write({ seen: [], off: false });
}

/** True once any tip has been seen or tips were skipped (so "Replay the walkthrough" makes sense). */
export function coachStarted(): boolean {
  const v = read();
  return v.off || v.seen.length > 0;
}

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

/** Battle walkthrough tips (and the rewards tip) by id prefix. */
const isBattleTip = (id: string) => id.startsWith('battle-') || id.startsWith('result-');

/** The battle walkthrough will show (some battle tip unseen, tips not switched off). */
export function walkthroughOn(battleTipIds: string[]): boolean {
  const v = read();
  return !v.off && battleTipIds.some((id) => !v.seen.includes(id));
}

/** Turns the battle walkthrough on (from the start) or off, leaving the setup banners as they are. */
export function setWalkthrough(on: boolean, battleTipIds: string[]) {
  const v = read();
  const others = v.seen.filter((id) => !isBattleTip(id));
  write(on ? { seen: others, off: false } : { seen: [...others, ...battleTipIds], off: v.off });
}

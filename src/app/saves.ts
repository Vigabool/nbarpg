import { CLASSES, emptyProgress, rules, type HeroClass, type HeroProgress } from '../rules';
import type { SaveGame } from './game';

/**
 * Save versions. Each save records the version it was written with; loading runs it through
 * every migration step from that version up to the current one. To change the save format,
 * bump SAVE_VERSION, add a step that turns the previous version into the new one, and add a
 * test that loads a save of the previous version (tests/saves.test.ts).
 */
export const SAVE_VERSION = 3;

/** A save of any version, as read from storage or a file. */
type AnySave = Record<string, unknown> & { version?: number };

/** MIGRATIONS[n] turns a version-n save into a version-(n+1) save. */
const MIGRATIONS: Record<number, (save: AnySave) => AnySave> = {
  // 1 → 2, progression: whole-number PP and an Armory record per hero.
  1(save) {
    const pp = (save.pp ?? {}) as Partial<Record<HeroClass, number>>;
    const progress = (save.progress ?? {}) as Partial<Record<HeroClass, Partial<HeroProgress>>>;
    return {
      ...save,
      version: 2,
      pp: Object.fromEntries(CLASSES.map((c) => [c, Math.round(pp[c] ?? 0)])),
      progress: Object.fromEntries(CLASSES.map((c) => [c, { ...emptyProgress(), ...(progress[c] ?? {}) }])),
    };
  },
  // 2 → 3, gold: the starting purse, no extra cap room, no ten-day contracts.
  2: (save) => ({ ...save, version: 3, gold: rules.salary.gold.starting, capBonus: 0, tenDay: [] }),
};

export class SaveError extends Error {}

/** Brings a save of any earlier version up to date. Throws SaveError if it isn't a save or is from a newer version. */
export function migrateSave(raw: unknown): SaveGame {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new SaveError('Not a save file.');
  let save = raw as AnySave;
  if (typeof save.season !== 'string' || typeof save.weekIndex !== 'number' || !Array.isArray(save.roster)) throw new SaveError('Not a save file.');
  let version = typeof save.version === 'number' ? save.version : 1;
  if (version > SAVE_VERSION) throw new SaveError('This save is from a newer version of the game.');
  for (; version < SAVE_VERSION; version++) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveError(`Can't upgrade a version ${version} save.`);
    save = step(save);
  }
  return save as unknown as SaveGame;
}

/** File contents for exporting a save. */
export function exportSave(game: SaveGame): string {
  return JSON.stringify({ app: 'nbarpg', exportedAt: new Date().toISOString(), save: game });
}

/** Reads an exported save (or a bare save), upgrading it if it's from an earlier version. */
export function importSave(text: string): SaveGame {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SaveError('Not a save file.');
  }
  const wrapped = parsed && typeof parsed === 'object' && (parsed as { app?: unknown }).app === 'nbarpg';
  return migrateSave(wrapped ? (parsed as { save: unknown }).save : parsed);
}

/** A file name for an exported save, e.g. "nbarpg-2025-26-week-7.json". */
export function exportFileName(game: SaveGame): string {
  return `nbarpg-${game.season}-week-${game.weekIndex}.json`;
}

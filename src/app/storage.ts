import type { SaveGame } from './game';
import { migrateSave } from './saves';

/**
 * Persistence boundary. The MVP keeps one local save in localStorage; an
 * account-backed store can implement the same interface later.
 */
export interface SaveStore {
  load(): SaveGame | null;
  save(game: SaveGame): void;
  clear(): void;
}

const KEY = 'nbarpg.save.v1';

export const localSaveStore: SaveStore = {
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? migrateSave(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  },
  save(game) {
    try {
      localStorage.setItem(KEY, JSON.stringify(game));
    } catch {
      // Storage may be full or blocked; the game still works for this session.
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
  },
};

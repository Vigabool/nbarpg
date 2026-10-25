import { describe, expect, it } from 'vitest';
import { chapterOf, newGame, progressOf } from '../src/app/game';
import { exportSave, importSave, migrateSave, SAVE_VERSION, SaveError } from '../src/app/saves';
import { emptyProgress } from '../src/rules';

/** A save as version 1 (before progression) wrote it: fractional PP, no Armory. Keep it frozen. */
const V1_SAVE = {
  version: 1,
  season: '2025-26',
  weekIndex: 6,
  phase: 'select',
  roster: [1, 2, 3, 4, 5, 6],
  chapterRoster: [1, 2, 3, 4, 5],
  assignments: { warrior: 1, ranger: 2, cleric: 3, rogue: 4, wizard: 5 },
  gamePicks: {},
  battle: null,
  battlePools: null,
  encounter: 'crypt',
  pp: { warrior: 12.4, ranger: 7.5, cleric: 3, rogue: 0.2, wizard: 9.9 },
  history: [{ weekIndex: 5, outcome: 'won', rounds: 6 }],
};

describe('save versions', () => {
  it('new games are written at the current version', () => {
    expect(newGame('2025-26', 1).version).toBe(SAVE_VERSION);
  });

  it('a version 1 save loads: whole-number PP and an empty Armory, everything else kept', () => {
    const g = migrateSave(structuredClone(V1_SAVE));
    expect(g.version).toBe(SAVE_VERSION);
    expect(g.pp).toEqual({ warrior: 12, ranger: 8, cleric: 3, rogue: 0, wizard: 10 });
    for (const c of ['warrior', 'ranger', 'cleric', 'rogue', 'wizard'] as const) expect(progressOf(g, c)).toEqual(emptyProgress());
    expect(g.assignments).toEqual(V1_SAVE.assignments);
    expect(g.encounter).toBe('crypt');
    expect(chapterOf(g)).toBe(1);
  });

  it('a save with no version counts as version 1', () => {
    const { version: _, ...unversioned } = structuredClone(V1_SAVE);
    expect(migrateSave(unversioned).pp.warrior).toBe(12);
  });

  it('a current save loads unchanged', () => {
    const g = { ...newGame('2025-26', 3), pp: { warrior: 40, ranger: 0, cleric: 0, rogue: 0, wizard: 0 } };
    expect(migrateSave(structuredClone(g))).toEqual(g);
  });

  it('refuses saves from a newer version and things that are not saves', () => {
    expect(() => migrateSave({ ...newGame('2025-26', 1), version: SAVE_VERSION + 1 })).toThrow(SaveError);
    for (const junk of [null, 42, 'save', [], { hello: 'world' }]) expect(() => migrateSave(junk)).toThrow(SaveError);
  });
});

describe('export and import', () => {
  it('round-trips a save', () => {
    const g = { ...newGame('2025-26', 4), roster: [7, 8, 9] };
    expect(importSave(exportSave(g))).toEqual(g);
  });

  it('imports an old exported save, upgrading it', () => {
    const file = JSON.stringify({ app: 'nbarpg', exportedAt: '2026-01-01T00:00:00Z', save: V1_SAVE });
    expect(importSave(file).version).toBe(SAVE_VERSION);
  });

  it('also takes a bare save, and rejects anything else', () => {
    expect(importSave(JSON.stringify(V1_SAVE)).weekIndex).toBe(6);
    expect(() => importSave('not json')).toThrow(SaveError);
    expect(() => importSave(JSON.stringify({ app: 'nbarpg', save: { nope: true } }))).toThrow(SaveError);
  });
});

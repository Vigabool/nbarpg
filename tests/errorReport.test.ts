import { describe, expect, it } from 'vitest';
import { newGame } from '../src/app/game';
import { errorReport } from '../src/app/errorReport';
import { battle, monster } from './helpers';

describe('error report', () => {
  it('names the error, the build and where in the run it happened', () => {
    const b = battle([[monster()], [monster()]]);
    const save = { ...newGame('2025-26', 7), phase: 'battle' as const, encounter: 'crypt', battle: b };
    const r = errorReport(new Error('Boom'), save);
    expect(r).toContain('Error: Boom');
    expect(r).toMatch(/Build: \S+/);
    expect(r).toContain('Phase: battle · week 7 · encounter crypt');
    expect(r).toContain('Battle: round 1, wave 1/2, heroes standing 5/5');
  });

  it('works with no saved run', () => {
    expect(errorReport(new Error('Early'), null)).toContain('No saved run');
  });
});

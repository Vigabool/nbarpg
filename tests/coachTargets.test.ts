import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BATTLE_TIPS, RESULT_TIPS } from '../src/ui/coachTips';

/** Every UI source file's text. */
function uiSource(dir = 'src/ui'): string {
  return readdirSync(dir, { withFileTypes: true })
    .map((f) => (f.isDirectory() ? uiSource(join(dir, f.name)) : /\.tsx?$/.test(f.name) ? readFileSync(join(dir, f.name), 'utf8') : ''))
    .join('\n');
}

describe('coach tips still point at something', () => {
  it('every tip target is marked in the UI (a UI change that drops one fails here)', () => {
    const src = uiSource();
    for (const t of [...BATTLE_TIPS, ...RESULT_TIPS]) {
      const name = t.target.match(/^\[data-coach="([\w-]+)"\]$/)?.[1];
      expect(name, `${t.id} target ${t.target}`).toBeDefined();
      expect(src.includes(`data-coach="${name}"`) || src.includes(`'${name}'`), `${t.id}: no element with data-coach="${name}"`).toBe(true);
    }
  });
});

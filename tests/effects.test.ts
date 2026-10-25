import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((f) =>
    f.isDirectory() ? files(join(dir, f.name)) : /\.tsx?$/.test(f.name) ? [join(dir, f.name)] : [],
  );
}

describe('React effects', () => {
  it('never return a value by accident: "useEffect(() => fn())" returns fn’s result, which React calls as a cleanup', () => {
    // A browser's scrollTo/focus return undefined, so this hides in testing, but the claude.ai
    // artifact frame's scrollTo returns a value and crashed the game ("l is not a function").
    const offenders = files('src').flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, at: `${f}:${i + 1}` }))
        .filter(({ line }) => /use(Layout)?Effect\(\(\) => [^{]/.test(line))
        .map(({ at }) => at),
    );
    expect(offenders).toEqual([]);
  });
});

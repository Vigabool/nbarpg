import { describe, expect, it } from 'vitest';
import { buildSeason } from '../src/data/build';
import { simulateSeasons } from '../scripts/season-lib';
import { makeSyntheticSeason } from './fixtures/synthetic';

const data = buildSeason(makeSyntheticSeason({ teams: 12, weeks: 9, seed: 5 }));

describe('season simulator', () => {
  it('plays every week and spends PP as it goes', () => {
    const weeks = simulateSeasons(data, 1, 'greedy');
    expect(weeks.length).toBe(data.weeks.length);
    expect(weeks.at(-1)!.chapter).toBe(3);
    expect(weeks.at(-1)!.spentPerHero).toBeGreaterThan(0);
    expect(simulateSeasons(data, 1, 'none').at(-1)!.spentPerHero).toBe(0);
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { decodeSeason, type CompactSeason } from '../src/data/format';
import type { SeasonData } from '../src/data/types';

export function loadSeasonFile(season = '2025-26'): SeasonData {
  const path = `public/data/${season}.json`;
  if (!existsSync(path)) {
    console.error(`No ${path}. Run \`npm run data:build\` first.`);
    process.exit(1);
  }
  return decodeSeason(JSON.parse(readFileSync(path, 'utf8')) as CompactSeason);
}

/**
 * Turns the raw game log from scripts/fetch_gamelogs.py into the compact file
 * the app loads (public/data/<season>.json).
 *
 *   npm run data:build                       # data/raw/2025-26.json
 *   npm run data:build -- --raw <path>       # any raw file
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSeason } from '../src/data/build';
import { encodeSeason } from '../src/data/format';
import type { RawGameLog } from '../src/data/types';

const args = process.argv.slice(2);
const rawPath = args.includes('--raw') ? args[args.indexOf('--raw') + 1] : 'data/raw/2025-26.json';

if (!existsSync(rawPath)) {
  console.error(`No raw data at ${rawPath}. Run scripts/fetch_gamelogs.py first (see README).`);
  process.exit(1);
}
const raw = JSON.parse(readFileSync(rawPath, 'utf8')) as RawGameLog;
const season = buildSeason(raw);
mkdirSync('public/data', { recursive: true });
const out = `public/data/${season.season}.json`;
writeFileSync(out, JSON.stringify(encodeSeason(season)));
console.log(
  `${season.synthetic ? '[SYNTHETIC] ' : ''}Wrote ${out}: ${Object.keys(season.games).length} games, ` +
    `${Object.keys(season.players).length} players, ${season.weeks.length} weeks`,
);

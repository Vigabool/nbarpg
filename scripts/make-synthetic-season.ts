/**
 * Writes a synthetic season to data/synthetic/2025-26.json for local testing
 * before real data is fetched. Build it with:
 *   npm run data:build -- --raw data/synthetic/2025-26.json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { makeSyntheticSeason } from '../tests/fixtures/synthetic';

mkdirSync('data/synthetic', { recursive: true });
const raw = makeSyntheticSeason();
writeFileSync('data/synthetic/2025-26.json', JSON.stringify(raw));
console.log(`Wrote ${raw.rows.length} synthetic lines to data/synthetic/2025-26.json`);

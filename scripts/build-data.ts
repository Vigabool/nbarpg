/**
 * Turns the raw game logs (scripts/fetch-cdn.ts or scripts/fetch_gamelogs.py) into the compact
 * files the app loads (public/data/<season>.json), plus public/data/seasons.json listing them.
 * A live season carries each player's last games from the two seasons before it (when they're in
 * data/raw/) for the form window (src/data/form.ts).
 *
 *   npm run data:build                                 # every data/raw/<season>.json
 *   npm run data:build -- --raw <path> [--prior <path>]… # one raw file; priors most recent first
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildSeason } from '../src/data/build';
import { encodeSeason } from '../src/data/format';
import type { SeasonManifest } from '../src/data/manifest';
import type { RawGameLog } from '../src/data/types';

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as RawGameLog;

/** "2026-27" → "2025-26". */
export function previousSeason(season: string): string {
  const y = Number(season.slice(0, 4)) - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

/** How far back the form window may reach: last season, and the one before for a player who missed most of it. */
const LOOKBACK = 2;

const rawArg = arg('--raw');
const jobs: { raw: string; priors: string[] }[] = rawArg
  ? [{ raw: rawArg, priors: args.flatMap((a, i) => (args[i - 1] === '--prior' ? [a] : [])) }]
  : existsSync('data/raw')
    ? readdirSync('data/raw')
        .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
        .sort()
        .map((f) => {
          // Only a live season (one the CDN fetcher wrote) rates players on form. Finished seasons
          // keep whole-season averages, so the simulators and golden baseline on 2025-26 hold still.
          const live = !!read(`data/raw/${f}`).throughDate;
          const priors: string[] = [];
          for (let s = f.slice(0, 7), i = 0; live && i < LOOKBACK; i++) {
            s = previousSeason(s);
            if (existsSync(`data/raw/${s}.json`)) priors.push(`data/raw/${s}.json`);
          }
          return { raw: `data/raw/${f}`, priors };
        })
    : [];

if (!jobs.length || !jobs.every((j) => existsSync(j.raw))) {
  console.error(`No raw data${rawArg ? ` at ${rawArg}` : ' in data/raw/'}. Run scripts/fetch-cdn.ts or scripts/fetch_gamelogs.py first (see README).`);
  process.exit(1);
}

mkdirSync('public/data', { recursive: true });
const built: SeasonManifest['seasons'] = [];
for (const job of jobs) {
  const season = buildSeason(read(job.raw), job.priors.map(read));
  const out = `public/data/${season.season}.json`;
  writeFileSync(out, JSON.stringify(encodeSeason(season)));
  built.push({
    season: season.season,
    live: !!season.throughDate,
    weeks: season.weeks.length,
    ...(season.throughDate ? { throughDate: season.throughDate } : {}),
  });
  console.log(
    `${season.synthetic ? '[SYNTHETIC] ' : ''}Wrote ${out}: ${Object.keys(season.games).length} games, ` +
      `${Object.keys(season.players).length} players, ${season.weeks.length} weeks` +
      (season.prior ? `, form from ${season.prior.season}` : '') +
      (season.throughDate ? `, through ${season.throughDate}` : ''),
  );
}

// Newest first; new runs start in the newest season. A live season joins the list once its first
// week is over.
const seasons = built.filter((s) => s.weeks > 0).sort((a, b) => b.season.localeCompare(a.season));
if (!seasons.length) {
  console.error('No season has a finished week yet.');
  process.exit(1);
}
const manifest: SeasonManifest = { current: seasons[0].season, seasons };
writeFileSync('public/data/seasons.json', JSON.stringify(manifest));
console.log(`Wrote public/data/seasons.json: ${seasons.map((s) => `${s.season}${s.live ? ' (live)' : ''}`).join(', ')}`);

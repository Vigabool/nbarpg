/**
 * Fetches the current season's regular-season box scores from the NBA's public CDN into
 * data/raw/<season>.json, the same format scripts/fetch_gamelogs.py writes. Unlike stats.nba.com,
 * the CDN usually answers cloud servers, so the scheduled Refresh season data workflow
 * (.github/workflows/refresh-data.yml) runs this.
 *
 *   npx tsx scripts/fetch-cdn.ts                    # the season the schedule is on
 *   npx tsx scripts/fetch-cdn.ts --refresh-days 7   # also refetch the last 7 days (stat corrections)
 *
 * It only downloads games it doesn't have yet, plus the last few days' games again. It records
 * `throughDate`, the last day whose games are all final; the build leaves later weeks out.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { RawGameLog } from '../src/data/types';
import { COLUMNS, FINAL, SCHEDULE_URL, addDays, boxscoreRows, boxscoreUrl, easternToday, mergeRows, parseSchedule, throughDate } from './cdn-lib';

const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const refreshDays = Number(arg('--refresh-days') ?? 3);

const HEADERS = { 'User-Agent': 'Mozilla/5.0 (nbarpg data refresh)', Referer: 'https://www.nba.com/', Accept: 'application/json' };

async function getJson(url: string, retries = 4): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      if (attempt >= retries) throw new Error(`Could not fetch ${url}: ${(err as Error).message}`);
      const wait = 2 ** (attempt + 1);
      console.error(`${url}: ${(err as Error).message}; retrying in ${wait}s`);
      await new Promise((res) => setTimeout(res, wait * 1000));
    }
  }
}

async function main() {
  const schedule = parseSchedule(await getJson(SCHEDULE_URL));
  const season = arg('--season') ?? schedule.season;
  if (season !== schedule.season) throw new Error(`The CDN schedule is for ${schedule.season}, not ${season}.`);

  const out = arg('--out') ?? `data/raw/${season}.json`;
  const existing = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as RawGameLog) : null;
  if (existing && existing.headers.join() !== COLUMNS.join()) throw new Error(`${out} has different columns; move it aside first.`);
  const have = new Set((existing?.rows ?? []).map((r) => String(r[COLUMNS.indexOf('GAME_ID')])));

  const today = easternToday();
  const recent = addDays(today, -refreshDays);
  const final = schedule.games.filter((g) => g.status === FINAL);
  const todo = final.filter((g) => !have.has(g.gameId) || g.date >= recent);
  console.log(`${season}: ${final.length} final regular-season games, fetching ${todo.length} box scores`);

  const fresh = new Map<string, (string | number)[][]>();
  const queue = [...todo];
  // A few at a time: polite to the CDN, and a full season still takes only a few minutes.
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let g = queue.shift(); g; g = queue.shift()) fresh.set(g.gameId, boxscoreRows(await getJson(boxscoreUrl(g.gameId)), g.date));
    }),
  );

  const rows = mergeRows(existing, fresh);
  const payload: RawGameLog = {
    season,
    source: 'cdn.nba.com schedule and box scores (Regular Season)',
    fetchedAt: new Date().toISOString().replace(/\.\d+Z$/, '+00:00'),
    throughDate: throughDate(schedule.games, today),
    headers: COLUMNS,
    rows,
  };
  mkdirSync('data/raw', { recursive: true });
  writeFileSync(out, JSON.stringify(payload));
  const games = new Set(rows.map((r) => r[COLUMNS.indexOf('GAME_ID')])).size;
  console.log(`Wrote ${rows.length} player lines from ${games} games to ${out} (complete through ${payload.throughDate})`);
  // For the workflow's commit message.
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `season=${season}\nthrough=${payload.throughDate}\n`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});

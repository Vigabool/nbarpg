/**
 * Checks whether this machine can reach stats.nba.com's hustle stats (deflections, contested
 * shots, charges drawn, screen assists, loose balls, box outs). stats.nba.com blocks many cloud
 * servers, so the Probe hustle stats workflow runs this on GitHub's servers to find out whether the
 * weekly refresh could fetch them. It only reads and prints; it writes nothing.
 *
 *   npx tsx scripts/probe-hustle.ts [--date 2026-10-25] [--game 0022600001]
 */
const args = process.argv.slice(2);
const arg = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const date = arg('--date') ?? '2026-10-25';
const game = arg('--game') ?? '0022600001';
const season = arg('--season') ?? '2026-27';

// The headers nba.com's own pages send; stats.nba.com refuses or stalls requests without them.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

const usDate = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(8, 10)}/${iso.slice(0, 4)}`;
const query = (params: Record<string, string>) => new URLSearchParams(params).toString();

const probes: { name: string; url: string }[] = [
  {
    name: `Hustle totals for every player on ${date} (one request per game day)`,
    url:
      'https://stats.nba.com/stats/leaguehustlestatsplayer?' +
      query({
        College: '',
        Conference: '',
        Country: '',
        DateFrom: usDate(date),
        DateTo: usDate(date),
        Division: '',
        DraftPick: '',
        DraftYear: '',
        Height: '',
        LeagueID: '00',
        Location: '',
        Month: '0',
        OpponentTeamID: '0',
        Outcome: '',
        PORound: '0',
        PerMode: 'Totals',
        PlayerExperience: '',
        PlayerPosition: '',
        Season: season,
        SeasonSegment: '',
        SeasonType: 'Regular Season',
        TeamID: '0',
        VsConference: '',
        VsDivision: '',
        Weight: '',
      }),
  },
  { name: `Hustle box score for game ${game}`, url: `https://stats.nba.com/stats/boxscorehustlev2?GameID=${game}` },
  {
    name: 'Regular game log, for comparison',
    url: `https://stats.nba.com/stats/leaguegamelog?${query({ Counter: '0', Direction: 'DESC', LeagueID: '00', PlayerOrTeam: 'P', Season: season, SeasonType: 'Regular Season', Sorter: 'DATE' })}`,
  },
];

/** A short look at what came back: result set names, columns and the first row. */
function describe(json: unknown): string {
  const j = json as { resultSets?: { name: string; headers: string[]; rowSet: unknown[][] }[] } & Record<string, unknown>;
  if (Array.isArray(j.resultSets))
    return j.resultSets
      .map((r) => `  ${r.name}: ${r.rowSet.length} rows\n    columns: ${r.headers.join(', ')}\n    first: ${JSON.stringify(r.rowSet[0] ?? null)}`)
      .join('\n');
  // boxscorehustlev2 answers in the newer nested shape.
  return `  keys: ${Object.keys(j).join(', ')}\n  ${JSON.stringify(j).slice(0, 1500)}`;
}

let reached = 0;
for (const p of probes) {
  const started = Date.now();
  try {
    const r = await fetch(p.url, { headers: HEADERS, signal: AbortSignal.timeout(45_000) });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const text = await r.text();
    console.log(`\n${r.ok ? 'OK  ' : 'FAIL'} ${p.name}: HTTP ${r.status} in ${secs}s, ${text.length} bytes`);
    if (r.ok) {
      reached++;
      console.log(describe(JSON.parse(text)));
    } else console.log(`  ${text.slice(0, 500)}`);
  } catch (err) {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\nFAIL ${p.name}: ${(err as Error).name}: ${(err as Error).message} after ${secs}s`);
  }
}
console.log(`\n${reached} of ${probes.length} requests reached stats.nba.com.`);

export {};

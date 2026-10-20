import type { RawGameLog } from '../../src/data/types';

/**
 * A deterministic, obviously fake season for tests and local UI work before
 * real data is available. Team and player names are synthetic on purpose.
 * Never ship this as game data.
 */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rand: () => number, mean: number): number {
  if (mean <= 0) return 0;
  const l = Math.exp(-mean);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l && k < 60);
  return k - 1;
}

interface Archetype {
  label: string;
  min: number;
  fg2a: number;
  fg2pct: number;
  fg3a: number;
  fg3pct: number;
  fta: number;
  ftpct: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
}

const ARCHETYPES: Archetype[] = [
  { label: 'Star Guard', min: 35, fg2a: 11, fg2pct: 0.52, fg3a: 9, fg3pct: 0.38, fta: 7, ftpct: 0.88, oreb: 0.6, dreb: 4.5, ast: 8, stl: 1.4, blk: 0.3, tov: 3.2 },
  { label: 'Sniper', min: 32, fg2a: 5, fg2pct: 0.5, fg3a: 9, fg3pct: 0.4, fta: 2.5, ftpct: 0.9, oreb: 0.5, dreb: 3, ast: 2.5, stl: 1, blk: 0.3, tov: 1.3 },
  { label: 'Wing Scorer', min: 34, fg2a: 13, fg2pct: 0.53, fg3a: 6, fg3pct: 0.36, fta: 6, ftpct: 0.82, oreb: 1, dreb: 5, ast: 4, stl: 1.1, blk: 0.5, tov: 2.4 },
  { label: 'Stopper', min: 30, fg2a: 5, fg2pct: 0.5, fg3a: 3.5, fg3pct: 0.36, fta: 3, ftpct: 0.75, oreb: 0.9, dreb: 3.8, ast: 2.5, stl: 2, blk: 0.6, tov: 1.2 },
  { label: 'Big', min: 31, fg2a: 10, fg2pct: 0.6, fg3a: 0.5, fg3pct: 0.3, fta: 4.5, ftpct: 0.68, oreb: 3.2, dreb: 8, ast: 3, stl: 0.8, blk: 1.9, tov: 1.9 },
  { label: 'Point Forward', min: 33, fg2a: 9, fg2pct: 0.54, fg3a: 3, fg3pct: 0.33, fta: 5, ftpct: 0.72, oreb: 1.8, dreb: 7, ast: 6.5, stl: 1.2, blk: 0.8, tov: 2.8 },
  { label: 'Bench Guard', min: 22, fg2a: 4, fg2pct: 0.48, fg3a: 4, fg3pct: 0.35, fta: 2, ftpct: 0.8, oreb: 0.4, dreb: 2, ast: 3.5, stl: 0.8, blk: 0.2, tov: 1.2 },
  { label: 'Bench Big', min: 18, fg2a: 4, fg2pct: 0.58, fg3a: 0.5, fg3pct: 0.3, fta: 1.8, ftpct: 0.65, oreb: 1.8, dreb: 3.5, ast: 1, stl: 0.5, blk: 1, tov: 0.9 },
  { label: 'Bench Wing', min: 20, fg2a: 4, fg2pct: 0.5, fg3a: 3.5, fg3pct: 0.35, fta: 1.6, ftpct: 0.78, oreb: 0.7, dreb: 2.6, ast: 1.5, stl: 0.7, blk: 0.3, tov: 0.8 },
  { label: 'Deep Bench', min: 12, fg2a: 2, fg2pct: 0.48, fg3a: 1.5, fg3pct: 0.33, fta: 1, ftpct: 0.72, oreb: 0.5, dreb: 1.5, ast: 1, stl: 0.4, blk: 0.2, tov: 0.6 },
];

const HEADERS = [
  'PLAYER_ID', 'PLAYER_NAME', 'TEAM_ABBREVIATION', 'GAME_ID', 'GAME_DATE', 'MATCHUP',
  'MIN', 'FGM', 'FGA', 'FG3M', 'FG3A', 'FTM', 'FTA', 'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TOV', 'PTS',
];

export function makeSyntheticSeason(opts: { teams?: number; weeks?: number; seed?: number } = {}): RawGameLog {
  const teamCount = opts.teams ?? 30;
  const weeks = opts.weeks ?? 8;
  const rand = rng(opts.seed ?? 42);
  const teams = Array.from({ length: teamCount }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);

  // Each player gets an archetype with a personal skill multiplier.
  const rosters = teams.map((team, ti) =>
    ARCHETYPES.map((a, ai) => ({
      id: 9_000_000 + ti * 100 + ai,
      name: `Synthetic ${a.label} ${team}`,
      a,
      skill: 0.75 + rand() * 0.6,
    })),
  );

  const rows: RawGameLog['rows'] = [];
  let gameNo = 0;
  const start = new Date('2025-10-20T00:00:00Z'); // a Monday
  for (let w = 0; w < weeks; w++) {
    for (const day of [0, 2, 4, 6]) {
      // Most teams play on each of four days a week; shuffle pairings.
      const order = [...teams.keys()].sort(() => rand() - 0.5);
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + w * 7 + day);
      const iso = date.toISOString().slice(0, 10);
      for (let i = 0; i + 1 < order.length; i += 2) {
        if (rand() < 0.15) continue; // some teams rest
        const home = order[i];
        const away = order[i + 1];
        const gameId = `09${String(++gameNo).padStart(8, '0')}`;
        for (const [ti, opp, isHome] of [[home, away, true], [away, home, false]] as const) {
          for (const p of rosters[ti]) {
            if (rand() < 0.06) continue; // DNP
            const a = p.a;
            const k = p.skill * (0.85 + rand() * 0.3);
            const fg3a = poisson(rand, a.fg3a * k);
            const fg3m = Math.min(fg3a, poisson(rand, a.fg3a * a.fg3pct * k));
            const fg2a = poisson(rand, a.fg2a * k);
            const fg2m = Math.min(fg2a, poisson(rand, a.fg2a * a.fg2pct * k));
            const fta = poisson(rand, a.fta * k);
            const ftm = Math.min(fta, poisson(rand, a.fta * a.ftpct * k));
            const oreb = poisson(rand, a.oreb * k);
            const dreb = poisson(rand, a.dreb * k);
            const ast = poisson(rand, a.ast * k);
            const stl = poisson(rand, a.stl * k);
            const blk = poisson(rand, a.blk * k);
            const tov = poisson(rand, a.tov);
            const pts = fg2m * 2 + fg3m * 3 + ftm;
            const min = Math.round(a.min * (0.85 + rand() * 0.3));
            rows.push([
              p.id, p.name, teams[ti], gameId, iso,
              isHome ? `${teams[ti]} vs. ${teams[opp]}` : `${teams[ti]} @ ${teams[opp]}`,
              min, fg2m + fg3m, fg2a + fg3a, fg3m, fg3a, ftm, fta, oreb, dreb, oreb + dreb, ast, stl, blk, tov, pts,
            ]);
          }
        }
      }
    }
  }
  return {
    season: '2025-26',
    source: 'SYNTHETIC test fixture (not real NBA data)',
    fetchedAt: new Date('2025-10-20T00:00:00Z').toISOString(),
    synthetic: true,
    headers: HEADERS,
    rows,
  };
}

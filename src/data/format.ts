import { STAT_KEYS, type BoxLine, type Game, type PlayerSummary, type SeasonData, type StatLine, type Week } from './types';

/**
 * Compact on-disk format for public/data/<season>.json. Box lines are stored as
 * arrays in LINE_FIELDS order to keep the file small.
 */
export const LINE_FIELDS = ['playerId', 'team', ...STAT_KEYS] as const;

export interface CompactSeason {
  season: string;
  source: string;
  generatedAt: string;
  synthetic: boolean;
  lineFields: readonly string[];
  weeks: Week[];
  games: { id: string; date: string; home: string; away: string; lines: (string | number)[][] }[];
  players: { id: number; name: string; team: string; gp: number; avg: number[] }[];
  /** Prior-season lines per player, each in STAT_KEYS order. */
  prior?: { season: string; lines: Record<number, number[][]> };
  throughDate?: string;
}

export function encodeSeason(data: SeasonData): CompactSeason {
  return {
    season: data.season,
    source: data.source,
    generatedAt: data.generatedAt,
    synthetic: data.synthetic,
    lineFields: LINE_FIELDS,
    weeks: data.weeks,
    games: Object.values(data.games).map((g) => ({
      id: g.id,
      date: g.date,
      home: g.home,
      away: g.away,
      lines: g.lines.map((l) => LINE_FIELDS.map((f) => l[f])),
    })),
    players: Object.values(data.players).map((p) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      gp: p.gp,
      avg: STAT_KEYS.map((k) => Math.round(p.avg[k] * 100) / 100),
    })),
    ...(data.prior
      ? {
          prior: {
            season: data.prior.season,
            lines: Object.fromEntries(Object.entries(data.prior.lines).map(([id, ls]) => [id, ls.map((l) => STAT_KEYS.map((k) => l[k]))])),
          },
        }
      : {}),
    ...(data.throughDate ? { throughDate: data.throughDate } : {}),
  };
}

export function decodeSeason(c: CompactSeason): SeasonData {
  const games: Record<string, Game> = {};
  for (const g of c.games) {
    games[g.id] = {
      id: g.id,
      date: g.date,
      home: g.home,
      away: g.away,
      lines: g.lines.map((row) => {
        const line = {} as Record<string, string | number>;
        c.lineFields.forEach((f, i) => (line[f] = row[i]));
        return line as unknown as BoxLine;
      }),
    };
  }
  const players: Record<number, PlayerSummary> = {};
  for (const p of c.players) {
    const avg = {} as PlayerSummary['avg'];
    STAT_KEYS.forEach((k, i) => (avg[k] = p.avg[i]));
    players[p.id] = { id: p.id, name: p.name, team: p.team, gp: p.gp, avg };
  }
  return {
    season: c.season,
    source: c.source,
    generatedAt: c.generatedAt,
    synthetic: c.synthetic,
    weeks: c.weeks,
    games,
    players,
    ...(c.prior
      ? {
          prior: {
            season: c.prior.season,
            lines: Object.fromEntries(
              Object.entries(c.prior.lines).map(([id, ls]) => [
                Number(id),
                ls.map((row) => Object.fromEntries(STAT_KEYS.map((k, i) => [k, row[i]])) as StatLine),
              ]),
            ),
          },
        }
      : {}),
    ...(c.throughDate ? { throughDate: c.throughDate } : {}),
  };
}

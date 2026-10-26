import { emptyStatLine } from './build';
import { STAT_KEYS, type PlayerSummary, type SeasonData, type StatLine } from './types';
import { rules as defaultRules, type Rules } from '../rules';

/**
 * A player's form as of a week: the averages that set salary, season tier and gear. It covers the
 * games before that week (never the week itself): this season's games so far once there are
 * enough, otherwise this season's games topped up with the player's last prior-season games.
 * A season without prior data (a finished sandbox season) keeps whole-season averages.
 */
export function formView(data: SeasonData, weekIndex: number, rules: Rules = defaultRules): SeasonData {
  if (!data.prior) return data;
  // Cached per season and week, for the game's own rules only (the UI asks on every render).
  const cache = rules === defaultRules ? (views.get(data) ?? views.set(data, new Map()).get(data)!) : null;
  const hit = cache?.get(weekIndex);
  if (hit) return hit;

  const window = rules.salary.eligibility.formGames;
  const before = data.weeks.find((w) => w.index === weekIndex)?.start ?? '9999-12-31';
  const lines = linesByPlayer(data);
  const players: Record<number, PlayerSummary> = {};
  for (const p of Object.values(data.players)) {
    const current = (lines.get(p.id) ?? []).filter((x) => x.date < before).map((x) => x.line);
    const prior = current.length >= window ? [] : (data.prior.lines[p.id] ?? []).slice(-(window - current.length));
    const used = [...prior, ...current];
    players[p.id] = { ...p, gp: used.length, avg: average(used), form: { current: current.length, prior: prior.length } };
  }
  const view = { ...data, players };
  cache?.set(weekIndex, view);
  return view;
}

const views = new WeakMap<SeasonData, Map<number, SeasonData>>();
const lineCache = new WeakMap<SeasonData, Map<number, { date: string; line: StatLine }[]>>();

function linesByPlayer(data: SeasonData) {
  let out = lineCache.get(data);
  if (out) return out;
  out = new Map();
  const games = Object.values(data.games).sort((a, b) => a.date.localeCompare(b.date));
  for (const g of games) for (const l of g.lines) (out.get(l.playerId) ?? out.set(l.playerId, []).get(l.playerId)!).push({ date: g.date, line: l });
  lineCache.set(data, out);
  return out;
}

function average(lines: StatLine[]): StatLine {
  const avg = emptyStatLine();
  if (!lines.length) return avg;
  for (const l of lines) for (const k of STAT_KEYS) avg[k] += l[k];
  for (const k of STAT_KEYS) avg[k] /= lines.length;
  return avg;
}

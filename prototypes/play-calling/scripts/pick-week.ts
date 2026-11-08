/**
 * Picks the Play Calling prototype's fixed week from real 2025-26 games: five well-known players,
 * one per class, each with a Good-or-better game in their class that week, in five different games.
 * Writes the heroes, the Goblin Horde built from their opponents, and the calibration the prototype needs.
 * Run: npx tsx prototypes/play-calling/scripts/pick-week.ts
 */
import { writeFileSync } from 'node:fs';
import { loadSeasonFile } from '../../../scripts/load-season';
import { computePool } from '../../../src/engine/rating';
import { buildHorde } from '../../../src/engine/horde';
import { rules, tierIndex, type HeroClass } from '../../../src/rules';
import type { BoxLine, StatLine } from '../../../src/data/types';

const data = loadSeasonFile('2025-26');
const CLASSES: HeroClass[] = ['warrior', 'cleric', 'rogue', 'wizard', 'ranger'];
const GOOD = tierIndex('good');

const fame = (id: number) => {
  const a = data.players[id]?.avg;
  return a ? a.pts + a.reb + a.ast : 0;
};
const trueUsage = (l: StatLine) => l.fga + 0.44 * l.fta + l.tov + l.ast;
const defRating = (l: StatLine) => 3 * l.stl + 3 * l.blk + l.dreb;

// Calibration from every line of 20+ minutes.
const lines: BoxLine[] = Object.values(data.games).flatMap((g) => g.lines.filter((l) => l.min >= 20));
const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const dr = lines.map(defRating);
const defThresholds = { average: q(dr, 0.2), good: q(dr, 0.5), great: q(dr, 0.75), elite: q(dr, 0.92) };
const starters = lines.filter((l) => l.min >= 28).map(trueUsage);
const meanStarterUsage = starters.reduce((s, x) => s + x, 0) / starters.length;
// Five heroes should land near 36 touches a game.
const usagePerTouch = (meanStarterUsage * 5) / 36;

let best: { score: number; week: number; picks: { cls: HeroClass; playerId: number; gameId: string }[] } | undefined;
for (const week of data.weeks) {
  const options = CLASSES.map((cls) => {
    const out: { playerId: number; gameId: string; fame: number }[] = [];
    for (const gid of week.gameIds) {
      for (const l of data.games[gid].lines) {
        if (l.min < 24) continue;
        if (tierIndex(computePool(cls, l).tier) < GOOD) continue;
        out.push({ playerId: l.playerId, gameId: gid, fame: fame(l.playerId) });
      }
    }
    return out.sort((a, b) => b.fame - a.fame).slice(0, 25);
  });
  // Greedy by class, keeping players and games distinct.
  const usedP = new Set<number>();
  const usedG = new Set<string>();
  const picks: { cls: HeroClass; playerId: number; gameId: string }[] = [];
  let score = 0;
  for (let i = 0; i < CLASSES.length; i++) {
    const o = options[i].find((x) => !usedP.has(x.playerId) && !usedG.has(x.gameId));
    if (!o) break;
    usedP.add(o.playerId);
    usedG.add(o.gameId);
    picks.push({ cls: CLASSES[i], playerId: o.playerId, gameId: o.gameId });
    score += o.fame;
  }
  if (picks.length === 5 && (!best || score > best.score)) best = { score, week: week.index, picks };
}
if (!best) throw new Error('No week found');

const week = data.weeks.find((w) => w.index === best!.week)!;
const horde = buildHorde(
  best.picks.map((p) => ({ heroClass: p.cls, playerId: p.playerId, gameId: p.gameId })),
  data,
  rules,
  'goblin-horde',
);
const statLine = (l: StatLine) => ({
  min: l.min,
  pts: l.pts,
  reb: l.reb,
  ast: l.ast,
  stl: l.stl,
  blk: l.blk,
  tov: l.tov,
  fg3m: l.fg3m,
  fgm: l.fgm,
  fga: l.fga,
  fta: l.fta,
  ftm: l.ftm,
  oreb: l.oreb,
  dreb: l.dreb,
});
const tierOf = (r: number, t: Record<string, number>) =>
  r >= t.elite ? 'elite' : r >= t.great ? 'great' : r >= t.good ? 'good' : r >= t.average ? 'average' : 'cold';

const heroes = best.picks.map((p) => {
  const g = data.games[p.gameId];
  const l = g.lines.find((x) => x.playerId === p.playerId)!;
  const pool = computePool(p.cls, l);
  const opp = g.home === l.team ? g.away : g.home;
  const tu = trueUsage(l);
  return {
    cls: p.cls,
    player: data.players[p.playerId].name,
    team: l.team,
    opp,
    date: g.date,
    home: g.home === l.team,
    line: statLine(l),
    tier: pool.tier,
    rating: pool.rating,
    doubleDouble: pool.doubleDouble,
    tripleDouble: pool.tripleDouble,
    defRating: defRating(l),
    defTier: tierOf(defRating(l), defThresholds),
    trueUsage: Math.round(tu * 10) / 10,
    touches: Math.max(2, Math.round(tu / usagePerTouch)),
  };
});

const champs = [...horde.champions, horde.warlord].map((c) => ({
  kind: c.kind,
  player: data.players[c.source!.playerId]?.name ?? '?',
  team: c.source!.team,
  tier: c.tier,
  hp: c.hp,
  damage: c.damage,
  mirrorOf: c.source!.mirrorOf ?? null,
  boss: c.isWarlord,
  line: statLine(c.source!.line),
}));

// Opposing teams: points (goblins) and FG% (ram damage).
const teams = best.picks.map((p) => {
  const g = data.games[p.gameId];
  const own = g.lines.find((x) => x.playerId === p.playerId)!.team;
  const opp = g.home === own ? g.away : g.home;
  const ls = g.lines.filter((x) => x.team === opp);
  const pts = ls.reduce((s, x) => s + x.pts, 0);
  const fgm = ls.reduce((s, x) => s + x.fgm, 0);
  const fga = ls.reduce((s, x) => s + x.fga, 0);
  return { team: opp, pts, fgPct: Math.round((fgm / fga) * 1000) / 1000, goblins: Math.floor(pts / rules.horde.minions.teamPointsPerGoblin) };
});

const out = {
  season: '2025-26',
  week: { index: week.index, start: week.start, end: week.end },
  heroes,
  champions: champs,
  teams,
  calibration: { defThresholds, usagePerTouch: Math.round(usagePerTouch * 100) / 100 },
};
writeFileSync('prototypes/play-calling/src/week.json', JSON.stringify(out, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      week: out.week,
      heroes: heroes.map((h) => [h.cls, h.player, h.tier, h.defTier, h.touches, h.line.pts, h.line.reb, h.line.ast]),
      champs: champs.map((c) => [c.kind, c.player, c.tier, c.hp, c.damage]),
      teams,
      cal: out.calibration,
    },
    null,
    1,
  ),
);

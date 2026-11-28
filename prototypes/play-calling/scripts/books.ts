/**
 * Searches four-play playbooks: every combination of the templates, played by the smart bot (its four plays,
 * auto defense, an Iso when the book runs dry) on the sample week, then the best on built rosters.
 * Run: ENC=crypt npx tsx prototypes/play-calling/scripts/books.ts   (TOP=30 books go on to the rosters; ROSTERS=8 weeks)
 * Prints each book's margins and where its points come from, to find distinct plans that work.
 */
import { CLASSES, TEMPLATES, type Play } from '../src/content';
import {
  DEFAULT_TUNING,
  activeHeroes,
  autoDefense,
  bestCall,
  halftimeAdjustment,
  holdPossession,
  isoPlay,
  newGame,
  playAvailable,
  runPossession,
  startSecondHalf,
  type Difficulty,
  type Game,
} from '../src/engine';
import { loadSeasonFile } from '../../../scripts/load-season';
import { sampleWeek, buildWeek } from '../src/setup/buildWeek';
import { setWeek, FIXED_WEEK, type WeekData } from '../src/week';

const ENC = process.env.ENC ?? 'goblin-horde';
const full = loadSeasonFile('2025-26');

function playGame(book: Play[], difficulty: Difficulty): Game {
  let g = newGame({ ...DEFAULT_TUNING, ...JSON.parse(process.env.TUNE ?? '{}') }, difficulty);
  while (g.phase !== 'final') {
    if (g.phase === 'halftime') {
      g = startSecondHalf(g, halftimeAdjustment(g, book));
      continue;
    }
    let pool = book.filter((p) => playAvailable(g, p).ok);
    if (!pool.length)
      pool = activeHeroes(g)
        .map((h) => isoPlay(h.cls))
        .filter((p) => playAvailable(g, p).ok);
    const best = pool.length ? bestCall(g, pool) : null;
    if (!best) {
      g = holdPossession(g, autoDefense(g, new Set())).game;
      continue;
    }
    const play = pool.find((p) => p.id === best.playId)!;
    g = runPossession(g, play, best.targetId, autoDefense(g, new Set(play.steps.map((s) => s.cls)))).game;
  }
  return g;
}

function combos<T>(xs: T[], k: number): T[][] {
  if (k === 0) return [[]];
  return xs.flatMap((x, i) => combos(xs.slice(i + 1), k - 1).map((c) => [x, ...c]));
}

const byId = (id: string) => TEMPLATES.find((t) => t.id === id)!;
const sample = ENC === 'goblin-horde' ? FIXED_WEEK : sampleWeek(full, ENC);
setWeek(sample);
// EXCLUDE=critical-taunt leaves plays out; BENCH=warrior,rogue keeps those heroes off the ball (they only defend).
const exclude = (process.env.EXCLUDE ?? '').split(',');
const bench = (process.env.BENCH ?? '').split(',');
const books = process.env.BOOKS
  ? process.env.BOOKS.split(';').map((b) => b.split(',').map(byId))
  : combos(
      TEMPLATES.filter((t) => !exclude.includes(t.id) && !t.steps.some((s) => bench.includes(s.cls))),
      4,
    ).filter((b) => CLASSES.every((c) => bench.includes(c) || b.some((p) => p.steps.some((s) => s.cls === c))));
const scored = books.map((b) => {
  const n = playGame(b, 'normal');
  const h = playGame(b, 'hard');
  return { b, sample: n.score.party - n.score.horde + h.score.party - h.score.horde };
});
scored.sort((a, b) => b.sample - a.sample);
const top = scored.slice(0, Number(process.env.TOP ?? 30));

// Built rosters: the same weeks and drafts as sim.ts ROSTERS (balance, offense, defense, flexibility).
const { formView } = await import('../../../src/data/form');
const { autoDraft } = await import('../../../src/app/autoDraft');
const { newGame: newSave } = await import('../../../src/app/game');
const { smartPicks, suggestHeroes } = await import('../src/setup/picks');
const weeks: WeekData[] = [];
for (const w of full.weeks.filter((x) => x.gameIds.length > 0).slice(0, Number(process.env.ROSTERS ?? 8)))
  for (const mode of ['balance', 'offense', 'defense', 'flexibility'] as const) {
    const view = formView(full, w.index);
    const d = autoDraft(view, w, mode);
    if (!d) continue;
    const roster = [...Object.values(d.slots), ...d.reserves];
    void newSave;
    const a = suggestHeroes(view, full, w.index, roster);
    weeks.push(buildWeek(full, w.index, a, smartPicks(full, w.index, a, undefined, ENC), ENC));
  }

for (const t of top) {
  let n = 0;
  let h = 0;
  let nw = 0;
  const pts: Record<string, number> = {};
  const horde: Record<string, number> = {};
  let stops = 0;
  let close = 0;
  let tk = 0;
  for (const w of weeks) {
    setWeek(w);
    const gn = playGame(t.b, 'normal');
    const gh = playGame(t.b, 'hard');
    n += gn.score.party - gn.score.horde;
    h += gh.score.party - gh.score.horde;
    nw += gn.score.party > gn.score.horde ? 1 : 0;
    for (const [k, v] of Object.entries(gn.stats.heroes)) pts[k] = (pts[k] ?? 0) + v.pts;
    stops += gn.stats.party.stops;
    tk += gn.stats.party.takedowns;
    close += (Math.abs(gn.score.party - gn.score.horde) <= 8 ? 1 : 0) + (Math.abs(gh.score.party - gh.score.horde) <= 8 ? 1 : 0);
    for (const [k, v] of Object.entries(gn.stats.horde)) horde[k] = (horde[k] ?? 0) + (v as number);
  }
  const per = (x: number) => (x / weeks.length).toFixed(1);
  console.log(
    `${t.b.map((p) => p.id).join(',')} | sample ${t.sample} | built normal ${per(n)} (${nw}/${weeks.length}) hard ${per(h)} | stops ${per(stops)} | takedown pts ${per(tk)} | close ${Math.round((close / (2 * weeks.length)) * 100)}% | heroes ${Object.entries(
      pts,
    )
      .map(([k, v]) => `${k.slice(0, 2)}:${per(v)}`)
      .join(' ')} | horde ${Object.entries(horde)
      .map(([k, v]) => `${k}:${per(v)}`)
      .join(' ')}`,
  );
}

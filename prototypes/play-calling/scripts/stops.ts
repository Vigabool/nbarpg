/**
 * How often the horde's hits are stopped, and by what: one defender alone, a combination, a Quick dodge or a Steal.
 * Smart bot (the book's four plays, auto defense) on the 32 built rosters.
 * Run: ENC=crypt BOOK=a,b,c,d TUNE='{"protectArmor":8}' npx tsx prototypes/play-calling/scripts/stops.ts
 */
import { DEFAULT_PLAYBOOK, TEMPLATES, CLASSES } from '../src/content';
import {
  DEFAULT_TUNING,
  activeHeroes,
  autoDefense,
  bestCall,
  defenders,
  halftimeAdjustment,
  holdPossession,
  isoPlay,
  newGame,
  playAvailable,
  runPossession,
  startSecondHalf,
  type Difficulty,
} from '../src/engine';
import { loadSeasonFile } from '../../../scripts/load-season';
import { buildWeek } from '../src/setup/buildWeek';
import { setWeek } from '../src/week';
import { formView } from '../../../src/data/form';
import { autoDraft } from '../../../src/app/autoDraft';
import { smartPicks, suggestHeroes } from '../src/setup/picks';

const ENC = process.env.ENC ?? 'goblin-horde';
const book = (process.env.BOOK?.split(',') ?? DEFAULT_PLAYBOOK).map((id) => TEMPLATES.find((t) => t.id === id)!);
const tuning = { ...DEFAULT_TUNING, ...JSON.parse(process.env.TUNE ?? '{}') };
const full = loadSeasonFile('2025-26');
const by: Record<string, { n: number; stopped: number }> = {};
const add = (k: string, stop: boolean) => {
  const b = (by[k] ??= { n: 0, stopped: 0 });
  b.n++;
  if (stop) b.stopped++;
};
let games = 0;
let margin = 0;
for (const w of full.weeks.filter((x) => x.gameIds.length > 0).slice(0, 8))
  for (const mode of ['balance', 'offense', 'defense', 'flexibility'] as const) {
    const view = formView(full, w.index);
    const dr = autoDraft(view, w, mode);
    if (!dr) continue;
    const a = suggestHeroes(view, full, w.index, [...Object.values(dr.slots), ...dr.reserves]);
    setWeek(buildWeek(full, w.index, a, smartPicks(full, w.index, a, undefined, ENC), ENC));
    for (const diff of ['normal', 'hard'] as Difficulty[]) {
      let g = newGame(tuning, diff);
      games++;
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
        const inPlay = new Set(play.steps.map((s) => s.cls));
        const def = autoDefense(g, inPlay);
        const off = new Set(defenders(g, inPlay));
        const r = runPossession(g, play, best.targetId, def);
        for (const f of r.frames) {
          if (/Rogue · Steal: picks/.test(f.text)) add('Steal (Rogue, after Close Out or a Mark)', true);
          if (/is Quick and dodges/.test(f.text)) add('Quick dodge (Spacing)', true);
          if (f.side !== 'horde' || !f.target || !CLASSES.includes(f.target as never)) continue;
          const m = f.text.match(/: (\d+) to the/);
          if (!m) continue;
          const t = f.target;
          const tags: string[] = [];
          if (off.has('warrior') && def.protect === t) tags.push('Protect');
          if (off.has('wizard') && def.ward === t) tags.push('Ward');
          if (/Slowed/.test(f.text)) tags.push('Slowed');
          if (/Armor/.test(f.text) && !tags.includes('Protect') && !tags.includes('Ward')) tags.push('play Armor');
          add(tags.length ? tags.join(' + ') : 'nothing', +m[1] === 0);
        }
        g = r.game;
      }
      margin += g.score.party - g.score.horde;
    }
  }
const total = Object.values(by).reduce((s, b) => s + b.n, 0);
const stopped = Object.values(by).reduce((s, b) => s + b.stopped, 0);
console.log(
  `${ENC} ${JSON.stringify(JSON.parse(process.env.TUNE ?? '{}'))}: ${((stopped / total) * 100).toFixed(1)}% of hits stopped (${(stopped / games).toFixed(1)} a game), margin ${(margin / games).toFixed(1)}`,
);
for (const [k, b] of Object.entries(by).sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(44)} ${String(b.n).padStart(4)} hits, ${((b.stopped / b.n) * 100).toFixed(0).padStart(3)}% stopped`);

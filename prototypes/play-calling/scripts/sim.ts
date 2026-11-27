/**
 * Plays the prototype's Goblin Horde with simple bots and prints the numbers the concept doc asks for.
 * Run: npx tsx prototypes/play-calling/scripts/sim.ts
 * Rosters a player might build (auto-draft, suggested heroes, Smart pick) for the first N weeks: ROSTERS=6 npx tsx …/sim.ts
 */
import { DEFAULT_PLAYBOOK, TEMPLATES, type Play } from '../src/content';
import {
  DEFAULT_TUNING,
  activeHeroes,
  autoDefense,
  bestCall,
  holdPossession,
  isoPlay,
  halftimeAdjustment,
  newGame,
  onField,
  playAvailable,
  project,
  runPossession,
  startSecondHalf,
  defenders,
  type Defense,
  type Difficulty,
  type Game,
} from '../src/engine';
import { CLASSES, type Cls } from '../src/content';

const isoOrHold = { iso: 0, hold: 0 };
const book: Play[] = DEFAULT_PLAYBOOK.map((id) => TEMPLATES.find((t) => t.id === id)!);
/** The expert bot's book: every saved play, plus each hero's Iso. */
const fullBook: Play[] = [...TEMPLATES, ...CLASSES.map(isoPlay)];

/** Every defense the free heroes could set. */
function defenseOptions(g: Game, inPlay: Set<Cls>): Defense[] {
  const off = new Set(defenders(g, inPlay));
  const heroes = activeHeroes(g).map((h) => h.cls);
  const protects: (Defense['protect'] | undefined)[] = off.has('warrior') ? [...heroes, ...(g.gate.breached ? [] : (['gate'] as const))] : [undefined];
  const closeOuts: (string | undefined)[] = off.has('ranger') ? onField(g).map((e) => e.id) : [undefined];
  const wards: (Cls | undefined)[] = off.has('wizard') ? heroes : [undefined];
  const out: Defense[] = [];
  for (const protect of protects) for (const closeOut of closeOuts) for (const ward of wards) out.push({ protect, closeOut, ward });
  return out;
}

/** The defense that holds the horde to the fewest points this turn (ties: the most hero HP, then the most gate HP). */
function bestDefense(g: Game, play: Play, target: string): Defense {
  const inPlay = new Set(play.steps.map((s) => s.cls));
  let best: { d: Defense; key: number[] } | null = null;
  for (const d of defenseOptions(g, inPlay)) {
    const r = runPossession(g, play, target, d).game;
    const hp = activeHeroes(r).reduce((s, h) => s + h.hp, 0);
    const key = [r.score.horde - g.score.horde, -hp, -r.gate.hp];
    if (!best || key.some((v, i) => v !== best!.key[i] && key.slice(0, i).every((w, j) => w === best!.key[j]) && v < best!.key[i])) best = { d, key };
  }
  return best?.d ?? autoDefense(g, inPlay);
}

function play(difficulty: Difficulty, bot: 'smart' | 'naive' | 'expert', seed: number) {
  let g: Game = newGame({ ...DEFAULT_TUNING, ...JSON.parse(process.env.TUNE ?? '{}') }, difficulty);
  let rnd = seed;
  const rand = () => (rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  const gaps: number[] = [];
  const bestIds: string[] = [];
  let breachAt = -1;
  while (g.phase !== 'final') {
    if (g.phase === 'halftime') {
      g = startSecondHalf(g, halftimeAdjustment(g, book));
      continue;
    }
    const avail = (bot === 'expert' ? fullBook : book).filter((p) => playAvailable(g, p).ok);
    // Fall back to any two-step basic play when the book is exhausted.
    const pool = avail.length ? avail : [];
    let choice: { play: Play; target: string } | null = null;
    const all = pool.flatMap((p) => onField(g).map((e) => ({ p, pr: project(g, p, e.id) })));
    if (all.length) {
      const vals = all.map((x) => x.pr.value).sort((a, b) => b - a);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      gaps.push(vals[0] - mean);
      const best = bestCall(g, pool)!;
      bestIds.push(best.playId);
      if (bot !== 'naive') choice = { play: pool.find((p) => p.id === best.playId)!, target: best.targetId };
      else {
        const x = all[Math.floor(rand() * all.length)];
        choice = { play: x.p, target: x.pr.targetId };
      }
    }
    if (!choice) {
      // Nothing in the book can run: the best Iso, or hold the ball.
      const isos = activeHeroes(g)
        .map((h) => isoPlay(h.cls))
        .filter((p) => playAvailable(g, p).ok);
      const best = isos.length ? bestCall(g, isos) : null;
      if (best) choice = { play: isos.find((p) => p.id === best.playId)!, target: best.targetId };
      else {
        isoOrHold.hold++;
        g = holdPossession(g, autoDefense(g, new Set())).game;
        continue;
      }
      isoOrHold.iso++;
    }
    const inPlay = new Set(choice.play.steps.map((s) => s.cls));
    const defense = bot === 'expert' ? bestDefense(g, choice.play, choice.target) : autoDefense(g, inPlay);
    g = runPossession(g, choice.play, choice.target, defense).game;
    if (g.gate.breached && breachAt < 0) breachAt = g.possession;
  }
  let changes = 0;
  for (let i = 1; i < bestIds.length; i++) if (bestIds[i] !== bestIds[i - 1]) changes++;
  return {
    party: g.score.party,
    horde: g.score.horde,
    breachAt,
    gap: gaps.reduce((s, x) => s + x, 0) / Math.max(1, gaps.length),
    changes: changes / Math.max(1, bestIds.length - 1),
    possessions: g.possession,
    stats: g.stats,
    ritual: g.ritual,
  };
}

if (process.env.ROSTERS) {
  // Rosters a player might build: auto-drafted under the cap (balance), suggested heroes, Smart-picked games,
  // for the first weeks of 2025-26. Each week is played by the expert and smart bots.
  const { loadSeasonFile } = await import('../../../scripts/load-season');
  const { formView } = await import('../../../src/data/form');
  const { autoDraft } = await import('../../../src/app/autoDraft');
  const { autoAssign } = await import('../../../src/app/autoAssign');
  const { smartGames } = await import('../../../src/app/smartPick');
  const { newGame: newSave } = await import('../../../src/app/game');
  const { buildWeek } = await import('../src/setup/buildWeek');
  const { smartPicks, suggestHeroes, PICK_WEIGHTS } = await import('../src/setup/picks');
  // PICKW='{"touch":1.5}' tries other pick weights.
  const pw = { ...PICK_WEIGHTS, ...JSON.parse(process.env.PICKW ?? '{}') };
  // PICKS=main uses the main game's energy-based Suggest and Smart pick, for comparison.
  const mainPicks = process.env.PICKS === 'main';
  const modes = (process.env.MODES ?? 'balance').split(',') as ('offense' | 'defense' | 'balance' | 'flexibility')[];
  const { setWeek } = await import('../src/week');
  const full = loadSeasonFile('2025-26');
  const weeks = full.weeks.filter((w) => w.gameIds.length > 0).slice(0, Number(process.env.ROSTERS) || 6);
  const rows: string[] = [];
  const totals = { normal: [0, 0, 0], hard: [0, 0, 0] } as Record<Difficulty, number[]>;
  let games = 0;
  const touchTotals: number[] = [];
  for (const w of weeks)
    for (const mode of modes) {
      const view = formView(full, w.index);
      const d = autoDraft(view, w, mode);
      if (!d) continue;
      games++;
      const save = { ...newSave('2025-26', w.index), roster: [...Object.values(d.slots), ...d.reserves], encounter: process.env.ENC ?? 'goblin-horde' };
      save.assignments = mainPicks ? autoAssign(save, view) : suggestHeroes(view, full, w.index, save.roster, pw);
      save.gamePicks = mainPicks ? smartGames(save, view) : smartPicks(full, w.index, save.assignments, pw, process.env.ENC ?? 'goblin-horde');
      const week = buildWeek(full, w.index, save.assignments, save.gamePicks, process.env.ENC ?? 'goblin-horde');
      setWeek(week);
      const tuning = { ...DEFAULT_TUNING, ...JSON.parse(process.env.TUNE ?? '{}') };
      const touches = week.heroes.reduce((s2, h) => s2 + (h.out ? 0 : Math.max(2, Math.round(h.trueUsage / tuning.usagePerTouch))), 0);
      touchTotals.push(touches);
      for (const difficulty of ['normal', 'hard'] as Difficulty[]) {
        const e = play(difficulty, 'expert', 1);
        const sm = play(difficulty, 'smart', 1);
        if (process.env.DEBUG)
          console.log(
            `  ${difficulty} expert horde ${JSON.stringify(e.stats.horde)} ritual ${JSON.stringify(e.ritual)} party ${JSON.stringify(e.stats.party)} | smart horde ${JSON.stringify(sm.stats.horde)} ritual fills ${sm.ritual.fills}`,
          );
        totals[difficulty][0] += e.party - e.horde;
        totals[difficulty][1] += sm.party - sm.horde;
        totals[difficulty][2] += e.party > e.horde ? 1 : 0;
        rows.push(
          `week ${w.index} ${mode} ${difficulty}: expert ${e.party}-${e.horde}, smart ${sm.party}-${sm.horde} · touches ${touches} · heroes ${week.heroes.map((h) => `${h.cls[0]}:${h.tier}`).join(' ')}`,
        );
      }
    }
  if (process.env.VERBOSE) console.log(rows.join('\n'));
  const sorted = [...touchTotals].sort((a, b) => a - b);
  console.log(`touches a game: median ${sorted[Math.floor(sorted.length / 2)]}, range ${sorted[0]}–${sorted[sorted.length - 1]} (${games} rosters)`);
  for (const difficulty of ['normal', 'hard'] as Difficulty[]) {
    const [e, sm, wins] = totals[difficulty];
    console.log(`${difficulty}: expert wins ${wins}/${games}, average margin expert ${(e / games).toFixed(1)}, smart ${(sm / games).toFixed(1)}`);
  }
  process.exit(0);
}

// ENC=crypt plays the sample week as that encounter (the same heroes and games, that encounter's horde).
if (process.env.ENC && process.env.ENC !== 'goblin-horde') {
  const { loadSeasonFile } = await import('../../../scripts/load-season');
  const { sampleWeek } = await import('../src/setup/buildWeek');
  const { setWeek } = await import('../src/week');
  setWeek(sampleWeek(loadSeasonFile('2025-26'), process.env.ENC));
}

for (const difficulty of ['normal', 'hard'] as Difficulty[]) {
  const expert = play(difficulty, 'expert', 1);
  console.log(`${difficulty} expert (every saved play and Iso, best defense): ${expert.party}-${expert.horde} breach@${expert.breachAt}`);
  console.log('  party', JSON.stringify(expert.stats.party), 'horde', JSON.stringify(expert.stats.horde));
  console.log('  heroes', JSON.stringify(Object.fromEntries(Object.entries(expert.stats.heroes).map(([k, v]) => [k, `${v.pts}p ${v.touches}t ${v.stops}s`]))));
  const smart = play(difficulty, 'smart', 1);
  console.log(
    `${difficulty} smart: ${smart.party}-${smart.horde} breach@${smart.breachAt} possessions ${smart.possessions} best-play change rate ${(smart.changes * 100).toFixed(0)}% avg gap ${smart.gap.toFixed(1)}`,
  );
  console.log('  party', JSON.stringify(smart.stats.party), 'horde', JSON.stringify(smart.stats.horde));
  console.log('  heroes', JSON.stringify(Object.fromEntries(Object.entries(smart.stats.heroes).map(([k, v]) => [k, `${v.pts}p ${v.touches}t ${v.stops}s`]))));
  const naive = Array.from({ length: 40 }, (_, i) => play(difficulty, 'naive', i + 7));
  const wins = naive.filter((r) => r.party > r.horde).length;
  const close = naive.filter((r) => Math.abs(r.party - r.horde) <= 5).length;
  const avg = (f: (r: (typeof naive)[number]) => number) => (naive.reduce((s, r) => s + f(r), 0) / naive.length).toFixed(1);
  console.log('  iso/hold so far', JSON.stringify(isoOrHold));
  console.log(
    `${difficulty} random bot x40: wins ${wins}, close ${close}, avg ${avg((r) => r.party)}-${avg((r) => r.horde)}, breach ${naive.filter((r) => r.breachAt >= 0).length}/40`,
  );
}

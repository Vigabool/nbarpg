/**
 * Enumerates every first possession a player can run in live moves (every hero, move and target choice the
 * live panel allows), plays the horde's first turn after each, and counts how many leave the Wizard standing.
 * Defense is automatic. Identical game states reached by different paths are merged, and their paths counted.
 * Run: npx tsx prototypes/play-calling/scripts/first-possession.ts [normal|hard]
 */
import { CLASS_INFO, MOVES, isFinisher, type Move } from '../src/content';
import { autoDefense, beginLive, finishLive, liveOptions, liveStepFast, maxPicks, newGame, onField, type Difficulty, type Live } from '../src/engine';

const difficulty = (process.argv[2] ?? 'hard') as Difficulty;
const start = beginLive(newGame(undefined, difficulty));

/** Every way to aim a move: one target, or each set (or ordered list, when order changes the result) of picks. */
function aims(l: Live, m: Move): (string[] | undefined)[] {
  const g = l.ctx.g;
  if ((m.targets ?? 'none') === 'none' || m.targets === 'all') return [undefined];
  if (g.barrierUp) return [[onField(g)[0].id]]; // Every aim hits the Barrier.
  const ids = onField(g).map((e) => e.id);
  const n = maxPicks(m, l.ctx.carry);
  if (n <= 1) return ids.map((id) => [id]);
  const ordered = !!m.hits || !!m.effect; // Hit order, or which pick gets the status, matters.
  const out: string[][] = [];
  const grow = (cur: string[], from: number) => {
    if (cur.length) out.push(cur);
    if (cur.length === n) return;
    ids.forEach((id, i) => {
      if (cur.includes(id)) return;
      if (!ordered && i < from) return;
      grow([...cur, id], i + 1);
    });
  };
  grow([], 0);
  return out;
}

/** The parts of a mid-possession state that decide what can still happen (not scores or logs). */
function key(l: Live): string {
  const g = l.ctx.g;
  const last = l.steps[l.steps.length - 1]?.cls ?? '';
  const counts = l.steps
    .map((s) => s.cls)
    .sort()
    .join(',');
  return JSON.stringify([
    // Goblins are interchangeable, so their order doesn't matter; Champions are listed by id.
    g.enemies.filter((e) => e.kind !== 'goblin').map((e) => [e.id, e.hp, e.taunted, e.exposed, e.disabled, e.slowed, e.quickUsed]),
    g.enemies
      .filter((e) => e.kind === 'goblin')
      .map((e) => JSON.stringify([e.arrived, e.hp, e.onRam, e.exposed, e.slowed]))
      .sort(),
    Object.values(g.heroes).map((h) => [h.hp, h.touches, h.armor, h.untargetable, h.lastStand, h.usedSpecial]),
    l.ctx.carry,
    g.barrierUp,
    g.blockUsed,
    g.last,
    l.steps.length,
    last,
    counts,
  ]);
}

interface Tally {
  total: number;
  standing: number;
  /** The same counts split by which heroes touched the ball (the rest defend). */
  byHeroes: Map<string, [number, number]>;
}
const memo = new Map<string, Tally>();
let states = 0;

function explore(l: Live): Tally {
  const k = key(l);
  const hit = memo.get(k);
  if (hit) return hit;
  states++;
  const opts = liveOptions(l);
  const t: Tally = { total: 0, standing: 0, byHeroes: new Map() };
  if (opts.done || opts.heroes.length === 0) {
    const def = autoDefense(l.ctx.g, new Set(l.steps.map((s) => s.cls)));
    const after = finishLive(l, def).game;
    const w = after.heroes.wizard;
    t.total = 1;
    t.standing = w.benched === 0 && w.hp > 0 ? 1 : 0;
    const used = [...new Set(l.steps.map((s) => CLASS_INFO[s.cls].name))].sort().join(' + ');
    t.byHeroes.set(used, [1, t.standing]);
    memo.set(k, t);
    return t;
  }
  for (const cls of opts.heroes) {
    const h = l.ctx.g.heroes[cls];
    for (const m of MOVES) {
      if (m.cls !== cls) continue;
      if (m.kind === 'signature' && !h.dd) continue;
      if (m.kind === 'legendary' && !h.td) continue;
      if (h.usedSpecial.includes(m.id)) continue;
      if (opts.finishersOnly && !isFinisher(m)) continue;
      // The live panel greys out moves that only apply a status while the Barrier is up.
      if (l.ctx.g.barrierUp && (m.targets ?? 'none') !== 'none' && !(m.damage ?? 0)) continue;
      for (const picks of aims(l, m)) {
        const next = liveStepFast(l, { cls, move: m.id }, picks?.[0], picks);
        const sub = explore(next);
        t.total += sub.total;
        t.standing += sub.standing;
        for (const [k2, [a, b]] of sub.byHeroes) {
          const cur = t.byHeroes.get(k2) ?? [0, 0];
          t.byHeroes.set(k2, [cur[0] + a, cur[1] + b]);
        }
      }
    }
  }
  memo.set(k, t);
  return t;
}

const g0 = start.ctx.g;
console.log(`Difficulty: ${difficulty}. Horde's call: ${g0.call?.name} (${g0.call?.text}). Barrier up: ${g0.barrierUp}.`);
console.log(
  `On the floor: ${onField(g0)
    .map((e) => e.name.replace('Goblin ', ''))
    .join(', ')}.`,
);
const t = explore(start);
console.log(`First possessions: ${t.total.toLocaleString()}`);
console.log(`Wizard still standing after the horde's turn: ${t.standing.toLocaleString()} (${((100 * t.standing) / t.total).toFixed(1)}%)`);
console.log(`Wizard dropped: ${(t.total - t.standing).toLocaleString()}`);
console.log(`Distinct game states explored: ${states.toLocaleString()}`);
console.log('\nBy heroes who touched the ball (everyone else defends):');
for (const [k2, [a, b]] of [...t.byHeroes].sort((x, y) => y[1][0] - x[1][0]))
  console.log(`  ${k2.padEnd(34)} ${a.toLocaleString().padStart(10)} possessions, Wizard standing in ${((100 * b) / a).toFixed(0).padStart(3)}%`);

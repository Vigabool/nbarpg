/**
 * The Play Calling prototype's rules: a deterministic Goblin Horde game of 12 party possessions,
 * each followed by an enemy turn. Pure functions over plain data; the UI replays the frames they return.
 */
import {
  CLASS_INFO,
  CLASSES,
  ENEMY_INFO,
  HORDE_PLAYS,
  MOVE,
  TIER_MULT,
  isFinisher,
  tierIndex,
  type Cls,
  type Enabler,
  type EnemyKind,
  type HordePlay,
  type Move,
  type Play,
  type PlayStep,
  type Tier,
} from './content';
import week from './week.json';

export interface Tuning {
  gateHp: number;
  goblinHp: number;
  shotPoints: number;
  championPoints: number;
  bossPoints: number;
  bountyPoints: number;
  usagePerTouch: number;
  hordeDamage: number;
  championHp: number;
  hordeHitPoints: number;
  crowd: number;
}
export const DEFAULT_TUNING: Tuning = {
  gateHp: 50,
  goblinHp: 9,
  shotPoints: 2,
  championPoints: 4,
  bossPoints: 8,
  bountyPoints: 6,
  usagePerTouch: 4.7,
  hordeDamage: 1,
  championHp: 1.25,
  hordeHitPoints: 3,
  crowd: 2,
};
export type Difficulty = 'normal' | 'hard';

export interface Hero {
  cls: Cls;
  player: string;
  team: string;
  opp: string;
  line: (typeof week.heroes)[number]['line'];
  tier: Tier;
  defTier: Tier;
  maxHp: number;
  hp: number;
  touches: number;
  touchesMax: number;
  dd: boolean;
  td: boolean;
  usedSpecial: string[];
  /** Party possessions left on the bench after falling (0 = playing). */
  benched: number;
  armor: number;
  exposed: boolean;
  untargetable: boolean;
  lastStand: boolean;
}

export interface Enemy {
  id: string;
  kind: EnemyKind;
  name: string;
  player?: string;
  team?: string;
  tier?: Tier;
  maxHp: number;
  hp: number;
  damage: number;
  armor: number;
  points: number;
  boss: boolean;
  onRam: boolean;
  quarter: number;
  arrived: boolean;
  taunted: boolean;
  exposed: number;
  disabled: boolean;
  pinned: boolean;
  stripped: boolean;
  poison: number;
  frost: boolean;
  summonedThisTurn: boolean;
  /** Taken down and already scored. */
  down: boolean;
}

export interface HordeCall {
  playId: string;
  name: string;
  /** Enemy ids by step (null where no actor is available). */
  actors: (string | null)[];
  target: Cls | null;
  text: string;
}

export interface Adjustment {
  id: 'double' | 'scout' | 'allHands' | 'lead';
  name: string;
  text: string;
  star?: Cls;
  playId?: string;
}

export interface Defense {
  protect?: Cls | 'gate';
  closeOut?: string;
  ward?: Cls;
}

export interface Stats {
  heroes: Record<Cls, { pts: number; ast: number; stops: number; touches: number; dmg: number }>;
  plays: Record<string, { calls: number; pts: number }>;
  party: { shots: number; takedowns: number; objectives: number };
  horde: { hits: number; takedowns: number; gate: number; pillage: number };
}

export interface LogLine {
  t: string;
  side: 'party' | 'horde' | 'info';
  pts?: number;
}

export interface Game {
  tuning: Tuning;
  difficulty: Difficulty;
  possession: number;
  phase: 'party' | 'halftime' | 'final';
  score: { party: number; horde: number };
  heroes: Record<Cls, Hero>;
  enemies: Enemy[];
  gate: { hp: number; max: number; breached: boolean; dmg: number };
  ramBase: number;
  ramBonus: number;
  bounty: 'open' | 'won' | 'lost';
  gold: number;
  call: HordeCall | null;
  lastPlayId: string | null;
  adjustment: Adjustment | null;
  timeouts: number;
  nextId: number;
  last: { crewDowns: Partial<Record<Cls, number>>; clericHealed: number };
  stats: Stats;
  log: LogLine[];
  chieftainTurns: number;
  /** An Elite Protect has blocked a hit this enemy turn. */
  blocked: boolean;
}

export interface Frame {
  game: Game;
  text: string;
  side: 'party' | 'horde' | 'info';
  actor?: Cls | string;
  target?: Cls | string;
  pts?: number;
  /** Which half of the possession: the party's play, the horde's turn, or the closing state. */
  phase?: 'party' | 'horde' | 'end';
  /** The play step this beat belongs to. */
  step?: number;
  kind?: 'step' | 'ko' | 'putback';
  /** The step's result in a few words (for the step strip). */
  result?: string;
}

const clone = <T>(x: T): T => structuredClone(x);
const tm = (t: Tier) => TIER_MULT[t];
export const quarterOf = (possession: number) => Math.min(4, Math.floor(possession / 3) + 1);

// ---------- Setup ----------

const ROLE_OF: Record<string, EnemyKind> = {
  warlock: 'hexer',
  hunter: 'sharpshooter',
  ogre: 'ogre',
  assassin: 'cutthroat',
  shaman: 'shaman',
  chieftain: 'chieftain',
};

export function ramDamageFromFg(pct: number): number {
  if (pct < 0.44) return 5;
  if (pct < 0.48) return 6;
  if (pct < 0.52) return 7;
  return 8;
}
export const opponentsFg = () => {
  const t = week.teams;
  // Weighted by goblins would hide low-scoring teams; a plain average of team FG% is easier to explain.
  return t.reduce((s, x) => s + x.fgPct, 0) / t.length;
};

export function newGame(tuning: Tuning = DEFAULT_TUNING, difficulty: Difficulty = 'normal'): Game {
  const heroes = {} as Record<Cls, Hero>;
  for (const h of week.heroes) {
    const cls = h.cls as Cls;
    const maxHp = CLASS_INFO[cls].hp;
    const touches = Math.max(2, Math.round(h.trueUsage / tuning.usagePerTouch));
    heroes[cls] = {
      cls,
      player: h.player,
      team: h.team,
      opp: h.opp,
      line: h.line,
      tier: h.tier as Tier,
      defTier: h.defTier as Tier,
      maxHp,
      hp: maxHp,
      touches,
      touchesMax: touches,
      dd: h.doubleDouble || h.tripleDouble,
      td: h.tripleDouble,
      usedSpecial: [],
      benched: 0,
      armor: 0,
      exposed: false,
      untargetable: false,
      lastStand: false,
    };
  }
  const mult = difficulty === 'normal' ? 1 : 1.12;
  let id = 1;
  const champs = week.champions.map((c) => {
    const kind = ROLE_OF[c.kind];
    const elite = c.tier === 'elite';
    return {
      id: `e${id++}`,
      kind,
      name: ENEMY_INFO[kind].name,
      player: c.player,
      team: c.team,
      tier: c.tier as Tier,
      maxHp: Math.round(c.hp * mult * tuning.championHp),
      hp: Math.round(c.hp * mult * tuning.championHp),
      damage: Math.round(c.damage * mult * tuning.hordeDamage),
      armor: kind === 'ogre' || kind === 'chieftain' ? 2 : 0,
      points: c.boss ? tuning.bossPoints : tuning.championPoints + (elite ? 2 : 0),
      boss: c.boss,
      onRam: false,
      quarter: 0,
      arrived: false,
      taunted: false,
      exposed: 0,
      disabled: false,
      pinned: false,
      stripped: false,
      poison: 0,
      frost: false,
      summonedThisTurn: false,
      down: false,
    } satisfies Enemy;
  });
  // Quarter script: Shaman and Hexer open; the two weaker of the rest arrive in Q2; the strongest and the Chieftain in Q3.
  const tierStrength = (e: Enemy) => tierIndex(e.tier ?? 'cold') * 1000 + e.maxHp;
  for (const e of champs) if (e.kind === 'shaman' || e.kind === 'hexer') e.quarter = 1;
  const rest = champs.filter((e) => !e.quarter && !e.boss).sort((a, b) => tierStrength(a) - tierStrength(b));
  rest.forEach((e, i) => (e.quarter = i < 2 ? 2 : 3));
  for (const e of champs) if (e.boss) e.quarter = 3;

  const goblins = week.teams.reduce((s, t) => s + t.goblins, 0);
  const q1 = Math.round(goblins * 0.3);
  const q2 = Math.round(goblins * 0.35);
  const enemies: Enemy[] = [...champs];
  for (let i = 0; i < goblins; i++) enemies.push(goblin(`e${id++}`, tuning, i < q1 ? 1 : i < q1 + q2 ? 2 : 3));
  enemies.push({
    ...goblin(`e${id++}`, tuning, 2),
    kind: 'wagon',
    name: ENEMY_INFO.wagon.name,
    maxHp: 15,
    hp: 15,
    damage: 0,
    points: 3,
  });

  const stats: Stats = {
    heroes: Object.fromEntries(CLASSES.map((c) => [c, { pts: 0, ast: 0, stops: 0, touches: 0, dmg: 0 }])) as Stats['heroes'],
    plays: {},
    party: { shots: 0, takedowns: 0, objectives: 0 },
    horde: { hits: 0, takedowns: 0, gate: 0, pillage: 0 },
  };
  const g: Game = {
    tuning,
    difficulty,
    possession: 0,
    phase: 'party',
    score: { party: 0, horde: 0 },
    heroes,
    enemies,
    gate: { hp: tuning.gateHp, max: tuning.gateHp, breached: false, dmg: 0 },
    ramBase: ramDamageFromFg(opponentsFg()),
    ramBonus: 0,
    bounty: 'open',
    gold: 0,
    call: null,
    lastPlayId: null,
    adjustment: null,
    timeouts: 2,
    nextId: id,
    last: { crewDowns: {}, clericHealed: 0 },
    stats,
    log: [],
    chieftainTurns: 0,
    blocked: false,
  };
  arrive(g);
  g.call = chooseCall(g);
  return g;
}

function goblin(id: string, tuning: Tuning, quarter: number): Enemy {
  return {
    id,
    kind: 'goblin',
    name: 'Goblin',
    maxHp: tuning.goblinHp,
    hp: tuning.goblinHp,
    damage: 3,
    armor: 0,
    points: 1,
    boss: false,
    onRam: false,
    quarter,
    arrived: false,
    taunted: false,
    exposed: 0,
    disabled: false,
    pinned: false,
    stripped: false,
    poison: 0,
    frost: false,
    summonedThisTurn: false,
    down: false,
  };
}

/** Bring in this quarter's arrivals; goblins fill the ram to 4 first. */
function arrive(g: Game) {
  const q = quarterOf(g.possession);
  let any = false;
  for (const e of g.enemies)
    if (!e.arrived && e.quarter <= q && e.hp > 0) {
      e.arrived = true;
      any = true;
      if (e.kind === 'goblin' && !g.gate.breached && crew(g).length < 4) e.onRam = true;
    }
  if (any && g.possession > 0) g.log.push({ t: `Quarter ${q}: new arrivals take the floor.`, side: 'info' });
}

// ---------- Queries ----------

export const onField = (g: Game) => g.enemies.filter((e) => e.arrived && e.hp > 0);
export const crew = (g: Game) => onField(g).filter((e) => e.kind === 'goblin' && e.onRam);
/** Goblins actually pushing the ram this turn. */
export const pushing = (g: Game) => crew(g).filter((e) => !e.pinned && !e.stripped);
export const freeGoblins = (g: Game) => onField(g).filter((e) => e.kind === 'goblin' && !e.onRam);
export const activeHeroes = (g: Game) => CLASSES.map((c) => g.heroes[c]).filter((h) => h.benched === 0 && h.hp > 0);
const isChampion = (e: Enemy) => e.kind !== 'goblin' && e.kind !== 'wagon';

export function crowdLimit(g: Game) {
  const a = g.adjustment;
  const lead = a?.id === 'lead' && (g.difficulty === 'hard' || quarterOf(g.possession) === 3);
  return lead ? Math.max(1, g.tuning.crowd - 1) : g.tuning.crowd;
}

/** Whether an enemy is contested before any of this play's effects. */
export function contestedBase(g: Game, e: Enemy): boolean {
  if (e.taunted || e.disabled) return false;
  if (e.kind === 'goblin') return false;
  if (e.kind === 'wagon') return onField(g).some((x) => x.kind === 'cutthroat');
  return freeGoblins(g).length >= crowdLimit(g);
}

function starDoubled(g: Game, cls: Cls) {
  const a = g.adjustment;
  return a?.id === 'double' && a.star === cls && (g.difficulty === 'hard' || quarterOf(g.possession) === 3);
}

export function playAvailable(g: Game, play: Play): { ok: boolean; why?: string } {
  const need: Partial<Record<Cls, number>> = {};
  for (const s of play.steps) need[s.cls] = (need[s.cls] ?? 0) + 1;
  for (const [c, n] of Object.entries(need) as [Cls, number][]) {
    const h = g.heroes[c];
    if (h.benched > 0 || h.hp <= 0) return { ok: false, why: `${CLASS_INFO[c].name} is on the bench` };
    if (h.touches < n) return { ok: false, why: `${CLASS_INFO[c].name} is out of touches` };
  }
  for (const s of play.steps) {
    const m = MOVE[s.move];
    if (m.kind === 'signature' && !g.heroes[s.cls].dd) return { ok: false, why: `${m.name} needs a double-double` };
    if (m.kind === 'legendary' && !g.heroes[s.cls].td) return { ok: false, why: `${m.name} needs a triple-double` };
    if ((m.kind === 'signature' || m.kind === 'legendary') && g.heroes[s.cls].usedSpecial.includes(m.id)) return { ok: false, why: `${m.name} is used` };
  }
  return { ok: true };
}

/** Problems with a play's shape (for the designer). */
export function validatePlay(steps: { cls: Cls; move: string }[]): string[] {
  const out: string[] = [];
  if (steps.length < 2 || steps.length > 4) out.push('A play has 2 to 4 steps.');
  steps.forEach((s, i) => {
    if (MOVE[s.move]?.cls !== s.cls) out.push(`Step ${i + 1}: pick a move for this hero.`);
    if (i > 0 && steps[i - 1].cls === s.cls) out.push(`Step ${i + 1}: a hero can't act twice in a row.`);
    const m = MOVE[s.move];
    if (m && isFinisher(m) && i !== steps.length - 1) out.push(`Step ${i + 1}: finishers go last.`);
  });
  const last = steps[steps.length - 1];
  if (last && MOVE[last.move] && !isFinisher(MOVE[last.move])) out.push('The last step must be a finisher.');
  const counts: Record<string, number> = {};
  for (const s of steps) counts[s.cls] = (counts[s.cls] ?? 0) + 1;
  for (const [c, n] of Object.entries(counts)) if (n > 2) out.push(`${CLASS_INFO[c as Cls].name} appears more than twice.`);
  return out;
}

/** Whether an enabler helps the step it's passed to. */
export function passHelps(from: Move, to: Move | undefined): boolean {
  const e = from.enabler;
  if (!e || !to) return false;
  const deals = (to.damage ?? 0) > 0;
  switch (e.kind) {
    case 'heal':
    case 'armor':
      return true;
    case 'open':
    case 'putback':
      return isFinisher(to);
    case 'split':
      return deals && to.targets !== 'all';
    case 'double':
      return !!to.enabler && ['damage', 'heal', 'armor', 'vsPoison', 'vsMarked'].includes(to.enabler.kind);
    default:
      return deals;
  }
}

// ---------- The horde's call ----------

function actorFor(g: Game, kinds: EnemyKind[]): Enemy | undefined {
  const field = onField(g);
  for (const k of kinds) {
    const e = field.find((x) => x.kind === k);
    if (e) return e;
  }
  return undefined;
}

function heroTarget(g: Game, rule: HordePlay['target']): Cls | null {
  const hs = activeHeroes(g).filter((h) => !h.untargetable);
  if (!hs.length) return null;
  const lowest = [...hs].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0].cls;
  if (rule === 'cleric') return hs.some((h) => h.cls === 'cleric') ? 'cleric' : lowest;
  if (rule === 'disruptor') {
    const d = (Object.entries(g.last.crewDowns) as [Cls, number][]).filter(([c]) => hs.some((h) => h.cls === c)).sort((a, b) => b[1] - a[1])[0];
    return d ? d[0] : lowest;
  }
  if (rule === 'wounded') return lowest;
  // 'lowest': the hero with the least HP left.
  return [...hs].sort((a, b) => a.hp - b.hp)[0].cls;
}

function triggered(g: Game, p: HordePlay): boolean {
  switch (p.id) {
    case 'reinforce':
      return !g.gate.breached && crew(g).length < 4;
    case 'hunt':
      return Object.values(g.last.crewDowns).some((n) => (n ?? 0) >= 2);
    case 'healer':
      return g.last.clericHealed >= 10 && activeHeroes(g).some((h) => h.cls === 'cleric');
    case 'toss':
      return activeHeroes(g).some((h) => h.hp < h.maxHp / 3);
    default:
      return true;
  }
}

export function chooseCall(g: Game): HordeCall | null {
  for (const p of HORDE_PLAYS) {
    if (!triggered(g, p)) continue;
    const actors = p.steps.map((s) => actorFor(g, s.actors) ?? null);
    // Every horde play needs its pass and its finisher.
    if (actors.some((a) => !a)) continue;
    if (new Set(actors.map((a) => a!.id)).size < actors.length) continue;
    const target = heroTarget(g, p.target);
    if (!target) return null;
    const names = actors.map((a) => a!.name.replace('Goblin ', ''));
    return { playId: p.id, name: p.name, actors: actors.map((a) => a!.id), target, text: `${names.join(' → ')} → ${CLASS_INFO[target].name}` };
  }
  return null;
}

// ---------- The party's possession ----------

export interface Carry {
  dmg: number;
  crit: boolean;
  empower: boolean;
  open: boolean;
  split: boolean;
  heal: number;
  armor: number;
  putbackFrom: Cls | null;
  ignoreArmor: boolean;
  double: boolean;
  vsPoison: number;
  vsMarked: number;
  passer: Cls | null;
}
const emptyCarry = (): Carry => ({
  dmg: 0,
  crit: false,
  empower: false,
  open: false,
  split: false,
  heal: 0,
  armor: 0,
  putbackFrom: null,
  ignoreArmor: false,
  double: false,
  vsPoison: 0,
  vsMarked: 0,
  passer: null,
});

function enablerCarry(e: Enabler | undefined, mult: number, double: boolean, scouted: boolean, from: Cls): Carry {
  const c = emptyCarry();
  c.passer = from;
  if (!e) return c;
  const k = (double ? 2 : 1) * (scouted ? 0.5 : 1);
  const n = (x: number) => Math.round(x * mult * k);
  if (scouted && (e.kind === 'open' || e.kind === 'split' || e.kind === 'crit' || e.kind === 'empower' || e.kind === 'putback' || e.kind === 'double'))
    return c;
  switch (e.kind) {
    case 'damage':
      c.dmg = n(e.amount);
      break;
    case 'crit':
      c.crit = true;
      break;
    case 'empower':
      c.empower = true;
      break;
    case 'open':
      c.open = true;
      break;
    case 'split':
      c.split = true;
      break;
    case 'heal':
      c.heal = n(e.amount);
      break;
    case 'armor':
      c.armor = n(e.amount);
      break;
    case 'putback':
      c.putbackFrom = from;
      break;
    case 'ignoreArmor':
      c.ignoreArmor = true;
      break;
    case 'double':
      c.double = true;
      break;
    case 'vsPoison':
      c.vsPoison = n(e.amount);
      break;
    case 'vsMarked':
      c.vsMarked = n(e.amount);
      break;
  }
  return c;
}

function pickTargets(g: Game, primary: Enemy, n: number): Enemy[] {
  const others = onField(g)
    .filter((e) => e.id !== primary.id && e.kind !== 'wagon')
    .sort((a, b) => Number(b.onRam) - Number(a.onRam) || a.hp - b.hp);
  return [primary, ...others].slice(0, n);
}

function takedown(g: Game, e: Enemy, by: Cls, frames: Frame[], rec: boolean, playId?: string) {
  if (e.hp > 0 || e.down) return;
  e.hp = 0;
  e.down = true;
  const wasCrew = e.kind === 'goblin' && e.onRam;
  e.onRam = false;
  let pts = e.points;
  let text = `${e.name} goes down: +${pts}`;
  if (e.kind === 'wagon') {
    g.gold += 5;
    g.stats.party.objectives += pts;
    text = `The loot wagon breaks open: +${pts} and 5 gold`;
  } else g.stats.party.takedowns += pts;
  if (e.kind === 'shaman' && g.bounty === 'open') {
    g.bounty = 'won';
    pts += g.tuning.bountyPoints;
    g.stats.party.objectives += g.tuning.bountyPoints;
    text += `, and the Shaman bounty: +${g.tuning.bountyPoints}`;
  }
  // Crew takedowns provoke the horde's Hunt.
  if (wasCrew) g.last.crewDowns[by] = (g.last.crewDowns[by] ?? 0) + 1;
  award(g, by, pts, playId);
  if (rec) frames.push({ game: clone(g), text, side: 'party', actor: by, target: e.id, pts, kind: 'ko' });
}

/** Score every enemy that has just gone down. */
function sweep(g: Game, by: Cls, frames: Frame[], rec: boolean, playId?: string) {
  for (const e of g.enemies) if (e.arrived && e.hp <= 0 && !e.down) takedown(g, e, by, frames, rec, playId);
}

function award(g: Game, by: Cls, pts: number, playId?: string) {
  g.score.party += pts;
  g.stats.heroes[by].pts += pts;
  if (playId) {
    g.stats.plays[playId] ??= { calls: 0, pts: 0 };
    g.stats.plays[playId].pts += pts;
  }
}

/**
 * Run the party's play on a primary target, then (unless preview) the enemy turn.
 * Returns every frame so the UI can replay the possession.
 */
interface StepCtx {
  g: Game;
  frames: Frame[];
  rec: boolean;
  carry: Carry;
  scouted: boolean;
  playId: string;
}

/** One hero's step: receive the pass, act, score, then pass on. */
function doStep(ctx: StepCtx, step: PlayStep, i: number, primaryId: string) {
  const { g, frames, rec, scouted } = ctx;
  const snap = () => (rec ? clone(g) : g);
  let carry = ctx.carry;
  const firstFrame = frames.length;
  const h = g.heroes[step.cls];
  const m = MOVE[step.move];
  const mult = tm(h.tier);
  h.touches -= 1;
  g.stats.heroes[h.cls].touches += 1;
  // Receive the pass.
  if (carry.heal) {
    const healed = Math.min(h.maxHp - h.hp, carry.heal);
    h.hp += healed;
    if (carry.passer === 'cleric') g.last.clericHealed += healed;
  }
  if (carry.armor) h.armor += carry.armor;
  const primary = g.enemies.find((e) => e.id === primaryId && e.hp > 0) ?? onField(g)[0];
  if (m.kind === 'signature' || m.kind === 'legendary') h.usedSpecial.push(m.id);
  const scoreBefore = g.score.party;
  const parts: string[] = [];

  // Effects that don't need an enemy.
  switch (m.effect) {
    case 'partyArmor':
      for (const x of activeHeroes(g)) x.armor += Math.round((m.amount ?? 0) * mult);
      parts.push(`every hero +${Math.round((m.amount ?? 0) * mult)} armor`);
      break;
    case 'healAlly': {
      const t = [...activeHeroes(g)].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (t) {
        const healed = Math.min(t.maxHp - t.hp, Math.round((m.amount ?? 0) * mult));
        t.hp += healed;
        g.last.clericHealed += healed;
        parts.push(healed ? `heals the ${CLASS_INFO[t.cls].name} ${healed}` : 'no one needs healing');
      }
      break;
    }
    case 'healParty':
    case 'healParty15': {
      let total = 0;
      for (const x of activeHeroes(g)) {
        const healed = Math.min(x.maxHp - x.hp, Math.round((m.amount ?? 0) * mult));
        x.hp += healed;
        total += healed;
      }
      g.last.clericHealed += total;
      parts.push(`heals the party ${total}`);
      break;
    }
    case 'lastStand':
      h.lastStand = true;
      parts.push("can't fall for the rest of the game");
      break;
    case 'shadow':
      h.untargetable = true;
      break;
    case 'revive':
      for (const x of CLASSES.map((c) => g.heroes[c]))
        if (x.benched > 0) {
          x.benched = 0;
          x.hp = x.maxHp;
          parts.push(`the ${CLASS_INFO[x.cls].name} returns`);
        }
      break;
  }

  if (primary) {
    const fin = isFinisher(m);
    // Targets.
    let targets: Enemy[] = [];
    if (m.targets === 'all') targets = onField(g);
    else if (m.targets === 'multi') targets = pickTargets(g, primary, (m.count ?? 1) + (carry.split ? 1 : 0));
    else if (m.targets === 'primary' || m.targets === 'double') targets = carry.split ? pickTargets(g, primary, 2) : [primary];
    if (m.effect === 'pin' && primary.kind !== 'goblin') {
      const c = crew(g).find((e) => !e.pinned);
      targets = c ? [c] : [];
    }
    const openPrimary = m.ignoresContest || carry.open || !(contestedBase(g, primary) || starDoubled(g, h.cls));

    const hit = (e: Enemy, base: number): number => {
      if (e.hp <= 0) return 0;
      let d = base * mult + carry.dmg;
      if (e.exposed > 0) d += 3;
      if (e.poison > 0) d += carry.vsPoison;
      if (e.exposed > 0) d += carry.vsMarked;
      if (m.doubleVsShaken && (e.taunted || e.disabled)) d *= 2;
      if (carry.crit || m.alwaysCrit) d *= 2;
      if (carry.empower) d *= 1.5;
      const contested = fin && !m.ignoresContest && !carry.open && (contestedBase(g, e) || starDoubled(g, h.cls));
      if (contested) d *= 0.5;
      if (!(m.ignoreArmor || carry.ignoreArmor)) d -= e.armor;
      const dealt = Math.max(0, Math.min(e.hp, Math.round(d)));
      e.hp -= dealt;
      g.stats.heroes[h.cls].dmg += dealt;
      return dealt;
    };

    if (m.effect === 'assassinate') {
      if (!primary.boss) {
        const dealt = primary.hp;
        primary.hp = 0;
        parts.push(`assassinates the ${primary.name}`);
        g.stats.heroes[h.cls].dmg += dealt;
      } else parts.push(`${hit(primary, m.damage ?? 0)} to the ${primary.name}`);
    } else if (m.damage) {
      if (m.targets === 'double') {
        const first = hit(primary, m.damage);
        const next = primary.hp > 0 ? primary : pickTargets(g, primary, 2)[1];
        const second = next ? hit(next, m.damage) : 0;
        parts.push(`${first} + ${second} damage`);
        for (const t of targets.slice(1)) parts.push(`${hit(t, m.damage)} to the ${t.name}`);
      } else {
        const dealt = targets.map((t) => ({ t, d: hit(t, m.damage!) }));
        parts.push(dealt.length === 1 ? `${dealt[0].d} to the ${dealt[0].t.name}` : `${dealt.reduce((s, x) => s + x.d, 0)} across ${dealt.length} enemies`);
      }
    }

    // Statuses on the enemy.
    switch (m.effect) {
      case 'taunt':
        primary.taunted = true;
        parts.push('taunted');
        break;
      case 'tauntAll':
        for (const e of onField(g)) e.taunted = true;
        parts.push('every enemy taunted');
        break;
      case 'expose':
        for (const t of targets) t.exposed = Math.max(t.exposed, 1);
        parts.push('Exposed');
        break;
      case 'mark':
        primary.exposed = 2;
        parts.push('Marked');
        break;
      case 'strip':
        if (isChampion(primary) && !primary.boss) {
          primary.disabled = true;
          parts.push('Disabled');
        } else {
          primary.exposed = Math.max(primary.exposed, 1);
          parts.push('Exposed');
        }
        break;
      case 'poison':
        primary.poison = Math.round((m.amount ?? 3) * mult);
        parts.push('poisoned');
        break;
      case 'pin':
        for (const t of targets) t.pinned = true;
        parts.push(targets.length ? 'a goblin Pinned off the ram' : 'no goblin to Pin');
        break;
      case 'frost':
        primary.frost = true;
        parts.push('Frosted');
        break;
    }

    if (fin) {
      const name = primary.name;
      if (openPrimary) {
        const pts = m.three ? 3 : g.tuning.shotPoints;
        g.stats.party.shots += pts;
        award(g, h.cls, pts, ctx.playId);
        if (carry.passer) g.stats.heroes[carry.passer].ast += 1;
        parts.push(`open look on the ${name}: +${pts}`);
      } else parts.push(`contested by the crowd: no shot points`);
    }
    frames.push({
      game: snap(),
      text: `${CLASS_INFO[h.cls].name} · ${m.name}: ${parts.join(', ')}`,
      side: 'party',
      actor: h.cls,
      target: primary.id,
      pts: g.score.party - scoreBefore || undefined,
      kind: 'step',
      result: parts.join(', '),
    });
    sweep(g, h.cls, frames, rec, ctx.playId);

    // Putback.
    if (fin && carry.putbackFrom && primary.hp > 0) {
      const p = g.heroes[carry.putbackFrom];
      const half = Math.max(1, Math.round(((m.damage ?? 0) * mult) / 2));
      const dealt = Math.min(primary.hp, Math.max(0, half - primary.armor));
      primary.hp -= dealt;
      let pts = 0;
      if (!(contestedBase(g, primary) || starDoubled(g, p.cls))) {
        pts = g.tuning.shotPoints;
        g.stats.party.shots += pts;
        award(g, p.cls, pts, ctx.playId);
      }
      frames.push({
        game: snap(),
        text: `${CLASS_INFO[p.cls].name} · putback: ${dealt} to the ${primary.name}${pts ? `: +${pts}` : ''}`,
        side: 'party',
        actor: p.cls,
        target: primary.id,
        pts: pts || undefined,
        kind: 'putback',
        result: `putback ${dealt}${pts ? `, +${pts}` : ''}`,
      });
      sweep(g, p.cls, frames, rec, ctx.playId);
    }
  } else {
    frames.push({
      game: snap(),
      text: `${CLASS_INFO[h.cls].name} · ${m.name}: ${parts.join(', ') || 'no target'}`,
      side: 'party',
      actor: h.cls,
      kind: 'step',
      result: parts.join(', ') || 'no target',
    });
  }

  // Pass on.
  carry = enablerCarry(m.enabler, mult, carry.double, scouted, h.cls);
  for (let k = firstFrame; k < frames.length; k++) frames[k].step = i;
  ctx.carry = carry;
}

export function runPossession(g0: Game, play: Play, primaryId: string, defense: Defense, opts: { preview?: boolean } = {}): { game: Game; frames: Frame[] } {
  const g = clone(g0);
  const frames: Frame[] = [];
  const rec = !opts.preview;
  const scouted = g.lastPlayId === play.id;
  g.stats.plays[play.id] ??= { calls: 0, pts: 0 };
  g.stats.plays[play.id].calls += 1;
  g.last = { crewDowns: {}, clericHealed: 0 };
  if (scouted)
    frames.push({ game: rec ? clone(g) : g, text: `${play.name} was just run: the defense has it scouted, so its passes count for half.`, side: 'info' });
  const startScore = g.score.party;

  const ctx: StepCtx = { g, frames, rec, carry: emptyCarry(), scouted, playId: play.id };
  play.steps.forEach((step, i) => doStep(ctx, step, i, primaryId));

  g.log.push({ t: `${play.name}: +${g.score.party - startScore}`, side: 'party', pts: g.score.party - startScore });
  g.lastPlayId = play.id;
  // Exposed fades at the end of the possession (a Mark lasts one more).
  for (const e of g.enemies) e.exposed = Math.max(0, e.exposed - 1);

  if (opts.preview) return { game: g, frames };

  const inPlay = new Set(play.steps.map((s) => s.cls));
  const partyEnd = frames.length;
  enemyTurn(g, inPlay, defense, frames);
  endPossession(g, frames);
  markPhases(frames, partyEnd);
  return { game: g, frames };
}

// ---------- Live possessions: one step at a time ----------

export interface Live {
  ctx: StepCtx;
  steps: PlayStep[];
  startScore: number;
}

export function beginLive(g0: Game): Live {
  const g = clone(g0);
  g.last = { crewDowns: {}, clericHealed: 0 };
  g.stats.plays.live ??= { calls: 0, pts: 0 };
  g.stats.plays.live.calls += 1;
  return { ctx: { g, frames: [], rec: true, carry: emptyCarry(), scouted: false, playId: 'live' }, steps: [], startScore: g.score.party };
}

export function liveStep(l0: Live, step: PlayStep, targetId?: string): Live {
  const l = structuredClone(l0);
  doStep(l.ctx, step, l.steps.length, targetId ?? onField(l.ctx.g)[0]?.id ?? '');
  l.steps.push(step);
  return l;
}

/** What a step would do, without recording it. */
export function previewLive(l: Live, step: PlayStep, targetId?: string): { damage: number; kills: number; points: number; open: boolean } {
  const ctx: StepCtx = { ...l.ctx, g: clone(l.ctx.g), frames: [], rec: false, carry: { ...l.ctx.carry } };
  const before = new Map(ctx.g.enemies.map((e) => [e.id, e.hp]));
  const shots = ctx.g.stats.party.shots;
  doStep(ctx, step, l.steps.length, targetId ?? onField(ctx.g)[0]?.id ?? '');
  let damage = 0;
  let kills = 0;
  for (const e of ctx.g.enemies) {
    const b = before.get(e.id) ?? 0;
    if (b > 0) damage += b - Math.max(0, e.hp);
    if (b > 0 && e.hp <= 0) kills += 1;
  }
  return { damage, kills, points: ctx.g.score.party - l.ctx.g.score.party, open: ctx.g.stats.party.shots > shots };
}

/** Which heroes can take the next step, and whether the shot clock leaves only finishers. */
export function liveOptions(l: Live): { heroes: Cls[]; finishersOnly: boolean; done: boolean } {
  const g = l.ctx.g;
  const last = l.steps[l.steps.length - 1];
  const finished = !!last && isFinisher(MOVE[last.move]);
  const heroes = activeHeroes(g)
    .filter((h) => h.touches > 0 && h.cls !== last?.cls && l.steps.filter((s) => s.cls === h.cls).length < 2)
    .map((h) => h.cls);
  return { heroes, finishersOnly: l.steps.length >= 3, done: finished || l.steps.length >= 4 };
}

export function describeCarry(c: Carry): string[] {
  const out: string[] = [];
  if (c.dmg) out.push(`+${c.dmg} damage`);
  if (c.crit) out.push('crit (double damage)');
  if (c.empower) out.push('+50% damage');
  if (c.open) out.push('open look');
  if (c.split) out.push('split (+1 target)');
  if (c.heal) out.push(`heal ${c.heal}`);
  if (c.armor) out.push(`armor +${c.armor}`);
  if (c.putbackFrom) out.push('putback');
  if (c.ignoreArmor) out.push('ignores armor');
  if (c.double) out.push("doubles the next hero's pass");
  if (c.vsPoison) out.push(`+${c.vsPoison} on a poisoned enemy`);
  if (c.vsMarked) out.push(`+${c.vsMarked} on the marked enemy`);
  return out;
}

/** End the party's half (with or without a finisher) and play the horde's turn. */
export function finishLive(l: Live, defense: Defense): { game: Game; frames: Frame[] } {
  const g = clone(l.ctx.g);
  const frames = [...l.ctx.frames];
  const last = l.steps[l.steps.length - 1];
  if (!last || !isFinisher(MOVE[last.move])) frames.push({ game: clone(g), text: 'Shot-clock violation: the possession ends without a shot.', side: 'info' });
  g.log.push({ t: `Live possession: +${g.score.party - l.startScore}`, side: 'party', pts: g.score.party - l.startScore });
  g.lastPlayId = null;
  for (const e of g.enemies) e.exposed = Math.max(0, e.exposed - 1);
  const inPlay = new Set(l.steps.map((s) => s.cls));
  const partyEnd = frames.length;
  enemyTurn(g, inPlay, defense, frames);
  endPossession(g, frames);
  markPhases(frames, Math.max(1, partyEnd));
  return { game: g, frames };
}

function markPhases(frames: Frame[], partyEnd: number) {
  frames.forEach((f, k) => (f.phase = k < partyEnd ? 'party' : 'horde'));
  frames[frames.length - 1].phase = 'end';
}

/** The always-available fallback: one hero takes a finisher alone. */
export function isoPlay(cls: Cls): Play {
  const fin = { warrior: 'slam', cleric: 'smite', rogue: 'backstab', wizard: 'lightning', ranger: 'aimed' }[cls];
  return { id: `iso-${cls}`, name: `Iso: ${CLASS_INFO[cls].name}`, steps: [{ cls, move: fin }], tags: ['iso'] };
}

/** No one can touch the ball: the horde gets its turn with every hero on defense. */
export function holdPossession(g0: Game, defense: Defense): { game: Game; frames: Frame[] } {
  const g = clone(g0);
  const frames: Frame[] = [{ game: clone(g), text: 'Nobody has touches left: the party holds the ball and defends.', side: 'info' }];
  g.last = { crewDowns: {}, clericHealed: 0 };
  for (const e of g.enemies) e.exposed = Math.max(0, e.exposed - 1);
  enemyTurn(g, new Set(), defense, frames);
  endPossession(g, frames);
  markPhases(frames, 1);
  return { game: g, frames };
}

// ---------- Defense ----------

export function defenders(g: Game, inPlay: Set<Cls>): Cls[] {
  return activeHeroes(g)
    .map((h) => h.cls)
    .filter((c) => !inPlay.has(c));
}

/** The automatic defensive targets for the heroes off the ball. */
export function autoDefense(g: Game, inPlay: Set<Cls>): Defense {
  const d: Defense = {};
  const off = new Set(defenders(g, inPlay));
  const call = g.call;
  const target = call?.target ?? null;
  if (off.has('warrior')) d.protect = target && target !== 'warrior' ? target : g.gate.breached ? (target ?? 'wizard') : 'gate';
  if (off.has('ranger') && call) {
    const fin = call.actors[call.actors.length - 1];
    const ranged = onField(g).find((e) => e.kind === 'sharpshooter');
    d.closeOut = fin ?? ranged?.id;
  }
  if (off.has('wizard')) {
    const hs = activeHeroes(g).filter((h) => h.cls !== d.protect);
    const t = target && target !== d.protect && hs.some((h) => h.cls === target) ? target : [...hs].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]?.cls;
    if (t) d.ward = t;
  }
  return d;
}

// ---------- The enemy turn ----------

function hordeHit(g: Game, actor: Enemy, targetCls: Cls, bonus: number, defense: Defense, off: Set<Cls>, frames: Frame[], label: string) {
  let cls = targetCls;
  const w = g.heroes.warrior;
  if (actor.taunted && w.benched === 0 && w.hp > 0) cls = 'warrior';
  let h = g.heroes[cls];
  if (h.benched > 0 || h.hp <= 0 || h.untargetable) {
    const alt = activeHeroes(g)
      .filter((x) => !x.untargetable)
      .sort((a, b) => a.hp - b.hp)[0];
    if (!alt) return;
    h = alt;
    cls = alt.cls;
  }
  let d = actor.damage + bonus + (h.exposed ? 3 : 0);
  if (actor.frost) {
    d = Math.floor(d / 2);
    actor.frost = false;
  }
  const protectedHere = off.has('warrior') && defense.protect === cls;
  const closedOut = off.has('ranger') && defense.closeOut === actor.id;
  const contested = protectedHere || closedOut;
  const notes: string[] = [];
  if (protectedHere && tierIndex(g.heroes.warrior.defTier) >= tierIndex('elite') && !g.blocked) {
    g.blocked = true;
    d = 0;
    notes.push('blocked by the Warrior');
  } else if (contested) {
    d = Math.floor(d / 2);
    notes.push(protectedHere ? 'contested by the Warrior' : 'contested by the Ranger');
  }
  if (contested) g.stats.heroes[protectedHere ? 'warrior' : 'ranger'].stops += 1;
  d = Math.max(0, d - h.armor);
  h.hp -= d;
  let pts = 0;
  if (!contested && d > 0) {
    pts += g.tuning.hordeHitPoints;
    g.stats.horde.hits += g.tuning.hordeHitPoints;
  }
  if (h.hp <= 0) {
    if (h.lastStand) h.hp = 1;
    else {
      h.hp = 0;
      h.benched = 3;
      pts += 4;
      g.stats.horde.takedowns += 4;
      notes.push(`the ${CLASS_INFO[cls].name} goes down`);
    }
  }
  g.score.horde += pts;
  frames.push({
    game: clone(g),
    text: `${actor.name} · ${label}: ${d} to the ${CLASS_INFO[cls].name}${notes.length ? ` (${notes.join(', ')})` : ''}${pts ? `: +${pts}` : ''}`,
    side: 'horde',
    actor: actor.id,
    target: cls,
    pts: pts || undefined,
  });
}

function summon(g: Game, n: number, frames: Frame[], who: string) {
  for (let i = 0; i < n; i++) {
    const e = goblin(`e${g.nextId++}`, g.tuning, quarterOf(g.possession));
    e.arrived = true;
    e.summonedThisTurn = true;
    e.onRam = !g.gate.breached && crew(g).length < 6;
    g.enemies.push(e);
  }
  frames.push({ game: clone(g), text: `${who} calls the pack: ${n} goblins${g.gate.breached ? '' : ' head for the ram'}.`, side: 'horde', actor: who });
}

function enemyTurn(g: Game, inPlay: Set<Cls>, defense: Defense, frames: Frame[]) {
  const off = new Set(defenders(g, inPlay));
  g.blocked = false;
  // Ward and Strip the Ball happen first.
  if (off.has('wizard') && defense.ward) {
    const a = Math.round(4 * tm(g.heroes.wizard.defTier));
    g.heroes[defense.ward].armor += a;
  }
  if (off.has('rogue') && !g.gate.breached) {
    const n = tierIndex(g.heroes.rogue.defTier) >= tierIndex('elite') ? 2 : 1;
    const ps = pushing(g).slice(0, n);
    for (const e of ps) e.stripped = true;
    if (ps.length) {
      g.stats.heroes.rogue.stops += ps.length;
      frames.push({
        game: clone(g),
        text: `Rogue · Strip the Ball: ${ps.length} goblin${ps.length > 1 ? 's' : ''} knocked off the ram.`,
        side: 'party',
        actor: 'rogue',
      });
    }
  }

  // The called play, or a new one if its actors are gone.
  let call = g.call;
  const alive = (id: string | null) => !!id && g.enemies.some((e) => e.id === id && e.hp > 0 && e.arrived);
  if (!call || call.actors.some((a) => !alive(a))) {
    const fresh = chooseCall(g);
    if (fresh && call) frames.push({ game: clone(g), text: `The horde switches to ${fresh.name}.`, side: 'horde' });
    call = fresh;
  }
  let ramBoost = 0;
  if (call) {
    const play = HORDE_PLAYS.find((p) => p.id === call!.playId)!;
    let bonus = 0;
    play.steps.forEach((s, i) => {
      const actor = g.enemies.find((e) => e.id === call!.actors[i]);
      if (!actor || actor.hp <= 0) return;
      if (actor.disabled) {
        frames.push({ game: clone(g), text: `${actor.name} is Disabled and drops out of ${call!.name}.`, side: 'party', actor: actor.id });
        bonus = 0;
        return;
      }
      const mult = tm(actor.tier ?? 'average');
      switch (s.kind) {
        case 'callPack': {
          const n = tierIndex(actor.tier ?? 'average') >= tierIndex('great') ? 3 : 2;
          summon(g, n, frames, actor.name);
          bonus = 3;
          break;
        }
        case 'warDrum':
          ramBoost += 2;
          bonus = 2;
          frames.push({ game: clone(g), text: `${actor.name} · War Drum: the ram and the next hit +2.`, side: 'horde', actor: actor.id });
          break;
        case 'command':
          ramBoost += 3;
          bonus = 3;
          frames.push({ game: clone(g), text: `${actor.name} · Command: the ram and the next hit +3.`, side: 'horde', actor: actor.id });
          break;
        case 'hex': {
          const t = call!.target ? g.heroes[call!.target] : undefined;
          if (t && t.benched === 0) t.exposed = true;
          bonus = 3;
          frames.push({
            game: clone(g),
            text: `${actor.name} · Hex: the ${t ? CLASS_INFO[t.cls].name : 'party'} is Exposed.`,
            side: 'horde',
            actor: actor.id,
            target: t?.cls,
          });
          break;
        }
        case 'hit':
        case 'toss': {
          let label = s.kind === 'toss' ? 'Goblin Toss' : 'strike';
          let extra = 0;
          if (s.kind === 'toss') {
            const thrown = freeGoblins(g)[0] ?? crew(g)[0];
            if (thrown) {
              thrown.hp = 0;
              thrown.down = true;
              thrown.onRam = false;
              extra = 3;
            } else label = 'punch';
          }
          const target = call!.target ?? heroTarget(g, 'lowest');
          if (target) hordeHit(g, actor, target, bonus + extra, defense, off, frames, label);
          bonus = 0;
          break;
        }
      }
      void mult;
    });
  }

  // The Chieftain calls two goblins every other enemy turn.
  const chief = onField(g).find((e) => e.kind === 'chieftain');
  if (chief) {
    g.chieftainTurns += 1;
    if (g.chieftainTurns % 2 === 0 && !chief.disabled) summon(g, 2, frames, chief.name);
  }

  // The ram.
  if (!g.gate.breached) {
    const p = pushing(g);
    if (p.length >= 4) {
      let d = g.ramBase + (p.length - 4) + ramBoost + g.ramBonus;
      const guarded = off.has('warrior') && defense.protect === 'gate';
      if (guarded) {
        d = Math.ceil(d / 2);
        g.stats.heroes.warrior.stops += 1;
      }
      d = Math.min(d, g.gate.hp);
      const before = Math.floor(g.gate.dmg / 2);
      g.gate.dmg += d;
      g.gate.hp -= d;
      let pts = Math.floor(g.gate.dmg / 2) - before;
      let text = `The ram hits the gate for ${d}${guarded ? ' (the Warrior braces it)' : ''}`;
      if (g.gate.hp <= 0) {
        g.gate.breached = true;
        pts += 10;
        text += '. The gate falls: +10, and the goblins pour into the city';
        for (const e of onField(g)) e.onRam = false;
      }
      g.score.horde += pts;
      g.stats.horde.gate += pts;
      frames.push({ game: clone(g), text: `${text}${pts ? `: +${pts}` : ''}.`, side: 'horde', target: 'gate', pts: pts || undefined });
    } else if (crew(g).length > 0) {
      frames.push({ game: clone(g), text: `The ram stalls: only ${p.length} of 4 crew pushing.`, side: 'info', target: 'gate' });
    }
  } else {
    const pillagers = onField(g).filter((e) => e.kind === 'goblin' && !e.summonedThisTurn);
    if (pillagers.length) {
      g.score.horde += pillagers.length;
      g.stats.horde.pillage += pillagers.length;
      frames.push({ game: clone(g), text: `${pillagers.length} goblins pillage the city: +${pillagers.length}.`, side: 'horde', pts: pillagers.length });
    }
  }

  // Triage, then poison.
  if (off.has('cleric')) {
    const t = activeHeroes(g).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (t && t.hp < t.maxHp) {
      const healed = Math.min(t.maxHp - t.hp, Math.round(6 * tm(g.heroes.cleric.defTier)));
      t.hp += healed;
      frames.push({ game: clone(g), text: `Cleric · Triage: heals the ${CLASS_INFO[t.cls].name} ${healed}.`, side: 'party', actor: 'cleric', target: t.cls });
    }
  }
  for (const e of onField(g))
    if (e.poison > 0) {
      const d = Math.min(e.hp, e.poison);
      e.hp -= d;
      e.poison = 0;
      frames.push({ game: clone(g), text: `Poison: ${d} to the ${e.name}.`, side: 'party', actor: 'rogue', target: e.id });
      sweep(g, 'rogue', frames, true);
    }
}

function endPossession(g: Game, frames: Frame[]) {
  for (const e of g.enemies) {
    e.taunted = false;
    e.disabled = false;
    e.pinned = false;
    e.stripped = false;
    e.frost = false;
    e.summonedThisTurn = false;
  }
  for (const c of CLASSES) {
    const h = g.heroes[c];
    h.armor = 0;
    h.exposed = false;
    h.untargetable = false;
  }
  // The Shaman bounty runs out at the end of Q1.
  if (g.bounty === 'open' && g.possession === 2) {
    g.bounty = 'lost';
    g.log.push({ t: 'The Shaman bounty expires.', side: 'info' });
  }
  g.possession += 1;
  // Benched heroes count down; they return at half HP.
  for (const c of CLASSES) {
    const h = g.heroes[c];
    if (h.benched > 0) {
      h.benched -= 1;
      if (h.benched === 0) h.hp = Math.ceil(h.maxHp / 2);
    }
  }
  if (g.possession === 6) g.phase = 'halftime';
  else if (g.possession >= 12) g.phase = 'final';
  else {
    arrive(g);
    g.call = chooseCall(g);
  }
  frames.push({
    game: clone(g),
    text: g.phase === 'halftime' ? 'Halftime.' : g.phase === 'final' ? 'Final buzzer.' : `Possession ${g.possession + 1}.`,
    side: 'info',
  });
}

// ---------- Halftime ----------

export function halftimeAdjustment(g: Game, playbook: Play[]): Adjustment {
  const mild = g.difficulty === 'normal';
  if (g.score.horde > g.score.party)
    return {
      id: 'lead',
      name: 'Protect the lead',
      text: `Free goblins crowd harder: Champions are contested with ${Math.max(1, g.tuning.crowd - 1)} goblin around${mild ? ' in the third quarter' : ''}.`,
    };
  if (!g.gate.breached && g.gate.hp > g.gate.max / 2)
    return { id: 'allHands', name: 'All hands on the ram', text: `The second half's goblins push harder: the ram hits for +${mild ? 1 : 2}.` };
  const total = Math.max(
    1,
    CLASSES.reduce((s, c) => s + g.stats.heroes[c].pts, 0),
  );
  const star = CLASSES.map((c) => ({ c, p: g.stats.heroes[c].pts })).sort((a, b) => b.p - a.p)[0];
  if (star.p / total >= 0.4)
    return {
      id: 'double',
      name: 'Double the star',
      star: star.c,
      text: `They double the ${CLASS_INFO[star.c].name}: its finishers are contested unless a move or status opens the target${mild ? ', in the third quarter' : ''}.`,
    };
  if (!playbook.length)
    return {
      id: 'double',
      name: 'Double the star',
      star: star.c,
      text: `They double the ${CLASS_INFO[star.c].name}: its finishers are contested unless a move or status opens the target${mild ? ', in the third quarter' : ''}.`,
    };
  const top = Object.entries(g.stats.plays).sort((a, b) => b[1].pts - a[1].pts)[0];
  const p = playbook.find((x) => x.id === top?.[0]) ?? playbook[0];
  return {
    id: 'scout',
    name: 'Scout the play',
    playId: p.id,
    text: `${p.name} starts the second half scouted: its passes count for half until you call something else.`,
  };
}

export function startSecondHalf(g0: Game, adjustment: Adjustment): Game {
  const g = clone(g0);
  g.adjustment = adjustment;
  if (adjustment.id === 'allHands') g.ramBonus = g.difficulty === 'normal' ? 1 : 2;
  g.lastPlayId = adjustment.id === 'scout' ? (adjustment.playId ?? null) : null;
  // Locker room.
  for (const c of CLASSES) {
    const h = g.heroes[c];
    if (h.benched > 0 || h.hp <= 0) {
      h.benched = 0;
      h.hp = Math.ceil(h.maxHp / 2);
    } else h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp / 4));
  }
  g.phase = 'party';
  arrive(g);
  g.call = chooseCall(g);
  return g;
}

// ---------- Advice ----------

export interface Projection {
  playId: string;
  targetId: string;
  points: number;
  damage: number;
  kills: number;
  open: boolean;
  value: number;
}

/** Project a play on a target without the enemy turn. */
export function project(g: Game, play: Play, targetId: string): Projection {
  const { game } = runPossession(g, play, targetId, {}, { preview: true });
  const before = new Map(g.enemies.map((e) => [e.id, e.hp]));
  let damage = 0;
  let kills = 0;
  let crewBroken = 0;
  for (const e of game.enemies) {
    const b = before.get(e.id) ?? e.hp;
    if (b > 0) damage += b - e.hp;
    if (b > 0 && e.hp <= 0) kills += 1;
  }
  const open = game.stats.party.shots > g.stats.party.shots;
  if (!g.gate.breached) {
    const pushNow = pushing(g).length;
    const pushAfter = pushing(game).filter((e) => !e.pinned).length;
    if (pushNow >= 4 && pushAfter < 4) crewBroken = 1;
  }
  const points = game.score.party - g.score.party;
  // Breaking the horde's call counts: its finisher Disabled or down.
  const callFin = g.call?.actors[g.call.actors.length - 1];
  const fin = callFin ? game.enemies.find((e) => e.id === callFin) : undefined;
  const broke = fin && (fin.hp <= 0 || fin.disabled) ? 1 : 0;
  const value = points + damage * 0.12 + crewBroken * 4 + broke * 3;
  return { playId: play.id, targetId, points, damage, kills, open, value };
}

export function bestCall(g: Game, playbook: Play[]): Projection | null {
  let best: Projection | null = null;
  for (const p of playbook) {
    if (!playAvailable(g, p).ok) continue;
    for (const e of onField(g)) {
      const pr = project(g, p, e.id);
      if (!best || pr.value > best.value) best = pr;
    }
  }
  return best;
}

export function bestTargetFor(g: Game, play: Play): Projection | null {
  let best: Projection | null = null;
  for (const e of onField(g)) {
    const pr = project(g, play, e.id);
    if (!best || pr.value > best.value) best = pr;
  }
  return best;
}

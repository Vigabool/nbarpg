/**
 * The Play Calling prototype's rules: a deterministic Goblin Horde game of 12 party possessions,
 * each followed by an enemy turn. Pure functions over plain data; the UI replays the frames they return.
 */
import {
  CLASS_INFO,
  CLASSES,
  MOVE,
  TIER_MULT,
  isFinisher,
  tierIndex,
  type Cls,
  type Enabler,
  type Encounter,
  type EnemyKind,
  type HordePlay,
  type Move,
  type Play,
  type PlayStep,
  type Tier,
  enemyInfo,
  hordePlays,
} from './content';
import { getWeek, type WeekLine } from './week';

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
  /** The horde's fast break when your finisher is stopped. */
  turnoverPoints: number;
  /** The Crypt: Ritual points that raise the Lich (then it starts over). */
  ritualMax: number;
  /** The horde scores 1 per this many Ritual points. */
  ritualPer: number;
  /** The horde's bonus when the Ritual completes. */
  ritualFill: number;
  /** The Crypt raises 1 skeleton per this many opposing points. */
  skeletonPer: number;
}
export const DEFAULT_TUNING: Tuning = {
  gateHp: 70,
  goblinHp: 9,
  shotPoints: 2,
  championPoints: 4,
  bossPoints: 8,
  bountyPoints: 6,
  // A drafted lineup's picked games total about 136 true usage (median over weeks 1–20 and all four draft modes), so 3.8 gives about 36 touches.
  usagePerTouch: 3.8,
  hordeDamage: 1,
  championHp: 1.25,
  hordeHitPoints: 2,
  turnoverPoints: 2,
  ritualMax: 22,
  ritualPer: 2,
  ritualFill: 8,
  skeletonPer: 37,
};
export type Difficulty = 'normal' | 'hard';

export interface Hero {
  cls: Cls;
  player: string;
  team: string;
  opp: string;
  line: WeekLine;
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
  /** No game this week: sits out the whole game (never returns from the bench). */
  out?: boolean;
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
  /** Knocked off the ram by Strip the Ball for this enemy turn. */
  stripped: boolean;
  /** Loses Quick, and its next hit deals half. */
  slowed: boolean;
  /** Defenses: Taunt, Quick, casting the horde's Barrier, and Block. */
  taunts: boolean;
  quick: boolean;
  quickUsed: boolean;
  /** Raises the Barrier at the start of each party possession (the Shaman). */
  barrier: boolean;
  block: boolean;
  summonedThisTurn: boolean;
  /** Taken down and already scored. */
  down: boolean;
  /** The Crypt's Restless Dead: how many more times a weapon kill leaves a bone pile instead of ending it. */
  undead?: number;
  /** A bone pile: crumbled by a weapon kill, it rises next possession with this enemy's (halved) max HP. */
  pile?: boolean;
  /** Its max HP before it last crumbled (Raise Dead brings it back at this). */
  prevMax?: number;
  /** The last hit on it was fire or holy (so a kill destroys the dead for good). */
  pureHit?: boolean;
  /** The Wraith: only spells and holy hits touch it, and the first one makes it solid for the possession. */
  intangible?: boolean;
  solid?: boolean;
  /** The Wight: Unholy Vigor feeds the Ritual; it casts Raise Dead. */
  wight?: boolean;
  /** The Lich after the Ritual raised it: Death Bolt every enemy turn. */
  enraged?: boolean;
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
  /** What-if only: play the horde's turn as if the Rogue didn't Strip the Ball (to show what the strip saves). */
  noStrip?: boolean;
}

export interface Stats {
  heroes: Record<Cls, { pts: number; ast: number; stops: number; touches: number; dmg: number }>;
  plays: Record<string, { calls: number; pts: number }>;
  party: { shots: number; takedowns: number; objectives: number };
  /** gate: the objective's points (the ram on the gate, or the Crypt's Ritual). */
  horde: { hits: number; takedowns: number; gate: number; pillage: number; turnovers: number };
}

export interface LogLine {
  t: string;
  side: 'party' | 'horde' | 'info';
  pts?: number;
}

/** The quarter's scheduled arrivals, shown as a banner on the possession they land. */
export interface Wave {
  quarter: number;
  goblins: number;
  onRam: number;
  others: string[];
}

export interface Game {
  /** Arrivals that just landed this possession (Q2 and Q3 waves). */
  wave?: Wave | null;
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
  /** The horde's Block has been used this possession. */
  blockUsed: boolean;
  /** The double-team has smothered the star's first hit this possession. */
  starBlockUsed: boolean;
  /** The Shaman's Barrier stands in front of the whole horde until a hit breaks it. */
  barrierUp: boolean;
  encounter: Encounter;
  /** The Crypt's Ritual: fills by 1 per skeleton and bone pile each enemy turn; full, it raises the Lich. */
  ritual: { value: number; max: number; total: number; fills: number };
  /** The last quarter the open graves raised their skeletons. */
  graveQuarter: number;
  /** Sanctuary: enemy turns left with the horde's objective frozen and every hero at Armor +3. */
  sanctuary: number;
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
/** Bench count for a hero who sits out the whole game. */
const OUT = 99;
const tm = (t: Tier) => TIER_MULT[t];
export const quarterOf = (possession: number) => Math.min(4, Math.floor(possession / 3) + 1);

// ---------- Setup ----------

export const ROLE_OF: Record<string, EnemyKind> = {
  warlock: 'hexer',
  hunter: 'sharpshooter',
  ogre: 'ogre',
  assassin: 'cutthroat',
  shaman: 'shaman',
  chieftain: 'chieftain',
  lich: 'lich',
};

export function ramDamageFromFg(pct: number): number {
  if (pct < 0.44) return 5;
  if (pct < 0.48) return 6;
  if (pct < 0.52) return 7;
  return 8;
}
export const opponentsFg = () => {
  const t = getWeek().teams;
  // Weighted by goblins would hide low-scoring teams; a plain average of team FG% is easier to explain.
  return t.reduce((s, x) => s + x.fgPct, 0) / t.length;
};

export function newGame(tuning: Tuning = DEFAULT_TUNING, difficulty: Difficulty = 'normal'): Game {
  const week = getWeek();
  const enc: Encounter = week.encounter === 'crypt' ? 'crypt' : 'goblin-horde';
  const crypt = enc === 'crypt';
  const heroes = {} as Record<Cls, Hero>;
  for (const h of week.heroes) {
    const cls = h.cls as Cls;
    const maxHp = CLASS_INFO[cls].hp;
    // A hero with no game this week sits out: no touches, and on the bench for the whole game.
    const touches = h.out ? 0 : Math.max(2, Math.round(h.trueUsage / tuning.usagePerTouch));
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
      benched: h.out ? OUT : 0,
      out: !!h.out,
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
      name: enemyInfo(kind, enc).name,
      player: c.player,
      team: c.team,
      tier: c.tier as Tier,
      maxHp: Math.round(c.hp * mult * tuning.championHp),
      hp: Math.round(c.hp * mult * tuning.championHp),
      damage: Math.round(c.damage * mult * tuning.hordeDamage),
      armor: kind === 'ogre' && !crypt ? 3 : kind === 'chieftain' ? 2 : 0,
      points: c.boss ? tuning.bossPoints : tuning.championPoints + (elite ? 2 : 0),
      boss: c.boss,
      onRam: false,
      quarter: 0,
      arrived: false,
      taunted: false,
      exposed: 0,
      disabled: false,
      stripped: false,
      slowed: false,
      taunts: kind === 'ogre' && !crypt,
      quick: (kind === 'cutthroat' && !crypt) || kind === 'sharpshooter',
      quickUsed: false,
      barrier: kind === 'shaman' && !crypt,
      block: kind === 'chieftain',
      summonedThisTurn: false,
      down: false,
      ...(crypt && kind === 'shaman' ? { wight: true } : {}),
      ...(crypt && kind === 'cutthroat' ? { intangible: true, solid: false } : {}),
      // The Bone Knight (the rebounder's role in the Crypt) is a big skeleton: Restless, rising once.
      ...(crypt && kind === 'ogre' ? { undead: 1 } : {}),
    } as Enemy;
  });
  // Quarter script: Shaman and Hexer open; the two weaker of the rest arrive in Q2; the strongest and the Chieftain in Q3.
  const tierStrength = (e: Enemy) => tierIndex(e.tier ?? 'cold') * 1000 + e.maxHp;
  for (const e of champs) if (e.kind === 'shaman' || e.kind === 'hexer') e.quarter = 1;
  const rest = champs.filter((e) => !e.quarter && !e.boss).sort((a, b) => tierStrength(a) - tierStrength(b));
  rest.forEach((e, i) => (e.quarter = i < 2 ? 2 : 3));
  for (const e of champs) if (e.boss) e.quarter = 3;

  // Goblins: 1 per 40 opposing points; the Crypt raises fewer, tougher dead (1 per 45).
  const goblins = crypt ? week.teams.reduce((s, t) => s + Math.floor(t.pts / tuning.skeletonPer), 0) : week.teams.reduce((s, t) => s + t.goblins, 0);
  const q1 = Math.round(goblins * 0.3);
  const q2 = Math.round(goblins * 0.35);
  const enemies: Enemy[] = [...champs];
  for (let i = 0; i < goblins; i++) enemies.push(goblin(`e${id++}`, tuning, i < q1 ? 1 : i < q1 + q2 ? 2 : 3, enc));
  const object = (kind: EnemyKind, quarter: number, hp: number, armor: number, points: number): Enemy => ({
    ...goblin(`e${id++}`, tuning, quarter, enc),
    kind,
    name: enemyInfo(kind, enc).name,
    maxHp: hp,
    hp,
    damage: 0,
    armor,
    points,
    undead: undefined,
  });
  if (crypt) {
    // Three open graves raise skeletons each quarter until consecrated.
    for (let i = 0; i < 3; i++) enemies.push(object('grave', 1, 6, 0, 3));
  } else enemies.push(object('wagon', 2, 15, 2, 3));

  const stats: Stats = {
    heroes: Object.fromEntries(CLASSES.map((c) => [c, { pts: 0, ast: 0, stops: 0, touches: 0, dmg: 0 }])) as Stats['heroes'],
    plays: {},
    party: { shots: 0, takedowns: 0, objectives: 0 },
    horde: { hits: 0, takedowns: 0, gate: 0, pillage: 0, turnovers: 0 },
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
    blockUsed: false,
    starBlockUsed: false,
    barrierUp: false,
    encounter: enc,
    ritual: { value: 0, max: tuning.ritualMax, total: 0, fills: 0 },
    graveQuarter: 1,
    sanctuary: 0,
  };
  arrive(g);
  g.call = chooseCall(g);
  return g;
}

function goblin(id: string, tuning: Tuning, quarter: number, enc: Encounter = 'goblin-horde'): Enemy {
  return {
    id,
    kind: 'goblin',
    name: enemyInfo('goblin', enc).name,
    ...(enc === 'crypt' ? { undead: 99 } : {}),
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
    stripped: false,
    slowed: false,
    taunts: false,
    quick: false,
    quickUsed: false,
    barrier: false,
    block: false,
    summonedThisTurn: false,
    down: false,
  };
}

/** Bring in this quarter's arrivals; goblins fill the ram to 4 first. */
function arrive(g: Game) {
  const q = quarterOf(g.possession);
  const came: Enemy[] = [];
  for (const e of g.enemies)
    if (!e.arrived && e.quarter <= q && e.hp > 0) {
      e.arrived = true;
      came.push(e);
      if (e.kind === 'goblin' && (g.encounter === 'crypt' || (!g.gate.breached && crew(g).length < 4))) e.onRam = true;
    }
  if (g.encounter === 'crypt' && q > g.graveQuarter) {
    g.graveQuarter = q;
    for (const grave of onField(g).filter((x) => x.kind === 'grave')) {
      const sk = goblin(`e${g.nextId++}`, g.tuning, q, 'crypt');
      sk.arrived = true;
      sk.onRam = true;
      g.enemies.push(sk);
      came.push(sk);
      void grave;
    }
  }
  g.wave = null;
  if (came.length && g.possession > 0) {
    g.log.push({ t: `Quarter ${q}: new arrivals take the floor.`, side: 'info' });
    const gobs = came.filter((e) => e.kind === 'goblin');
    g.wave = {
      quarter: q,
      goblins: gobs.length,
      onRam: gobs.filter((e) => e.onRam).length,
      others: came.filter((e) => e.kind !== 'goblin').map((e) => (e.player ? `${e.name} (${e.player})` : e.name)),
    };
  }
}

// ---------- Queries ----------

export const onField = (g: Game) => g.enemies.filter((e) => e.arrived && e.hp > 0);
export const crew = (g: Game) => onField(g).filter((e) => e.kind === 'goblin' && e.onRam);
/** Goblins actually pushing the ram this turn. */
export const pushing = (g: Game) => crew(g).filter((e) => !e.stripped);
/** What the ram hits the gate for with this many goblins pushing: each of the first four pushes a quarter of the hit, each extra adds 1. */
export function ramHit(g: Game, pushers: number, boost = 0): number {
  if (pushers <= 0) return 0;
  const full = g.ramBase + boost + g.ramBonus + warDrum(g);
  return Math.max(1, Math.round((full * Math.min(pushers, 4)) / 4)) + Math.max(0, pushers - 4);
}
/** The Crypt's bone piles: crumbled skeletons waiting to rise. */
export const piles = (g: Game) => g.enemies.filter((e) => e.arrived && e.pile);
/** The Wight standing (and not Disabled). */
export const wight = (g: Game) => onField(g).find((e) => e.wight && !e.disabled);
/** What the Ritual gains this enemy turn with this many skeletons and piles feeding it. */
export function ritualGain(g: Game, feeders: number, boost = 0): number {
  if (g.encounter !== 'crypt') return 0;
  return feeders + (wight(g) ? 1 : 0) + boost + g.ramBonus;
}
/** Skeletons and bone piles feeding the Ritual (pinned skeletons don't). */
export const ritualFeeders = (g: Game) => pushing(g).length + piles(g).length;
/** Whether the Wight will cast Raise Dead (it needs bone piles on the floor). */
export const wightCast = (g: Game): 'raise' | null => (wight(g) && piles(g).length ? 'raise' : null);
export const skeletonsStand = (g: Game) => onField(g).some((e) => e.kind === 'goblin');
/**
 * The Crypt's next quarter: the skeletons the open graves will raise and the wave that arrives with them,
 * and how many party possessions are left before it starts (1 = after this one).
 */
export function graveForecast(g: Game): { quarter: number; graves: number; wave: number; possessionsLeft: number } | null {
  if (g.encounter !== 'crypt') return null;
  const quarter = quarterOf(g.possession) + 1;
  if (quarter > 4) return null;
  const graves = onField(g).filter((e) => e.kind === 'grave').length;
  const wave = g.enemies.filter((e) => e.kind === 'goblin' && !e.arrived && e.quarter === quarter).length;
  if (!graves && !wave) return null;
  return { quarter, graves, wave, possessionsLeft: 3 - (g.possession % 3) };
}
export const freeGoblins = (g: Game) => onField(g).filter((e) => e.kind === 'goblin' && !e.onRam);
export const activeHeroes = (g: Game) => CLASSES.map((c) => g.heroes[c]).filter((h) => h.benched === 0 && h.hp > 0);
const isChampion = (e: Enemy) => e.kind !== 'goblin' && e.kind !== 'wagon' && e.kind !== 'grave' && e.kind !== 'phylactery';

const adjusting = (g: Game, id: Adjustment['id']) => g.adjustment?.id === id && (g.difficulty === 'hard' || quarterOf(g.possession) === 3);

/** The enemy whose Taunt is forcing hits onto itself, if any. */
export const taunter = (g: Game) => onField(g).find((e) => e.taunts && !e.disabled);
/** Whether this enemy will evade the next hit. */
export const hasQuick = (e: Enemy) => e.quick && !e.quickUsed && !e.slowed && !e.disabled;
/** War Drum: the ram hits +2 while the Shaman stands and isn't Disabled. */
export const warDrum = (g: Game) => (onField(g).some((e) => e.barrier && !e.disabled) ? 2 : 0);

/** What the Shaman will cast on the enemy turn: Call the Pack when fewer than 4 goblins are on the ram, otherwise the Barrier (if it isn't already up). */
export function shamanCast(g: Game): 'pack' | 'barrier' | null {
  const shaman = onField(g).find((e) => e.barrier);
  if (!shaman || shaman.disabled) return null;
  // Goblins knocked loose or Pinned still count as crew, so defense doesn't trigger reinforcements.
  if (!g.gate.breached && crew(g).length < 4) return 'pack';
  return g.barrierUp ? 'pack' : 'barrier';
}
/** Whether the horde's Block is still up this possession. */
export const blockUp = (g: Game) => !g.blockUsed && onField(g).some((e) => e.block);
/** Everything that reduces a hit on this enemy. */
export const armorOf = (g: Game, e: Enemy) => e.armor + (adjusting(g, 'lead') && isChampion(e) ? 1 : 0);

function starDoubled(g: Game, cls: Cls) {
  return adjusting(g, 'double') && g.adjustment?.star === cls;
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
    const m = MOVE[s.move];
    if (m && isFinisher(m) && i !== steps.length - 1) out.push(`Step ${i + 1}: finishers go last.`);
  });
  const last = steps[steps.length - 1];
  if (last && MOVE[last.move] && !isFinisher(MOVE[last.move])) out.push('The last step must be a finisher.');
  const counts: Record<string, number> = {};
  for (const s of steps) counts[s.cls] = (counts[s.cls] ?? 0) + 1;
  for (const [c, n] of Object.entries(counts)) if (n > 1) out.push(`${CLASS_INFO[c as Cls].name} can only take part once.`);
  return out;
}

/** Whether an enabler helps the step it's passed to. */
export function passHelps(from: Move, to: Move | undefined): boolean {
  const e = from.enabler;
  if (!e || !to) return false;
  const deals = (to.damage ?? 0) > 0;
  if (e.kind === 'armor') return true;
  if (e.kind === 'split') return deals && to.targets !== 'all';
  if (e.kind === 'guided') return deals && to.targets !== 'all';
  return deals;
}

// ---------- The horde's call ----------

/** The first enemy on the floor of the kinds listed (in order of preference) who isn't already in the play. */
function actorFor(g: Game, kinds: EnemyKind[], taken: Set<string>): Enemy | undefined {
  const field = onField(g).filter((x) => !taken.has(x.id));
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
  for (const p of hordePlays(g.encounter)) {
    if (!triggered(g, p)) continue;
    // Each step takes the first actor on the floor who isn't already in the play.
    const taken = new Set<string>();
    const actors = p.steps.map((s) => {
      const a = actorFor(g, s.actors, taken);
      if (a) taken.add(a.id);
      return a ?? null;
    });
    // A play needs its finisher; a missing optional pass is skipped.
    if (p.steps.some((s, i) => !actors[i] && !s.optional)) continue;
    const target = heroTarget(g, p.target);
    if (!target) return null;
    const names = actors.filter((a): a is Enemy => !!a).map((a) => a.name.replace('Goblin ', ''));
    return { playId: p.id, name: p.name, actors: actors.map((a) => a?.id ?? null), target, text: `${names.join(' → ')} → ${CLASS_INFO[target].name}` };
  }
  return null;
}

// ---------- The party's possession ----------

/** The buffs the possession's helpers have built up for the finisher. Each counts once; Armor keeps the biggest. */
export interface Carry {
  armor: number;
  sure: boolean;
  crit: boolean;
  pierce: boolean;
  split: boolean;
  /** Guided: the finisher ignores Taunt. */
  guided: boolean;
  /** Heroes whose buffs are in the shot (credited with assists if it scores). */
  helpers: Cls[];
}
export const emptyCarry = (): Carry => ({ armor: 0, sure: false, crit: false, pierce: false, split: false, guided: false, helpers: [] });

/** Add a helper's buff to the shot. Buffs don't stack: a second Crit adds nothing. */
function addBuff(c0: Carry, e: Enabler | undefined, mult: number, from: Cls): Carry {
  const c = { ...c0, helpers: [...c0.helpers] };
  if (!e) return c;
  c.helpers.push(from);
  if (e.kind === 'armor') c.armor = Math.max(c.armor, Math.round(e.amount * mult));
  else c[e.kind] = true;
  return c;
}

function pickTargets(g: Game, primary: Enemy, n: number): Enemy[] {
  const others = onField(g)
    .filter((e) => e.id !== primary.id && e.kind !== 'wagon' && e.kind !== 'grave' && e.kind !== 'phylactery')
    .sort((a, b) => Number(b.onRam) - Number(a.onRam) || a.hp - b.hp);
  return [primary, ...others].slice(0, n);
}

function takedown(g: Game, e: Enemy, by: Cls, frames: Frame[], rec: boolean, playId?: string) {
  if (e.hp > 0 || e.down) return;
  e.hp = 0;
  e.down = true;
  // Restless Dead: a weapon kill leaves a bone pile that rises next possession with half the HP. No points.
  if (e.undead && !e.pureHit && e.maxHp > 2) {
    e.pile = true;
    e.undead -= 1;
    e.prevMax = e.maxHp;
    e.maxHp = Math.max(2, Math.floor(e.maxHp / 2));
    e.onRam = false;
    const text = `${e.name} crumbles into a bone pile (rises next possession with ${e.maxHp} HP)`;
    if (rec) frames.push({ game: clone(g), text, side: 'info', actor: by, target: e.id, kind: 'ko' });
    return;
  }
  const wasCrew = e.kind === 'goblin' && e.onRam;
  e.onRam = false;
  let pts = e.points;
  let text = `${e.name} goes down: +${pts}`;
  if (e.kind === 'wagon') {
    g.gold += 5;
    g.stats.party.objectives += pts;
    text = `The loot wagon breaks open: +${pts} and 5 gold`;
  } else if (e.kind === 'grave') {
    g.stats.party.objectives += pts;
    text = `The grave is consecrated and closes for good: +${pts}`;
  } else if (e.kind === 'phylactery') {
    g.stats.party.objectives += pts;
    text = `The Phylactery shatters: +${pts}, and the Lich takes full damage`;
  } else g.stats.party.takedowns += pts;
  if (e.undead !== undefined && g.encounter === 'crypt') text = `${e.name} is destroyed for good: +${pts}`;
  // The Crypt: destroying the dead for good, or the Necromancer, sets the Ritual back.
  if (g.encounter === 'crypt') {
    const back = e.kind === 'hexer' ? 3 : e.undead !== undefined ? 1 : 0;
    if (back && g.ritual.value > 0) {
      const b = Math.min(back, g.ritual.value);
      g.ritual.value -= b;
      text += `; the Ritual falls back ${b}`;
    }
    if (e.kind === 'lich') {
      const ph = onField(g).find((x) => x.kind === 'phylactery');
      if (ph) {
        ph.hp = 0;
        ph.down = true;
        text += '; its Phylactery shatters';
      }
    }
  }
  if (e.kind === 'shaman' && g.bounty === 'open') {
    g.bounty = 'won';
    pts += g.tuning.bountyPoints;
    g.stats.party.objectives += g.tuning.bountyPoints;
    text += `, and the ${e.name.replace('Goblin ', '')} bounty: +${g.tuning.bountyPoints}`;
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

/** Points off turnovers: your finisher was stopped, so the horde scores on the fast break. */
function turnover(g: Game, frames: Frame[], rec: boolean, why: string) {
  const pts = g.tuning.turnoverPoints;
  g.score.horde += pts;
  g.stats.horde.turnovers += pts;
  frames.push({ game: rec ? clone(g) : g, text: `Turnover (${why}): the horde runs the fast break: +${pts}.`, side: 'horde', pts });
}

/** One hero's step: receive the pass, act, score, then pass on. */
/** `picks`: the targets the player chose, in order (live moves). Without picks, the move fills its own targets. */
function doStep(ctx: StepCtx, step: PlayStep, i: number, primaryId: string, picks?: string[]) {
  const { g, frames, rec, scouted } = ctx;
  const snap = () => (rec ? clone(g) : g);
  const carry = ctx.carry;
  const firstFrame = frames.length;
  const h = g.heroes[step.cls];
  const m = MOVE[step.move];
  const mult = tm(h.tier);
  h.touches -= 1;
  g.stats.heroes[h.cls].touches += 1;
  const fin = isFinisher(m);
  // Every buff the helpers built up goes to the finisher; helpers' own hits get none.
  const buff = fin ? carry : emptyCarry();
  if (buff.armor) h.armor += buff.armor;
  if (m.kind === 'signature' || m.kind === 'legendary') h.usedSpecial.push(m.id);
  const scoreBefore = g.score.party;
  const parts: string[] = [];
  const chosen = g.enemies.find((e) => e.id === primaryId && e.hp > 0 && e.arrived) ?? onField(g)[0];

  // Effects on the party.
  switch (m.effect) {
    case 'partyArmor': {
      const a = Math.round((m.amount ?? 0) * mult);
      for (const x of activeHeroes(g)) x.armor += a;
      parts.push(`every hero Armor +${a}`);
      break;
    }
    case 'healAlly': {
      // The most injured heroes; a Split finisher heals a second one.
      const ts = [...activeHeroes(g)].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, buff.split ? 2 : 1);
      const healedText: string[] = [];
      for (const t of ts) {
        const healed = Math.min(t.maxHp - t.hp, Math.round((m.amount ?? 0) * mult));
        t.hp += healed;
        g.last.clericHealed += healed;
        if (healed) healedText.push(`the ${CLASS_INFO[t.cls].name} ${healed}`);
      }
      if (ts.length) parts.push(healedText.length ? `heals ${healedText.join(' and ')}` : 'no one needs healing');
      break;
    }
    case 'healParty': {
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
    case 'sanctuary':
      g.sanctuary = 2;
      parts.push('the horde’s objective is frozen and every hero has Armor +3, this enemy turn and the next');
      break;
    case 'lastStand':
      h.lastStand = true;
      parts.push("can't fall for the rest of the game");
      break;
    case 'shadow':
      h.untargetable = true;
      break;
    case 'revive':
      for (const x of CLASSES.map((c) => g.heroes[c]))
        if (x.benched > 0 && !x.out) {
          x.benched = 0;
          x.hp = x.maxHp;
          parts.push(`the ${CLASS_INFO[x.cls].name} returns`);
        }
      break;
  }

  if (m.enabler?.kind === 'guided') parts.push('lights a lane: the finisher ignores Taunt');

  if (chosen && g.barrierUp && (m.targets ?? 'none') !== 'none') {
    // The Barrier stands in front of everyone: whatever a move aims at, the Barrier takes it, and the first damaging move breaks it.
    const deals = (m.damage ?? 0) > 0;
    if (deals) {
      g.barrierUp = false;
      parts.push('the Barrier absorbs it and breaks');
    } else parts.push('the Barrier takes it: no effect gets through');
    if (fin) parts.push('no bucket');
    frames.push({
      game: snap(),
      text: `${CLASS_INFO[h.cls].name} · ${m.name}: ${parts.join(', ')}`,
      side: 'party',
      actor: h.cls,
      target: 'barrier',
      kind: 'step',
      result: parts.join(', '),
    });
    if (fin && deals) turnover(g, frames, rec, 'the Barrier swallowed the shot');
  } else if (chosen) {
    const sure = !!m.sure || buff.sure;
    const pierce = !!m.pierce || buff.pierce;
    const deals = (m.damage ?? 0) > 0;
    const extra = buff.split ? 1 : 0;
    const short = (e: Enemy) => e.name.replace('Goblin ', '');
    // The Crypt: fire (Fireball, Meteor) and holy damage (a Cleric hit, or a Blessed finisher: Guiding Light passed to it) destroy the dead for good.
    const crypt = g.encounter === 'crypt';
    const fire = m.id === 'fireball' || m.id === 'meteor';
    // Holy: a Cleric hit, or a finisher Guiding Light passed to (Guided, and in the Crypt, Blessed).
    const holy = crypt && deals && (h.cls === 'cleric' || (fin && buff.guided));
    const spell = h.cls === 'wizard';
    if (holy && h.cls !== 'cleric') parts.push('Blessed');

    // Taunt: a single-target hit must go to the taunter; a wider one must include it.
    const t = deals && !buff.guided ? taunter(g) : undefined;
    if (deals && buff.guided && taunter(g)) parts.push('Guided: past the Taunt');
    let primary = chosen;
    if (t && m.targets === 'primary' && t.id !== chosen.id) {
      primary = t;
      parts.push(`the ${short(t)} Taunts: the hit goes to it`);
    }
    let targets: Enemy[] = [];
    const picked = (picks ?? []).map((id) => g.enemies.find((e) => e.id === id && e.hp > 0 && e.arrived)).filter((e): e is Enemy => !!e);
    const n = maxPicks(m, buff);
    if (m.targets === 'all') targets = onField(g);
    else if (picked.length && n > 1) {
      // The player's own picks; a Taunting big must be one of them.
      targets = picked.slice(0, n);
      if (t && !targets.some((x) => x.id === t.id)) {
        targets = [t, ...targets].slice(0, n);
        parts.push(`the ${short(t)} Taunts: it takes one of the picks`);
      }
      primary = targets[0];
    } else if (m.targets === 'multi') {
      targets = pickTargets(g, chosen, n);
      if (t && !targets.some((x) => x.id === t.id)) targets = [t, ...targets].slice(0, n);
    } else if (m.targets === 'primary') targets = extra && !m.hits ? pickTargets(g, primary, 2) : [primary];

    let champDamaged = false;
    const notes: string[] = [];
    const note = (s: string) => {
      if (!notes.includes(s)) notes.push(s);
    };
    /** One hit. Returns the damage dealt, or -1 if it was cancelled or evaded. */
    const hit = (e: Enemy, base: number): number => {
      if (e.hp <= 0) return 0;
      if (crypt) {
        if (e.kind === 'grave' && !holy) {
          note('only holy damage consecrates a grave');
          return -1;
        }
        if (e.intangible && !e.solid) {
          if (!spell && !holy) {
            note(`passes through the ${short(e)}`);
            return -1;
          }
          e.solid = true;
          note(`the ${short(e)} turns solid`);
        }
      }
      // Backstab is Sure against a target that's Taunted (looking at the Warrior) or Disabled.
      if (!sure && !(m.doubleVsShaken && (e.taunted || e.disabled))) {
        if (starDoubled(g, h.cls) && !g.starBlockUsed) {
          g.starBlockUsed = true;
          note('the double-team smothers the first hit');
          return -1;
        }
        if (blockUp(g)) {
          g.blockUsed = true;
          const blocker = onField(g).find((x) => x.block);
          note(`Blocked by the ${blocker ? short(blocker) : 'horde'}${blocker && blocker.id !== e.id ? ` (aimed at the ${short(e)})` : ''}`);
          return -1;
        }
        if (hasQuick(e)) {
          e.quickUsed = true;
          note(`the ${short(e)} evades`);
          return -1;
        }
      }
      e.quickUsed = true;
      let d = base * mult;
      // The Crypt: holy damage is ×1.5 against the dead.
      if (crypt && holy && e.undead !== undefined) d *= 1.5;
      if (e.exposed > 0) d += 3;
      if (m.doubleVsShaken && (e.taunted || e.disabled)) d *= 2.5;
      if (buff.crit) d *= 1.5;
      if (!pierce) d -= armorOf(g, e);
      const dealt = Math.max(0, Math.min(e.hp, Math.round(d)));
      e.hp -= dealt;
      if (crypt) e.pureHit = fire || holy;
      g.stats.heroes[h.cls].dmg += dealt;
      if (dealt > 0 && isChampion(e)) champDamaged = true;
      return dealt;
    };

    // Whether the move connected with its main target (statuses need that).
    let connected = !deals;
    /** Every hit was Blocked or evaded: a finisher like that is a turnover. */
    let stopped = false;
    if (m.effect === 'assassinate' && !primary.boss) {
      g.stats.heroes[h.cls].dmg += primary.hp;
      if (isChampion(primary)) champDamaged = true;
      primary.hp = 0;
      connected = true;
      parts.push(`assassinates the ${short(primary)}`);
    } else if (deals && m.hits) {
      const total = m.hits + extra;
      let idx = 0;
      let dmg = 0;
      let landed = 0;
      for (let k = 0; k < total; k++) {
        const alive = targets.filter((x) => x.hp > 0);
        let e: Enemy | undefined;
        if (m.spread) e = targets[idx % Math.max(1, targets.length)];
        else e = targets[Math.min(k, targets.length - 1)];
        if (!e || e.hp <= 0) e = alive[0] ?? onField(g).find((x) => x.kind !== 'wagon');
        if (!e) break;
        const r = hit(e, m.damage!);
        if (r >= 0) {
          dmg += r;
          landed += 1;
          if (e.id === primary.id) connected = true;
          if (m.spread) idx += 1;
        }
      }
      parts.push(`${dmg} damage from ${landed} of ${total} hits`);
      stopped = landed === 0;
    } else if (deals) {
      const res = targets.map((x) => ({ x, d: hit(x, m.damage!) }));
      // The Crypt: a Smite that destroys one of the dead arcs to the next skeleton, up to 3 kills.
      if (crypt && m.id === 'smite') {
        let kills = res.filter((r) => r.x.undead !== undefined && r.x.hp <= 0).length;
        let arcs = 0;
        while (kills > 0 && kills < 3) {
          const next = onField(g).find((e) => e.kind === 'goblin' && !res.some((r) => r.x.id === e.id));
          if (!next) break;
          const d = hit(next, m.damage!);
          res.push({ x: next, d });
          arcs += 1;
          if (next.hp > 0) break;
          kills += 1;
        }
        if (arcs) note(`Smite arcs to ${arcs} more skeleton${arcs > 1 ? 's' : ''}`);
      }
      if (m.effect === 'markAll') {
        const marked = res.filter((r) => r.d >= 0 && r.x.hp > 0);
        for (const r of marked) r.x.exposed = 2;
        if (marked.length) note(`${marked.length > 1 ? 'both' : 'the target'} Marked`);
      }
      connected = res.some((r) => r.x.id === primary.id && r.d >= 0);
      const landed = res.filter((r) => r.d >= 0);
      const dmg = landed.reduce((s, r) => s + r.d, 0);
      stopped = res.length > 0 && landed.length === 0;
      // A hit that's Blocked or evaded is explained by its note, so it isn't also called a miss.
      if (res.length === 1) {
        if (landed.length) parts.push(`${dmg} to the ${short(res[0].x)}`);
      } else parts.push(`${dmg} across ${landed.length} of ${res.length} enemies`);
    }
    for (const n of notes) parts.push(n);

    // Statuses on the enemy.
    if (m.effect === 'tauntAll') {
      for (const e of onField(g)) e.taunted = true;
      parts.push('every enemy Taunted');
    } else if (connected && primary.hp > 0) {
      switch (m.effect) {
        case 'taunt':
          primary.taunted = true;
          parts.push('Taunted');
          break;
        case 'expose':
          primary.exposed = Math.max(primary.exposed, 1);
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
        case 'slow':
          primary.slowed = true;
          parts.push('Slowed');
          break;
      }
    }

    if (fin) {
      if (champDamaged) {
        const pts = g.tuning.shotPoints;
        g.stats.party.shots += pts;
        award(g, h.cls, pts, ctx.playId);
        for (const helper of buff.helpers) g.stats.heroes[helper].ast += 1;
        parts.push(`bucket: +${pts}`);
      } else parts.push('no bucket');
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
    if (fin && stopped) turnover(g, frames, rec, notes.join(' and ') || 'the shot was stopped');
    sweep(g, h.cls, frames, rec, ctx.playId);
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
  ctx.carry = fin ? emptyCarry() : addBuff(carry, m.enabler, mult, h.cls);
  void scouted;
  for (let k = firstFrame; k < frames.length; k++) frames[k].step = i;
}

export function runPossession(g0: Game, play: Play, primaryId: string, defense: Defense, opts: { preview?: boolean } = {}): { game: Game; frames: Frame[] } {
  const g = clone(g0);
  const frames: Frame[] = [];
  const rec = !opts.preview;
  // Saved plays are presets now: no scouting penalty for calling one again.
  const scouted = false;
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

/** How many targets the player picks for this move: several for multi-target moves and multi-hit finishers, one more with Split. */
export function maxPicks(m: Move, carry: Carry): number {
  const extra = carry.split && isFinisher(m) ? 1 : 0;
  if (m.targets === 'multi') return (m.count ?? 1) + extra;
  if (m.targets === 'primary' && m.hits) return m.hits + extra;
  if (m.targets === 'primary') return 1 + extra;
  return 0;
}

export function liveStep(l0: Live, step: PlayStep, targetId?: string, picks?: string[]): Live {
  const l = structuredClone(l0);
  doStep(l.ctx, step, l.steps.length, targetId ?? picks?.[0] ?? onField(l.ctx.g)[0]?.id ?? '', picks);
  l.steps.push(step);
  return l;
}

/** A step without the replay frames, for searching many possessions quickly. */
export function liveStepFast(l: Live, step: PlayStep, targetId?: string, picks?: string[]): Live {
  const ctx: StepCtx = { ...l.ctx, g: clone(l.ctx.g), frames: [], rec: false, carry: { ...l.ctx.carry } };
  doStep(ctx, step, l.steps.length, targetId ?? picks?.[0] ?? onField(ctx.g)[0]?.id ?? '', picks);
  return { ctx, steps: [...l.steps, step], startScore: l.startScore };
}

/** What a step would do, without recording it. */
export function previewLive(l: Live, step: PlayStep, targetId?: string, picks?: string[]): { damage: number; kills: number; points: number; open: boolean } {
  const ctx: StepCtx = { ...l.ctx, g: clone(l.ctx.g), frames: [], rec: false, carry: { ...l.ctx.carry } };
  const before = new Map(ctx.g.enemies.map((e) => [e.id, e.hp]));
  const shots = ctx.g.stats.party.shots;
  doStep(ctx, step, l.steps.length, targetId ?? picks?.[0] ?? onField(ctx.g)[0]?.id ?? '', picks);
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
    .filter((h) => h.touches > 0 && !l.steps.some((s) => s.cls === h.cls))
    .map((h) => h.cls);
  return { heroes, finishersOnly: l.steps.length >= 3, done: finished || l.steps.length >= 4 };
}

export function describeCarry(c: Carry): string[] {
  const out: string[] = [];
  if (c.armor) out.push(`Armor +${c.armor}`);
  if (c.sure) out.push('Sure');
  if (c.crit) out.push('Crit (+50%)');
  if (c.pierce) out.push('Pierce');
  if (c.split) out.push('Split (+1 target)');
  if (c.guided) out.push('Guided (ignores Taunt)');
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

function hordeHit(
  g: Game,
  actor: Enemy,
  targetCls: Cls,
  bonus: number,
  defense: Defense,
  off: Set<Cls>,
  frames: Frame[],
  label: string,
  opts: { ignoreArmor?: boolean } = {},
) {
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
  const notes: string[] = [];
  if (actor.slowed) {
    d = Math.floor(d / 2);
    actor.slowed = false;
    notes.push('Slowed: half damage');
  }
  // An Elite Warrior's Protect also halves the hit on that hero (then Armor applies): it reduces scoring, never cancels it.
  if (off.has('warrior') && defense.protect === cls && tierIndex(g.heroes.warrior.defTier) >= tierIndex('elite') && d > 0) {
    d = Math.ceil(d / 2);
    notes.push('the Warrior takes half');
  }
  const before = d;
  if (opts.ignoreArmor) {
    if (h.armor > 0) notes.push('ignores Armor');
  } else {
    d = Math.max(0, d - h.armor);
    if (h.armor > 0 && before > 0) notes.push(`Armor ${h.armor}`);
  }
  h.hp -= d;
  let pts = 0;
  if (d > 0) {
    pts += g.tuning.hordeHitPoints;
    g.stats.horde.hits += g.tuning.hordeHitPoints;
  } else notes.push('no bucket');
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

function summon(g: Game, n: number, frames: Frame[], by: Enemy) {
  const who = by.name;
  for (let i = 0; i < n; i++) {
    const e = goblin(`e${g.nextId++}`, g.tuning, quarterOf(g.possession), g.encounter);
    e.arrived = true;
    e.summonedThisTurn = true;
    e.onRam = !g.gate.breached && crew(g).length < 6;
    g.enemies.push(e);
  }
  frames.push({ game: clone(g), text: `${who} calls the pack: ${n} goblins${g.gate.breached ? '' : ' head for the ram'}.`, side: 'horde', actor: by.id });
}

function enemyTurn(g: Game, inPlay: Set<Cls>, defense: Defense, frames: Frame[]) {
  const off = new Set(defenders(g, inPlay));
  g.blocked = false;
  // Sanctuary: every hero has Armor +3 while it holds.
  if (g.sanctuary > 0) for (const h of activeHeroes(g)) h.armor += 3;
  // Protect, Close Out, Ward and Strip the Ball happen first.
  if (off.has('warrior') && defense.protect && defense.protect !== 'gate') {
    g.heroes[defense.protect].armor += Math.round(4 * tm(g.heroes.warrior.defTier));
    g.stats.heroes.warrior.stops += 1;
  }
  if (off.has('ranger') && defense.closeOut) {
    const e = onField(g).find((x) => x.id === defense.closeOut);
    if (e) {
      e.slowed = true;
      g.stats.heroes.ranger.stops += 1;
    }
  }
  if (off.has('wizard') && defense.ward) {
    const a = Math.round(4 * tm(g.heroes.wizard.defTier));
    g.heroes[defense.ward].armor += a;
  }
  if (off.has('rogue') && !g.gate.breached && !defense.noStrip) {
    const n = tierIndex(g.heroes.rogue.defTier) >= tierIndex('elite') ? 2 : 1;
    const ps = pushing(g).slice(0, n);
    for (const e of ps) e.stripped = true;
    if (ps.length) {
      g.stats.heroes.rogue.stops += ps.length;
      frames.push({
        game: clone(g),
        text:
          g.encounter === 'crypt'
            ? `Rogue · Strip the Ball: ${ps.length} skeleton${ps.length > 1 ? 's' : ''} pinned away from the Ritual.`
            : `Rogue · Strip the Ball: ${ps.length} goblin${ps.length > 1 ? 's' : ''} knocked off the ram.`,
        side: 'party',
        actor: 'rogue',
      });
    }
  }

  // The Shaman casts: Call the Pack when the ram is short of crew, otherwise the Barrier.
  const shaman = onField(g).find((e) => e.barrier);
  if (shaman && !shaman.disabled) {
    const cast = shamanCast(g);
    if (cast === 'pack') summon(g, tierIndex(shaman.tier ?? 'average') >= tierIndex('great') ? 3 : 2, frames, shaman);
    else if (cast === 'barrier') {
      g.barrierUp = true;
      frames.push({
        game: clone(g),
        text: `${shaman.name} raises the Barrier: it stands in front of the horde for your next possession.`,
        side: 'horde',
        actor: shaman.id,
      });
    }
  } else if (shaman?.disabled)
    frames.push({ game: clone(g), text: `${shaman.name} is Disabled: no cast and no War Drum this turn.`, side: 'party', actor: shaman.id });

  // The Wight casts Raise Dead when there are bone piles to raise.
  const w = onField(g).find((e) => e.wight);
  if (w && w.disabled) frames.push({ game: clone(g), text: `${w.name} is Disabled: no cast and no Unholy Vigor this turn.`, side: 'party', actor: w.id });
  else if (w) {
    const ps = piles(g);
    if (ps.length) {
      for (const e of ps) {
        e.pile = false;
        e.down = false;
        e.maxHp = e.prevMax ?? e.maxHp;
        e.hp = e.maxHp;
        e.undead = (e.undead ?? 0) + 1;
        e.onRam = e.kind === 'goblin';
        e.summonedThisTurn = true;
      }
      frames.push({
        game: clone(g),
        text: `${w.name} · Raise Dead: ${ps.length} bone pile${ps.length > 1 ? 's rise' : ' rises'} at full strength.`,
        side: 'horde',
        actor: w.id,
      });
    }
  }

  // The called play, or a new one if its actors are gone.
  let call = g.call;
  const alive = (id: string | null) => !!id && g.enemies.some((e) => e.id === id && e.hp > 0 && e.arrived);
  if (!call || call.actors.some((a) => a !== null && !alive(a))) {
    const fresh = chooseCall(g);
    if (fresh && call) frames.push({ game: clone(g), text: `The horde switches to ${fresh.name}.`, side: 'horde' });
    call = fresh;
  }
  let ramBoost = 0;
  if (call) {
    const play = hordePlays(g.encounter).find((p) => p.id === call!.playId)!;
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
          summon(g, n, frames, actor);
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
          frames.push({
            game: clone(g),
            text: `${actor.name} · ${g.encounter === 'crypt' ? 'Dark Command: the Ritual' : 'Command: the ram'} and the next hit +3.`,
            side: 'horde',
            actor: actor.id,
          });
          break;
        case 'enervate': {
          const t = call!.target ? g.heroes[call!.target] : undefined;
          const drained = !!t && t.benched === 0 && t.touches > 0;
          if (drained) t!.touches -= 1;
          bonus = 2;
          frames.push({
            game: clone(g),
            text: `${actor.name} · Enervate: the ${t ? CLASS_INFO[t.cls].name : 'party'} ${drained ? 'loses a touch' : 'has no touch to lose'}, and the next hit +2.`,
            side: 'horde',
            actor: actor.id,
            target: t?.cls,
          });
          break;
        }
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
    if (g.chieftainTurns % 2 === 0 && !chief.disabled) summon(g, 2, frames, chief);
  }
  // The Lich: Death Bolt every other enemy turn: 1.5× to the lowest-HP hero, ignoring Armor.
  const lich = onField(g).find((e) => e.kind === 'lich');
  if (lich) {
    g.chieftainTurns += 1;
    const target = activeHeroes(g)
      .filter((x) => !x.untargetable)
      .sort((a, b) => a.hp - b.hp)[0];
    if (target && !lich.disabled && g.chieftainTurns % 2 === 0)
      hordeHit(g, lich, target.cls, Math.round(lich.damage * 0.5), defense, off, frames, 'Death Bolt', { ignoreArmor: true });
  }
  // Sanctuary freezes the horde's objective: no ram, no pillage, no Ritual.
  if (g.sanctuary > 0)
    frames.push({
      game: clone(g),
      text: `Sanctuary holds: ${g.encounter === 'crypt' ? 'the Ritual is' : g.gate.breached ? 'the pillage is' : 'the ram is'} frozen this turn.`,
      side: 'party',
      target: 'gate',
    });
  // The Crypt's Ritual: 1 per skeleton and bone pile (pinned skeletons don't feed it), +1 for the Wight's Unholy Vigor.
  else if (g.encounter === 'crypt') ritualTurn(g, off, defense, ramBoost, frames);
  // The ram.
  else if (!g.gate.breached) {
    const p = pushing(g);
    if (p.length > 0) {
      let d = ramHit(g, p.length, ramBoost);
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
      let text = `The ram hits the gate for ${d}${p.length < 4 ? ` (${p.length} of 4 crew pushing)` : ''}${guarded ? ' (the Warrior braces it)' : ''}`;
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
      frames.push({ game: clone(g), text: 'The ram stalls: no crew pushing.', side: 'info', target: 'gate' });
    }
  } else {
    const pillagers = onField(g).filter((e) => e.kind === 'goblin' && !e.summonedThisTurn);
    if (pillagers.length) {
      g.score.horde += pillagers.length;
      g.stats.horde.pillage += pillagers.length;
      frames.push({ game: clone(g), text: `${pillagers.length} goblins pillage the city: +${pillagers.length}.`, side: 'horde', pts: pillagers.length });
    }
  }

  // Triage.
  if (off.has('cleric')) {
    const t = activeHeroes(g).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (t && t.hp < t.maxHp) {
      const healed = Math.min(t.maxHp - t.hp, Math.round(6 * tm(g.heroes.cleric.defTier)));
      t.hp += healed;
      frames.push({ game: clone(g), text: `Cleric · Triage: heals the ${CLASS_INFO[t.cls].name} ${healed}.`, side: 'party', actor: 'cleric', target: t.cls });
    }
  }
}

function ritualTurn(g: Game, off: Set<Cls>, defense: Defense, boost: number, frames: Frame[]) {
  const feeders = ritualFeeders(g);
  let gain = ritualGain(g, feeders, boost);
  if (gain <= 0) {
    frames.push({ game: clone(g), text: 'The Ritual stalls: nothing feeds it.', side: 'info', target: 'gate' });
    return;
  }
  const guarded = off.has('warrior') && defense.protect === 'gate';
  if (guarded) {
    gain = Math.ceil(gain / 2);
    g.stats.heroes.warrior.stops += 1;
  }
  const r = g.ritual;
  let pts = Math.floor((r.total + gain) / g.tuning.ritualPer) - Math.floor(r.total / g.tuning.ritualPer);
  r.total += gain;
  r.value += gain;
  let text = `The Ritual grows ${gain} (${feeders} dead feeding it${wight(g) ? ', Unholy Vigor +1' : ''}${boost ? `, Dark Command +${boost}` : ''}${guarded ? ', the Warrior guards the circle' : ''}): ${Math.min(r.value, r.max)}/${r.max}`;
  if (r.value >= r.max) {
    r.value = 0;
    r.fills += 1;
    pts += g.tuning.ritualFill;
    const lich = g.enemies.find((e) => e.kind === 'lich');
    if (lich && !lich.arrived) {
      lich.arrived = true;
      text += `. The Ritual completes: +${g.tuning.ritualFill}, and the Lich rises early`;
    } else text += `. The Ritual completes: +${g.tuning.ritualFill}`;
  }
  g.score.horde += pts;
  g.stats.horde.gate += pts;
  frames.push({ game: clone(g), text: `${text}${pts ? `: +${pts}` : ''}.`, side: 'horde', target: 'gate', pts: pts || undefined });
}

function endPossession(g: Game, frames: Frame[]) {
  for (const e of g.enemies) {
    e.taunted = false;
    e.disabled = false;
    e.stripped = false;
    e.slowed = false;
    e.quickUsed = false;
    e.summonedThisTurn = false;
    if (e.intangible) e.solid = false;
  }
  // Restless Dead: bone piles rise at their halved HP.
  const rising = piles(g);
  for (const e of rising) {
    e.pile = false;
    e.down = false;
    e.hp = e.maxHp;
    e.onRam = e.kind === 'goblin';
  }
  if (rising.length) frames.push({ game: clone(g), text: `${rising.length} bone pile${rising.length > 1 ? 's reassemble' : ' reassembles'}.`, side: 'info' });
  if (g.sanctuary > 0) g.sanctuary -= 1;
  g.blockUsed = false;
  g.starBlockUsed = false;
  for (const c of CLASSES) {
    const h = g.heroes[c];
    h.armor = 0;
    h.exposed = false;
    h.untargetable = false;
  }
  // The Shaman bounty runs out at the end of Q1.
  if (g.bounty === 'open' && g.possession === 2) {
    g.bounty = 'lost';
    g.log.push({ t: `The ${g.encounter === 'crypt' ? 'Wight' : 'Shaman'} bounty expires.`, side: 'info' });
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
      text: `Every Champion gains Armor +1${mild ? ' in the third quarter' : ''}.`,
    };
  if (g.encounter === 'crypt') {
    // The Crypt's version: the dead chant harder when the Ritual is behind.
    if (g.ritual.fills === 0 && g.ritual.value < g.ritual.max / 2)
      return { id: 'allHands', name: 'The dead chant louder', text: `The Ritual grows ${mild ? 1 : 2} more each enemy turn in the second half.` };
  } else if (!g.gate.breached && g.gate.hp > g.gate.max / 2)
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
      text: `They double the ${CLASS_INFO[star.c].name}: its first hit each possession is smothered unless it's Sure${mild ? ', in the third quarter' : ''}.`,
    };
  // Otherwise they double the top scorer.
  void playbook;
  return {
    id: 'double',
    name: 'Double the star',
    star: star.c,
    text: `They double the ${CLASS_INFO[star.c].name}: its first hit each possession is smothered unless it's Sure${mild ? ', in the third quarter' : ''}.`,
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
    if (h.out) continue;
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
/** How many turns ahead the bots count a dead skeleton's missing Ritual points (RITUAL_HORIZON env to test). */
const RITUAL_HORIZON = Number((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.RITUAL_HORIZON ?? 3);

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
    const pushAfter = pushing(game).length;
    crewBroken = (Math.min(pushNow, 4) - Math.min(pushAfter, 4)) / 4;
  }
  const points = game.score.party - g.score.party;
  // Breaking the horde's call counts: its finisher Disabled or down.
  const callFin = g.call?.actors[g.call.actors.length - 1];
  const fin = callFin ? game.enemies.find((e) => e.id === callFin) : undefined;
  const broke = fin && (fin.hp <= 0 || fin.disabled) ? 1 : 0;
  // Points the horde scores during your possession (off a turnover) count against the play.
  const given = game.score.horde - g.score.horde;
  // The objective. Goblin Horde: clearing the ram's crew. The Crypt: what the play does to the Ritual,
  // looking a few turns ahead: dead that stay down stop feeding it (a weapon kill only leaves a bone pile that
  // still feeds it and rises again), setbacks now, and closed graves that raise no more skeletons.
  let objective = crewBroken * 4;
  if (g.encounter === 'crypt') {
    const perPoint = 1 / g.tuning.ritualPer + g.tuning.ritualFill / g.tuning.ritualMax;
    const horizon = Math.min(RITUAL_HORIZON, 12 - g.possession);
    const removed = ritualFeeders(g) - ritualFeeders(game);
    const setback = g.ritual.value - game.ritual.value;
    const openGraves = (x: Game) => onField(x).filter((e) => e.kind === 'grave').length;
    const closed = openGraves(g) - openGraves(game);
    const quartersLeft = Math.max(0, 4 - quarterOf(g.possession));
    objective = (removed * horizon + setback + closed * quartersLeft * horizon) * perPoint;
  }
  const value = points - given + damage * 0.12 + objective + broke * 3;
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

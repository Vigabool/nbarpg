import type { BoxLine, SeasonData } from '../data/types';
import { rules as defaultRules, tierIndex, type ChampionKind, type HeroClass, type MonsterKind, type Rules, type Tier, type TraitId } from '../rules';
import { encounterOf, monsterName } from './encounter';
import { computeRating, shiftTier, tierFor } from './rating';

export interface HeroGamePick {
  heroClass: HeroClass;
  playerId: number;
  gameId: string;
}

export interface MonsterSpec {
  id: string;
  kind: MonsterKind;
  name: string;
  hp: number;
  damage: number;
  tier?: Tier;
  isWarlord: boolean;
  extraActions: number;
  /** Fumbles the party can spend on it, from its player's turnovers. */
  fumbles: number;
  /** Box-score traits from its player's standout stats (one for a role, two for the boss). */
  traits?: TraitId[];
  /** For champions: the real performance behind them. */
  source?: { playerId: number; gameId: string; team: string; line: BoxLine; mirrorOf?: HeroClass };
}

export interface Horde {
  waves: MonsterSpec[][];
  champions: MonsterSpec[];
  warlord: MonsterSpec;
}

export function opponentOf(team: string, game: { home: string; away: string }): string {
  return game.home === team ? game.away : game.home;
}

export function playerLine(data: SeasonData, gameId: string, playerId: number): BoxLine | undefined {
  return data.games[gameId]?.lines.find((l) => l.playerId === playerId);
}

function championTier(kind: ChampionKind, line: BoxLine, rules: Rules): Tier {
  const cfg = rules.horde.championRating[kind];
  let tier = tierFor(computeRating(cfg.rating, line), rules.tiers.thresholds[cfg.thresholds]);
  const s = cfg.tierShift;
  if (s && line[s.attempts] >= s.minAttempts) {
    const pct = line[s.made] / line[s.attempts];
    if (pct >= s.upAtOrAbove) tier = shiftTier(tier, 1);
    else if (pct < s.downBelow) tier = shiftTier(tier, -1);
  }
  return tier;
}

/** A trait's strength on this line: how far past its threshold (0 if it doesn't trigger). */
function traitScore(id: TraitId, line: BoxLine, rules: Rules): number {
  const t = rules.traits[id].trigger;
  if ('stat' in t) return line[t.stat] >= t.atLeast ? line[t.stat] / t.atLeast : 0;
  if (line[t.attempts] < t.minAttempts) return 0;
  const pct = line[t.made] / line[t.attempts];
  return pct >= t.pctAtLeast ? pct / t.pctAtLeast : 0;
}

/** The standout traits on a line, strongest first. */
export function traitsFor(line: BoxLine, max: number, rules: Rules = defaultRules): TraitId[] {
  return (Object.keys(rules.traits) as TraitId[])
    .map((id) => ({ id, score: traitScore(id, line, rules) }))
    .filter((t) => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((t) => t.id);
}

/** A role nobody mirrors this week (its hero sits out): an average, traitless monster. */
function baselineChampion(kind: ChampionKind, rules: Rules, encounter?: string): MonsterSpec {
  const def = rules.monsters[kind];
  const tier: Tier = 'average';
  return {
    id: '',
    kind,
    name: monsterName(kind, encounter, rules),
    hp: def.hpByTier![tierIndex(tier)],
    damage: def.damageByTier![tierIndex(tier)],
    tier,
    isWarlord: false,
    extraActions: 0,
    fumbles: 0,
    traits: [],
  };
}

function makeChampion(
  kind: ChampionKind,
  line: BoxLine,
  gameId: string,
  playerName: string,
  rules: Rules,
  mirrorOf?: HeroClass,
  encounter?: string,
): MonsterSpec {
  const def = rules.monsters[kind];
  const tier = championTier(kind, line, rules);
  const ti = tierIndex(tier);
  return {
    id: '',
    kind,
    name: `${monsterName(kind, encounter, rules)} · ${playerName}`,
    hp: def.hpByTier![ti],
    damage: def.damageByTier![ti],
    tier,
    isWarlord: false,
    extraActions: 0,
    fumbles: Math.floor(line.tov / rules.horde.turnoversPerFumble),
    traits: traitsFor(line, 1, rules),
    source: { playerId: line.playerId, gameId, team: line.team, line, mirrorOf },
  };
}

function strength(m: MonsterSpec): number {
  return tierIndex(m.tier ?? 'cold') * 1000 + m.hp * 10 + m.damage;
}

export function buildHorde(picks: HeroGamePick[], data: SeasonData, rules: Rules = defaultRules, encounter?: string): Horde {
  const enc = encounterOf(encounter, rules);
  if (picks.length === 0) throw new Error('No heroes are fighting this week');
  const nameOf = (id: number) => data.players[id]?.name ?? `Player ${id}`;
  const used = new Set<string>();
  const key = (gameId: string, playerId: number) => `${gameId}:${playerId}`;
  const opposing = new Map<string, { gameId: string; team: string; lines: BoxLine[] }>();

  const champions: MonsterSpec[] = [];
  const order = rules.horde.mirrors;
  const sortedPicks = [...picks].sort(
    (a, b) => order.findIndex((m) => m.heroClass === a.heroClass) - order.findIndex((m) => m.heroClass === b.heroClass),
  );
  for (const pick of sortedPicks) {
    const game = data.games[pick.gameId];
    const own = playerLine(data, pick.gameId, pick.playerId);
    if (!game || !own) throw new Error(`${nameOf(pick.playerId)} did not play in game ${pick.gameId}`);
    const team = opponentOf(own.team, game);
    const lines = game.lines.filter((l) => l.team === team);
    opposing.set(`${pick.gameId}:${team}`, { gameId: pick.gameId, team, lines });

    const mirror = order.find((m) => m.heroClass === pick.heroClass)!;
    const ranked = [...lines].sort((a, b) => b[mirror.rankBy] - a[mirror.rankBy] || b.min - a.min);
    // Take the rank-th player, moving down the list past anyone already mirrored.
    const candidates = ranked.slice(mirror.rank - 1).concat(ranked.slice(0, mirror.rank - 1));
    const line = candidates.find((l) => !used.has(key(pick.gameId, l.playerId)));
    if (!line) continue;
    used.add(key(pick.gameId, line.playerId));
    champions.push(makeChampion(mirror.champion, line, pick.gameId, nameOf(line.playerId), rules, pick.heroClass, encounter));
  }
  // Every role fights every week: a role whose hero sits out comes in at average strength.
  for (const m of order) if (!champions.some((c) => c.kind === m.champion)) champions.push(baselineChampion(m.champion, rules, encounter));

  // The boss: the single best opposing performance by a player who isn't already a Champion
  // (anyone, if every opposing player is).
  const w = rules.horde.warlord;
  const bestLine = (skipUsed: boolean) => {
    let top: { line: BoxLine; gameId: string; score: number } | undefined;
    for (const opp of opposing.values())
      for (const line of opp.lines) {
        if (skipUsed && used.has(key(opp.gameId, line.playerId))) continue;
        const score = computeRating(w.score, line);
        if (!top || score > top.score || (score === top.score && line.min > top.line.min)) top = { line, gameId: opp.gameId, score };
      }
    return top;
  };
  const best = bestLine(true) ?? bestLine(false);
  // The performance's strength: the best tier it earns as any Champion type.
  const kinds = order.map((m) => m.champion);
  const bestKind = kinds.reduce((a, b) =>
    tierIndex(championTier(b, best!.line, rules)) > tierIndex(championTier(a, best!.line, rules)) ? b : a,
  );
  const base = makeChampion(bestKind, best!.line, best!.gameId, nameOf(best!.line.playerId), rules, undefined, encounter);
  let warlord: MonsterSpec;
  if (enc.boss) {
    // The encounter's own boss (e.g. the Goblin Chieftain), scaled by that performance.
    const tier = championTier(bestKind, best!.line, rules);
    const def = rules.monsters[enc.boss];
    warlord = {
      ...base,
      kind: enc.boss,
      name: `${monsterName(enc.boss, encounter, rules)} · ${nameOf(best!.line.playerId)}`,
      tier,
      hp: def.hpByTier![tierIndex(tier)],
      damage: def.damageByTier![tierIndex(tier)],
      isWarlord: true,
      extraActions: w.extraActions,
      traits: traitsFor(best!.line, 2, rules),
    };
  } else {
    // Classic Warlord: a boosted copy of that player's Champion.
    warlord = {
      ...base,
      name: `Warlord ${base.name}`,
      hp: base.hp * w.hpMultiplier,
      damage: base.damage + w.damageBonus,
      isWarlord: true,
      extraActions: w.extraActions,
      traits: traitsFor(best!.line, 2, rules),
    };
  }

  // Minions: goblins per opposing team, with damage set by that team's FG%.
  const goblins: MonsterSpec[] = [];
  const m = rules.horde.minions;
  for (const opp of opposing.values()) {
    const pts = opp.lines.reduce((s, l) => s + l.pts, 0);
    const fgm = opp.lines.reduce((s, l) => s + l.fgm, 0);
    const fga = opp.lines.reduce((s, l) => s + l.fga, 0);
    const pct = fga > 0 ? fgm / fga : 0;
    const damage = m.damageByTeamFgPct.find((b) => pct < b.below)?.damage ?? m.damageByTeamFgPct.at(-1)!.damage;
    const count = Math.floor(pts / (enc.teamPointsPerMinion ?? m.teamPointsPerGoblin));
    for (let i = 0; i < count; i++) {
      goblins.push({
        id: '',
        kind: 'goblin',
        name: `${monsterName('goblin', encounter, rules)} (${opp.team})`,
        hp: rules.monsters.goblin.hp!,
        damage,
        isWarlord: false,
        extraActions: 0,
        fumbles: 0,
      });
    }
  }
  goblins.sort((a, b) => a.damage - b.damage);

  const waves: MonsterSpec[][] = [[], [], []];
  let gi = 0;
  m.waveShare.forEach((share, w) => {
    const n = w === m.waveShare.length - 1 ? goblins.length - gi : Math.round(goblins.length * share);
    waves[w].push(...goblins.slice(gi, gi + n));
    gi += n;
  });
  const byStrength = [...champions].sort((a, b) => strength(a) - strength(b));
  const pinnedWave = (c: MonsterSpec) => rules.horde.championWave?.[c.kind as ChampionKind];
  for (const c of byStrength) if (pinnedWave(c)) waves[pinnedWave(c)! - 1].push(c);
  const rest = byStrength.filter((c) => !pinnedWave(c));
  const wave2Count = Math.ceil(rest.length / 2);
  waves[1].push(...rest.slice(0, wave2Count));
  waves[2].push(...rest.slice(wave2Count), warlord);
  // A boss companion (the Lich's Phylactery) arrives beside the boss at its tier.
  if (enc.boss && enc.bossCompanion) {
    const def = rules.monsters[enc.bossCompanion];
    const t = tierIndex(warlord.tier ?? 'cold');
    waves[2].push({
      id: '',
      kind: enc.bossCompanion,
      name: monsterName(enc.bossCompanion, encounter, rules),
      tier: warlord.tier,
      hp: def.hpByTier![t],
      damage: def.damageByTier![t],
      isWarlord: false,
      extraActions: 0,
      fumbles: 0,
    });
  }

  let n = 0;
  for (const wave of waves) for (const mon of wave) mon.id = `m${++n}`;
  // Never leave a wave empty (possible with very few heroes).
  const nonEmpty = waves.filter((wv) => wv.length > 0);
  return { waves: nonEmpty, champions: byStrength, warlord };
}


import type { BoxLine, SeasonData } from '../data/types';
import { rules as defaultRules, tierIndex, type ChampionKind, type HeroClass, type MonsterKind, type Rules, type Tier } from '../rules';
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
  /** Actions skipped on arrival, from the mirrored player's turnovers. */
  staggers: number;
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
    staggers: Math.floor(line.tov / rules.horde.turnoversPerStagger),
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

  // The Warlord: the single best opposing performance across the chosen games.
  const w = rules.horde.warlord;
  let best: { line: BoxLine; gameId: string; score: number } | undefined;
  for (const opp of opposing.values()) {
    for (const line of opp.lines) {
      const score = computeRating(w.score, line);
      if (!best || score > best.score || (score === best.score && line.min > best.line.min)) best = { line, gameId: opp.gameId, score };
    }
  }
  // If that player was already mirrored, they become the boss instead.
  const mirrored = champions.find((c) => c.source!.gameId === best!.gameId && c.source!.playerId === best!.line.playerId);
  if (mirrored) champions.splice(champions.indexOf(mirrored), 1);
  // The performance's strength: the best tier it earns as any Champion type.
  const kinds = order.map((m) => m.champion);
  const bestKind = kinds.reduce((a, b) =>
    tierIndex(championTier(b, best!.line, rules)) > tierIndex(championTier(a, best!.line, rules)) ? b : a,
  );
  const base = mirrored ?? makeChampion(bestKind, best!.line, best!.gameId, nameOf(best!.line.playerId), rules, undefined, encounter);
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
    const count = Math.floor(pts / m.teamPointsPerGoblin);
    for (let i = 0; i < count; i++) {
      goblins.push({
        id: '',
        kind: 'goblin',
        name: `${monsterName('goblin', encounter, rules)} (${opp.team})`,
        hp: rules.monsters.goblin.hp!,
        damage,
        isWarlord: false,
        extraActions: 0,
        staggers: 0,
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

  let n = 0;
  for (const wave of waves) for (const mon of wave) mon.id = `m${++n}`;
  // Never leave a wave empty (possible with very few heroes).
  const nonEmpty = waves.filter((wv) => wv.length > 0);
  return { waves: nonEmpty, champions: byStrength, warlord };
}


import { describe, expect, it } from 'vitest';
import { buildHorde } from '../src/engine/horde';
import { rules, tierIndex } from '../src/rules';
import { boxLine, season } from './helpers';

// Hero team AAA plays BBB. BBB's lines are built so each mirror is unambiguous.
const bbb = [
  boxLine(101, 'BBB', { pts: 30, fgm: 11, fga: 20, dreb: 4, ast: 5, tov: 3 }), // top scorer
  boxLine(102, 'BBB', { pts: 22, fgm: 9, fga: 15, dreb: 3, ast: 2 }), // 2nd scorer
  boxLine(103, 'BBB', { pts: 10, fgm: 5, fga: 8, dreb: 12, oreb: 3, blk: 2 }), // rebounder
  boxLine(104, 'BBB', { pts: 8, fgm: 3, fga: 7, stl: 4, ast: 3 }), // steals
  boxLine(105, 'BBB', { pts: 9, fgm: 4, fga: 8, ast: 11, dreb: 2 }), // assists
  boxLine(106, 'BBB', { pts: 21, fgm: 8, fga: 16, min: 20 }),
];
const aaa = [1, 2, 3, 4, 5].map((id) => boxLine(id, 'AAA', { pts: 10, fgm: 4, fga: 9 }));
const data = season([{ id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [...aaa, ...bbb] }]);
const picks = [
  { heroClass: 'wizard' as const, playerId: 1, gameId: 'g1' },
  { heroClass: 'ranger' as const, playerId: 2, gameId: 'g1' },
  { heroClass: 'warrior' as const, playerId: 3, gameId: 'g1' },
  { heroClass: 'rogue' as const, playerId: 4, gameId: 'g1' },
  { heroClass: 'cleric' as const, playerId: 5, gameId: 'g1' },
];

describe('horde generation', () => {
  const horde = buildHorde(picks, data);
  const all = horde.waves.flat();

  it('mirrors each hero with the matching opposing player', () => {
    const byKind = (k: string) => all.find((m) => m.kind === k && !m.isWarlord);
    expect(byKind('warlock')?.source?.playerId).toBe(101);
    expect(byKind('hunter')?.source?.playerId).toBe(102);
    expect(byKind('ogre')?.source?.playerId).toBe(103);
    expect(byKind('assassin')?.source?.playerId).toBe(104);
    expect(byKind('shaman')?.source?.playerId).toBe(105);
  });

  it('makes the best line by a player who is not already a Champion the Goblin Chieftain', () => {
    // 101 has the best line overall but mirrors the Wizard, so the boss is the next best: 106.
    expect(horde.warlord.source?.playerId).toBe(106);
    expect(horde.warlord.kind).toBe('chieftain');
    expect(horde.warlord.name).toBe('Goblin Chieftain · P106');
    const t = tierIndex(horde.warlord.tier!);
    expect(horde.warlord.hp).toBe(rules.monsters.chieftain.hpByTier![t]);
    expect(horde.warlord.damage).toBe(rules.monsters.chieftain.damageByTier![t]);
    expect(horde.warlord.extraActions).toBe(1);
  });

  it('always fields every role; a hero who sits out leaves an average, traitless one', () => {
    const h = buildHorde(picks.filter((p) => p.heroClass !== 'rogue'), data);
    const assassin = h.waves.flat().find((m) => m.kind === 'assassin')!;
    expect(assassin.tier).toBe('average');
    expect(assassin.source).toBeUndefined();
    expect(assassin.traits).toEqual([]);
    for (const k of ['ogre', 'warlock', 'hunter', 'assassin', 'shaman']) expect(h.waves.flat().some((m) => m.kind === k)).toBe(true);
  });

  it("gives each Champion one trait from its own player's standout stat", () => {
    const byKind = (k: string) => all.find((m) => m.kind === k && !m.isWarlord)!;
    expect(byKind('assassin').traits).toEqual(['pickpocket']); // 4 steals
    expect(byKind('shaman').traits).toEqual(['floorGeneral']); // 11 assists
    expect(byKind('ogre').traits).toEqual(['secondChance']); // 15 rebounds
    expect(byKind('hunter').traits).toEqual(['hotHand']); // 9-of-15
    expect(byKind('warlock').traits).toEqual([]); // 30 points on 55%: no standout
  });

  it('uses encounter names for champions and minions', () => {
    expect(all.find((m) => m.kind === 'hunter')?.name).toBe('Goblin Sharpshooter · P102');
    expect(all.find((m) => m.kind === 'goblin')?.name).toBe('Goblin (BBB)');
  });

  it('falls back to the classic Warlord for encounters without their own boss', () => {
    const noBoss = structuredClone(rules);
    delete noBoss.encounters.encounters['goblin-horde'].boss;
    const h = buildHorde(picks, data, noBoss);
    expect(h.warlord.source?.playerId).toBe(106);
    expect(h.warlord.name.startsWith('Warlord ')).toBe(true);
    // Its Champion version doubled, +2 damage.
    const def = noBoss.monsters[h.warlord.kind];
    const t = tierIndex(h.warlord.tier!);
    expect(h.warlord.hp).toBe(def.hpByTier![t] * 2);
    expect(h.warlord.damage).toBe(def.damageByTier![t] + 2);
  });

  it('fumbles champions for turnovers (1 per 3)', () => {
    expect(all.find((m) => m.kind === 'warlock')!.fumbles).toBe(1); // 101: 3 turnovers
  });

  it('adds goblins per opposing points, half in wave 1', () => {
    const pts = bbb.reduce((s, l) => s + l.pts, 0); // 100
    const goblins = all.filter((m) => m.kind === 'goblin');
    const expected = Math.floor(pts / rules.horde.minions.teamPointsPerGoblin);
    expect(goblins.length).toBe(expected);
    const wave1Goblins = horde.waves[0].filter((m) => m.kind === 'goblin');
    expect(wave1Goblins.length).toBe(Math.round(expected / 2));
  });

  it('puts the Shaman in wave 1, the Warlord last, and the weaker champions in wave 2', () => {
    expect(horde.waves[0].filter((m) => m.kind !== 'goblin').map((m) => m.kind)).toEqual(['shaman']);
    expect(horde.waves[2].at(-1)?.isWarlord).toBe(true);
    // Five champions; the Shaman is pinned, the other four split 2 / 2.
    const champs2 = horde.waves[1].filter((m) => m.kind !== 'goblin');
    const champs3 = horde.waves[2].filter((m) => m.kind !== 'goblin' && !m.isWarlord);
    expect(champs2.length).toBe(2);
    expect(champs3.length).toBe(2);
  });

  it('moves down the list when one player would fill two mirrors', () => {
    // 201 leads the other team in points AND rebounds.
    const ccc = [
      boxLine(201, 'CCC', { pts: 28, dreb: 14, min: 36 }),
      boxLine(202, 'CCC', { pts: 15, dreb: 9, min: 30 }),
      boxLine(203, 'CCC', { pts: 12, dreb: 3, min: 28 }),
    ];
    const d = season([{ id: 'g2', date: '2025-10-22', home: 'AAA', away: 'CCC', lines: [...aaa, ...ccc] }]);
    const h = buildHorde(
      [
        { heroClass: 'wizard', playerId: 1, gameId: 'g2' },
        { heroClass: 'warrior', playerId: 3, gameId: 'g2' },
      ],
      d,
    );
    const champs = [...h.waves.flat()].filter((m) => m.kind !== 'goblin');
    const ogre = champs.find((m) => m.kind === 'ogre' || m.source?.mirrorOf === 'warrior');
    expect(ogre?.source?.playerId).toBe(202);
  });
});

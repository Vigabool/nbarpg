import { describe, expect, it } from 'vitest';
import { buildHorde } from '../src/engine/horde';
import { rules } from '../src/rules';
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
    // 101 was the Wizard's mirror but had the best line, so they became the Chieftain instead.
    expect(byKind('warlock')).toBeUndefined();
    expect(byKind('hunter')?.source?.playerId).toBe(102);
    expect(byKind('ogre')?.source?.playerId).toBe(103);
    expect(byKind('assassin')?.source?.playerId).toBe(104);
    expect(byKind('shaman')?.source?.playerId).toBe(105);
  });

  it('makes the best performance the Goblin Chieftain, scaled by that line', () => {
    // 101: 30 + 4 + 5 = 39, the highest pts+reb+ast. Its best tier as any Champion type sets the
    // Chieftain's strength: 30 points on 55% shooting is an Elite Sharpshooter line.
    expect(horde.warlord.source?.playerId).toBe(101);
    expect(horde.warlord.kind).toBe('chieftain');
    expect(horde.warlord.name).toBe('Goblin Chieftain · P101');
    expect(horde.warlord.tier).toBe('elite');
    expect(horde.warlord.hp).toBe(rules.monsters.chieftain.hpByTier![4]);
    expect(horde.warlord.damage).toBe(rules.monsters.chieftain.damageByTier![4]);
    expect(horde.warlord.extraActions).toBe(1);
  });

  it('uses encounter names for champions and minions', () => {
    expect(all.find((m) => m.kind === 'hunter')?.name).toBe('Goblin Sharpshooter · P102');
    expect(all.find((m) => m.kind === 'goblin')?.name).toBe('Goblin (BBB)');
  });

  it('falls back to the classic Warlord for encounters without their own boss', () => {
    const noBoss = structuredClone(rules);
    delete noBoss.encounters.encounters['goblin-horde'].boss;
    const h = buildHorde(picks, data, noBoss);
    expect(h.warlord.kind).toBe('warlock');
    // A Great Warlock doubled, +2 damage.
    expect(h.warlord.hp).toBe(noBoss.monsters.warlock.hpByTier![3] * 2);
    expect(h.warlord.damage).toBe(noBoss.monsters.warlock.damageByTier![3] + 2);
  });

  it('fumbles champions for turnovers (1 per 3)', () => {
    expect(horde.warlord.fumbles).toBe(1);
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
    // Four non-Warlord champions; the Shaman is pinned, the other three split 2 / 1.
    const champs2 = horde.waves[1].filter((m) => m.kind !== 'goblin');
    const champs3 = horde.waves[2].filter((m) => m.kind !== 'goblin' && !m.isWarlord);
    expect(champs2.length).toBe(2);
    expect(champs3.length).toBe(1);
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

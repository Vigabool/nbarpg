import { describe, expect, it } from 'vitest';
import { DEFAULT_PICK_WEIGHTS, picksValue } from '../src/app/smartPick';
import { computePool } from '../src/engine/rating';
import { boxLine, season } from './helpers';

// The Warrior's player had a huge night against BBB (whose rebounder went off) and a
// slightly smaller one against CCC (whose rebounder was quiet).
const aaaHot = boxLine(1, 'AAA', { dreb: 14, oreb: 4, blk: 3, pts: 10 });
const aaaWarm = boxLine(1, 'AAA', { dreb: 9, oreb: 2, blk: 2, pts: 10 });
const bigBBB = [101, 102, 103].map((id, i) => boxLine(id, 'BBB', { dreb: i === 0 ? 18 : 3, oreb: i === 0 ? 5 : 0, blk: i === 0 ? 4 : 0, pts: 8 }));
const quietCCC = [201, 202, 203].map((id) => boxLine(id, 'CCC', { dreb: 3, pts: 8 }));
const data = season([
  { id: 'g1', date: '2025-10-21', home: 'AAA', away: 'BBB', lines: [aaaHot, ...bigBBB] },
  { id: 'g2', date: '2025-10-23', home: 'AAA', away: 'CCC', lines: [aaaWarm, ...quietCCC] },
]);

describe('smart pick', () => {
  it('counts the horde a game brings, not just energy', () => {
    const v = (gameId: string) => picksValue([{ heroClass: 'warrior', playerId: 1, gameId }], data, undefined, DEFAULT_PICK_WEIGHTS);
    // g1 gives more energy but mirrors an Elite rebounder; g2's mirror is weak.
    expect(computePool('warrior', aaaHot).pool).toBeGreaterThan(computePool('warrior', aaaWarm).pool);
    expect(v('g2')).toBeGreaterThan(v('g1'));
  });
});

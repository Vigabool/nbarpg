import { describe, expect, it } from 'vitest';
import { endRound, performAction, type BattleState } from '../src/engine/combat';
import { BATTLE_TIPS, pickTip, type CoachContext } from '../src/ui/coachTips';
import { battle, monster } from './helpers';

const everywhere = () => true;
const ctxOf = (state: BattleState, p: Partial<CoachContext> = {}): CoachContext => ({ state, sheetOpen: true, targeting: false, doomed: new Set(), ...p });
/** Which tip shows, given the tips already seen. */
const next = (ctx: CoachContext, seen: string[] = [], onScreen: (s: string) => boolean = everywhere) =>
  pickTip(BATTLE_TIPS, ctx, (id) => !seen.includes(id), onScreen)?.id;

describe('first-battle walkthrough', () => {
  const s = battle([[monster({ hp: 50, damage: 3 })], [monster()], [monster()]]);

  it('opens with the horde, then the party, then the actions, in order', () => {
    expect(next(ctxOf(s))).toBe('battle-horde');
    expect(next(ctxOf(s), ['battle-horde'])).toBe('battle-party');
    expect(next(ctxOf(s), ['battle-horde', 'battle-party'])).toBe('battle-actions');
  });

  it('each tip says how the screen should look: no action sheet over the horde and party, the sheet open for actions', () => {
    const tip = (id: string) => BATTLE_TIPS.find((t) => t.id === id)!;
    expect(tip('battle-horde').sheet).toBe('closed');
    expect(tip('battle-party').sheet).toBe('closed');
    expect(tip('battle-doom').sheet).toBe('closed');
    expect(tip('battle-actions').sheet).toBe('open');
    // The actions tip comes up with the sheet closed too: the battle screen opens it on a ready hero.
    expect(next(ctxOf(s, { sheetOpen: false }), ['battle-horde', 'battle-party'])).toBe('battle-actions');
  });

  const intro = ['battle-horde', 'battle-party', 'battle-actions'];

  it('explains targeting while an action waits for a target', () => {
    expect(next(ctxOf(s, { targeting: true }), intro)).toBe('battle-target');
  });

  it('points at End round once a hero has acted', () => {
    expect(next(ctxOf(s), intro)).not.toBe('battle-end-round');
    const acted = performAction(s, { heroId: 'warrior', actionId: 'axe', targetIds: [s.enemies[0].id] });
    expect(next(ctxOf(acted), intro)).toBe('battle-end-round');
  });

  it('after the first action, End round comes before the situational tips', () => {
    const tricky = battle([[monster({ id: 'C', kind: 'ogre', hp: 50, damage: 3, fumbles: 1, traits: ['swat'] })], [monster()], [monster()]]);
    const acted = performAction(tricky, { heroId: 'warrior', actionId: 'axe', targetIds: ['C'] });
    expect(next(ctxOf(acted), intro)).toBe('battle-end-round');
    expect(next(ctxOf(acted), [...intro, 'battle-end-round'])).not.toBe('battle-trait');
  });

  it('points out the battle log once the horde has acted', () => {
    const seen = BATTLE_TIPS.map((t) => t.id).filter((id) => id !== 'battle-log');
    expect(next(ctxOf(s), seen)).toBeUndefined();
    expect(next(ctxOf(endRound(s)), seen)).toBe('battle-log');
  });

  it('explains traits when a Champion has one', () => {
    const traited = battle([[monster({ id: 'C', kind: 'ogre', hp: 50, damage: 3, traits: ['swat'] })], [monster()], [monster()]]);
    const seen = BATTLE_TIPS.map((t) => t.id).filter((id) => id !== 'battle-trait');
    expect(next(ctxOf(traited), seen)).toBe('battle-trait');
    expect(next(ctxOf(s), seen)).toBeUndefined();
  });

  it('warns about a falling hero before anything else', () => {
    expect(next(ctxOf(s, { doomed: new Set(['wizard']) }), intro)).toBe('battle-doom');
  });

  it('waits until its element is on screen, and never repeats', () => {
    expect(next(ctxOf(s), [], (sel) => sel !== '[data-coach="horde"]')).toBeUndefined();
    expect(
      next(
        ctxOf(s),
        BATTLE_TIPS.map((t) => t.id),
      ),
    ).toBeUndefined();
  });

  it('stays quiet once the battle is over', () => {
    expect(next(ctxOf({ ...s, phase: 'won' }))).toBeUndefined();
  });
});

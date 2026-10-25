import { describe, expect, it } from 'vitest';
import { buildSteps } from '../src/ui/sampleTurnScript';

describe('How to play: sample turn', () => {
  it('plays its scripted round without errors and tells the intended story', () => {
    const steps = buildSteps();
    expect(steps.length).toBe(8);
    // Before Fireball, a step shows the Wizard picking all three goblins (blue = can pick, gold = picked).
    const aim = steps.find((s) => s.aiming)!;
    expect(aim.aiming!.picked).toEqual(['g1', 'g2', 'g3']);
    expect(aim.aiming!.valid).toEqual(expect.arrayContaining(['g1', 'g2', 'g3', 'ogre']));
    expect(steps[steps.indexOf(aim) + 1].title).toBe('Attack: Fireball');
    const last = steps.at(-1)!.state;
    expect(last.round).toBe(2);
    // Fireball cleared the goblins; the Ogre survives into round 2.
    expect(last.enemies.filter((e) => e.alive).map((e) => e.id)).toEqual(['ogre']);
    // The taunted Ogre hit the Warrior, not the Wizard.
    const warrior = last.heroes.find((h) => h.id === 'warrior')!;
    const wizard = last.heroes.find((h) => h.id === 'wizard')!;
    expect(warrior.hp).toBeLessThan(warrior.maxHp);
    expect(wizard.hp).toBe(wizard.maxHp);
  });
});

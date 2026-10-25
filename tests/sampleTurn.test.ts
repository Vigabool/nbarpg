import { describe, expect, it } from 'vitest';
import { previewEnemyPhase } from '../src/engine/combat';
import { buildSteps } from '../src/ui/sampleTurnScript';

describe('How to play: sample turn', () => {
  it('plays its scripted round without errors and tells the intended story', () => {
    const steps = buildSteps();
    expect(steps.length).toBe(9);
    // Before Fireball, a step shows the Wizard picking all three goblins (blue = can pick, gold = picked).
    const aim = steps.find((s) => s.aiming)!;
    expect(aim.aiming!.picked).toEqual(['g1', 'g2', 'g3']);
    expect(aim.aiming!.valid).toEqual(expect.arrayContaining(['g1', 'g2', 'g3', 'ogre']));
    expect(steps[steps.indexOf(aim) + 1].title).toBe('Attack: Fireball');
    const last = steps.at(-1)!.state;
    expect(last.round).toBe(2);
    // Fireball cleared the goblins; the Hexer and the Ogre survive into round 2.
    expect(last.enemies.filter((e) => e.alive).map((e) => e.id)).toEqual(['hexer', 'ogre']);
    // Provoke pulled the Hexer off the Wizard: it targeted the Wizard before, and the Wizard is untouched.
    const intents = (st: (typeof steps)[number]['state']) =>
      previewEnemyPhase(st)
        .filter((l) => l.actorId === 'hexer')
        .map((l) => l.targetIds?.[0]);
    expect(intents(steps[0].state)).toEqual(['wizard']);
    expect(intents(steps[1].state)).toEqual(['warrior']);
    // Empower + Ready Crit + Backstab on the taunted Ogre: 10 × 2 (taunted) × 2 (crit) × 1.5 (Empower).
    const big = steps.find((st) => st.title.startsWith('The big hit'))!;
    expect(big.events.some((e) => e.text.includes('Backstab: 60 to Ogre'))).toBe(true);
    const warrior = last.heroes.find((h) => h.id === 'warrior')!;
    const wizard = last.heroes.find((h) => h.id === 'wizard')!;
    expect(warrior.hp).toBeLessThan(warrior.maxHp);
    expect(wizard.hp).toBe(wizard.maxHp);
  });
});

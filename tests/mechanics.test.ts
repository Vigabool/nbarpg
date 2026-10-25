import { describe, expect, it } from 'vitest';
import { encounterIds, encounterOf, specialFor } from '../src/engine/encounter';
import { allMechanics, behaviorHandler, mechanicsFor, specialHandler } from '../src/engine/encounters';
import type { BattleState } from '../src/engine/combat';
import { rules, type MonsterKind } from '../src/rules';

describe('Encounter mechanics registry', () => {
  it('every special in the rules has a handler', () => {
    for (const key of Object.keys(rules.combat.specials)) expect(specialHandler(key), key).toBeDefined();
  });

  it("every monster's special in every encounter has a handler", () => {
    for (const id of encounterIds())
      for (const kind of Object.keys(encounterOf(id).monsters) as MonsterKind[]) {
        const sp = specialFor(kind, id);
        if (sp) expect(specialHandler(sp.key), `${id}/${kind}: ${sp.key}`).toBeDefined();
      }
  });

  it('behaviors that need code have it', () => {
    for (const b of ['hunter', 'assassin', 'warlock', 'shaman', 'wraith', 'wolf', 'phylactery'] as const) expect(behaviorHandler(b), b).toBeDefined();
  });

  it('mechanic ids are unique, and specials and behaviors are defined once', () => {
    const ms = allMechanics();
    expect(new Set(ms.map((m) => m.id)).size).toBe(ms.length);
    const specials = ms.flatMap((m) => Object.keys(m.specials ?? {}));
    const behaviors = ms.flatMap((m) => Object.keys(m.behaviors ?? {}));
    expect(new Set(specials).size).toBe(specials.length);
    expect(new Set(behaviors).size).toBe(behaviors.length);
  });

  it('each encounter brings in its own twists', () => {
    const ids = (encounter: string) => mechanicsFor({ encounter } as BattleState, rules).map((m) => m.id);
    expect(ids('goblin-horde')).toEqual(expect.arrayContaining(['packTactics', 'packGuard', 'poisonOnHit']));
    expect(ids('crypt')).toEqual(expect.arrayContaining(['restlessDead', 'aura']));
    expect(ids('dragon-lair')).toEqual(expect.arrayContaining(['hoardTithe', 'dragonkin', 'moltenHide']));
    expect(ids('giants-hall')).toEqual(expect.arrayContaining(['topple', 'regenerate']));
    expect(ids('giants-hall')).not.toContain('restlessDead');
    expect(ids('crypt')).not.toContain('topple');
  });
});

# Adding an encounter

Core combat (`src/engine/combat.ts`) knows nothing about any one encounter. Each encounter's rules are **mechanics** in `src/engine/encounters/`. A mechanic is an object that plugs into a fixed set of hooks. An encounter is its data in `src/rules/encounters.json`, plus whichever mechanics that data brings into play.

## Steps

1. **Data.** Add the encounter to `src/rules/encounters.json`: name, tagline, boss, twists, and how each monster role is re-skinned (`name`, `icon`, `behavior`, `special`, any monster flags). Reuse existing twists, specials, behaviors and flags where they fit. Many encounters need no new code at all.
2. **Module.** For anything new, write `src/engine/encounters/<encounter>.ts`. It exports an array of `Mechanic`s (see `types.ts`), and each one says when it's in play with `appliesTo(enc)`, usually from a twist or a monster flag.
3. **Register.** Add the array to `build()` in `src/engine/encounters/index.ts`. The order there is the order hooks run.
4. **Types.** A new twist, behavior or monster flag also needs its name added to the types in `src/rules/index.ts`.
5. **Specials.** A special needs its text and numbers in `combat.json` → `specials`, and a handler in some module's `specials`. `tests/mechanics.test.ts` fails if any special in the data has no handler.
6. **Tests and balance.** Add a test file like `tests/hall.test.ts`, and tune with `npm run data:simulate -- --encounter <id> [--smart]`.
7. **Golden baseline.** A new encounter adds new golden entries, so record them with `npm run check:golden -- --update`. Do this only once you've checked that the existing entries didn't change.

## Hooks

| Hook | When it runs | Used by |
| --- | --- | --- |
| `initBattle` | once, before wave 1 | the hoard |
| `initEnemy` | each enemy as it enters | the sleeping Dragon |
| `onWaveArrived` | after a wave arrives | the final wave wakes the Dragon |
| `onRoundStart` | start of each round, before waves on the clock | bone piles reassemble, topple damage resets |
| `incomingDamage` | each hit on an enemy, before armor | Ambush, Dragonscale, the Phylactery |
| `afterEnemyHit` | after a hit lands | Topple |
| `onEnemyDefeated` | an enemy drops | Restless Dead, Bone Harvest, the Lich's Phylactery |
| `afterHeroStrike` | a hero's attack hit an enemy | Molten Hide |
| `smiteVulnerable` | Smite's bonus check | undead, dragonkin |
| `guarded` | single-target targeting | Pack Guard, the Phylactery |
| `damageBonus`, `buffSources` | an enemy's hit damage | Pack Tactics, the hoard, the Chieftain, the Wight's aura |
| `skipsTurn` | an enemy's turn | a toppled giant |
| `onEnergyDrained`, `onHeroHit` | an enemy's hit on a hero | Shiny Thief, Dirty Arrows |
| `onRoundEnd` | after the horde acts | the Dragon wakes, kobolds tithe, trolls regenerate |
| `botScore` | the smart bot rates a position | bone piles, hoard coins, topple progress |

Two hooks are keyed by name rather than by encounter, so any encounter's data can use them:

- **`specials`:** a champion's every-few-rounds move. It has `run`, plus optional `resolve` (fall back to something else, e.g. Goblin Toss → Ground Slam) and `actsFirst` (the War Drum).
- **`behaviors`:** how a monster acts. A behavior can define `init`, `idle`, `damage`, `act`, `target` and `onHit`. Behaviors without a handler hit the Warrior, else the weakest target.

Mechanics change the state they're given (core combat has already cloned it), and log through `log()` from `combat.ts`. Helpers such as `hitHero`, `targetableHeroes` and `makeEnemy` are exported there for modules to use.

## Not yet covered by hooks

- **Heuristic bot** (`src/engine/autoplay.ts`): it still has a few encounter-specific priorities (Phylactery first, topple focus, Wraith). It plays a new encounter without changes, just not cleverly.
- **Battle screen:** it shows a few encounter-specific widgets (the topple bar, the hoard tag).

import {
  createBattle,
  endRound,
  packBonus,
  performAction,
  specialOf,
  type BattleState,
  type HeroAction,
  type HeroSetup,
  type LogEntry,
} from '../engine/combat';
import { monsterName } from '../engine/encounter';
import type { MonsterSpec } from '../engine/horde';
import type { PoolBreakdown } from '../engine/rating';
import { rules, type HeroClass } from '../rules';

/**
 * A scripted round played by the real engine, so every number on screen is
 * what the game would actually do.
 */

function hero(heroClass: HeroClass, energy: number, gear: number): HeroSetup {
  const pool: PoolBreakdown = { heroClass, rating: 0, tier: 'good', basePool: energy, modifiers: [], pool: energy, doubleDouble: false, tripleDouble: false };
  return { heroClass, playerId: 0, playerName: rules.classes[heroClass].name, gear, pool };
}

function monster(id: string, kind: MonsterSpec['kind'], hp: number, damage: number): MonsterSpec {
  return {
    id,
    kind,
    name: monsterName(kind),
    hp,
    damage,
    tier: kind === 'goblin' ? undefined : 'good',
    isWarlord: false,
    extraActions: 0,
    staggers: 0,
  };
}

export interface Step {
  title: string;
  text: string;
  state: BattleState;
  /** Log entries this step produced. */
  events: LogEntry[];
}

export function buildSteps(): Step[] {
  const ogreDamage = rules.monsters.ogre.damageByTier![2];
  const start = createBattle(
    [hero('warrior', 20, 6), hero('cleric', 20, 5), hero('wizard', 20, 5)],
    [[monster('g1', 'goblin', 8, 3), monster('g2', 'goblin', 8, 3), monster('g3', 'goblin', 8, 3), monster('ogre', 'ogre', 45, ogreDamage)]],
  );
  const steps: Step[] = [];
  let state = start;
  const push = (title: string, text: string, next: BattleState) => {
    steps.push({ title, text, state: next, events: next.log.slice(state.log.length) });
    state = next;
  };
  const act = (a: HeroAction) => performAction(state, a);
  const pack = packBonus(start, start.enemies[0]);

  steps.push({
    title: 'Round 1 begins',
    text: `Your heroes act first, in any order. Every enemy shows what it will do this round, so you can react. Each goblin hits harder for every other goblin (Pack Tactics, +${pack} here), and the Ogre's ⚠ means its Ground Slam lands next round.`,
    state,
    events: [],
  });
  push(
    'Utility: Provoke',
    'Utilities like taunts, heals and buffs cost energy, and a hero can use as many as their energy allows. The Warrior Provokes the Ogre, so its attack now goes to the Warrior instead of the Wizard.',
    act({ heroId: 'warrior', actionId: 'provoke', targetIds: ['ogre'] }),
  );
  push(
    'Attack: Axe',
    'Each hero gets one attack per round. A basic weapon attack is free and gains +2 energy, which you spend later on bigger moves.',
    act({ heroId: 'warrior', actionId: 'axe', targetIds: ['g1'] }),
  );
  push(
    'Attack: Fireball',
    "Spells hit harder but cost more energy. The Wizard's Fireball clears all three goblins, and with them Pack Tactics.",
    act({ heroId: 'wizard', actionId: 'fireball', targetIds: ['g1', 'g2', 'g3'] }),
  );
  push(
    'Utility, then attack',
    'Utilities and an attack combine in one turn. The Cleric Curses the Ogre (−3 damage for 2 rounds), then makes its attack with Holy Strike, an advanced weapon attack that costs 2 energy.',
    act({ heroId: 'cleric', actionId: 'curse', targetIds: ['ogre'] }),
  );
  push('', '', act({ heroId: 'cleric', actionId: 'holy-strike', targetIds: ['ogre'] }));
  // Merge the Cleric's two actions into one step.
  const holy = steps.pop()!;
  const curse = steps.at(-1)!;
  curse.state = holy.state;
  curse.events = [...curse.events, ...holy.events];

  push(
    'End round: the horde acts',
    "Once you end the round, summons act, then the horde. The taunted Ogre hits the Warrior, and the Curse and the Warrior's Shield (+2 armor every round) shrink the blow.",
    endRound(state),
  );
  const ogre = state.enemies.find((e) => e.id === 'ogre')!;
  const special = specialOf(ogre);
  steps.push({
    title: 'Round 2: plan for the special',
    text: `It's the Ogre's ${special?.name ?? 'special'} round: ${special?.description.toLowerCase() ?? ''}. Brace with Shield Wall or Parry, heal ahead of time, or finish it first. Waves also arrive on a clock (rounds ${rules.combat.waveArrivalRounds.join(' and ')}), so new enemies can join mid-fight.`,
    state,
    events: [],
  });
  return steps;
}


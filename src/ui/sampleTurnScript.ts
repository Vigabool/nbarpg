import {
  createBattle,
  endRound,
  packBonus,
  performAction,
  activeSpecial,
  previewRound,
  specialDue,
  listActions,
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

/** Stand-ins for the NBA player under each hero row. */
const SAMPLE_PLAYER: Partial<Record<HeroClass, string>> = {
  warrior: 'Your rebounder',
  cleric: 'Your playmaker',
  rogue: 'Your defender',
  wizard: 'Your shooter',
};

function hero(heroClass: HeroClass, energy: number, gear: number): HeroSetup {
  const pool: PoolBreakdown = { heroClass, rating: 0, tier: 'good', basePool: energy, modifiers: [], pool: energy, doubleDouble: false, tripleDouble: false };
  return { heroClass, playerId: 0, playerName: SAMPLE_PLAYER[heroClass] ?? rules.classes[heroClass].name, gear, pool };
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
    fumbles: 0,
  };
}

export interface Step {
  title: string;
  text: string;
  state: BattleState;
  /** Log entries this step produced. */
  events: LogEntry[];
  /** An action waiting for its targets, shown the way the battle screen shows it. */
  aiming?: { heroId: HeroClass; actionName: string; max: number; valid: string[]; picked: string[] };
}

export function buildSteps(): Step[] {
  const ogreDamage = rules.monsters.ogre.damageByTier![2];
  const hexerDamage = rules.monsters.warlock.damageByTier![2];
  // A tough Ogre, so it survives the big hit and shows its special in round 2.
  const start = createBattle(
    [hero('warrior', 20, 6), hero('cleric', 20, 5), hero('rogue', 20, 6), hero('wizard', 20, 5)],
    [
      [
        monster('g1', 'goblin', 8, 3),
        monster('g2', 'goblin', 8, 3),
        monster('g3', 'goblin', 8, 3),
        monster('hexer', 'warlock', rules.monsters.warlock.hpByTier![2], hexerDamage),
        monster('ogre', 'ogre', 90, ogreDamage),
      ],
    ],
  );
  const steps: Step[] = [];
  let state = start;
  const push = (title: string, text: string, next: BattleState) => {
    steps.push({ title, text, state: next, events: next.log.slice(state.log.length) });
    state = next;
  };
  /** Several actions shown as one step. */
  const pushAll = (title: string, text: string, actions: HeroAction[]) => {
    const before = state;
    let next = state;
    for (const a of actions) next = performAction(next, a);
    steps.push({ title, text, state: next, events: next.log.slice(before.log.length) });
    state = next;
  };
  const act = (a: HeroAction) => performAction(state, a);
  const pack = packBonus(start, start.enemies[0]);
  const hexer = monsterName('warlock');
  // Name the special the board shows (in the Goblin Horde, Goblin Toss; Ground Slam once no goblins are left).
  const ogreSpecial = (s: BattleState) =>
    activeSpecial(
      s,
      s.enemies.find((e) => e.id === 'ogre')!,
    );

  steps.push({
    title: 'Round 1 begins',
    text: `Your heroes act first, in any order. Every enemy shows what it will do this round, so you can react. The ${hexer} is going after your Wizard. Each goblin hits harder for every other goblin (Pack Tactics, +${pack} here), and the Ogre's ⏳ means its ${ogreSpecial(start)?.name ?? 'special'} lands next round.`,
    state,
    events: [],
  });
  push(
    'Utility: Provoke',
    `Utilities like taunts, heals and buffs cost energy, and a hero can use as many as their energy allows. The ${hexer} was about to hit the Wizard; the Warrior Provokes it (⚑ on its card), and a taunted enemy must attack the taunter. Its arrow now points at the Warrior.`,
    act({ heroId: 'warrior', actionId: 'provoke', targetIds: ['hexer'] }),
  );
  push(
    'Attack: Shield Bash',
    "Each hero gets one attack per round. The Warrior's Shield Bash, an advanced weapon attack (2 energy), hits the Ogre and taunts it too. A taunted enemy is also a Backstab target: hold that thought.",
    act({ heroId: 'warrior', actionId: 'shield-bash', targetIds: ['ogre'] }),
  );
  const fireball = listActions(state, 'wizard').find((o) => o.def.id === 'fireball')!;
  const max = fireball.def.target.type === 'enemies' ? fireball.def.target.count : 1;
  steps.push({
    title: 'Aim: pick Fireball targets',
    text: `Some attacks hit several enemies. Fireball hits up to ${max}: tap each target. Enemies you can pick glow blue; picked ones turn gold. Then tap Cast. Here the Wizard picks all three goblins.`,
    state,
    events: [],
    aiming: { heroId: 'wizard', actionName: fireball.def.name, max, valid: fireball.validTargets, picked: ['g1', 'g2', 'g3'] },
  });
  push(
    'Attack: Fireball',
    "Spells hit harder but cost more energy. The Wizard's Fireball clears all three goblins, and with them Pack Tactics.",
    act({ heroId: 'wizard', actionId: 'fireball', targetIds: ['g1', 'g2', 'g3'] }),
  );
  pushAll(
    'Utility, then attack: Empower',
    'Utilities and an attack combine in one turn. The Cleric Empowers the Rogue (its next attack deals ×1.5), then attacks with its Mace. A basic weapon attack is free and gains +2 energy for bigger moves later.',
    [
      { heroId: 'cleric', actionId: 'empower', targetIds: ['rogue'] },
      { heroId: 'cleric', actionId: 'mace', targetIds: ['ogre'] },
    ],
  );
  const ogreBefore = state.enemies.find((e) => e.id === 'ogre')!.hp;
  pushAll(
    'The big hit: Crit + Backstab',
    'Buffs stack. The Rogue readies a Crit (×2) on top of Empower (×1.5), then Backstabs the Ogre, which is taunted by someone else, so Backstab doubles too. 10 × 2 × 2 × 1.5 =',
    [
      { heroId: 'rogue', actionId: 'ready-crit', targetIds: [] },
      { heroId: 'rogue', actionId: 'backstab', targetIds: ['ogre'] },
    ],
  );
  const big = steps.at(-1)!;
  big.text += ` ${ogreBefore - state.enemies.find((e) => e.id === 'ogre')!.hp} damage in one blow. Set it up when a big target is taunted.`;
  push(
    'End round: the horde acts',
    `Once you end the round, summons act, then the horde. The taunted ${hexer} and Ogre both hit the Warrior, and its Shield (+2 armor every round) shrinks each blow. Your Wizard is untouched.`,
    endRound(state),
  );
  // Every special landing this round, as the cards show them.
  const now = state.enemies
    .filter((e) => e.alive && specialDue(e, state.round))
    .map((e) => ({ who: e.name, sp: activeSpecial(state, e) }))
    .filter((x) => x.sp);
  const ogreHp = state.enemies.find((e) => e.id === 'ogre')!.hp;
  const warrior = state.heroes.find((h) => h.id === 'warrior')!;
  const falls = !previewRound(state).after.heroes.find((h) => h.id === 'warrior')!.alive;
  steps.push({
    title: 'Round 2: plan for the specials',
    text: `${now.length > 1 ? 'Two specials land' : 'A special lands'} this round (⚠ NOW): ${now.map((x) => `the ${x.who.split(' ').at(-1)}'s ${x.sp!.name}`).join(' and ')}, both shown on their cards.${
      falls ? ` The ☠ on the Warrior (${warrior.hp} HP) means it falls if you end the round now (in battle, tap ☠ to see who's hitting it).` : ''
    } Heal or shield ahead of time, or finish a threat first: the Ogre has only ${ogreHp} HP left. New waves can also arrive mid-fight (rounds ${rules.combat.waveArrivalRounds.join(' and ')}).`,
    state,
    events: [],
  });
  return steps;
}

/** The prototype's content: class kits, the Goblin Horde's playbook, and suggested plays. Numbers are at Average tier. */

export type Cls = 'warrior' | 'cleric' | 'rogue' | 'wizard' | 'ranger';
export type Tier = 'cold' | 'average' | 'good' | 'great' | 'elite';
export const TIERS: Tier[] = ['cold', 'average', 'good', 'great', 'elite'];
export const TIER_MULT: Record<Tier, number> = { cold: 0.75, average: 1, good: 1.15, great: 1.3, elite: 1.5 };
export const tierIndex = (t: Tier) => TIERS.indexOf(t);

export const CLASSES: Cls[] = ['warrior', 'cleric', 'rogue', 'wizard', 'ranger'];
export const CLASS_INFO: Record<Cls, { name: string; role: string; icon: string; hp: number; defense: string; defenseText: string }> = {
  warrior: {
    name: 'Warrior',
    role: 'the big',
    icon: '🛡',
    hp: 40,
    defense: 'Protect',
    defenseText: 'Gives one ally Armor against the horde’s hit (a Block at Elite), or halves the ram on the gate.',
  },
  cleric: { name: 'Cleric', role: 'the point guard', icon: '✚', hp: 28, defense: 'Triage', defenseText: 'Heals the most injured hero after the enemy turn.' },
  rogue: {
    name: 'Rogue',
    role: 'the pest',
    icon: '🗡',
    hp: 25,
    defense: 'Strip the Ball',
    defenseText: 'Knocks the ball loose from a goblin on the ram (two at Elite).',
  },
  wizard: { name: 'Wizard', role: 'the shooter', icon: '✦', hp: 22, defense: 'Ward', defenseText: 'Armor on one ally through the enemy turn.' },
  ranger: {
    name: 'Ranger',
    role: 'the wing scorer',
    icon: '🏹',
    hp: 30,
    defense: 'Close Out',
    defenseText: 'Slows one enemy: its hit this turn deals half.',
  },
};

/** What a move passes to the next hero. */
export type Enabler = { kind: 'armor'; amount: number } | { kind: 'sure' } | { kind: 'crit' } | { kind: 'pierce' } | { kind: 'split' };

export type Effect =
  'taunt' | 'expose' | 'mark' | 'strip' | 'slow' | 'partyArmor' | 'healAlly' | 'healParty' | 'tauntAll' | 'lastStand' | 'shadow' | 'revive' | 'assassinate';

export interface Move {
  id: string;
  cls: Cls;
  name: string;
  kind: 'enabler' | 'finisher' | 'signature' | 'legendary';
  /** Damage per hit. */
  damage?: number;
  /** How targets are chosen: the primary target, several enemies, every enemy, or no enemy at all. */
  targets?: 'primary' | 'multi' | 'all' | 'none';
  /** Enemies reached by a multi-target move. */
  count?: number;
  /** Separate hits on the way (Flurry, Double Strike). */
  hits?: number;
  /** Hits move on to another enemy after each one lands (Flurry); otherwise they stay on the target. */
  spread?: boolean;
  effect?: Effect;
  amount?: number;
  /** Ignores Armor and Barrier. */
  pierce?: boolean;
  /** Can't be evaded by Quick or cancelled by Block. */
  sure?: boolean;
  /** Doubled against a Taunted or Disabled target (Backstab). */
  doubleVsShaken?: boolean;
  enabler?: Enabler;
  action: string;
  enablerText?: string;
  note?: string;
}

const M = (m: Move) => m;
export const MOVES: Move[] = [
  // Warrior
  M({
    id: 'provoke',
    cls: 'warrior',
    name: 'Provoke',
    kind: 'enabler',
    damage: 3,
    targets: 'primary',
    effect: 'taunt',
    enabler: { kind: 'armor', amount: 3 },
    action: '3 damage, and the target is Taunted',
    enablerText: 'Armor +3',
    note: 'Pulls a dangerous hit onto the Warrior and shields whoever acts next.',
  }),
  M({
    id: 'screen',
    cls: 'warrior',
    name: 'Screen',
    kind: 'enabler',
    targets: 'none',
    effect: 'partyArmor',
    amount: 2,
    enabler: { kind: 'sure' },
    action: 'every hero gains Armor +2 through the enemy turn',
    enablerText: 'Sure (can’t be evaded or Blocked)',
    note: 'The screen frees the shooter.',
  }),
  M({
    id: 'slam',
    cls: 'warrior',
    name: 'Slam',
    kind: 'finisher',
    damage: 14,
    targets: 'primary',
    effect: 'slow',
    action: '14 damage to one enemy, and it’s Slowed',
  }),
  M({
    id: 'anchor',
    cls: 'warrior',
    name: 'Anchor',
    kind: 'finisher',
    damage: 8,
    targets: 'primary',
    effect: 'tauntAll',
    action: '8 damage, and every enemy is Taunted',
  }),
  M({
    id: 'bulwark',
    cls: 'warrior',
    name: 'Bulwark',
    kind: 'signature',
    damage: 12,
    targets: 'primary',
    effect: 'partyArmor',
    amount: 4,
    action: '12 damage, and every hero gains Armor +4 through the enemy turn',
  }),
  M({
    id: 'lastStand',
    cls: 'warrior',
    name: 'Last Stand',
    kind: 'legendary',
    damage: 16,
    targets: 'primary',
    effect: 'lastStand',
    action: '16 damage, and the Warrior can’t fall for the rest of the game',
  }),
  // Cleric
  M({
    id: 'empower',
    cls: 'cleric',
    name: 'Empower',
    kind: 'enabler',
    targets: 'none',
    effect: 'healAlly',
    amount: 6,
    enabler: { kind: 'crit' },
    action: 'heals the most injured ally 6',
    enablerText: 'Crit (+50% damage)',
    note: 'The core assist.',
  }),
  M({
    id: 'read',
    cls: 'cleric',
    name: 'Read the Defense',
    kind: 'enabler',
    targets: 'primary',
    effect: 'expose',
    enabler: { kind: 'pierce' },
    action: 'the target is Exposed (+3 from every hit this possession)',
    enablerText: 'Pierce (ignores Armor and Barrier)',
  }),
  M({
    id: 'smite',
    cls: 'cleric',
    name: 'Smite',
    kind: 'finisher',
    damage: 9,
    targets: 'primary',
    pierce: true,
    effect: 'healParty',
    amount: 3,
    action: '9 damage that Pierces, and every hero heals 3',
  }),
  M({
    id: 'benediction',
    cls: 'cleric',
    name: 'Benediction',
    kind: 'finisher',
    damage: 5,
    targets: 'primary',
    effect: 'healParty',
    amount: 8,
    action: '5 damage, and every hero heals 8',
  }),
  M({
    id: 'sanctuary',
    cls: 'cleric',
    name: 'Sanctuary',
    kind: 'signature',
    damage: 6,
    targets: 'primary',
    effect: 'healParty',
    amount: 15,
    action: '6 damage, and every hero heals 15',
  }),
  M({
    id: 'divine',
    cls: 'cleric',
    name: 'Divine Intervention',
    kind: 'legendary',
    damage: 8,
    targets: 'primary',
    effect: 'revive',
    action: '8 damage, and fallen heroes return at full HP',
  }),
  // Rogue
  M({
    id: 'strip',
    cls: 'rogue',
    name: 'Strip',
    kind: 'enabler',
    targets: 'primary',
    effect: 'strip',
    enabler: { kind: 'crit' },
    action: 'Disables a Champion: out of the horde’s next play, and it loses its Taunt or Quick (Exposes the boss or a goblin instead)',
    enablerText: 'Crit (+50% damage)',
  }),
  M({
    id: 'feint',
    cls: 'rogue',
    name: 'Feint',
    kind: 'enabler',
    damage: 2,
    targets: 'primary',
    effect: 'expose',
    enabler: { kind: 'sure' },
    action: '2 damage, and the target is Exposed',
    enablerText: 'Sure (can’t be evaded or Blocked)',
    note: 'A cheap hit that uses up a Quick or the Block.',
  }),
  M({
    id: 'backstab',
    cls: 'rogue',
    name: 'Backstab',
    kind: 'finisher',
    damage: 10,
    targets: 'primary',
    doubleVsShaken: true,
    action: '10 damage to one enemy, doubled if it’s Taunted or Disabled',
  }),
  M({
    id: 'flurry',
    cls: 'rogue',
    name: 'Flurry',
    kind: 'finisher',
    damage: 4,
    targets: 'multi',
    count: 3,
    hits: 3,
    spread: true,
    action: 'three hits of 4 across up to three enemies; a hit that misses is tried again on the same enemy',
  }),
  M({
    id: 'shadowstep',
    cls: 'rogue',
    name: 'Shadowstep',
    kind: 'signature',
    damage: 20,
    targets: 'primary',
    sure: true,
    effect: 'shadow',
    action: '20 damage that’s Sure; the Rogue can’t be targeted on the enemy turn',
  }),
  M({
    id: 'assassinate',
    cls: 'rogue',
    name: 'Assassinate',
    kind: 'legendary',
    damage: 20,
    targets: 'primary',
    sure: true,
    effect: 'assassinate',
    action: 'takes down any enemy but the boss (20 damage to the boss)',
  }),
  // Wizard
  M({
    id: 'spacing',
    cls: 'wizard',
    name: 'Spacing',
    kind: 'enabler',
    damage: 2,
    targets: 'all',
    enabler: { kind: 'split' },
    action: '2 damage to every enemy (uses up the Block and every Quick)',
    enablerText: 'Split (+1 target)',
  }),
  M({
    id: 'frost',
    cls: 'wizard',
    name: 'Frost',
    kind: 'enabler',
    damage: 4,
    targets: 'primary',
    effect: 'slow',
    enabler: { kind: 'pierce' },
    action: '4 damage, and the target is Slowed (loses Quick; its next hit deals half)',
    enablerText: 'Pierce (ignores Armor and Barrier)',
  }),
  M({
    id: 'fireball',
    cls: 'wizard',
    name: 'Fireball',
    kind: 'finisher',
    damage: 8,
    targets: 'multi',
    count: 3,
    action: '8 damage to each of up to three enemies',
  }),
  M({
    id: 'lightning',
    cls: 'wizard',
    name: 'Lightning Bolt',
    kind: 'finisher',
    damage: 16,
    targets: 'primary',
    sure: true,
    action: '16 damage to one enemy, Sure',
  }),
  M({
    id: 'chain',
    cls: 'wizard',
    name: 'Chain Lightning',
    kind: 'signature',
    damage: 10,
    targets: 'all',
    sure: true,
    action: '10 damage to every enemy, Sure',
  }),
  M({ id: 'meteor', cls: 'wizard', name: 'Meteor', kind: 'legendary', damage: 20, targets: 'all', sure: true, action: '20 damage to every enemy, Sure' }),
  // Ranger
  M({
    id: 'mark',
    cls: 'ranger',
    name: 'Mark',
    kind: 'enabler',
    targets: 'primary',
    effect: 'mark',
    enabler: { kind: 'crit' },
    action: 'the target is Exposed through the next possession too',
    enablerText: 'Crit (+50% damage)',
  }),
  M({
    id: 'hobble',
    cls: 'ranger',
    name: 'Hobble',
    kind: 'enabler',
    damage: 3,
    targets: 'primary',
    effect: 'slow',
    enabler: { kind: 'split' },
    action: '3 damage, and the target is Slowed (loses Quick; its next hit deals half)',
    enablerText: 'Split (+1 target)',
  }),
  M({
    id: 'doubleStrike',
    cls: 'ranger',
    name: 'Double Strike',
    kind: 'finisher',
    damage: 6,
    targets: 'primary',
    hits: 2,
    action: 'two hits of 6 (the second moves on if the first takes it down)',
  }),
  M({ id: 'aimed', cls: 'ranger', name: 'Aimed Shot', kind: 'finisher', damage: 11, targets: 'primary', pierce: true, action: '11 damage that Pierces' }),
  M({ id: 'volley', cls: 'ranger', name: 'Volley', kind: 'signature', damage: 6, targets: 'all', pierce: true, action: '6 damage to every enemy, Piercing' }),
  M({
    id: 'deadeye',
    cls: 'ranger',
    name: 'Deadeye',
    kind: 'legendary',
    damage: 11,
    targets: 'multi',
    count: 3,
    pierce: true,
    sure: true,
    action: 'three Aimed Shots at three enemies, Sure',
  }),
];
export const MOVE: Record<string, Move> = Object.fromEntries(MOVES.map((m) => [m.id, m]));
export const isFinisher = (m: Move) => m.kind === 'finisher' || m.kind === 'signature' || m.kind === 'legendary';

export interface PlayStep {
  cls: Cls;
  move: string;
}
export interface Play {
  id: string;
  name: string;
  steps: PlayStep[];
  tags: string[];
  blurb?: string;
}

/** Suggested plays. Suggest Plays picks four; the rest stay in the library. */
export const TEMPLATES: Play[] = [
  {
    id: 'critical-taunt',
    name: 'Critical Taunt',
    steps: [
      { cls: 'warrior', move: 'provoke' },
      { cls: 'cleric', move: 'empower' },
      { cls: 'rogue', move: 'backstab' },
    ],
    tags: ['vs a big'],
    blurb: 'Provoke Taunts the target and shields the Cleric; Empower’s Crit lands on a doubled Backstab.',
  },
  {
    id: 'kick-out',
    name: 'Kick Out',
    steps: [
      { cls: 'ranger', move: 'hobble' },
      { cls: 'wizard', move: 'fireball' },
    ],
    tags: ['vs a swarm', 'stop the ram'],
    blurb: 'Hobble’s Split sends the Fireball onto a fourth enemy: clears the ram crew.',
  },
  {
    id: 'shut-it-down',
    name: 'Shut It Down',
    steps: [
      { cls: 'rogue', move: 'strip' },
      { cls: 'wizard', move: 'lightning' },
    ],
    tags: ['stop their play', 'vs Quick or Block'],
    blurb: 'Strip takes a Champion out of the horde’s play; a Crit Lightning Bolt can’t be evaded or Blocked.',
  },
  {
    id: 'pick-and-pop',
    name: 'Pick and Pop',
    steps: [
      { cls: 'warrior', move: 'screen' },
      { cls: 'ranger', move: 'aimed' },
    ],
    tags: ['vs Armor', 'protect the lead'],
    blurb: 'Screen braces the party and makes the Aimed Shot Sure; the shot Pierces Armor and Barrier.',
  },
  {
    id: 'crack-the-shell',
    name: 'Crack the Shell',
    steps: [
      { cls: 'cleric', move: 'read' },
      { cls: 'warrior', move: 'slam' },
    ],
    tags: ['vs Armor', 'vs a big'],
    blurb: 'Read the Defense Exposes the target and the Slam Pierces its Armor.',
  },
  {
    id: 'marked-man',
    name: 'Marked Man',
    steps: [
      { cls: 'ranger', move: 'mark' },
      { cls: 'rogue', move: 'backstab' },
    ],
    tags: ['need a bucket'],
    blurb: 'The Mark’s Crit boosts the Backstab, and the target stays Exposed for the next possession.',
  },
  {
    id: 'spread-the-floor',
    name: 'Spread the Floor',
    steps: [
      { cls: 'wizard', move: 'spacing' },
      { cls: 'rogue', move: 'flurry' },
    ],
    tags: ['vs Quick or Block', 'vs a swarm'],
    blurb: 'Spacing uses up the Block and every Quick, then a four-hit Flurry lands everywhere.',
  },
  {
    id: 'regroup',
    name: 'Regroup',
    steps: [
      { cls: 'warrior', move: 'screen' },
      { cls: 'cleric', move: 'benediction' },
    ],
    tags: ['protect the lead'],
    blurb: 'Armor for everyone, then a Sure finisher that heals the whole party.',
  },
];
export const DEFAULT_PLAYBOOK = ['critical-taunt', 'kick-out', 'shut-it-down', 'pick-and-pop'];

/** The Goblin Horde's playbook, in priority order. */
export type EnemyKind = 'goblin' | 'shaman' | 'hexer' | 'sharpshooter' | 'cutthroat' | 'ogre' | 'chieftain' | 'wagon';
export const ENEMY_INFO: Record<EnemyKind, { name: string; icon: string; mirrors?: string; job: string }> = {
  goblin: {
    name: 'Goblin',
    icon: '👺',
    job: 'Crews the ram: four pushing make it hit the gate. A finisher that only hits goblins scores no bucket, just their takedowns.',
  },
  shaman: {
    name: 'Goblin Shaman',
    icon: '🥁',
    mirrors: 'assists leader',
    job: 'Playmaker: Call the Pack (goblins to the ram) and War Drum (boosts the ram). Barrier: every other Champion and the boss have Armor +2 while it stands.',
  },
  hexer: { name: 'Goblin Hexer', icon: '🔮', mirrors: 'top scorer', job: 'Setup: Hex Exposes a hero for the finisher after it.' },
  sharpshooter: {
    name: 'Goblin Sharpshooter',
    icon: '🎯',
    mirrors: 'second scorer',
    job: 'Ranged finisher on the hero who hurt the crew most. Quick: the first hit on it each possession misses.',
  },
  cutthroat: {
    name: 'Goblin Cutthroat',
    icon: '🔪',
    mirrors: 'steals leader',
    job: 'Finisher on an Exposed or wounded hero. Quick: the first hit on it each possession misses.',
  },
  ogre: {
    name: 'Ogre',
    icon: '🪨',
    mirrors: 'leading rebounder',
    job: 'Goblin Toss: throws a goblin at a wounded hero. Taunt: single-target hits must go to it while it stands. Armor 3.',
  },
  chieftain: {
    name: 'Goblin Chieftain',
    icon: '👑',
    mirrors: 'best opposing performance',
    job: 'The boss. Command boosts the ram; calls two goblins every other enemy turn. Block: the first hit on any enemy each possession is cancelled. Armor 2.',
  },
  wagon: { name: 'Loot wagon', icon: '📦', job: 'A treasure chest: 3 points and 5 gold when broken. Armor 2. No bucket for hitting it.' },
};

export interface HordeStep {
  actors: EnemyKind[];
  kind: 'callPack' | 'warDrum' | 'command' | 'hex' | 'hit' | 'toss';
}
export interface HordePlay {
  id: string;
  name: string;
  when: string;
  /** The trigger in a few words, for the scouting report. */
  short: string;
  target: 'disruptor' | 'cleric' | 'wounded' | 'lowest';
  steps: HordeStep[];
}
export const HORDE_PLAYS: HordePlay[] = [
  {
    id: 'reinforce',
    short: 'crew under 4',
    name: 'Reinforce',
    when: 'the ram has fewer than 4 crew',
    target: 'disruptor',
    steps: [
      { actors: ['shaman', 'chieftain'], kind: 'callPack' },
      { actors: ['sharpshooter', 'hexer', 'cutthroat'], kind: 'hit' },
    ],
  },
  {
    id: 'hunt',
    short: 'you clear 2+ crew',
    name: 'Hunt the Disruptor',
    when: 'a hero took down 2 or more crew last possession',
    target: 'disruptor',
    steps: [
      { actors: ['hexer'], kind: 'hex' },
      { actors: ['cutthroat', 'sharpshooter', 'ogre'], kind: 'hit' },
    ],
  },
  {
    id: 'healer',
    short: 'Cleric heals 10+',
    name: 'Cut Off the Healer',
    when: 'the Cleric healed 10 or more last possession',
    target: 'cleric',
    steps: [
      { actors: ['hexer'], kind: 'hex' },
      { actors: ['sharpshooter', 'cutthroat'], kind: 'hit' },
    ],
  },
  {
    id: 'toss',
    short: 'a hero under ⅓ HP',
    name: 'Toss',
    when: 'a hero is below a third of their HP',
    target: 'wounded',
    steps: [
      { actors: ['shaman', 'chieftain'], kind: 'warDrum' },
      { actors: ['ogre'], kind: 'toss' },
    ],
  },
  {
    id: 'pound',
    short: 'default',
    name: 'Pound the Gate',
    when: 'otherwise',
    target: 'lowest',
    steps: [
      { actors: ['chieftain', 'shaman'], kind: 'command' },
      { actors: ['ogre', 'cutthroat', 'sharpshooter', 'hexer', 'chieftain'], kind: 'hit' },
    ],
  },
];

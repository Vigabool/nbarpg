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
    defenseText: 'Contests every horde finisher aimed at one ally (or halves the ram on the gate).',
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
    defenseText: "Contests one enemy's finisher wherever it's aimed.",
  },
};

/** What a move passes to the next hero. */
export type Enabler =
  | { kind: 'damage'; amount: number }
  | { kind: 'crit' }
  | { kind: 'empower' }
  | { kind: 'open' }
  | { kind: 'split' }
  | { kind: 'heal'; amount: number }
  | { kind: 'armor'; amount: number }
  | { kind: 'putback' }
  | { kind: 'ignoreArmor' }
  | { kind: 'double' }
  | { kind: 'vsPoison'; amount: number }
  | { kind: 'vsMarked'; amount: number };

export type Effect =
  | 'taunt'
  | 'expose'
  | 'mark'
  | 'strip'
  | 'poison'
  | 'pin'
  | 'frost'
  | 'partyArmor'
  | 'healAlly'
  | 'healParty'
  | 'healParty15'
  | 'tauntAll'
  | 'lastStand'
  | 'shadow'
  | 'revive'
  | 'assassinate';

export interface Move {
  id: string;
  cls: Cls;
  name: string;
  kind: 'basic' | 'move' | 'finisher' | 'signature' | 'legendary';
  /** Damage per target. */
  damage?: number;
  /** How targets are chosen: the primary target, several, every enemy, or no enemy at all. */
  targets?: 'primary' | 'multi' | 'all' | 'none' | 'double';
  count?: number;
  effect?: Effect;
  amount?: number;
  ignoreArmor?: boolean;
  /** Scores even when contested (Aimed Shot). */
  ignoresContest?: boolean;
  three?: boolean;
  /** Doubled against a Taunted or Disabled target (Backstab). */
  doubleVsShaken?: boolean;
  alwaysCrit?: boolean;
  enabler?: Enabler;
  action: string;
  enablerText?: string;
  note?: string;
}

const M = (m: Move) => m;
export const MOVES: Move[] = [
  // Warrior
  M({
    id: 'chop',
    cls: 'warrior',
    name: 'Chop',
    kind: 'basic',
    damage: 4,
    targets: 'primary',
    enabler: { kind: 'damage', amount: 2 },
    action: '4 damage',
    enablerText: '+2 damage',
  }),
  M({
    id: 'provoke',
    cls: 'warrior',
    name: 'Provoke',
    kind: 'move',
    damage: 3,
    targets: 'primary',
    effect: 'taunt',
    enabler: { kind: 'armor', amount: 3 },
    action: '3 damage and taunts the enemy',
    enablerText: 'armor +3',
    note: 'Opens a contested target and pulls its hit onto the Warrior.',
  }),
  M({
    id: 'shieldWall',
    cls: 'warrior',
    name: 'Shield Wall',
    kind: 'move',
    targets: 'none',
    effect: 'partyArmor',
    amount: 2,
    enabler: { kind: 'armor', amount: 3 },
    action: 'every hero armor +2 through the enemy turn',
    enablerText: 'armor +3',
  }),
  M({
    id: 'boxOut',
    cls: 'warrior',
    name: 'Box Out',
    kind: 'move',
    damage: 4,
    targets: 'primary',
    enabler: { kind: 'putback' },
    action: '4 damage',
    enablerText: 'putback',
    note: "If the next finisher doesn't take its target down, the Warrior tips it in for half.",
  }),
  M({ id: 'slam', cls: 'warrior', name: 'Slam', kind: 'finisher', damage: 14, targets: 'primary', action: '14 damage to one enemy' }),
  M({ id: 'cleave', cls: 'warrior', name: 'Cleave', kind: 'finisher', damage: 8, targets: 'multi', count: 2, action: '8 damage to each of two enemies' }),
  M({
    id: 'bulwark',
    cls: 'warrior',
    name: 'Bulwark',
    kind: 'signature',
    damage: 10,
    targets: 'primary',
    effect: 'tauntAll',
    action: '10 damage, and every enemy is taunted through the enemy turn',
  }),
  M({
    id: 'lastStand',
    cls: 'warrior',
    name: 'Last Stand',
    kind: 'legendary',
    damage: 16,
    targets: 'primary',
    effect: 'lastStand',
    action: "16 damage, and the Warrior can't fall for the rest of the game",
  }),
  // Cleric
  M({
    id: 'mace',
    cls: 'cleric',
    name: 'Mace',
    kind: 'basic',
    damage: 3,
    targets: 'primary',
    enabler: { kind: 'heal', amount: 4 },
    action: '3 damage',
    enablerText: 'heal 4',
  }),
  M({
    id: 'empower',
    cls: 'cleric',
    name: 'Empower',
    kind: 'move',
    targets: 'none',
    effect: 'healAlly',
    amount: 6,
    enabler: { kind: 'empower' },
    action: 'heals the most injured ally 6',
    enablerText: '+50% damage',
    note: 'The core assist.',
  }),
  M({
    id: 'read',
    cls: 'cleric',
    name: 'Read the Defense',
    kind: 'move',
    targets: 'primary',
    effect: 'expose',
    enabler: { kind: 'open' },
    action: 'Exposes the enemy (+3 from every hit this possession)',
    enablerText: 'open look',
  }),
  M({
    id: 'bless',
    cls: 'cleric',
    name: 'Bless',
    kind: 'move',
    targets: 'none',
    effect: 'healParty',
    amount: 3,
    enabler: { kind: 'double' },
    action: 'heals every hero 3',
    enablerText: "doubles the next hero's enabler",
    note: 'The hockey assist.',
  }),
  M({
    id: 'smite',
    cls: 'cleric',
    name: 'Smite',
    kind: 'finisher',
    damage: 9,
    targets: 'primary',
    effect: 'healParty',
    amount: 3,
    action: '9 damage, and every hero heals 3',
  }),
  M({
    id: 'sanctuary',
    cls: 'cleric',
    name: 'Sanctuary',
    kind: 'signature',
    damage: 6,
    targets: 'primary',
    effect: 'healParty15',
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
    id: 'dagger',
    cls: 'rogue',
    name: 'Dagger',
    kind: 'basic',
    damage: 4,
    targets: 'primary',
    enabler: { kind: 'damage', amount: 2 },
    action: '4 damage',
    enablerText: '+2 damage',
  }),
  M({
    id: 'strip',
    cls: 'rogue',
    name: 'Strip',
    kind: 'move',
    targets: 'primary',
    effect: 'strip',
    enabler: { kind: 'crit' },
    action: 'Disables a Champion: open, and out of the horde’s next play (Exposes the boss or a goblin instead)',
    enablerText: 'crit (double damage)',
  }),
  M({
    id: 'poisonBlade',
    cls: 'rogue',
    name: 'Poison Blade',
    kind: 'move',
    damage: 3,
    targets: 'primary',
    effect: 'poison',
    amount: 3,
    enabler: { kind: 'vsPoison', amount: 3 },
    action: '3 damage now and 3 more after the enemy turn',
    enablerText: '+3 damage on a poisoned enemy',
  }),
  M({
    id: 'feint',
    cls: 'rogue',
    name: 'Feint',
    kind: 'move',
    targets: 'primary',
    effect: 'expose',
    enabler: { kind: 'split' },
    action: 'Exposes the enemy (+3 from every hit this possession)',
    enablerText: 'split (+1 target)',
  }),
  M({
    id: 'backstab',
    cls: 'rogue',
    name: 'Backstab',
    kind: 'finisher',
    damage: 10,
    targets: 'primary',
    doubleVsShaken: true,
    action: '10 damage, doubled on a Taunted or Disabled enemy',
  }),
  M({ id: 'flurry', cls: 'rogue', name: 'Flurry', kind: 'finisher', damage: 4, targets: 'multi', count: 3, action: '4 damage to each of three enemies' }),
  M({
    id: 'shadowstep',
    cls: 'rogue',
    name: 'Shadowstep',
    kind: 'signature',
    damage: 10,
    targets: 'primary',
    doubleVsShaken: true,
    alwaysCrit: true,
    effect: 'shadow',
    action: "a Backstab that always crits; the Rogue can't be targeted on the enemy turn",
  }),
  M({
    id: 'assassinate',
    cls: 'rogue',
    name: 'Assassinate',
    kind: 'legendary',
    damage: 20,
    targets: 'primary',
    effect: 'assassinate',
    action: 'takes down any enemy but the boss (20 damage to the boss)',
  }),
  // Wizard
  M({
    id: 'missile',
    cls: 'wizard',
    name: 'Magic Missile',
    kind: 'basic',
    damage: 4,
    targets: 'primary',
    ignoreArmor: true,
    enabler: { kind: 'ignoreArmor' },
    action: '4 damage, ignores armor',
    enablerText: 'the next hit ignores armor',
  }),
  M({
    id: 'gravity',
    cls: 'wizard',
    name: 'Gravity',
    kind: 'move',
    damage: 3,
    targets: 'primary',
    enabler: { kind: 'open' },
    action: '3 damage',
    enablerText: 'open look',
    note: 'The defense chases the shooter.',
  }),
  M({
    id: 'spacing',
    cls: 'wizard',
    name: 'Spacing',
    kind: 'move',
    damage: 2,
    targets: 'all',
    enabler: { kind: 'split' },
    action: '2 damage to every enemy',
    enablerText: 'split (+1 target)',
  }),
  M({
    id: 'frost',
    cls: 'wizard',
    name: 'Frost',
    kind: 'move',
    damage: 5,
    targets: 'primary',
    effect: 'frost',
    enabler: { kind: 'damage', amount: 3 },
    action: '5 damage, and the enemy’s next hit deals half',
    enablerText: '+3 damage',
  }),
  M({
    id: 'fireball',
    cls: 'wizard',
    name: 'Fireball',
    kind: 'finisher',
    damage: 8,
    targets: 'multi',
    count: 3,
    three: true,
    action: '8 damage to each of up to three enemies · 3-pointer',
  }),
  M({
    id: 'lightning',
    cls: 'wizard',
    name: 'Lightning Bolt',
    kind: 'finisher',
    damage: 14,
    targets: 'primary',
    three: true,
    action: '14 damage to one enemy · 3-pointer',
  }),
  M({ id: 'chain', cls: 'wizard', name: 'Chain Lightning', kind: 'signature', damage: 10, targets: 'all', three: true, action: '10 damage to every enemy' }),
  M({ id: 'meteor', cls: 'wizard', name: 'Meteor', kind: 'legendary', damage: 20, targets: 'all', three: true, action: '20 damage to every enemy' }),
  // Ranger
  M({
    id: 'longbow',
    cls: 'ranger',
    name: 'Longbow',
    kind: 'basic',
    damage: 4,
    targets: 'primary',
    enabler: { kind: 'damage', amount: 2 },
    action: '4 damage',
    enablerText: '+2 damage',
  }),
  M({
    id: 'mark',
    cls: 'ranger',
    name: 'Mark',
    kind: 'move',
    targets: 'primary',
    effect: 'mark',
    enabler: { kind: 'vsMarked', amount: 3 },
    action: 'Exposes the enemy through the next possession too',
    enablerText: '+3 damage on the marked enemy',
  }),
  M({
    id: 'drive',
    cls: 'ranger',
    name: 'Drive',
    kind: 'move',
    damage: 5,
    targets: 'primary',
    enabler: { kind: 'open' },
    action: '5 damage',
    enablerText: 'open look',
  }),
  M({
    id: 'pin',
    cls: 'ranger',
    name: 'Pin',
    kind: 'move',
    targets: 'primary',
    effect: 'pin',
    enabler: { kind: 'damage', amount: 2 },
    action: 'Pins a goblin: off the ram for the enemy turn (it still counts as crew)',
    enablerText: '+2 damage',
    note: 'Stalls the ram without drawing the horde’s reaction.',
  }),
  M({
    id: 'aimed',
    cls: 'ranger',
    name: 'Aimed Shot',
    kind: 'finisher',
    damage: 12,
    targets: 'primary',
    ignoreArmor: true,
    ignoresContest: true,
    action: '12 damage, ignores armor, scores even when contested',
  }),
  M({
    id: 'doubleStrike',
    cls: 'ranger',
    name: 'Double Strike',
    kind: 'finisher',
    damage: 6,
    targets: 'double',
    action: 'two hits of 6 (the second moves on if the first takes it down)',
  }),
  M({ id: 'volley', cls: 'ranger', name: 'Volley', kind: 'signature', damage: 6, targets: 'all', action: '6 damage to every enemy' }),
  M({
    id: 'deadeye',
    cls: 'ranger',
    name: 'Deadeye',
    kind: 'legendary',
    damage: 12,
    targets: 'multi',
    count: 3,
    ignoreArmor: true,
    ignoresContest: true,
    action: 'three Aimed Shots at three enemies',
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
    blurb: 'Provoke opens the target and shields the Cleric; Empower powers a doubled Backstab.',
  },
  {
    id: 'feint-and-fire',
    name: 'Feint and Fire',
    steps: [
      { cls: 'rogue', move: 'feint' },
      { cls: 'wizard', move: 'fireball' },
    ],
    tags: ['vs a swarm', 'stop the ram'],
    blurb: 'Feint splits the Fireball onto a fourth target: clears the ram crew.',
  },
  {
    id: 'shut-it-down',
    name: 'Shut It Down',
    steps: [
      { cls: 'rogue', move: 'strip' },
      { cls: 'wizard', move: 'lightning' },
    ],
    tags: ['stop their play', 'need a bucket'],
    blurb: 'Strip takes a Champion out of the horde’s play and sets up a critical Lightning Bolt.',
  },
  {
    id: 'stall-out',
    name: 'Stall Out',
    steps: [
      { cls: 'ranger', move: 'pin' },
      { cls: 'warrior', move: 'shieldWall' },
      { cls: 'ranger', move: 'aimed' },
    ],
    tags: ['stop the ram', 'protect the lead'],
    blurb: 'Pin stalls the ram without drawing reinforcements; Shield Wall braces the party.',
  },
  {
    id: 'pick-and-roll',
    name: 'Pick and Roll',
    steps: [
      { cls: 'warrior', move: 'provoke' },
      { cls: 'ranger', move: 'drive' },
      { cls: 'warrior', move: 'slam' },
    ],
    tags: ['vs a big'],
    blurb: 'The Warrior sets the screen, the Ranger drives, and the Warrior rolls to the rim.',
  },
  {
    id: 'hockey-assist',
    name: 'Hockey Assist',
    steps: [
      { cls: 'cleric', move: 'bless' },
      { cls: 'ranger', move: 'mark' },
      { cls: 'rogue', move: 'backstab' },
    ],
    tags: ['need a bucket'],
    blurb: 'Bless doubles the Mark’s bonus for the Backstab, and the Mark carries into the next possession.',
  },
  {
    id: 'gravity-bolt',
    name: 'Gravity Drive',
    steps: [
      { cls: 'wizard', move: 'gravity' },
      { cls: 'ranger', move: 'aimed' },
    ],
    tags: ['need a bucket'],
    blurb: 'Two touches, no Rogue or Warrior needed: good when the Wizard is doubled.',
  },
  {
    id: 'box-and-bolt',
    name: 'Box and Bolt',
    steps: [
      { cls: 'cleric', move: 'read' },
      { cls: 'warrior', move: 'boxOut' },
      { cls: 'wizard', move: 'lightning' },
    ],
    tags: ['vs a big'],
    blurb: 'Read the Defense exposes the target, and Box Out gives the Bolt a putback.',
  },
];
export const DEFAULT_PLAYBOOK = ['critical-taunt', 'feint-and-fire', 'shut-it-down', 'stall-out'];

/** The Goblin Horde's playbook, in priority order. */
export type EnemyKind = 'goblin' | 'shaman' | 'hexer' | 'sharpshooter' | 'cutthroat' | 'ogre' | 'chieftain' | 'wagon';
export const ENEMY_INFO: Record<EnemyKind, { name: string; icon: string; mirrors?: string; job: string }> = {
  goblin: {
    name: 'Goblin',
    icon: '👺',
    job: 'Crews the ram. Free goblins crowd the Champions: while 2 or more stand off the ram, every Champion is contested.',
  },
  shaman: { name: 'Goblin Shaman', icon: '🥁', mirrors: 'assists leader', job: 'Playmaker: Call the Pack (goblins to the ram) and War Drum (boosts the ram).' },
  hexer: { name: 'Goblin Hexer', icon: '🔮', mirrors: 'top scorer', job: 'Setup: Hex Exposes a hero for the finisher after it.' },
  sharpshooter: { name: 'Goblin Sharpshooter', icon: '🎯', mirrors: 'second scorer', job: 'Ranged finisher on the hero who hurt the crew most.' },
  cutthroat: { name: 'Goblin Cutthroat', icon: '🔪', mirrors: 'steals leader', job: 'Finisher on an Exposed or wounded hero. Guards the loot wagon.' },
  ogre: { name: 'Ogre', icon: '🪨', mirrors: 'leading rebounder', job: 'Goblin Toss: throws a goblin at a wounded hero.' },
  chieftain: {
    name: 'Goblin Chieftain',
    icon: '👑',
    mirrors: 'best opposing performance',
    job: 'The boss. Command boosts the ram; calls two goblins every other enemy turn.',
  },
  wagon: { name: 'Loot wagon', icon: '📦', job: 'A treasure chest: 3 points and 5 gold when broken. Contested while the Cutthroat stands.' },
};

export interface HordeStep {
  actors: EnemyKind[];
  kind: 'callPack' | 'warDrum' | 'command' | 'hex' | 'hit' | 'toss';
}
export interface HordePlay {
  id: string;
  name: string;
  when: string;
  target: 'disruptor' | 'cleric' | 'wounded' | 'lowest';
  steps: HordeStep[];
}
export const HORDE_PLAYS: HordePlay[] = [
  {
    id: 'reinforce',
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
    name: 'Pound the Gate',
    when: 'otherwise',
    target: 'lowest',
    steps: [
      { actors: ['chieftain', 'shaman'], kind: 'command' },
      { actors: ['ogre', 'cutthroat', 'sharpshooter', 'hexer', 'chieftain'], kind: 'hit' },
    ],
  },
];

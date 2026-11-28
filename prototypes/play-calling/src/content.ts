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
    defenseText: 'Gives one ally Armor against the horde’s hit, or halves the ram on the gate.',
  },
  cleric: { name: 'Cleric', role: 'the point guard', icon: '✚', hp: 28, defense: 'Triage', defenseText: 'Heals the most injured hero after the enemy turn.' },
  rogue: {
    name: 'Rogue',
    role: 'the pest',
    icon: '🗡',
    hp: 25,
    defense: 'Strip the Ball',
    defenseText: 'Knocks the ball loose from a goblin on the ram (two at Elite), or Steals from a Champion that’s Slowed or Exposed: a stop.',
  },
  wizard: {
    name: 'Wizard',
    role: 'the shooter',
    icon: '✦',
    hp: 22,
    defense: 'Ward',
    defenseText: 'Armor on one ally through the enemy turn: with Protect or Close Out on the same hit, often a stop.',
  },
  ranger: {
    name: 'Ranger',
    role: 'the wing scorer',
    icon: '🏹',
    hp: 30,
    defense: 'Close Out',
    defenseText: 'Slows one enemy: its hit this turn deals half (with Protect, usually a stop), and the Rogue can Steal from it.',
  },
};

/** What a move passes to the next hero. */
export type Enabler = (
  { kind: 'armor'; amount: number } | { kind: 'sure' } | { kind: 'crit' } | { kind: 'pierce' } | { kind: 'split' } | { kind: 'guided' }
) & {
  /** Also makes the finisher Quick: it dodges the first horde hit this turn (Spacing). */
  quick?: boolean;
};

export type Effect =
  | 'taunt'
  | 'expose'
  | 'mark'
  | 'markAll'
  | 'strip'
  | 'slow'
  | 'partyArmor'
  | 'healAlly'
  | 'healParty'
  | 'tauntAll'
  | 'lastStand'
  | 'shadow'
  | 'revive'
  | 'assassinate'
  | 'sanctuary';

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
  /** Ignores Armor. */
  pierce?: boolean;
  /** Can't be evaded by Quick or cancelled by Block. */
  sure?: boolean;
  /** Doubled against a Taunted or Disabled target (Backstab). */
  doubleVsShaken?: boolean;
  enabler?: Enabler;
  action: string;
  enablerText?: string;
  note?: string;
  /** The action in the Crypt, where it does more (holy or fire against the dead). */
  cryptAction?: string;
  /** The pass in the Crypt, when it differs. */
  cryptEnabler?: string;
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
    enablerText: 'Pierce (ignores Armor)',
  }),
  M({
    id: 'guide',
    cls: 'cleric',
    name: 'Guiding Light',
    kind: 'enabler',
    targets: 'none',
    enabler: { kind: 'guided' },
    action: 'lights a lane: the finisher it passes to ignores Taunt',
    cryptAction:
      'lights a lane: the finisher it passes to ignores Taunt and is Blessed (its hits are holy: ×1.5 against the dead, and the dead it kills stay down)',
    enablerText: 'Guided (ignores Taunt)',
    cryptEnabler: 'Guided and Blessed (ignores Taunt; its hits are holy)',
    note: 'The answer to a Taunting big: the finisher hits whoever you aim at.',
  }),
  M({
    id: 'smite',
    cls: 'cleric',
    name: 'Smite',
    kind: 'finisher',
    damage: 9,
    targets: 'primary',
    pierce: true,
    effect: 'healAlly',
    amount: 5,
    action: '9 damage that Pierces, and heals the most injured hero 5',
    cryptAction:
      '9 holy damage that Pierces (×1.5 against the dead), and heals the most injured hero 5. Each kill arcs to the next skeleton, up to 3 kills, and the dead it kills stay down',
    note: 'With Split it hits a second enemy and heals a second hero.',
  }),
  M({
    id: 'sanctuary',
    cls: 'cleric',
    name: 'Sanctuary',
    kind: 'signature',
    damage: 8,
    targets: 'primary',
    effect: 'sanctuary',
    action: '8 damage; for this and the next enemy turn the horde’s objective is frozen and every hero has Armor +3',
    cryptAction: '8 holy damage (×1.5 against the dead); for this and the next enemy turn the Ritual is frozen and every hero has Armor +3',
    note: 'Two possessions to go all in on offense: put your defenders in the play.',
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
    cryptAction: '8 holy damage (×1.5 against the dead), and fallen heroes return at full HP',
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
    damage: 9,
    targets: 'primary',
    doubleVsShaken: true,
    action: '9 damage to one enemy; ×2.5 and Sure if it’s Taunted or Disabled',
    note: 'The Warrior’s Provoke (or the Rogue’s Strip) sets it up.',
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
    enabler: { kind: 'split', quick: true },
    action: '2 damage to every enemy (uses up the Block and every Quick)',
    enablerText: 'Split (+1 target), and the finisher is Quick (dodges the first hit)',
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
    enablerText: 'Pierce (ignores Armor)',
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
    cryptAction: '8 fire damage to each of up to three enemies: the dead it kills stay down',
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
  M({
    id: 'meteor',
    cls: 'wizard',
    name: 'Meteor',
    kind: 'legendary',
    damage: 20,
    targets: 'all',
    sure: true,
    action: '20 damage to every enemy, Sure',
    cryptAction: '20 fire damage to every enemy, Sure: the dead it kills stay down',
  }),
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
    damage: 10,
    targets: 'multi',
    count: 2,
    effect: 'markAll',
    action: '10 damage to each of two enemies, and both are Marked (Exposed through the next possession too)',
    note: 'Sets up two takedowns for the next possession.',
  }),
  M({
    id: 'aimed',
    cls: 'ranger',
    name: 'Aimed Shot',
    kind: 'finisher',
    damage: 18,
    targets: 'primary',
    pierce: true,
    action: '18 damage that Pierces: the biggest single hit',
  }),
  M({ id: 'volley', cls: 'ranger', name: 'Volley', kind: 'signature', damage: 6, targets: 'all', pierce: true, action: '6 damage to every enemy, Piercing' }),
  M({
    id: 'deadeye',
    cls: 'ranger',
    name: 'Deadeye',
    kind: 'legendary',
    damage: 18,
    targets: 'multi',
    count: 3,
    pierce: true,
    sure: true,
    action: 'three Aimed Shots (18, Piercing) at three enemies, Sure',
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
    blurb: 'Provoke Taunts the target and shields the Cleric; Empower’s Crit lands on a ×2.5 Backstab. With the Barrier up, Provoke only breaks it.',
  },
  {
    id: 'kick-out',
    name: 'Kick Out',
    steps: [
      { cls: 'ranger', move: 'hobble' },
      { cls: 'wizard', move: 'fireball' },
    ],
    tags: ['vs a swarm', 'stop the ram'],
    blurb: 'Hobble breaks the Barrier or Splits the Fireball onto a fourth enemy: clears the ram crew.',
  },
  {
    id: 'frost-bolt',
    name: 'Frost Bolt',
    steps: [
      { cls: 'wizard', move: 'frost' },
      { cls: 'ranger', move: 'aimed' },
    ],
    tags: ['vs the Barrier', 'vs Armor'],
    blurb: 'Frost breaks the Barrier (or Slows the target and passes Pierce), and the Aimed Shot Pierces Armor.',
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
    blurb: 'Screen braces the party and makes the Aimed Shot Sure; the shot Pierces Armor.',
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
    blurb: 'Spacing breaks the Barrier or uses up the Block and every Quick, then the Flurry lands.',
  },
  {
    id: 'regroup',
    name: 'Regroup',
    steps: [
      { cls: 'warrior', move: 'screen' },
      { cls: 'cleric', move: 'smite' },
    ],
    tags: ['protect the lead'],
    blurb: 'Armor for everyone, then a Sure Smite that heals the most injured hero.',
  },
  {
    id: 'light-the-way',
    name: 'Light the Way',
    steps: [
      { cls: 'cleric', move: 'guide' },
      { cls: 'ranger', move: 'aimed' },
    ],
    tags: ['vs a big', 'vs the dead'],
    blurb: 'Guiding Light takes the Aimed Shot past any Taunt; in the Crypt it is Blessed, so what it kills stays dead.',
  },
  {
    id: 'double-team',
    name: 'Double Team',
    steps: [
      { cls: 'warrior', move: 'screen' },
      { cls: 'ranger', move: 'doubleStrike' },
    ],
    tags: ['vs Champions', 'set up takedowns'],
    blurb: 'Screen makes Double Strike Sure through Quick and Block; it hits two Champions and Marks both for next possession’s takedowns.',
  },
  {
    id: 'twin-smite',
    name: 'Twin Smite',
    steps: [
      { cls: 'ranger', move: 'hobble' },
      { cls: 'cleric', move: 'smite' },
    ],
    tags: ['vs the dead', 'heal'],
    blurb: 'Hobble Splits the Smite onto a second target and heals a second hero; in the Crypt each Smite kill arcs to the next skeleton.',
  },
  {
    id: 'holy-flurry',
    name: 'Holy Flurry',
    steps: [
      { cls: 'cleric', move: 'guide' },
      { cls: 'rogue', move: 'flurry' },
    ],
    tags: ['vs the dead', 'vs a swarm'],
    blurb: 'Guiding Light Blesses the Flurry: in the Crypt every hit is holy, so the skeletons it kills stay down.',
  },
];

/**
 * The plans each encounter should support: a playbook that commits to one way to win. Each uses all five
 * heroes' touches (a book that leaves a hero out runs dry and falls back on Isos). Picked from a search of
 * every four-play book (scripts/books.ts) and tested with the simulator (STRATEGY=<id>); see docs/concept-play-calling.md.
 */
export const PLANS: { id: string; encounter: Encounter; name: string; idea: string; playbook: string[] }[] = [
  {
    id: 'gh-ram',
    encounter: 'goblin-horde',
    name: 'Clear the Ram',
    idea: 'No Critical Taunt: Fireball starves the ram crew, Strip and Lightning take the Champions, Smite heals.',
    playbook: ['kick-out', 'shut-it-down', 'regroup', 'twin-smite'],
  },
  {
    id: 'gh-hunt',
    encounter: 'goblin-horde',
    name: 'Hunt Champions',
    idea: 'Critical Taunt and Double Team race takedowns; Kick Out keeps just enough of the crew off the ram.',
    playbook: ['critical-taunt', 'kick-out', 'shut-it-down', 'double-team'],
  },
  {
    id: 'gh-lockdown',
    encounter: 'goblin-horde',
    name: 'Lockdown',
    idea: 'The Warrior and Rogue never touch the ball: they defend every turn.',
    playbook: ['kick-out', 'frost-bolt', 'light-the-way', 'twin-smite'],
  },
  {
    id: 'cr-stop',
    encounter: 'crypt',
    name: 'Stop the Ritual',
    idea: 'Twin Smite closes the graves and Kick Out burns the guard down; once fewer than 3 skeletons stand, Critical Taunt takes the Necromancer before halftime.',
    playbook: ['critical-taunt', 'kick-out', 'shut-it-down', 'twin-smite'],
  },
  {
    id: 'cr-lich',
    encounter: 'crypt',
    name: 'Face the Lich',
    idea: 'Leave the ritual running: Light the Way’s Blessed Aimed Shots take the lieutenants and the phylactery, then Critical Taunt brings down the Lich.',
    playbook: ['critical-taunt', 'crack-the-shell', 'spread-the-floor', 'light-the-way'],
  },
  {
    id: 'cr-fire',
    encounter: 'crypt',
    name: 'Fire Volume',
    idea: 'No holy damage: Fireball and Flurry burn the guard down, but the graves stay open, so the Necromancer is hard to reach.',
    playbook: ['critical-taunt', 'kick-out', 'shut-it-down', 'spread-the-floor'],
  },
];
/** A move's action as this encounter plays it (the Crypt adds holy and fire). */
export const moveAction = (m: Move, encounter?: string) => (encounter === 'crypt' && m.cryptAction) || m.action;
/** A move's pass as this encounter plays it. */
export const moveEnabler = (m: Move, encounter?: string) => (encounter === 'crypt' && m.cryptEnabler) || m.enablerText;
/** A pass in a word or two, for move cards: Split + Quick for Spacing, Guided + Blessed in the Crypt. */
export function buffShort(m: Move, encounter?: string): string {
  if (!m.enabler) return '';
  if (m.enabler.kind === 'armor') return 'Armor';
  const base = (m.enablerText ?? '').split(' (')[0];
  if (m.enabler.quick) return `${base} + Quick`;
  if (m.enabler.kind === 'guided' && encounter === 'crypt') return 'Guided + Blessed';
  return base;
}
export const DEFAULT_PLAYBOOK = ['critical-taunt', 'kick-out', 'frost-bolt', 'spread-the-floor'];
/** The Crypt's suggested plays: it needs holy damage (Twin Smite) to close the graves. */
export const CRYPT_PLAYBOOK = ['critical-taunt', 'kick-out', 'shut-it-down', 'twin-smite'];
export const suggestedPlaybook = (encounter?: string) => (encounter === 'crypt' ? CRYPT_PLAYBOOK : DEFAULT_PLAYBOOK);

/** The Goblin Horde's playbook, in priority order. */
export type EnemyKind =
  'goblin' | 'shaman' | 'hexer' | 'sharpshooter' | 'cutthroat' | 'ogre' | 'chieftain' | 'wagon' | 'lich' | 'phylactery' | 'grave' | 'wraith';
/** The encounters this prototype can play. */
export type Encounter = 'goblin-horde' | 'crypt';
export type EnemyInfo = { name: string; icon: string; mirrors?: string; job: string };
export const ENEMY_INFO: Record<EnemyKind, EnemyInfo> = {
  goblin: {
    name: 'Goblin',
    icon: '👺',
    job: 'Crews the ram: each one pushing adds a quarter of its hit on the gate. A finisher that only hits goblins scores no bucket, just their takedowns.',
  },
  shaman: {
    name: 'Goblin Shaman',
    icon: '🥁',
    mirrors: 'assists leader',
    job: 'War Drum (automatic): the ram hits +2 while it stands. Each enemy turn it casts one: Call the Pack (goblins to the ram) when fewer than 4 are on the ram, otherwise the Barrier, a wall in front of the whole horde for your next possession until a damaging hit breaks it.',
  },
  hexer: { name: 'Goblin Hexer', icon: '🔮', mirrors: 'top scorer', job: 'Setup: Hex Exposes a hero for the finisher after it, and takes away its Quick.' },
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
  lich: { name: 'Lich', icon: '☠️', mirrors: 'best opposing performance', job: 'The Crypt’s boss.' },
  wraith: { name: 'Wraith', icon: '👻', job: 'The Crypt’s Necromancer after an early takedown.' },
  phylactery: { name: 'Phylactery', icon: '⚱️', job: 'The Lich’s soul jar.' },
  grave: { name: 'Open grave', icon: '🪦', job: 'Raises a skeleton each quarter.' },
};

/** The Crypt's cast: the same roles as the Goblin Horde, with the dead's own rules. */
export const CRYPT_INFO: Partial<Record<EnemyKind, EnemyInfo>> = {
  goblin: {
    name: 'Skeleton',
    icon: '💀',
    job: 'Guards the Necromancer: while 3 or more skeletons stand, he can’t be hit. Restless: a weapon kill leaves a bone pile that rises next possession with half its HP; fire or a Blessed finisher destroys it for good, and only then does it score.',
  },
  shaman: {
    name: 'Wight',
    icon: '🧟',
    mirrors: 'assists leader',
    job: 'Unholy Vigor (automatic): the ritual scores 1 more each turn while it stands. On an enemy turn with bone piles on the floor, it casts Raise Dead: every pile rises at once, at the HP it had before it crumbled.',
  },
  hexer: {
    name: 'Necromancer',
    icon: '🧙',
    mirrors: 'top scorer',
    job: 'Works the ritual and never attacks. Warded while 3 or more skeletons stand. Take him down before halftime and the ritual breaks (a bounty); his soul flees into the phylactery and he rises as a Wraith. Still standing at halftime, he becomes the Lich.',
  },
  sharpshooter: {
    name: 'Skeletal Archer',
    icon: '🏹',
    mirrors: 'second scorer',
    job: 'Ranged finisher. Quick: the first hit on it each possession misses.',
  },
  cutthroat: {
    name: 'Ghoul',
    icon: '🦴',
    mirrors: 'steals leader',
    job: 'Setup: Paralyzing Claws take a touch from a hero (and its Quick) and add 2 to the next hit.',
  },
  ogre: {
    name: 'Bone Knight',
    icon: '⚔️',
    mirrors: 'leading rebounder',
    job: 'A big skeleton. Restless: a weapon kill leaves it a bone pile that rises once, at half HP; fire or a Blessed finisher ends it. Bone Toss: throws a skeleton at a wounded hero.',
  },
  lich: {
    name: 'Lich',
    icon: '☠️',
    mirrors: 'best opposing performance',
    job: 'The Necromancer, transformed at halftime if he was still standing. Death Bolt every enemy turn: 1.5× damage to the lowest-HP hero, ignoring Armor. Takes half damage while the phylactery stands.',
  },
  wraith: {
    name: 'Wraith',
    icon: '👻',
    job: 'What’s left of the Necromancer after an early takedown. Intangible: only Wizard spells and holy hits touch it, and the first one makes it solid for the possession. Destroyed, it re-forms 2 possessions later at half HP while the phylactery stands.',
  },
  phylactery: {
    name: 'Phylactery',
    icon: '⚱️',
    job: 'Holds the Necromancer’s soul. Only holy damage touches it. While it stands the Lich takes half damage and the Wraith keeps re-forming. Breaking it scores.',
  },
  grave: {
    name: 'Open grave',
    icon: '🪦',
    job: 'Raises a skeleton every enemy turn while the ritual lasts. Only holy damage (a Blessed finisher or a Cleric hit) consecrates it, closing it for good: +3.',
  },
};

/** An enemy kind's name, icon and description in an encounter. */
/** A hero's off-ball defense, in the words of the encounter (the Warrior and Rogue defend its objective). */
export function defenseText(cls: Cls, encounter: Encounter = 'goblin-horde'): string {
  const crypt = encounter === 'crypt';
  if (cls === 'warrior')
    return `Gives one ally Armor against the horde’s hit (with Close Out, usually a stop), or ${crypt ? 'guards the circle (halves what the ritual scores)' : 'braces the gate (halves the ram)'}.`;
  if (cls === 'rogue')
    return `${
      crypt ? 'Pins a skeleton so it doesn’t guard the Necromancer next possession' : 'Knocks the ball loose from a goblin on the ram'
    } (two at Elite), or Steals from a Champion that’s Slowed or Exposed: a stop.`;
  return CLASS_INFO[cls].defenseText;
}

export const enemyInfo = (kind: EnemyKind, encounter: Encounter = 'goblin-horde'): EnemyInfo =>
  (encounter === 'crypt' ? CRYPT_INFO[kind] : undefined) ?? ENEMY_INFO[kind];

export interface HordeStep {
  actors: EnemyKind[];
  kind: 'callPack' | 'warDrum' | 'command' | 'hex' | 'enervate' | 'hit' | 'toss';
  /** A pass the play can do without: with no one to make it, the finisher acts alone. */
  optional?: boolean;
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
      { actors: ['chieftain', 'hexer'], kind: 'command', optional: true },
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
      { actors: ['chieftain'], kind: 'command', optional: true },
      { actors: ['ogre', 'cutthroat', 'sharpshooter', 'hexer', 'chieftain'], kind: 'hit' },
    ],
  },
];

/** The Crypt's playbook, in priority order: the Goblin Horde's plays with the dead's own moves. */
export const CRYPT_PLAYS: HordePlay[] = [
  {
    id: 'hunt',
    short: 'you destroy 2+ dead',
    name: 'Hunt the Light',
    when: 'a hero destroyed 2 or more of the dead for good last possession',
    target: 'disruptor',
    steps: [
      { actors: ['cutthroat'], kind: 'enervate', optional: true },
      { actors: ['sharpshooter', 'ogre', 'wraith', 'cutthroat'], kind: 'hit' },
    ],
  },
  {
    id: 'healer',
    short: 'Cleric heals 10+',
    name: 'Cut Off the Healer',
    when: 'the Cleric healed 10 or more last possession',
    target: 'cleric',
    steps: [
      { actors: ['cutthroat'], kind: 'enervate', optional: true },
      { actors: ['sharpshooter', 'wraith', 'cutthroat'], kind: 'hit' },
    ],
  },
  {
    id: 'toss',
    short: 'a hero under ⅓ HP',
    name: 'Bone Toss',
    when: 'a hero is below a third of their HP',
    target: 'wounded',
    steps: [
      { actors: ['lich'], kind: 'command', optional: true },
      { actors: ['ogre'], kind: 'toss' },
    ],
  },
  {
    id: 'pound',
    short: 'default',
    name: 'Grave Assault',
    when: 'otherwise',
    target: 'lowest',
    steps: [
      { actors: ['lich'], kind: 'command', optional: true },
      { actors: ['ogre', 'sharpshooter', 'wraith', 'cutthroat'], kind: 'hit' },
    ],
  },
];
export const hordePlays = (encounter: Encounter = 'goblin-horde') => (encounter === 'crypt' ? CRYPT_PLAYS : HORDE_PLAYS);

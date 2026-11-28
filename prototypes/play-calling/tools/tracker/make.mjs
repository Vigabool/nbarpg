// Builds the Strategy Tracker's data from the simulator's output.
// smart: scripts/books.ts with BOOKS=<each plan> (smart bot, four plays, auto defense, 32 built rosters).
// expert: scripts/sim.ts ROSTERS=8 MODES=balance,offense,defense,flexibility STRATEGY=<plan> (expert bot, the plan's book + Isos, best defense).
import fs from 'node:fs';
const dir = process.argv[2];
const self = fs.readFileSync(new URL(import.meta.url), 'utf8');
const plans = [
  [
    'goblin-horde',
    'gh-default',
    'Default playbook',
    'Suggest Plays today. The expert’s numbers here use the whole library, not just these four.',
    'critical-taunt,kick-out,frost-bolt,spread-the-floor',
    'Baseline',
  ],
  [
    'goblin-horde',
    'gh-ram',
    'Clear the Ram',
    'No Critical Taunt: Fireball starves the ram crew, Strip and Lightning take the Champions, Smite heals. The Warrior and Rogue sit, so it gets the most stops.',
    'kick-out,shut-it-down,regroup,twin-smite',
    'Thin on Hard',
  ],
  [
    'goblin-horde',
    'gh-hunt',
    'Hunt Champions',
    'Critical Taunt and Double Team race takedowns; Kick Out keeps just enough of the crew off the ram.',
    'critical-taunt,kick-out,shut-it-down,double-team',
    'Works',
  ],
  [
    'goblin-horde',
    'gh-lockdown',
    'Lockdown',
    'The Warrior and Rogue never touch the ball: two extra defenders every turn raise the stop chance. Much better with defense by count, still behind.',
    'kick-out,frost-bolt,light-the-way,twin-smite',
    'Not working',
  ],
  [
    'goblin-horde',
    'gh-best',
    'Best book found',
    'The search’s best: a hybrid of the hunt and the Cleric’s Twin Smite.',
    'critical-taunt,kick-out,shut-it-down,twin-smite',
    'Reference',
  ],
  [
    'crypt',
    'cr-stop',
    'Stop the Ritual',
    'Twin Smite closes the graves and Kick Out burns the guard down; with fewer than 3 skeletons standing, Critical Taunt takes the Necromancer before halftime. Breaks the ritual in about a third of games. The Crypt’s suggested playbook.',
    'critical-taunt,kick-out,shut-it-down,twin-smite',
    'Thin on Hard',
  ],
  [
    'crypt',
    'cr-lich',
    'Face the Lich',
    'Leave the ritual running: Light the Way’s Blessed Aimed Shots and Pick and Pop take the lieutenants and the phylactery, then Critical Taunt brings down the Lich.',
    'critical-taunt,shut-it-down,pick-and-pop,light-the-way',
    'Works',
  ],
  [
    'crypt',
    'cr-fire',
    'Fire Volume',
    'No holy damage: Fireball and Flurry burn the guard, but the graves stay open and the Necromancer stays warded.',
    'critical-taunt,kick-out,shut-it-down,spread-the-floor',
    'Not working',
  ],
  [
    'crypt',
    'cr-general',
    'General default playbook',
    'The Goblin Horde’s suggested plays, with no holy damage to close a grave. Expert numbers aren’t run for it.',
    'critical-taunt,kick-out,frost-bolt,spread-the-floor',
    'Reference',
  ],
];
const smart = {};
for (const enc of ['gh', 'cr'])
  for (const line of fs.readFileSync(`${dir}/final-${enc}.txt`, 'utf8').trim().split('\n')) {
    const [book, , built, , heroes] = line.split(' | ');
    const m = built.match(/normal (-?[\d.]+) \((\d+)\/32\) hard (-?[\d.]+)/);
    const h = Object.fromEntries(
      heroes
        .replace('heroes ', '')
        .split(' ')
        .map((x) => x.split(':')),
    );
    smart[`${enc === 'gh' ? 'goblin-horde' : 'crypt'}|${book}`] = { normal: +m[1], wins: +m[2], hard: +m[3], h };
  }
const expert = {};
let cur = null;
for (const line of fs.readFileSync(`${dir}/plans2.txt`, 'utf8').split('\n')) {
  const head = line.match(/^=== (.+) \((goblin-horde|crypt)\)/);
  if (head) cur = `${head[2]}|${head[1].startsWith('baseline') ? 'Default playbook' : head[1]}`;
  const m = line.match(/built\s+(normal|hard): expert wins (\d+)\/32, average margin expert (-?[\d.]+)/);
  if (m && cur) (expert[cur] ??= {})[m[1]] = { wins: +m[2], margin: +m[3] };
}
const names = { wa: 'Warrior', cl: 'Cleric', ro: 'Rogue', wi: 'Wizard', ra: 'Ranger' };
const rows = plans.map(([encounter, id, name, idea, playbook, status]) => {
  const s = smart[`${encounter}|${playbook}`];
  const e = id === 'cr-general' ? undefined : expert[`${encounter}|${name}`];
  const top = Object.entries(s.h).sort((a, b) => b[1] - a[1]);
  return {
    encounter: encounter === 'crypt' ? 'The Crypt' : 'Goblin Horde',
    id,
    plan: name,
    idea,
    playbook: playbook
      .split(',')
      .map((x) =>
        x
          .split('-')
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' '),
      )
      .join(' · '),
    status,
    smart_normal: s.normal,
    smart_hard: s.hard,
    smart_wins_normal: s.wins,
    expert_normal: e?.normal?.margin ?? null,
    expert_hard: e?.hard?.margin ?? null,
    expert_wins_normal: e?.normal?.wins ?? null,
    expert_wins_hard: e?.hard?.wins ?? null,
    top_scorer: `${names[top[0][0]]} ${top[0][1]}, ${names[top[1][0]]} ${top[1][1]}`,
  };
});
const meta = [
  { label: 'make.mjs', value: self, type: 'code', lang: 'javascript' },
  { label: 'Rosters', value: '32 built rosters: weeks 1–8 of 2025-26, four auto-draft modes, suggested heroes, Smart-picked games' },
  { label: 'Margins', value: 'Average heroes minus horde a game; wins out of 32 on Normal (Hard where named)' },
];
fs.writeFileSync(`${dir}/tracker/plans.json`, JSON.stringify({ rows, meta }, null, 1));
const ideas = [
  [
    'The Crypt reworked (Nov 28)',
    'The Necromancer’s transformation ritual: a flat clock (2 a turn to halftime), skeletons ward him while 3 or more stand, graves raise one a turn, an early takedown breaks the ritual and leaves a Wraith, otherwise the Lich rises at halftime; the phylactery halves the Lich and keeps the Wraith re-forming.',
    'Stop the Ritual',
    'Testing',
  ],
  [
    'Defense by count (Nov 28)',
    'Each hero off the ball adds about 12% × its defensive tier to the chance of stopping the horde’s play (cap 60%), rolled once a possession. Replaced Protect, Ward, Close Out, the Steal, Strip the Ball and Triage.',
    'Lockdown',
    'Testing',
  ],
  [
    'Horde halftime adjustments',
    'The double-team was too obscure and is gone. What should the horde do at halftime, and how does the player see it coming?',
    '',
    'Open',
  ],
  [
    'Stops and fast breaks (superseded)',
    'Built: Help Defense (Protect Armor 8), the Steal, Spacing passes Quick, a stop gives the next finisher Crit. No defender stops a hit alone. Goblin Horde stops went from 18% to 30% of hits; Lockdown (expert) from −2.8 to +5.5 on Normal.',
    'Lockdown',
    'Testing',
  ],
  [
    'Ward never makes a stop',
    'Fixed: Ward is Armor 8 × tier like Protect. With Close Out it stops 17–20% of hits; Blink (Quick) was rejected as a one-defender sure stop.',
    'Holy Chain',
    'Answered',
  ],
  ['Is Spacing’s Quick too good?', 'No: at most 14 dodges in 64 games, even in Spacing books. Hex and Enervate now take a hero’s Quick away.', '', 'Answered'],
  [
    'Holy Chain was the Crypt’s best plan by far',
    'Superseded by the rework: the Crypt’s plans are now Stop the Ritual, Face the Lich and Fire Volume.',
    '',
    'Answered',
  ],
  [
    'Re-tune difficulty after the defense changes',
    'Done without extra HP: +1 each turn the ram hits or the Ritual grows, and Champion hits score 3 on Hard. Smart bot, default book: Goblin Horde +11.3 / +2.9 (44% close games), Crypt +14.6 / +0.2 (39% close).',
    '',
    'Answered',
  ],
  ['Full-court press', 'Run one possession with all five heroes and no defenders: big offense, an unopposed horde turn.', '', 'Open'],
  [
    'Specials as plans',
    'Each double-double or triple-double special unlocks a plan: Volley as the Ranger’s crew clear, Chain Lightning Exposing every Champion.',
    '',
    'Open',
  ],
  ['A Lich that matters', 'It falls to one Fireball without firing: more HP, or an earlier rise.', 'Fire Volume', 'Open'],
  [
    'A cold shooter in the Crypt',
    'Sample week with a cold Wizard, smart bot: the default book loses 52–76 (Normal) and 50–86 (Hard); Holy Chain wins 56–28 and 56–46. Holy Chain is the answer when the shooter is cold.',
    'Holy Chain',
    'Answered',
  ],
  ['Hoard and Hearth objectives', 'The Dragon’s Lair’s Hoard (push your luck) and the Giant’s Hall’s Hearth (a tug-of-war scored each quarter).', '', 'Open'],
  ['Possession time', 'Playtests run 80–120 seconds a possession against a target of about 20.', '', 'Open'],
  [
    'Critical Taunt is in five of six plans',
    'With Backstab ×2.5 against a Taunt, the Rogue scores 22–29 a game in every book that has it. Without it the best Goblin Horde book is +13 on Normal and +1 on Hard.',
    'Clear the Ram',
    'New',
  ],
  [
    'The Ritual runs away when untended',
    'Fixed, then replaced: the reworked ritual scores a flat 2 a turn until halftime, whatever the crowd.',
    '',
    'Answered',
  ],
].map(([idea, detail, plan, status]) => ({ idea, detail, plan, status }));
fs.writeFileSync(
  `${dir}/tracker/ideas.json`,
  JSON.stringify(
    { rows: ideas, meta: [{ label: 'Source', value: 'docs/backlog.md, “Play-calling prototype: ideas to come back to”, and the plan search' }] },
    null,
    1,
  ),
);
console.log(JSON.stringify(rows.map((r) => [r.plan, r.smart_normal, r.smart_hard, r.expert_normal, r.top_scorer])));

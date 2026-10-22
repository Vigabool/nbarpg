# NBA Fantasy RPG — Design Doc

Oct 20, 2026 · @Nick

## Concept

A single-player tactical fantasy RPG where each hero in a five-person party is powered by a real NBA player. A player's real box score becomes that hero's resource pool for one battle, and the real opponents' performances build the monster horde. The real games deal the hand; the user's skill is in how they play it.

**Design pillars**

- **Stats deal the hand, the user plays it.** Real performance sets resources; tactical choices decide the outcome.
- **Every hero can always act.** A base gear attack works even on a terrible night.
- **Bad nights are tough, not fatal.** Each class rewards a different kind of game, so a party rarely collapses at once.
- **Highlight moments.** Thresholds (double-doubles, hot shooting nights) unlock big, memorable abilities.
- **Built for single player, shaped for multiplayer.** Drafting and player exclusivity come later, but nothing here should block them.

## Core loop

**Recommendation: one battle per week, with the user picking which game powers each hero.** Most players play 3–4 games a week, so a weekly cadence guarantees every hero has data and gives the user a meaningful choice.

1. **The week plays out.** Real games happen Monday through Sunday.
2. **Game selection.** For each hero, the user picks one of that player's games from the week.
3. **Horde forms.** Each chosen game also brings that game's mirror opponent into the horde (see Horde).
4. **Battle.** Turn-based, in waves. The party acts first each round, then the horde.
5. **Rewards.** XP, gold, and gear based on outcome and survivors.

**The selection tension.** Hindsight selection alone is trivially solved: always pick the best game. The counterweight is the mirror. Picking Curry's 40-point night also brings in the opponent's top scorer from that game, who may have gone off too. Best game for your hero is not always best game for the battle.

**Called Shot (multiplayer only).** Lock in a hero's game before tip-off for a pool bonus (e.g. +20%). Held for multiplayer, where hindsight picks may need limits.

**Roster: 5 heroes, 8 players.** The user rosters eight NBA players: five powering heroes and three reserves. At the start of each week, and only then, the user assigns which player powers each hero. Three reserves forces picks that can fill more than one class.

**Mid-week injuries.** No replacements for now. If a bound player doesn't play that week, the hero sits out the battle. An injury exception may come later.

## Roster and salary cap

**The game starts with the user building an eight-player roster under a salary cap.** The cap stops the user from rostering the league's eight best players, and it makes reserves a real tradeoff: cheap versatile players versus expensive specialists.

### New game flow

1. Choose a season and starting week (sandbox mode: any week of 2025–26).
2. Build a roster of eight players under the cap.
3. Assign five players to heroes; three are reserves.
4. Play the first weekly battle.

### Game salaries

**Recommendation: game salaries are set from performance, not real contracts.** Real salaries badly misprice players for this game: stars on rookie deals would be nearly free, and injured max-contract players would be traps. Game salaries keep every price tied to what a player does in battle. Real-salary pricing stays an option for a later mode.

A player's salary comes from their best season-average tier across all five classes:

| Best season tier | Game salary |
| --- | --- |
| Elite | 40 gold |
| Great | 28 gold |
| Good | 18 gold |
| Average | 10 gold |
| Cold | 4 gold |

**Versatility premium:** +5 gold for each additional class where the player is Great or better. A player who fits two classes well costs more, because they can cover more hero slots.

**Cap: 180 gold for eight players.** Salaries are shown in gold (1 gold = $1M of game salary) to fit the fantasy theme. The cap was raised from 140 after playtesting on calibrated 2025–26 data. It fits roughly two Elite players plus solid starters and cheap reserves, or a deep roster with no superstars.

### Roster moves

The roster stays fixed for a chapter of the season. Between chapters the user can make up to three moves (release a player, sign another under the cap). Hero assignments still change weekly from within the roster.

### Later: aprons and cap mechanics

The NBA's cap rules give natural hooks for later design:

- **Soft cap:** exceed the cap, but the horde's Threat rises.
- **First apron:** a larger overage costs PP each week.
- **Second apron:** the heaviest overage blocks roster moves for a chapter.
- **Salary updates:** in live mode, game salaries reprice monthly as players heat up or cool off.

## Stat ownership

Each class owns one primary stat (fills the pool) and one modifier stat (adjusts it). Turnovers and double/triple-doubles are universal. Every stat on the list now has a home.

| Class | Role | Primary stat (fills pool) | Modifier stat | Draft target |
| --- | --- | --- | --- | --- |
| Wizard | Offense, burst | 3PM | 3P% (min 5 3PA) | Volume shooters |
| Rogue | Offense, crits | Steals | Free throws made | Pesky defenders who draw fouls |
| Ranger | Hybrid, summons | Points | FG% (min 10 FGA) | Scorers |
| Warrior | Defense, tank | Rebounds (OREB weighted) | Blocks | Bigs |
| Cleric | Support, healing | Assists | Turnovers (double penalty) | Playmakers |
| All classes | Universal | — | Turnovers, double-double, triple-double | — |

**Overlap is fine.** Each hero is bound to a different player, so two classes using related stats (Ranger points include threes) never double-count. What each class really defines is which kind of player is worth drafting into it.

**Why free throws for the Rogue.** Steals are low-count and swingy, so the Rogue needs a second source. Drawing fouls fits the class: poison and bleed effects from "getting under the opponent's skin."

## Normalization

**Recommendation: convert each class's stat line into a Rating, map the Rating to a tier, and give every tier the same pool size across classes.** An elite steals night and an elite threes night then produce the same resources, so ability costs are balanced once instead of per stat. The long-term version replaces hand-set thresholds with league percentiles; tiers are the playtestable first pass.

### Step 1: Class Rating

| Class | Rating formula |
| --- | --- |
| Wizard | 3PM |
| Rogue | (3 × STL) + FTM |
| Ranger | PTS |
| Warrior | DREB + (2 × OREB) + (3 × BLK) |
| Cleric | AST |

### Step 2: Rating → tier → pool

Thresholds are rough starting estimates to calibrate in playtesting.

| Tier | Starting energy | Wizard (3PM) | Rogue | Ranger (PTS) | Warrior | Cleric (AST) |
| --- | --- | --- | --- | --- | --- | --- |
| Cold | 12 | 0–1 | 0–2 | 0–9 | 0–6 | 0–2 |
| Average | 20 | 2 | 3–5 | 10–17 | 7–12 | 3–5 |
| Good | 28 | 3 | 6–8 | 18–25 | 13–17 | 6–8 |
| Great | 36 | 4–5 | 9–11 | 26–34 | 18–23 | 9–11 |
| Elite | 45 | 6+ | 12+ | 35+ | 24+ | 12+ |

### Step 3: Modifiers

| Modifier | Effect |
| --- | --- |
| Wizard: 3P% ≥ 40% (min 5 3PA) | +4 pool |
| Wizard: 3P% < 30% (min 5 3PA) | −4 pool |
| Ranger: FG% ≥ 55% (min 10 FGA) | +4 pool |
| Ranger: FG% < 40% (min 10 FGA) | −4 pool |
| Cleric: each turnover | −2 pool (on top of the universal penalty) |
| All: each turnover above 2 | −2 pool |

The first two turnovers are free because turnovers rise with usage; without that allowance, star ball-handlers get punished for being stars.

### Universal: double-doubles and triple-doubles

- **Double-double:** +6 pool and unlocks the class Signature ability (one use per battle).
- **Triple-double:** +12 pool and unlocks the class Legendary ability (one use per battle) in addition to the Signature.

### Base gear scales with season averages

Gear damage and armor use the player's season-average Rating, mapped to the same tiers: Cold 3, Average 4, Good 5, Great 6, Elite 7. This gives each hero a stable character sheet (who the player is) and a volatile pool (how they played that night).

## Party classes

**Energy.** Every hero's resource is called energy. The box score sets starting energy (each class draws on different stats, per the tables above), abilities spend it, and basic weapon attacks earn it back. Costs assume an Average start of 20 energy and a battle of about 8 rounds. G = gear damage (3–7 from season tier).

**Each round, every hero gets one attack plus any number of utilities.** Attacks are anything that deals damage or defeats an enemy; utilities are everything else and are limited only by energy.

**Two weapon attacks per hero.** The basic attack is free and gains 2 energy. The advanced attack costs 1–2 energy (well under spells) and adds a class effect. Choosing between them each round is the core energy decision.

| Class | HP | Basic attack (+2 energy) | Advanced attack | Passive |
| --- | --- | --- | --- | --- |
| Warrior | 40 | Axe: G damage | Shield Bash (2): G + 2 damage and taunts the target | Shield: +2 armor every round |
| Ranger | 30 | Longbow: G damage to any enemy | Longsword (1): G + 3 to an enemy that attacked the Ranger last round | — |
| Cleric | 28 | Mace: G damage | Holy Strike (2): G damage and heals the most injured ally 3 | — |
| Rogue | 25 | Dagger: G damage | Poisoned Blade (2): G damage plus 2 poison for 2 rounds | — |
| Wizard | 22 | Staff: G damage | Arcane Bolt (1): G + 2 damage, ignores armor | — |

### Wizard abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Magic Missile | 3 | 6 damage to 1 target, never misses and is not reduced by armor |
| Lightning Bolt | 7 | 14 damage to 1 target |
| Fireball | 10 | 8 damage to up to 3 targets |
| Signature (DD): Chain Lightning | Free, once | 10 damage to every enemy in the wave |
| Legendary (TD): Meteor | Free, once | 20 damage to every enemy in the wave |

### Rogue abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Backstab | 5 | 10 damage; doubled if the target is attacking someone else this round (taunted) |
| Venom Strike | 6 | 4 damage + poison: 3 damage per round for 3 rounds |
| Ready Crit | 4 | Next attack (gear or ability) deals double damage |
| Signature (DD): Shadowstep | Free, once | Untargetable for 1 round; next attack is a guaranteed crit |
| Legendary (TD): Assassinate | Free, once | Instantly defeat any non-boss enemy |

### Ranger abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Double Strike | 5 | Two gear attacks |
| Aimed Shot | 6 | 12 damage, ignores armor |
| Summon Wolf | 8 | Wolf: 12 HP, 4 damage per round |
| Summon Bear | 14 | Bear: 25 HP, 5 damage per round, taunts 1 enemy each round |
| Signature (DD): Volley | Free, once | 6 damage to every enemy in the wave |
| Legendary (TD): Call of the Pack | Free, once | Summon a Bear and two Wolves |

### Warrior abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Provoke | 4 | Taunt 1 enemy until the warrior's next turn |
| Parry | 4 | +6 armor this round |
| Second Wind | 6 | Restore 12 HP to self |
| Shield Wall | 10 | All allies gain +4 armor this round |
| Signature (DD): Bulwark | Free, once | Taunt every enemy for 1 round; +6 armor |
| Legendary (TD): Last Stand | Free, once | Cannot drop below 1 HP for the rest of the battle |

### Cleric abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Cure Wounds | 3 | Restore 8 HP to 1 ally |
| Empower | 4 | 1 ally's next attack deals +50% damage |
| Curse | 5 | 1 enemy deals −3 damage for 2 rounds |
| Cure All | 8 | Restore 5 HP to every ally |
| Resurrect | 12 | Revive a fallen ally at half HP |
| Signature (DD): Sanctuary | Free, once | Restore 15 HP to every ally |
| Legendary (TD): Divine Intervention | Free, once | Revive all fallen allies at full HP |

## Mirrors and the horde

**Recommendation: each hero's chosen game spawns one Champion from the opposing team, mirrored by role.** Champions are scaled by that opposing player's line using the same tier system as heroes. Rank-and-file minions fill out the waves, and the single best opposing performance becomes the Warlord.

| Hero | Mirror: opposing player | Champion | Scaled by |
| --- | --- | --- | --- |
| Wizard | Top scorer | Warlock | Points |
| Ranger | Second-leading scorer | Hunter | Points + FG% |
| Warrior | Leading rebounder | Ogre | Rebounds + blocks |
| Rogue | Steals leader | Assassin | Steals |
| Cleric | Assists leader | Shaman | Assists |

**Fallbacks.** If the same opposing player qualifies for two mirrors, take the next player down the list. Ties go to minutes played.

**Minions.** Each opposing team adds 1 goblin per 35 team points scored (roughly 3 per game), with fixed stats. Opposing team FG% sets minion accuracy tier. *(Tuned by simulation: 1 per 25 originally, then 50, now 35 with goblins spread 20/40/40 across the waves so they fight alongside the Champions. Pack Tactics makes a big pack dangerous if it's left alive.)*

### Wave structure (blended horde)

1. **Wave 1 — Skirmish:** a small goblin pack (20% of the goblins). A warm-up that tempts you to spend early.
2. **Wave 2 — Champions arrive:** the weaker Champions plus 40% of the goblins.
3. **Wave 3 — The Warlord:** the strongest remaining Champions, the Warlord and the last 40% of the goblins.

**Waves arrive on a clock.** Wave 2 arrives at the start of round 2 and wave 3 at round 4, or at the start of the next round if the party clears the field first. Waves can overlap, which forces triage. A wave fights the round it arrives; the party always gets exactly one turn on it before it strikes.

**The Warlord** is the single best opposing performance across your five chosen games (highest points + rebounds + assists). It is a boosted version of that player's Champion with double HP and one extra action per round. This is the cost of hindsight: pick a hero's best game against a team whose star also went off, and you might be building your own final boss.

**The Warlord enrages** below half HP: +5 damage for the rest of the battle.

**Energy carries across waves.** There is no refill between waves beyond what basic attacks earn, so spending in wave 1 is a real decision.

## Monster behaviors

Monsters follow fixed behaviors; the opposing player's tier scales their HP and damage. Each Champion counters a different hero, so the horde's makeup changes which of your heroes is under pressure.

| Monster | Behavior | Special (every 2nd round on the field) | Pressures | HP by tier (Cold → Elite) | Damage by tier |
| --- | --- | --- | --- | --- | --- |
| Goblin (minion) | Taunter → Warrior → lowest HP. Passive **Pack Tactics:** +1 damage per other goblin on the field | — | AoE fodder; dangerous in numbers | 8 (fixed) | 2–4 by team FG%, + Pack Tactics |
| Ogre | Hits the taunter, else the Warrior | **Ground Slam:** every hero takes damage −2; its target is knocked prone | Whole party, through taunts | 30 → 60 | 10 → 18 |
| Warlock | Lowest-HP of Wizard and Cleric | **Hex:** party curse (−2 damage, 2 turns) + 3 to every hero, ignoring armor | Whole party | 18 → 36 | 8 → 15 |
| Hunter | Ignores taunts; lowest-armor hero | **Volley:** hits the two lowest-armor heroes | Back line | 20 → 40 | 8 → 15 |
| Assassin | Lowest-HP hero; each hit drains 2 energy | **Execute:** double damage to a hero below half HP | Injured heroes | 16 → 32 | 10 → 18 |
| Shaman | Heals the most injured monster and shields the horde | **War Drum:** every monster +2 damage next round | Your damage dealers | 18 → 36 | 4 → 8 |
| Warlord | Its Champion's behavior and special, double HP, two actions | — | The whole party | 2 × Champion | Champion + 2; +5 when enraged |

Specials are telegraphed: the Champion's card shows a ⚠ warning the round before. Champion damage is about 1.9× the first draft. Simulation showed the horde rarely threatened the party; the extra goblins later let Champion damage come back down a little.

**Opponent turnovers.** Every 3 turnovers by a Champion's mirrored player gives that Champion one stagger (it skips one action during the battle). This mirrors the hero turnover penalty.

**Targeting default.** Unless its behavior says otherwise, a monster attacks a hero who taunted it, then the Warrior, then the hero with the lowest HP.

## Progression

**Progress belongs to heroes, not players.** A hero keeps her gear, talents and affinities no matter which NBA player powers her this week. Heroes earn progression points (PP) each battle and spend them on three tracks. At these rates a hero earns roughly 80–100 PP over a season, enough to go deep in some tracks but not to max everything.

### Earning PP

| Source | PP |
| --- | --- |
| Each wave cleared | 2 (max 6) |
| Warlord defeated | 5 |
| Each hero standing at the end | 1 |
| Flawless battle (no hero fell) | 3 |
| Weekly bounty (one per week) | 4–6 |
| Spotlight: bound player hits Elite tier | 1 |
| Spotlight: double-double / triple-double | 1 / 3 |

Most PP comes from how you play, not from the box scores. Example bounties: defeat the Warlord within 3 rounds; win without using any Signature ability; win with the Cleric casting no heals.

PP is awarded to the party and split evenly across the five heroes, with spotlight PP going to that hero alone.

### Track 1: Gear upgrades

Each item levels Common → Rare → Epic → Legendary. Upgrades are permanent.

| Level | Cost | Effect |
| --- | --- | --- |
| Rare | 8 | +1 gear damage (or +1 armor for the Shield) |
| Epic | 15 | Another +1, and +2 to that hero's starting pool |
| Legendary | 25 | The item's signature effect (below) |

| Item | Legendary effect |
| --- | --- |
| Wizard Staff | Echo: gear attack also deals 2 damage to a second enemy |
| Rogue Dagger | Serrated: gear attacks apply 2 poison for 1 round |
| Ranger Longbow | Piercing: gear attacks ignore armor |
| Ranger Longsword | Counter: +2 more damage against an enemy that attacked the Ranger |
| Warrior Axe | Cleave: gear attack hits 2 enemies |
| Warrior Shield | Reflect: while taunting, return 2 damage per hit taken |
| Cleric Mace | Blessed: gear attack also heals the lowest-HP ally 2 |

### Track 2: Talent branches

Each class has two branches of three talents, costing 6, 10 and 15 PP in order. A hero can unlock both branches over time but has only one active per battle, chosen at the start of the week. The third talent in each branch is the payoff.

| Class | Branch A | Branch B |
| --- | --- | --- |
| Wizard | **Pyromancer:** Fireball hits 4 targets → Fireball costs 8 → Ignite: Fireball burns 2 per round for 2 rounds | **Stormcaller:** Lightning Bolt costs 5 → Bolt chains 6 to a second target → Static: every 3rd spell refunds 3 points |
| Rogue | **Assassin:** Backstab +4 damage → Ready Crit costs 2 → Execute: Backstab defeats a target under 8 HP | **Poisoner:** Venom lasts 1 more round → poison stacks → Toxic Cloud (new, 8): poison all enemies 2 per round for 3 rounds |
| Ranger | **Beastmaster:** Wolf +6 HP → Bear costs 11 → Pack Bond: summons heal 2 per round | **Marksman:** Aimed Shot costs 4 → Double Strike makes 3 attacks → Hunter's Mark (new, 5): target takes +3 damage from all sources |
| Warrior | **Guardian:** Provoke taunts 2 enemies → Shield Wall costs 7 → Intercept: once per wave, take a hit meant for an ally | **Berserker:** Second Wind adds +2 to the next attack → Rage: +1 gear damage per 10 HP lost → Whirlwind (new, 8): G damage to every enemy |
| Cleric | **Healer:** Cure Wounds heals 11 → Cure All costs 6 → Renewal (new, 6): ally heals 3 per round for 3 rounds | **Battle Priest:** Empower gives +75% → Curse lasts 3 rounds → Smite (new, 6): 10 damage, +5 vs Warlock and Shaman |

### Track 3: Stat affinities

Affinities change which stats feed a hero's Rating, widening which players fit the class. Each costs 10 PP to unlock. A hero starts with one affinity slot; a second slot costs 20 PP.

| Class | Affinity | Effect on Rating or pool |
| --- | --- | --- |
| Wizard | Free Throw Line | Every 3 FTM counts as one 3PM |
| Wizard | Heat Check | 3P% bonus threshold drops from 40% to 37% |
| Rogue | Two-Way | Each block adds 2 to the Rating |
| Rogue | Clean Hands | 0 turnovers: +4 pool |
| Ranger | Glass Eater | Each OREB adds 2 to the Rating |
| Ranger | Efficient Scorer | FG% bonus threshold drops from 55% to 52% |
| Warrior | Outlet Pass | Each assist adds 1 to the Rating |
| Warrior | Stretch Big | Each 3PM adds 2 to the Rating |
| Cleric | Floor General | 2 or fewer turnovers: +4 pool |
| Cleric | Point Forward | Every 2 rebounds add 1 to the Rating |

### Respec

For 3 PP, a hero can reset talents and affinities with a full refund. Gear upgrades are permanent. Cheap respecs keep experimenting fun as the players powering heroes change.

### Open: horde scaling with PP

The horde scales with real opponents, not party power, so upgraded heroes will eventually breeze through. The horde needs a Threat level tied to PP invested. Candidate approaches, not yet chosen:

- **Threat multiplier:** monster HP and damage rise with the party's total PP invested.
- **Chapters:** the season splits into chapters, each adding base horde strength, with the playoffs as the finale.
- **Warlord traits:** the Warlord gains a new trait at each Threat level.

## Multiplayer direction (future)

Single player comes first, but these choices keep the door open:

- **Draft exclusivity.** In a league, each NBA player can power only one hero. Normalized tiers make a draft fair across classes.
- **Hindsight limits.** Game selection may need rules in multiplayer: Called Shot mandatory, or a cap on swaps.
- **Shared horde.** League members could face the same Warlord each week, with a leaderboard on rounds survived or damage dealt.
- **Head-to-head.** Your heroes' chosen games could become the horde your opponent fights, and vice versa.

## Build plan

**The first milestone is one playable battle on real 2025–26 data, with rules stored as config.** Calibration happens alongside the data layer, as its first real use.

### Combat rules for implementation

| Rule | Decision |
| --- | --- |
| Actions | Each round, each hero gets one attack (gear attack or any ability that deals damage or defeats an enemy) plus any number of utility abilities the pool can pay for. The user chooses the order. A prone hero can do neither |
| Round structure | Party phase → summons act → enemy phase (poison and burn tick at its start) |
| Armor | Lasts until end of round, then resets; Shield's +2 reapplies each round |
| Randomness | None. Combat is fully deterministic; the real games supply the variance |
| Round cap | 12 rounds; the battle is lost if the horde is not cleared |
| Win / loss | Win by clearing all waves; lose if every hero falls or the round cap is hit |

### Project shape

- **Platform:** mobile-friendly web app, simple card-based visuals; art later.
- **Sandbox mode first:** replay any week of 2025–26. The live weekly mode comes later.
- **Rules as data:** classes, abilities, costs, tiers, monsters and PP values live in config files, so tuning is a data edit, not a code change.
- **Accounts:** a single local user for the MVP; storage designed to move to accounts later.
- **Source of truth:** this doc, exported to markdown into the repo and kept current as decisions change.

### Milestones

1. **Data layer + calibration:** ingest 2025–26 player game logs; compute tier thresholds (20+ minute nights, class-relevant comparison pools, percentile cutoffs at 20 / 50 / 75 / 92).
2. **Combat engine:** pool calculation, abilities, horde generation, waves and the Warlord, all driven by config; test battles run from real weeks.
3. **Battle UI:** salary-cap roster builder, weekly game selection, and one playable battle.
4. **Progression:** PP, gear, talents, affinities and respec.
5. **Later:** live weekly mode, horde scaling with PP, then multiplayer (drafting, Called Shot).

## Open questions

### Decided

| Topic | Decision |
| --- | --- |
| Calibration | Set tier thresholds from 2025–26 season data; recalibrate from 2026–27 results as the season goes |
| Reserves | Three reserve players; hero assignments set at the start of the week only |
| Injuries | No mid-week replacements for now |
| Positioning | No front/back row; taunt handles targeting |
| Fallen heroes | Out for the current battle only |
| Called Shot | Multiplayer feature |

### Implementation decisions (milestones 1–3)

Gaps in the rules above, filled in for the first build. All live in `src/rules/` config unless noted.

| Topic | Decision |
| --- | --- |
| Goblin targeting | No rows: goblins use the default targeting (taunter → Warrior → lowest HP) |
| Goblin accuracy | No randomness, so team FG% sets goblin damage instead: under 43% → 2, under 50% → 3, otherwise 4 |
| Minions per team | 1 per 50 team points (tuned from 25 for quicker battles); counted once per opposing team-game, even if two heroes picked the same game |
| Goblins per wave | 20% / 40% / 40%, weakest goblins first, so the pack fights alongside the Champions |
| Champions per wave | Wave 2 gets the weaker half (rounded up), wave 3 the rest plus the Warlord |
| Warlord not a mirror | If the best opposing performance isn't one of the five mirrors, it still becomes the Warlord, using the Champion type it rates highest in |
| Champion tiers | Warlock: PTS (Ranger thresholds). Hunter: PTS, ±1 tier for FG% ≥ 55% / < 40% (10+ FGA). Ogre: Warrior Rating. Assassin: 3 × STL (Rogue thresholds). Shaman: AST (Cleric thresholds) |
| Champion HP / damage | Linear steps from Cold to Elite across the doc's ranges (`monsters.json`) |
| Special timing | Each Champion's own clock: its 2nd round on the field, then every 2 rounds, so the ⚠ warning always shows a round ahead. A Warlord uses its special on its first action of those rounds |
| Warlock | Taunt still applies; otherwise targets the lower-HP of Wizard and Cleric. Special: Hex |
| Ogre | Special: Ground Slam; the knocked-down hero loses its next turn |
| Hunter | Only monster that ignores taunt; lowest armor, ties to lowest HP |
| Shaman | Heals the most injured monster (4–8 by tier) and gives the horde +2 armor through the next round; attacks only when nothing is injured |
| Stagger | Spent on the Champion's first actions after it arrives |
| Summons | Act after the party phase and bite the lowest-HP enemy. The Bear taunts the hardest-hitting untaunted enemy. Summons are valid targets for "lowest HP" targeting |
| Longsword | Can only target an enemy that attacked the Ranger last round |
| Double Strike | Two Longbow attacks; if the first kills, the second hits the weakest enemy |
| Crits / Empower | Multiply the whole next damaging action (all its targets), stack multiplicatively, then are consumed |
| Buff stacking | The same buff (Parry, Shield Wall, Ready Crit, Empower) can't stack with itself in a round; different buffs combine |
| Pool penalties | Cleric pays −2 for every turnover, on top of the universal −2 per turnover above 2. Triple-double gives +12 total (not +18). Pool floor 0 |
| Season tier | Season averages are rated against the single-game thresholds (sets gear and salary) |
| Roster pool | Players with 10+ games and 15+ minutes per game |
| Chapters | 4 weeks; up to 3 roster moves between chapters |
| Salary display | Gold, 1 gold = $1M; cap 180 gold |
| PP split | Party PP divided evenly (fractions kept); spotlight PP to that hero. Bounties not yet implemented |
| Wave transitions | Waves arrive on a clock (rounds 2 and 4) or at the start of the next round once the field is clear. A wave fights the round it arrives, after one party turn; it never gets a free hit after the party has acted |

### Still open

- [ ] Calibrate tier thresholds against 2025–26 game logs (Milestone 1)
- [ ] Run sample battles by hand to test pool sizes, ability costs and battle length
- [ ] Tune PP earn rates and upgrade costs in playtests
- [ ] Horde scaling: tie horde strength to PP invested
- [ ] Mid-week injury exception: needed, and what form?
- [ ] Playtest horde difficulty: tuned to ~78% bot wins, ~7.5 rounds, ~1.6 heroes fallen per battle (the bot is a weak player; target ~85–90% for a thoughtful human)
- [ ] Explore class-specific energy gain in combat, e.g. Warrior +1 when hit, Cleric +1 per heal cast, Rogue +2 on a kill

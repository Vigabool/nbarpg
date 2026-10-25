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
| Wizard | 22 | Staff: G damage | Magic Missile (1): G + 2 damage, never misses, ignores armor | — |

### Wizard abilities

| Ability | Cost | Effect |
| --- | --- | --- |
| Shield | 3 | +5 armor this round (utility; doesn't stack with itself) |
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
| Double Strike | 6 | Two Longbow attacks, on one enemy or split between two |
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

**Every role fights every week.** All five Champions appear in every encounter; opponent performance only changes how strong they are. A role whose hero sits out the week comes in at Average tier with no trait.

**Fallbacks.** If the same opposing player qualifies for two mirrors, take the next player down the list. Ties go to minutes played.

### Traits (Champions)

**A Champion is a role monster enhanced by its own mirrored player's big night.** A standout stat gives it one trait, a visible ability with a counter; cold and average nights bring a plain monster. The boss can have two, from its own line. Traits show on the pick-games screen, so choosing a hero's best game can mean facing a nastier mirror. Thresholds and effects live in `src/rules/traits.json`; about a quarter of Champions get one.

| Standout stat | Trait | Effect | Counter |
| --- | --- | --- | --- |
| 4+ blocks | ✋ Swat | Negates the first hit it takes each round | Open with a cheap hit |
| 4+ steals | 🫳 Pickpocket | Each hit steals 2 energy | Kill or taunt it before big spenders act |
| 12+ rebounds | 🔁 Second Chance | Once per battle, gets back up at 15% HP | Save burst for the second life |
| 10+ assists | 📣 Floor General | Every other monster +2 damage while it lives | Focus it first |
| 6+ threes | 🎯 Deep Range | Ignores taunts and armor | Heal or shield its target |
| 35+ points | ⚡ Takeover | Acts twice once below half HP | Burst it from high HP to dead |
| 60%+ FG on 15+ shots | ♨️ Hot Hand | +2 damage per round it isn't hit (max +6); any hit resets | Keep touching it |

Turnovers work separately, as Fumbles the party spends (see Monster behaviors).

**Minions.** Each opposing team adds 1 goblin per 40 team points scored (roughly 3 per game), with fixed stats. Opposing team FG% sets minion accuracy tier. *(Tuned by simulation: 1 per 25 originally, then 50, then 35; then 50 once every Champion appeared every week and traits arrived; now 40 for a fuller field, with Second Chance at 15% HP and Swat at 4+ blocks. Bots win about 65% in both encounters; they ignore traits and Fumbles, so players should do better.)*

### Wave structure (blended horde)

1. **Wave 1 — Skirmish:** the Shaman behind a goblin pack (30% of the goblins). Break the pack to expose the Shaman before its War Drum in round 2, or take a drum-boosted hit.
2. **Wave 2 — Champions arrive:** the weaker Champions plus 35% of the goblins.
3. **Wave 3 — The Warlord:** the strongest remaining Champions, the Warlord and the last 35% of the goblins.

**Waves arrive on a clock.** Wave 2 arrives at the start of round 2 and wave 3 at round 4, or at the start of the next round if the party clears the field first. Waves can overlap, which forces triage. A wave fights the round it arrives; the party always gets exactly one turn on it before it strikes.

**The boss** is the single best opposing performance across your chosen games (highest points + rebounds + assists) by a player who isn't already mirroring one of your heroes, so the boss never replaces a role and every named monster is a different player. Encounters bring their own boss kit (the Goblin Chieftain, the Lich); without one, the classic Warlord is a boosted version of that player's Champion with double HP and one extra action per round. This is the cost of hindsight: pick a hero's best game against a team whose star also went off, and you might be building your own final boss.

**The Warlord enrages** below half HP: +5 damage for the rest of the battle.

**Energy carries across waves.** There is no refill between waves beyond what basic attacks earn, so spending in wave 1 is a real decision.

## Encounters

**Each battle is an encounter: a themed horde that re-skins the monster roles and brings its own boss and twist.** The roles stay mechanical building blocks (Brute, Caster, Sniper, Stalker, Support, each mirroring a hero class), so new encounters are mostly configuration in `src/rules/encounters.json`. How a week's encounter is chosen (rotation, random, scaling through the season) is still open; for now the Goblin Horde is the default, and a "Testing:" selector on the pick-games screen switches the week's encounter.

### Goblin Horde

| Role (mirrors) | Mechanics | Goblin Horde |
| --- | --- | --- |
| Minion | Goblin | Goblin |
| Support (Cleric) | Shaman | Goblin Shaman |
| Sniper (Ranger) | Hunter | Goblin Sharpshooter |
| Brute (Warrior) | Ogre | Ogre (hired muscle) |
| Caster (Wizard) | Warlock | Goblin Hexer |
| Stalker (Rogue) | Assassin | Goblin Cutthroat |
| Boss | Chieftain | Goblin Chieftain |

**Twist:** Pack Tactics (+1 damage per other goblin *minion*) and Guarded by the Pack (the Shaman can't be targeted while 2+ goblin minions live).

**Role tweaks** (small, so the roles feel different from the Crypt's without changing their jobs):
- **Ogre · Goblin Toss** (replaces Ground Slam): hurls one of its goblins over your front line at the lowest-HP hero for 1.5× damage. Taunts can't stop a throw, and the goblin is spent. With no goblins left it uses Ground Slam instead, so clearing minions trades a targeted, untauntable hit for a spread-out one; the Ogre never goes quiet.
- **Sharpshooter · Dirty Arrows:** its hits also poison (2 damage after the horde acts, for 2 rounds).

**Goblin Chieftain (boss kit).** The week's best opposing performance leads the horde; its best tier as any Champion type sets its strength (HP 36–72, damage 10–19), and if that player was already mirrored they become the Chieftain instead. Two actions a round and the boss enrage (+5 below half HP).
- **Passive · Chieftain's Command:** every goblin (minions and the goblin Champions, not the Ogre) deals +1 damage while the Chieftain lives.
- **Special · Call the Pack** (every other round on the field, telegraphed): two fresh goblins join and fight from the next round.

### The Crypt

A necromancer's tomb where the dead won't stay down.

| Role (mirrors) | Mechanics | The Crypt |
| --- | --- | --- |
| Minion | Goblin | Skeleton |
| Support (Cleric) | Shaman (Raise Dead, Unholy Vigor) | Wight |
| Sniper (Ranger) | Hunter | Skeletal Archer |
| Brute (Warrior) | Ogre | Bone Giant |
| Caster (Wizard) | Warlock | Necromancer |
| Stalker (Rogue) | Wraith (own behavior) | Wraith |
| Boss | Lich + Phylactery | Lich |

**Twist · Restless Dead:** a skeleton that falls becomes a bone pile and reassembles at the start of the next round with half its HP: 8 → 4 → 2, and at 2 HP the next hit ends it. **Fire (Fireball, Meteor) and holy damage (every Cleric attack) destroy skeletons for good**, even Raise Dead can't bring them back. A bone pile keeps its wave open and blocks victory.

**Wraith.** Starts intangible: it can't be targeted except by spells (every Wizard attack but the staff) and Cleric attacks, and the first such hit makes it solid. Every turn it drains life from every hero (2–4 by tier, ignoring armor) and heals for half of what it drained. Special · **Fade** (every other round, telegraphed): it becomes intangible again. The puzzle is whether to spend a spell making it hittable or keep soaking the drain.

**Bone Giant · Bone Harvest:** heals 2 whenever a skeleton crumbles from weapon hits; fire and holy kills give it nothing.

**Skeletal Archer · Restless:** it's a skeleton too. A weapon kill leaves a bone pile and it reassembles once at half HP; fire and holy end it for good.

**Fewer, tougher dead:** the Crypt raises 1 skeleton per 45 opposing points (the Goblin Horde uses 40), since each skeleton takes three weapon kills.

**Wight.** Passive · **Unholy Vigor:** every skeleton deals +1 damage while it lives. Special · **Raise Dead** (replaces War Drum): every skeleton that crumbled from weapon hits rises again at 2 HP. Fire and holy kills stay down. Kill it early.

**Lich (boss kit).** Two actions a round and the boss enrage, like the Chieftain, but a frail caster (HP 14–29, damage 6–11). Special · **Death Bolt:** 1.5× damage to the lowest-HP hero, ignoring armor. Passive · **Phylactery:** a ⚱️ Phylactery (6–10 HP, never acts) arrives beside it. While it stands the Lich takes half damage, and it can't be targeted while any skeleton stands (attacks that hit every enemy still land). When the Lich falls the Phylactery shatters, so it's a shortcut, not a requirement.

**Balance (bot simulator, 1,000 battles):** target 60–65% bot wins (the bot ignores traits, Fumbles and the fire/holy puzzle, so players should land higher). Crypt 61%, 7.2 rounds; Goblin Horde 65%, 7.6 rounds.

### The Dragon's Lair

A red dragon's mountain lair, guarded by kobold zealots and drakes. Its puzzle is tempo: every round you wait makes the boss stronger.

| Role (mirrors) | Mechanics | The Dragon's Lair |
| --- | --- | --- |
| Minion | Goblin (6 HP, 1 per 35 points) | Kobold |
| Brute (Warrior) | Ogre + Molten Hide | Magma Drake |
| Caster (Wizard) | Warlock (Choking Smoke = Hex) | Kobold Firecaller |
| Sniper (Ranger) | Hunter with Net Shot | Kobold Trapper |
| Stalker (Rogue) | Assassin + Shiny Thief | Wyrmling |
| Support (Cleric) | Shaman with Tithe Blessing | Scale Priest |
| Boss | Dragon (sleeps from round 1) | Dragon |

**Twist · Hoard Tithe:** while the Dragon sleeps, each kobold still standing at the end of a round adds a coin to its hoard; every 3 coins give the Dragon +1 damage (up to +5). Waking the Dragon seals the hoard. The counter sits beside the encounter name ("💰 7 · Dragon +2").

**Twist · Dragonscale:** dragonkin (Drake, Wyrmling, Dragon) take half damage from fire. Fireball is for kobolds; Lightning is for dragons. The inverse of the Crypt.

**The sleeping Dragon.** It lies on the field from round 1, asleep (dimmed, 💤), and doesn't act or hold waves back. Attacks that hit every enemy pass it by, so waking it is always deliberate. A hit while it sleeps deals double damage (an ambush), and it wakes at the end of that round, sealing the hoard, groggy: one action a round until the final wave arrives. Otherwise the final wave wakes it at full strength. The choice: ambush early for a weaker, groggy Dragon you fight all battle, or let it sleep and face it last with a fat hoard.

**Role tweaks:**
- **Magma Drake · Molten Hide:** heroes who hit it with a weapon take 2 burn damage (spells don't). Ground Slam is reskinned Tail Sweep.
- **Kobold Trapper · Net Shot** (replaces Volley): hits the lowest-armor hero, who can't use an attack next round (utilities still work).
- **Wyrmling · Shiny Thief:** while the Dragon sleeps, each energy-draining hit adds a coin to the hoard.
- **Scale Priest · Tithe Blessing** (replaces War Drum): +3 coins; no special once the hoard is sealed.
- **Dragon:** Fire Breath (every hero takes its full damage, armor applies), Hoard, Dragonscale, Asleep. HP 62–124, damage 8–13.

**Balance (bot simulator, 1,000 battles):** letting it sleep 60% bot wins (7.1 rounds); opening with a full ambush (`--ambush`) 55% (6.2 rounds). Neither choice dominates. The groggy rule matters: without it, an ambush that didn't kill the Dragon outright was a near-certain loss.

### The Giant's Hall

A frost giant lord's mead hall. Few foes, each a mountain. A different shape: one or two giants per wave plus a few wolves, so the puzzle is concentrating damage, not spreading it.

| Role (mirrors) | Mechanics | The Giant's Hall |
| --- | --- | --- |
| Minion | Goblin (20 HP, 4–5 damage, hunts the most injured hero; 1 per 90 points) | Ice Wolf |
| Brute (Warrior) | Ogre with Boulder Toss | Stone Giant |
| Caster (Wizard) | Warlock (Blizzard = Hex) | Rime Witch |
| Sniper (Ranger) | Hunter with Spear Throw | Giant Huntsman |
| Stalker (Rogue) | Assassin + Regenerate | Frost Troll |
| Support (Cleric) | Shaman (War Chant = War Drum) + Rallying Saga | Skald |
| Boss | Giant Lord (Unshakable, Avalanche) | Giant Lord |

Role Champions get ×1.15 HP and damage here. Ice Wolves are the real minion threat: tough enough to survive a round, they hit for 4–5 and go for the most injured hero (taunts still work).

**Twist · Topple:** deal 50% of a giant's max HP in one round and it's toppled: it loses its next action, and a special about to fire is cancelled. The landing shakes the hall: every hero takes 2 damage, so a topple has a small cost. Each card shows a topple bar ("⛰️ 11/23") that fills live during your turn and empties at the start of each round. Wolves can't be toppled.

**Role tweaks:**
- **Stone Giant · Boulder Toss** (replaces Ground Slam): 1.25× damage to the lowest-HP hero other than the Warrior, knocked prone; taunts can't stop it.
- **Giant Huntsman · Spear Throw** (replaces Volley): one spear, 1.5× damage, at the lowest-armor hero.
- **Frost Troll · Regenerate:** heals 4 at round end unless it was toppled or took fire that round.
- **Skald · Rallying Saga:** while it lives, every giant needs 5 more damage to topple. Kill it first.
- **Giant Lord · Unshakable:** needs 60% of its max HP to topple, but a toppled Lord loses both actions. **Avalanche:** every hero takes its damage −3 and loses 2 energy. HP 48–96, damage 10–16.

**Balance (bot simulator, 1,000 battles):** 61% bot wins, 7.4 rounds, 1.3 topples and 1.5 wolf attacks per battle (first tuning at 35% gave 3 per battle and felt routine). The bot focuses the giant closest to toppling.

Encounters without their own boss fall back to the classic Warlord: a boosted copy of the top performer's Champion (double HP, +2 damage).

## Monster behaviors

Monsters follow fixed behaviors; the opposing player's tier scales their HP and damage. Each Champion counters a different hero, so the horde's makeup changes which of your heroes is under pressure.

| Monster | Behavior | Special (every 2nd round on the field) | Pressures | HP by tier (Cold → Elite) | Damage by tier |
| --- | --- | --- | --- | --- | --- |
| Goblin (minion) | Taunter → Warrior → lowest HP. Passive **Pack Tactics:** +1 damage per other goblin on the field | — | AoE fodder; dangerous in numbers | 8 (fixed) | 2–4 by team FG%, + Pack Tactics |
| Ogre | Hits the taunter, else the Warrior | **Ground Slam:** every hero takes damage −2; its target is knocked prone | Whole party, through taunts | 30 → 60 | 12 → 22 |
| Warlock | Lowest-HP of Wizard and Cleric | **Hex:** party curse (−2 damage, 2 turns) + 3 to every hero, ignoring armor | Whole party | 18 → 36 | 10 → 19 |
| Hunter | Ignores taunts; lowest-armor hero | **Volley:** hits the two lowest-armor heroes | Back line | 20 → 40 | 10 → 19 |
| Assassin | Lowest-HP hero; each hit drains 2 energy | **Execute:** double damage to a hero below half HP | Injured heroes | 16 → 32 | 12 → 22 |
| Shaman | Arrives with wave 1. **Guarded by the Pack:** can't be targeted while 2+ goblins live (hits on every enemy still land). Heals the most injured monster and shields the horde | **War Drum:** drums first, then every monster deals +2 damage that round (lines up with wave 2's goblins in round 2) | Your damage dealers | 18 → 36 | 5 → 10 |
| Warlord | Its Champion's behavior and special, double HP, two actions | — | The whole party | 2 × Champion | Champion + 2; +5 when enraged |

Specials are telegraphed: the Champion's card shows a dashed amber ⏳ "Slam next round" tag the round before, then glows red with a filled "⚠ NOW · Slam…" banner in the round it will fire, so the two states never look alike. Champion damage is about 2.4× the first draft. Simulation showed the horde rarely threatened the party; the extra goblins later let Champion damage come back down a little.

**Opponent turnovers → Fumbles.** Every 3 turnovers by a Champion's player (the boss included) gives the party one 💫 Fumble on that Champion. The party spends it whenever it likes, for free (no energy, no hero action), by tapping the 💫 on the Champion's card: the Champion loses its next action, and a special due then doesn't fire. One can be pending per Champion at a time, and unspent Fumbles are lost when it dies. The card shows the count and the turnovers behind it ("💫 2 · 7 TOV"), and the pick-games screen shows the Fumbles each game would bring, so a sloppy opponent is a reason to pick a game. This mirrors the hero turnover penalty, but as a tool the player controls.

**Targeting default.** Unless its behavior says otherwise, a monster attacks a hero who taunted it, then the Warrior, then the hero with the lowest HP.

**Reading the enemy turn.** Every enemy card shows what it will do if the round ends now ("→ Wizard 16"), and summoned Wolves and Bears show their target too. A hero who would fall gets a pulsing ☠; tapping it outlines the enemies that hit them, with each one's damage, and lists the breakdown under the hero.

## Progression

**Progress belongs to heroes, not players.** A hero keeps their upgrades, gear and feats no matter which NBA player powers them this week. Heroes earn whole-number progression points (PP) each battle and spend their own PP in the **🛠️ Armory**, reached from the result screen and from each hero card when assigning players. Over a 25-week season a hero earns roughly 1,200–1,500 PP: enough to max their weapon and buy both gear items plus a feat or two, not everything.

### Earning PP (per hero)

| Source | PP | Who |
| --- | --- | --- |
| Each wave cleared | 10 | Every hero who fought |
| Victory | 30 standing, 15 if fallen at the end | Each hero |
| Each Elite Champion or boss defeated | 10 | Every hero who fought |
| Player's Elite night | 10 | That hero |
| Double-double / triple-double | 10 / 20 | That hero |

A typical win (three waves, one Elite foe) is about 70 PP per hero; a wave-3 loss about 20. Player performance is deliberately a small share. Saves from before whole-number PP round on load.

### Spending

**Weapon upgrades:** +1 weapon damage per level (applies to every weapon-damage attack), costing 100 / 200 / 300. The **Warrior's shield** levels separately: +1 armor every round per level, 150 / 300.

**Gear** (one-time):

| Class | Gear |
| --- | --- |
| Warrior | Plate Armor (200): +1 armor every round · War Banner (150): +2 starting energy |
| Cleric | Amulet of Healing (200): heals restore +2 · Chain Mail (150): +1 armor every round |
| Ranger | Leather Armor (150): +1 armor every round · Quiver of Plenty (200): Double Strike costs 1 less |
| Rogue | Shadow Cloak (200): the first enemy hit each battle misses · Poisoner's Kit (150): poison lasts 1 more round |
| Wizard | Spellbook (150): +3 starting energy · Focus Crystal (250): spells deal +1 damage |

**Feats** (300 each):

| Class | Feats |
| --- | --- |
| Warrior | Cleave: the Axe also hits a second enemy for half · Intercept: once per round, take an attack meant for an ally below 25% HP |
| Cleric | Blessed Ward: heals also grant +2 armor that round · Smite: Cleric attacks +3 vs undead (the Crypt) and dragonkin |
| Ranger | Hunter's Mark (new utility, 3): the marked enemy takes +2 from every hit this round · Quick Draw: the Longbow gains 3 energy |
| Rogue | Opportunist: +3 vs toppled, taunted or cursed enemies · Vanish (new utility, 2, once per battle): untargetable for a round |
| Wizard | Arcane Surge: the first spell each round costs 1 less · Evocation: multi-target spells +1 to each |

All values live in `src/rules/progression.json`. Purchases are permanent (no respec yet). The original plan's talent branches and stat affinities are parked; affinities may return later as a way to widen which players fit a class.

### Smart pick (game selection)

The pick-games screen offers **🧠 Smart pick** next to "Most energy for each". It scores a whole lineup in starting-energy points: each hero's energy, +8 for a double-double (Signature) or +16 for a triple-double (Legendary), minus the horde those games build: 3 per tier of each mirrored Champion, 5 per tier of the boss, 6 per trait, plus 4 per Fumble handed to the party. It starts from the most-energy picks and improves one hero at a time, rebuilding the real horde each time so the boss and mirror rules are respected. Weights live in `src/app/smartPick.ts`.

**Encounter-aware.** `npm run data:fit-picks` plays 3,000 random-lineup battles per encounter and fits a logistic regression of win/loss on each class's energy, unlocks, each Champion role's tier, the boss tier, traits and Fumbles, then converts the coefficients into energy points (`src/rules/pickWeights.json`). Smart pick uses the fitted per-class energy values in full and blends the danger and bonus weights half-way toward the defaults (the fit's random lineups overstate threats). What it learned, roughly: Wizard and Ranger energy are worth 1.2–2× a Warrior's or Rogue's for the bot everywhere, and the Cleric's matters most in the Lair and the Hall; the Ogre-type Brute and the Hunter-type Sniper are the Champions to avoid in every encounter, the Crypt adds the Necromancer and the Wraith, and the boss's tier is worth the most of all. These reflect the bot's play style as much as the encounters, so refit after big rules changes.

Season simulator result: encounter-aware smart pick reaches 58% bot season wins (Goblin Horde 67%, Crypt 61%, Lair 54%, Hall 51%), against 55% for the generic weights and 45% for most energy. Picking by the generic smart pick instead of most energy raises bot season wins from 45% to 55%, better in every chapter, and changes about 21% of hero picks (in 70% of weeks). Switching factors off one at a time: the mirrored Champion's tier matters most (55% → 50% without it); double/triple-double value and traits are worth about 2 points each; the boss tier and Fumbles barely register for the bot (it spends Fumbles naively). Doubling the weights didn't help. Game choice is a real skill, and Champion strength is the biggest lever after energy.

### Chapters: the horde keeps pace

The season runs in chapters of 4 weeks (roster moves happen between chapters). Each chapter after the first gives Champions and bosses +3% HP and damage (minions unchanged). The pick-games screen shows the current chapter's bonus.

**Tuned with the season simulator** (`npm run data:season`), which plays whole seasons through the real game flow (auto-draft, weekly assignments and game picks, auto-played battles, rewards, greedy Armory spending) next to a baseline that never spends. It showed the real season already gets harder on its own: with no chapter bonus at all, a team that never upgrades falls from 53% bot wins in chapter 1 to about 25% late, while a spending team stays flat around 55%. The first proposal, +10% per chapter, collapsed even spending teams to near 0% by chapter 4. At +3%, bots that spend win 56% → 28–56% across chapters (lowest in chapter 4) and bots that don't fall to near 0%, so upgrades clearly matter. The bot spends greedily and never uses Hunter's Mark or Vanish, so a human should land higher.

## Multiplayer direction (future)

Single player comes first, but these choices keep the door open:

- **Draft exclusivity.** In a league, each NBA player can power only one hero. Normalized tiers make a draft fair across classes.
- **Hindsight limits.** Game selection may need rules in multiplayer: Called Shot mandatory, or a cap on swaps.
- **Shared horde.** League members could face the same Warlord each week, with a leaderboard on rounds survived or damage dealt.
- **Head-to-head.** Your heroes' chosen games could become the horde your opponent fights, and vice versa.

## Simulation bots

Balance is measured with two bots (`npm run data:simulate -- [--smart]`, `npm run data:season -- [--smart-bot]`):

- **Heuristic bot** (`src/engine/autoplay.ts`): fixed priorities per class. Fast (about 70 battles a second), used for big sweeps and fitting. It plays like a casual player: it spends Fumbles on the first Champion it can, never uses feat abilities, and ignores fire/holy and most encounter puzzles.
- **Smart bot** (`src/engine/smartBot.ts`): a one-step lookahead. At each step it tries every sensible move for every hero (narrowed to a few targets each), plus spending each Fumble, plus each next-attack buff paired with the attack that uses it (Ready Crit → Backstab, Empower → an ally's attack). It previews how the round would end with the real enemy turn, rates the result (heroes alive and their HP, energy, enemy HP left, enemy damage per round, bone piles, hoard coins, partial topple progress), takes the best move, and ends the round when nothing beats ending it now. About 0.75 seconds a battle. It plays like a strong human: it cancels specials with Fumbles, focuses giants to topple them, and chooses for itself whether to ambush the Dragon (about 40% of Lair battles).

| Encounter (200 battles) | Heuristic bot | Smart bot |
| --- | --- | --- |
| Goblin Horde | 61% | 85% |
| Crypt | 61% | 91% |
| Dragon's Lair | 56% | 96% |
| Giant's Hall | 59% | 67% |

Over full seasons (16 runs, upgrades bought greedily), the smart bot wins 78% with most-energy picks, 81% with Smart pick and 83% with encounter-aware Smart pick, against 50% when it never upgrades. Upgrades are worth about 28 points of season win rate to a strong player. By chapter it stays between 69% and 95%, so the +3% chapter scaling barely bites a skilled team. By encounter (encounter-aware picks): Goblin Horde 86%, Crypt 91%, Lair 92%, Hall 62%.

The 60–65% balance targets were set against the heuristic bot, on the assumption that players do better. The smart bot shows how much better a strong player can do, and the gap is uneven: the Lair and the Crypt reward smart play far more than the Giant's Hall does.

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
| Goblins per wave | 30% / 35% / 35%, weakest goblins first. Wave 1's pack guards the Shaman; later packs fight alongside the Champions |
| Champions per wave | Wave 2 gets the weaker half (rounded up), wave 3 the rest plus the Warlord |
| Warlord not a mirror | If the best opposing performance isn't one of the five mirrors, it still becomes the Warlord, using the Champion type it rates highest in |
| Champion tiers | Warlock: PTS (Ranger thresholds). Hunter: PTS, ±1 tier for FG% ≥ 55% / < 40% (10+ FGA). Ogre: Warrior Rating. Assassin: 3 × STL (Rogue thresholds). Shaman: AST (Cleric thresholds) |
| Champion HP / damage | Linear steps from Cold to Elite across the doc's ranges (`monsters.json`) |
| Special timing | Each Champion's own clock: its 2nd round on the field, then every 2 rounds, so the ⏳ warning always shows a round ahead. A Warlord uses its special on its first action of those rounds |
| Warlock | Taunt still applies; otherwise targets the lower-HP of Wizard and Cleric. Special: Hex |
| Ogre | Special: Ground Slam; the knocked-down hero loses its next turn |
| Hunter | Only monster that ignores taunt; lowest armor, ties to lowest HP |
| Shaman | Heals the most injured monster (4–8 by tier) and gives the horde +2 armor through the next round; attacks only when nothing is injured |
| Stagger | Spent on the Champion's first actions after it arrives |
| Summons | Act after the party phase and bite the lowest-HP enemy. The Bear taunts the hardest-hitting untaunted enemy. Summons are valid targets for "lowest HP" targeting |
| Longsword | Can only target an enemy that attacked the Ranger last round |
| Double Strike | Two Longbow attacks on one or two chosen enemies; a hit whose target has already fallen goes to the weakest enemy left |
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
- [ ] Playtest horde difficulty: tuned to ~73% bot wins, ~7.3 rounds, ~1.9 heroes fallen per battle (the bot is a weak player; target ~85–90% for a thoughtful human)
- [ ] Decide how encounters are deployed week to week (rotation, random, scaling through the season)
- [ ] Explore class-specific energy gain in combat, e.g. Warrior +1 when hit, Cleric +1 per heal cast, Rogue +2 on a kill

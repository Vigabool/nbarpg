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

1. Start in the current season's latest finished week (or, in sandbox mode, any week of an older season).
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

### Gold

**Gold is the party's currency, earned every battle and spent on the roster.** Progression points belong to a hero and grow that hero. Gold belongs to the team and grows the roster. Salaries and the cap are already priced in gold, so cap room is a straight purchase. Gold doesn't buy Armory gear: PP keep meaning "this hero earned it".

- **Starting purse:** 20 gold, enough to open the season with a little cap room or to keep for rentals. Saves from before gold get it too.
- **Earning:** 6 for a victory, 2 for a defeat, plus 1 per wave cleared. Losses still pay, to blunt the rich-get-richer snowball. That's roughly 150–200 gold over a season.
- **Ten-day contracts:** for heroes whose player has no game, or is a weak fill-in that week.
  - **What it is:** sign any eligible free agent who has a game this week, for this week only. It uses no cap space and no roster move.
  - **Fee:** half their salary (at least 3 gold), so an Elite costs about 20–25 gold and a Good player about 9.
  - **Limits:** up to 2 a week, signed from Assign heroes, either from a hero card or by browsing free agents. Releasing a contract before the battle refunds the fee. Contracts end when the week does.
- **Raise the cap:** +5 cap for 5 gold, permanent. Auto-draft drafts to the raised cap. The cap only matters when signing, so this pays off in the roster moves between chapters: a second star, or a versatile reserve who covers several heroes.

**Balance (season simulator, encounter-aware smart pick):**
- **Rental policy:** rent for a hero with no game, or a fill-in below Good in that class, when a free agent at least two tiers better is affordable.
- **Result:** win rate 45% → 57%. Weak spots per week fall from 0.51 to 0.17, using about 8.5 contracts a season.
- **Before the fee went up:** at a quarter of salary, rentals were nearly free and took the win rate to 63%.
- **What the simulator skips:** it makes no roster moves, so it can't weigh rentals against cap room. A real player splits the gold.

**Later (phase 2):** extra roster spots (a 9th and 10th), extra roster moves mid-chapter, and consumables from a Quartermaster.

### Later: aprons and cap mechanics

The NBA's cap rules give natural hooks for later design:

- **Soft cap:** exceed the cap, but the horde's Threat rises.
- **First apron:** a larger overage costs PP each week.
- **Second apron:** the heaviest overage blocks roster moves for a chapter.
- **Salary updates:** in live mode, game salaries reprice monthly as players heat up or cool off (see Live season).

## Live season

**The current season is the default game mode: real games from the week just played power that week's battle.** Replaying an older season stays possible as a sandbox, and 2025–26 stays the fixed data set for tests, calibration and the golden baseline, because a live season changes every week.

### Form: the last 15 regular-season games

Salary, season tier, gear, ten-day fees and auto-draft all read a player's per-game averages (`src/data/form.ts`). A whole-season average looks ahead (in a replay, week 3 would know March), and in a live season it is empty for weeks. Instead, each week's averages (a player's **form**) come from the player's **15 most recent regular-season games before that week**. Early in the season the window reaches back into the prior regular season (and the one before, for a player who missed most of it): a player with 4 games this year uses those 4 plus their last 11 of last season. Once they have 15 games this season, form is their season-to-date average.

**Why 15 (measured on 2025–26):**

| Class rating | Reliability of a 5 / 10 / 15 / 20-game average | Games to reach 0.8 |
| --- | --- | --- |
| Ranger (PTS) | 0.85 / 0.92 / 0.94 / 0.96 | 4 |
| Cleric (AST) | 0.84 / 0.92 / 0.94 / 0.96 | 4 |
| Warrior (DREB + 2×OREB + 3×BLK) | 0.81 / 0.89 / 0.93 / 0.94 | 5 |
| Wizard (3PM) | 0.69 / 0.81 / 0.87 / 0.90 | 9 |
| Rogue (3×STL + FTM) | 0.64 / 0.78 / 0.84 / 0.88 | 11 |

Reliability is the odd/even split-half correlation, stepped up with Spearman-Brown (303 players with 40+ games at 15+ minutes). Rogue and Wizard are the slow stats, because steals and threes are rare events. Predicting the salary tier of a player's *next 12 games* (about a chapter) from a window of past games: 52% exact with 5 games, 57% with 10, 59% with 15, 61% with 20, and no better after that (60% with the whole season so far); within one tier 98% from 10 games on. The ceiling is the noise in the next 12 games themselves, so 15 games captures nearly all the signal while staying current. Not yet measured: how well last season's games predict this season (trades, new roles, aging). That needs a 2024–25 log to test against 2025–26.

### Salaries lock for each chapter

Form updates weekly, but **salary is set at each chapter boundary** (when roster moves happen; in code, `formView` as of `chapterStartWeek`) and holds for the chapter, so a roster that was legal at the draft stays legal. Repricing never forces a release: the cap only applies when signing. A player who breaks out is a bargain until the next chapter, and that is part of the fun. Gear and season tier follow the same lock, so a hero's character sheet doesn't shift mid-chapter.

### Rookies and players with little data

**For now, a player needs 15 games across this season and the two before it to be signed.** The window reaches back a second season only for a player who missed most of the last one (Kyrie Irving, Damian Lillard and Dejounte Murray were among 63 players short on last season alone). Rookies, and anyone else short of a full window (a player arriving from overseas, or out for two seasons), stay off the market until they reach 15. Since rosters open between chapters, a rookie who earns minutes becomes signable a chapter or so in. In code: `salary.eligibility.formGames` (15) replaces the 10-game rule in a live season, and the 15+ minutes rule is measured over the window. Only a live season rates on form; finished seasons keep whole-season averages, so the simulators and golden baseline on 2025–26 hold still.

**Parked: pricing rookies by draft slot.** If excluding them feels wrong in live testing: price by draft slot (a hand-kept file per draft class, calibrated from the 2025 class's first 15 games), with a "Limited data" warning on anyone short of a full window.

### Weekly calendar

A week becomes playable once its Sunday is over: the fetcher records `throughDate` (the last day whose games are all final) and the build leaves out any week ending after it. The title screen offers the live season by default, starting in the latest finished week, with older seasons as replays (a saved run reopens in its own season). When a run catches up, the result screen says the next week unlocks once it's been played. A short first week (the season opens midweek) is still week 1. Ten-day contracts and roster moves work as in sandbox mode; expanding them (dropping a player any time, more signings) is for live testing.

### Data refresh

stats.nba.com blocks most cloud servers, so the live season comes from the NBA's public CDN instead: the season schedule (`scheduleLeagueV2.json`) and each final game's box score. `scripts/fetch-cdn.ts` writes the same raw format as the LeagueGameLog script (regular-season games only; the NBA Cup final doesn't count), downloads only games it doesn't have plus the last week's again (stat corrections), and fails loudly if the feed changes shape. The **Refresh season data** workflow (`.github/workflows/refresh-data.yml`) runs it Monday mornings and commits `data/raw/<season>.json`; `npm run data:build` then builds every season in `data/raw/`, giving each one its previous season for the form window, and writes `public/data/seasons.json` for the app. If the CDN ever blocks GitHub's servers, the fallback is running `scripts/fetch_gamelogs.py` locally each Monday.

### Recalibration

Tier thresholds stay at the 2025–26 values through the start of the season, since changing them changes every battle. After 6–8 weeks of 2026–27 games, run `npm run data:calibrate`, record the result as `docs/calibration-2026-27.md`, and adopt it at a chapter boundary only if it moves the tier mix noticeably.

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
| Flurry | 4 | G − 1 damage to up to 3 enemies (a weapon attack: weapon levels add to every hit) |
| Ready Crit | 4 | Next attack (gear or ability) deals double damage |
| Signature (DD): Shadowstep | Free, once | Untargetable for 1 round; next attack is a guaranteed crit |
| Legendary (TD): Assassinate | Free, once | Instantly defeat any non-boss enemy |

**Flurry replaced Venom Strike** (playtest feedback). Venom Strike was a bigger Poisoned Blade: the same hit-plus-poison shape on one target, and poison doesn't stack, so the two overwrote each other. Its fixed 4-damage hit also fell behind as gear improved. Flurry weaves through the field with dagger strikes: G − 1 to each of up to 3 enemies, a weapon attack, so weapon levels add to every hit. It gives the Rogue a job against packs that's weaker than Fireball (8 per target): on its own it softens goblins; with Ready Crit (8 per target at Good gear) it clears three. It's weak in the Crypt (weapon kills leave bone piles) and against the Hall's few, big foes.

**Balance (Hard, 200 battles per encounter, smart bot):** 71.9% → 77.6% on average (Goblin Horde 76.5 → 79.5, Crypt 76.5 → 79.5, Lair 58.5 → 68, Hall 76 → 83.5). The heuristic bot barely moves: 44.6% → 46.0% on Hard, 61.1% → 62.4% on Normal. Other settings tried, with the smart bot's average: cost 3 78.1%, cost 5 76.8%, cost 6 76.3%; G − 2 at cost 4 74.5%, at cost 5 73.8%; two targets 73.5%. Over full seasons (`data:season`, 8 runs, smart bot, encounter-aware Smart pick) it's 75% → 78% (Goblin Horde 79 → 79, Crypt 81 → 79, Lair 73 → 79, Hall 65 → 75), and 45% → 44% for the heuristic bot (16 runs, within noise). Flurry is a deliberate buff to a skilled Rogue, mostly in the two encounters that were below target over a season. If single Hall battles feel too easy, cost 5 or G − 2 are the levers.

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

**Each battle is an encounter: a themed horde that re-skins the monster roles and brings its own boss and twist.** The roles stay mechanical building blocks (Brute, Caster, Sniper, Stalker, Support, each mirroring a hero class), so new encounters are mostly configuration in `src/rules/encounters.json`. Rules that need code (twists, specials, behaviors) live as mechanics in `src/engine/encounters/`, one module per encounter, plugged into combat's hooks; see [Adding an encounter](adding-an-encounter.md). For now the player picks any encounter as the first step of each week (**Choose your encounter**). Each card shows the tagline, a challenge rating (`challenge` in the data: Gentler, Standard or Tough, from casual win rates), the boss, the foes, the twists, the player's record there, and a link to that encounter's enemies in How to play. The choice carries over to the next week. A proper season structure (weekly offers, a finale) will replace this.

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

**Balance:** tuned so the smart bot (a strong player) wins about 75% (see Simulation bots). Crypt Champions are ×1.25: smart bot 76.5%, heuristic bot 23%. The Crypt is the most skill-dependent encounter: fire and holy against skeletons and handling the Wraith are the puzzle, and no lever narrowed that gap without making it unwinnable for one bot or trivial for the other.

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

**The sleeping Dragon.** It lies on the field from round 1, asleep (dimmed, 💤), and doesn't act or hold waves back. Attacks that hit every enemy pass it by, so waking it is always deliberate; once a hit has stirred it, area attacks and summons include it for the rest of that round. A hit while it sleeps deals 1.28× damage (an ambush), and it wakes at the end of that round, sealing the hoard. If it survives, it answers at once with **Rude Awakening**: Fire Breath over the whole party at 1.5× damage. After that it's groggy: one action a round until the final wave arrives. Otherwise the final wave wakes it at full strength. The choice: ambush early for a weaker, groggy Dragon you fight all battle, or let it sleep and face it last with a fat hoard.

**Role tweaks:**
- **Magma Drake · Molten Hide:** heroes who hit it with a weapon take 2 burn damage (spells don't). Ground Slam is reskinned Tail Sweep.
- **Kobold Trapper · Net Shot** (replaces Volley): hits the lowest-armor hero, who can't use an attack next round (utilities still work).
- **Wyrmling · Shiny Thief:** while the Dragon sleeps, each energy-draining hit adds a coin to the hoard.
- **Scale Priest · Tithe Blessing** (replaces War Drum): +3 coins; no special once the hoard is sealed.
- **Dragon:** Fire Breath (every hero takes its full damage, armor applies), Hoard, Dragonscale, Asleep. HP 74–149, damage 8–13.

**Balance:** smart bot 78%, heuristic bot 47%, after lowering the ambush to 1.5× and raising Dragon HP 20% (the smart bot had won 96%, mostly through the ambush). The smart bot chooses to ambush in about 40% of battles. The heuristic bot's fixed policies (first tuning): letting it sleep 60% bot wins; opening with a full ambush (`--ambush`) 55%. Neither choice dominates. The groggy rule matters: without it, an ambush that didn't kill the Dragon outright was a near-certain loss.

**Ambush retune (round-1 kills).** A full round-1 combo (Provoke, then Empower + Ready Crit + Backstab, then everyone's biggest hit) killed the Dragon in 72% of lineups at 1.5×, so ambushing was free. Now:
- **Ambush:** 1.28×, and Dragon HP is ×0.86 (now 64/81/96/112/128) so that letting it sleep doesn't get harder.
- **Rude Awakening:** a Dragon that survives an ambush breathes fire at once.
- **Results:** the same combo now kills in 12% of lineups, more with Armory upgrades, Hunter's Mark or Shadowstep, and leaves it at about 5% HP otherwise. Those failed attempts win about 80% (smart bot playing on). Letting it sleep wins 57% (smart bot) and 48% (heuristic bot).
- **Careless pokes are punished:** the heuristic bot's all-in ambush with no setup never wins.
- **The cliff:** at 1.3× the same combo kills 72%, because party damage and Dragon HP both scale with tier. Treat 1.28 as a fine edge.
- **Checking it:** `npm run data:lair-combo -- 100 --full` replays the combo.

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

Role Champions get ×1.08 HP and damage here. Ice Wolves are the real minion threat: tough enough to survive a round, they hit for 4–5 and go for the most injured hero (taunts still work).

**Twist · Topple:** deal 50% of a giant's max HP in one round and it's toppled: it loses its next action, and a special about to fire is cancelled. The landing shakes the hall: every hero takes 2 damage, so a topple has a small cost. Each card shows a topple bar ("⛰️ 11/23") that fills live during your turn and empties at the start of each round. Wolves can't be toppled.

**Role tweaks:**
- **Stone Giant · Boulder Toss** (replaces Ground Slam): 1.25× damage to the lowest-HP hero other than the Warrior, knocked prone; taunts can't stop it.
- **Giant Huntsman · Spear Throw** (replaces Volley): one spear, 1.5× damage, at the lowest-armor hero.
- **Frost Troll · Regenerate:** heals 4 at round end unless it was toppled or took fire that round.
- **Skald · Rallying Saga:** while it lives, every giant needs 5 more damage to topple. Kill it first.
- **Giant Lord · Unshakable:** needs 60% of its max HP to topple, but a toppled Lord loses both actions. **Avalanche:** every hero takes its damage −3 and loses 2 energy. HP 48–96, damage 10–16.

**Balance:** smart bot 74%, heuristic bot 66%; the Hall rewards clever play least of the four. Earlier heuristic-bot tuning: 61% bot wins, 7.4 rounds, 1.3 topples and 1.5 wolf attacks per battle (first tuning at 35% gave 3 per battle and felt routine). The bot focuses the giant closest to toppling.

Encounters without their own boss fall back to the classic Warlord: a boosted copy of the top performer's Champion (double HP, +2 damage).

**Landing warning.** The topple bar turns red when one more hit this turn could topple a giant and its landing would drop someone ("⛰️ 22/25 ☠ · landing drops the Wizard"). Those heroes get a ⛰️☠ tag. "Could topple" means the damage still needed is no more than the biggest attack a hero can still make on it this round.

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

## Difficulty

**Two levels, chosen at New game and changeable between chapters (on the roster-moves screen):**
- **Normal** (the default) is a forgiving horde for learning the game and casual play.
- **Hard** is the full-strength tuning that every encounter was balanced at, where the smart bot wins about 75%.

The run's difficulty shows on the encounter and pick-games screens. Saves from before difficulty existed were played at full strength, so they load as Hard.

**How Normal works:** per encounter, Champions and bosses get an HP and damage multiplier (`src/rules/difficulty.json`). Minions can be scaled too, but currently aren't. It's applied when a battle is prepared, after chapter scaling, and the horde preview shows the same numbers. The multipliers are tuned so the heuristic (casual) bot wins about 60% of single battles:

| Encounter | Normal multiplier | Heuristic bot, Hard → Normal |
| --- | --- | --- |
| Goblin Horde | ×0.93 | ~50% → 63% |
| The Crypt | ×0.85 | 23% → 60% |
| Dragon's Lair | ×0.96 | ~48% → 61% |
| Giant's Hall | none (already ~65% on Hard) | 65% |

Win rates are very sensitive to these multipliers: Goblin Horde goes from 63% at ×0.93 to 82% at ×0.85. Over full seasons with upgrades and the encounter-aware Smart pick, Normal wins 61% against 45% on Hard. The simulators take `--difficulty normal`, and both default to Hard so the golden baseline stays at full strength.

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

**Respec (free).** In each hero's Armory, Respec returns everything they bought (weapon and shield levels, gear, feats) for a full refund (two taps), so trying a build costs nothing but the decision.

### Smart pick (game selection)

The pick-games screen offers **🧠 Smart pick** next to "Most energy for each". It scores a whole lineup in starting-energy points: each hero's energy, +8 for a double-double (Signature) or +16 for a triple-double (Legendary), minus the horde those games build: 3 per tier of each mirrored Champion, 5 per tier of the boss, 6 per trait, plus 4 per Fumble handed to the party. It starts from the most-energy picks and improves one hero at a time, rebuilding the real horde each time so the boss and mirror rules are respected. Weights live in `src/app/smartPick.ts`.

**Encounter-aware.** `npm run data:fit-picks` plays 3,000 random-lineup battles per encounter and fits a logistic regression of win/loss on each class's energy, unlocks, each Champion role's tier, the boss tier, traits and Fumbles, then converts the coefficients into energy points (`src/rules/pickWeights.json`). Smart pick uses the fitted per-class energy values in full and blends the danger and bonus weights half-way toward the defaults (the fit's random lineups overstate threats). What it learned, roughly: Wizard and Ranger energy are worth 1.2–2× a Warrior's or Rogue's for the bot everywhere, and the Cleric's matters most in the Lair and the Hall; the Ogre-type Brute and the Hunter-type Sniper are the Champions to avoid in every encounter, the Crypt adds the Necromancer and the Wraith, and the boss's tier is worth the most of all. These reflect the bot's play style as much as the encounters, so refit after big rules changes.

Season simulator result: encounter-aware smart pick reaches 58% bot season wins (Goblin Horde 67%, Crypt 61%, Lair 54%, Hall 51%), against 55% for the generic weights and 45% for most energy. Picking by the generic smart pick instead of most energy raises bot season wins from 45% to 55%, better in every chapter, and changes about 21% of hero picks (in 70% of weeks). Switching factors off one at a time: the mirrored Champion's tier matters most (55% → 50% without it); double/triple-double value and traits are worth about 2 points each; the boss tier and Fumbles barely register for the bot (it spends Fumbles naively). Doubling the weights didn't help. Game choice is a real skill, and Champion strength is the biggest lever after energy.

### Chapters: the horde keeps pace

The season runs in chapters of 4 weeks (roster moves happen between chapters). Each chapter after the first gives Champions and bosses +3% HP and damage (minions unchanged). The pick-games screen shows the current chapter's bonus.

**Tuned with the season simulator** (`npm run data:season`), which plays whole seasons through the real game flow (auto-draft, weekly assignments and game picks, auto-played battles, rewards, greedy Armory spending) next to a baseline that never spends. It showed the real season already gets harder on its own: with no chapter bonus at all, a team that never upgrades falls from 53% bot wins in chapter 1 to about 25% late, while a spending team stays flat around 55%. The first proposal, +10% per chapter, collapsed even spending teams to near 0% by chapter 4. At +3%, bots that spend win 56% → 28–56% across chapters (lowest in chapter 4) and bots that don't fall to near 0%, so upgrades clearly matter. The bot spends greedily and never uses Hunter's Mark or Vanish, so a human should land higher.

## Battle screen controls

- **No hero is preselected.** The player taps a hero to open their action sheet.
- **After an attack** the sheet closes, so the player sees the result and picks who acts next.
- **Other utilities keep the sheet open on the same hero,** so they can do more. The exception is **Empower** (any buff to an ally's next attack), which opens the buffed ally's sheet, ready to use it.
- **Ending the round or undoing** also leaves no hero selected.
- **↶ Undo** is a labelled button next to End round. It's highlighted when there's something to undo.

## Onboarding

**Show, don't tell.** New players learn in two places, kept apart:
- **How to play** opens on first launch and is meant to be read in order. **Basics** is six short cards (roster, weekly setup, how games build the horde, the fight, big nights, growth). **Sample turn** is a scripted round played by the real engine and drawn with the real battle components, so it always looks like the game. Its nine steps cover a Provoke that pulls the Goblin Hexer off the Wizard; Shield Bash taunting the Ogre; aiming Fireball at three goblins; the big hit (Empower, Ready Crit and Backstab on the taunted Ogre for 60); the horde's turn; and planning around two specials and a ☠ warning. It ends with "Let's play" and offers **Replay the walkthrough**.
- **Guide** is reference: Classes, Enemies (by encounter), Progression and gold, and a **Glossary** of one-line terms (energy, Fumble, special, trait, wave clock…). It opens from the top bar, the battle menu, and the ? and ⓘ buttons in battle.

**The first battle is the tutorial.** The player's real first battle shows coach marks.
- **How a tip looks:** a gold ring around one element, the rest dimmed, and a one- or two-sentence note with **Got it** and **Skip tips**.
- **The screen matches the tip.** While a tip is up, the game waits (taps don't reach it). Each tip says whether it needs the action sheet closed (the horde, party and ☠ tips, so nothing covers them) or open (the actions tip, on a ready hero), and the battle screen arranges itself.
- **One at a time:** after a tip is dismissed, the next waits until the player does something. Only the opening sequence chains: horde → party → actions → pick a target. A tip left over from an earlier battle never opens a later one: once the opening sequence is done, each battle's first tip also waits for the player to act.
- **When a tip shows:** each appears once, the first time its moment comes (`src/ui/coachTips.ts`). The opening sequence: the horde → the party → one attack plus utilities → picking a target. Then, one per player action, in priority order: a falling hero (☠), End round, the battle log (once the horde has acted), a special a round away (⏳), Fumbles (💫), traits, the next wave. In a typical first battle all of them appear within the first few actions. The result screen gets one tip on PP and gold.
- **Setup screens** (encounter, assign heroes, pick games) each show a one-line banner the first time. In week 1, Goblin Horde is marked "Recommended first".
- **Memory:** seen tips are stored per browser, not per save (`src/app/coach.ts`), so a new run doesn't repeat them.
- **Turning it back on:** the pick-games screen has a **🎓 Walkthrough tips in battle** checkbox (ticked while tips remain; ticking restarts them from the first). How to play → Basics also has **Replay the walkthrough**. Tips wait while any pop-up is open, so they never cover How to play or the Guide.

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

**Balance target: the smart bot wins about 75%** of chapter-1 battles in every encounter (it was 85–96% in three of them before retuning). Each encounter is tuned with its own levers so they don't interfere: Champion scale (`statScale`), and for the Lair the ambush multiplier and Dragon HP.

| Encounter | Retune | Smart bot | Heuristic bot |
| --- | --- | --- | --- |
| Goblin Horde | Champions ×1.15 | 76.5% | 48% |
| Crypt | Champions ×1.25 | 76.5% | 23% |
| Dragon's Lair | Ambush 2× → 1.5× → 1.28×, Dragon HP +20% then ×0.86, Rude Awakening | 57% letting it sleep (the bot can't plan the combo; ~80% with it) | 48% |
| Giant's Hall | Champions ×1.15 → ×1.08 | 74% | 66% |

Over full seasons (greedy upgrades, encounter-aware Smart pick, chapter scaling +3%) the smart bot wins 74% (by chapter: 70 · 69 · 86 · 75 · 66 · 81 · 69). +6% per chapter dropped it to 66% with a late-season slide to 44%, and +9% to 50%, so +3% stays. The heuristic bot now wins about 43% of a season with the same picks and 30% with most-energy picks: a casual player will find the game hard, especially the Crypt.

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
- **Live season by default:** the current season, a week at a time (see Live season). Sandbox mode replays any week of an older season; 2025–26 is the first.
- **Rules as data:** classes, abilities, costs, tiers, monsters and PP values live in config files, so tuning is a data edit, not a code change.
- **Accounts:** a single local user for the MVP; storage designed to move to accounts later.
- **Saves:** one run in the browser's storage. Each save records its format version, and older saves are upgraded step by step on load (`src/app/saves.ts`). **Save file** (top bar) downloads or copies the run; **Import a save file** (title screen) loads it back, so a run survives clearing site data or moving devices.
- **Crash safety net:** an error boundary (`src/ui/ErrorScreen.tsx`) catches render errors and errors thrown from buttons. It shows recovery options (try again, restart the week's battle, download the save, start over) and a copyable report with the build label, where in the run it happened, and the stack.
- **Checks:** CI (GitHub Actions) runs the type-check, Prettier, tests, the build and the golden baseline (`npm run check:golden`, which replays fixed battles and seasons and fails if any result changes) on every push.
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
| Calibration | Set tier thresholds from 2025–26 season data; recalibrate after 6–8 weeks of 2026–27 games, adopting at a chapter boundary |
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
| Roster pool | Players averaging 15+ minutes over their form window (sandbox: 10+ games and 15+ minutes per game); rookie rules in Live season |
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

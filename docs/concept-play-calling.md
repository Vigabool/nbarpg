# Concept: Play Calling

Nov 7, 2026 · @Nick

**Status: exploration only.** This is a possible pivot for the battle system, written down so it can be judged and prototyped. Nothing here is built, and nothing in [design-doc.md](design-doc.md) changes because of it. If it goes ahead, it gets prototyped on paper and in a standalone simulator first (see How to test it).

## Why

**The goal is a game that NBA fans who don't play RPGs can pick up, without watering it down for the tactical players who do.** Today's battle is a standard tactics RPG: five heroes, energy pools, one attack each plus any number of utilities. The premise (real box scores power the heroes) is native to basketball, but the battle isn't, and its vocabulary (taunt, energy, specials, traits) is the main barrier for a basketball fan.

**Play Calling makes the battle feel like a basketball game.** The battle is a game with a scoreboard and quarters. The party's turn is offense and the horde's turn is defense. Before the game, the player draws up a playbook of set plays: short chains of hero moves where each hero passes a bonus to the next. During the game, the player calls a play, taps a target and watches it run.

**The depth lives in preparation, so the game itself stays quick.**
- **Tactical players** design their own plays, as deep as they like.
- **NBA fans** tap **Suggest Plays**, get a strong playbook, and still make the satisfying call: the right play at the right moment.

Final Fantasy XII's gambits are the nearest precedent (program behavior, watch it run, step in when needed), and Persona 5's Baton Pass shows how much players enjoy passing a turn along with a bonus. As far as we know, no game builds its whole battle around both, with real box scores dealing the hand.

## Design pillars

**Kept from the current game:**
- **Stats deal the hand, the user plays it.** The box score still sets how strong each hero is this week.
- **Bad nights are tough, not fatal.** Every class keeps a basic move that's always available.
- **Highlight moments.** Double-doubles and triple-doubles unlock signature and legendary finishers.
- **No randomness in combat.** The real games supply the variance.

**New:**
- **Quick, fun, action-packed.** A possession takes about 20 seconds or less. A battle is a fixed length and fits in a few minutes.
- **Read the game, don't solve it.** A good-enough play should be easy to find, and the best play only a little better. The skill is reading the situation (score, clock, what the horde is about to do), not finding the one correct combo.
- **Every action does something cool.** No filler turns: each step sets up a big hit, lands one, or shuts down a dangerous foe.

## The battle is a game

**Decided: a fixed length of four quarters with a scoreboard, replacing "clear every wave".** Each quarter has 3 party possessions, 12 in all, and each party possession is followed by an enemy turn.

**About 6–7 minutes a game.** A party possession (call, target, run) takes about 15–20 seconds, and an enemy turn (animation plus the defensive choice) about 5–10. Twelve pairs plus halftime comes to about 6–7 minutes, which suits a game played once a week. The enemy turn should be short, with a speed setting, so it never feels like waiting.

- **The party scores with shots, takedowns and objectives** (see Scoring: the open look).
- **The horde scores the same way** on the party. Defense means keeping it off the board.
- **A fallen hero sits out a possession or two,** like foul trouble, rather than leaving the battle.
- **Waves become quarters.** The boss checks in later in the game, as a wave does today.
- **Halftime** is the break where plays can change (see Halftime).
- **The result can be read against the real game:** "You beat the real Celtics' 118 by winning 34–29."

**Why a scoreboard.** It's the strongest protection against a single correct chain. The right play depends on the score and the clock:
- Up by 6 with one possession left, run a safe play and defend.
- Down by 3, you need a big finisher.
- A goblin about to score an objective can matter more than the full-strength boss.

NBA fans understand these situations without a tutorial. The format also gives comebacks, close finishes and a tense last possession. Victory points can come from more than one source (see Encounters), so there's more than one way to win.

## Scoring: the open look

**Decided: plays can fail without randomness, because shots can be contested.** Combat has no accuracy, so a finisher that always scored would make points trivial.

- **Every target is either open or contested,** shown on its card. Enemies contest each other (a Brute guarding the Shaman beside it, goblins crowding the boss), and some traits contest on their own (✋ Swat).
- **A finisher on an open target scores.** On a contested target it deals half damage and scores nothing.
- **Setup moves open targets:** Screen, Strip, Gravity, Drive, Read the Defense. Plays revolve around opening an enemy for a finisher, ideally one that also takes it down.
- **It's a read, not a gamble.** Open and contested are visible before a play is called, so a play fails only when it's called into the wrong defense.

**Points come from three sources:**
- **Shots:** a finisher on an open target scores 2. Wizard and Ranger long-range finishers score 3, and an and-one (a finisher that also disables) adds 1.
- **Takedowns:** each enemy shows a point value (to tune: goblin 1, Champion 4, Elite +2, boss 8), scored when it goes down. Takedowns also stop that enemy scoring, so damage still matters.
- **Objectives,** which vary by encounter (see Encounters).

The sources pull against each other: take the open 2 now, or keep working on the Ogre for its 4 and to stop it scoring?

**Disables do two jobs.** A Stripped or Down enemy is open, and it also drops out of the horde's next play, breaking the chain it was part of. One move helps the offense and the defense at once.

**The horde scores the same way:** open hits on heroes, hero takedowns, and progress on its own objective (see Encounters). Its finishers on heroes score unless an off-ball defender contests them. One rule works on both ends of the floor. The simulator's final scores decide whether points are multiplied up to NBA-looking totals.

## Moves, finishers and plays

**Each hero has moves and finishers.**
- **A move has two parts, like a Gloomhaven card:**
  - **The action** does something right away: damage, a disable, a taunt, armor, a heal, or making an enemy vulnerable.
  - **The enabler** is the pass: it buffs the next ally in the play (more damage, a heal, armor, an extra target, ignoring armor, reaching the back line).
- **A finisher** is a big hit with no enabler. It ends the play.

**A play is a short chain of moves ending in a finisher, drawn up before the game.** Each step is one hero, and each enabler goes to the hero who acts next.

**Example: Critical Taunt** (three steps)

| Step | Hero | Action | Enabler (to the next hero) |
| --- | --- | --- | --- |
| 1 | Warrior | **Provoke:** damage, and the target is taunted | **Shield:** +armor to the Cleric |
| 2 | Cleric | **Heal** the Warrior | **Empower:** +damage to the Rogue |
| 3 | Rogue | **Backstab** (finisher): huge damage, boosted by both the taunt and Empower | — |

Five effects in three steps, nothing wasted, and it reads like a real set play.

**Sample moves by class** (a starting point for the paper prototype, not tuned):

| Class | Role in a play | Sample move (action / enabler) | Sample finisher |
| --- | --- | --- | --- |
| Warrior | Starts plays | **Screen:** taunt the target / the next hero ignores its armor | **Slam:** heavy hit that knocks the target down |
| Cleric | Middle (the point guard) | **Lay on Hands:** heal 8 / the next hero's attack +50% | A weak finisher, on purpose |
| Rogue | Middle, shuts down threats | **Strip:** the target loses its special this round / the next hit on it crits | **Backstab:** huge against a taunted or disabled target |
| Wizard | Finishes | **Spacing:** chip damage to every enemy / the next single-target hit also strikes a second enemy | **Fireball:** big area damage |
| Ranger | Finishes, flexible | **Mark:** the target takes +3 per hit / the next hero can reach back-line enemies | **Aimed Shot:** large hit that ignores armor |

A class's place in a play is its identity. The Cleric is the point guard because that's where it's strongest, not because it's labelled one.

**A hero can appear twice in a play, but never on back-to-back steps** (the enabler always goes to the next ally, so a hero can't pass to themselves). A star-heavy play alternates: Star → Cleric → Star (finisher). This makes building around a star a real roster choice. Three things keep it from becoming the one dominant strategy: it spends the star's touches faster (see What the box score does), a star who's always on the ball never defends, and the star's mirror Champion is already a scaled threat.

**Play length is a choice made while designing.** A short play (two steps) leaves more heroes off the ball to defend. A long play (four steps) builds a bigger finisher but leaves the party exposed. The risk and reward are set in the playbook, so nobody has to calculate them mid-game.

**Targeting takes one or two taps.** Each play has one primary target, chosen when it's called. Every other step targets relative to that: the primary target, the most injured ally, the next hero.

## The playbook

**Before each game, the player prepares a playbook of four plays.** Gold buys a fifth and a sixth slot over the season (the playbook belongs to the team, and gold is the team's currency), with six as the cap, pending testing. A larger playbook stays readable on a phone, and the cap stops a late-season playbook from covering every situation. Plays are built from hero classes, not NBA players, so they carry over when a different player powers a hero next week.

**Drawing up plays is scouting.** The playbook comes after picking games, so the horde is already known: who's Elite, which traits are coming, which specials they'll telegraph. Designing plays is game-planning against this week's opponent ("their Ogre has Second Chance, so I need a second big finisher").

- **Suggest Plays** builds a strong playbook from this week's lineup and horde. It explains each play in one line.
- **When to call it:** each play carries a situation tag, such as *vs a big*, *vs a swarm*, *stop a special*, *need a bucket* or *protect the lead*. Players choose by situation rather than by math.
- **Form this week:** each play shows how strong it is with this week's box scores ("Critical Taunt 🔥: your Rogue's player had 4 steals", "❄️ cold Cleric").
- **The designer checks the passes.** It shows whether each enabler helps the next step ("Empower → Backstab ✓") or is wasted.
- **Shareable playbooks:** a code friends can trade.

## During the game

**A possession is: see the horde's call, call your play, tap a target, watch it run.**

1. **The horde calls its play.** Today's telegraphs become the opponent's call: "Ogre: Ground Slam incoming." The read is basketball: they're running X, so I call Y.
2. **Call a play.** A play that fits the moment can glow softly (the bot can judge this). The player always decides.
3. **Tap the primary target.** The play runs, with each pass and the finisher shown clearly and the points floating up onto the scoreboard.
4. **Defense.** Heroes who didn't touch the ball defend during the horde's turn: **guard** (halve one enemy's hit on them) or **help** (armor for an ally). One quick choice keeps the defensive half interactive.

**Timeouts replace free undo.** Today's ↶ Undo invites trial and error until a round is solved by hand. Instead, a single step can be previewed before committing, and each game has a couple of timeouts that take back a possession.

**The defense scouts repeated plays.** Calling the same play back to back makes it weaker (for example, its enablers lose their bonuses), and halftime clears this. Variety pays off without being forced.

**Optional shot clock.** A visible 24-second clock per possession could be the most action-packed touch in the game, but it's stressful and an accessibility problem. If it exists, it's an option or a small bonus ("quick possession: +1"), never a penalty.

## Halftime

Halftime is where the game gives the player information:
- **A first-half recap,** such as "the Hunter has scored 12 on your Wizard; your Pick and Roll went 3 for 3."
- **Adjustments:** swap one or two plays. Suggest Plays offers changes based on the recap.
- **The second-half twist arrives:** the boss checks in, or the encounter changes.

The recap teaches without a tutorial: it shows what's working and what isn't.

## What the box score does

**Energy goes away, so real stats need new jobs.** The options, which can be combined:
- **Minutes become touches.** Each hero can be used a set number of times per game, based on their real minutes. A 36-minute star can carry the offense, and an 18-minute bench player becomes a specialist saved for the right moment. This may be the clearest link to real stats in the whole design. **The arithmetic:** 12 possessions of about three steps is about 36 touches a game, and five starters play about 170 minutes, so **one touch per 5 minutes played** balances almost exactly: a 36-minute star gets about 7 touches, an 18-minute player 3 or 4. Spending a star's touches early or saving them for the fourth quarter becomes a coaching decision.
- **Class stats scale the moves,** as tiers do today. Points power the Ranger's finishers and assists power the Cleric's enablers.
- **Big nights unlock signature and legendary finishers,** as now.
- **Opponent turnovers give fast breaks.** Each 💫 Fumble adds a bonus possession or step. A 🫳 Pickpocket Champion does the reverse and steals one from you.
- **The horde's scoring** can scale with the opponents' real points.
- **The literal version** (the box score generates the moves: a Wizard shot for each made three, an enabler charge for each assist) is very on-theme but may swing too much from night to night. It's worth trying on paper.

## Encounters

**Decided: each encounter has one or two objectives plus the horde's own objective.** Objectives come from a standard set (Hold, Break, Bounty), and every encounter gives the horde an objective with its own fantasy flavor. Four types to start; Carry and Loose ball (below) are parked.

**An objective is just another target.** It can be open or contested, enemies guard it, and setup moves open it, so objectives use the rule players already know.

**Plays can be built for objectives.** In an encounter with objectives, every class can use the **objective finishers** that encounter needs:
- **Claim** works on a Hold.
- **Smash** works on a Break.

These deal little damage to enemies and work on the objective instead. A play like *Screen → Read the Defense → Smash* is a set play for the objective rather than for a takedown. The playbook is drawn up after the scouting report, so the objectives are known, and spending one of four slots on an objective play is a real choice.

### Objective types

**Hold: a spot that takes several possessions to win.**
- **Starts contested in more than one way:** a guard standing on it and a ward, for example, each opened by a different kind of setup. It's hard to open and win in a single possession.
- **A shared control meter:** damage dealt to the spot while it's open fills the meter, from either side.
- **Whoever fills it claims it:** the finisher that fills the meter claims the spot for its side, which scores at once and again at the end of each of that side's possessions while it holds it. The meter then resets, and the other side can win it back.
- **The risk:** progress belongs to no one. You can start the work and let the opponent finish it, so timing the claim matters as much as the damage.

**Break: a structure worth points when destroyed.**
- It has HP, its guards contest it, and taking it down scores.
- **Treasure chests** are a Break variant worth fewer points but also some **gold** (the team's currency), so a chest trades points now for the season later.

**Bounty: a marked enemy worth bonus points before a deadline.** For example, "take down the Goblin Shaman before the end of the first quarter: +6." Bounties reward burst damage and timing, and they point the player at a matchup.

**The horde's objective: one per encounter.**
- **The horde's turn is its offense.** It moves its objective forward and tries to keep the heroes from interfering.
- **It scores the way the party does:** open hits on heroes, hero takedowns, and progress on its objective. The goblins' ram scores for every bit of damage it does to the city gate, and much more for breaking it.
- **Going after heroes is part of the plan:** the horde targets whoever threatens its objective, such as the Cleric keeping the party up or the Wizard and Rogue who can clear the workers.
- **The heroes interfere** by taking down or disabling the enemies doing the work. **The horde reacts:** it calls reinforcements to pick the work back up, or goes after the hero who disrupted it.
- Most of each encounter's fantasy flavor lives here, and it's why the horde's plays have to present a real challenge (see Open questions).

**Pricing (to tune):** most objectives are worth about what a good possession earns (4–6), and a few are big swings worth two possessions (8–10), so chasing one is a real choice rather than automatically right or wrong.

**Rules that keep objectives honest:**
- **The horde goes after objectives too:** enemy plays can claim a Hold, guard a Break or push their own objective, so ignoring an objective costs points.
- **An objective play can't ignore the enemies.** If a playbook could win without fighting, enemies must score enough on their own to punish it.
- **At most two standard objectives plus the horde's objective,** so the scouting report stays readable.

### By encounter (first draft)

| Encounter | Horde objective | Objectives |
| --- | --- | --- |
| **Goblin Horde** | **Storm the Gate:** a battering ram needs a crew of 4 goblins. Each enemy turn it's crewed, it hits the city gate, scoring for the damage and much more for breaking the gate. A Fireball on the crew stalls it; the horde answers by calling reinforcements to pick it up, or by going after the Wizard | **Bounty:** the Goblin Shaman before the end of Q1 (today's "break the pack before the War Drum"). **Break:** a goblin loot wagon (a treasure chest: points and gold) |
| **The Crypt** | **The Rising:** the Necromancer channels a ritual, which bone piles feed. If it completes, a Bone Giant rises and the horde scores big. Strip or Down the channeler, or burn the bone piles with fire and holy damage | **Break:** the ⚱️ Phylactery (big points, and the Lich stops halving damage) |
| **Dragon's Lair** | **The Hoard Tithe:** kobolds carry coins to the sleeping Dragon. At the threshold the Dragon wakes enraged and the horde scores big. Take down the carriers to slow it; waking the Dragon early (the ambush) seals the hoard | **Break:** hoard chests (points and gold). **Bounty:** the Wyrmling, the thief, before halftime |
| **Giant's Hall** | **The Skald's Saga:** the Skald's war song builds each enemy turn. When it finishes, the Giant Lord's Avalanche falls and the horde scores big. Topple a giant or Strip the Skald to stop the verse | **Hold:** the giant's high seat (the hearth), contested by a giant and a frost ward. **Bounty:** the first topple of the Giant Lord |

The encounters' existing twists become scoring rules rather than special cases. The boss changes from a wall to grind down into a threat to answer: a team can win without killing it, by outscoring it.

### Parked objective types

- **Carry:** an item (treasure, relic, captive) passed along a play like an enabler and turned in with a Deliver finisher. An enemy steal knocks it loose. A literal second ball; it may return for a new encounter.
- **Loose ball:** takedowns drop orbs for a later step or a 🏀 board token to collect.

Traits already read like defense: ✋ Swat blocks the first shot, 🫳 Pickpocket intercepts a pass, and 📣 Floor General could shrink the party's enablers while it lives.

## Progression

**The playbook is the progression.** Gold buys playbook slots (see The playbook). PP buys new moves and finishers rather than weapon levels, so a hero's growth shows up as new options when drawing up plays. Respec stays free, so experimenting costs nothing.

## What carries over

Most of the game outside the battle stays as it is:
- The data layer and the live season, form and salaries.
- The roster, the cap, gold and ten-day contracts.
- Picking games, and the mirror horde with Champions, traits and Fumbles.
- Encounters as themes, and the simulators.

**What gets replaced:**
- The combat engine and the bots, plus every encounter's tuning and the golden baseline.
- The battle screen.
- Progression: the Armory becomes moves.
- The save format, which needs a migration.
- All the teaching material: How to play, Sample turn, coach tips, the Glossary.

It is effectively a second game built on the same foundation.

## Risks

- **One play is always right.** Combat is deterministic, so a bot can test every play every possession. That's great for simulation, but the system fails if one play wins most of the time. The fixes are the scoreboard and clock, the horde's visible call, encounter scoring and scouted repeats. This is the first thing to test.
- **Watching instead of playing.** Presentation carries the excitement: the ball moving between heroes, the finisher landing, the scoreboard ticking. Plus one quick defensive choice per possession.
- **One dominant playbook spreads among friends.** The weekly horde, the scouting report and scouted repeats push against one playbook ruling. Shareable codes are worth having anyway.
- **The play designer on a phone.** It has to be easy: three or four step slots, then pick a hero and a move for each, with a check on each pass.
- **Ignoring enemies to chase objectives.** Enemies must score enough that leaving them alone loses games.
- **Blowouts.** A run of good possessions could decide a game early. Possible fixes: momentum that briefly strengthens the trailing side, or the horde calling its own timeout to buff itself after a big run.
- **Sitting out stings.** Leaving out the hero powered by a favorite player hurts. Off-ball defense has to matter enough that it doesn't feel like a punishment.
- **Difficulty becomes the margin, not survival.** This probably helps: Normal can be a forgiving spread rather than a weaker horde.

## How to test it

1. **Paper prototype.** Index cards for about three moves and one finisher per class, plus a goblin pack and one Champion. Draw up three plays and run a few possessions. An hour shows whether calling plays is fun or a chore.
2. **A standalone simulator,** separate from the game's engine. Measure:
   - **Best-play advantage:** how much better the best play is than an average sensible one. Small is good.
   - **How often the best play changes,** between possessions and with the score. Often is good.
   - **Close finishes:** the share of games decided by 5 points or less in the fourth quarter. This is the "action-packed" number.
   - **Every scoring route can win:** a bot that chases only one source of points should win a fair share somewhere.
   - **Suggest Plays versus the best playbook:** the suggested book should be close.
3. **Playtest with two kinds of friends:** one who plays RPGs and one who only watches the NBA. Measure seconds per possession (target about 20 or less) and ask whether the last possession felt tense.

## Decided

- **Scoring:** open and contested targets; points from shots, takedowns and objectives (see Scoring: the open look).
- **Objectives:** each encounter has one or two objectives (Hold, Break, Bounty) plus the horde's own objective; plays can be built for objectives (see Encounters).
- **Game length:** fixed quarters, 3 party possessions each, 12 in all, each followed by an enemy turn.
- **Playbook:** four plays to start; gold buys a fifth and sixth slot; six is the cap, pending testing.
- **Repeats:** a hero can appear at most twice in a play, never on back-to-back steps.

## Open questions

- **The box score in detail:** exactly which stat does what. The approach: settle what possessions look like on both sides first, then fit the stats to them.
- **The class move lists,** designed for compelling choices.
- **Defense:** beyond off-ball heroes, how steals, blocks and rebounds come in.
- **Enemy plays and halftime adjustments** as the core of encounter design.
- **How halftime works.**
- **How PP are earned and spent** now.
- **The UI,** including pre-game.
- **Fallen heroes:** foul trouble (out for a possession or two), or today's knockout?
- **Reserves:** could a reserve check in when a hero runs out of touches? That would use the eight-player roster in battle, but it's held for later.
- **Enemy chains:** does the horde chain buffs (for example a 📣 Floor General passing to other monsters), or only telegraph single actions?

## Related idea: a viewpoint toggle

Separate from Play Calling, and usable in either version of the game: a **Hoops view and a Quest view** of the same game, chosen on first launch ("Coming from the court or the dungeon?") and switchable any time. It only changes descriptions:
- **Hero cards:** "Wizard" vs "Sharpshooter · powered by 3PM."
- **Ability and enemy text:** "Provoke" vs "Draw the double."
- **The battle log** reads as play-by-play.
- **The result screen** shows a box-score recap.
- **The Glossary** gives both explanations.

Buttons, numbers and rules stay the same in both. It's stored per browser, like coach tips, so saves don't change.

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

### Terms

**Statuses on enemies:**
- **Open / contested:** a finisher on an open target scores and deals full damage; on a contested one it deals half damage and scores nothing. Contests only affect finishers, never the moves before them.
- **Taunted:** open for the rest of this possession, and on the horde's next turn it must attack the Warrior.
- **Exposed:** takes +3 from every hit for the rest of this possession.
- **Disabled:** open, and it drops out of the horde's next play.
- **Pinned** (minions only): off the objective for the next enemy turn. It still counts as crew, so the horde doesn't react as if it had fallen.

**Enablers (what a move passes to the next hero):**
- **+damage:** the next hero's hit deals more.
- **Crit:** the next hero's hit deals double damage.
- **Open:** the next hero's target counts as open, even if it's contested.
- **Split:** the next hero's move or finisher hits one more enemy of the player's choice, at full damage. A single-target finisher hits two enemies; Fireball hits four.
- **Heal:** the next hero heals.
- **Armor:** the next hero takes less damage from each hit until the end of the enemy turn.
- **Putback:** if the next hero's finisher doesn't take its target down, the hero who passed it follows up with a free hit on the same target for half the finisher's damage. It doesn't use a touch, and it scores like a finisher: shot points if the target is open, and takedown points if it finishes it. (The basketball version: the shot rims out and the big tips it in.)

**Scoring a multi-target finisher:** one shot is scored, from the play's primary target; each enemy taken down scores its takedown points.

### Class kits (first draft)

Each class has a basic move (always available), three moves, two finishers, a signature finisher (double-double) and a legendary finisher (triple-double). Numbers are at Average tier; the class rating's tier scales them each week. An enabler always goes to the next hero in the play, and an enabler with no next hero, or one the next step can't use, is wasted (the play designer flags it).

**Warrior: the big.** Opens targets with taunts, protects teammates, gives second chances.
- **Chop** (basic). Action: 4 damage. Enabler: +2.
- **Provoke.** Action: 3 damage, and taunts the enemy. Enabler: armor +3. *Opens a contested target, pulls a dangerous hit off a teammate, and shields whoever acts next.*
- **Shield Wall.** Action: every hero gains armor +2 until the end of the enemy turn. Enabler: armor +3. *The defensive play, when the horde's call is aimed at the party.*
- **Box Out.** Action: 4 damage. Enabler: putback. *Insurance on a finisher that might fall short.*
- **Slam** (finisher). 14 damage to one enemy.
- **Cleave** (finisher). 8 damage to each of two enemies.
- **Bulwark** (signature). 10 damage, and every enemy is taunted through the next enemy turn.
- **Last Stand** (legendary). 16 damage, and the Warrior can't fall for the rest of the game.

**Cleric: the point guard.** The best enablers; a weak finisher by design.
- **Mace** (basic). Action: 3 damage. Enabler: heal 4.
- **Empower.** Action: heals an ally 6. Enabler: the next hero's hit +50%. *The core assist.*
- **Read the Defense.** Action: Exposes an enemy. Enabler: open. *Sets up the shot two ways at once.*
- **Bless.** Action: heals every hero 3. Enabler: doubles the next hero's enabler (+2 becomes +4, armor +3 becomes +6; open and split stay the same). *The hockey assist: it rewards longer plays.*
- **Smite** (finisher). 9 holy damage to one enemy, and every hero heals 3.
- **Sanctuary** (signature). 6 damage, and every hero heals 15.
- **Divine Intervention** (legendary). 8 damage, and fallen heroes return at full HP.

**Rogue: the pest.** Shuts down Champions, punishes disabled targets.
- **Dagger** (basic). Action: 4 damage. Enabler: +2.
- **Strip.** Action: Disables a Champion (on the boss, it Exposes instead). Enabler: crit on that enemy. *Two jobs: opens the target and breaks the horde's next play.*
- **Poison Blade.** Action: 3 damage now and 3 more at the end of the enemy turn. Enabler: the next hero's hit +3 on a poisoned enemy.
- **Feint.** Action: Exposes an enemy. Enabler: split.
- **Backstab** (finisher). 10 damage to one enemy, doubled if it's Taunted or Disabled.
- **Flurry** (finisher). 4 damage to each of three enemies.
- **Shadowstep** (signature). A Backstab that always crits, and the Rogue can't be targeted on the next enemy turn.
- **Assassinate** (legendary). Takes down any enemy except the boss.

**Wizard: the shooter.** Area damage, 3-point finishers, and gravity that opens teammates.
- **Magic Missile** (basic). Action: 4 damage that ignores armor. Enabler: the next hero's hit ignores armor.
- **Gravity.** Action: 3 damage. Enabler: open. *The defense chases the shooter, and the next hero gets the open look.*
- **Spacing.** Action: 2 damage to every enemy. Enabler: split.
- **Frost.** Action: 5 damage, and the target's next hit deals half. Enabler: +3. *Offense that also defends.*
- **Fireball** (finisher, 3-pointer). 8 damage to each of up to three enemies.
- **Lightning Bolt** (finisher, 3-pointer). 14 damage to one enemy.
- **Chain Lightning** (signature). 10 damage to every enemy.
- **Meteor** (legendary). 20 damage to every enemy.

**Ranger: the wing scorer.** Reliable damage, tough shots, and control of minions.
- **Longbow** (basic). Action: 4 damage. Enabler: +2.
- **Mark.** Action: Exposes an enemy, and the Mark lasts through the next possession too. Enabler: the next hero's hit on the marked enemy +3. *Sets up this play and the next one.*
- **Drive.** Action: 5 damage. Enabler: open.
- **Pin.** Action: Pins a minion. Enabler: +2. *Stalls an objective without drawing the horde's reaction.*
- **Aimed Shot** (finisher). 12 damage that ignores armor, and it scores even when contested. *The tough-shot maker.*
- **Double Strike** (finisher). Two hits of 6, on the same enemy or two.
- **Volley** (signature). 6 damage to every enemy.
- **Deadeye** (legendary). Three Aimed Shots at three different enemies.

**What each class opens with:** Warrior Provoke, Cleric Read the Defense, Rogue Strip, Wizard Gravity, Ranger Drive.

**Combos that should feel great:**
- *Provoke → Empower → Backstab* (Critical Taunt): 10, doubled for the taunt, +50%: 30.
- *Spacing → Fireball:* four crew goblins in one shot.
- *Box Out → Slam:* the Slam leaves the Ogre standing, and the Warrior tips in 7 more.
- *Bless → Mark → Backstab:* the hockey assist. Bless doubles Mark's +3 to +6, and the Exposed target takes +3 more: 19.

A class's place in a play is its identity. The Cleric is the point guard because that's where it's strongest, not because it's labelled one.

**A hero can appear twice in a play, but never on back-to-back steps** (the enabler always goes to the next ally, so a hero can't pass to themselves). A star-heavy play alternates: Star → Cleric → Star (finisher). This makes building around a star a real roster choice. Three things keep it from becoming the one dominant strategy: it spends the star's touches faster (see What the box score does), a star who's always on the ball never defends, and the star's mirror Champion is already a scaled threat.

**Play length is a choice made while designing.** A short play (two steps) leaves more heroes off the ball to defend. A long play (four steps) builds a bigger finisher but leaves the party exposed. The risk and reward are set in the playbook, so nobody has to calculate them mid-game.

**Targeting takes one or two taps.** Each play has one primary target, chosen when it's called. Every other step targets relative to that: the primary target, the most injured ally, the next hero.

## The playbook

**Before each game, the player prepares a playbook of four plays.** Gold buys a fifth and a sixth slot over the season (the playbook belongs to the team, and gold is the team's currency), with six as the cap, pending testing. A larger playbook stays readable on a phone, and the cap stops a late-season playbook from covering every situation. Plays are built from hero classes, not NBA players, so they carry over when a different player powers a hero next week.

**Decided: one active playbook and a library.** Players can draw up as many plays as they like; the library keeps them all, and four to six are active in a game. (Named sets, like a goblin playbook and a crypt playbook, can come later if players want them.)

### The Game plan screen (pre-game)

**Where it sits:** Encounter → Assign heroes → Pick games → **Game plan** → Tip-off. It comes after picking games because the picks build the horde. **Back to picks** keeps the playbook intact, so changing a pick to dodge a nasty Champion costs nothing.

**The top half is the scouting report:**
- **Their roster:** each Champion's tier, traits, and the real player it mirrors ("Goblin Cutthroat · Elite · mirrors Shai's 4 steals").
- **Decided: their full playbook, with triggers.** "They call Reinforce when the ram's crew drops below 4." In the game only the call is shown, but players who study the report can work out what the horde will switch to. Scouting rewards homework without requiring it.
- **Objectives:** theirs (the ram, the gate's HP, the ram's damage this week from the opponents' FG%) and the party's (the Shaman Bounty and its deadline, the loot wagon), with point values.
- **Quarter script:** who arrives when.
- **The party's week:** each hero's offensive tier, defensive tier, touches (from true usage), and any signature or legendary finisher unlocked.

**The bottom half is the playbook:**
- **Four active slots** (up to six with gold), filled from the library.
- **Suggest Plays** fills the whole book, and each slot has its own suggestion button. Each suggested play comes with a one-line explanation.
- **Each play shows** its chain as hero icons, its situation tags (*vs a big*, *vs a swarm*, *stop the objective*, *need a bucket*, *protect the lead*; suggested automatically), its form this week (🔥 or ❄️, with the reason: "your Rogue's player had 4 steals", "cold Cleric") and the touches it costs each hero.
- **Decided: a touch budget that warns, never blocks:** "Your plays use the Wizard in 3 of 4 plays. She has 6 touches; about 2 calls each." Building around a star is allowed and is a real choice; the player just sees the cost. In the game, a play a hero can no longer join shows as unavailable.
- **Shareable playbooks** (later): a code friends can trade.

**The play designer** (from any slot or the library):
- **2–4 step slots.** For each step, pick a hero, then one of their moves; the move shows its action and enabler in one line each.
- **The rules are enforced as the play is built:** the last step must be a finisher; no hero on back-to-back steps; at most twice per hero in a play; objective finishers (Claim, Smash) appear only when the encounter has those objectives.
- **Each pass is checked:** the enabler arrow between steps shows **✓ boosts** or **– wasted** ("Provoke's armor → the Cleric ✓", "Read the Defense's open → Empower – wasted").
- **The preview uses this week's real numbers** against an enemy chosen from this week's horde: "vs Ogre: open ✓, 30 damage, takedown, 2 + 4 points."
- **Name it and save it** to the library.

**Fast paths for casual players:**
- **Decided: the first game's playbook arrives filled by Suggest Plays,** with one line explaining each play and an invitation to draw up their own. A new player can tip off in seconds.
- **Every later week, Run it back** keeps last week's playbook, and Suggest Plays flags any play that got much weaker ("❄️ your Rogue is cold this week; consider swapping Critical Taunt").
- **Target time:** about 10 seconds for a casual player; as long as they like for a strategic one.

## During the game

**A possession is: see the horde's call, call your play, tap a target, watch it run.**

1. **The horde calls its play.** Today's telegraphs become the opponent's call: "Ogre: Ground Slam incoming." The read is basketball: they're running X, so I call Y.
2. **Call a play.** A play that fits the moment can glow softly (the bot can judge this). The player always decides.
3. **Tap the primary target.** The play runs, with each pass and the finisher shown clearly and the points floating up onto the scoreboard.
4. **Defense.** Heroes who didn't touch the ball each take their class's defensive action for the horde's turn (see Defense). Sensible defaults are set; one tap accepts them or a drag changes one.

**Timeouts replace free undo.** Today's ↶ Undo invites trial and error until a round is solved by hand. Instead, a single step can be previewed before committing, and each game has a couple of timeouts that take back a possession.

**The defense scouts repeated plays.** Calling the same play back to back makes it weaker (for example, its enablers lose their bonuses), and halftime clears this. Variety pays off without being forced.

**Optional shot clock.** A visible 24-second clock per possession could be the most action-packed touch in the game, but it's stressful and an accessibility problem. If it exists, it's an option or a small bonus ("quick possession: +1"), never a penalty.

## Defense

**Much of the defense is inside the plays.** Taunts, armor that lasts through the enemy turn, Disable, Frost and Pin all blunt the horde's next turn, so calling a play with defensive parts is part of defending.

**Decided: each off-ball hero has one defensive action, its class's specialty.** One tap each, with sensible defaults (protect what the horde's call is aimed at).
- **Protect (Warrior).** Choose an ally or objective: every enemy finisher aimed at it is contested (half damage, no points). At Elite, the first one is blocked entirely.
- **Triage (Cleric).** After the enemy turn, heals the most injured hero.
- **Strip the Ball (Rogue).** Each enemy turn, the Rogue knocks the ball loose from one minion working the horde's objective: one fewer goblin on the ram that turn, one fewer coin carried to the Dragon, one less bone pile feeding the ritual. At Elite, two workers. It's automatic, can't be wasted by the party's own play, and gives the Rogue a defensive job nobody else has: the others defend heroes or keep them standing, the Rogue slows the objective. Chosen to test. (It replaced **Jump the Lane**, choosing one pass in the horde's play to cancel: too much to read, and wasted whenever the party's play made the horde switch calls.)
- **Close Out (Ranger).** Choose an enemy: its finisher is contested wherever it's aimed. At Elite, its other hits deal half damage too.
- **Ward (Wizard).** Armor on one ally until the end of the enemy turn. A deliberately weak defender.

**Defense may go fully automatic** (decide in playtests). The player's defensive decision then becomes who sits out of the play, which calling plays already includes. Each action needs a fixed target rule so they don't pile onto one threat:
- **Protect:** the hero the horde's finisher is aimed at.
- **Close Out:** the horde's ranged enemy, or the second most dangerous Champion if the first is covered.
- **Triage:** the most injured hero.
- **Ward:** the most injured hero not already Protected.
- **Strip the Ball:** a worker on the objective (already automatic).

The game screen shows each defender's target as a small line or icon before the possession ends.

**Decided: a defensive rating sets how well each specialty works,** in the same style as the class rating: **3 × STL + 3 × BLK + DREB**, giving a tier from Cold to Elite. The tier scales the numbers (heals, armor), and Great and Elite add the extra effects above. A hero now has two ratings from the same box score, offense from the class rating and defense from the defensive rating, and can't use both on the same possession: a hero on the ball isn't defending.

## Halftime

**Decided: halftime is when the player gets information and adjusts,** the way a coach does. It comes after the 6th party possession and its enemy turn, takes about 30–60 seconds, and **Keep the game plan** skips straight through.

**1. The first-half box score.** The game's own box score, in basketball terms:
- **Score and scoring by source:** the party's shots, takedowns and objectives against the horde's open hits, hero takedowns and objective progress ("Ram: 14 points, gate at 12 HP").
- **Each hero's line:** points; assists (enablers that led to a score); stops (Protect contests, workers knocked loose by Strip the Ball); touches used and left.
- **Each play's line:** times called and points per call ("Critical Taunt: 2 calls, 22 points").

Sports fans read box scores without thinking, so the recap teaches without a tutorial.

**2. The horde's adjustment** (on Normal and Hard; milder on Normal). The horde makes one change from a short list, picked by a fixed rule from the first half, and it's shown before the player adjusts:

| If the first half went like this | The horde adjusts | What it does |
| --- | --- | --- |
| One hero scored most of the points | **Double the star** | That hero's targets are contested unless a move or status opens them |
| One play did most of the damage | **Scout the play** | That play starts the second half already scouted |
| The horde's objective is behind schedule | **All hands on the objective** | Q3's arrivals go straight to the objective |
| The horde is ahead | **Protect the lead** | Free minions crowd more: Champions stay contested with fewer goblins around |

The horde only adjusts at halftime for now (no timeouts after big runs).

**3. The player's adjustments: change up to two plays, however they like.** Plays can be drawn up in any number before the game (the library); four to six are active. At halftime the player can change up to two of the active plays:
- **Run it back:** change nothing.
- **Take a suggestion:** Suggest Plays offers swaps based on the box score and the horde's adjustment ("They're doubling your Wizard. Try Gravity → Drive → Aimed Shot, which doesn't need the Wizard to score").
- **Swap in a play from the library.**
- **Edit a play or draw up a new one** in the play designer.

Casual players run it back or take a suggestion in a tap; strategic players get real tweaks. Two changes keeps halftime short and keeps the first-half game plan meaningful.

**4. Locker room:**
- Fallen heroes return at half HP, and every other hero heals 25% of their max HP.
- Scouted plays reset, except one the horde's adjustment marks.
- **Touches don't reset:** usage is per game, so a star used up in the first half stays used up.

**5. Second-half preview:** what arrives in the third quarter (the Chieftain and the strongest Champions), where each objective stands, and the Bounty deadline if one is still live.

## What the box score does

**Energy goes away, so real stats need new jobs.** The options, which can be combined:
- **Decided: usage becomes touches.** Each hero can be used a set number of times per game, from the player's **true usage**: possessions used plus assists, **FGA + 0.44 × FTA + TOV + AST**. It combines how much a player has the ball with how long they play, and counting assists means a pass-first point guard, the natural Cleric, has the ball a lot. The data has every input (and every player's line, so team context is available too). **The arithmetic:** 12 possessions of about three steps is about 36 touches a game for five heroes, so the total is divided by a constant to land there (to tune). Spending a star's touches early or saving them for the fourth quarter becomes a coaching decision. Players see it as "usage".
- **Class stats scale the moves,** as tiers do today. Points power the Ranger's finishers and assists power the Cleric's enablers.
- **Defensive stats scale the defensive action** through the defensive rating (see Defense).
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
- **Decided: minions work the objective automatically.** It's why they're there, and they aren't tied to an opposing basketball player. If enough workers are in place, the objective moves forward every enemy turn.
- **Champions and the boss run the horde's called play:** one telegraphed chain per enemy turn, aimed at whatever protects the objective (the hero threatening the workers, the healer, an open hero). So every enemy turn threatens two things, the objective and a hero, and the party usually can't answer both in one possession.
- **The heroes interfere** by taking down or disabling the enemies doing the work. **The horde reacts:** it calls reinforcements to pick the work back up, or goes after the hero who disrupted it.
- **The horde chooses by fixed rules in priority order,** like today's monster behaviors: deterministic, readable, and learnable ("they always go after whoever stalled the ram"). Difficulty can become how smart the horde calls: fixed priorities on Normal; on Hard it also counters the party's last play and makes halftime adjustments.
- **Decided: show only the horde's call, not its fallback.** If the call breaks during the party's possession (its crew falls, its finisher is Stripped), the horde switches to another play without warning. **Watch this in playtests:** if switches feel unfair, show the fallback too (*"If the crew falls: Call the Pack"*).
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

### Worked example: Goblin Horde (first draft)

Goblins besiege a city. Their ram works on the gate while the Champions keep the heroes busy. All numbers are placeholders for the simulator to tune.

**The cast** (the same roles and mirrors as today):

| Enemy | Mirrors | Job in Play Calling |
| --- | --- | --- |
| **Goblins** (minions, 8 HP) | Opposing teams' points (1 per 40, as now) | Crew the ram automatically. Goblins not on the ram crowd the Champions: while 2 or more free goblins stand, every Champion is contested |
| **Goblin Shaman** | Assists leader | Playmaker: War Drum (enabler: every goblin and the ram +damage this turn), **Call the Pack** (2 goblins join and go straight to the ram), small heals |
| **Goblin Hexer** | Top scorer | Setup: Hex Exposes a hero for the finisher after it |
| **Goblin Sharpshooter** | Second scorer | Ranged finisher: Dirty Arrows on the lowest-armor hero (poisons) |
| **Goblin Cutthroat** | Steals leader | Finisher on an Exposed or low-HP hero |
| **Ogre** (hired muscle) | Leading rebounder | **Goblin Toss:** throws a goblin onto the ram (fills the crew) or at the lowest-HP hero (a finisher). Ground Slam when no goblins are left |
| **Goblin Chieftain** (boss) | The best opposing performance | **Chieftain's Command** (enabler: the next step and the ram +damage). Its own Call the Pack every other enemy turn |

**Storm the Gate (the horde's objective):**
- **The gate** has 40 HP.
- **The ram** needs a crew of 4. Each enemy turn it's crewed, it hits the gate for 6, +1 for each extra goblin on it (up to 8). **The opposing teams' FG% scales the ram's damage** (an efficient offense hits harder), as it sets goblin accuracy today. Goblins fill the ram first and crowd the Champions with the rest.
- **The horde scores** 1 point per 2 gate damage, and **+10 when the gate falls**.
- **Unopposed, the gate falls around halftime** (6 damage × 7 turns), so ignoring the ram loses.
- **Once the gate is down, the goblins enter the city.** At the end of every enemy turn, each goblin on the field scores 1 for pillaging, except goblins summoned that turn. The ram no longer matters, but every goblin left standing does, which pushes the party to clear enemies fast.

**The horde's playbook,** called in this priority order:

| Play | Called when | Chain |
| --- | --- | --- |
| **Reinforce** | The ram has fewer than 4 crew (and the gate stands) | Shaman or Chieftain: Call the Pack, 2 goblins to the ram / +damage → Sharpshooter: Dirty Arrows on the hero who took down the most crew |
| **Hunt the Disruptor** | A hero took down 2+ crew in the party's last possession | Hexer: Hex that hero (Exposed) → Cutthroat: finisher on them |
| **Cut Off the Healer** | The Cleric healed 10+ in the party's last possession | Hexer: Hex the Cleric → Sharpshooter: Dirty Arrows on the Cleric |
| **Toss** | A hero is below a third of their HP | Shaman: War Drum → Ogre: Goblin Toss at that hero |
| **Pound the Gate** (default) | Otherwise | Chieftain's Command or War Drum: the ram +3 this turn → Ogre or Cutthroat: finisher on the most open hero |

**The party's objectives:**
- **Bounty: the Goblin Shaman before the end of Q1, +6.** It's behind the pack, so the free goblins contest it. Opening it takes a Screen, Gravity or Drive. Taking it early also stops its reinforcements.
- **Break: the goblin loot wagon** (a treasure chest) arrives in Q2: 15 HP, guarded by the Cutthroat. Worth 3 points and some gold.

**The quarters** (today's waves):
- **Q1:** the Shaman, the Hexer and 30% of the goblins, with the ram crewed from the first turn.
- **Q2:** the weaker Champions, 35% of the goblins and the loot wagon.
- **Halftime.**
- **Q3:** the Chieftain, the strongest Champions and the last 35% of the goblins.
- **Q4:** no new arrivals except Call the Pack. Crunch time.

**Scoring at a glance:**

| Party | Horde |
| --- | --- |
| Open shot: 2 (3 for long-range finishers), +1 and-one | Open hit on a hero: 2 |
| Takedown: goblin 1, Champion 4, Elite +2, Chieftain 8 | Hero takedown: 4 (the hero sits out like foul trouble) |
| Shaman Bounty: 6 · Loot wagon: 3 + gold | Gate damage: 1 per 2 · Gate falls: +10 · Pillage: 1 per goblin per enemy turn |

**What the encounter tests:**
- **Area damage against the crew,** and whether it's worth drawing the hunt that follows.
- **Opening the Shaman early,** which stops reinforcements at the source.
- **Protecting the gate** with defenders versus protecting the Wizard.
- **Clearing fast once the gate falls.**

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
3. **A Goblin Horde test artifact ✅ Built:** https://claude.ai/artifact/MMemEKiBujoQHu4G9GaSbF, separate from the game and its test artifact. Source in `prototypes/play-calling/` (its own Vite build: `node prototypes/play-calling/build.mjs`, then publish `prototypes/play-calling/dist/page.html` to that URL).
   - **The week:** 2025–26 week 1, every hero Good or better: Jokić (Warrior, triple-double), Dončić (Cleric), Antetokounmpo (Rogue), Gilgeous-Alexander (Wizard), Brown (Ranger). `prototypes/play-calling/scripts/pick-week.ts` picks it and builds the horde with the game's own mirror rules.
   - **What it includes:** the Game plan (scouting report, Suggest Plays, library, play designer with pass checks and a preview), the game screen (scoreboard, objectives, the horde's call, open and contested targets, touches, the playbook dock with a glow on the best call, an always-available **Iso** of one hero and one finisher, timeouts), automatic or manual defense, halftime (box score, horde adjustment, two changes, locker room) and a final box score with a copyable play log and seconds per possession.
   - **Testing aids:** a tuning drawer in the menu, and `npx tsx prototypes/play-calling/scripts/sim.ts`, which plays it with a greedy bot (the glow) and a random caller.
   - **Prototype tuning (differs from the draft numbers above):** gate 50 HP, goblins 9 HP, Champion HP ×1.25, horde open hits score 3, touches = true usage ÷ 4.7, Normal at full strength and Hard ×1.12. Following the glow: Normal 62–48, Hard 60–55; random calling loses most games. The best call changes on 56–67% of possessions. Goblin HP is a cliff: at 8 a single Fireball clears the crew (Normal 64–26), at 10 the gate falls and pillage snowballs.
   - **Left out:** traits, Fumbles, Smash and Claim finishers, signature and legendary finishers for bots, the Hoops view.
4. **Playtest with two kinds of friends:** one who plays RPGs and one who only watches the NBA. Measure seconds per possession (target about 20 or less) and ask whether the last possession felt tense.

## Decided

- **Scoring:** open and contested targets; points from shots, takedowns and objectives (see Scoring: the open look).
- **Objectives:** each encounter has one or two objectives (Hold, Break, Bounty) plus the horde's own objective; plays can be built for objectives (see Encounters).
- **Game length:** fixed quarters, 3 party possessions each, 12 in all, each followed by an enemy turn.
- **Playbook:** four plays to start; gold buys a fifth and sixth slot; six is the cap, pending testing.
- **Repeats:** a hero can appear at most twice in a play, never on back-to-back steps.
- **The horde's turn:** minions work its objective automatically; Champions and the boss run one called play. Only the call is shown, not the fallback (watch in playtests).
- **Stats change how well a hero does things, not how much they can do.** The one exception: double-doubles and triple-doubles unlock signature and legendary finishers. This keeps the cognitive load down; revisit after playtests.
- **Touches come from true usage** (FGA + 0.44 × FTA + TOV + AST; see What the box score does).
- **Class kits:** a basic move, three moves, two finishers and two big-night finishers per class (first draft in Moves, finishers and plays). Rogue Strip disables Champions; Ranger Pin works on minions.
- **Defense:** each off-ball hero takes its class's defensive action, scaled by a defensive rating; the Rogue's is Strip the Ball (see Defense).
- **Halftime:** a first-half box score, one horde adjustment (Normal and Hard, milder on Normal), up to two play changes of any kind, locker-room healing; the horde adjusts only at halftime for now (see Halftime).
- **Pre-game:** one active playbook plus a library; the first game's playbook is filled by Suggest Plays; the scouting report shows the horde's full playbook with triggers; the touch budget warns, never blocks (see The Game plan screen).
- **Goblin Horde ram:** the opposing teams' FG% sets its damage.
- **Goblin Horde gate:** when it falls, the goblins score big and enter the city; each goblin on the field then scores every enemy turn (not ones summoned that turn).

## Open questions

- **The box score in detail:** exactly which stat does what. The approach: settle what possessions look like on both sides first, then fit the stats to them.
- **Enemy plays and halftime adjustments** as the core of encounter design.
- **How PP are earned and spent** now.
- **The UI** of the game screen (pre-game is in The Game plan screen).
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

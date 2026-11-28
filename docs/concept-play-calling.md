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
- **Guiding Light.** Enabler: Guided, the finisher ignores Taunt. *The Cleric's answer to an enemy big.*
- **Smite** (finisher, the Cleric's only one). 9 damage that Pierces, and the most injured hero heals 5. With Split it hits a second enemy and heals a second hero.
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
   - **Live moves (Nov 11):** an Offense option on the title screen. **Live moves** (the default) builds each possession one action at a time: pick a hero, a move and a target, with the ball (the last pass) and a 4-action shot clock shown; the 4th action must be a finisher, and a finisher ends the half. **Called plays** keeps the drawn-up playbook. Being explored because auto-run plays left the player disconnected from the possession.
   - **Watch:** in a scripted test, a one-action possession every time (a lone finisher) won Normal 68–12. Short possessions leave four heroes on defense, which shuts the horde down; live play may need a cost for short possessions or a cap on defenders.
   - **Finisher scoring and defenses (Nov 12):** replaces open and contested, following the [Powers List](https://claude.ai/artifact/PKpiBcAw2HuMB9Q29HdAWr) doc. Only finishers score: 2 for a finisher that damages a Champion or the boss after defenses, plus takedowns; the horde scores 2 for a finisher that damages a hero, 4 for a takedown. Defenses: Taunt and Armor 3 (Ogre), Quick (Cutthroat, Sharpshooter), Barrier +2 on the other Champions (Shaman), Block and Armor 2 (Chieftain). Each hero has two enablers and two finishers (passes: Armor, Sure, Crit, Pierce, Split); off-ball Protect and Ward give Armor, Close Out Slows. Simulator (smart bot): Normal 57–24, Hard 51–30; a random caller loses badly. The scripted lone-finisher live game now ends 50–37 (was 68–12).
   - **Barrier as a wall (Nov 12):** the Shaman raises the Barrier in front of the whole horde at the start of every party possession. Nothing behind it can be targeted, and the first damaging move breaks it (a finisher spent on it scores no bucket); Pierce no longer affects it. The default playbook now opens each play with a cheap damaging move (Critical Taunt, Kick Out, Frost Bolt, Spread the Floor), and the gate went from 50 to 70 HP. Simulator (smart bot): Normal 37–33, Hard 37–36. A lone finisher each possession now loses 2–31. Watch: the best call changes on only 18% of possessions, so one play may dominate while the Shaman stands.
   - **Shaman rework (Nov 13):** War Drum is automatic (the ram hits +2 while the Shaman stands and isn't Disabled). On each enemy turn the Shaman casts one: Call the Pack when fewer than 4 goblins are on the ram (goblins knocked loose by Strip the Ball still count), otherwise the Barrier for the party's next possession. The cast is shown in the call banner. The Shaman left the horde's called plays (Reinforce removed; passes now come from the Chieftain or Hexer, and a finisher acts alone if no passer is on the floor), and there is no Barrier on possession 1. Simulator: the smart bot wins 53–5 (it takes the Shaman down early, ending the drum, Barrier and reinforcements), while a random caller loses about 24–95. **Watch:** the Shaman now decides the game; it may need more HP, a smaller Call the Pack, or a pre-game Barrier (tried: barely changed the smart bot's result).
   - **Possession builder (Nov 13):** replaces live moves and called plays with one builder. Each possession has four slots (Start, Support, Support, Finish): tap a slot, pick a hero and a move, tap a target. Every helper's buff goes to the finisher wherever it sits (Crit, Pierce, Sure, Split; Armor protects the finisher); buffs don't stack; each hero takes part once; helpers aim at the finisher's target unless aimed elsewhere. A Shot panel shows the collected buffs, the projected damage, takedowns and points, whether it scores a bucket, and how the Barrier, Block and Taunt affect the play; the defenders are listed under it. Saved plays and Suggest fill the slots. The scouted-play rule is gone. Simulator (smart bot, saved plays): Normal 62–18, Hard 53–28; the best call changes on 55–82% of possessions (was 27%).
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
- **Horde score button (Nov 13):** the scoreboard shows what the horde will score on its next turn ("+2 ▸") next to the goblins' score, always visible and updated as you build the play. Tapping it opens a popup with the horde's turn line by line and how the horde scores.
- **Cleric rework and goblin waves (Nov 13):** the Cleric now has three enablers (Empower, Read the Defense, and the new Guiding Light, whose Guided buff lets the finisher ignore Taunt) and one finisher, Smite: 9 Pierce damage and 5 healing for the most injured hero, with Split adding a second enemy and a second hero. Benediction is gone, and Regroup now ends with Smite. The quarter waves (Q2 and Q3) now show a banner on the possession they land, listing the goblins (and how many went to the ram) and the Champions that arrived.
- **Tappable game terms (Nov 13):** game terms (Split, Sure, Crit, Pierce, Guided, Armor, Taunt, Quick, Barrier, Block, the statuses, War Drum, Call the Pack, bucket, takedown, finisher and the five defenses) are underlined wherever they appear: move cards, the shot panel, replays, the horde popup, enemy cards and the Guide. Tapping one opens its definition, and terms inside a definition can be tapped too. Only a term's first mention in each passage is underlined. The definitions live in `prototypes/play-calling/src/terms.tsx`.
- **Barrier redirect (Nov 15):** the Barrier is no longer a panel over the enemy cards. It's a striped strip in front of the horde, the cards behind it keep a dashed outline, and every card stays readable and tappable for its details. While aiming, any enemy can be tapped and the board labels it "✨ Barrier takes it", the same way Taunt redirects a hit. The builder's slot shows "→ ✨ Barrier (breaks it)" for the move that will hit the wall, and later slots aim past it normally.
- **Play designer matches the builder (Nov 17):** the play designer now uses the possession builder's four slots (Start, Support, Support, Finish), filled in any order: tap a slot, pick a hero (heroes already in the play are greyed out), then a move card. A "Buffs for the finisher" panel shows each helper's buff with ✓ boosts or – wasted on the finisher. The preview against one enemy is unchanged. A saved play keeps its slot order; empty Support slots are skipped.
- **Harder horde, Nov 18 (from a 55–0 playtest on Hard).** Diagnosis: an Elite Warrior's Protect cancelled the horde's only hit each turn, one Strip the Ball stalled the all-or-nothing ram, and nothing punished a stopped finisher. The simulator gained an **expert bot** that runs every saved play and Iso and searches every defense for the one that gives up the fewest points; it reproduced the problem at 59–8 (Hard). Three changes:
  - **Protect never cancels a hit.** It gives Armor at every tier; at Elite it also halves the hit before Armor. (Armor-only was too big a swing on its own: 60–44.)
  - **The ram pushes per goblin.** Each of the first four pushing goblins adds a quarter of the ram's hit, extras add 1, so Strip the Ball slows the ram instead of stopping it.
  - **Points off turnovers.** A finisher swallowed by the Barrier, or with every hit Blocked or evaded, gives the horde 2 on the fast break. The builder warns about it, the horde popup and replay list it, and the box score has a row for it. Play scoring counts it against a play, so the bots avoid it.
  - **Expert bot (Hard / Normal):** 59–8 / 65–9 before, 59–27 / 65–28 after. Smart bot (the four default plays, auto defense): 53–28 / 62–18 before, 60–54 / 63–36 after. Ablation on Hard, each change alone against the expert: Armor-only Protect 60–44, per-goblin ram 59–16, turnovers 59–8 (the expert never turned it over). Choosing the defense well is now worth about 27 points a game.
- **Horde calls as a short list (Nov 21):** the Horde calls panel lists the horde's actions one per row with what each will score, taken from the same projection as the "+N" button, so the numbers follow the play you're building: the ram ("Pound the Gate +3", or "Ram → Gate" under another call), the called strike ("Hexer → Wizard +0"), the Shaman's cast ("Shaman → BARRIER" or PACK), the Chieftain's call, and a turnover's fast break. Tapping a row explains it, e.g. "With three goblins pushing, the ram deals 6 damage to the gate and scores 3 points. The Rogue is pinning one goblin, reducing points by 1." The strip's saving comes from replaying the horde's turn without the strip.
- **Collapsible Horde calls (Nov 21):** the panel's header shows the horde's projected total ("+3") and taps open or closed; collapsed, it's just that line. The choice is remembered. The "+N" button in the scoreboard is gone; its pop-up (the horde's turn and how it scores) opens from "How the horde scores" at the bottom of the open panel.
- **How the horde scores (Nov 21):** the pop-up is now only the rules, written as +2 / +4 / +10 (hit on a hero, takedown, turnover, gate damage, the gate falling, pillage), with no projection of the coming turn; the Horde calls rows already show that. Its link sits in the panel's header beside "HORDE CALLS" while the panel is open.
- **Scoreboard clock (Nov 21):** the quarter reads as a large "Q1" beside its possession pips, with "1 of 12" under the pips; the separate "1 of 12" in the tools row is gone. Each score sits at the inner edge of its half, so the clock is the same distance from both (18px each side).
- **Scoreboard projections (Nov 21):** each side shows its score at the outer edge and, beside the clock, its name (Heroes, Horde) over what it scores if the play you're building runs: "+2" for your possession and "+5" for the horde's turn that follows. The projections hide during replays. The clock is 18px from both labels.
- **Ram panel (Nov 21):** the ram's crew pips are gone from the objectives panel (it now shows the gate, the Shaman bounty and the wagon). The goblin panel has a "🪵 Ram" heading with what the ram hits the gate for and what that scores, e.g. "hits the gate for 6 (3 points)", taken from the same projection as the Horde calls row, so it reflects your play and defense (as the board stands during replays) ("🔥 Pillage" once the gate falls), over the On the ram / Off the ram rows. Its "Finishers score 2…" note is gone (the scoring rules cover it); a Taunt or Block note still appears there when one is up.
- **Compact hero cards (Nov 21):** each card is icon and class name, an HP bar with the number on it in the normal text color over a soft tint, red-tinted under a third ("Bench N" when benched), touches as "🏀 8" (orange at 2 or fewer), and chips: "In play", the defense ("→ Wiz", "→ Hexer", "Heal", "Strip", with the full words on hover and for screen readers) and Armor ("🛡6"). A 🎯 badge marks the hero the horde is aiming at. Player names moved to the hero detail sheet. The row is 88px tall instead of 158, so it fits above the PLAN bar on a 390×844 phone. The builder's and designer's hero pickers use the same name line and vitals.
- **Horde call chains (Nov 21):** the called play's row drops the play's name and reads as helpers passing to an attacker: "Hexer [Hex +3] → **Cutthroat ⚔ Wizard**". Helpers are muted, with their buff in a small tag (Hex +3, Command +3, War Drum +2), like the "+Buff" tags on the builder's slots; the attack is bold with ⚔. A summon (Call the Pack) is now tagged with the caster's id, so the Shaman's row shows "Shaman → PACK" instead of "The horde → PACK".
- **The setup flow (Nov 23):** the prototype now opens with the main game's setup: **Build your roster** (a 2025–26 week, five heroes and 3 reserves under the 180-gold cap, the four auto-draft modes, search, team filter, sort by salary or by class with a "good or better" filter, class chips showing each player's season tier), **Choose your encounter** (every encounter listed; only the Goblin Horde is playable here, the others are marked "Not in this test yet"), **Assign your heroes** (a player per hero with Suggest, swaps between heroes, season tier, rough touches, defense tier and games this week; a player with no game sits out the whole game) and **Pick games** (each game's tier, touches, defense tier, double-double or triple-double special, stat line, and the Champion and goblins it brings; Smart pick and Best tier for each; a preview of the whole horde and the ram). Then the Game plan and the game as before. "Play the sample week" keeps the original fixed week. The choices are remembered between visits.
  - The rules all come from the main game (salaries, season tiers, auto-draft, auto-assign, Smart pick, `buildHorde`), and `prototypes/play-calling/src/setup/buildWeek.ts` turns the choices into the week the engine plays (it rebuilds the fixed week exactly from the same players and games). The page now carries the 2025–26 season, about 1.9 MB.
  - Not carried over, since the prototype is one game rather than a season: chapters and roster moves, gold, ten-day contracts, the Armory and progression, and the main game's difficulty levels (the prototype's Normal and Hard stay on the title screen).
  - **Balance with built rosters** (`ROSTERS=8 npx tsx prototypes/play-calling/scripts/sim.ts`: auto-draft Balance, suggested heroes, Smart pick, weeks 1–8): the expert bot wins 5 of 8 on Normal (average margin +3.8) and 2 of 8 on Hard (−4.4); the smart bot averages +2.1 and −6.9. That's much harder than the sample week (65–28 and 59–27), mainly because cap-built heroes get 24–34 touches a game against the 36 the touch scale was set for (the sample week's stars have more).
  - **Touch scale fix (Nov 23):** the setup screens counted touches at 2.93 true usage per touch (the sample week's calibration) while the game uses 4.7 (the tuning default), so game cards overstated touches by about 60%. They now use the game's scale, and a picked game's touches match the hero card in play. Energy-era pieces still to recalibrate for usage: the touch scale itself, Smart pick and Best tier (they score energy and main-game traits and Fumbles), salaries (priced from class tiers: correlation with usage 0.80, with defense 0.62), and Champion HP.
- **Recalibrated for usage (Nov 23).** Three energy-era pieces are now set for the usage system, measured with the built-roster simulator (`ROSTERS=8 MODES=balance,offense,defense,flexibility npx tsx prototypes/play-calling/scripts/sim.ts`: 32 auto-drafted rosters, weeks 1–8, all four draft modes; `PICKS=main` compares the main game's picks, `PICKW` and `TUNE` try other weights).
  - **Play-calling picks** (`src/setup/picks.ts`, used by the setup screens and the simulator). **Suggest** finds the hero assignment with the best total of class tier, touches and defense, players with a game first. **Smart pick** scores each game on tier, touches, defense and double-double/triple-double, less the Champions (by role and tier), boss and goblins the games bring together. **Most touches for each** replaces "Best tier". Weighing the horde three times heavier than a first guess did best; weighing touches more did worse. Against the main game's energy picks: expert +17.4 vs +8.6 a game on Normal, +5.6 vs +1.4 on Hard.
  - **Touch scale.** Usage per touch is 3.8 (was 4.7): a drafted lineup's picked games total about 136 true usage (median; 116–163 from the 10th to the 90th percentile), so a typical lineup gets about 36 touches (simulated median 38, range 29–50). Saved tuning from before this is dropped, so returning players get the new default.
  - **Champion HP stays at ×1.25.** Swept 1.0–1.55 on built rosters. At 1.25: Normal, the expert wins 27 of 32 (+17.4 a game) and the smart bot (default plays, auto defense) averages +11.7; Hard, the expert wins 21 of 32 (+5.6) and the smart bot +2.0. 1.4 makes Normal tight for casual play (smart +4.8); 1.55 tips Hard into losing (expert −3.7). The sample week, with its high-usage stars, is now easy: 63–25 Normal and 61–29 Hard for the expert.
- **The Crypt, the second encounter (Nov 27).** Chosen in Choose Your Encounter; the horde is built by the main game's rules for the Crypt (`buildHorde(…, 'crypt')`), with skeletons at 1 per 45 opposing points. Same roles as the Goblin Horde, new rules (`content.ts` CRYPT_INFO and CRYPT_PLAYS, the Crypt branches in `engine.ts`):
  - **Fire and holy damage.** Fireball and Meteor are fire. Holy is a Cleric hit or a **Blessed** finisher: any finisher a Cleric pass helped. They destroy the dead for good, touch the Wraith, and holy alone consecrates graves.
  - **Restless Dead.** A weapon kill leaves a **bone pile** that rises next possession with half its HP (9 → 4 → 2, then gone); a skeleton scores its point only when destroyed for good. The Skeletal Archer rises once. The builder says which kills stick ("Destroys 2 of the dead for good") and which don't.
  - **The Ritual** (the objective, in place of the ram and gate): grows each enemy turn by 1 per skeleton and bone pile, +1 while the Wight stands; the horde scores 1 per 4 Ritual points. At 28 it completes: +6, the Lich rises at once (or rises again at half HP, or is restored), and it starts over. Destroying the dead for good sets it back 1, the Necromancer 3. Strip the Ball pins a skeleton away from it; the Warrior can guard the circle (halves the gain).
  - **Wight** (Shaman role): Unholy Vigor feeds the Ritual; casts Raise Dead (every bone pile rises at once at its old HP) or Bone Shield (+2 Armor on the horde through the next possession). The Q1 bounty is the Wight bounty. **Necromancer** (Hexer): Enervate takes a touch and adds 2 to the next hit. **Wraith** (Cutthroat): Intangible (weapon hits pass through, a turnover if that's all the finisher did; a spell or holy hit makes it solid for the possession) and Drain (1 HP from every hero each turn, 2 at Great or better, never the last HP; it heals half). **Bone Giant** (Ogre): Taunt, Armor 3, Bone Harvest (heals 2 when a skeleton crumbles). **Lich** (boss, Q3 or when the Ritual completes): Death Bolt every other turn, 1.5× to the lowest-HP hero ignoring Armor. **Phylactery** (replaces the loot wagon): the Lich takes half damage while it stands; skeletons shield it; breaking it scores 3.
  - **Consecrate the graves:** three open graves each raise a skeleton at the start of every quarter until a holy hit closes them (+3).
  - **UI:** the Ritual meter and the graves and Phylactery in the objectives panel; a Ritual panel with skeletons and bone piles; Horde calls rows for the Ritual, the Wight's cast, Death Bolt and the drain; status chips (Intangible/Solid, Restless, Unholy Vigor, Shielded, Half damage, Holy only); the Crypt's scoring rules; 18 new tappable terms; the Crypt's card and horde preview in setup, with Smart pick weighing the Crypt's horde.
  - **Tuning** (`ROSTERS=8 MODES=balance,offense,defense,flexibility ENC=crypt …/sim.ts`, 32 rosters). First pass: the horde scored 70–130 (Ritual 29–53 points, hits 20–30, hero takedowns 8–16, from drain plus Death Bolt). Changes: Ritual 1 point per 4 (was 2), +6 on completion (was 10), 28 to complete (was 20); drain 1–2 (was 2–4); Death Bolt every other turn even when raised early. Final: Normal, the expert wins 23 of 32 (+10.3 a game) and the smart bot +16.3; Hard, the expert 13 of 32 (−6.7) and the smart bot −0.6. Against the Goblin Horde (+17.4/+11.7 Normal, +5.6/+2.0 Hard) that's slightly harder on average, as the main game rates it. The expert bot does worse than the smart bot here: it chases damage that leaves bone piles, so treat its Crypt numbers as a floor.
- **Sample week by encounter (Nov 27):** the title screen's Sample week panel picks the encounter (Goblin Horde or the Crypt, remembered between visits): the same five heroes and games, with that encounter's horde built from the bundled season (`sampleWeek` in `setup/buildWeek.ts`). The simulator's sample-week mode takes the same choice: `ENC=crypt npx tsx prototypes/play-calling/scripts/sim.ts` (expert 48–70 Normal, 47–85 Hard; smart 61–49, 54–57; the expert bot is a floor in the Crypt).
- **The Crypt, simplified (Nov 27).** One core puzzle (make kills stick with fire or a Blessed finisher, racing the Ritual), and every enemy either feeds it or tests it. Cut: the **Bone Giant** (Taunt, Armor, Bone Harvest) became the **Bone Knight**, a big skeleton that rises once; the **Phylactery**; the Wight's **Bone Shield** (it casts only Raise Dead, when there are piles); the Wraith's **drain** (it keeps Intangible); the **Archer rising** (it keeps Quick); and the **Lich rising again or being restored** (completing the Ritual raises it early the first time, and otherwise just scores). Kept: Restless Dead and bone piles, Blessed, the Ritual, Unholy Vigor and Raise Dead, Enervate, Intangible, Death Bolt, graves.
  - **Re-tuned** (32 built rosters): the cuts made it far too easy (expert +38 a game on Normal, +25 on Hard). The Ritual now scores 1 per 2 points (was 4), completes at 22 (was 28) for +8 (was 6), and the Crypt raises 1 skeleton per 40 opposing points (was 45; now `skeletonPer` in the tuning). Result: Normal, the expert wins 26 of 32 (+13.8 a game) and the smart bot +23.1; Hard, the expert 17 of 32 (−2.4) and the smart bot −3.2. Against the Goblin Horde (+17.4/+11.7 Normal, +5.6/+2.0 Hard), about even on Normal and harder on Hard. On the sample week the expert now beats the smart bot (73–48 Normal, where it lost 48–70 before the cuts), a sign the rules are easier to play well.
- **The Crypt after a playtest (Nov 27).** A Hard sample-week game (67–63) never produced a single bone pile: seven of twelve plays had a Cleric pass, so nearly every finisher was Blessed. The horde's points came mostly from a second-half Ritual flood, driven by the Q3 wave and three never-consecrated graves (9 extra skeletons), with Dark Command and the halftime adjustment on top. (That game ran on saved tuning from before the re-tune; the tuning version now resets saved values when defaults change.) Changes:
  - **Only Guiding Light Blesses.** A finisher it passed to is Guided and, in the Crypt, holy; a Cleric hit is still holy. Holy is now a choice against Empower's Crit or Read's Pierce, so Restless Dead comes into play. The builder confirms "Blessed (Guiding Light)".
  - **The graves are visible:** each grave card says when it next raises a skeleton ("Raises a skeleton in Q2"); Horde calls shows a "🪦 Graves → Q2 +3 💀" row; and the Ritual row's details say what the next quarter adds ("the open graves add 3 skeletons and 5 more arrive").
  - **Halftime in the Crypt** has its own adjustment, "The dead chant louder" (the Ritual grows 1 more a turn, 2 on Hard, when it's below half at halftime); it used to borrow "All hands on the ram".
  - **Re-tuned on both kinds of roster** (sample week and 32 built rosters): 1 skeleton per 37 opposing points (was 40); the Ritual stays at 1 point per 2, 22 to complete, +8. Sample week: Normal expert 71–46, smart 71–51; Hard expert 63–60, smart 67–62 (close, like the playtest). Built rosters: Normal expert 26 of 32 (+15.1), smart +18.7; Hard expert 14 of 32 (−6.8), smart −8.2. About even with the Goblin Horde on Normal, harder on Hard.
- **Play log any time (Nov 27):** a **Log** button on the scoreboard (and Play log in the Menu) opens the game so far with Copy; its header names the encounter, difficulty and score ("after 6 of 12" mid-game, "final" at the end). The possession recap says "Horde +N" instead of "Goblins".
- **Bots that understand the Ritual, and the off-night check (Nov 27).** A 70–42 Hard win built on Hobble → Fireball (six of twelve plays) beat the simulator's prediction by 28: the bots chose plays by what they did that possession and treated a weapon kill like a lasting one. Fire stays: Fireball is the three, and a star shooter carrying the night is the fantasy working.
  - **Play scoring in the Crypt** (`project` in `engine.ts`; also what **Suggest** uses): instead of "crew cleared", it counts what a play does to the Ritual over the next 3 turns: dead that stay down stop feeding it (a bone pile still feeds it, so a weapon kill earns nothing), setbacks now, and closed graves that raise no more skeletons; each Ritual point is worth 1/2 point plus its share of the +8 completion. A 1- or 2-turn look-ahead did worse on the off night.
  - **Built rosters** with the Ritual-aware bots, rules unchanged: Normal, the expert wins 30 of 32 (+18.3), the smart bot +12.0; Hard, the expert 18 of 32 (+0.5), the smart bot −4.8. That's level with the Goblin Horde on Normal (+17.4/+11.7) and slightly harder on Hard (+5.6/+2.0), so no re-tune.
  - **Off-night check** (`OFFNIGHT=wizard`: the sample week's Wizard on a Cold night with 60% of the usage). Goblin Horde, smart bot: 52–47 Normal, 52–49 Hard (the expert bot collapses to 26–88 there, a bot quirk). Crypt: expert 42–82 and 36–92, smart 47–79 and 30–87 (old bots: as bad or worse, up to 38–143). The Crypt without a hot shooter is a different, much harder encounter: nothing else in the kit clears three or four skeletons at once, and adding a Guiding Light play ("Light the Way", Guiding Light → Aimed Shot, now in the library) didn't change it.

- **More ways to win, and three plans per encounter (Nov 27).** Fireball stays as it is; the other heroes got stronger answers instead.
  - **Moves:**
    - **Aimed Shot** is now 18 Pierce, the biggest single hit.
    - **Double Strike** hits two enemies for 10 each and Marks both, to set up takedowns.
    - **Backstab** does 9 damage, and ×2.5 and Sure against a Taunted or Disabled target.
    - **Smite in the Crypt:** holy damage is ×1.5 against the dead, and a kill arcs to the next skeleton, up to 3.
    - **Sanctuary** (8 damage) freezes the horde's objective for this enemy turn and the next, and gives every hero Armor +3.
    - New library plays: Light the Way (Guiding Light → Aimed Shot), Double Team (Screen → Double Strike), Twin Smite (Hobble → Smite) and Holy Flurry (Guiding Light → Flurry).
  - **Plans** (`PLANS` in `content.ts`; `STRATEGY=<id>` in `sim.ts`; `PLAYBOOK=a,b,c,d` tries any book). The first drafts were single-minded, and every one lost on built rosters. A plan that never clears the crew can't stop the ram, and a book that leaves a hero out runs dry and falls back on Isos. Hunt Champions lost 52–81 on the sample week; Decapitation let the Ritual score 143.
  - **The search** (`scripts/books.ts`): the smart bot played every four-play book that uses all five heroes, on the sample week, then the best on 32 built rosters (`EXCLUDE=` leaves plays out; `BENCH=` keeps heroes off the ball). The plans were picked from those results.
  - **Smart bot results** (32 built rosters, average margin, Normal / Hard; the expert bot is in brackets):

    | Encounter | Plan | Margin | Result |
    | --- | --- | --- | --- |
    | Goblin Horde | Default book | +14.7 / +7.4 | |
    | Goblin Horde | Clear the Ram (Kick Out, Shut It Down, Regroup, Twin Smite) | +13.3 / +1.1 (+18.3 / +9.6) | The only good book without Critical Taunt |
    | Goblin Horde | Hunt Champions (Critical Taunt, Kick Out, Shut It Down, Double Team) | +22.3 / +9.9 (+27.2 / +16.3) | |
    | Goblin Horde | Lockdown (Warrior and Rogue only defend) | −7.8 / −21.5 (−2.8 / −16.5) | Defending isn't worth two heroes' touches |
    | Crypt | Default book | +18.3 / +5.8 | |
    | Crypt | Fire Volume (Critical Taunt, Kick Out, Shut It Down, Spread the Floor) | +21.8 / +4.9 (+27.8 / +20.3) | |
    | Crypt | Holy Chain (Critical Taunt, Shut It Down, Twin Smite, Holy Flurry) | +30.8 / +13.6 (+39.8 / +26.0) | Best plan; the Cleric scores 29.5 a game |
    | Crypt | Champion Race (Critical Taunt, Kick Out, Pick and Pop, Double Team) | +18.8 / +3.4 (+26.4 / +18.2) | |

    The best book found in both encounters is Critical Taunt, Kick Out, Shut It Down, Twin Smite: +22.7 / +15.7 in the Goblin Horde and +31.5 / +19.7 in the Crypt.
  - **Cold shooter, answered:** on the sample week with a cold Wizard (smart bot), the default book loses 52–76 on Normal and 50–86 on Hard. Holy Chain wins 56–28 and 56–46.
  - **Open:**
    - Critical Taunt is in five of the six plans. With Backstab ×2.5 against a Taunt, the Rogue scores 22–29 a game in every book that has it.
    - Defending can't yet beat scoring (see Stops score in the backlog).
    - An untended Ritual runs away.
  - The **Play Calling Strategy Tracker** artifact tracks these plans and the ideas to come back to.
- **Stops and fast breaks (Nov 28).** A horde hit still scores a flat +2 if it does any damage. Defense pays off only by holding a hit to nothing, a **stop**, so the player still asks one question per hit: stopped or not. No hero can stop a full hit alone; a stop takes two pieces that fit the situation.
  - **Help Defense:** Protect's Armor is 8 × the Warrior's defense tier (cold 6 … elite 12), up from 4 ×. The Elite Warrior no longer halves the hit, which had made Protect plus Close Out close to a sure stop. A Champion hits for about 15–20, so Protect alone never stops one; with Close Out's half it usually does.
  - **The Steal:** off the ball, the Rogue can steal from a Champion instead of Strip the Ball. The Champion has to be Slowed (Close Out, Slam) or Exposed (Mark, Double Strike, Read), and then it drops out of the horde's play. The setup can come from defense (Close Out) or from offense (a Mark in the play).
  - **Spacing passes Quick:** the finisher dodges the first horde hit that turn.
  - **Fast break:** a stop gives the next finisher Crit (Sure too if it already has Crit).
  - The box score's stops now count stops, credited to the defenders who made them. The defense picker offers Strip or Steal for the Rogue. The glossary adds Stop, Fast break and Steal. `TUNING_VERSION` is 5 (`protectArmor` in the tuning).
  - **Stop rates** (`scripts/stops.ts`, smart bot, default book, 32 built rosters):
    - Goblin Horde: 18% of hits, 2.0 a game, before; 30% and 3.2 a game after.
    - Crypt: 9% before; 13% and 1.6 a game after.
    - Protect alone, Ward alone and Close Out alone: 0%.
    - Protect + Close Out: 86% (Goblin Horde) and 68% (Crypt).
    - A Steal always stops.
    - Ward never contributes. Its Armor (4 ×) plus Close Out doesn't reach 0.

    Protect at 6 lost ground: margins dropped about 8, because removing the Elite halving cost the shooter HP. At 10, Protect + Close Out became a sure stop.
  - **Plans, before → after** (smart bot, Normal / Hard):
    - Goblin Horde:
      - Default book: +14.7 / +7.4 → +15.3 / +9.3.
      - Clear the Ram: +13.3 / +1.1 → +18.2 / +9.3, with 3.7 stops a game.
      - Hunt Champions: +22.3 / +9.9 → +23.5 / +14.8.
      - Lockdown: −7.8 / −21.5 → −1.7 / −12.4. The expert bot goes from −2.8 / −16.5 to +5.5 / −1.9.
    - Crypt:
      - Default book: +18.3 / +5.8 → +22.2 / +7.3.
      - Fire Volume: +21.6 / +7.8.
      - Holy Chain: +31.0 / +13.4.
      - Champion Race: +21.8 / +5.2.

    The expert bot's Goblin Horde margins rose 5–9 a game, so difficulty needs a re-tune before shipping to friends.
- **Ward fixed, and Quick checked (Nov 28).**
  - **Ward** now gives Armor of 8 × the Wizard's defense tier (was 4 ×), the same as Protect. Automatic defense puts it on the horde's target even when the Warrior protects that hero.
  - It still never stops a full hit alone. With Close Out it stops 17% (Goblin Horde) and 20% (Crypt) of hits, and stacked with Protect 30% (Crypt). Sitting the shooter now buys stops.
  - Stops a game: Goblin Horde 3.4, Crypt 2.0.
  - A **Blink** version (Ward makes its ally Quick) was rejected. It is a sure stop from one defender: half of all hits stopped, 5.3 a game.
  - **Spacing's Quick is rare:** smart bot, 32 built rosters, books built around Spacing. The Crypt had 0 dodges, and the Goblin Horde had 14 in 64 games. A Quick finisher is rarely the hero the horde goes after that turn.
  - The horde now has an answer anyway: **Hex** (Enervate in the Crypt) takes a hero's Quick away. That cut the Goblin Horde's 14 dodges to 4. It mirrors the party's own answers to the horde's Quick (a Slow, or a cheap hit first).
  - **Plans** (smart bot, Normal / Hard; expert bot in brackets):

    | Encounter | Plan | Margin |
    | --- | --- | --- |
    | Goblin Horde | Default book | +17.7 / +10.8 (+39.8 / +28.9) |
    | Goblin Horde | Clear the Ram | +21.5 / +12.3 (+27.6 / +21.2) |
    | Goblin Horde | Hunt Champions | +24.8 / +19.4 (+34.0 / +27.9) |
    | Goblin Horde | Lockdown | −1.7 / −11.6 (+5.9 / −1.3) |
    | Crypt | Default book | +23.5 / +11.5 (+46.6 / +36.3) |
    | Crypt | Fire Volume | +23.0 / +9.2 (+33.4 / +23.8) |
    | Crypt | Holy Chain | +39.6 / +20.7 (+47.8 / +31.1) |
    | Crypt | Champion Race | +23.3 / +7.7 (+33.1 / +22.2) |

    Holy Chain gained the most (+9 and +7), because its Wizard is off the ball most possessions. Both encounters are now clearly too easy and need a difficulty re-tune.
- **Difficulty re-tuned (Nov 28).** Target: the smart bot with the default playbook about +12 on Normal and +2 on Hard on the 32 built rosters, as at the last calibration, with the expert bot still winning most games. Horde damage stays as it is, so stop rates hold.
  - Champion HP alone (×1.5) hit that target but squeezed out the books without Critical Taunt: Clear the Ram fell to +8.2 / −15.9. So the tuning splits the pressure between Champion HP and each objective:
    - Champion HP ×1.45 (was 1.25).
    - Gate HP 60 (was 70).
    - In the Crypt, 1 skeleton per 35 opposing points (was 37).
    - Hard stays at ×1.12 on Champions, now `hardMult` in the tuning.
    - `TUNING_VERSION` 6.
  - **Results** (Normal / Hard; expert bot in brackets):

    | Encounter | Plan | Smart bot | Expert bot |
    | --- | --- | --- | --- |
    | Goblin Horde | Default book | +12.6 / +0.8 | +32.1 / +16.7 |
    | Goblin Horde | Hunt Champions | +18.5 / +6.3 | +27.9 / +12.7 |
    | Goblin Horde | Clear the Ram | +10.1 / −7.3 | +17.3 / +1.8 |
    | Goblin Horde | Lockdown | −10.3 / −18.7 | +1.7 / −6.5 |
    | Crypt | Default book | +18.0 / −3.8 | +36.3 / +23.7 |
    | Crypt | Holy Chain | +22.8 / +3.7 | +30.1 / +14.7 |
    | Crypt | Fire Volume | +17.0 / −4.1 | +27.6 / +16.2 |
    | Crypt | Champion Race | +15.9 / −6.7 | +27.1 / +15.8 |
  - **Sample week:**
    - Goblin Horde: expert 65–34 and 58–38, smart 63–49 and 58–44.
    - Crypt: expert 62–18 and 56–66, smart 55–38 and 52–81.
  - **Off night** (cold Wizard):
    - Goblin Horde, smart bot: 50–43 on Normal, 52–78 on Hard.
    - Crypt, default book: 52–56 and 50–126. The Ritual runs away, the open item in the backlog.
    - Crypt, Holy Chain: 62–33 and 56–42, so Holy Chain is still the answer to a cold shooter.
- **Difficulty without extra HP (Nov 28).** Extra Champion HP makes takedowns slower, and takedowns are the fun part. So the horde scores more instead. Three options were compared from the old tuning (Champion HP ×1.25, gate 70, 37 points a skeleton), each tuned toward the same target. Columns are the smart bot's default book, Normal / Hard, then the share of close games (within 8 points) and the party's takedown points a game:

  | Option | Goblin Horde | Crypt |
  | --- | --- | --- |
  | HP re-tune (×1.45, gate 60, 35 a skeleton) | +12.6 / +0.8, 38% close, 28.0 | +18.0 / −3.8, 11% close, 40.9 |
  | **A: the objective's push (+1 each turn the ram hits or the Ritual grows) and Champion hits score 3 on Hard (no extra HP on Hard)** | **+11.3 / +2.9, 44% close, 28.6** | **+14.6 / +0.2, 39% close, 42.7** |
  | B: Champions come back once at half HP | 4 possessions later, with a faster Ritual: +12.2 / −3.4, 14% close | +19.3 / +7.8, 13% close |
  | C: takedowns worth 3 (boss 6) | +13.5 / +6.8, 28% close | +17.6 / +7.9, 20% close |

  - **A is the default now.** It hits the target, has the most close games, and leaves takedowns as fast as before. It also keeps the plans closer: Clear the Ram is +14.0 / +6.3, where the HP re-tune left it at +10.1 / −7.3.
  - **B** is inconsistent. It's much harder in the Goblin Horde, where every returning Champion is another hitter, and easier in the Crypt, where it's more takedowns to score. Its plans scatter.
  - **C** works, but games stay lopsided.
  - Tuning: `pushPoints` 1, `hardHitPoints` 3, `hardMult` 1 (Hard no longer scales Champion HP or damage), `championHp` 1.25, `gateHp` 70, `skeletonPer` 37. `TUNING_VERSION` 7.
  - The scoring explainers, the ram and Ritual projections and the title screen's difficulty note say how it works.
  - **Plans** (Normal / Hard; expert bot in brackets):

    | Encounter | Plan | Margin |
    | --- | --- | --- |
    | Goblin Horde | Default book | +11.3 / +2.9 (+32.5 / +27.5) |
    | Goblin Horde | Clear the Ram | +14.0 / +6.3 (+19.4 / +12.8) |
    | Goblin Horde | Hunt Champions | +17.5 / +10.3 (+27.2 / +22.5) |
    | Goblin Horde | Lockdown | −9.2 / −18.5 (−1.8 / −10.6) |
    | Crypt | Default book | +14.6 / +0.3 (+37.0 / +26.5) |
    | Crypt | Fire Volume | +13.7 / −0.9 (+24.1 / +13.7) |
    | Crypt | Holy Chain | +29.9 / +19.5 (+38.2 / +29.8) |
    | Crypt | Champion Race | +14.5 / +0.2 (+23.8 / +13.0) |

    Holy Chain is the outlier now.
  - **Sample week:**
    - Goblin Horde: expert 67–53 and 67–61, smart 61–56 and 61–67.
    - Crypt: expert 62–29 and 62–36, smart 62–51 and 62–66.
  - **Off night** (cold Wizard):
    - Goblin Horde, smart bot: 60–49 and 60–58.
    - Crypt, default book: 54–90 and 54–96, the runaway Ritual.
    - Crypt, Holy Chain: 62–36 and 62–52.
- **The circle holds six (Nov 28).** The runaway Ritual came from the crowd: every skeleton and bone pile fed it 1 a turn with no limit, so the horde's points grew with the number of dead. On a cold-Wizard night the second-half waves and open graves brought 10 skeletons, the Ritual grew 10 a turn and completed every other turn, and it scored 61 of the horde's 96.
  - Now at most six dead feed the Ritual at once; the rest wait their turn. The Ritual panel says "6 of 10 feeding: the circle holds 6", and the explainers and glossary say the same.
  - To keep the Crypt's pressure, Unholy Vigor is +2 (was +1) and the Crypt raises one skeleton per 33 opposing points (was 37).
  - **Levers kept in the tuning,** for tuning an encounter's difficulty without HP:
    - `ritualCap` (6): the circle's limit.
    - `ritualStep` (0): each completion raises the next threshold. It barely mattered in tests, because the completions follow the crowd.
    - `vigor` (2).
    - `ramCap` (6): the ram's crew limit, the same rule as before, now a lever.
  - **Compared on the built rosters** (smart bot, default book, Normal / Hard), with the off night (sample week, cold Wizard):

    | Option | Built rosters | Off night |
    | --- | --- | --- |
    | No limit | +14.6 / +0.3 | 54–90 / 54–96 |
    | Rising threshold +8 | +14.9 / +0.6 | 54–90 / 54–88 |
    | Limit 6 | +18.1 / +4.4 | 60–71 / 61–84 |
    | Limit 5 | +21.6 / +8.7 | 60–59 / 61–72 |
    | **Limit 6, Vigor +2, a skeleton per 33** | **+14.7 / +1.9** | **60–72 / 58–82** |
  - **Results** (Normal / Hard; expert bot in brackets):
    - Crypt, default book: +15.0 / +2.2 (+32.4 / +21.0).
    - Fire Volume: +12.2 / −1.3 (+17.8 / +8.6).
    - Holy Chain: +23.8 / +13.3 (+31.8 / +24.2), its lead roughly halved.
    - Champion Race: +14.4 / +1.6 (+17.5 / +7.7).
    - The Goblin Horde is unchanged.
    - Sample week, Crypt: expert 62–37 and 62–48, smart 60–53 and 60–64.
    - Off night with Holy Chain: 63–50 and 63–58.

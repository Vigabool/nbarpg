# Play-calling prototype: handoff notes

For a new thread picking up the play-calling prototype (`prototypes/play-calling/`). The design history and every tuning result are in `docs/concept-play-calling.md`; open ideas are in `docs/backlog.md` ("Play-calling prototype: ideas to come back to"). This file holds what those don't: how the user likes to work, where things live, how the numbers are made, and what's unresolved. Current as of Nov 28, 2026.

**Keep this file current.** When work on the prototype changes something recorded here (a link, a convention, the tuning targets or method, the state of play, an open decision, or a rejected option), update this file in the same commit. Change the "Current as of" date when you do.

## Where things live

| What | Where | Notes |
| --- | --- | --- |
| Prototype (the playable page) | https://claude.ai/artifact/MMemEKiBujoQHu4G9GaSbF | Republish to this URL after every change: `node prototypes/play-calling/build.mjs`, then publish `prototypes/play-calling/dist/page.html`. Never make a new artifact. |
| Strategy tracker | https://claude.ai/artifact/Edp1qkTxp68y8mNRUidMYH | A Data (dashboard) artifact. See "Updating the tracker" below. |
| Powers List | https://claude.ai/artifact/PKpiBcAw2HuMB9Q29HdAWr | A Claude Docs doc (project id `PKpiBcAw2HuMB9Q29HdAWr`, body node `3ac78ecb-926e`). Every move, effect, defense, special and the Crypt's rules. The user asked for direct edits, not suggestions. Keep it in step when moves or rules change. |
| Main game's test artifact | https://claude.ai/artifact/2C61RY3DSCSKkhJZ4JKLoN | Main game only (see `CLAUDE.md`); the prototype doesn't touch it. |
| Branches | `possession-prototype`, mirrored to `main` | Commit, `git pull --rebase origin possession-prototype`, push, then `git push origin possession-prototype:main`. Never push `playtest` unless told. |

Commits end with the session trailer the harness gives (Co-Authored-By, Claude-Session). No model names in commits.

## How the user works

- **Asks for recommendations before builds.** "Brainstorm", "what do you think", "review and recommend" means analysis and a recommendation, not code. "Build it", "go ahead" or "let's try it" means build. Lay out options with numbers, and say which you'd pick and why.
- **Playtests and pastes game logs** (from the Log button: `Play Calling prototype · <encounter> · <difficulty> · final A–B`). Analyze them by possession. Say where the horde's points came from (hits, takedowns, objective), what made it easy or hard, and back it with simulator numbers.
- **"Don't change any code" means exactly that.** They want to finish a game first: answer, and hold the fix.
- **Wants numbers.** Every balance change gets before/after margins from the simulator (see "Tuning method"), plus the sample week and usually the cold-Wizard off night.
- **Keep the tracker and the Powers List current** after rule or plan changes, and mention them in the reply.
- Replies: lead with the outcome, a table of results, what to watch, then a one-line offer of the next step.

## Design principles the user has stated

- The game mirrors an NBA game: **a scoring race as much as tactical combat.** Close games are good. A "key stop" in a close game is the fantasy.
- **Several strategies should work in every encounter**, built around a central encounter objective.
- **Offense is the fun part.** Defense should be situational and simple. "Simpler is better": they rejected per-hero defensive effects as one more thing to track.
- **Don't nerf the star.** "Fireball is the three, SGA carrying is right." Support other strategies instead of weakening the strong one.
- **Don't fix difficulty with enemy HP.** Making takedowns slower is less fun. Prefer horde-side scoring (objective pace, hit points on Hard). Lower enemy HP where possible. The Lich is the one accepted exception: the boss fight should take a few plays.
- **Obscure rules get cut.** The halftime double-team was removed because a shot turned over with nothing on screen explaining why. Anything that can cancel a player's action needs a visible reason in the builder or Horde calls.
- They liked these and want to keep them: the Crypt's story (the Necromancer becoming a Lich, the halftime transformation, the phylactery), the Wraith's Wail, Horde calls, and the stop chance badge.

## Tuning method

**Targets:** the smart bot, playing an encounter's suggested playbook on the 32 built rosters, should land near **+12 on Normal and +2 on Hard**. The expert bot should still win most games. Also watch the share of close games (within 8 points; 20–45% is healthy) and whether each plan stays viable.

**Bots.** The *smart* bot plays a four-play book with automatic defense and an Iso when the book runs dry. The *expert* bot plays every saved play plus Isos. Since defense became a count, the expert's defense search has nothing to choose, and it now scores worse than the smart bot on some plans. **Treat the smart bot as the reference.**

**Scripts** (run from the repo root with `npx tsx`):

- `prototypes/play-calling/scripts/books.ts`: the smart bot on the sample week, then the best books on the 32 built rosters. Prints margins, stops, takedown points, close %, and how often the ritual broke.
  - `ENC=crypt`
  - `BOOKS="a,b,c,d;e,f,g,h"` scores given books
  - otherwise it searches every four-play book that uses all five heroes (`TOP=60`, `EXCLUDE=critical-taunt`, `BENCH=warrior,rogue`)
  - `TUNE='{"key":value}'` overrides tuning
- `prototypes/play-calling/scripts/sim.ts`: the sample week, both bots.
  - `ENC=crypt`
  - `STRATEGY=<plan id>` (from `PLANS` in `content.ts`), or `PLAYBOOK=a,b,c,d`
  - `ROSTERS=8 MODES=balance,offense,defense,flexibility` for the built rosters
  - `OFFNIGHT=wizard` for a cold-shooter night
  - `TUNE=…`, `DEBUG=1`, `VERBOSE=1`
- `prototypes/play-calling/scripts/stops.ts`: how often horde hits are stopped, by source. It was written for the per-hero defense; it still runs, but most of its categories no longer apply.
- `prototypes/play-calling/tools/plans.sh`: every plan, both bots, sample week and built rosters, for both encounters (about 15 minutes; run it in the background). Writes to stdout.
- `prototypes/play-calling/tools/tune.sh "<label>" '<tuning JSON>'`: one-line smart-bot check of the Goblin Horde default book and the Crypt's suggested book. Good for sweeping a grid in parallel.
- For one-off questions (score by half, a traced game, a reproduction), write a throwaway script in `prototypes/play-calling/scripts/tmp-*.ts`, run it and delete it. Imports need the repo-relative paths those scripts use.

**Tuning knobs** are `DEFAULT_TUNING` in `prototypes/play-calling/src/engine.ts`. Bump `TUNING_VERSION` in `App.tsx` whenever defaults change, or players' saved tuning overrides them. Most knobs are global across encounters (Champion HP, stop chance). Per-encounter levers:
- Goblin Horde: `ramPer`, `pushPoints`, `gateHp`, `ramCap`, `goblinHp`.
- Crypt: `ritualClock`, `hardClock`, `vigor`, `wardMin`, `skeletonPer`, `lichHp`, `boltMult`, `lichPoints`, `necroBounty`, `phylacteryHp`, `wraithReform`, `wailMult`.

## Updating the tracker

The tracker is a Data-type artifact. Its page and data live in its store, written with the `ArtifactData` tool. Never publish a file to it.

1. Produce `final-gh.txt` and `final-cr.txt` (books.ts output for each plan's book, one line each, with `| takedown pts … | close … | broke …` stripped) and `plans2.txt` (the `plans.sh` output for expert numbers) in a working folder.
2. Edit the plan rows and statuses, and the ideas list, in `prototypes/play-calling/tools/tracker/make.mjs`, then run `node make.mjs <folder>`. It writes `<folder>/tracker/plans.json` and `ideas.json`.
3. Upload both as assets: `Artifact` publish with `url`, `asset: true`.
4. In one `ArtifactData` batch:
   - point `datasets/plans` and `datasets/ideas` `source.url` at the new blobs, and set `updated`
   - if the page text changed, `set` `files/index.html` from `{"text": <index.html>}`
   - pin every write with `if_version`: each store write bumps it, and it was 8 after the last update
5. Delete the previous two blobs (`Artifact` delete with `path` = the asset id).

Status words: Works (ahead on Normal and Hard, Hard ≥ about +6), Thin on Hard, Not working, Expert only, Baseline, Reference.

## State of play (Nov 28)

**Both encounters** use defense by count:
- Each hero off the ball adds 12% × defensive tier to the chance of stopping the horde's called play, capped at 60%, in one seeded roll per possession. Previews show the play "if it lands".
- A stop gives the next finisher Crit (the fast break).
- The objective, the Death Bolt and the Wail can't be stopped.
- Protect, Ward, Close Out, the Steal, Strip the Ball, Triage and Manual defense are gone.

**The Crypt** is the Necromancer's transformation:
- **The ritual** is a flat clock: 3 a turn, 4 on Hard, +1 while the Wight stands, until halftime.
- **The ward:** he can't be hit while 3 or more skeletons stand. The open graves raise one each a turn.
- **An early takedown** breaks the ritual and leaves a Wraith that Wails every turn and re-forms while the phylactery stands.
- **Otherwise** he becomes the Lich at halftime.
- **The phylactery** halves the Lich's damage taken and keeps the Wraith returning. Holy damage only.
- **Suggested plays:** the Crypt has its own (with holy damage), Critical Taunt, Kick Out, Shut It Down, Twin Smite. The general default can't close graves.

**Plans** (`PLANS` in `content.ts`; latest margins are in the tracker):
- Goblin Horde: Clear the Ram, Hunt Champions, Lockdown.
- Crypt: Stop the Ritual, Face the Lich, Fire Volume.

## Unresolved, and decisions still to make

- **Horde halftime adjustments** (backlog item 11). After the double-team was cut, only "Protect the lead", "Dig in" (Champions Armor +1) and the Goblin Horde's "All hands on the ram" remain.
- **Fire Volume in the Crypt** (no holy damage) is now −2.7 / −21.4. Decide whether skipping holy damage should be that costly, or whether fire gets a way past the graves.
- **Lockdown** improved to +1.3 / −13.0 with defense by count. It's still not viable; the user is fine with situational defense over a pure defense plan.
- **Critical Taunt** (Provoke → Empower → Backstab ×2.5) is in most strong books. Flagged and not acted on. Backstab ×2 is the candidate fix.
- **Skeletons after halftime** do nothing once the ritual ends; they may feel like clutter. One idea: they ward the phylactery.
- **Possession time** in playtests is 70–105 seconds on average against a goal of about 20 (backlog item 7).
- **The bots ignore the horde's turn** except through the stop-chance term in `project()` (engine). Their play choice doesn't foresee the horde's hits.

## Rejected options (don't re-propose without new evidence)

- **Grading hits by damage size:** adds a judgment per hit.
- **Champions coming back after a takedown** (difficulty option B): it moves the two encounters in opposite directions.
- **Ward as Blink** (Quick on an ally): one defender guarantees a stop.
- **The Ritual fed by every skeleton:** it ran away. Replaced by the flat clock.
- **The halftime double-team:** too obscure.
- **Difficulty through Champion HP alone:** squeezes out every plan without Critical Taunt.

## Gotchas

- **Edits:** Prettier reflows long lines, so scripted find/replace edits must match the formatted text. Read the lines first.
- **The roll:** the seed comes from the week index, encounter and difficulty. Only `finishLive(l, defense, { preview: true })` and `runPossession(..., { preview: true })` skip it. The builder's horde preview must pass `preview: true`, or it would reveal the roll.
- **Browser checks** (Playwright, `executablePath: '/opt/pw-browsers/chromium'`, 390×844):
  - The Plan screen's objectives sit under its **Horde** tab.
  - A finisher with Split asks for extra targets and needs **Done**.
  - The warded Necromancer's card is disabled while aiming.
- **Effects:** `useEffect(() => { … })` with braces (`CLAUDE.md`). The Wraith (`kind: 'wraith'`) is created at runtime by `takedown()` and doesn't exist until then.

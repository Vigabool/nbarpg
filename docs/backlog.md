# Backlog

Planned work, roughly in priority order. Each item says why it matters, what to build, and when it's done. Design details live in [design-doc.md](design-doc.md); balance numbers come from the simulators (`npm run data:simulate`, `npm run data:season`, `--smart` / `--smart-bot` for the lookahead bot).

## 1. Code health before new encounters ✅ Done

Encounter rules are now mechanic modules in `src/engine/encounters/` ([guide](adding-an-encounter.md)), and the battle screen is split into `src/ui/battle/`. CI runs the type-check, Prettier, tests, the build and the golden baseline. Saves are versioned, with step-by-step migrations and Save file / Import. Simulator results are unchanged.


**Why.** Each encounter's mechanics (Restless Dead, the hoard and the sleeping Dragon, Topple, Phylactery, Molten Hide…) are special cases woven through `src/engine/combat.ts` (about 1,500 lines). `src/ui/BattleScreen.tsx` is about 1,100 lines. Every new encounter makes both harder to change safely.

**What.**
- **Encounter modules:** move each encounter's rules into its own module (for example `src/engine/encounters/crypt.ts`) that plugs into a small set of hooks: on hit, on death, round start and end, enemy turn, special, targeting. Core combat calls the hooks instead of checking encounter twists inline.
- **Split the battle screen:** break `BattleScreen.tsx` into its parts (enemy cards, hero rows, action sheet, detail sheet, threat callout).
- **CI:** add a GitHub Actions workflow that runs `tsc -b`, `vitest` and `npm run build` on every push and pull request.
- **Formatting:** add Prettier with a check step in CI, and reformat once (BattleScreen currently fails the check).
- **Save versioning:** give saves an explicit version number with step-by-step migrations, replacing the ad hoc `migrateSave`. Add export and import of a save, so progress survives browser resets.

**Done when.**
- Adding an encounter means one new module plus data, with no edits to core combat.
- CI is green on the branch.
- Saves from the current version load through a migration test.
- Simulator results are unchanged after the refactor (same seeds, same win rates).

## Before friends playtest ✅ Shipped

Getting the game ready for outside testers, in this order.

1. **Crash safety net ✅ Done.** Any error, while drawing a screen or from a button, shows an error screen instead of a blank page. It offers Try again, Restart this week's battle, Copy error report (build, run position, stack), Download save file, and Start a new run. Each build carries a label (commit and date) for reports.
2. **A link friends can open ✅ Set up.** Pushing to the `playtest` branch deploys to https://vigabool.github.io/nbarpg/ (`.github/workflows/pages.yml`). It needs Pages enabled once, with Source: GitHub Actions, and `playtest` allowed under Settings → Environments → github-pages → Deployment branches. First shipped to friends at build dfec572. The title screen shows the build label.
3. **Normal difficulty ✅ Done.** It's the default for new runs; the heuristic bot wins about 60% in every encounter.
4. **Weekly encounter choice ✅ Done (interim).** **Choose your encounter** is now the first step of each week, and players may pick any encounter. Weekly offers come with the season structure (item 2 below).
5. **First-battle walkthrough ✅ Done.** Coach marks in the first battle, one-time banners on the setup screens, and How to play split from a reference Guide (see the design doc's Onboarding section).
6. **Landing-damage warning and feat tags ✅ Done** (items 4 and 6 below).
7. **A full chapter on a phone:** play the exact build you'll share before sending it.

## Live season (2026–27)

**Why.** Live results powering battles is the most compelling way to play, so the current season becomes the default mode. Today the app loads one finished season and rates players on whole-season averages, which look ahead in a replay and are empty early in a live season. Design: the design doc's Live season section.

**Built (data feed).** The form window (`src/data/form.ts`: last 15 regular-season games before the week, topped up from the prior season), with ratings fixed at each chapter's first week; players short of 15 games across both seasons (rookies included) can't be signed for now; the CDN fetcher (`scripts/fetch-cdn.ts`) and the Monday **Refresh season data** workflow; the build makes every season in `data/raw/` and a `seasons.json` list; the title screen opens on the live season with older seasons as replays; unfinished weeks stay locked. 2025–26 has no prior season in the repo, so it keeps whole-season averages and the golden baseline is unchanged.

**Still to do.**
1. **Turn on the schedule:** GitHub only runs schedules from the default branch, so the workflow file needs to be on `main` (or `milestones-1-3` made the default).
2. **First real fetch:** confirm the CDN answers GitHub's servers (the workflow's first run), then check the 2026–27 build: weeks, players, eligible pool.
3. **Ship to friends:** decide how the weekly data reaches `playtest` (the workflow pushes to `milestones-1-3` only; a deploy needs a push to `playtest`).
4. **Measure the prior season:** fetch 2024–25 locally to test how well last season predicts this one, and to give 2025–26 replays form windows too (this changes the golden baseline).
5. **Simulators on the live season:** the season simulator still rates players on whole-season averages; switch it to form views before tuning on 2026–27.
6. **Recalibration:** after 6–8 weeks, `npm run data:calibrate` on 2026–27; adopt at a chapter boundary if the tier mix moved.

**Done when.**
- A new run starts in the latest finished week of 2026–27, and the next week unlocks on its own after the refresh.
- No rating anywhere uses a game from the week being played or later.
- The simulators and golden baseline still run on 2025–26, unchanged.

**Decide during live testing.** Roster moves beyond ten-day contracts and cap raises: releasing a player at any time (not only between chapters), signing replacements mid-chapter, and what a release costs. See Gold, phase 2. Also whether excluded rookies should be signable after all (by draft slot; see the design doc).

## 2. Season structure and encounter use

**Why.** The encounter is still a "Testing:" dropdown, and the season simply stops when the data runs out. The pieces (encounters, chapters, progression, Smart pick) need a frame that makes a season feel like a campaign.

**What.**
- **Weekly encounter choice:** each week offers two encounters, with previews of the traits, boss and Fumbles each would bring with the chosen games. Each offer carries slightly different PP rewards, so picking the encounter becomes part of the strategy alongside game selection. Remove the testing dropdown (keep a dev toggle).
- **Encounter rotation:** decide how offers are drawn, for example never the same encounter three weeks running, and harder pairings in later chapters.
- **Season arc:** chapters of 4 weeks (already in place), ending in a playoffs finale: a "Champion's Gauntlet" of every boss across consecutive battles.
- **Season score:** a summary when the season ends (record, bosses defeated, PP earned, best week).
- **End-of-week recap:** a highlight line such as "Best play: the Wizard's Fireball cleared wave 1".

**Done when.**
- A full season can be played start to finish without the testing dropdown.
- The finale and the season summary exist.
- The season simulator plays the new structure, choosing encounters by a simple policy, and win rates by chapter stay near target.

## 3. Difficulty setting ✅ Done

Normal and Hard shipped (see the design doc's Difficulty section). Normal scales Champions and bosses per encounter, tuned so the heuristic bot wins about 60%.


**Why.** Encounters are now tuned so the smart (lookahead) bot, standing in for a strong player, wins about 75%. Casual play, represented by the heuristic bot, wins much less: Goblin Horde 48%, Crypt 23%, Dragon's Lair 47%, Giant's Hall 66%, and about 43% over a season with Smart pick. One difficulty can't serve both kinds of player.

**What.**
- **Normal and Hard:** chosen at New game, changeable between chapters.
- **Hard:** today's numbers (smart bot about 75%).
- **Normal:** a second set of per-encounter levers (Champion `statScale`, boss HP, the Lair's ambush multiplier, chapter scaling) tuned so the heuristic bot wins about 60%.
- **Storage:** keep both sets as data (for example `difficulty` blocks in `encounters.json` and `progression.json`) and select by the save's difficulty.
- **Visibility:** show the difficulty on the pick-games screen and in the season summary.

**Done when.**
- Both settings are selectable.
- The simulators accept `--difficulty` and confirm the targets: Normal about 60% for the heuristic bot, Hard about 75% for the smart bot.
- The Crypt's gap between casual and skilled play is checked separately. It's the most skill-dependent encounter, so it may need its own Normal levers.

## 4. Landing damage in the fall warning ✅ Done

When one more hit this turn could topple a giant, the topple bar turns red and names who its landing would drop ("⛰️ 22/25 ☠ · landing drops the Wizard"). Those heroes get a ⛰️☠ tag. Last Stand heroes are safe.


**Why.** A toppled giant deals 2 damage to every hero as it lands, and this happens during your own turn. The ☠ fall prediction only previews the enemy turn, so a hero at 1–2 HP can drop from your own topple with no warning.

**What.**
- **Topple bar warning:** when the next hit would topple a giant, show whether the landing would drop anyone (for example "⛰️ 31/34 · landing drops the Wizard").
- **Hero row:** mark heroes at or below the crash damage with the ☠ marker while a topple is possible this turn.

**Done when.** A test covers the warning, and the battle screen shows it.

## 5. Respec in the Armory ✅ Done (free)

Shipped free rather than for a fee: each hero's Armory has a Respec that refunds everything they bought (weapon and shield levels, gear, feats) in full (two taps). The How to play Progression tab and the Glossary explain it.


**Why.** Purchases are permanent. Players change over the season, and a build that fit one player may not fit the next, so permanent choices discourage experimenting with feats.

**What.**
- **Reset button:** a "Reset feats" button per hero in the Armory that refunds feat PP for a fee, for example 10% of the refund or a flat 50 PP.
- **Scope:** weapon and shield levels and gear stay permanent; only feats respec.
- **Confirmation:** the reset uses the same two-tap confirmation as buying.

**Done when.** Respec works and is covered by Armory tests, and the How to play Progression tab explains it.

## 6. Feat tags on hero rows ✅ Done

Hero rows show owned gear and passive feats with their Armory icons; tap one to explain it. A used Shadow Cloak dims. The log credits feats and gear where they change a result: "(+3 Smite)", "(+3 Opportunist)", "(+1 Quick Draw)", "(+2 Amulet of Healing)", "(Blessed Ward)".


**Why.** Passive feats (Cleave, Intercept, Opportunist, Smite, Arcane Surge, Evocation, Blessed Ward, Quick Draw) are invisible in battle. It's easy to forget you own them, or to miss why a hit was bigger than expected.

**What.**
- **Tags:** small tags on each hero row for owned feats and stat-changing gear, using their Armory icons, for example 🪓 Cleave and 🔮 Focus Crystal.
- **Explanations:** tapping a tag explains it, using the same Tag component as other hero tags.
- **Log credit:** where a feat changes a result, credit it in the log, for example "+3 Opportunist" or "cleaves 4 into…".

**Done when.** Every passive feat and gear effect is visible on the hero row and credited in the log where it fires.

## Gold, phase 2

**Why.** Phase 1 shipped gold: earning, ten-day contracts and cap room (see the design doc's Gold section). More sinks give gold real tradeoffs.

**What.**
- **Roster spots:** a 9th and a 10th spot at escalating prices (for example 40 and 80 gold), capped at 10.
- **Extra roster moves:** a signing outside the between-chapters window, at a price that rises each time.
- **Release any time:** drop a player mid-chapter to free a roster spot and cap room, which matters more in a live season (injuries, slumps, breakout free agents). Decide the cost (none, gold, or a lost move) during live testing.
- **Quartermaster consumables:** single-use battle items bought with gold, such as a Healing Potion, a Scroll of Fireball, a Smoke Bomb or War Paint.
- **Simulator:** let the season simulator make roster moves, so cap room can be weighed against rentals.

## Broader test: feedback and logging

For a wider test beyond close friends, who send feedback by text.

- **Feedback button:** captures the note plus context (build, week, encounter, round, and optionally the save). On an artifact the page can store it in a shared database; on GitHub Pages it would open a prefilled form.
- **Opt-in result logging:** encounter, outcome, rounds and difficulty per battle, to measure real players' win rates against the bots' estimates.

## Later / parked

- **New encounters:** the Colosseum (crowd favor) and the Twilight Court (bargains and illusions). Build them after item 1.
- **Stat affinities:** from the original progression plan, a way to widen which players fit a class.
- **More feats:** three feats per class, or a choice between two feats at each tier, for real build diversity.
- **Cleric heals cure poison:** a clean counter to Dirty Arrows.
- **Fumble chip:** if mis-taps continue, show only the count on enemy cards and spend from the detail sheet.
- **Flurry in the Giant's Hall:** replacing Venom Strike with Flurry raised the smart bot's chapter-1 Hall win rate from 76% to 83.5% (over a season 65% → 75%, on target). If playtests find early Hall battles too easy, raise Flurry's cost to 5 or drop it to G − 2 (see the design doc's Rogue section).
- **Smart pick refit:** rerun `npm run data:fit-picks` after big rules changes, and consider fitting with the smart bot.

# NBA Fantasy RPG

A single-player tactical fantasy RPG where each of five heroes is powered by a real NBA player. A player's box score fills that hero's resource pool for one battle; the real opponents' performances build the monster horde. Design: [docs/design-doc.md](docs/design-doc.md).

This branch covers milestones 1–3: the data layer and calibration, the combat engine, and the playable loop (salary-cap roster → weekly hero assignment → game selection → battle → rewards).

## Getting started

```bash
npm install
```

### 1. Get the season data

**The live season** comes from the NBA's public CDN. The **Refresh season data** workflow fetches it every Monday and commits `data/raw/<season>.json`; to fetch by hand:

```bash
npx tsx scripts/fetch-cdn.ts            # the current season's finished games → data/raw/2026-27.json
```

**A finished season** comes from stats.nba.com, which blocks most cloud servers, so it's downloaded on your own computer and committed:

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r scripts/requirements.txt
python3 scripts/fetch_gamelogs.py --season 2025-26
git add data/raw/2025-26.json && git commit -m "Add 2025-26 game logs"
```

### 2. Build, calibrate, play

```bash
npm run data:build        # every data/raw/<season>.json → public/data/ (what the app loads), plus seasons.json
npm run data:calibrate    # writes docs/calibration-2025-26.md; add -- --apply to update tier thresholds
npm run data:simulate     # auto-plays battles and reports win rate, battle length, pool sizes
npm run dev               # http://localhost:5173
```

No real data yet? `npm run data:synthetic && npm run data:build -- --raw data/synthetic/2025-26.json` builds an obviously fake season so you can click around. The app shows a banner whenever it's running on synthetic data, and calibration refuses to `--apply` from it.

### Publishing a test build

`npm run build:artifact` builds `dist-artifact/` (fixed file names, page body only) for publishing as a private claude.ai artifact. It runs on whatever `public/data/` holds, so run `npm run data:build` first.

### Tests

```bash
npm test          # engine tests (vitest)
npm run build     # type-check + production build
```

## Project layout

| Path | What's there |
| --- | --- |
| `src/rules/*.json` | **All tunable rules**: tiers and pools, classes and abilities, monsters, horde and mirrors, salaries, PP values, calibration settings. Tuning is a data edit. |
| `src/rules/index.ts` | Types for the rule files. |
| `src/data/` | Season data types, raw-log ingestion, and the compact file format. |
| `src/engine/` | Pure game logic: `rating` (Rating → tier → pool, salaries, gear), `horde` (mirrors, Warlord, goblins, waves), `combat` (deterministic battle state machine), `rewards`, `calibration`, `autoplay` (baseline bot). |
| `src/engine/encounters/` | Each encounter's rules as mechanics that plug into combat's hooks (see [Adding an encounter](docs/adding-an-encounter.md)). |
| `src/app/` | Save-game state and the storage boundary (localStorage now, accounts later). |
| `src/ui/` | React screens. |
| `scripts/` | Data fetch (Python), build, calibration and simulation. |
| `tests/` | Engine tests and the synthetic season fixture. |

Ability effects are composed from a small set of primitives (`damage`, `poison`, `heal`, `taunt`, `summon`, …) declared in `classes.json`, so new abilities and talent tweaks mostly need no code.

## Playtest site

Friends play the build on the `playtest` branch at https://vigabool.github.io/nbarpg/. Pushing to that branch deploys it (`.github/workflows/pages.yml`); other branches never change what testers see:

```bash
git push origin HEAD:playtest
```

The title screen shows the build (commit and date), so reports can name it.

Before and after a refactor, `npm run check:golden` replays a fixed set of battles and seasons and fails if any result changes.

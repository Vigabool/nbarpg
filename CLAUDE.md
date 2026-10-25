# Working on NBA Fantasy RPG

- **Checks before committing:** `npx tsc -b`, `npx vitest run`, `npm run format:check`, and `npm run check:golden` (battle results must not change unless the change is meant to; re-record with `-- --update` only then).
- **Artifact:** after each change, `npm run build:artifact` and republish `dist-artifact/page.html` (with `assets/app.js`, `assets/index.css`, `data/2025-26.json`).
- **Docs:** keep `docs/design-doc.md` and `docs/backlog.md` current.
- **UI changes: check the teaching material too.** How to play and the Guide show the game, so a UI change can make them wrong:
  - **Sample turn** (`src/ui/SampleTurn.tsx`) draws with the real battle components (`EnemyCard`, `GoblinStack`, `HeroRow`), so it follows battle-screen changes automatically. Still read its step text (`src/ui/sampleTurnScript.ts`) against what the board now shows, and screenshot the steps.
  - **Coach tips** (`src/ui/coachTips.ts`) point at `data-coach="…"` elements; `tests/coachTargets.test.ts` fails if one disappears. Check that tip wording still matches the UI.
  - **Basics cards, Glossary and setup banners** describe the UI in words: update them when a control, icon or flow they mention changes.
- **New content starts at the top.** `App` scrolls the page to the top whenever the screen (phase) or week changes. Inside a pop-up, when a tab, class or enemy picker swaps the content, use `useScrollToTop(key)` from `src/ui/scroll.ts` on the modal body. Exception: a picker in the middle of a page (the Progression tab's class picker) keeps its place.

# GROK_TASK_3: phone layout and Turkish leftovers (from the phone QA)

Lead: Claude. Written 15 Nov 2026, 05:15. Branch `hackathon`. Read `AGENTS.md`, `qa/grok2/PHONE_QA.md` (your own phone QA report) and `GROK_RESULT.md` first.

## Objective

Fix these findings from `qa/grok2/PHONE_QA.md`, at 390x844 and 360x740, in EN and TR:

- **#1:** the site page's action row is 814 px wide. Walk, Drive and "Tam analiz" are past the right edge. It must wrap or scroll inside the panel, with every action reachable.
- **#2:** Advanced on a phone puts Decide, Workshop, the film button (14 px wide; Workshop intercepts its clicks) and EN/TR past the frame.
  - The Simple-mode phone nav was fixed earlier (in `space.css`, the `@media (max-width: 760px)` block at the end).
  - Extend that block so the Advanced bar fits too, for example by hiding the text labels on Decide and Workshop and keeping their icons with `aria-label`s.
- **#5:** Ask Luna (`.luna-fab`) covers the goal chips, a result card and the sunlight legend. On phones, make it a small round icon button. Keep it clear of content: reserve bottom padding in the page, or move it.
- **#6:** the live strip under the nav is cut at the right edge, and "LIVE" stays English in TR. Make the sun and Earth lines fit, or let them cycle, and translate the tag.
- **#7:** the place title is still split with the last word big ("SW rim of" / "Shoemaker" is fine; check the whole-Moon cards and the Turkish order "krater kenarı, GB" / "Shoemaker").
  - You changed this in Grok task 1. Re-check on the current code, and fix what is still wrong on the site page and the whole-Moon cards.
- **#8:** fix the Turkish leftovers in your files:
  - the calendar sentence "Yeşil: GO.";
  - the site stat "0 Wh" (keep the unit, but check the wording around it);
  - the "E" longitude suffix: Turkish uses "D" for doğu, so "18.52°D";
  - the interview summary "12000 Wh" (thousands separator: "12.000 Wh");
  - the sunlight Play `aria-label`;
  - the Sources close control ("Close" → "Kapat");
  - Luna's voice, send and language-group `aria-label`s.
  - The film and drive strings belong to Codex; leave them.
- **#10:** the Advanced results table cuts the date column at 390 px. Let the table scroll horizontally inside its card, or shorten the date format on phones.

## Files you own (only edit these)

- `web/src/App.tsx`: everything except the film block, `{film && (() => {`, and the `mission-film-open` effect near the top. Codex changed those; leave them.
- `web/src/space.css`: everything except the "mission film" rules (`.film*`, `html.mission-film-open`).
- `web/src/index.css`
- `web/src/components/SiteProfile.tsx`, `SiteCard.tsx`, `SiteExtras.tsx`, `SimpleView.tsx`, `Luna.tsx`, `SourcesPage.tsx`, `MissionInterview.tsx`, `ScopeTarget.tsx`, `TradeOff.tsx`, `MissionBar.tsx`
- `web/src/places.ts`, `web/src/i18n*`, any NEW file, and the tests for these

**Do not edit:** `Drive.tsx`, `MissionFilm.tsx`, `FilmScenes.tsx`, `FilmHud.tsx`, `LaunchScene.tsx`, `Globe.tsx`, `HeroMoon.tsx`, `MissionStory.tsx`, `Models.tsx`, `VehicleModels.tsx`, `Terrain.tsx`, `HorizonView.tsx`, `filmProfile.ts`, `missionPlayback.ts`, `story.ts`, `motion3d.ts`, `*-fix.css`. Codex is rewriting the 3D animations in those right now. Also leave alone `PhoneApp.tsx` and the `phone*` files (another agent), and every `*_TASK*.md`.

## Rules

- No git commands. No installs. No downloads.
- EN and TR for every string.

## Required checks (in `web/`)

- `npx tsc -b`
- `npx vitest run` (428 tests now)
- `npx eslint` on the changed files
- `npx vite build`
- Then re-measure #1, #2, #5, #6 and #10 with Playwright at 390x844 and 360x740 (dev server on 5174; start it with `npx vite --port 5174` if it is down). Put the scripts and screenshots in `qa/grok3/`.

## Report

Write `GROK_RESULT_3.md`: per finding fixed / partly / not, file:line, the measured evidence, and the check results.

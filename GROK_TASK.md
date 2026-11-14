# GROK_TASK: QA fixes for text, Turkish and data labels

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md`, `HANDOFF.md` and `qa/QA_REPORT_2026-11-15.md` first.
The app is in `web/` (Vite + React 19 + TypeScript).

## Objective

Fix QA findings 10, 11, 12, 13, 15 and 16:

1. **Finding 10: CLPS chip year.**
   - Griffin Mission 1's chip says 2026, but clicking it searches 2027-02-01. CP-12's chip says 2026 and searches 2027-06-01.
   - Expected: the year on the chip is the year of the window that is searched.
   - If the real mission date is before the ephemeris start (2026-11-01), say so honestly on the chip. For example: "2026 (searched from Feb 2027: the data starts Nov 2026)", in EN and TR.
2. **Finding 11: the ephemeris has three names.**
   - The ticker says `JPL DE421`. The judges card says `JPL DE440`. Sources says `JPL DE440 / DE421`.
   - Check what the code really uses (`scripts/`, `lunanav/`, `web/public/data/manifest.json`) and use the same correct name everywhere.
3. **Finding 12: Turkish still shows English.**
   - On the site page: percent formatting (Turkish puts the sign first: `%53`), `h` for hours (Turkish uses `sa`), the `GO` badge and "mid-2025".
   - In the PDF report from `App.tsx`: `100%`, `0 h`, `GO` and ISO dates while the screen shows "10 Eyl 2027".
   - In Advanced: science target names ("Artemis III: Haworth", "Peak near Cabeus B").
   - Expected: Turkish text and number formats everywhere in TR. Keep GO / NO-GO as `UYGUN` / `UYGUN DEĞİL` if the app already has those words somewhere; reuse them.
4. **Finding 13: place title split on the last word.**
   - "39.4 km NE of Sla / ... rim": the bold part of a site title must be the place name, not just its last word. See `020-en-desk-site.png`.
5. **Finding 15: the "Just a safe landing" hero shows an Artemis site.**
   - The caption reads "Artemis III: Malapert Massif / Real LOLA terrain · 60 km across", but the result is Shoemaker.
   - Expected: the caption matches the goal, or it says plainly that it is an example terrain.
6. **Finding 16: the judges card says "9 Artemis III candidate regions compared".**
   - Two of them (Nobile Rim 2, Peak Near Cabeus B) are north of the 84.5°S polar grid and only say "outside".
   - Either compare them on the whole-Moon grid, or make the judges line honest: "9 regions; 7 on the 2 km polar grid, 2 outside it". Do this in EN and TR.

## Files Grok owns (only edit these)

`web/src/App.tsx`, `web/src/components/SimpleView.tsx`, `web/src/components/SiteProfile.tsx`, `web/src/components/SiteCard.tsx`,
`web/src/components/ProbabilityPanel.tsx`, `web/src/components/SourcesPage.tsx`, `web/src/components/JudgesPage.tsx`,
`web/src/components/Artemis.tsx`, `web/src/clps.ts`, `web/src/scienceSites.ts`, `web/src/places.ts`, `web/src/i18n.ts` (if it exists), and their tests.

Do **not** edit these (Codex owns them now): `Drive.tsx`, `GuidedTour.tsx`, `MissionFilm.tsx`, `FilmHud.tsx`, `FilmScenes.tsx`, `LaunchScene.tsx`,
`CODEX_TASK.md`, `CODEX_RESULT.md`. Also leave alone `PhoneApp.tsx`, the `phone*` files, `space.css` and `index.css`.

## Acceptance criteria

- Every finding above is fixed or honestly reported as not fixed.
- Tests prove the logic where it is pure (number formatting, the CLPS year, title split).
- No new dependencies. No downloads. No git commands. EN + TR for every string.

## Required checks (in `web/`)

- `npx tsc -b`
- `npx vitest run` (393 tests now, all must pass)
- `npx eslint <changed files>`
- `npx vite build`

## Report

Write `GROK_RESULT.md` at the repo root: per finding fixed / partly / not, file:line, and evidence; plus the check results.

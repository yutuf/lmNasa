# CODEX_TASK_2: make the first load fast

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md`, `HANDOFF.md` and the "Live-site problems" section of `TODO.md` first.
Another Codex run works on `CODEX_TASK.md` at the same time, and Grok works on `GROK_TASK.md`. Stay out of their files (listed below).

## Objective

The live site (https://lunanav-theta.vercel.app) downloads about 25 MB before it is usable, at 0.3–0.5 MB/s on the owner's line.
Users see "loading NASA data…" for a long time, and sometimes the page looks broken. Make the first useful screen appear fast,
and make every data file smaller on the wire, without changing any numbers the app computes.

Data files are in `web/public/data/`. The largest:

| File | Size |
|---|---|
| `global_dem.bin` | 8.3 MB |
| `psr.bin` | 6.4 MB |
| `thermal.bin` | 4.8 MB |
| `ephem.bin` | 4.7 MB |
| `pole_dem.bin` | 4.6 MB |
| `atlas.bin` | 4.1 MB |
| `global_atlas.bin` | 3.3 MB |
| `moon_albedo.jpg` | 2.8 MB |

The start-up path is in `web/src/App.tsx` around lines 265–300: `atlas.bin`, `ephem.bin`, `dsn.bin`, then `hazard.bin`, `science.bin`.

1. **Measure first.**
   - Does Vercel already compress `.bin` responses? Run `curl -sI -H "Accept-Encoding: br, gzip" https://lunanav-theta.vercel.app/data/atlas.bin` and look at `content-encoding`.
   - How small do the files get with gzip and with brotli?
   - Which files are fetched before the first useful screen? Use a production build (`npx vite build`, `npx vite preview --port 4173`) and Playwright's network log.
2. **Shrink the wire size.**
   - Pick the approach that works on Vercel static hosting. For example: serve with a content type that Vercel compresses (set in `web/vercel.json`), or write pre-compressed `.bin.gz` copies at build time and inflate them with `DecompressionStream('gzip')` in a single loader.
   - Whatever you pick must also work in `vite dev` and `vite preview`, and in the service worker (`web/public/sw.js`).
3. **Load less up front.**
   - Things the first screen does not need must load later, on demand: `psr.bin`, `thermal.bin`, `pole_dem.bin`, `global_dem.bin` and the big textures.
   - Several are already lazy. Confirm each with the network log.
4. **Show the page shell while data loads**, not a blank "loading" screen, if that can be done inside your files. If it needs `App.tsx`, write the exact change in your report instead.

## Files Codex #2 owns (only edit these)

- `web/src/data.ts`, `web/vercel.json`, `web/vite.config.ts`, `web/public/sw.js`
- `web/src/siteExtras.ts`, `web/src/siteRender.ts`, `web/src/components/HistoryPanel.tsx`
- NEW files: for example `web/src/loadData.ts`, a build script under `web/scripts/`, and their tests
- `web/package.json` scripts only, with no new dependencies

**Do not edit** `web/src/App.tsx` (Grok owns it) or `web/src/components/Drive.tsx` (Codex #1 owns it). Those files also call `fetch(dataUrl(...))`.
If they need changes, put a precise patch in your report (file, old line, new line) and Claude will apply it later.
Also leave alone: `GuidedTour.tsx`, `MissionFilm.tsx`, `FilmHud.tsx`, `FilmScenes.tsx`, `LaunchScene.tsx`, `SimpleView.tsx`, `SiteProfile.tsx`,
`SiteCard.tsx`, `ProbabilityPanel.tsx`, `SourcesPage.tsx`, `JudgesPage.tsx`, `Artemis.tsx`, `clps.ts`, `scienceSites.ts`, `places.ts`,
`PhoneApp.tsx`, the `phone*` files, `space.css` and `index.css`.

## Acceptance criteria

- The bytes transferred before the first results card renders (production preview, cold cache) are measured before and after, and are clearly lower.
- No computed value changes: all tests pass, including the parity tests against the Python reference.
- Works in `vite dev`, `vite preview` and the service worker, with a cold cache and with a warm one.
- No new npm dependencies. No downloads beyond the `curl -I` headers check. Do not commit or push.

## Required checks (in `web/`)

- `npx tsc -b`
- `npx vitest run` (all pass)
- `npx eslint <changed files>`
- `npx vite build`
- a Playwright before/after network measurement. Use `..\.venv\Scripts\python` with `p.chromium.launch(channel="msedge")` and save the numbers in the report.

## Report

Write `CODEX_RESULT_2.md` at the repo root:

- the measurements before and after;
- what changed (file:line);
- the exact patches still needed in `App.tsx` / `Drive.tsx`;
- the check results.

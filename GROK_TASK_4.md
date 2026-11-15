# GROK_TASK_4: mount the site timeline and the coordinate search

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md` first.
Two finished, tested components were built earlier (by Grok) but never shown in the app. Wire them in.

## 1. `SiteTimeline` on the site page

- **Files:** `web/src/components/SiteTimeline.tsx`, `web/src/siteTimeline.ts` (+ test), `web/src/timeline.css`.
- **Props:** `{ ctx: SiteCtx; s: CardSite; lang: Lang; onPickDate?: (isoDate: string) => void }`. It uses the same `ctx` as `SiteExtras`.
- **It shows:**
  - countdowns after touchdown (Sun sets in…, Earth sets in…), plus a "right now" mode;
  - a 0–10-day launch-slip strip with GO/NO-GO and the reason;
  - the nearest GO dates as chips.
- **Mount** it in `web/src/components/SiteProfile.tsx`, next to `SiteExtras`, using the same `ctx`. Lazy-load it the way the other heavy panels are.
- **`onPickDate`:** a chip should move the search to that date. Change the start date the way the date control in `App.tsx` does, and re-run. If that is not clean, leave `onPickDate` unset and the chips plain.

## 2. `CoordinateSearch` on the Simple page

- **Files:** `web/src/components/CoordinateSearch.tsx`, `web/src/pinSite.ts` (+ test), `web/src/pin.css`.
- **Props:** `{ lang: 'en' | 'tr'; onGo: (lat: number, lon: number) => void }`.
- **Helpers** in `pinSite.ts`:
  - `parseCoords`;
  - `pickAtlas(lat)`: the south-pole 2 km grid below 84.5°S, the whole-Moon grid elsewhere;
  - `nearestPoint(atlas, lat, lon)`: returns `{ index, distKm }`.
- **Mount** it in `web/src/components/SimpleView.tsx`, near the goal/target picker, so someone can type "Shackleton rim" coordinates or click an example chip.
- **`onGo` in `App.tsx`:**
  1. Pick the grid with `pickAtlas`. If it is the whole Moon, load it via `ensureMoon()`.
  2. Find the nearest grid point.
  3. Evaluate that one point for the current mission settings, the way the Artemis comparison does (`searchPoint(atlas, eph, dsn, index, q, c)`).
  4. Open its site page, the same page a result card opens.
  5. Show the honest note when the nearest grid point is far away ("nearest grid point is 12 km away").
  6. If the point fails the slope or terrain checks, say why instead of failing silently.

## Files you own (only these)

- `App.tsx`: not the film block (`{film && (() => {` and the `mission-film-open` effect).
- `SiteProfile.tsx`, `SimpleView.tsx`
- The six component, logic and CSS files listed in sections 1 and 2.
- `space.css`: not the mission-film rules.
- New tests.

**Do not edit** the 3D and film files Codex is rewriting: `Drive.tsx`, `MissionFilm.tsx`, `FilmScenes.tsx`, `FilmHud.tsx`, `LaunchScene.tsx`, `Globe.tsx`, `HeroMoon.tsx`, `MissionStory.tsx`, `Models.tsx`, `VehicleModels.tsx`, `Terrain.tsx`, `HorizonView.tsx`, `filmProfile.ts`, `missionPlayback.ts`, `story.ts`, `motion3d.ts`, `*-fix.css`.
Also leave alone `PhoneApp.tsx`, the `phone*` files and every `*_TASK*.md`.

## Rules

- No git commands. No installs.
- EN and TR for every string.
- Keep the honesty rules: polar-only checks are labelled, and this is not a landing certification.

## Checks (in `web/`)

- `npx tsc -b`
- `npx vitest run`
- `npx eslint` on the changed files
- `npx vite build`
- **Playwright** (dev server on 5174):
  - open a site page and screenshot the timeline;
  - type `-89.9, 0` and `0.67, 23.47` (Apollo 11) into the coordinate search, and screenshot the site page each one opens, at 1440x900 and 390x844.
  - Save the screenshots to `qa/grok4/`.

## Report

Write `GROK_RESULT_4.md`: what you mounted and where (file:line), the screenshots, and the check results.

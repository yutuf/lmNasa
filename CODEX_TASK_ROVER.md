# Codex task: rover, moonwalk and route cameras must work everywhere (AdaptLab web app)

The owner: "her yerde her şekilde rover ve space walk kullanabilmeliyim" (rover and moonwalk must work everywhere,
from every entry point). They also reported: the route cameras are broken, and the rover cannot be used.

Repo: this folder. Web app in `web/` (Vite + React 19 + TS + three.js / R3F). A dev server is already running at
http://localhost:5173 (do not start another; if it is down, run `npm run dev` in `web/` in the background).

## Already done by Claude (uncommitted, in the working tree; finish and verify it, do not throw it away)

1. `web/src/components/RouteFlight.tsx`: the Chase and From-the-site route cameras (Advanced -> map -> Route) now loop
   over lunar orbit, descent and landing instead of the 4.5-day transfer (they showed black space). Verified once.
2. `web/src/components/Drive.tsx`: manual rover driving looked frozen (Pragyan's real top speed is 1 cm/s). While the
   driver holds the throttle, time runs at `max(warp, round(2.5 / maxSpeed))` so the rover covers ~2.5 m per screen
   second; the clock, Sun and battery follow the same time; the HUD shows "time while driving ×N". NOT verified yet.
3. Whole-Moon terrain for the drive view, NOT verified yet:
   - `web/src/localDem.ts` (new): `localDem(xs, ys)` builds a 160 km x 160 km, 200 m grid around a site off the polar
     grid from `global_dem.bin` (bicubic) plus deterministic synthetic small craters / roughness, in the same `Dem`
     format as `pole_dem.bin`; `setDriveFrame` / `latLonAt` handle the south-polar stereographic scale factor so the
     drive view measures true metres around the site.
   - `web/src/terrain.ts`: `localSky` and `horizonProfile` use `latLonAt`.
   - `web/src/siteRender.ts`: uses the shared global DEM loader from `localDem.ts`.
   - `Drive.tsx`: if the start point is outside `pole_dem.bin`, it uses `localDem`, no PSR / thermal / 5 m patches, and
     the HUD reads "LOLA ~3.8 km terrain · finer detail synthetic".

## Files you own

`web/src/components/Drive.tsx`, `web/src/components/RouteFlight.tsx`, `web/src/terrain.ts`, `web/src/localDem.ts`,
`web/src/siteRender.ts`, `web/src/driveTerrain.worker.ts`, `web/src/surfaceMesh.ts`, and in `web/src/App.tsx` /
`web/src/components/SimpleView.tsx` / `web/src/components/SiteProfile.tsx` ONLY the pole-only gates listed below.
Do not touch the presentation or live-session files (`Present.tsx`, `LiveSession.tsx`, `LiveJoin.tsx`, `live.ts`,
`present.css`, `live.css`). Git: `git status` and `git diff` only. Do not commit, do not push.

## Do

1. Verify and fix items 1-3 above.
2. Remove the pole-only gates so rover / lander / moonwalk open everywhere:
   - `SimpleView.tsx`: the "Drive ..." button is `disabled={scope !== 'pole'}` and its note says pole only.
   - `App.tsx` `watchLanding`: whole-Moon results open the route map instead of the landing view.
   - `App.tsx` MissionFilm props: `touchdown`, `rover`, `onWalk` are `null` unless `atlas.kind === 'pole'`.
   - Check `SiteProfile.tsx` buttons (Stand on the lander / Walk / Drive) work for whole-Moon sites.
3. Optional if cheap: after the mission film has been opened once, switching Simple <-> Advanced logs a React
   "removeChild ... not a child of this node" page error (drei `<Html>` label roots in `Globe.tsx` / `RouteFlight.tsx`).
   Find the cause and fix it, or explain it in the result file.

## Acceptance (check each, with screenshots under `qa/rover/`)

- South pole (default, `http://localhost:5173/#ui=simple`): "Drive ..." under the results opens the rover; holding W
  for 3 s visibly moves it (several metres on screen, HUD distance grows, the time-speed note shows); A/D steer; C
  switches to the mast camera and back; P plans a route; the lander view and "Walk on the Moon" work.
- Whole Moon (`#ui=simple&scope=moon`): the same three modes open at the top site, terrain is visible and lit (not black,
  not NaN, not a flat plane), the HUD shows the synthetic-detail label, driving works.
- Also one northern-hemisphere site and one near the equator (open a site from the results or use the coordinate
  search), so the scale factor is exercised.
- Advanced -> Route: Overview, Chase, Pilot, From the site all show something meaningful.
- The mission film still plays from launch to the rover at a south-pole site, and now also has its touchdown / rover
  scenes at a whole-Moon site.
- No page errors in the console for these flows (log them in the result if any remain).
- `cd web && npx tsc -b` clean, `npm test` passes (461+ tests). Add a unit test for `localDem` (grid size, true-metre
  spacing via `latLonAt`, heights finite) and for `planeScale`.

Write `CODEX_RESULT_ROVER.md` (English): what you changed per file, what you verified and how, screenshots list, and
anything left broken.

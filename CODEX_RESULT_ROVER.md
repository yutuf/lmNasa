# Rover task result

Implemented and verified the rover, lander, moonwalk and route-camera changes within the assigned files. The normal South pole and Whole Moon flows work. Two existing issues remain outside the permitted edits, detailed below; the console-error acceptance criterion is therefore not fully met.

## Scope and git

- Read `HANDOFF.md` first, then `CODEX_TASK_ROVER.md`.
- Preserved and completed Claude's uncommitted work.
- Stayed on `hackathon`. Used only `git status` and `git diff` (including `--check`). No commit, push, merge or branch operation.
- Did not modify presentation, live-session, model, secret, raw-data or other agents' files. No third-party downloads and no additional dev server.
- Application changes are confined to the owned files and the specified gates in `App.tsx` / `SimpleView.tsx`. Added the explicitly requested unit-test file and QA evidence under `qa/rover/`.

## Changes per file

- `web/src/localDem.ts`: retained the new shared global LOLA loader, bilinear/bicubic sampling, deterministic synthetic relief, 801 × 801 local grid covering 160 km, and stereographic scale/frame helpers. Exported the frame type so the worker receives the same frame.
- `web/src/terrain.ts`: retained frame-aware coordinates for sky and horizon calculations.
- `web/src/siteRender.ts`: retained the shared global DEM loader/sampler instead of a duplicate implementation.
- `web/src/components/Drive.tsx`: retained whole-Moon terrain selection and manual-driving time acceleration, including the bilingual ×N HUD note. Passed the local frame to terrain preparation. Bounded texture UVs to prevent precision loss/streaks at northern coordinates. Replaced asynchronous shader compilation that could outlive an exited scene with compilation while the scene is live. Added honest EN/TR coarse/synthetic terrain and unavailable polar-layer wording. Without an ice target, P now plans a useful 600 m exploration route instead of a route back to the current parking position.
- `web/src/driveTerrain.worker.ts`: installs the serialized drive frame before computing mesh lighting.
- `web/src/surfaceMesh.ts`: uses frame-aware coordinates for sunlight and bounded UVs for northern texture detail.
- `web/src/components/RouteFlight.tsx`: retained the Chase loop over lunar orbit, descent and landing. Changed From the site to loop over descent and landing: a stationary site camera cannot see the far side of the parking orbit through the Moon. Overview and Pilot retain the full route.
- `web/src/components/SimpleView.tsx`: removed the pole-only disabled gate and replaced the pole-only note with bilingual driving instructions and terrain disclosure.
- `web/src/App.tsx`: changed only the requested gates. Watch the landing opens the landing view for either scope; mission-film touchdown, rover and walk callbacks are available for either scope.
- `web/src/localDem.test.ts`: seven tests covering grid dimensions, finite sampled heights, deterministic relief, `planeScale`, 200 m great-circle spacing through `latLonAt` at southern/equatorial/northern latitudes, and restoring the polar frame.
- `SiteProfile.tsx`: inspected, left unchanged. Its four action buttons are already ungated; verified them at northern and equatorial sites with Whole Moon selected.

## Verification

Used the existing `http://localhost:5173` server with Playwright and Microsoft Edge, at 1600 × 1000. Waited for surface readiness before measuring movement. Inspected the saved screenshots visually.

- South pole, Simple: Pragyan moved from 0 to about 8 m while W was held for 3 seconds; HUD showed `time while driving ×250`. A and D changed heading, C switched to mast and back, P produced a 2.46 km route. Lander view and moonwalk worked; walking for 3 seconds covered about 4 m.
- Whole Moon, Simple: the top site near Simpelius B opened all three modes, with lit, textured relief and the `LOLA ~3.8 km terrain · finer detail synthetic` label. W covered about 8 m in 3 seconds; steering/cameras worked. P produced a 0.64 km exploration route. Moonwalk covered about 4 m.
- Northern coordinate `45, 20`, with Whole Moon selected: snapped to 44.500° N, 19.61° E. Drive, Stand on the lander, Walk on the Moon and Watch the landing all opened correctly. Driving covered about 7 m and walking about 4 m.
- Equatorial coordinate `0, 20`, with Whole Moon selected: snapped to 0.500° S, 19.50° E. The same four site actions worked, with about 7 m driven and 4 m walked.
- Advanced Route: inspected Overview, Chase, Pilot and From the site. Each showed meaningful route/terrain/vehicle content; the site camera showed descent above the horizon.
- Both scope films played continuously through Mission, Launch, To the Moon, Descent, Touchdown, On the surface and Verdict. The surface shots showed Pragyan driving, including the whole-Moon film.
- Turkish Whole Moon drive: verified readable terrain disclosure, unavailable-layer wording and `sürerken zaman ×250`; driving covered about 8 m.
- Exited twice during surface preparation: no page errors or console errors in the final Simple-flow run. The earlier shader-program `isReady` error did not recur.
- `web/`: `npx.cmd tsc -b` passed; `npm.cmd test` passed **468 tests in 43 files**. `.cmd` avoids this machine's PowerShell restriction on `npx.ps1` / `npm.ps1`.
- Root: `.venv/Scripts/python.exe -m pytest -q` passed **110 tests**, with 12 existing warnings. Python application code was not changed; Python QA helpers were added.
- `git diff --check` passed, apart from git's informational LF/CRLF notices.

Reproduction helpers: `qa/rover/flows.py` (full requested flows), `simple-final.py`, `cameras-film.py`, and `edgecases.py`. Evidence/logs: `simple-results.json`, `results.json`, `extended4.log`, `edgecases.json`, `tests.log`, and `pytest.log`.

## Screenshot list

All paths below are relative to `qa/rover/`.

- South pole controls: `pole-before.png`, `pole-driving.png`, `pole-steer-left.png`, `pole-mast.png`, `pole-route.png`, `pole-lander.png`, `pole-walk.png`.
- Whole Moon controls: `moon-before.png`, `moon-driving.png`, `moon-steer-left.png`, `moon-mast.png`, `moon-route.png`, `moon-lander.png`, `moon-walk.png`, `moon-driving-tr.png`.
- Northern site: `north-rover.png`, `north-lander.png`, `north-walk.png`, `north-landing.png`.
- Equatorial site: `equator-rover.png`, `equator-lander.png`, `equator-walk.png`, `equator-landing.png`.
- Route cameras: `route-overview.png`, `route-chase.png`, `route-pilot.png`, `route-site.png`.
- South-pole film: `pole-film-mission.png`, `pole-film-launch.png`, `pole-film-to-the-moon.png`, `pole-film-descent.png`, `pole-film-touchdown.png`, `pole-film-on-the-surface.png`, `pole-film-verdict.png`.
- Whole-Moon film: `moon-film-mission.png`, `moon-film-launch.png`, `moon-film-to-the-moon.png`, `moon-film-descent.png`, `moon-film-touchdown.png`, `moon-film-on-the-surface.png`, `moon-film-verdict.png`.

## Still broken / ownership limits

1. **Film followed by Simple ↔ Advanced switching:** reproduced in both scopes. The final camera/film log contains six `removeChild` page errors and 48 React synchronous-root-unmount console messages across the repeated switches. The film itself plays through to Verdict. This is consistent with drei `<Html>`'s independent React DOM roots and synchronous cleanup during parent/root teardown; its installed implementation unconditionally removes its captured DOM child and unmounts another root from a layout-effect cleanup. Normal-map Earth/pin/selected-point labels remain in `Globe.tsx`. Film labels are already disabled. Fixing the shared label ownership/lifecycle needs changes outside the assigned files, so `Globe.tsx` and dependencies were left untouched. Exact stacks/messages are in `qa/rover/results.json`.

2. **Cross-scope coordinate entry:** while South pole remains selected, enter `45, 20`, then click the profile's Drive button. The profile correctly resolves a whole-Moon cell, but App pins that cell index into the still-polar atlas; the normal App render then throws `Cannot read properties of undefined (reading 'toFixed')`, before Drive can open. This needs an atlas/scope-aware pin/detail fix in App's coordinate and selection state, beyond the specifically permitted pole-gate edits. Workaround: select Whole Moon before entering northern/equatorial coordinates. The required northern/equatorial checks above used that scope and passed. Details are in `qa/rover/edgecases.json`; `cross-scope-diagnostic.png` records the failure and is diagnostic evidence, not a successful screenshot.

The universal “every entry point” goal therefore has this remaining coordinate-state exception. Whole-Moon terrain remains coarse LOLA with synthetic finer relief, not a landing certification or a measured small-scale hazard map.

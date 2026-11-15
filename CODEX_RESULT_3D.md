# LunaNav 3D result — 15 November 2026

## Audit and scope

The original audit is [qa/codex3d/AUDIT.md](qa/codex3d/AUDIT.md). Its main defects were disconnected animation/HUD clocks, inappropriate braking attitudes, floating vehicle bounds and static wheels, unsafe camera/collision paths, showroom lighting, hidden surface rendering during 2D inserts, and a surface HUD that obscured its own controls. These are addressed in the owned components and new helpers below.

Only the task-owned existing files and new implementation/QA files were edited. App.tsx, space.css, index.css, SiteProfile, SiteCard, SiteExtras, SimpleView, Luna, SourcesPage, and the other agents' files were left alone, including their concurrent changes. The existing short default film cut is preserved; QA also enables the supported `technical` prop at runtime to exercise all eleven scenes without changing App.tsx. HorizonView's static direction diagram was inspected and retained.

No git commands were used. Existing checked-in models and textures were reused; no models, textures or dependencies were added to the repository. **Execution exception:** one preview command accidentally ran from the repo root; npx fetched Vite 8.3.8 into the external npm cache before failing to locate the preview directory. The attempt was stopped and corrected to the installed Vite 6.4.6 in web/. No repository dependency files were changed. All reported builds/checks use the repository installation.

## Owner feedback

1. **05 / Descent:** the film now forces a slightly elevated three-quarter chase shot, keeping the lander, approaching Moon and black sky together. The model follows the selected lander. The edge-on trajectory line is hidden in the film view, and the duplicate route HUD was removed. The single film HUD and animation share the same clock and nominal approach. `RouteFlight.tsx:16`, `FilmHud.tsx:120`, `MissionFilm.tsx:278`.
2. **06 / Landing:** a surface shot waits for terrain, both decoded/fitted vehicles and their shader compilation. A loading image and bilingual preparation message cover preparation; this time does not spend the landing shot. The camera holds a roughly quarter-frame lander at touchdown. The scene label, subtitles, progress/controls and independent altitude/range bar remain above the Canvas for the whole shot. Sun direction remains the real ephemeris direction; film exposure and faint fill were increased for readability. The engine cuts off at contact and dust settles. `Drive.tsx:628`, `Drive.tsx:701`, `Drive.tsx:1175`, `MissionFilm.tsx:115`, `MissionFilm.tsx:342`, `film-fix.css`.
3. **09 / Rover:** the old cinematic path could wait for a long interactive ice route, retain completed/depleted state between plays, or move imperceptibly at Pragyan's real 1 cm/s. Each scene visit now resets its state and follows a deterministic, terrain-checked short departure at a visible, labelled time multiplier. This is explicitly an illustrative departure, not an ice expedition. On-screen EN/TR text explains depleted battery, shadow/battery operation, excessive slope, unavailable route and completion. Two deliberate close/lower shots replace camera travel through the vehicle. Pragyan's saturated blue cell texture is now dark silicon; its authored cell grid and metal frame remain. `Drive.tsx:271`, `Drive.tsx:376`, `Drive.tsx:1200`, `filmSurfaceRoute.ts:5`, `Models.tsx:49`.
4. **11 / Verdict:** one flat block in the site's team colour, an outlined GO/UYGUN or NO-GO/UYGUN DEĞİL, a bold site name, landing date and four computed numbers: sunlight, Earth contact, longest darkness and simulated success (three if probability is absent). No extra results or invented data. The site/title/window/ellipse/odds film backgrounds are flat too; inherited film gradients and verdict glow are overridden in the owned film stylesheet. Phone site cards now fit their viewport and avoid a redundant overlay. `MissionFilm.tsx:305`, `film-fix.css`.

**Verification:** `qa/codex3d/owner-feedback/measurements.json` records six chronological frames per scene at 1440×900 and 390×844. Every tested film-control centre received its hit; all landing overlays remained visible and within viewport bounds. Five separate rover plays per viewport all moved continuously: desktop deltas **8.38, 8.59, 8.61, 8.60, 8.57 m**; phone **8.53, 8.32, 8.52, 8.54, 8.56 m**, measured between the first and sixth samples. Zero page errors. Later framing/loading refinements are covered again by the final complete sequence.

Owner review frames: `qa/codex3d/owner-feedback/{desktop,phone}-en-{descent,landing,verdict}-1-01.png` through `06.png`; rover uses plays `1` through `5`. Final current frames are in `qa/codex3d/after-release/` (paths below).

**Hero restoration:** the later owner request supersedes the audit's proposed visual simplification. HeroMoon now restores the live hero's original Sun sprite size, Earth halo, lighting, surface motion and Earth rotation. Existing off-screen/overlay pausing and shader-check suppression remain. The settings were read from the owner's deployed application at https://lunanav-theta.vercel.app/ without git. `HeroMoon.tsx:54`; final evidence `after-release/{desktop,phone}-hero-01.png` through `06.png`.

## Changes by scene and mode

- **Title:** retained the patch, computed mission/date and selected vehicle; flat backdrop and phone wrapping. `MissionFilm.tsx:237`, `FilmHud.tsx:24`, `film-fix.css`.
- **Launch:** continuous Kennedy surface ascent → gradual pitch → parking orbit → tangent TLI; acceleration-aligned attitude and local-down exhaust; deliberate responsive framing. Earth lighting uses a dated approximate Sun direction, explicitly labelled. `LaunchScene.tsx:25`, `motion3d.ts:40`, `motion3d.ts:53`.
- **Window:** retained computed date flags and honest missing-day-data behaviour; Turkish verdict labels; flat background. `FilmScenes.tsx:98`.
- **Coast:** new Earth-centred sketch intercepts a prograde moving Moon at its future limb; the final burn is retrograde insertion. One shared film clock drives the trajectory and nominal readout. The 4.5-day nominal interval, time compression and unequal visual scales remain explicit. `TransferScene.tsx:60`, `motion3d.ts:75`, `MissionFilm.tsx:270`.
- **Orbital descent:** retrograde braking transitions toward local vertical. Sampled route position and HUD altitude/range follow the shared nominal profile. With a surface shot, the handoff is 1.6 km altitude, 2.4 km range and T−180 s, rather than reaching zero then jumping upward. `RouteFlight.tsx:16`, `motion3d.ts:11`, `FilmHud.tsx:120`, `missionPlayback.ts`.
- **Final approach:** a monotonic 180-second illustrative approach, played faster and labelled; correct braking tilt, short soft additive plume along local down, taper near terrain, engine-off touchdown, dust only below 30 m and then settling. Terrain-normal lander contact samples the footprint; the invented bouncing hard-landing motion/speed were removed. `Drive.tsx:701`, `Drive.tsx:1040`, `motion3d.ts:21`.
- **Site / ellipse / odds:** preserve the computed metrics and schematic distinctions. Hidden ground scenes stop rendering through these inserts. The phone site board fits in two columns. `MissionFilm.tsx:287`, `FilmScenes.tsx:160`, `FilmScenes.tsx:219`, `Drive.tsx:369`, `film-fix.css`.
- **Standalone landing:** terrain-relative altitude readout; altitude-dependent camera elevation makes the kilometre-high approach visibly high on a phone; exterior touchdown hold with an explicit Enter the lander action. `Drive.tsx:365`, `Drive.tsx:1175`.
- **Manual rover / autopilot / walk:** terrain-normal bodies, signed wheel travel and steering, swept lander collision tests, ground/lander camera exclusion, and a readable three-quarter chase angle. The original interactive sunlit ice-route planner remains distinct from the film's short departure. `Drive.tsx:769`, `Drive.tsx:958`, `Drive.tsx:971`, `Drive.tsx:1250`, `modelRig.ts:135`.
- **Route cameras / LRO / designed satellite:** time-based camera easing, reusable frame vectors, retrograde descent attitude, deliberate loop-reset cut. Satellite framing fits the whole real-altitude ellipse on both aspect ratios, with far plane/control limits sized to apoapsis; misleading nearby Earth/Sun disks and result pins are excluded from that workshop sketch. Marker enlargement and 12-second revolution compression are labelled. `Globe.tsx:111`, `Globe.tsx:235`, `Globe.tsx:267`, `RouteFlight.tsx:16`, `orbit-fix.css`.
- **Models:** cloned instance materials avoid cross-renderer contamination; rough lunar surfaces replace room reflections. Precise fitted bounds and removal of disconnected decorative specks prevent Pragyan/Yutu floating. Existing fused meshes get compact wheel geometry with circumference-based spin, differential turning and steering. `Models.tsx:49`, `modelRig.ts:28`, `modelRig.ts:68`, `VehicleModels.tsx:14`.
- **Scale:** measured fitted bounds in `model-checks.json`: Vikram 2.00 m high, Apollo 7.00 m, HLS 50.00 m, VIPER visual proxy 1.50 m; Pragyan 0.919 m long / 0.814 m high, Yutu 1.502 m long, LRV 3.10 m long. The existing Perseverance-for-VIPER proxy is retained and fitted to the intended height; fallback landers use the selected lander's height.
- **Lighting / terrain:** real Sun and Earth positions; one hard Sun, faint Earth contribution, black sky, no showroom environment. Fixed the Three.js unrolled-light shader token so ridge occlusion shades only sunlight. A tight 180 m shadow area at 2048 resolution improves contact and rendering cost. Static terrain relief exaggeration no longer tilts the ephemeris light. `Drive.tsx:1275`, `Drive.tsx:1489`, `Terrain.tsx:21`.
- **Performance / readiness:** terrain meshes and initial sunlight sampling run in a worker; typed buffers are transferred, the following rover mesh is prepared early, and real vehicle shaders compile before the loading gate opens. Frame vectors/matrices and dust buffers are reused; sky conditions refresh by elapsed time/distance. `driveTerrain.worker.ts`, `surfaceMesh.ts:16`, `Drive.tsx:628`, `Drive.tsx:646`.
- **HUD / Turkish:** fit-content right panel above the mesh; pointer capture and raised/relocated stick; metres below 1 km; days `g`, hours `sa`, UYGUN/UYGUN DEĞİL, G01, and localized Play/other aria labels. Story controls are localized too. `Drive.tsx:511`, `drive-fix.css`, `FilmHud.tsx:76`, `FilmScenes.tsx:98`, `MissionFilm.tsx:350`, `MissionStory.tsx:114`.

## Frames and performance

All frame sequences use the repository virtualenv, Playwright Edge and `--use-angle=d3d11 --ignore-gpu-blocklist`. Desktop is 1440×900; phone is a 390×844 viewport on the same computer, not a physical-phone GPU measurement. Each mode has six chronological frames. FPS is requestAnimationFrame callbacks over four seconds; it measures browser responsiveness, not an independent GPU-throughput benchmark.

Before: `qa/codex3d/before/`. Final: `qa/codex3d/after-release/`. For each prefix below, frames are `01.png` through `06.png`, preceded by `desktop-` or `phone-`:

- `hero-`
- `film-{title,launch,window,coast,descent,landing,site,ellipse,rover,odds,verdict}-`
- `route-{overview,chase,pilot,site}-`
- `{landing,rover,walk,autopilot,orbiter,satellite-elfo}-`

Example pairs: `before/phone-film-launch-01.png` → `after-release/phone-film-launch-01.png`; `before/desktop-film-descent-04.png` → `after-release/desktop-film-descent-04.png`; `before/phone-rover-06.png` → `after-release/phone-rover-06.png`. Settled standalone touchdowns additionally use `{desktop,phone}-touchdown-settled.png`.

| Scene / mode | Desktop before | Desktop after | Phone before | Phone after |
|---|---:|---:|---:|---:|
| Hero | 41.6 | 165.0 | 163.0 | 164.9 |
| Film: title | 149.7 | 162.3 | 164.9 | 163.5 |
| Film: launch | 93.1 | 164.8 | 163.4 | 164.7 |
| Film: window | 162.6 | 164.8 | 164.9 | 164.9 |
| Film: coast | 163.9 | 155.9 | 164.4 | 154.9 |
| Film: descent | 94.1 | 146.8 | 165.0 | 153.6 |
| Film: landing | 33.6 | 68.1 | 123.6 | 146.0 |
| Film: site | 44.9 | 165.0 | 55.0 | 164.9 |
| Film: ellipse | 60.2 | 164.9 | 90.0 | 164.8 |
| Film: rover | 54.6 | 65.5 | 56.4 | 147.5 |
| Film: odds | 164.0 | 164.6 | 97.7 | 164.9 |
| Film: verdict | 164.7 | 164.8 | 151.7 | 164.9 |
| Route: overview | 164.9 | 126.7 | 152.4 | 165.0 |
| Standalone landing | 54.8 | 59.5 | 50.4 | 145.4 |
| Manual rover | 39.6 | 59.4 | 34.8 | 132.1 |
| Walk | 70.2 | 88.1 | 52.1 | 164.9 |
| LRO | 59.8 | 164.9 | 140.2 | 164.9 |
| Route: chase | 161.8 | 162.9 | 155.7 | 164.8 |
| Route: pilot | 94.7 | 164.9 | 156.8 | 164.9 |
| Route: from site | 62.9 | 161.5 | 155.4 | 165.0 |
| Autopilot | 26.1 | 60.6 | 33.1 | 132.1 |
| Satellite: elliptical orbit | 37.3 | 164.9 | 91.9 | 164.9 |

FPS, rounded to one decimal. Raw primary windows and frame references: `qa/codex3d/after-release/metrics-all.json`; before values: the three `before/metrics-*.json` files; comparison CSV: `after-release/fps.csv`.

**Performance qualification:** 43 of the 44 primary windows meet the 90% threshold. Desktop route overview's first post-film transition window was **126.7 fps**, versus 164.9 before (76.8%). Three repeated isolated route-entry windows were **164.9, 164.9, 164.9 fps**; median **164.9**, meeting the threshold. These repeats are in `after-release/route-rechecks.json` with screenshots. The initial transition dip is retained rather than substituted away; this is the remaining startup-performance caveat. The comparable steady rendering and every other mode meet the target. Scene startup/asset work is distinct from sustained rendering, and this shared repository also includes other agents' changes, so gains cannot all be attributed to one component.


## Verification

- `npx.cmd tsc -b`: passed.
- `npx.cmd vitest run`: **39 files, 434 tests passed**. This includes motion continuity, monotonic braking/touchdown, orbital-to-surface telemetry handoff, prograde intercept, Sun direction, swept collisions, wheel travel/reverse/pivot, mesh cleanup, worker mesh calculations and repeatable/blocked film paths.
- `npx.cmd eslint` on every changed/new TypeScript/TSX file: passed, **zero errors and warnings** after correcting the readiness-effect ref cleanup. CSS was checked by the production build and rendered viewport/hit tests.
- `npx.cmd vite build`: passed with the normal large-chunk advisory. The same build was also frozen under `qa/codex3d/production-final/` so other agents' builds could not replace the preview being tested. Preview: port 4173.
- Root `.venv\Scripts\python.exe -m pytest -q`: **110 passed**, 12 existing rasterio PendingDeprecationWarnings; no Python application/science files were changed.
- `check_models.py`: all four rover rigs have nonempty compact wheel parts, measured one-second angular change equals signed travel/radius, no oversized suspension triangles in wheel bounds; all three landers fitted correctly. Seven model screenshots and `model-checks.json`; zero page errors.
- `phone_check.py`: EN/TR at **390×844 and 360×740**. Actual stick centre hits and drags move Pragyan **1.64 / 1.63 / 1.63 / 1.65 m**; every surface HUD button hit passes; launch is visible; paused descent Canvas screenshots are identical; Turkish film controls read Oynat, Sonraki, Seslendir, Kapat. Evidence: `qa/codex3d/phone-checks/measurements.json` and corresponding PNGs.
- `check_surface_state.py`, repeated after the final readiness change: EN/TR touchdown position is identical across the settled interval; lander-up dot terrain-normal is essentially **1.0**; camera ground clearance **2.91 m**. All actual WebGL programs link, GL error **0**, and `checkShaderErrors` stays false. Forced depleted-battery film stops show the correct EN/TR reason. Current site action centres also receive real pointer hits. Evidence: `qa/codex3d/surface-state.json`, `{en,tr}-settled-contact.png`, `{en,tr}-film-battery-stop.png`.
- Owner feedback five-play results and overlay hit/bounds checks are recorded above. Intermediate QA results are retained separately under `after-complete/`, including a deliberately direct/cold scene-seeking run; final full-sequence measurements use `after-release/`.

## Limits and further improvements

The launch, transfer, orbit and descent profiles are illustrations with declared time/scale compression, not solved mission trajectories or landing certification. Terrain contact and ridge shadows remain limited by the available 10 m / 200 m DEM. The wheel rigs animate the checked-in meshes; they are not suspension dynamics. Existing VIPER and fallback-lander visual proxies remain a reason to obtain better licensed assets in a separately approved task. No asset download was needed here.

The owner's live hero intentionally remains decorative, including its accelerated motion and glow, as explicitly requested. Its restored appearance is the exception to the audit's earlier proposed visual changes.

No patch to another agent's files is required by the final checks. Earlier profile-entry obstruction no longer reproduces in the current shared build; tests explicitly rechecked real pointer hits rather than treating handler invocation as proof.

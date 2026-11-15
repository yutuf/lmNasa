# Codex QA result

Completed findings 5, 7, 8, 9 and 14. Source edits are limited to the three owned components and the three permitted new CSS files. No git commands, installs, downloads, commits or pushes were performed.

## Finding 5 — fixed

- `web/src/components/GuidedTour.tsx:124`: clamp the measured card position; observe card resizing as well as its target.
- `web/src/tour-fix.css:1`: constrain card height, scroll its copy when necessary, and keep navigation outside that scrolling area. At narrow widths, dock the card 12 px above the viewport bottom.
- Edge, 390×844, all eight steps in EN and TR: **16/16 cards bottom = 832 <= 844**, and **16/16 Next/Done centres hit the button or its child**. Navigation used actual pointer clicks.
- Before: `qa/codex/before-080-en-phone-tour-1.png` (copied from the supplied original QA evidence).
- After: `qa/codex/after-tour-en-1.png` through `after-tour-en-8.png`, and `qa/codex/after-tour-tr-1.png` through `after-tour-tr-8.png`.

## Finding 7 — fixed

- `web/src/components/Drive.tsx:996`: follow the descending craft at a fixed offset scaled to its rendered model height. World-position smoothing previously trailed the accelerated descent by hundreds of metres, shrinking the craft in the frame. The camera now stays with the craft above the terrain throughout descent.
- `web/src/components/Drive.tsx:332`, `web/src/drive-fix.css:13`: dedicated Exit outside the HUD hidden by the existing landing rules; present immediately, including terrain loading. Cinematic film keeps its own close control.
- `web/src/components/Drive.tsx:900`: EN/TR altitude, range and touchdown readouts.
- At 1440×900, the first Exit measurement was x=1352.66, y=16, width=71.34, height=34; its centre was clickable. At simulation t=0.850 s the readout was altitude 1,432 m, range 2,108 m. The camera's local Y was 1,434.79 m and the craft's projected world bounding box was about **209×193 px**, rather than a distant speck. The separate exhaust group is also recorded in the raw measurements.
- Before: `qa/codex/before-048-en-desk-drive-Watch-the-la.png`.
- After: `qa/codex/after-landing-early.png`.

## Finding 8 — fixed

- `web/src/components/Drive.tsx:29`, `:191`: park far enough from the selected lander and initially face toward it, putting the chase camera on the open side of the rover.
- `web/src/components/Drive.tsx:1058`: scale chase distance and look height to rover dimensions, and keep the camera outside the lander footprint.
- `web/src/drive-fix.css:1`: explicit canvas/HUD stacking and an opaque control-panel background keep the controls readable over any mesh.
- `web/src/components/Drive.tsx:356`, `:365`, `web/src/drive-fix.css:11`: unbreakable ice-index and ice-depth values, including the depth unit; objective text wraps normally around them.
- Edge, 1440×900: **10/10 HUD button centres clickable for Apollo LM + Pragyan**, and **10/10 for default Vikram + VIPER**. Both include Back to the lander, Sky compass and Exit. Screenshots show a readable rover and intact numbers such as `64 cm`.
- Before: `qa/codex/before-049-en-desk-drive-Drive-a-rove.png`.
- After: `qa/codex/after-drive-apollo-pragyan.png`, `qa/codex/after-drive-default.png`.
- Camera sizing covers all existing vehicle IDs; the two explicitly required pairings were visually exercised, rather than an exhaustive matrix of every combination and manual camera angle.

## Finding 9 — fixed

- `web/src/components/MissionFilm.tsx:108`: apply a document scroll-lock class for the film lifetime and remove it on unmount.
- `web/src/film-fix.css:1`: lock root/body height and overflow; give subtitles a dark scrim, border-box sizing, wrapping and an explicit viewport-bounded width.
- Full launch sentence fits in EN/TR at both sizes. Desktop subtitle x=270, right=1170 within 1440; phone x=16, right=374 within 390. EN phone bottom=751.17 within 844. Subtitle scrollWidth equals clientWidth (900 desktop, 358 phone).
- Document scrollHeight = innerHeight: **900/900 desktop launch and verdict; 844/844 phone launch and verdict**. The lock class is removed after closing the film.
- Before: `qa/codex/before-003-en-desk-film-02.png`.
- After: `qa/codex/after-film-launch-desktop.png`, `after-film-launch-phone.png`, `after-film-launch-desktop-tr.png`, `after-film-launch-phone-tr.png`, `after-film-verdict-desktop.png`, `after-film-verdict-phone.png` (all under `qa/codex/`).

## Finding 14 — fixed

- `web/src/components/Drive.tsx:400`, `:436`: hide rover battery/solar/load and vehicle-spec footer in walk mode. Preserve the existing honest walked-distance and flashlight readout, sky conditions and radio visibility; add no speculative EVA capacity numbers.
- `web/src/components/Drive.tsx:450`: rover battery game-over is restricted to rover mode.
- With Pragyan selected, Moonwalk has **0 battery/power cards**, no Pragyan/panel/kWh specification in its footer, and a walked-distance/flashlight readout.
- Before: `qa/codex/before-walk.png`.
- After: `qa/codex/after-walk-pragyan.png`.

## Required checks

PASS — TypeScript: local equivalent of `npx tsc -b`, exit 0.

FAIL — Default Vitest config loader: sandbox denies esbuild access while resolving vite.config.ts.

PASS — `vitest run --configLoader runner`: 30 test files, 396 tests passed, exit 0.

PASS — ESLint: Drive.tsx, GuidedTour.tsx, MissionFilm.tsx; zero errors and zero warnings, exit 0.

FAIL — Default Vite build config loader: same sandbox/esbuild directory-access failure.

PASS — `vite build --configLoader runner`: 2264 modules transformed, production build completed, exit 0.

PASS — Edge visual checks and screenshots at 1440×900 and 390×844; raw measurements in `qa/codex/measurements.json`.

## Tooling and observations left alone

- npm/npx are absent from this shell's PATH. Used the already installed Codex Node executable to run the project's local TypeScript, Vitest, ESLint and Vite CLI files directly. The alternate Vite config loader avoids the sandbox's default esbuild config-bundling failure without changing project configuration.
- The supplied Python virtualenv launcher could not spawn its interpreter. Used its existing Playwright Node package and the installed Edge executable instead, with `--use-angle=d3d11`; no packages or browsers were installed. Visual checks used the dev app at localhost:5174; before images are the original QA screenshots, copied unchanged.
- Tests increased from 393 on the first successful run to 396 on the last run as other work added test files. Those files were not edited here.
- The existing production chunk-size warning remains. Page/nav overflow outside the film and the other findings owned by other agents were left alone.
- No EVA oxygen/battery simulation exists, so none was invented. Existing terrain resolution and vehicle-model limitations remain.

## Run 1b

Both requested fixes are complete. No git commands, installs or downloads were run. Source edits are limited to `web/src/components/Drive.tsx` and `web/src/drive-fix.css`; this report and the requested `qa/codex/after2-*.png` evidence were also written.

- **Descent plume — fixed.** `Drive.tsx:888` sizes the exhaust to the actual rendered model height (2 m Vikram, 7 m Apollo/default fallback, 50 m HLS), with a maximum length of 1.5 heights, shortening continuously inside three heights of touchdown and switching off at contact. Its origin is the bell area above the feet and its quaternion follows the craft, so the cone extends along local -Y. `Drive.tsx:1124` replaces the inverted cone and white sphere with an open additive cone whose shader fades both its silhouette and length; peak alpha is 0.16. The camera follows at least three craft heights away (minimum 12 m), outside the entire plume's bounding radius.
- **Edge descent evidence:** `after2-vikram-{early,mid,50m,touchdown}.png` and `after2-apollo-{early,mid,50m,near-touchdown,touchdown}.png`, all in `qa/codex/`, at 1440×900. Default lander is Vikram. Checkpoints use the existing dev-only `window.__drive` hook to hold simulation time, without source instrumentation. Early: 1,404 m; mid: 205 m; approximately 50 m: 51 m for Vikram. Vikram plume length = 3 m, camera distance = 13.47 / 13.41 / 13.39 m; at touchdown the plume is invisible. Apollo frames also cover the shortened near-contact exhaust. Inspected early screenshots show soft transparent downward exhaust and no white ellipse.
- **Rover panel — fixed.** `drive-fix.css:3` sets `left: auto`, content width, viewport-bounded maximum width, and the same background, border and radius as the left cards. The key legend wraps within 240 px, preventing it from stretching the panel into empty space. Explicit HUD/canvas stacking remains. Apollo + Pragyan panel is x=1158, width=266 at 1440×900; Back to the lander, Sky compass and Exit all pass centre-point hit testing. Evidence: `qa/codex/after2-drive-apollo-pragyan.png` and `qa/codex/after2-drive-vikram-viper.png`.

PASS — `npx.cmd tsc -b`, exit 0.

PASS — `npx.cmd vitest run --configLoader runner`: 30 files, 396 tests, exit 0.

PASS — `npx.cmd eslint src/components/Drive.tsx`: no errors or warnings, exit 0.

PASS — `npx.cmd vite build --configLoader runner`: 2264 modules, exit 0. Existing large-chunk warning remains.

Tooling: PowerShell blocks the `npx.ps1` shim; used the installed `npx.cmd` shim. Used the permitted runner config loader and existing Playwright/Edge installation. No unrelated source failures required intervention. Build outputs were generated by the requested checks; no out-of-scope source files were edited.
`nDefault Vikram + VIPER also measures x=1158, width=266, with all three right-panel button centres clickable (6/6 across both pairings).

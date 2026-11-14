# CODEX_TASK_3D: make every 3D animation logical and good-looking

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md`, `HANDOFF.md` and `CODEX_RESULT.md` (your earlier fixes) first.
The app is in `web/` (Vite + React 19 + TypeScript + three.js / @react-three/fiber / drei).

## Why

The owner says the 3D animations "are not logical and they look bad to the eye". Judges weigh presentation and 3D most heavily.
Every animated 3D view must:
- show physically sensible motion, where the viewer can tell what is happening and why;
- look like a credible space visualisation, not a toy.

This replaces `CODEX_TASK_1b.md`, which was stopped. Its two items are included below.

## Scope: the animated 3D views

1. **The film "Tell me the mission"** (`MissionFilm.tsx`, `FilmScenes.tsx`, `FilmHud.tsx`, `LaunchScene.tsx`): scenes title, launch, window, coast, descent, landing, site, ellipse, rover, odds, verdict.
   - The film's landing and rover scenes reuse `Drive.tsx` with `cinematic` / `filmMode`.
   - The descent and route views reuse `Globe.tsx` `Flight`.
2. **Site page → Watch the landing / Drive a rover / Walk on the Moon** (`Drive.tsx`).
3. **Globe → Route mode** (`Globe.tsx`: `Flight`, `CameraFlight`, `Orbiter`, `OrbitPath`). It is labelled schematic, but it must still be logical.
4. **Hero Moon** on the Simple page (`HeroMoon.tsx`).
5. **Vehicle models and terrain** used by those views (`Models.tsx`, `VehicleModels.tsx`, `Terrain.tsx`, `HorizonView.tsx`).

## What "logical" means (check each, fix what fails)

- **Launch:**
  - The rocket rises from Earth's surface, pitches over gradually, then gets to orbit and burns for the Moon (trans-lunar injection).
  - There is no teleporting.
  - Earth's day/night side is lit from the real Sun direction.
  - The exhaust points opposite the thrust.
- **Coast:**
  - Earth→Moon in the right sense of motion: the Moon moves prograde, and the trajectory bends toward where the Moon will be.
  - Time compression is visible and stated (about 4–5 days).
- **Lunar orbit insertion and descent:**
  - Burns are retrograde. Braking happens with the engine facing the direction of travel. Then the craft pitches up to vertical, hovers or approaches, and touches down at the chosen site.
  - The attitude always matches the acceleration.
  - The ALTITUDE / RANGE / T− readout matches what is on screen.
  - The plume (from 1b) is a short, soft, additive, mostly transparent cone under the engine bell, along the craft's local down axis. It is about 1–2 craft heights long, shorter near touchdown, and never reaches the camera.
- **Touchdown:**
  - Dust is kicked up under about 30 m and settles; the engine cuts off.
  - The legs meet the ground: no sinking, no floating, no sliding.
- **Rover and walk:**
  - Wheels turn at a speed consistent with the vehicle's speed. The body follows the terrain normal. The rover doesn't slide sideways, and steering pivots sensibly.
  - The autopilot route is followed smoothly: no spinning in circles, no jitter.
  - Nothing clips through the lander.
- **Lighting:**
  - Shadows and lit sides come from the real Sun direction for that hour (the ephemeris is already passed in).
  - Earth sits at its real altitude/azimuth in the sky (or is below the horizon when it should be).
  - One hard sunlight plus faint earthshine. Black sky. No fog, no plastic-shiny materials.
- **Scale:** sizes are right relative to each other and the terrain: Apollo LM about 7 m tall, Vikram about 2 m, Pragyan about 1 m, VIPER about 1.5 m.
- **Camera:**
  - Smooth eased paths and deliberate cuts. Never inside a model or under the terrain, and no jitter.
  - Framing keeps the subject readable, and the camera moves only when there is a reason for it.
- **HUD (from 1b):** the panel behind "Back to the lander / Sky compass / Exit" fits its content (auto width, right-aligned, styled like the left cards) and stays clickable over any mesh.
- **Honesty:** keep the "schematic" and "approximate" labels where things are schematic. Don't invent mission numbers.

## Process

1. **Audit first.**
   - Use the production preview (`npx vite build` then `npx vite preview --port 4173 --strictPort`) or the dev server on 5174.
   - Capture frame sequences of every animation: at least 6 frames per scene or mode, at 1440x900 and at 390x844. Use `..\.venv\Scripts\python` + Playwright with `p.chromium.launch(channel="msedge", args=["--use-angle=d3d11","--ignore-gpu-blocklist"])`.
   - Write `qa/codex3d/AUDIT.md`: for each scene, what is illogical or ugly, with frame paths. Be specific and harsh.
2. **Fix them**, most visible first.
3. **Capture the same frames after**, plus fps:
   - count `requestAnimationFrame` calls over 4 s in each scene, on the production preview;
   - baseline on this machine: most film scenes 110–130 fps, rover about 42, touchdown about 40;
   - nothing may get slower than about 90 % of its baseline.

## Files you own (only edit these)

- `web/src/components/Drive.tsx`, `MissionFilm.tsx`, `FilmScenes.tsx`, `FilmHud.tsx`, `LaunchScene.tsx`, `Globe.tsx`, `HeroMoon.tsx`, `MissionStory.tsx`, `Models.tsx`, `VehicleModels.tsx`, `Terrain.tsx`, `HorizonView.tsx`
- `web/src/drive-fix.css`, `web/src/film-fix.css`, `web/src/tour-fix.css`, and any NEW file
- You may use the models already in `web/public/models/` and textures in `web/public/data/`. Do not download anything.

**Do not edit:**
- Grok is editing: `App.tsx`, `SimpleView.tsx`, `SiteProfile.tsx`, `SiteCard.tsx`, `ProbabilityPanel.tsx`, `SourcesPage.tsx`, `JudgesPage.tsx`, `Artemis.tsx`, `clps.ts`, `scienceSites.ts`, `places.ts`.
- Codex #2b is editing: `data.ts`, `vercel.json`, `vite.config.ts`, `public/sw.js`, `siteRender.ts`, `siteExtras.ts`, `HistoryPanel.tsx`, `resultsPaint.ts`, `DeferredHeroMoon.tsx`, `web/scripts/*`.
- Another agent owns these: `PhoneApp.tsx` and any `phone*` file. Also leave `space.css`, `index.css` and every `*_TASK*.md` alone.

If a fix truly needs one of those files, write the exact patch in your report instead.

## Rules

- No git commands. No `npm install`, no new dependencies, no downloads.
- All UI text in EN and TR.
- Performance: no per-frame allocations in `useFrame`. Memoise geometries and materials. Keep `checkShaderErrors = false` where it is set.
- Other agents build and test in parallel. If a failure comes from a file you don't own, report it; do not fix it.

## Required checks (in `web/`)

- `npx tsc -b`
- `npx vitest run` (all pass; 396 tests now)
- `npx eslint` on every changed file
- `npx vite build`

If a default config loader fails, use `--configLoader runner`.

## Report

Write `CODEX_RESULT_3D.md` at the repo root:

- the audit summary;
- per scene: what you changed (file:line);
- before/after frame paths;
- the fps table, before and after;
- the check results;
- what you would still improve.

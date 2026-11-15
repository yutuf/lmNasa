# CODEX_TASK_1b: polish two things from your CODEX_TASK.md fixes

Lead: Claude. Your previous report is `CODEX_RESULT.md` (good work: accepted). Same file ownership as `CODEX_TASK.md`.
You may only edit `Drive.tsx`, `GuidedTour.tsx`, the film components, and `drive-fix.css`, `tour-fix.css`, `film-fix.css`. No git. No installs.

1. **Descent plume** (`qa/codex/after-landing-early.png`).
   - The engine plume is now a long, opaque orange tube. It runs from the lander down to the bottom edge of the screen, toward the camera, and has a white ellipse in it.
   - Make it a short, soft, additive, mostly transparent exhaust cone under the engine bell. It must point along the lander's local down axis, and its length must scale with the lander's size (about 1–2 lander heights, shorter near touchdown).
   - It must never reach the camera.
   - Check it at several moments of the descent (early, mid, 50 m, touchdown) and for at least Vikram, Apollo LM and the default lander.
2. **Rover control panel** (`qa/codex/after-drive-apollo-pragyan.png`).
   - Your opaque panel behind "Back to the lander / Sky compass / Exit" and the key legend is a large dark box. Its left two-thirds is empty.
   - Shrink it to fit its content: right-aligned and auto width, the same look as the left-hand cards.
   - Keep the buttons clickable over any mesh.

## Checks (in `web/`)
- `npx tsc -b`
- `npx vitest run`
- `npx eslint` on your changed files
- `npx vite build`
- Edge screenshots in `qa/codex/` named `after2-*.png`

You can run processes this time. If a default config loader fails, use `--configLoader runner` as before.
Another Codex run (CODEX_TASK_2b) is building and testing in parallel. If a failure is in a file you don't own, report it; don't fix it.

## Report
Append a section "Run 1b" to `CODEX_RESULT.md`.

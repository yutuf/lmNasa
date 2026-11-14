# CODEX_TASK_2c: remove the gzip build step (Vercel already serves Brotli)

Lead: Claude. Context: `CODEX_RESULT_2.md`, "Verification run". The live site already sends `.bin` files with `Content-Encoding: br`,
so the build-time `.bin.gz` siblings only add about 54 MB of useless files to every Vercel deployment.

Do:
1. **Remove the gzip pipeline.**
   - Remove the compression plugin from `web/vite.config.ts`.
   - Delete `web/scripts/compressData.ts` and `web/scripts/compressData.test.ts`.
   - Delete the generated `web/scripts/first-load-*.json` logs, but keep `web/scripts/measureFirstLoad.py`.
   - Make sure `npx vite build` no longer writes any `.bin.gz` into `web/dist`: check with `dir /s /b web\dist\*.gz`.
2. **Keep everything else as it is:**
   - the deferral gate (`resultsPaint.ts` and its test);
   - the `siteRender.ts` change: the right DEM, after the results paint;
   - `DeferredHeroMoon.tsx`;
   - the `sw.js` cache-version bump;
   - `vercel.json` as you left it in the verification run.
3. **Run the checks** in `web/`: `npx tsc -b`, `npx vitest run`, `npx eslint vite.config.ts`, `npx vite build`.
   - Another Codex run is editing 3D components in parallel. Report failures in files you don't own; don't fix them.

Files you may touch: `web/vite.config.ts`, `web/scripts/*`, `CODEX_RESULT_2.md`. No git commands. No installs.
Append a short section "Run 2c" to `CODEX_RESULT_2.md`.

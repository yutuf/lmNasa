# CODEX_TASK_2b: verify and finish CODEX_TASK_2 (first-load speed)

Lead: Claude. Your previous run's report is `CODEX_RESULT_2.md`; read it and `CODEX_TASK_2.md` first. That run could not spawn processes.
This run can: Node (`npx`), the root `.venv\Scripts\python` (Playwright + Edge) and `curl`.

## Do
1. **Baseline (BEFORE).** Use `git worktree add ..\lunanav-before HEAD`. That is the last commit, without your uncommitted changes. Copy `web\node_modules` into it, or junction-link it. Build there and preview it on port 4180. Run `web\scripts\measureFirstLoad.py before` against it, then remove the worktree (`git worktree remove --force ..\lunanav-before`). Those two worktree commands, plus `git status`, `git diff` and `git show`, are the only git commands allowed. No commit, push, checkout, stash or reset.
2. **AFTER.** In `web/`, run `npx tsc -b`, `npx vitest run`, `npx eslint` on your changed files, and `npx vite build`. Then run `npx vite preview --port 4173 --strictPort` and the measurement `after`. Note: other agents are editing `App.tsx`, `Drive.tsx`, `GuidedTour.tsx`, `MissionFilm.tsx` and `SimpleView.tsx` right now. If a failure comes from their files and not yours, say so; do not edit their files.
3. **Live check.** Run `curl -sI -H "Accept-Encoding: br, gzip" https://lunanav-theta.vercel.app/data/atlas.bin`. Does Vercel already compress `.bin`? If it already serves br or gzip, your `vercel.json` rewrite to `.bin.gz` may be unnecessary or harmful (double encoding). Decide, and simplify if so.
4. Fix anything in your own files that fails. You own the same files as in CODEX_TASK_2, plus the new files you created (`web/scripts/*`, `resultsPaint.ts`, `DeferredHeroMoon.tsx` and their tests).

## Report
Append a section "Verification run" to `CODEX_RESULT_2.md`:
- BEFORE/AFTER `wire_bytes_through_first_card` and time to the first card;
- the live `curl` headers;
- each check's pass/fail line;
- what you changed in this run.

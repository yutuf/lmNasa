# CODEX_TASK_OPS: make the engine predict real operations, not just sunlight

Lead: Claude. Written 15 Nov 2026. The owner wants the engine to match how real landers actually operate.

## Today
The real-landings replay compares "days of Sun" with "days the lander worked":
- Chandrayaan-3: 11.9 vs about 11;
- Blue Ghost 1: 14.5 vs about 14.

See `web/public/data/history.json`, `web/src/history.ts`, `web/src/components/HistoryPanel.tsx`, `scripts/build_history.py` and `web/src/model.ts` (`simulateBattery`, `evaluateWindow`).

Real operations do not end at "the Sun's centre sets". They end when the panels can no longer carry the load. Then the battery runs down: Blue Ghost 1 worked about 5 hours into the night. Some landers are put to sleep before sunset on purpose: Chandrayaan-3's rover slept on 2 Sep and its lander on 4 Sep.

## Build
1. **The model:** a pure function in `web/src/model.ts`, for example `operatingWindow(sunFraction, sunAltDeg, earthVisible, stepH, lander)`. It returns:
   - when power-positive operation ends (panel output, from the visible solar-disc fraction and the Sun's elevation against the panel orientation, falls below the load);
   - how long the battery then lasts (capacity × usable depth ÷ night load);
   - and so the **predicted end of operations**.
   - Use per-lander numbers already in the app (`web/src/vehicles*` / `landers`: panel W, battery Wh, load). Where a real lander's number isn't public, use the app's existing class defaults and label them "class default".
2. **Replays:** for each of the 5 real landings, show "predicted end of operations" next to "what happened". Present it as two plain numbers or a marker on the existing bar.
   - Add it to `history.json` via `scripts/build_history.py` if the data needs Python, otherwise compute it in TS from the hourly series the file already has.
   - State the error per mission in hours or days, honestly, including the ones it gets wrong (IM-1 tipped over; SLIM landed nose-down) and why.
3. **Search:** add "operating days after touchdown" to the site evaluation, the site page stat row and the PDF. Use real units in EN and TR. Do not change GO/NO-GO rules. This is an extra, explained number.
4. **API:** Grok is building `web/api/v1/` in parallel. Don't edit those files. Export the new function so the API can add it later; mention it in your report.

## Rules
- No git commands, no installs.
- Don't change any existing tested number unless a test proves the old one was wrong. The parity tests against the Python reference must still pass; extend the Python reference (`lunanav/`) if the new metric needs a reference test.
- The UI style is fixed:
  - flat colours, no gradients;
  - no coloured line down the side of any box;
  - EN and TR for every string.
- Files you own: `web/src/model.ts` (additions only), `web/src/history.ts`, `web/src/components/HistoryPanel.tsx`, `web/src/components/SiteProfile.tsx` and `SiteExtras.tsx` (one stat), `web/src/report.ts`, `scripts/build_history.py`, `lunanav/` (reference only), and the new tests.

## Checks
- In `web/`: `npx tsc -b`, `npx vitest run`, `npx eslint` on the changed files, `npx vite build`.
- At the repo root: `.venv\Scripts\python -m pytest -q`.
- A screenshot of the replay panel and one site page, in `qa/ops/`.

## Report
Write `CODEX_RESULT_OPS.md`:
- predicted vs real operations for all 5 landings, as a table;
- the method;
- the checks.

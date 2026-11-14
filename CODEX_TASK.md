# CODEX_TASK: QA fixes for the 3D scenes, the phone tour and the film

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md` and `HANDOFF.md` first. The app is in `web/`
(Vite + React 19 + TypeScript + three.js / @react-three/fiber).

## Objective

Fix QA findings 5, 7, 8, 9 and 14 from `qa/QA_REPORT_2026-11-15.md`. They are summarised below. The screenshots it
names are in `C:\Users\kayma\AppData\Local\Temp\claude\a69c2b8bb4eb36b9\1e25ef99-4659-4c75-96ce-eb2c4759b964\scratchpad\qa\`.
The QA ran on a production build at 1440x900 and 390x844, in English and Turkish.

1. **Finding 5: the phone guided tour card goes below the screen.**
   - At 390x844, from step 2 onwards the tour card sits at y≈880–900 (height 221) and is entirely off screen.
   - A tap is swallowed by `svg.tour-dim`, so there is no way to press Next.
   - Expected: the card and Next stay inside the viewport on all 8 steps, in both languages.
   - Suggested approach: clamp the card to the viewport, or dock it at the bottom on narrow screens.
2. **Finding 7: "Watch the landing" picture does not match the altitude.**
   - The banner reads `ALTITUDE 1,332 m · RANGE 1,936 m · T−25 s`, but the lander is tiny, in the middle of the frame, as if it were already down.
   - The Exit control is hidden during the descent.
   - Expected: the camera and lander match the readout (still about 1.3 km up, descending). A way to leave is on screen for the whole descent.
3. **Finding 8: "Drive a rover" with the Apollo LM as lander and Pragyan as rover.**
   - The Apollo mesh fills the right side. It covers "Back to the lander", "Sky compass", "Exit" and the key legend. Pragyan is a few pixels.
   - The ice card breaks numbers across lines: "0.66" then a lone "8", and "64" then "cm".
   - Expected: the rover is readable and the buttons are clear of the lander, for every lander/rover pair. Numbers never wrap (`white-space: nowrap` on the value).
4. **Finding 9: film scene 02 (LAUNCH).**
   - The subtitle lies on the sunlit Earth and is cut off at the right ("One and a half turns…" does not finish).
   - A document scrollbar shows beside the film, including on the verdict frame.
   - Expected: the whole sentence fits and is readable on any background (a scrim or shadow behind the subtitle), and there is no page scrollbar while the film is open.
5. **Finding 14: Moonwalk shows the rover's power.**
   - With Pragyan selected, the walk's footer reads "Pragyan: 50 W panel, 0.1 kWh battery…" and the battery card shows the rover's numbers.
   - Expected: walk mode shows a walker readout (an astronaut suit or EVA: time, distance, suit oxygen or battery if the data exists), not the rover's drive spec. If there is no honest EVA data, hide the rover spec in walk mode instead of inventing numbers.

## Files Codex owns (only edit these)

- `web/src/components/Drive.tsx`
- `web/src/components/GuidedTour.tsx`
- `web/src/components/MissionFilm.tsx`, `web/src/components/FilmHud.tsx`, `web/src/components/FilmScenes.tsx`, `web/src/components/LaunchScene.tsx`
- NEW files only for CSS: `web/src/drive-fix.css`, `web/src/tour-fix.css`, `web/src/film-fix.css`. Import each from the component that needs it.
- Do **not** edit `web/src/space.css`, `web/src/index.css` or `web/src/App.tsx`. If a rule there has to be overridden, do it in your new CSS file with a more specific selector.
- Do not touch these (other agents own them now): `App.tsx`, `SimpleView.tsx`, `SiteProfile.tsx`, `ProbabilityPanel.tsx`, `SourcesPage.tsx`, `JudgesPage.tsx`, `clps.ts`, `PhoneApp.tsx`, any `phone*` file, `GROK_TASK.md`.

## Acceptance criteria

- Finding 5: at 390x844, EN and TR, every tour step's card has `getBoundingClientRect().bottom <= innerHeight`, and Next is clickable (`elementFromPoint` at its centre returns the button or a child of it).
- Finding 7: during the descent, the lander's on-screen size and position agree with the altitude readout. Exit (or an equivalent close control) is visible from the first frame.
- Finding 8: at 1440x900, with Apollo LM + Pragyan and with the default lander + rover, no HUD button is covered by the 3D lander. Check with `elementFromPoint` on each button centre: the button itself must be returned, not the canvas or the lander. The ice card values do not wrap.
- Finding 9: scene 02 subtitle fully inside the frame at 1440x900 and 390x844. `document.documentElement.scrollHeight <= innerHeight` while the film is open.
- Finding 14: walk mode shows no rover spec.
- No new npm dependencies. No downloads. All UI text bilingual (EN + TR).
- Do not commit or push. Claude reviews and commits.

## Required checks (run in `web/`)

- `npx tsc -b`
- `npx vitest run` (all tests pass; there are 393 now)
- `npx eslint <each file you changed>`
- `npx vite build`
- Visual proof:
  - Playwright is available: `..\.venv\Scripts\python` with `from playwright.sync_api import sync_playwright`, `p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])`.
  - Dev server: `npx vite --port 5174` if nothing is listening on 5174 already.
  - Save before/after screenshots to `qa/codex/`.

## Report

Write `CODEX_RESULT.md` at the repo root:

- per finding: fixed / partly / not fixed, what you changed (file:line), and the evidence (measurement + screenshot path);
- the output of each required check (pass/fail lines only);
- anything you noticed but left alone.

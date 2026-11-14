# GROK_TASK_2: read-only QA of the phone experience

Lead: Claude. Written 15 Nov 2026. Read `AGENTS.md`, `HANDOFF.md` and `qa/QA_REPORT_2026-11-15.md` first. Other agents are editing code right now.
**This task is read-only. Do not edit, create or delete any file in the repo, except your report and its screenshots (below).**

## Objective

The first QA pass did not reach these flows on a phone. Test them at 390x844 and at 360x740, in English and in Turkish:

1. Open a site card's page.
2. Watch the landing.
3. Drive a rover.
4. Walk on the Moon.
5. "What next?"
6. Sources & limits.
7. The libration explainer ("Why does Earth wobble?").
8. Ask Luna: send one suggestion.
9. "Plan a mission with me" (the interview), all the way to Find landing sites. Note: its chips were fixed today and should now be clickable.
10. Switch to Advanced and run a search.
11. The film ("Tell me the mission"): play a few scenes, then skip to the end.
12. The whole-Moon scope.
13. The Sunlight map on the globe, with Play.

On every screen, check:

- horizontal overflow: `document.documentElement.scrollWidth > innerWidth`;
- controls off screen, or covered (use `elementFromPoint` at the control's centre);
- text that is cut off, or that sits on top of other text;
- English left in the Turkish UI;
- console errors and page errors;
- failed network requests;
- frame rate in the 3D views (count `requestAnimationFrame` calls over 3 s).

## How

- Dev server at http://localhost:5174 (already running). If it is not, run `npx vite --port 5174` in `web/`.
- Playwright: `.venv\Scripts\python` with `from playwright.sync_api import sync_playwright`, `p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])`.
- Use `has_touch=True` and `is_mobile=True` for the phone contexts.
- Put your scripts in `qa/grok2/` (create it).
- Screenshots go in `qa/grok2/`, named `NNN-lang-size-flow.png`.

## Do not

- Do not edit any source file. Do not run git. Do not install anything.
- Do not test the `#phone` pairing page (PhoneApp). Another agent owns it.

## Report

Write `qa/grok2/PHONE_QA.md` in the style of `qa/QA_REPORT_2026-11-15.md`:

- Major and Minor sections;
- each finding with where / did / happened / expected / screenshot;
- measured numbers;
- a "what was exercised" list.

Plain words, no guesses. If something could not be tested, say why.

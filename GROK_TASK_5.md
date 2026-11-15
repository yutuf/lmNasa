# GROK_TASK_5: de-bloat the interface (removal only)

Lead: Claude. Written 15 Nov 2026. Branch `hackathon`. Read `AGENTS.md` first.

## The rule for this task

**Remove, hide or simplify. Add nothing.**
- No new features and no new panels.
- No new text, except the few short labels named below.

The owner feels the UI looks AI-made and overloaded. The goal is a calm, professional tool built around one question: **where and when should we land on the Moon?**
The core path is: goal → best sites and dates → site page → watch the landing. Everything else is secondary.
Nothing scientific changes: no numbers, no engine code.

## Do

1. **Sparkle icons go.**
   - lucide `Sparkles` is the clearest "AI product" sign. It appears in `App.tsx`, `Luna.tsx`, `MissionInterview.tsx` and `MissionStory.tsx`.
   - "Tell me the mission" gets `Play` (or `Clapperboard`). Ask Luna gets `MessageCircle`. The interview gets `ListChecks` or nothing.
   - Do not edit `MissionStory.tsx` (Codex owns it). List the patch for it in your report.
2. **Nav: five things only.**
   - Keep: the logo, the scope pill, Simple/Advanced, "Tell me the mission", EN/TR.
   - Move into one small "More" menu (a button with a plain list, keyboard-accessible, EN/TR label "More" / "Daha fazla"): Decide, Workshop, Phone, QR/judges page, GitHub.
   - This menu is the only new UI element allowed.
3. **Ticker: remove** the "LIVE" ticker strip from `MissionBar.tsx`. Keep the next-GO-window bar and the clocks.
4. **Simple page: fewer doors.**
   - The "What next?" row and similar groups of secondary panels (History / real landings, Orbits, Libration, Tour, Decision lab, Sources) collapse into one row of plain text links, or one "More tools" disclosure that starts closed.
   - Keep Sources & limits visible as a plain link (honesty matters to judges).
   - Keep the CLPS chips, but make them a quieter single line.
5. **Copy: one sentence per section.**
   - Where a section explains itself twice (an intro paragraph plus a hint plus a note), keep the single most useful sentence.
   - Keep every honesty/limit statement ("planning tool, not a landing certification", "polar-only", "schematic").
   - List every removed sentence in your report, EN and TR.
6. **Effects: fewer.**
   - Remove the coloured radial-gradient blobs in the page background (`space.css` `body::before`, the blue and red ellipses). Keep the star field.
   - Tone down glows and `text-shadow`s on headings and buttons.
   - The huge outlined rank numbers ("01", "02") on site cards and the site page become small, solid, quiet rank labels.
   - Remove any pulsing or attention animation on buttons (e.g. `.nav-story`).
7. **Ask Luna stays**: a Gemini key is being added. Make its button a quiet secondary button, not a red pill.

## Files you own

- `App.tsx`: not the film block (`{film && (() => {` and the `mission-film-open` effect).
- `space.css`: not the mission-film rules.
- `index.css`, `MissionBar.tsx`, `SimpleView.tsx`, `SiteCard.tsx`, `SiteProfile.tsx`, `Luna.tsx`, `MissionInterview.tsx`, `interview.css`, `TradeOff.tsx`

**Do not edit:**
- Codex is rewriting these 3D and film files: `Drive.tsx`, `MissionFilm.tsx`, `FilmScenes.tsx`, `FilmHud.tsx`, `LaunchScene.tsx`, `Globe.tsx`, `HeroMoon.tsx`, `MissionStory.tsx`, `Models.tsx`, `VehicleModels.tsx`, `Terrain.tsx`, `HorizonView.tsx`, `filmProfile.ts`, `missionPlayback.ts`, `story.ts`, `motion3d.ts`, `*-fix.css`.
- `PhoneApp.tsx`, the `phone*` files and every `*_TASK*.md`.

## Rules

- No git commands. No installs.
- EN and TR for every string you touch.
- Every hidden feature must stay reachable through More, or through the disclosure.

## Checks (in `web/`)

- `npx tsc -b`
- `npx vitest run`
- `npx eslint` on the changed files
- `npx vite build`

## Evidence for the owner's review

The owner will go over this with Claude, so this matters most.
- Before you change anything, take screenshots of the Simple page (top, results, one site page) and the Advanced page, at 1440x900 and 390x844, in English. Use Playwright: `..\.venv\Scripts\python`, Edge, dev server on 5174.
- Save them as `qa/grok5/before-*.png`.
- After your changes, take the same shots as `qa/grok5/after-*.png`.

## Report

Write `GROK_RESULT_5.md`:
- a short list of what was removed, hidden or simplified, each with file:line;
- the removed sentences;
- the patch for `MissionStory.tsx`;
- the check results;
- the before/after pairs.

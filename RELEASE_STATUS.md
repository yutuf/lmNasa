# Demo release — 15 November 2026

Lead: current Codex chat, until Claude returns. Freeze new features; finish and verify existing flows.

## Ownership

- Background Codex (CODEX_TASK_3D): exclusively Drive, Globe, MissionFilm, FilmScenes, FilmHud, LaunchScene, HeroMoon, Models, VehicleModels, Terrain and its motion helpers. Preserve the camera guards described in LEAD_CAMERA_NOTE.md. Finish a CODEX_RESULT_3D.md report; no git operations.
- Lead: vehicles.ts pairing policy, App.tsx integration, SimpleView.tsx, release-fixes.css, main.tsx, mobile action access, shared release verification and git.
- Grok phone QA: report is complete at qa/grok2/PHONE_QA.md; additional runs should be read-only and narrowly target release blockers. Process launch status is not proof of active work.
- Phone controller agent: PhoneApp.tsx and phone* files remain yours. No edits there by lead.

## Acceptance gates

- TypeScript and all web tests pass for the combined tree.
- Simple: choose compatible lander/rover, search, open first site, drive directly.
- Phone: 360 and 390 px, EN/TR; navigation and profile actions accessible; joystick hit target unobstructed and dragging moves the rover.
- Film: launch renders; chase/site stay outside Moon; rover moves; reduced overlay clutter; no black scene on transition.
- Sunlight: global atlas loads and whole-Moon overlay visible on both local and production, including after service-worker update.
- One production review build. Record evidence; owner reviews before main publication.

## Current findings

- 414 web tests passed before the latest concurrent 3D edits. Full rebuild must be repeated once those edits settle.
- 110 Python tests passed on the prior checkpoint.
- Latest confirmed pushed hackathon checkpoint: e8ea576; newer edits are local.
- Shared state is changing while background agents work; do not claim final QA from intermediate checks.
- HANDOFF.md and TODO.md contain stale unchecked tasks: consult implementation and reports before treating these as missing features.

## Lead integration checks, 15 Nov

- Mobile site actions now fit in two columns. Mast/calendar overflow was a grid min-content issue: at 360 px the profile is 345 px wide and scrollWidth is also 345 (was 814). Navigation button right edge is 351.53 px in EN and 336 px in TR at 360 px.
- Joystick occupies the bottom-left touch area above the HUD; actual touch movement remains pending, because viewport resizing alone does not emulate a coarse pointer.
- Global sunlight auto-frames the whole globe rather than flying to the selected polar result. Visually checked at phone width; do not mistake a loaded global atlas for proof of camera framing.
- Owner rejected the latest film direction. Lead's shortened sequence is reverted: technical defaults to true again, retaining calendar, ellipse and odds. Freeze further film sequencing/style changes pending comparison with the earlier version. Background agent's 3D changes are still in the shared tree and need owner review.
- 414 tests passed. TypeScript and production build passed with the concurrent 3D changes observed so far. Latest technical-film change passed TypeScript; final build pending.
- Unified production review server is http://127.0.0.1:4175 (serves web/dist); source dev server remains 5174. Rebuild dist before claiming it includes a newer change.
- Owner reports Grok is still active: treat it as active regardless of process-list visibility.

Read HANDOFF.md first.

# Agent notes for LunaNav

(There was no CLAUDE.md or project_space_apps_2026.md in this repo; these are the working rules the previous agent followed.)

## Project

- NASA Space Apps 2026 (14–15 Nov 2026), challenge "Lunar Landing Site Navigator": where and when to land on the Moon.
- The product is the web app in `web/` (Vite + React 19 + TypeScript + three.js / @react-three/fiber). The Python package `lunanav/` and `scripts/` build the data it loads.
- Tag `pre-hackathon` (e616415) marks what existed before the event. Keep the README's pre-hackathon disclosure honest.

## Working rules

- Run `npm test` and `npx tsc -b` in `web/` before committing; run `pytest -q` at the root when touching Python.
- Work on branch `hackathon`. `main` auto-deploys to Vercel, so ask the owner before merging or pushing to `main`.
- Never commit secrets. `GEMINI_API_KEY` lives in `web/.env.local` (local) or in Vercel's env, and the owner sets it themselves.
- Ask the owner before downloading third-party files (3D models etc.): give the name, source, licence and size. Credit every model in `web/public/models/CREDITS.md`.
- Raw data in `data/` is gitignored (about 40 GB). Only commit derived files in `web/public/data`.
- Be honest in the UI about limits: polar-only checks are labelled, and this is a planning tool, not a landing certification.
- UI style: the F1-drivers-page look in `web/src/space.css`. Professional, not "AI-looking"; the judges care most about presentation and 3D.
- All UI text is bilingual (EN/TR); add both when adding strings.
- On Windows, open files in Python with `encoding="utf-8"`.

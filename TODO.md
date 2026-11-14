# LunaNav · what is left (live tracker)

Updated by the agents as work lands. `[x]` done and verified · `[~]` in progress (who) · `[ ]` not started.
Rules: test with `npm test` + `npx tsc -b` in `web/`; show the owner locally before committing; never push `main` without asking.

## In progress
- [~] **Demo deck**: 7-slide English deck for the Space Apps limit, from the screenshots already in `presentation-kit/screenshots/` (demo agent). A recorded video is still not made.

## Not started
- [ ] **Go live**: site is public at https://lunanav-theta.vercel.app (Vercel Authentication already off) but runs this morning's `main`. To do: merge `hackathon` → `main` (needs OK). **Owner:** set `GEMINI_API_KEY` in Vercel → Settings → Environment Variables (the live `/api/ask` answers 503 "GEMINI_API_KEY missing"), and `ELEVENLABS_API_KEY` for the new voice; then redeploy
- [ ] **New demo video** recorded from the app (the 7-slide deck is the submission-safe stand-in)

## Done (this session)
- [x] Space UI: page background `#000000`; the 3D moon has no card frame and runs to the edges of the view
- [x] Presentation kit: submitted-deck limit is 7 slides including the title; ellipse, relay, and real models are no longer "next"
- [x] Illustrations: 17 handbook-line images in `web/public/art/` (goals, "What next?" cards, judges page), used as `.webp`
- [x] Step-by-step mission chatbot: brief first, then only the missing details. Mounted from Luna's "Plan a mission with me"
- [x] Rover autopilot fixed (route index never advanced on grid stairs → pure pursuit on a smoothed Catmull-Rom path); route drawn as one glowing ribbon with a moving dash (Grok #2, checked in the browser)
- [x] Guided "For judges" tour + "Why does Earth wobble?" libration explainer, wired into the Simple page and the judges page (Grok #4, checked)
- [x] ElevenLabs voice: `/api/tts` (key stays on the server), browser voice as fallback; needs `ELEVENLABS_API_KEY` in `web/.env.local` and in Vercel (Grok #3, reviewed)
- [x] Film: three new scenes (the window, the ellipse, the odds), 2D only (Grok #1; final fps check pending)
- [x] Our model vs real landings: Chandrayaan-3, SLIM, IM-1, Chang'e 6, Blue Ghost 1 replayed through the engine (Blue Ghost: model 14.5 days of Sun, real ~14 days; Chandrayaan-3: 11.9 vs ~11)
- [x] Whole Moon: the slope check runs on the global grid; the 40 m zone check, ice and walking/driving stay polar and the Sources page says so
- [x] Offline mode (PWA): after one visit the production app works with no network (tested)
- [x] Launch & orbit scenarios (reachable band, plane-change Δv) + PDF report (print → save as PDF)
- [x] Satellite orbit on the 3D globe (Workshop → "Put it in orbit"), Kepler time-lapse
- [x] Globe decluttered: only the current goal's sites, numbers only on the top 3 results
- [x] Real 3D models: Vikram, Starship HLS, Pragyan, Yutu-2, Apollo LRV (museum scan, 31.6 → 1.9 MB); box models hidden
- [x] All models compressed (Draco + JPEG textures): Vikram 7.9 → 0.55 MB, Starship 2.5 → 0.45 MB, Pragyan 2.2 → 0.11 MB
- [x] 3D performance: film rebuilt its 3D scenes every frame (fixed), hidden canvases pause, pixel ratio caps, no sync shader checks, film clock 30 Hz, cached formatters, physical → standard materials, one shared drive world for touchdown → rover. Production build: most scenes 110–130 fps (was 30–60), rover 41 fps with no freeze (was 7 fps, 6 s freeze)
- [x] Landing/rover ground: no more square slabs or speckle (bigger detail patch, sunk coarse grid, bicubic terrain, calmer texture)
- [x] Simple UI: three questions, Earthrise backdrop, coloured steps, vector icons, goal terrain renders, "What next?" cards
- [x] Uncertainty ranges on the site page; worst case inside the landing ellipse; relay satellite in the search
- [x] Judges landing page with QR code (`#judges`)
- [x] Artemis III goal (9 official regions); better example renders
- [x] Real CLPS missions in one click (IM-3, Griffin-1, CP-12, Blue Ghost M3)
- [x] Sources & limits page (data, method, limits; Earth-disk choice documented)
- [x] Antenna/panel mast "what if" and the 2026–2045 mission calendar on the site page
- [x] Two missions head to head (pin A, change, compare)
- [x] Decision lab (TOPSIS + robustness), film HUD, verdict board

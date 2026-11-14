# LunaNav · what is left (live tracker)

Updated by the agents as work lands. `[x]` done and verified · `[~]` in progress (who) · `[ ]` not started.
Rules: test with `npm test` + `npx tsc -b` in `web/`; show the owner locally before committing; never push `main` without asking.

## In progress
- [~] **Countdowns** (sunset/Earthset, "right now"), **launch-slip what-if**, **nearest dates that work** (Grok #8)
- [~] **Drop a pin / type coordinates** anywhere on the Moon (Grok #9)
- [~] **Full QA pass** of the production build, every feature, EN/TR, desktop/phone; report only (Grok #7) → then fixes (Claude)

## Not started
- [ ] **Final speed check** of the film and 3D scenes on a quiet machine (production build)
- [ ] **Publish today's later work** (art fix, phone mode, QA fixes) the same way: one new commit on top of `main`, no force push
- [ ] **Refresh the Drive presentation kit** (guide updated locally; new screenshots; add the 7-slide deck)
- [ ] **Owner, Vercel keys:** the live `/api/ask` still answers 503 `GEMINI_API_KEY missing`. Add `GEMINI_API_KEY` and `ELEVENLABS_API_KEY` in Vercel → Settings → Environment Variables (Production), then redeploy. There is no key in the repo.
- [ ] **New demo video** recorded from the app. The 7-slide deck is the submission. A project video longer than 30 seconds is not eligible for Global Judging, so keep any recording local.

## Done (this session)
- [x] Rescan fixes: ellipse follows the landing zone; "400 m scale" slope label; relay checked against the terrain horizon; ranges relabelled "across simulations"; the 7.6 M figure explained (flat-enough points × every hour)
- [x] Keep-out 2 km around 16 landed craft; rough S-band link budget in the Workshop; PDF report with QR + provenance; Luna "Data used" line; ✓/× marks on the GO strip
- [x] Phone weight: entry file 1.6 MB → 2 KB (lazy overlays and routes, 3D libraries split and cached), no 3D vehicle row on the phone judges page
- [x] Illustrations with Grok Imagine: 17 engineering-line drawings (goal diagrams, "What next?" cards, judges page), transparent WebP, 0.5 MB total (Grok #6 + review)
- [x] Mission interview chatbot (Grok #5), wired in via Luna "Plan a mission with me"
- [x] Phone mode (tilt-to-look viewer paired with the desktop; added by the other agent, compiles and tests pass)
- [x] **Demo deck**: `presentation-kit/LunaNav-demo.pptx`, 7 English slides, from `presentation-kit/screenshots/`
- [x] **Go live**: the reviewed hackathon tree is published on `main` as one new commit on the previous live history. `main` was not force-pushed. The phone screen stays in the working tree and is not in this publish.
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

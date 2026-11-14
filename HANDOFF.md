# LunaNav handoff

NASA Space Apps 2026 (14–15 Nov 2026), challenge **Lunar Landing Site Navigator**: "where and when should we land on the Moon?"

## What it is

LunaNav is a web app that finds where and when a lander can land on the Moon and survive. For every candidate point it computes the Sun and Earth over the real terrain horizon, hour by hour, for every landing date in a window. The points are 21,856 south-polar points on a 2 km grid and 41,276 points across the whole Moon about 30 km apart. It uses NASA LOLA terrain, JPL ephemerides and Deep Space Network (DSN) visibility, then checks sunlight, Earth contact, longest darkness, battery, slope, landing-zone roughness and distance to ice. The output is ranked GO/NO-GO sites with dates, 3D terrain renders and a Monte Carlo mission success probability. A decision model re-ranks the sites by weighted criteria. There is also a lander/rover drive and walking mode, a cinematic "Tell me the mission" film, a workshop to design your own vehicle, and an AI assistant ("Luna", Gemini). Everything runs in the browser except the Gemini call.

## Architecture

```
lunanav/      Python science package (horizons, illumination, Earth visibility, DSN, regions, CLI/app helpers)
scripts/      Data pipeline: fetch raw data, build the binaries the web app loads (see "Data")
tests/        pytest suite for the Python side (17 files, incl. integrity checks on committed web data)
app.py, simple_view.py   Older Streamlit-style Python front ends (the web app is the product now)
data/         Raw + intermediate data (mostly gitignored, re-fetchable)
docs/         DEMO.md, DEMO_WEB.md, EDUCATORS.md, HACKATHON_PLAN.md, screenshots
hardware/     KiCad files (side project, not used by the web app)
web/          THE PRODUCT: Vite + React 19 + TypeScript + three.js (@react-three/fiber, drei)
  api/ask.ts        Vercel serverless function: Luna's Gemini call (GEMINI_API_KEY, optional GEMINI_MODEL, default gemini-2.5-flash)
  public/data/      Prebuilt binaries: atlas.bin (polar horizons), global_atlas.bin (whole Moon), global_dem.bin (whole-Moon heights,
                    8 px/deg), pole_dem.bin, ephem.bin (2026-11-01 to 2045-12-31 hourly), dsn.bin, hazard.bin, psr.bin, science.bin,
                    thermal.bin, features.json (IAU names), manifest.json, textures
  public/models/    NASA 3D Resources GLBs (Apollo LM, Perseverance as a rover stand-in, LRO) + CREDITS.md; public/draco/ decoder
  src/engine.ts, engine.worker.ts, runner.ts   Search engine in Web Workers (horizon + Sun/Earth + constraints)
  src/model.ts      evaluateWindow: GO/NO-GO, battery, longest dark
  src/probability.ts  Monte Carlo success (launch slip, horizon error, battery wear, tip-over, landing record Beta prior)
  src/decision.ts   TOPSIS multi-criteria ranking + weight-shake robustness
  src/workshop.ts   Vehicle design budgets: rocket equation, power, two-body orbits (LLO/ELFO/NRHO presets)
  src/scienceSites.ts  35 science targets + goals; src/vehicles.ts landers/rovers; src/story.ts mission story
  src/siteRender.ts  Off-screen 3D terrain renders for site cards (polar 200 m grid, else the global grid)
  src/App.tsx       Main page (large): params in the URL hash, Simple/Advanced UIs, overlays
  src/components/   Globe, Drive (lander/rover/walk/landing camera), MissionFilm, LaunchScene, Workshop, DecisionLab,
                    ProbabilityPanel, SimpleView, SiteCard, SiteProfile, Luna (chat), VehiclePhoto, VehicleModels, ...
  src/space.css     The whole theme (F1-drivers-page style)
```

**Data sources:** NASA LRO **LOLA** (polar 5/20/40 m DEMs, LDEM global grids, 40 m slopes), **SPICE** kernels: DE440 + pck00011 + moon_pa_de440 in Python (`scripts/fetch_kernels.py`). `scripts/build_ephem_web.py` uses DE440 when present, otherwise DE421 (valid to 2050). Also **DSN** station geometry (Goldstone, Madrid, Canberra), LRO **Diviner** (ice stability depth, temperatures), PSR maps, the IAU gazetteer, and the USGS Astrogeology mosaics (below).

## How to run

```bash
# web app (the product)
cd web
npm install
npm run dev          # http://localhost:5173
npm test             # vitest (about 231 tests)
npm run lint
npm run build        # tsc -b && vite build -> web/dist
```
Luna (the AI chat) needs `GEMINI_API_KEY` in `web/.env.local` locally or in the Vercel project env. `GEMINI_MODEL` is optional. Without the key, Luna answers from a local rule-based fallback (`src/lunaLocal.ts`). Never commit the key.

```bash
# Python side
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt && pip install -e .
pytest -q
python scripts/fetch_kernels.py      # ~130 MB DE440 kernels into data/kernels
```
Screenshots: `scripts/web_screenshots.py` (Playwright; on Windows it uses `channel="msedge"`).

## Data

| Script | What it does |
| --- | --- |
| `scripts/fetch_kernels.py` | SPICE kernels (DE440 etc.) into `data/kernels` |
| `scripts/fetch_more_data.sh` | USGS Astrogeology S3 mosaics into `data/usgs` (resumable): Artemis 84S/87S terrain packs (+ STL, textures), Ice Favorability Index N/S, LOLA albedo and colour shade, Clementine FeO, Kaguya MI mineral maps, Kaguya TC morning mosaic, Haworth 1 m SfS DEM, LMAP 87S 5 m LDEM + hillshade, NAC south-pole mosaic, LROC WAC 100 m global, **ShadowCam** 1 m south-pole mosaic |
| `build_horizon_atlas.py`, `build_global_atlas.py` | Horizon atlases (`atlas.bin`, `global_atlas.bin`) |
| `build_ephem_web.py`, `precompute_dsn.py`, `precompute_earth_distance.py` | `ephem.bin`, `dsn.bin` |
| `build_hazard.py`, `export_psr.py`, `build_science.py`, `export_thermal.py`, `export_features.py`, `export_global_dem.py`, `export_web_data.py` | The rest of `web/public/data` |
| `artemis_regions.py`, `derive_region_best.py` | Artemis III candidate regions and best points |

**Done:** everything that `fetch_more_data.sh` lists is downloaded locally (about 40 GB in `data/usgs`, gitignored). All web binaries are built and committed. Ephemeris covers 2026-11 to 2045-12.

**Still missing / not used yet:** the Artemis 84S/87S packs, the 5 m LDEM, Haworth 1 m SfS, ShadowCam and the NAC/WAC mosaics are downloaded but **not wired into the web app** (only the Artemis region outlines and ice data are used). The whole-Moon atlas is coarse (about 30 km spacing, global heights about 3.8 km/px). Outside the south pole there is no landing-zone (40 m slope) check, no ice data, and no walking/driving terrain (`pole_dem.bin` is polar only).

## Deploy

Vercel project **"lunanav"**, Root Directory **`web`**, auto-deploys from **`main`**, protected with **Vercel Authentication**. The `api/ask.ts` function needs `GEMINI_API_KEY` in the project env. Work since `e616415` is on branch **`hackathon`**: merge it into `main` to deploy. Tag `pre-hackathon` = `e616415` marks what existed before the event.

## Done features

- Search engine: whole Moon + south pole, any landing window 2026–2045, GO/NO-GO per date, DSN-aware Earth contact
- Constraints: sunlight %, Earth %, longest dark, battery, slope, landing-zone p95 slope (pole), distance to ice (pole)
- Science goals (Simple UI) and 35 science targets (Advanced), Artemis III region head-to-head
- Site cards with 3D terrain renders, site profile pages, comparison, CSV/printable report, shareable URL hash
- Monte Carlo mission success probability with the 2019–2025 landing record; soft vs rough landing
- Decision lab: TOPSIS weights + 500-shake robustness ("robust choice" vs "close call")
- Workshop: design a lander/rover/satellite; budgets drive a real search; orbit coverage
- 3D globe, landing camera (chase/pilot/site), lander + rover driving with route planning, Moonwalk with a torch
- "Tell me the mission" cinematic film (launch, coast, descent, landing, rover, verdict); Luna AI chat (EN/TR, voice)
- Simple and Advanced interfaces, EN/TR, F1-style theme

## Open TODOs (priority order)

a) **Fix the Vercel build:** `web/api/ask.test.ts` line 3 imports `'./ask'`. Vercel's TS (node16/nodenext resolution) fails with TS2835, so change it to `'./ask.js'`, or move the test out of `api/` (for example to `web/src/ask.test.ts` importing `../api/ask`).
b) **Step-by-step mission chatbot:** first ask for a mission brief, then ask follow-up parameters depending on the context (duration, payload, rover, science goal, dates), then run the search. `MissionStory.tsx` and `Luna.tsx` are the starting points.
c) **Launch angle / orbit inclination input:** compute the reachable latitude band, compare several orbit scenarios, rank the best sites for each, and produce a PDF report. `workshop.ts` has orbit maths; `report.ts` has the printable report.
d) **Uncertainty bounds on every number** (sunlight, Earth, dark hours), the longest night, and a solar + battery "does it survive?" verdict on every site.
e) **Landing ellipse:** worst slope, sunlight and Earth view inside the ellipse, not only at its centre.
f) Relay comms (a relay satellite for the far side and PSRs), a libration explainer, a guided tour, a mast-height setting, a new demo video.

Also pending from the last session: a landing page with a QR code for judges (needs the deployed URL), and realistic 3D models for the commercial landers/rovers (see pitfalls).

## Known issues and pitfalls

- **Vercel TS2835** in `api/ask.test.ts` (TODO a).
- **3D vehicle models:** only Apollo LM, LRO and Perseverance (standing in for VIPER) are real NASA models. Nova-C, Blue Ghost, Vikram, Blue Moon, Starship, LRV, Yutu-2 and Pragyan are procedural box models in `VehicleModels.tsx`, and the user finds them childish. NASA publishes no models for those; Sketchfab/CGTrader ones carry creator licences, so check the licence and credit in `public/models/CREDITS.md`.
- drei `<Html>` labels cause React 19 "removeChild" warnings when overlays unmount; the film passes `labels={false}` to Globe.
- An off-screen R3F root (`VehiclePhoto.tsx`) needs `extend(THREE)` and `await root.configure()`. Real GLB models suspend inside their own Suspense, so the capture waits until meshes exist.
- `App.tsx` is about 1,200 lines and holds most of the state; change it carefully. A state named `history` once shadowed `window.history`.
- Windows: Python scripts must open files with `encoding="utf-8"` (cp1252 default). Don't generate TS from Python strings with `\b` (it becomes a control character).
- `data/` is mostly gitignored and about 40 GB locally. Don't commit raw data; only the derived `web/public/data` files are committed.
- The whole-Moon search is coarse (30 km); polar-only features are labelled as such in the UI. Keep that honesty, and remember this is not a landing certification.
- Success probability uses a fixed seed (repeatable) and a Beta prior from 13 landing attempts (8 reached the surface, 5 crashed; 2019 to mid-2025, Peregrine excluded).

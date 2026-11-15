# GROK_TASK_API: a real, working LunaNav API (no more "concept")

Lead: Claude. Written 15 Nov 2026. The owner says the "API concept, not built yet" slide hurts us. Build it for real, so it works on the live site.

Read first:
- `AGENTS.md`;
- `web/api/ask.ts` and `web/api/tts.ts`, for how Vercel functions are written here;
- `web/vite.config.ts` lines 50–70, for how `/api/*` is mounted in dev;
- `web/src/engine.ts` (`parseAtlas`, `parseEphem`, `pointSky`, `searchPoint`, `pointTrack`, `gcKm`, `pointLatLon`);
- `web/src/model.ts` (`evaluateWindow`, `simulateBattery`, `requiredBatteryWh`);
- `web/src/pinSite.ts` (`pickAtlas`, `nearestPoint`, `resolvePin`);
- how `App.tsx` builds the search query (`firstHour`, `constraints`), read only.

## Endpoints (Vercel serverless functions under `web/api/v1/`)

1. **`GET /api/v1`:** an index. JSON with each endpoint, its parameters, an example URL, the data sources (LOLA, JPL DE421, DSN) and the limits ("a planning tool, not a landing certification").
2. **`GET /api/v1/site?lat=-89.45&lon=222.7&start=2027-09-01&days=14`:** evaluate one point.
   - Use the nearest grid point: the 2 km south-pole grid below 84.5°S, the whole-Moon grid elsewhere.
   - Return:
     - the grid point used and its distance from what was asked;
     - for each landing day in the window (default 30): sunlight %, Earth contact %, longest darkness in hours, GO/NO-GO and the reasons;
     - the best day;
     - optional `&series=1`: hourly sun-disc fraction, Sun altitude, Earth altitude and DSN visibility for the best day's stay.
   - Same constraints as the app's defaults: sun ≥70 %, earth ≥50 %, longest dark ≤48 h, battery 2000 Wh, slope ≤8°. Each can be overridden by a query parameter.
3. **`GET /api/v1/search?start=2027-09-01&window=30&days=14&top=10`:** the same south-pole search the app runs. Return the top N sites, each with lat/lon, GO-date count, best date and sunlight/Earth/darkness. Time it. If a full search would exceed about 8 s in a function, cap `window` and say so in the response.
4. **`GET /api/v1/sky?lat=&lon=&from=2027-09-01T00:00Z&hours=72`:** the hourly Sun and Earth sky at a point (altitude, azimuth, horizon, disc fraction, DSN). Cap `hours` at 720.

## How

- **Data:** load `web/public/data/{manifest.json,atlas.bin,global_atlas.bin,ephem.bin,dsn.bin,hazard.bin}` once per warm function. Use `fs` with the files included through `vercel.json` `functions[...].includeFiles`, or `fetch` from the deployment origin; choose what works on Vercel and explain why. Keep `web/vercel.json`'s existing headers.
- **Reuse:** call `engine.ts` and `model.ts` directly. Do not copy the maths. Any small pure helpers go in `web/api/v1/_lib.ts`.
- **Behaviour:**
  - send CORS `*` and JSON with `Cache-Control: public, max-age=3600`;
  - validate every parameter, and return 400 with a clear message for bad input;
  - never leak stack traces.
- **Dev:** mount `/api/v1/*` in `web/vite.config.ts` the same way `/api/ask` is mounted, so it works on `npx vite`.
- **Tests:** `web/api/v1/*.test.ts`.
  - **Parity:** for 3 south-pole points and 1 whole-Moon point, the API's numbers equal what `searchPoint`/`evaluateWindow` give in the browser engine.
  - Parameter validation.
  - The `/api/v1` index shape.
- **Docs:** add an "API" section to `README.md` with 3 copy-paste `curl` examples. `GROK_RESULT_DOCS` already edited the README; add a section, don't rewrite it.

## Files you own
New files in `web/api/v1/`; `web/vite.config.ts` (the dev mount only); `web/vercel.json` (functions config only); `README.md` (an API section only). Nothing else.
Another Grok run is recording a video right now; it doesn't touch code.

## Rules
No git commands. No `npm install` or new packages. EN in API messages.

## Checks (in `web/`)
`npx tsc -b`, `npx vitest run` (all 434+ must pass), `npx eslint api/v1`, `npx vite build`, and `curl` against `npx vite --port 5173` for each endpoint (paste outputs, trimmed, into the report).

## Report
Write `GROK_RESULT_API.md`:
- the endpoints, with real example responses (trimmed);
- timings;
- the check results;
- anything that can't work on Vercel's plan, and what you did about it.

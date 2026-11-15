# CODEX_TASK_2 result — 15 November 2026

Implemented within the assigned files only. No git commands, dependency installs, commits, pushes, asset downloads, or edits to another run's files. **Runtime acceptance is still unverified:** this session cannot spawn Node, Python, Vite, or Edge. Do not treat the projected transfer savings below as a Playwright before/after measurement.

## Measurements

The exact requested curl HEAD command was attempted. Windows curl failed before receiving headers: `schannel: AcquireCredentialsHandle failed: SEC_E_NO_CREDENTIALS (0x8009030e)`. A HEAD-only attempt through Node HTTPS also failed. Consequently, whether the deployed Vercel response already uses compression is UNKNOWN.

Local byte measurements used the installed Node zlib APIs, gzip level 9 and Brotli quality 11. Every listed compressed buffer was decompressed and compared byte-for-byte with the source. Sizes are bytes, ordered original / gzip / Brotli:

- atlas.bin: 4,087,086 / 2,352,084 / 1,772,678
- dsn.bin: 168,024 / 1,651 / 1,525
- ephem.bin: 4,704,672 / 3,935,980 / 2,898,739
- global_atlas.bin: 3,260,810 / 2,156,809 / 1,696,516
- global_dem.bin: 8,294,410 / 7,284,425 / 5,696,870
- hazard.bin: 87,437 / 72,455 / 70,267
- pole_dem.bin: 4,602,602 / 4,091,373 / 3,061,792
- psr.bin: 6,390,796 / 2,240,065 / 1,925,082
- science.bin: 65,572 / 32,755 / 28,544
- thermal.bin: 4,793,100 / 1,912,111 / 1,584,392

All 73 binary files, including nested spot series/patches: **87,807,421 original bytes → 53,626,928 gzip bytes**. Every file is smaller; all 73 round-trip exactly.

The five startup binaries found by reading App.tsx (atlas, ephem, dsn, hazard, science) total **9,112,791 original → 6,394,925 gzip bytes**, 29.8% smaller. This is a payload-size projection, excluding headers, JS, JSON, images and in-flight requests. It is not an observed browser transfer total. Brotli would total 4,771,753 bytes; gzip was selected for broad, explicit HTTP encoding support and simple local serving.

Actual production-preview cold-cache bytes through the first results card:

- BEFORE: unavailable; process execution blocked before the baseline build/preview/browser could run.
- AFTER: unavailable for the same reason.
- No measured first-card timings or claimed measured before/after reduction.

## Implementation

- `web/scripts/compressData.ts:6`: recursively emits lossless `.bin.gz` siblings into build output, covering all binary files, not just the top-level ten. Original public files stay untouched. Existing compressed copies are regenerated on each build.
- `web/scripts/compressData.ts:15`: Vite plugin serves gzip at the original `.bin` URL in dev and preview. Browsers perform HTTP decompression before existing `arrayBuffer()` parsers run. Dev caches compression by file modification time. Preview reads generated gzip copies. Non-gzip clients retain Vite's original response; HEAD and missing-file fallback are handled. Request paths are constrained to the data directory.
- `web/vite.config.ts:4,74`: registers that plugin, including for direct `npx vite build`; no package script or dependency changes required.
- `web/vercel.json:2`: rewrites binary requests to generated gzip siblings and declares `Content-Encoding: gzip` / binary Content-Type. Existing caching headers remain. Headers also cover direct `.bin.gz` requests. This configuration still needs validation on a Vercel deployment; no deployment was attempted.
- `web/public/sw.js:4`: bumps the cache version so previous cached uncompressed binaries do not hide the new delivery behavior. URLs remain unchanged and the existing worker caches browser-decoded responses. Real cold/warm/offline browser behavior remains to be checked.
- `web/src/resultsPaint.ts:3`: shared gate waits for a results card or advanced results-table row, then two animation frames. Decorative terrain cannot start fetching its DEM before that paint opportunity. If no results exist, decorative rendering intentionally stays pending.
- `web/src/siteRender.ts:94`: all terrain thumbnails use that gate. Nonpolar thumbnails no longer fetch the 4.6 MB polar DEM before fetching their global DEM. Terrain calculations and source binary bytes are unchanged.
- `web/src/components/DeferredHeroMoon.tsx:7`: prepared wrapper that mounts the textured backdrop after results paint. It is deliberately not wired into the other run's SimpleView.tsx; the exact one-line patch is below.
- `web/scripts/compressData.test.ts`: regression test for recursive output, byte parity, leaving images untouched and rebuilding changed binaries.
- `web/src/resultsPaint.test.ts`: tests the results/paint boundary and shared gate.
- `web/scripts/measureFirstLoad.py`: reproducible Edge/Playwright network measurement for cold, warm service-worker and offline service-worker visits. Uses CDP encoded network lengths, including partial in-flight transfers, and records all requests at the first card plus five seconds later. External requests are blocked; only the local preview is fetched.

No changes were needed in data.ts, siteExtras.ts or HistoryPanel.tsx: transparent HTTP encoding covers their existing binary fetches. JSON and already compressed JPEG files are not gzipped by this plugin.

## Startup/lazy-loading findings (source inspection, NOT a network trace)

- App loads manifest, atlas, ephem and DSN, then hazard/science, before exposing its main UI. Features JSON is also fetched at startup. Global atlas is loaded on demand for whole-Moon searches/sun overlay.
- siteRender formerly fetched pole_dem even for nonpolar thumbnails. It now fetches the appropriate DEM only after results paint. global_dem is therefore also behind this gate.
- psr.bin and thermal.bin are fetched in Drive's loadPack, not by startup App or thumbnail rendering. They are already on demand when Drive mounts; no Drive edit is required for compression or deferral.
- siteExtras loads its polar DEM on demand for the mast experiment.
- SimpleView mounts HeroMoon immediately; its moon_albedo.jpg (2,813,280 bytes), moon_normal.jpg (1,062,320) and earth.jpg (903,660) remain eager until the SimpleView patch below is applied. Pausing a canvas does not defer useTexture. Advanced Globe also requests its maps when mounted. These are explicit outstanding cross-owner integrations, not claimed as fixed.

## Exact patches for the other owners

### App.tsx: replace the early loading return (line 512 at final inspection; use the exact anchor below because another run is editing this file)

OLD:

```tsx
  if (!m || !atlas || !atlasPole) return <><div className="loading"><Patch size={72} />LunaNav<small>{lang === 'tr' ? 'NASA verisi yükleniyor…' : 'loading NASA data…'}</small></div></>
```

NEW (uses existing imports/styles; no NASA data is required to render it):

```tsx
  if (!m || !atlas || !atlasPole) return (
    <div className="app">
      <header className="nav">
        <a className="logo" href="#top"><Patch size={34} /><span className="logo-word">Luna<b>Nav</b></span></a>
      </header>
      <div className="shell simple-shell" id="top">
        <main className="main" aria-busy="true">
          <section className="s-hero">
            <div className="s-hero-text">
              <h1>{lang === 'tr' ? <>Ay’da <em>nereye</em> ve <em>ne zaman</em> inmeli?</> : <>Where and when to <em>land</em> on the Moon</>}</h1>
              <p role="status" aria-live="polite">{lang === 'tr' ? 'NASA verisi yükleniyor… Görev planlayıcısı hazırlanıyor.' : 'Loading NASA data… Preparing the mission planner.'}</p>
              <p>{lang === 'tr' ? 'Bir planlama aracıdır; iniş sertifikasyonu değildir.' : 'A planning tool, not a landing certification.'}</p>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
```

Do not simply remove the guard: the rest of App dereferences the loaded objects. No binary-loader patches are needed in App.tsx, including ensureMoon: the server sends HTTP-encoded data at the existing URLs.

### Drive.tsx

**No patch required.** Keep its existing pole_dem / psr / thermal fetches in its on-demand loadPack. HTTP decoding preserves exactly the buffers it expects. No app-level DecompressionStream calls should be added (that would decode twice).

### SimpleView.tsx: required texture deferral integration (file intentionally untouched)

OLD:

```tsx
import HeroMoon from './HeroMoon'
```

NEW:

```tsx
import HeroMoon from './DeferredHeroMoon'
```

The wrapper has already been created and type/lint checked. It defers all three backdrop texture requests and the HeroMoon module until after results paint, while retaining the existing backdrop placeholder class. This is necessary to finish the large-texture part of the task for the default Simple screen. Advanced Globe texture deferral needs a similar post-results mount in App if the advanced route must meet the same boundary; its existing Suspense boundary alone does not defer texture requests.

## Checks and limitations

- Requested `npx tsc -b`, `npx vitest run`, `npx eslint ...`, `npx vite build`: attempted, but `npx` is unavailable on PATH. Explicitly invoking the existing Node binary was rejected with Access denied. Child-process execution through the JavaScript tool was also rejected with EPERM. No permission bypass or installation was attempted.
- Fallback TypeScript compiler API: **PASS, zero pre-emit diagnostics** for both tsconfig.app.json and tsconfig.node.json, including the imported build script and new components/tests. This does not claim that `tsc -b` ran.
- Fallback ESLint API: **PASS, zero messages** on every changed TS/TSX/JS file, including the new tests. This does not claim that the CLI ran.
- Direct execution of the transpiled compression helper on temporary fixtures: **PASS** for nested files, byte parity, no image compression, regeneration after source change.
- Direct execution of dev middleware against the real atlas: **PASS**, gzip headers and 2,352,084 encoded bytes, decoded buffer exactly matches source; `gzip;q=0` correctly falls back.
- Direct execution of preview middleware against a temporary compressed real ephemeris: **PASS**, base-path handling, gzip headers and 3,935,980 encoded bytes, decoded buffer exactly matches source; missing-file fallback passed.
- All 73 binary gzip round-trips: **PASS**, every compressed file smaller than its original. Ten top-level Brotli round-trips: **PASS**.
- Vitest (including Python-reference parity tests): **NOT RUN**, blocked. The new regression tests are present but their Vitest execution is unverified.
- Root `.venv/Scripts/python.exe -m pytest -q`: attempted because a Python measurement script was added; uv trampoline cannot spawn Python (permission denied).
- Required `.venv/Scripts/python` Playwright launch with `channel="msedge"`: **NOT RUN**, uv trampoline cannot spawn Python (permission denied).
- Production build, real Vite HTTP serving, Vercel routing, first-card timing/transfers, and cold/warm/offline SW behavior: **NOT VERIFIED**. Direct middleware checks do not substitute for these acceptance checks.

## Finish verification in an unrestricted project terminal

First capture a true BEFORE baseline from the owner's unchanged snapshot (not the concurrently modified tree), with the measurement script available. Do not label a measurement of the current modified files as BEFORE. Build the original app using `npx vite build`, then start `npx vite preview --port 4173 --strictPort`, and run `..\.venv\Scripts\python scripts/measureFirstLoad.py before` in web/. Preserve its JSON.

After applying the cross-owner patches and these assigned changes, run the required type/test/lint/build commands. Restart preview so it uses the new plugin, then run the measurement script with `after`. Compare `wire_bytes_through_first_card` and request lists for the same route/viewport. Use separate fresh browser contexts as the script does. Repeat a request in vite dev and verify `Content-Encoding: gzip`, decoded bytes and warm reloads. The measurement script exercises preview cold/warm/offline SW visits; observe that psr/thermal are absent before opening Drive, and DEM/backdrop requests begin only after the first cards. Use a second Advanced-route measurement if relevant.

Finally validate the gzip rewrite on a Vercel preview deployment (the owner controls publishing): check headers and verify response-decoded bytes against the committed binaries. The live Content-Encoding question, actual before/after network evidence, and full test/parity run remain open acceptance items.


## Verification run

15 November 2026. Baseline built from HEAD df63a95 in the requested `../lunanav-before` worktree, with a junction to the existing web/node_modules. Served on 4180; current production build served on 4173. Baseline preview stopped, junction removed safely, and worktree removed with the authorized command. Only git worktree add/remove, status were used; no commits, pushes, resets, checkout or stash. No other agent-owned source files or task files edited.

Measured with Edge / Playwright, 1440 ? 900, identical Simple route, local production previews, no artificial throttling:

- BEFORE cold: `wire_bytes_through_first_card = 21,771,265`; first card **2,523.8 ms**.
- AFTER cold: `wire_bytes_through_first_card = 18,746,713`; first card **4,329.8 ms**.
- Reduction: **3,024,552 bytes (13.9%)**. Timing regressed in this single local run; no speedup claim. Concurrent builds/browser work and local gzip costs make this unsuitable as a bandwidth-limited live-site timing estimate.
- BEFORE warm SW / offline SW: 4,434.4 / 3,411.0 ms; page-observed network bytes 0 / 0.
- AFTER warm SW / offline SW: 2,938.8 / 4,733.9 ms; page-observed network bytes 0 / 0. Both actually navigate anew and render cards. These zeroes describe page CDP traffic, not worker-level network accounting.
- Raw request logs: `web/scripts/first-load-before.json`, `web/scripts/first-load-after.json` (UTF-8). The first-card boundary includes two animation frames and partial in-flight bytes, so requests released by the paint gate can already appear in this snapshot.

Cold measurement explicitly blocks service workers: otherwise a newly activated worker handles initial data downloads and page CDP incorrectly reports zero for those network bytes. Warm/offline measurements use a separate, primed service-worker-enabled context. Each measurement first navigates to about:blank to ensure a real reload rather than same-document hash navigation. External network requests remain blocked.

### Live response and deployment decision

Exact requested curl HEAD succeeded:

```text
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Age: 1242
Cache-Control: public, max-age=86400, stale-while-revalidate=604800
Content-Disposition: inline; filename="atlas.bin"
Content-Encoding: br
Content-Type: application/octet-stream
Date: Sat, 14 Nov 2026 21:41:45 GMT
Etag: W/"786229cb26cd1eca9608c8834da45bc7"
Last-Modified: Sat, 14 Nov 2026 21:21:02 GMT
Server: Vercel
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Vercel-Cache: HIT
X-Vercel-Id: fra1::pczn4-1794692505533-ecf7ad4bc7fd
```

Vercel already compresses this binary using Brotli. Removed the `.bin` ? `.bin.gz` rewrite and forced gzip headers from `web/vercel.json`, preserving original cache headers. Native Vercel content negotiation is preferable to forcing the larger gzip representation. Local dev/preview gzip middleware and generated build siblings remain for local verification; Vercel serves original binary URLs with its own compression. Local BEFORE/AFTER compression savings therefore must NOT be projected as new production savings: production already had Brotli.

### Checks

- PASS: baseline `npx vite build`.
- PASS: `npx tsc -b`.
- PASS: `npx vitest run`: 30 files, 396 tests, including model/reference parity and compression/gate tests.
- PASS: `npx eslint scripts/compressData.ts scripts/compressData.test.ts src/resultsPaint.ts src/resultsPaint.test.ts src/components/DeferredHeroMoon.tsx src/siteRender.ts public/sw.js vite.config.ts` (no messages).
- PASS: current `npx vite build` (usual large-chunk warning only).
- PASS: Playwright cold, warm SW and offline SW visits, BEFORE and AFTER.
- PASS: live curl headers check; already Brotli.
- PASS: real HTTP dev (4181) and preview (4173) atlas responses declare gzip and decompress byte-for-byte to the original binary.
- Python pytest: attempted as an extra check; stopped after a prolonged run with little progress. No scientific Python source changed; the measurement script itself ran successfully.

### Changes in this run and remaining limits

Changed only `web/vercel.json`, `web/scripts/measureFirstLoad.py`, generated measurement JSONs and this report. No dependency installs were intended; an initial baseline junction path error caused npx to announce a missing-vite install attempt, which was immediately interrupted. All subsequent commands used `--no-install` and the project's installed dependencies.

The cold traces confirm psr.bin, thermal.bin and global_dem.bin are absent through the first card. The current SimpleView still imports HeroMoon directly. Moon/earth backdrop textures remain eager, and polar DEM/terrain textures appear by the two-frame measurement boundary. The prior exact `SimpleView.tsx` import patch remains outstanding for its owner; no prohibited file was edited. The shell patch in App also remains a cross-owner integration. Consequently the transfer reduction is verified locally, while the full first-load presentation/texture-deferral objective and a live-site speed improvement remain incomplete until those integrations are applied and measured.

## Run 2c

Removed the compression plugin import/registration from `web/vite.config.ts`, deleted `compressData.ts`, `compressData.test.ts`, and both generated `first-load-*.json` logs. Kept `measureFirstLoad.py`. The deferral gate/tests, siteRender, DeferredHeroMoon, service-worker cache version and vercel.json were left untouched. No git commands or installs were used.

Checks used `npx.cmd --no-install` because PowerShell blocks the `npx.ps1` wrapper:

- `tsc -b`: FAILED with TS6133 unused imports in `src/App.tsx:4`: `fmtHoursShort`, `fmtIsoDate`, `fmtPercent`, `verdictLabel`. This file is outside the allowed scope and was not edited.
- `vitest run`: PASS, 31 test files / 406 tests.
- `eslint vite.config.ts`: PASS.
- `vite build`: PASS, with the large-chunk warning only.
- After the build, `cmd /c dir /s /b web\dist\*.gz` from the repo root returned `File Not Found` (exit 1, no matches): no `.gz` files, including `.bin.gz`, remain in the build output. Vite's displayed gzip-size estimates do not create compressed sibling files.

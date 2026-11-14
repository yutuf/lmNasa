# LunaNav: Space Apps 2026 plan ("Where to land on the Moon")

Written 14 Nov 2026, about 30 minutes into the event. The deadline is the end of 15 Nov.

## Where we are

LunaNav already answers the challenge question head-on: *where and when should we land?* The aim this weekend is
to **deepen and prove it**, not to change direction.

**What's strong**
- An in-browser search over 21,856 south-pole points, hour by hour, against real LOLA horizons, in about 1.8 s.
  It checks sunlight, Earth contact, DSN, longest darkness, battery and slope.
- Ranked results, a GO / NO-GO verdict with the reason in one sentence, side-by-side comparison, CSV export and a report, and a link you can share.
- Real NASA data, cited for every layer. Tests: web 180/180, Python 101/102 (one Windows encoding bug, see Q2).
- A "be there" lander and rover view, Ask Luna (the AI guide), EN/TR.

**What a landing-site judge will still ask**
- "Is it **safe to touch down** there?" Slope at 2 km is not hazard. There is no roughness, boulder or crater-density layer, and no landing-ellipse check.
- "Is it **worth** landing there?" Ice is shown in the rover game, but science value is not a search criterion or a ranking term.
- "Can I **get down** there?" There is nothing on the approach: terrain visibility and lighting during descent.
- "How sure are you?" The validation exists (Mazarico comparison, horizons fixture) but is buried in the README.
- "Why this site over Artemis III's?" The regions are shown, but there is no head-to-head story.

## ⚠️ Risk to settle first: work done before the event

Git shows **77 commits from 10 Nov to 14 Nov 06:10**. The event runs 14–15 Nov. The repo is public at `github.com/yutuf/lmNasa`, and the README links a Streamlit app that was already live.
- Read the Space Apps rules on prior work and open-source reuse first.
- **Disclose** what existed before the event in the submission and README.
- Tag the baseline now (`git tag pre-hackathon`) and make every new feature a dated commit on top.

## The path (time-boxed)

### Phase 0: now to +1 h. Aim
- [x] Get the web app running locally (`.claude/launch.json` was pointing at the old `Desktop/lmNasa` folder).
- [ ] Paste the exact challenge objectives here and map each one to a feature below. Cut anything that doesn't map.
- [ ] Settle the prior-work question.
- [x] Quick wins Q1–Q4 done (tag `pre-hackathon` = e616415).

### Phase 1: +1 to +10 h. "Safe to land": a touchdown hazard layer
- [x] **Hazard per point** (done: `scripts/build_hazard.py` → `hazard.bin`, 95th-percentile LOLA 40 m slope in 100/250/500/1000 m zones; agrees with LOLA's own LDSM 40 m slope map at 6,620 points: median 1.15°, r = 0.94). Roughness still to add: Add LOLA roughness (RMS slope at 5–20 m baselines from the 5 m site DEMs and the polar grid) and the maximum slope inside a landing ellipse, not only at the centre.
- [x] **Landing zone** as a circle, filtered in the search, shown in the table and site detail (done). Still to do: draw it on the globe.
- [ ] ~~Landing ellipse~~ Let the user set an ellipse (e.g. 100 m × 100 m for HLS-class precision, or 1 km for a CLPS-class lander). A site passes only if the whole ellipse is safe *and* lit. Draw the ellipse on the globe and in the site detail.
- [x] New requirement controls (done: zone radius + "95% of the zone gentler than"). Still to do: the NO-GO reason text. Original note: *max hazard inside ellipse* and *ellipse size*. Add the hazard to the GO / NO-GO reason ("NO-GO: 14° slopes inside the ellipse").

### Phase 2: +10 to +20 h. "Worth landing": science and resources
- [ ] **Science value term.** Distance to the nearest permanently shadowed region, plus the USGS ice-favourability index, plus Diviner ice-stability depth (the data is already in the app for the rover). Make it a search criterion and a ranking term with a visible weight.
- [ ] **Trade-off view.** Plot survivability (sun, comms, battery) against science value, with the Pareto front highlighted. This is the picture judges will remember: "the best spots are the ones that are both safe *and* near ice".
- [ ] Make the ranking weights explicit and adjustable. Show the score broken down term by term (the Streamlit planner already has the breakdown; port it).

### Phase 3: +20 to +32 h. Prove it and compare
- [ ] **Artemis III head-to-head.** For each of the nine NASA candidate regions: the best point we find versus NASA's published point, compared on sun %, Earth %, longest darkness, hazard and science. Present it as a single table.
- [ ] **Validation panel in the app**, not only in the README: our sunlit % against Mazarico et al. 2011, our ephemeris against JPL Horizons, our eclipses against NASA's catalogue. Show one number each.
- [ ] **Launch-slip robustness.** Show how many days the launch can slip before a site goes NO-GO. The Streamlit app has this; bring it to the web site-detail page.
- [ ] Deploy to Vercel and check it on a phone.

### Phase 4: +32 h to the deadline. Pitch (freeze code about 4 h before)
- [ ] Put a 30-second answer at the top of the README: problem → what LunaNav does → one number. The README is 36 KB right now; move the details down.
- [ ] A 2-minute video: describe a mission → 1.8 s search → hazard-checked GO site → science trade-off → Artemis III comparison → "stand on the lander".
- [ ] Fill in the submission form, with the data-source table (already written) and the prior-work disclosure.

## Improvement list

**Quick wins (do now)**
- Q1. Decide what to do with the untracked `data/gazetteer/` (46 MB shapefile) and `data/earth/` (1.8 MB). Gitignore them and fetch them from a script, or commit only the small derived JSON. Don't push 46 MB.
- Q2. Fix the Windows encoding bug: `scripts/derive_region_best.py:106` and `:171` call `read_text()`/`write_text()` without `encoding="utf-8"`. This breaks `tests/test_region_best.py` and could corrupt `data/derived_sites.yaml`. Grep the other scripts for the same pattern.
- Q3. Add `"test": "vitest run"` to `web/package.json`.
- Q4. `git tag pre-hackathon`.

**Must (for the landing-site story)**
- M1. Hazard layer: roughness, plus slope across the whole landing ellipse.
- M2. A landing-ellipse requirement, drawn on the map.
- M3. A science / ice value term in the search and the ranking.
- M4. The survivability-vs-science trade-off chart.
- M5. Artemis III head-to-head table.
- M6. Validation numbers visible in the app.

**Should**
- S1. Adjustable ranking weights, with the score breakdown.
- S2. Launch-slip robustness on the web site-detail page.
- S3. Descent check: the Sun's elevation and azimuth at touchdown, and whether the approach direction looks into the Sun (bad for optical hazard detection).
- S4. Teach Ask Luna the new criteria: "find a safe site within 2 km of ice that keeps Earth in view".
- S5. A first-run hint on the landing screen ("Try: Long stay → Run search → click #1"), so judges get value in 10 seconds.

**Nice / only if ahead**
- N1. Mid-latitude and far-side mode, using the global grid that already exists in Python.
- N2. Crater and boulder density from published LROC catalogues, if one can be fetched quickly.
- N3. Split `App.tsx` (704 lines) and `Drive.tsx` (951 lines), only if a feature forces it.

**Don't spend time on (this weekend)**
- Hardware PCBs and enclosures. Show them as photos only.
- The Streamlit planner, beyond porting its slip and score-breakdown ideas.
- The rover game and more 3D eye-candy. It's already a strong "wow"; keep it as the last 15 seconds of the demo.

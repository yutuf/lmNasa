# 2-minute demo script

Every scene is a link: append the part after the app address (e.g. `https://<your-app>/` + `?site=…`).
The address holds the whole scenario, so each scene opens exactly as described. All verdicts and
numbers below are checked automatically on every push (`tests/test_demo.py`); default lander and
mission settings (14 days, 70 % sunlight, 50 % Earth, 2,000 Wh battery).

---

**0. The question (15 s)** — open the app with no parameters.

> "A solar lander near the Moon's south pole needs sunlight for power and Earth in the sky to talk
> home. Near the pole the Sun skims the horizon, so a hill a few hundred metres high decides
> everything. LunaNav checks every candidate site against every landing date, using NASA's terrain
> and JPL's ephemeris, hour by hour until 2028."

Point at the heatmap: bright = go. Point at the map: the green boxes are NASA's nine Artemis III regions.

**1. Same day, three spots within 5 km (45 s)**

`?site=malapert_massif&start=2027-09-09T00:00`

> "The published Malapert point, landing 9 September 2027: **NO-GO**. Sunlight 45 %, a 164-hour
> shadow."

`?site=malapert_massif_derived&start=2027-09-09T00:00`

> "447 metres away: sunlight 90 %, Earth 100 %. Still NO-GO, but only because the battery dies in a
> 35-hour shadow. LunaNav tells us exactly what would fix it: **6,598 Wh**."

`?site=malapert_massif_derived&start=2027-09-09T00:00&batt=6600`

> "Give it 6,600 Wh: **GO**."

`?site=malapert_massif_region_best&start=2027-09-09T00:00`

> "Or search the whole Artemis region: 5 km west there is ground with sunlight and Earth 100 % of the
> time: **GO** with the small battery. Terrain beats latitude."

**2. Why the pole at all? (25 s)**

`?site=apollo_11&start=2026-11-01T00:00`

> "Apollo 11's site, landing at nightfall: two weeks of darkness, **NO-GO**; surviving it would take
> **66,316 Wh** of battery."

`?site=apollo_11&start=2027-02-12T00:00`

> "Land at sunrise instead and it needs no battery at all. At the equator the date decides everything;
> at the pole, the exact spot does."

**3. Can we trust it? (20 s)** — on any site, read the 🧊 line under the metrics.

> "We checked LunaNav against NASA's own 18.6-year illumination maps: where nobody optimised the spot
> they agree to about two points. On narrow crests the answer depends on where each terrain map puts
> the crest; we say so in the app. And we found that the IM-2 landing point sits in the Mons Mouton
> *Plateau* region, not the Mons Mouton one."

**4. Close (15 s)**

> "Every site has a source, every computed point is labelled, every number is reproducible, and the
> page address shares the exact scenario. It's open source: github.com/yutuf/lmNasa."

---

**Offline backup** (no internet at the venue): the same scenes as screenshots of the real app,
regenerated from these exact links.

| scene | screenshot |
|---|---|
| 1. published Malapert point, NO-GO | [demo/1a_malapert_published.png](demo/1a_malapert_published.png) |
| 1. derived point, battery fails (needs 6,598 Wh) | [demo/1b_malapert_derived.png](demo/1b_malapert_derived.png) |
| 1. derived point with 6,600 Wh, GO | [demo/1c_malapert_derived_6600Wh.png](demo/1c_malapert_derived_6600Wh.png) |
| 1. best point in the region, GO | [demo/1d_malapert_region_best.png](demo/1d_malapert_region_best.png) |
| 2. Apollo 11 at nightfall, NO-GO (66,316 Wh) | [demo/2a_apollo11_nightfall.png](demo/2a_apollo11_nightfall.png) |
| 2. Apollo 11 at sunrise, GO | [demo/2b_apollo11_sunrise.png](demo/2b_apollo11_sunrise.png) |

To run the app on a laptop without internet: `streamlit run app.py`, then use the same links on
`http://localhost:8501/`.

---

Honest-answer cheat sheet for questions:
- *Is the lander real?* No, illustrative (400 W array, 150 W load); all lander numbers are editable.
- *How accurate is the terrain?* LOLA 40 m/pixel; boulders and small craters are not visible.
- *Is Earth "in view" enough for radio?* It means Earth's centre is above the terrain; no antenna model.
- *Why do your best points look better than NASA's map?* NASA's map reaches similar values within
  ~100 m; read ours as the upper end (README, "Crest check").

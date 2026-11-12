# LunaNav in the classroom

Four short activities (15–25 min each) for ages ~14+. Open the app, then use the sidebar,
the heatmap, the site list and the **Inspect one option** section (360° view + time slider).

All numbers below come from LunaNav's committed data (JPL DE440 ephemeris, LOLA terrain,
1 Nov 2026 – 31 Dec 2028, hourly) and the app's default illustrative lander (400 W solar array,
150 W load). If you change the settings, the numbers change; that is part of the lesson.

---

## 1. Why is the south pole so different?

**Do:** In *Inspect one option*, pick **Apollo 11**, then the **Shackleton – de Gerlache connecting
ridge**. Move the time slider and watch the 360° view.

**Ask:** How high does the Sun get? Where is Earth? How long are the nights?

**What students should find**

| | Apollo 11 (equator) | Shackleton ridge (89.4° S) |
|---|---|---|
| highest Sun | 89.8° (overhead) | 2.1° (skims the horizon) |
| Earth's height | always 58–74° up | between −7.6° and +6.2°: often below the horizon |
| sunlit share | 49.8 % (two-week day, two-week night) | 91.1 % |
| longest stretch without usable Sun | 14.8 days | 6.5 days |

**Big idea:** near the pole the Sun circles the horizon once a month instead of rising and
setting, so a high ridge can stay in sunlight almost all the time, while Earth hangs so low that
hills block it.

---

## 2. Terrain beats latitude

**Do:** Pick **Malapert Massif**, then the derived point **↳ 447 m NE** under it. Compare the
"Sunlit" and "Earth in view" numbers, and the terrain line in the 360° view.

**What students should find:** the metrics show the selected mission; over the whole data period,
moving less than half a kilometre changes Earth visibility from **44 % to 100 %** of the time and
sunlight (at least half the Sun's disk) from **42 % to 67 %**. The local hill line, not the latitude,
decides what the lander can see.

**Extension:** find another region where the derived point helps a lot (Peak near Cabeus B:
Sun + Earth together 9 % → 48 %) and one where it barely helps (de Gerlache Rim 2: 22 % → 22 %).
Why might that be? (Look at the 360° view: is the horizon high in every direction?)

---

## 3. How big a battery?

**Do:** Pick **Apollo 11**, set *Surface duration* to 14 days, and move the **Start** slider.
Read the line "🔋 Battery needed for this mission".

**What students should find:** for a 14-day stay at Apollo 11 the battery needed ranges from
**0 Wh** (land at local sunrise: two weeks of daylight) to **66,316 Wh** (land at sunset: the whole
lunar night on battery). At the Shackleton ridge, half of all landing dates need no battery at all;
the worst date needs 35,165 Wh.

**Discuss:** 66 kWh is roughly the battery of a large electric car, for a lander drawing only
150 W. Why do real lunar-night survivors need heaters, insulation or nuclear power? Why do
missions aim for the poles?

---

## 4. How do we know the computer is right?

**Do:** Pick **Haworth (Artemis III region centre)**, then the **Shackleton – de Gerlache connecting ridge**. Under the
metrics, read the 🧊 line: it shows NASA's own number for the same spot, from an independent
18.6-year calculation (Mazarico et al. 2011).

**What students should find** (average share of the Sun's disk that is visible):

| | LunaNav | NASA, 120 m map | NASA, 60 m map |
|---|---|---|---|
| Haworth region centre (flat ground) | 10.0 % | 10.7 % | 10.4 % |
| Shackleton ridge point (narrow crest) | 91.1 % | 78.3 % | 44.3 % at the point, 75.5 % just 73 m away |

**Discuss:** on flat ground two independent models agree to within a point. On a crest only a pixel or
two wide, the answer depends on exactly where each map puts the crest: NASA's own two maps disagree
with each other there. Another study (Gläser et al.) measured 88 % at this ridge point from 2 m up.
Scientists trust a number more when independent methods agree, and they say so when they do not.

---

**Honesty notes for teachers:** the lander is illustrative, not a real spacecraft; "Earth in view"
means Earth's centre is above the terrain (no radio details); terrain is a 40 m map, so boulders
are invisible. Every site shows its source at the bottom of the app.

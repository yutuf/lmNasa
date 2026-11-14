# 2-minute demo: the web app

Run it locally with `cd web && npm run dev`, then open http://localhost:5173, or use the deployed site. The address
holds the whole mission, so every scene below opens exactly as described. The numbers are from this build, with
the default settings: the **Lander** scenario and a landing window of 1 Sep 2027 + 30 days. If you change the data
or the defaults, check them again before presenting.

---

**0. The question (15 s).** Open the app.

> "Near the Moon's south pole the Sun skims the horizon, so a few hundred metres decide whether a lander has
> power, can talk to Earth, lands safely, and is near water ice. LunaNav answers *where and when* in one screen."

Point at the 3-step guide, then at the line under *Run search*: **21,856 points, about 12 million hour-by-hour
checks, a second or two.**

**1. The ranked answer (20 s).** Scroll to *Best landing sites*.

> "For a 14-day robotic lander, the best place is the **SW rim of Shoemaker**: GO on 5 of 30 landing dates, best on
> 10 September 2027, sunlight 100 %, Earth contact 81 %."

Open site 1 and read the three lines under the verdict:
- the touchdown zone: 95 % of the 1 km zone is gentler than about 11.5°;
- water ice: the nearest cold trap is 2.0 km away;
- the approach: it descends heading south, with the Sun 1.8° high and well behind the lander.

Also point at the launch window: **5 GO landing dates in a row, 7–11 Sept 2027.**

**2. Safe to land? (20 s).** In *Touchdown zone*, switch the radius between **Off** and **1 km** and press *Run search*.

> "Without the touchdown check, sites on steep crater rims rank high. With it, the 1 km landing zone must be gentle
> too, so the ranking changes."

Our slopes agree with LOLA's own 40 m slope map: median 1.15°, r = 0.94 over 6,620 points.

**3. NASA's regions, head to head (25 s).** Scroll to *Artemis III regions, head to head*.

> "For this mission, **every region centre inside our search area fails a terrain check**: too steep at the site or
> in the landing zone. Yet inside five of those regions LunaNav finds points that pass, 4 to 13 km away. Mons
> Mouton Plateau: 4 of 30 dates, 1.3 km from ice."

Click that row: it opens the point.

**4. Survival vs science (15 s).** Scroll to *Survival vs science*.

> "Every site that passes: how often, and how far from water ice. The blue line is the honest trade-off. Shoemaker
> passes most often with ice 2 km away; a Mons Mouton Plateau spot is only 0.5 km from ice but passes on 3 dates."

**5. Other missions (15 s).** Press *Simulate all scenarios*.

> "Same window, six kinds of mission, from a crewed landing to a rover that must sit next to ice, in a few
> seconds. Click any row to open that scenario."

**6. Getting there (10 s).** On the globe, press **Route**.

> "From Earth into a polar orbit over the chosen site, then the descent, approaching with the Sun behind the
> lander so the hazard cameras aren't blinded."

**7. Ask Luna (optional, 10 s).** Open *Ask Luna* and type: *a 3-week rover in spring 2027 near water ice that
must always reach Earth*. Luna sets up the search and runs it, with no AI key needed. Then ask: *what if the launch
slips a week?*

**Close (5 s).**

> "Open source, every number checked against NASA's own data: *Method & data* lists the six checks."

---

Backup: if the network fails during the demo, everything above runs offline in the browser. Only the Gemini answers
in step 7 need the internet, and the offline guide answers anyway.

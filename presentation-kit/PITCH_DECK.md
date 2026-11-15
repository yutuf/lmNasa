# Touchdown: 7-slide pitch deck (content draft v2)

Team: **No Limits Lunar**.

Built from the "English pitch deck" prompt and the two training decks. The rules taken from them:
- A pitch is a compass, not an encyclopedia: be understood first, then build trust, then persuade.
- Every headline states a conclusion.
- One slide carries one idea and one visual.
- Technical detail is saved for Q&A.
- Nothing is invented. Placeholders are in [BRACKETS].

The audience is NASA Space Apps judges, not investors. So "traction" becomes **proof** (validation against real landings), and "funding ask" becomes **what happens next** (pilots, API, partners).

The look follows the app: a black page, the F1-card style, real screenshots, and no gradients, rockets, light bulbs or stock photos.

---

## Investment thesis (the one idea behind all 7 slides)

The Moon's south pole is where every agency and company wants to land next, and also where sunlight and radio contact are hardest to get. Every other tool checks a site you have already picked. **Touchdown finds the sites and the dates for you, for your mission's goal, and its predictions match what real landers experienced.**

---

## Slide 1: the opportunity

- **Judge's question:** Why should I care?
- **Headline:** **The next decade of Moon landings is aimed at its darkest, hardest place.**
- **Key message:** The south pole has ice and Artemis, but its Sun skims the horizon and its terrain hides Earth.
- **Slide copy:**
  - Touchdown: *where and when to land on the Moon.*
  - Artemis III candidate regions: 9, all at the south pole.
  - Upcoming NASA CLPS landers: IM-3 (2026), Griffin 1 (2026), CP-12 (2026), Blue Ghost 3 (2028). [VERIFY DATES against NASA CLPS page]
  - At the pole the Sun stays within a few degrees of the horizon, so a ridge 1 km away can decide whether a lander lives.
- **Visual:** Full-bleed app hero (Earth over the lunar limb). Logo + one line.
- **Layout:** Headline top-left, oversized. The one-line positioning sits under it. Visual fills the right two-thirds.
- **Speaker notes:** Don't describe the app yet. Make them feel the place: low Sun, long shadows, Earth that dips below ridges.
- **Transition:** "So the question every mission team asks is simple, and today it's hard to answer."

## Slide 2: the problem

- **Judge's question:** Is this a real, expensive problem?
- **Headline:** **Athena was built for 10 days at the south pole. It died in 13 hours, in a shadowed crater.**
- **Key message:** Sunlight and Earth contact at a site change hour by hour, and today you check them one site at a time.
- **Slide copy:**
  - 13 robotic landing attempts in 2019 – mid-2025: 8 reached the surface, 5 crashed. (In-app record; source table on the Sources page.)
  - Among those that landed, the Sun and the terrain cut missions short:
    - **IM-2 Athena** (Mar 2025) came to rest in a shadowed crater near the south pole. With the Sun's direction, the panel orientation and the cold, it could not recharge. It was planned for 10 days and lasted under 13 hours. (Intuitive Machines via [Spaceflight Now](https://spaceflightnow.com/2025/03/07/intuitive-machines-im-2-mission-ends-with-lander-on-its-side-on-the-moon/) and [Scientific American](https://www.scientificamerican.com/article/athena-lunar-lander-declared-dead-on-the-moon/).)
    - **SLIM** (Jan 2024) settled nose-down with its solar cells facing west, so it could only charge near the end of the lunar day. ([Physics World](https://physicsworld.com/a/japans-lunar-lander-falls-head-over-heels-for-the-moon/))
    - **IM-1 Odysseus** (Feb 2024) tipped onto its side, which changed how its panels faced the Sun, and its mission was cut short. ([TechCrunch](https://techcrunch.com/2024/02/27/intuitive-machines-faces-early-end-to-moon-mission-after-lander-tips-over))
  - Today: pick a candidate site, then run sunlight and comms analysis for that one point and that one date.
- **Visual:** One timeline: the hours a lander has Sun and Earth at a polar site over 30 days, shown as gaps of darkness and lost contact. Use a real Touchdown strip from the site page.
- **Layout:** Headline on top. One wide strip graphic in the middle. The three facts sit underneath, small.
- **Speaker notes:** Be honest: Athena also tipped over. The point is that at the pole, a few hundred metres and the wrong shadow are the difference between 10 days and 13 hours. The pain is the gap between "it's sunny at the pole" and "it's sunny at this exact spot on this exact day".
- **Transition:** "We built Touchdown to flip that question around."

## Slide 3: the solution

- **Judge's question:** What is it, in 20 seconds?
- **Headline:** **Tell Touchdown what the mission is for. It returns the best places and dates to land.**
- **Key message:** It searches; you don't have to guess.
- **Slide copy:**
  - **01 — Choose the goal:** safe landing, water ice, volcanoes, Artemis… plus the lander, the stay and the dates.
  - **02 — Touchdown searches:** 21,856 points at 2 km across the south pole (41,276 across the whole Moon), every hour of every landing day. It uses NASA LOLA terrain horizons, JPL DE421 Sun and Earth positions, and the NASA Deep Space Network schedule.
  - **03 — You get:** ranked sites and dates with GO/NO-GO, success odds, the biggest risk, a landing film and a PDF report.
  - **Before:** you pick a site, then check it. **After:** you state the goal, and Touchdown finds the sites.
- **Visual:** The "Top landing sites" card grid (the F1 cards), real screenshot.
- **Layout:** Headline on top. The three steps run down the left in a narrow column. The screenshot fills the right side.
- **Speaker notes:** Say "7.6 million hourly checks in under a second, in the browser". Don't explain the algorithm.
- **Transition:** "A tool like this is only worth something if it's right. So we tested it against landers that actually went."

## Slide 4: proof

- **Judge's question:** Does it actually work?
- **Headline:** **We replayed real landings. Touchdown's sunlight matched what the landers got.**
- **Key message:** Its predictions hold up against reality, not only against our own maths.
- **Slide copy (big metric cards):**
  - **Chandrayaan-3** (69°S): the model gives 11.9 days of sunlight; the lander worked about 11.
  - **Blue Ghost 1:** the model gives 14.5 days; the lander worked about 14.
  - **Terrain check:** the fast horizon is within 0.5 points of the full-resolution horizon (median, 27 sites). Slopes against LOLA's official 40 m slope map: r = 0.94, median 1.15° (6,620 points).
  - **Python reference vs browser engine:** the parity tests pass.
- **Visual:** Two large F1-style cards (Chandrayaan-3 and Blue Ghost 1), each showing the model's number next to the real one.
- **Layout:** The two cards fill the slide. The method line sits small at the bottom.
- **Sources:**
  - **Blue Ghost 1:** "more than 14 days of surface operations", ending 16 Mar 2025 ([Firefly](https://fireflyspace.com/news/firefly-aerospace-successfully-completes-14-days-of-surface-operations-on-the-moon)).
  - **Chandrayaan-3:** landed 23 Aug 2023. Pragyan was put to sleep on 2 Sep (about 10 days) and Vikram on 4 Sep (about 12 days) ([Space.com](https://www.space.com/chandrayaan-3-rover-lander-sleep-mode)).
  - Say "about 11" on the slide, and "10–12 days" if asked.
- **Speaker notes:** This is the slide that separates us. Others validate their method; we validate the outcome. Mention honestly that IM-1 and SLIM are harder cases because they landed tilted.
- **Transition:** "And it doesn't have to stay a website."

## Slide 5: scale and use cases (includes the API)

- **Judge's question:** Who uses this, and how does it grow?
- **Headline:** **One engine, three users: mission planners, CLPS companies, classrooms.**
- **Key message:** The search engine is the product. The website is only one way to use it.
- **Slide copy:**
  - **Mission planners and agencies:** screening landing sites and windows before detailed analysis.
  - **CLPS / commercial lander teams:** an **API** for their own tools. Concept, not built yet:
    - `POST /v1/search {goal, lander, stay, window}` → ranked sites and dates;
    - `GET /v1/site/{lat},{lon}/sky?from=&to=` → hourly Sun, Earth and DSN contact.
  - **Education and outreach:** the guided film, the bilingual interface (EN/TR) and the phone view.
  - **Path:** south pole now → the whole Moon (already in) → other airless bodies with the same method (Mercury's poles, asteroids). [Vision, not built.]
- **Visual:** One engine box in the centre, with three arrows out to Web app / API / Classroom. The API endpoints are shown as two code lines.
- **Layout:** Headline on top. The diagram sits centre-left, with three short user blocks to its right.
- **Speaker notes:** Be clear the API is a concept. The engine already runs as a self-contained module (a browser worker), so exposing it is a small step.
- **Transition:** "Plenty of teams built sunlight checkers this weekend. Here's why this one is different."

## Slide 6: advantage and team

- **Judge's question:** Why will this win, and why this team?
- **Headline:** **Others check a site you picked. Touchdown searches all of them, and checks itself against real missions.**
- **Key message:** Search plus validation plus mission goals is the edge.
- **Slide copy:**
  - **The usual approach** (about 150 projects on this challenge): one site or a fixed list → Sun and Earth visibility.
  - **Touchdown adds:**
    - the whole-region search, ranked by mission goal;
    - success odds with the biggest risk named;
    - replays of real landings;
    - honest limits, stated on the Sources page.
  - **Team No Limits Lunar:** Yusuf Kerim Kaymakçı (technical: engine, data, web app) and Yusuf Çırpan (presentation and judge experience).
  - **Fit:** one person built the engine on real NASA data, and the other made sure a judge understands it in 30 seconds.
- **Visual:** A simple 2×2: *checks one site ↔ searches all sites* against *method-validated ↔ outcome-validated*. Touchdown sits alone in the top-right. No checkmark table.
- **Speaker notes:** Never say "no competitors". Say what others do well (precise horizons, nice 3D) and what only we do.
- **Transition:** "Here's where we take it next."

## Slide 7: what's next, and try it

- **Judge's question:** Is this going somewhere, and can I try it?
- **Headline:** **Today it finds where and when to land at the south pole. Next, any mission can call it.**
- **Slide copy:**
  - **Built this weekend:**
    - a live web app, EN and TR;
    - the south pole at 2 km and the whole Moon at about 30 km;
    - replays of 5 real landings.
  - **Next three steps:**
    1. **Open API** for lander teams' own tools: search plus hourly sky.
    2. **Finer terrain at the Artemis sites**, plus a power and link budget per lander.
    3. **Replay every new landing:** IM-3, Griffin 1 and the 2026 CLPS landers, as they happen.
  - **Big QR → live app.** "Try it: pick a goal, and see where you would land."
  - **Closing line:** *"Every lander that went dark had a better place, or a better day. Touchdown finds it."*
  - No Limits Lunar · lunanav-theta.vercel.app
- **Visual:** The QR code, large, on the right. The three steps as three numbered tiles on the left (flat, F1 style).
- **Speaker notes:** End on the closing line, then stop talking, and leave the QR up for the Q&A.

---

## 30-second pitch

The next wave of Moon landings is aimed at the south pole: ice, Artemis, and a Sun that barely clears the horizon. Landers there live or die by where and when they touch down. Today teams pick a site and then check it. Touchdown flips that. Tell it what the mission is for, and it searches 21,856 points, every hour of every landing day, on NASA terrain and JPL orbits, then returns the best sites and dates with success odds. We replayed Chandrayaan-3 and Blue Ghost 1, and its sunlight predictions match what those landers got.

## Questions a skeptical judge will ask (prepare answers)

| Concern | Why it matters | Answer |
|---|---|---|
| "Is 2 km terrain enough?" | Ridges smaller than 2 km can block the Sun. | We checked the fast horizon against the full resolution: 0.5 points median. The landing zone uses 40 m slopes. Detailed site work still needs finer terrain, and the Sources page says so. |
| "Do the real-landing numbers just happen to fit?" | Two cases is a small sample. | Five landings are replayed and the two clean cases match. The tilted landers (IM-1, SLIM) show the model's limits, and we say that openly. |
| "Who would actually use this?" | It's a hackathon tool. | Early-stage site screening for CLPS teams and agencies, before detailed analysis. Next step: one pilot conversation. [FOUNDER INPUT] |
| "Isn't this what the other 150 teams did?" | Crowded field. | Most check one site. We search all of them by mission goal, and we validate against outcomes. |
| "Is the success probability real?" | It sounds like false precision. | It's a screening estimate built from hundreds of simulated missions plus the public landing record (8 of 13). It is labelled a planning tool, not a certification. |

## Still needed from you

- **Done:** team names and roles (slides 1 and 6).
- **Done:** the IM-2, SLIM and IM-1 facts, and the Blue Ghost and Chandrayaan-3 durations, are sourced. Slide 7 needs no "ask".
- **Important:** check the CLPS dates on slide 1.
- **Optional:** the final closing line.

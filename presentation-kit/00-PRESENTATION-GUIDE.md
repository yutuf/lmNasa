# Touchdown · Presentation kit

NASA Space Apps Challenge 2026 · Challenge: **Lunar Landing Site Navigator**

This folder has what you need to build the presentation: what the project is, what to show, the numbers to say, screenshots, and the questions judges are likely to ask. **Judges care most about presentation and 3D**, so show the app live where you can and use screenshots as a backup.

---

## 1. What Touchdown is (say it in one breath)

> **Touchdown tells you where and when to land on the Moon, and whether your mission survives there.**

It checks **21,856 points around the lunar south pole** (2 km apart) and **41,276 points across the whole Moon** (about 30 km apart). For each one it tests every landing date, hour by hour, on real NASA data. Does the lander get sunlight for power? Can it talk to Earth through NASA's Deep Space Network? Is the ground flat enough? Is water ice nearby? Then it ranks the best sites, shows each one in 3D, and estimates the chance the mission succeeds.

**Why it matters:** near the south pole the Sun skims the horizon, so a few hundred metres decide whether a lander has power, contact with Earth and a safe slope. Artemis III and many robotic landers are going there.

## 2. Links

- **Live app:** https://adaptlab.us
- **Judges page with QR code:** https://adaptlab.us/#judges (show this on the last slide or on a screen)
- **Code:** https://github.com/yutuf/lmNasa (branch `main`)

## 3. Data (all real, all public)

| What | Source |
| --- | --- |
| Terrain, horizons, slopes | NASA LRO **LOLA** laser altimeter (polar 5–40 m grids, global grid) |
| Sun, Earth positions 2026–2045 | JPL **DE440/DE421** ephemerides (SPICE) |
| Can we talk to Earth? | NASA **Deep Space Network** stations: Goldstone, Madrid, Canberra |
| Water ice, temperatures | LRO **Diviner** + permanently shadowed regions |
| Artemis III candidate regions | NASA/USGS official outlines (9 regions) |
| Place names | IAU gazetteer (4,742 names) |
| Landing record for the odds | 13 robotic landing attempts 2019–2025: 8 reached the surface, 5 crashed |

## 4. The in-person talk (about 4 minutes)

This is the live talk in the room, not the file you submit. NASA Space Apps Global Judging only accepts a deck of **7 slides, including the title**, or a video of **30 seconds or less**. Anything longer is not eligible. The submitted deck is section 6.

Use the **Simple** interface (top left switch). Every step below is a click.

1. **The hook (20 s):** "Since 2019, 13 robotic landers have tried to land on the Moon, and 5 crashed. Choosing *where and when* is half of a landing." Click **Tell me the mission**: a short film plays (launch, coast, descent, landing, rover, verdict).
2. **Three questions (40 s):** on the home page show steps 1–2–3: pick **Find water ice**, keep **Lander · 14 days**, keep the date, press **Find landing sites**. Point out that it searches about 7.6 million hour-by-hour checks in a couple of seconds, in the browser.
3. **The answer (40 s):** the cards are real 3D terrain renders. Read the top card aloud: site name, "GO 4/30" (landing works on 4 of 30 days), the best date, and the success percentage. Click the card for the site page.
4. **Whole Moon (20 s):** pick **Study volcanoes**. The search switches to the whole Moon; Aristarchus and Rümker show up with real crater relief.
5. **The decision model (40 s):** under the results click **Compare the sites** (Decision lab). Switch **Balanced → Safety first → Science first** and watch the ranking change. Say: "We shake the weights 500 times. If the winner stays #1 it is a robust choice; if not, the model says it is a close call."
6. **3D wow moment (40 s):** open a site → **Watch the landing**. Switch cameras (chase, pilot). Then drive the rover, or **walk on the Moon with a torch** in the dark crater.
7. **Close (20 s):** "Real NASA data, every hour from 2026 to 2045, the whole Moon, and honest about its limits. This is a planning tool, not a landing certificate." Show the **QR code** so judges can try it themselves.

Extra if time allows: **Build your own lander** (Workshop): change panels, battery and legs; the design changes where it can land and runs a real search.

## 4b. New since the first version of this guide

- **Simple page = three questions** (what for, how long, when) with an Earthrise backdrop and a terrain picture of each goal.
- **Real NASA missions in one click:** IM-3 (Reiner Gamma), Griffin-1 (Nobile), CP-12 (Schrödinger, far side: needs a relay), Blue Ghost 3 (Gruithuisen domes).
- **Land where Artemis III will:** the 9 official candidate regions as a goal.
- **Our model vs real landings:** five real landings replayed through Touchdown's engine. Blue Ghost 1: the model says 14.5 days of Sun, it worked ~14. Chandrayaan-3: 11.9 vs ~11. Chang'e 6: Earth never in view → needed a relay. A great slide: "we tested our model against reality".
- **Site page:** uncertainty ranges on every key number, worst case inside the landing ellipse, an antenna-mast "what if", and a 2026–2045 calendar of every landing day (shows the long-term cycle of good seasons).
- **Relay satellite** (like Queqiao-2) counts as contact: far-side sites become possible.
- **Launch & orbit:** which lunar orbit can reach which site, and the fuel cost of a plane change (a 20° orbit needs +1.6 km/s to reach the pole: that is why Artemis uses polar orbits).
- **Compare two missions** head to head; **PDF report**; **offline mode** (works without wifi after one visit).
- **Real 3D models:** Vikram, Starship HLS, Apollo LM, Apollo LRV (museum scan), Pragyan, Yutu-2.
- **Tell me the mission** film: new scenes (the landing window, the ellipse check, the odds simulation), a mission verdict board.
- **Plan a mission with me:** Luna asks for the goal first, then only the numbers that are still missing, and the GO or NO-GO comes from the search.
- **Line drawings** on the goal cards, the "What next?" cards, and the judges page. They are transparent pictures, so the page background shows through.

Talk tip: open https://adaptlab.us/#judges first: it has the one-screen summary and the QR code, and "Open the app" goes straight in.

## 5. Numbers you can say (they come from the app)

- 21,856 polar points, 41,276 whole-Moon points, every landing day, hour by hour
- about 7.6 million hourly checks per search, in about 2 seconds in the browser
- ephemeris from Nov 2026 to Dec 2045
- default mission (14-day lander, window from 1 Sep 2027): best site **SW rim of Shoemaker**, next GO window **7–11 Sept 2027**
- 9 Artemis III candidate regions compared, centre point against the best point inside each
- 35 science targets (ice, volcanoes, impact basins, magnetic swirls, lava-tube pits, historic sites)
- success odds: Monte Carlo over 300–400 simulated missions per site (launch delay, horizon error, battery wear, tipping over on slopes, plus the real landing record)

## 6. Slide ideas (the submitted deck)

The submitted demo is **7 slides, including the title**, or a video of **30 seconds or less**. A longer deck or a longer video is not eligible for Global Judging. Mostly pictures. The 4-minute walk-through in section 4 is the in-person talk, not this file.

| # | Slide | Screenshot |
| --- | --- | --- |
| 1 | Title: Touchdown, where and when to land on the Moon | `01-home-three-questions.png` |
| 2 | The problem: the south pole's low Sun; 5 of 13 recent landers crashed | `09-advanced-interface.png` (globe) |
| 3 | How it works: NASA data → hour-by-hour checks → ranked sites | data table above |
| 4 | The answer: ranked sites with 3D terrain | `02-best-sites-south-pole.png` |
| 5 | One site in depth | `04-site-profile.png` |
| 6 | The whole Moon, science goals, and the decision model | `08-whole-moon-volcano-sites.png`, `05-decision-lab.png`, `06-decision-lab-science-first.png` |
| 7 | QR code so judges can try the app (not a recording of the talk) | — |

Style: the app uses a dark Formula 1-style look (black, red #E10600, bold italic numbers). Matching it makes the deck and app feel like one product.

## 7. Questions judges may ask (and short answers)

- **"Is the data real?"** Yes: NASA LOLA terrain, JPL ephemerides, DSN station geometry, Diviner. Nothing is random except the Monte Carlo, and that uses a fixed seed, so it gives the same answer every time.
- **"How accurate is it?"** Polar sites use a 2 km grid with 40 m slope data; whole-Moon sites are about 30 km apart. It is for mission planning, not landing certification, and the app says so.
- **"How is the success chance computed?"** We simulate each mission hundreds of times with realistic problems (launch slips, terrain errors, battery wear, slopes) and can include the real record of recent landings.
- **"What is the AI part?"** A decision model (TOPSIS multi-criteria ranking with a robustness test), Monte Carlo risk, and an assistant (Luna, Google Gemini) that explains results and plans missions in English and Turkish.
- **"What did you build during the hackathon?"** The README has a table separating pre-hackathon work from what was built at the event. Be honest about it.
- **"What next?"** Use the higher-resolution maps already downloaded (5 m LOLA and ShadowCam) in the site ranking. Rover views already use finer patches where we have them. The landing-ellipse worst case and the relay satellite are already in the app, so do not offer those as next steps.

## 8. Things to avoid

- Don't call it a landing certification or say it guarantees a safe landing.
- The vehicles you can show are real 3D models: Vikram, Starship HLS, Apollo LM, Apollo LRV, Pragyan, and Yutu-2. You do not have to stick to the Apollo LM. VIPER is the exception: it still uses NASA's Perseverance model as a stand-in, so don't call that shape VIPER.
- Don't promise features that aren't in the app. `HANDOFF.md`'s open-TODO list is out of date on this: the landing ellipse, the relay satellite, and those vehicle models are already built.

## 9. Before the presentation (checklist)

- [x] The live link works for someone not logged in
- [ ] Luna works on the live site (`GEMINI_API_KEY` set in Vercel)
- [x] QR code: built into https://adaptlab.us/#judges
- [ ] Optional: a local recording of the talk, in case the internet fails in the room. Do not upload it. A project video longer than 30 seconds is not eligible for Global Judging. The submitted demo is the 7-slide deck, or a video of 30 seconds or less.
- [ ] Test on a phone (the app works on phones; there is a Turkish version: EN/TR switch top right)

## 10. What's in this folder

- `00-PRESENTATION-GUIDE`: this guide
- `screenshots/`: fresh screenshots of the current app (file names say what they show)
- `video/lunanav-demo.mp4`: an older demo recording (earlier interface; use for reference only)

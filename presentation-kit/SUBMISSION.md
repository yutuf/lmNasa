# Space Apps project page: text to paste

Team **No Limits Lunar** · Challenge: **Lunar Landing Site Navigator** · NASA Space Apps 2026.
Fill in the [brackets]. Check the field names against the 2026 submission form; this follows the published guide (demo: a ≤30 s video with English subtitles, or ≤7 English slides).

---

## Project name
Touchdown: where and when to land on the Moon

## High-level summary (≈150 words)
The next wave of Moon landings is aimed at the lunar south pole, where the Sun barely clears the horizon and the terrain can hide Earth. There, a few hundred metres and a few days decide whether a lander has power and can call home. In March 2025, Athena came to rest in a shadowed crater near the pole and lasted under 13 hours.

Most tools check a site you have already chosen. Touchdown does the opposite. You say what the mission is for (a safe landing, water ice, Artemis…), and it searches 21,856 points across the south pole, every hour of every landing day. It uses NASA LOLA terrain, JPL ephemerides and the Deep Space Network schedule. It returns the best sites and dates, with success odds and the biggest risk named.

We replayed real landings: Touchdown's sunlight matches Chandrayaan-3 (11.9 days modelled vs about 11 worked) and Blue Ghost 1 (14.5 vs about 14).

## Links
- **Demo (30 s video, English subtitles):** [YouTube / Drive link to presentation-kit/video/Touchdown-demo-30s.mp4]
- **Slides:** [link to the pitch deck]
- **Live app:** https://lunanav-theta.vercel.app
- **Code:** https://github.com/yutuf/lmNasa

## Detailed description
**What it does**
1. **Choose the goal**, the lander, the length of stay and the dates (Simple interface). Or set every requirement yourself (Advanced).
2. **The search:** 21,856 points on a 2 km grid around the south pole (or 41,276 across the whole Moon at about 30 km) × every landing day in the window × every hour of the stay. That is about 7.6 million hourly checks in about a second, in the browser.
3. **For each point and date it checks:**
   - sunlight: how much of the Sun's disc is above the real terrain horizon;
   - Earth in view, with a free DSN dish;
   - the longest darkness;
   - a battery model;
   - the slope of the landing zone from LOLA 40 m slopes;
   - the distance to ice-stable cold traps.
4. **You get:**
   - ranked sites and dates with GO/NO-GO;
   - success odds from hundreds of simulated missions, with the biggest risk named;
   - countdowns to sunset and Earth-set after touchdown;
   - a launch-slip strip ("slip 2 days → NO-GO, and why");
   - a mission film from launch to touchdown;
   - a PDF report.
   - Any coordinate can also be checked directly (Advanced).

**Why it matters:** it turns "is my site OK?" into "where and when should we go?", which is the question mission planners ask first.

**How we checked it:**
- Real landings replayed (Chandrayaan-3, Blue Ghost 1, SLIM, IM-1, Chang'e 6). The two upright landers match. The tilted ones show the model's limits, and we say so.
- Fast horizons are within 0.5 points of full-resolution horizons (median, 27 sites).
- Our slopes agree with LOLA's official 40 m slope map (r = 0.94, median 1.15°, 6,620 points).
- The browser engine matches a Python reference implementation in automated tests.

**Limits (stated in the app):** this is a planning and screening tool, not a landing certification. The 2 km polar grid can miss small ridges. The success odds are an estimate.

**Built with:** TypeScript, React, three.js (react-three-fiber), Web Workers, Python (data preparation), Vercel. English and Turkish.

## Use of NASA data and resources
- **LRO LOLA:** south-polar and global elevation models; terrain horizons; 40 m slope maps.
- **LRO LROC WAC global mosaic:** the Moon's surface texture.
- **LRO Diviner:** temperatures and ice-stability depth near the pole.
- **Permanently shadowed region maps:** distance to cold traps.
- **JPL DE421 planetary ephemeris (NAIF SPICE):** Sun and Earth positions, hour by hour.
- **NASA Deep Space Network:** station locations, for when a dish can see the Moon.
- **Artemis III candidate regions** and the **NASA CLPS** mission list.
- **NASA Blue Marble:** the Earth texture.

## Other data
Public mission outcomes from ISRO (Chandrayaan-3), JAXA (SLIM), Intuitive Machines (IM-1, IM-2), Firefly (Blue Ghost 1) and CNSA (Chang'e 6), used to replay real landings.

## Use of AI (disclosure)
- **Building the project:** the team used AI coding assistants (Anthropic Claude Code, OpenAI Codex, xAI Grok) to write and test code and to run visual QA. Every number shown comes from the engine and the data above, not from an AI model.
- **In the app:** the optional guide "Luna" answers questions with Google Gemini, using only the numbers the page sends it. Narration uses ElevenLabs text-to-speech.
- **Images:** [check: list any decorative illustrations generated with Grok Imagine, if they are still in the app]

## Before the hackathon
Part of the engine existed before the event. The repository tag `pre-hackathon` (commit e616415) marks exactly what was built earlier. Everything after it was built during Space Apps 2026.

## Team
No Limits Lunar:
- **Yusuf Kerim Kaymakçı:** technical (engine, data, web app)
- **Yusuf Çırpan:** presentation and judge experience

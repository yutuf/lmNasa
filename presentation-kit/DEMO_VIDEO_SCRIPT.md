# LunaNav demo video: shot list and narration

Two cuts from the same recording: **30 s** (the submission demo) and **75 s** (for the project page and the pitch).
Recorded from the real app at 1920×1080. Narration by the ElevenLabs voice the app already uses. No stock footage, no invented numbers: every figure on screen is the app's own output.

## 30-second cut

| Time | Shot (what is on screen) | Narration |
|---|---|---|
| 0–4 s | Simple page hero: "Where and when to land on the Moon", Earth over the lunar horizon | Where and when should we land on the Moon? |
| 4–11 s | Click **Find water ice**, then **Find landing sites**: the ranked site cards appear | Pick what the mission is for. LunaNav checks 21,856 points at the south pole, every hour, on NASA terrain and JPL orbits. |
| 11–18 s | Open site **01**: success odds, the countdown, the launch-slip strip | It ranks the best sites and dates, with the odds of success and the biggest risk. |
| 18–25 s | Film: descent → touchdown → the **GO** verdict | Then it flies the mission there. |
| 25–30 s | "Test against real landings": Chandrayaan-3 and Blue Ghost 1, model vs reality. End card with the live link | And it matches real landings: Chandrayaan-3 and Blue Ghost 1. |

## 75-second cut (adds)

- After the cards: the globe's **Sunlight** map playing over the whole Moon. "Sunlight and Earth contact come from the real horizon at each point, not a flat Moon."
- After the site page: **If the launch slips**. "Slip two days and this site goes NO-GO; LunaNav shows why."
- After the film: **Advanced**: type a coordinate (Shackleton rim). "Any point can be checked, not only the ones it suggests."
- End: "A planning tool, not a landing certification. Built on NASA LOLA, JPL ephemerides and the Deep Space Network schedule."

## Production notes

- Record each shot as its own clip (Playwright, Edge with GPU) from a production build, then join them with ffmpeg. Narration is generated once per line and placed on the shot it belongs to.
- English first; a Turkish narration track can follow from the same clips.
- Real numbers only. If a shown value changes after a code change, re-record that shot rather than editing the frame.

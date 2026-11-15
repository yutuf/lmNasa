# Codex task: two Turkish presentation documents (AdaptLab, NASA Space Apps 2026)

Write two Markdown files, in Turkish, for the team **No Limits Lunar** (Yusuf Kerim Kaymakçı: technical, engine, data, web
app; Yusuf Çırpan: presentation and judge experience). Product: **AdaptLab** (https://adaptlab.us), challenge
"Lunar Landing Site Navigator": where and when to land on the Moon.

## Files you own (only these)

- `presentation-kit/SUNUM_AKISI.md`: the spoken flow (script) of the live jury presentation.
- `presentation-kit/SUNUM_ICERIGI.md`: what the presentation must contain, for the local jury, plus a separate
  section for the NASA (global) judging in the same document.

Do not edit any other file. Do not run git commands except `git status` / `git diff`. Do not commit.

## Rules

- Turkish, plain and short sentences. The presenters are tired students; they must be able to read it once and use it.
- Only facts from the list below or from these repo files: `README.md`, `presentation-kit/SUBMISSION.md`,
  `presentation-kit/PITCH_DECK.md`, `presentation-kit/00-PRESENTATION-GUIDE.md`, `presentation-kit/DEMO_VIDEO_SCRIPT.md`,
  `docs/DEMO_WEB.md`, `web/src/history.ops.test.ts`, `web/src/probability.ts`, `web/api/v1/*.ts`. If a fact is not there,
  do not invent it; write `[KONTROL ET]` instead.
- Be honest about limits: it is a planning tool, not a landing certification. Do not oversell.
- No marketing fluff, no emoji.

## The presentation as it is built now (use this exact flow)

The site has a **Sunum** (Present) button in the top bar (or open `adaptlab.us/#present=1&lang=tr`). It has three screens,
switched with PageDown / PageUp (a presentation clicker) or a small pill at the bottom right:

1. **Oda (Hakemler)**: a big QR and a 4-letter room code. Judges scan it with their phones. On the phone (opens in Turkish,
   EN switch at the top) each judge makes three choices: mission goal (Güvenli iniş, Su buzu, Artemis III, En çok güneş),
   stay (7, 14 or 28 days), and taps a landing spot on a south-pole crater map, then sends it. Up to 8 judges.
2. **Uygulama**: the plain app, the presenter demos it freely. The room keeps running in the background; the pill shows
   "Hakemler 3/8 · 2 plan".
3. Back to **Oda**: each judge's spot is put against AdaptLab's own pick for the same goal and stay ("duel" cards):
   who wins, why (in one sentence), and a better spot near the judge's. A leaderboard ranks the judges.
4. **Kapanış**: the closing screen: "Kararan her aracın daha iyi bir yeri ya da daha iyi bir günü vardı. AdaptLab onu
   bulur.", Today / Next / Then tiles, team names, QR to adaptlab.us.

Rules of the duel (web/src/live.ts): a spot that can land at all beats one that cannot; then for ice / Artemis the
distance to the target (within 15 km counts); then more GO days in the 12-day window; then more Sun and Earth contact.
28-day stays are never GO: no spot gets through 28 days without a lunar night longer than 48 h (a good talking point).
Random taps usually land in shadowed craters and lose; that is the point.

Suggested demo path inside the app (Simple view): the goal chooser ("Su buzu bul"), the Top landing sites cards, one
site page (terrain, GO/NO-GO, mission odds), "Görevi anlat" (the mission film), "Gerçek inişlerle sına" (the history
panel: model vs real end of operations), and the Advanced view with the open API.

## Facts (verified)

- Data: NASA LRO LOLA terrain (south pole 2 km grid, 21,856 points; whole Moon ~30 km grid, 41,276 points; a 200 m polar
  grid for the 3D views; 5 m LOLA site maps where available), LRO Diviner (temperatures), JPL DE421 ephemeris (Sun and
  Earth positions), NASA Deep Space Network station visibility, permanently shadowed regions (ice).
- The engine checks every point, every hour of every landing day: sunlight (with the real terrain horizon), Earth in view
  plus DSN, the longest dark period, a battery model, slope under the lander and in the landing zone. About 7.6 million
  hourly checks in about a second, in the browser.
- Default GO rule (the API defaults): Sun at least 70 % of the time, Earth at least 50 %, no dark period over 48 h,
  2000 Wh battery, slope at most 8°, a 1000 m landing zone with at most 12°.
- What a site card shows: rank number (01, 02...), the place name ("Shackleton kraterinin 6,7 km B'si"), "UYGUN 4/30"
  = the mission works if it lands on 4 of the 30 days in the window, "en iyi 12 Eyl 2027" = the landing day with the
  best mix of Sun, Earth contact and battery reserve, and only when ranked by "En yüksek başarı": "%50 şans" = the share
  of 300 simulated missions that succeed (launch slips, battery wear, the slope under the feet, and that only 8 of the
  last 13 robotic landings, 2019 to mid-2025, reached the surface; that is why the % is low).
- Proof: five real landings replayed through the same engine. Model vs real end of operations, days:
  Blue Ghost 1 15.0 vs 14.6; SLIM 11.9 vs 12.0; Chandrayaan-3 12.3 vs 11.6; IM-1 4.4 vs 7.0 (it tipped over);
  Chang'e 6 10.6 vs 2.0 (a sample-return mission that left after 2 days by design, not a power failure).
- Open API (live): `adaptlab.us/api/v1` with `/search`, `/site`, `/sky`. Same engine as the app.
- 3D: mission film from launch to landing to the rover; rover driving and a moonwalk on real terrain (south pole).
- Bilingual app (TR / EN). Works offline after the first visit.

## SUNUM_AKISI.md: what to write

A minute-by-minute script for the live jury pitch. Assume **5 minutes of talk + questions** unless the guide files say
otherwise (then use theirs and say so). Columns: süre, ekranda ne var, kim konuşuyor (Yusuf Kerim / Yusuf Çırpan),
ne söylenecek (short, speakable sentences), ne tıklanacak. Start with the room QR (judges scan while the speaker opens
with the problem), then the demo, then the duels, then the closing. Add a short "bir şey bozulursa" box: no phone link ->
the "Test telefonu" button adds a plan; site slow -> stay on the room screen and talk; film too long -> Esc.
Add a one-paragraph 30-second version for an elevator pitch.

## SUNUM_ICERIGI.md: what to write

1. **Jüri sunumu (yerel)**: what must be in the pitch, in the order of the judging criteria the guide files name
   (opportunity, problem, solution, proof, scale, advantage + team, vision), each with the AdaptLab content for it in
   2-4 bullet points, using the facts above.
2. **Kartlardaki sayılar ne demek**: the card explanation above, in plain Turkish, so the presenter can answer.
3. **Jüri soruları ve kısa cevaplar**: at least 15 likely questions with 1-3 sentence answers (data sources, accuracy,
   why the % is low, what is new vs existing tools, how it was validated, why the south pole, what the API is for,
   limits, what AI was used for, what existed before the hackathon (see README's pre-hackathon note), business / users,
   next steps, why 28 days is never GO, how the live duel decides a winner).
4. **NASA (global) değerlendirmesi**: a separate section: what the NASA submission needs (use
   `presentation-kit/SUBMISSION.md` and `00-PRESENTATION-GUIDE.md`: project page text, demo video, links, NASA data used,
   AI disclosure), and how each NASA judging criterion is answered by AdaptLab. Mark anything you cannot confirm
   from the repo with `[KONTROL ET]`.

When done, write `CODEX_RESULT_SUNUM.md` (English, short): what you wrote, every `[KONTROL ET]` item, and any fact you
were unsure of.

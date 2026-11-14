# Phone QA, 15 Nov 2026

Preview: http://localhost:5174 · Edge with `--use-angle=d3d11` · touch and mobile contexts · 390×844 and 360×740 · English and Turkish (`lang=tr`).
WebGL renderer: ANGLE (Intel, Intel(R) UHD Graphics (0x0000A78B) Direct3D11 vs_5_0 ps_5_0, D3D11). `pointer: coarse` and `hover: none` were both true.
Screenshots are in this folder. No source file was edited. The `#phone` pairing page was left alone.

`document.documentElement.scrollWidth − innerWidth` was 0 on the Simple page, the site page, the film, Sources, the libration explainer, the interview, landing, drive, walk, sunlight, and the whole-Moon results. Two layouts still stick out of the phone frame, and the document test does not catch either one. They are findings 1 and 2.

## Major

### 1. The site page’s action row is 814px wide
- Where: A site card’s page. English and Turkish, 390×844 and 360×740. First card was Shoemaker.
- Did: Opened the card and measured `.profile` before scrolling the action row. Then scrolled the row into view.
- Happened: The profile’s own `scrollWidth` is 814. Its `clientWidth` is 390 or 360. The document’s `scrollWidth` stays equal to the viewport, because the panel is a fixed overlay. With no sideways scroll, the English buttons sit at y≈2618 inside that panel: Watch the landing x=16 w=204, Stand on the lander x=230 w=177 (ends at 407), Walk on the Moon x=418 w=168, Drive a rover x=595 w=135, Full analysis x=16 w=132 on the next line. On a 390px phone, Stand, Walk, and Drive start or end past the right edge. On 360px, Stand, Walk, and Drive are past it. Turkish is the same width: İnişi izle x=16 w=124, İniş aracında dur x=150 w=159 (ends 309), Ay’da yürü x=319 w=122 (ends 441), Gezgin sür x=451 w=122, Tam analiz x=583 w=122. After scrolling that row into the 390px English frame, the left button is cut to “e lander”, and the year chart and the note under it are cut at the left edge.
- Expected: The five actions fit in the phone width.
- Screenshots: `101-en-390x844-site2.png` (top of the page), `003-en-390x844-site-actions.png` (the row after a sideways scroll), `113-tr-390x844-site2.png`, `107-en-360x740-site2.png`, `131-tr-360x740-site2.png`.

The same buttons did open landing, drive, and walk after the row was scrolled. See findings 3 and 4.

### 2. Advanced puts Decide, Workshop, the film, and EN/TR past the phone frame
- Where: Advanced, after a south-pole search. English and Turkish, both sizes.
- Did: Switched to Advanced and measured every nav child. Tried a real click on “Tell me the mission” from that bar.
- Happened: The phone CSS hides the wordmark, the QR, and GitHub. It does not hide Decide and Workshop. English children, both sizes: logo x=12–46, Simple/Advanced x=54–217, Decide x=225–325 w=99, Workshop x=333–462 w=129, Tell me the mission x=470–484 w=14, EN/TR x=492–572 w=80. Turkish: Basit/Gelişmiş x=54–199, Karar x=207–305, Atölye x=313–414, Görevi anlat x=422–436 w=14, EN/TR x=444–525. The screenshot is 390×844 (or 360×740) and `clientWidth` stays 390 or 360. The visible bar stops in the middle of Workshop (“WO” / “ATÖLY”). `innerWidth` grew with the bar, to 572 (English) or 525 (Turkish), and `innerHeight` grew to 1238 or 1137 or 1080. `scrollWidth − innerWidth` is therefore 0. A real click on the film button from this bar never landed: the button is visible to Playwright and stable, and a `.nav-ws` button (Workshop / Atölye) intercepts the pointer. The film does open from the Simple bar, where that button is a 34px icon and the bar ends at x=378 (390px) or x=348 (360px).
- Expected: The phone bar fits, including the film and EN/TR.
- Screenshots: `016-en-390x844-advanced.png`, `018-en-390x844-error.png` (the intercepted click), `055-tr-360x740-advanced.png`, `057-tr-360x740-error.png`, `129-tr-390x844-advanced.png`.

Run search still works from the form. English 390: “RUN SEARCH”, “21,856 points checked · 12.0 M hour-by-hour checks · 2.3 s”. English 360: 0.9 s. Turkish 360: “ARAMAYI ÇALIŞTIR”, “21.856 nokta tarandı · 12.0 M saatlik kontrol · 1.3 sn”. Turkish 390: 2.4 sn. The button was on screen and `elementFromPoint` hit it.

### 3. The rover stick’s centre is the battery card, and a drag leaves the rover at 0.00 km
- Where: Site page → Drive a rover. English 390 and 360, Turkish 360 and 390. `pointer: coarse` was true, so `.stick` is in the page. One stick.
- Did: Read the HUD, dragged the stick upward, and on Turkish 390 called `elementFromPoint` at the stick’s centre.
- Happened: Turkish 390 stick box is x=135 y=604 w=120 h=120. The element at that centre is `DIV.hud bottom-left`, not the stick. The battery card (100%, Güneş +450 W, Tüketim −150 W) sits on top of the joystick. After the drag, English and Turkish both still read driven / yol `0.00 km · 0 cm/s`. Power did update (Solar +450 W, Use −150 W, Sun 100% · 1.8°, Earth hidden −2.2°). The coordinate line is drawn through the rate chips: the readable text stops at “LOLA” and the chips 1×, 10×, 1m/s, 10m/s, 1h/s sit on the rest. Exit stays clear: English 390 x=199 y=781, English 360 x=169 y=677, Turkish 360 “Çık” x=171 y=677.
- Expected: A drag on the stick moves the rover, and the coordinate line is readable.
- Screenshots: `005-en-390x844-drive.png`, `023-en-360x740-drive.png`, `044-tr-360x740-drive.png`, `115-tr-390x844-drive.png`.

### 4. Watch the landing: the HUD says about 1.2 km up, and the lander fills the lower frame
- Where: Site page → Watch the landing. About two seconds in. All four language/size combinations.
- Did: Opened the descent, read `#landing-hud`, and hit-tested Exit.
- Happened: English 390: `ALTITUDE 1,203 m · RANGE 1,716 m · T−24 s`. English 360: `ALTITUDE 1,194 m · RANGE 1,701 m · T−24 s`. Turkish 390: `İRTİFA 1.286 m · MESAFE 1.857 m · T−25 sn`. Turkish 360: `İRTİFA 1.200 m · MESAFE 1.710 m · T−24 sn`. The picture is a large lander with a flame, and the surface fills the lower half of the frame. Exit is on screen and is the element at its own centre: English “Exit” x=301 or x=271, y=16; Turkish “Çık” x=304 or x=274, y=16.
- Expected: A lander still about 1.2 km up.
- Screenshots: `004-en-390x844-landing.png`, `022-en-360x740-landing.png`, `114-tr-390x844-landing.png`, `043-tr-360x740-landing.png`.

## Minor

### 5. Ask Luna sits on other controls
- Where: Simple home, whole-Moon results, and the sunlight map. Both sizes, both languages.
- Did: Measured the floating button against the goal row, and looked at the result cards and the sunlight legend.
- Happened: On the home screen the overlap of Ask Luna with the goal step is 96% of the smaller box (`s-step-goal` and `luna-fab`). The button covers “Study volcanoes” / the Turkish goal chip. On the whole-Moon results it sits on the Casatus E card (`139-en-360x740-moon.png`, `142-tr-360x740-moon.png`, `143-en-390x844-moon-results.png`). On the sunlight map it sits on the bottom legend, and that legend line is cut: “Whole Moon on the ~30 km grid, the south pole on the 2 km”. The Sunlight button and Play were themselves hittable (finding 12 in the exercise list).
- Expected: Ask Luna leaves the chips, the cards, and the legend clear.
- Screenshots: `001-en-390x844-home.png`, `106-en-390x844-sun.png`, `143-en-390x844-moon-results.png`.

### 6. The live strip is cut at the right edge
- Where: The bar under the nav, on the Simple home and on the whole-Moon hero. Screenshots were taken with CSS animations disabled, and the cut is in the same place on more than one shot.
- Did: Read the strip in the screenshots.
- Happened: English shows “SUN AT THE SOUTH POLE +1.6°” and then “EARTH AT”, cut off. Turkish shows “GÜNEY KUTBUNDA GÜNEŞ +1.6°” and then “KUTUPTA”, cut off. The word “LIVE” stays English in the Turkish strip.
- Expected: The sun and Earth lines fit, and the tag is Turkish.
- Screenshots: `001-en-390x844-home.png`, `137-en-390x844-moon-error.png`, `140-tr-390x844-moon-error.png`.

### 7. The place name is still split, and the last word is the big one
- Where: Site page, and the whole-Moon cards.
- Did: Read `.ph-first` and `.ph-last`, and the card titles.
- Happened: Shoemaker’s English title is a small “SW rim of” and a large “Shoemaker”. The line under it is “Open terrain · -88.640°, 18.52°E”. Turkish is a small “krater kenarı, GB” and a large “Shoemaker”, with “Açık arazi · -88.640°, 18.52°E” underneath. Whole-Moon cards do the same: “on” / “Simpelius D”, “NW rim of” / “Drygalski”, “Drygalski krater kenarı, KB”.
- Expected: The place name is the bold part.
- Screenshots: `002-en-390x844-site.png`, `041-tr-360x740-site.png`, `113-tr-390x844-site2.png`, `143-en-390x844-moon-results.png`.

### 8. English left in the Turkish UI
- Where: Site page, film, drive, sunlight, Sources, Luna. Turkish, both sizes.
- Did: Read the visible strings and the aria-labels.
- Happened:
  - The site badge is “UYGUN”. The calendar sentence still says “Yeşil: GO.” The full line on Turkish 360 is “Bu görev burada iniş günlerinin %8’inde işe yarar. Yeşil: GO. Beyaz: şu anki 30 günlük pencere.”
  - Film scene 03 says “Yeşil günler GO, sönük günler NO-GO.” Scene 11 is titled “KARAR” and the big word is “GO”. The sparkline badge is `D01 100%` (a “D” plus the day number).
  - Drive times use “d”: “batmasına 14.8 d”, “doğmasına 2.5 d”. The site stat is “0 Wh”. The interview summary includes “12000 Wh”. Longitude keeps “E” (“18.52°E”, “311.5°E”).
  - Sunlight’s mode button is “Güneş ışığı”. The play control’s accessible name stays “Play”.
  - Sources’ close control reads “Close” (Turkish 360 x=316 y=22, Turkish 390 x=330 y=22). The libration close is “Kapat”. The interview close is “Kapat”.
  - Luna’s voice control title is “Yanıtları sesli oku” and its aria-label is “Read answers aloud”. The send control’s aria-label is “Send”. The language group’s aria-label is “Language”.
- Expected: Turkish words for GO, close, play, send, the voice control, the language group, and the day unit.
- Screenshots: `041-tr-360x740-site.png`, `119-tr-390x844-film-end.png`, `115-tr-390x844-drive.png`, `121-tr-390x844-sun.png`, `122-tr-390x844-sources.png`, `128-tr-390x844-luna.png`.

### 9. Scene 02 of the film is a black frame
- Where: Tell me the mission, scene 02, opened from the Simple nav. English 390.
- Did: Waited until the scene label was 02 and took a still.
- Happened: The caption is complete: “5 September 2027: launch from Kennedy Space Center. One and a half turns around Earth, the burn toward the Moon, about 4.5 days of coasting, capture into a polar orbit, and touchdown on 10 September 2027.” The picture above it is black, with a red vertical line. The stage text in the DOM is “Real event sequence and timings; not to scale.” Scene 03 and the verdict scene do draw. Turkish scene 02’s caption is also complete (“5 Eylül 2027: Kennedy Uzay Merkezi'nden fırlatma…”).
- Expected: The launch picture, with the full sentence.
- Screenshot: `102-en-390x844-film-02.png`. Turkish caption: `117-tr-390x844-film-02.png`.

### 10. Advanced result dates are cut on the right
- Where: Advanced results table. English, 390×844.
- Did: Opened Advanced and looked at the table.
- Happened: Place names wrap. The date column is cut at the right edge of the 390px frame (“1 Mar 2”).
- Expected: The date fits.
- Screenshot: `016-en-390x844-advanced.png`.

## Frame rates

`requestAnimationFrame` was counted for 3 seconds. Several canvases stay in the document, including ones far above and below the screen, so the count is higher than the on-screen picture. One canvas was on screen (y=0) for landing, drive, and walk. The film count includes an on-screen canvas plus others. Sunlight had one on-screen globe. The whole-Moon results count ran while both canvases were off screen (English 360: y=−5944 and y=3419), so 154.7 is not an on-screen rate.

| View | English 390 | English 360 | Turkish 390 | Turkish 360 |
| --- | --- | --- | --- | --- |
| Landing | 116 / 3.00 s = 38.6 | 173 / 3.00 s = 57.7 | 112 / 3.01 s = 37.3 | 124 / 3.01 s = 41.2 |
| Drive | 109 / 3.02 s = 36.1 | 163 / 3.00 s = 54.3 | 124 / 3.01 s = 41.2 | 75 / 3.01 s = 25.0 |
| Walk | 398 / 3.00 s = 132.6 | 349 / 3.00 s = 116.3 | 210 / 3.00 s = 69.9 | 95 / 3.00 s = 31.6 |
| Film, scene 02 | 850 / 3.01 s = 282.5 | 665 / 3.01 s = 221.1 | 907 / 3.00 s = 302.3 | 709 / 3.01 s = 235.7 |
| Sunlight, while Play runs | 61 / 3.13 s = 19.5 | 58 / 3.08 s = 18.8 | 59 / 3.09 s = 19.1 | 51 / 3.00 s = 17.0 |

Walk and the film are the inflated counts. Sunlight Play moved the clock (below) at about 17–20 callbacks a second.

## Console, network, page errors

No uncaught page error on any completed combo. `pageerror` length was 0.

Opening Advanced logged `Attempted to synchronously unmount a root while React was already rendering` 15 times, on English 390, English 360, Turkish 360, and the Turkish 390 retry. The search button still ran.

`/api/ask` returned 503, and one request was `net::ERR_ABORTED`, on the interview and on the Luna suggestion. English 390, English 360, Turkish 360, and the Turkish 390 retry. Luna still answered from the offline guide. English reply starts “Searching with 21 days on the surface, a landing window from 2027-03-01, Earth contact at least 80%…” and the trace is “Offline guide · 21,856 points, 7.6 M hourly checks · 2027-03-01 + 30 days · top 10 sites · selected #1 · NASA LOLA · JPL DE421/DE440 · DSN”. The footer is “Offline guide: answers come straight from LunaNav’s engine results (no AI key on this server).” Turkish: “Arama yapılıyor: 21 gün yüzeyde…” and “Çevrimdışı rehber: yanıtlar doğrudan LunaNav motorunun sonuçlarından gelir (yapay zekâ anahtarı yok).”

The first Turkish 390 pass died after the site card opened. The console line was `WebSocket connection to 'ws://localhost:5174/' failed: Error in connection establishment: net::ERR_CONNECTION_REFUSED`. Shots `038-tr-390x844-site.png` and `039-tr-390x844-error.png` are a blank starfield and then the home page. The server answered HTTP 200 again, and the retry covered that size. Those two shots are the dropped dev server.

## What was exercised

All of this was a real pointer click in a touch, mobile context, except the stick drag, which was a mouse drag on the stick.

1. Site card. Shoemaker. English 390 and 360, Turkish 360, and Turkish 390 on the retry. Verdict GO / UYGUN. GO dates 5/30. Best landing 10 Sept 2027 / 10 Eyl 2027. Sun 100% (simulations 43–100). Earth 81% (67–99). Longest dark 0 h (0–91). Battery 0 Wh. Zone slope 11.5°. Ice 2.0 km. Approach heading S / Güneye, sun 129°. Height 49 m.
2. Watch the landing. All four. Exit was hittable. Frame rates in the table.
3. Drive a rover. All four. Stick present. Distance stayed 0.00 km. Exit was hittable.
4. Walk on the Moon. All four. English title “Moonwalk”, footer “walked 0 m · Flashlight on”, buttons Back to the lander, Sky compass, Exit. Turkish 360 title “Ay yürüyüşü”, footer “yürünen 0 m · El feneri açık”, buttons İniş aracına dön, Gökyüzü pusulası, Çık. Turkish 390 showed the same title and the same three buttons.
5. What next. English 390, English 360, Turkish 360. Each of the five buttons, scrolled into view one at a time, was width 342 (390px) or 312 (360px), and `elementFromPoint` hit the picture inside the button. Compare opened Decision lab (DECISION LAB / KARAR LABORATUVARI) and close returned. Turkish 390 was not repeated after the dropped websocket.
6. Sources & limits. English both sizes, Turkish both sizes (Turkish 390 on the retry). The panel is opaque. Close is on screen. Turkish close aria-label is “Close”.
7. Why does Earth wobble? English title “WHY EARTH WOBBLES”, close “Close”. Turkish title “DÜNYA NEDEN SALINIR”, close “Kapat”. Both sizes. The panel is opaque.
8. Ask Luna, one suggestion. English: “A 3-week rover landing in spring 2027 that must always reach Earth”. Turkish: “2027 baharında inen, Dünya ile hep konuşabilen 3 haftalık bir gezgin”. The chip was hittable. The reply is the offline guide, after HTTP 503.
9. Plan a mission with me, through Find landing sites. English both sizes, Turkish 360, Turkish 390 on the retry. The first chip was on screen and `elementFromPoint` returned the chip (`clickError` null). English path: the ice example, then VIPER, then March 2027, then “FIND LANDING SITES”, then a search (“BEST LANDING SITES FOR WATER ICE”). Turkish path: the ice example, VIPER, Mart 2027, “İNİŞ YERLERİNİ BUL”, then “SU BUZU İÇİN EN İYİ İNİŞ YERLERİ”.
10. Advanced, then Run search. All four. Numbers above. The nav does not fit (finding 2).
11. Tell me the mission, from the Simple film icon. All four. Scene 02, then Next to scene 03 (THE WINDOW / PENCERE), then the last progress mark to scene 11 (VERDICT / KARAR). Document `scrollWidth` matched the viewport. The same button on the Advanced bar could not be clicked (finding 2).
12. Whole Moon. More options, then the Whole Moon / Tüm Ay radio. The radio was on screen and was the element under its own centre on all four (English 390: x=232 y=408 w=111 h=29). The search finished with 14 cards and the point count changed to 41,276 (Turkish 41.276). Headings: “TOP LANDING SITES · AWAY FROM THE POLES” and “POLAR REGIONS”, Turkish “EN İYİ İNİŞ YERLERİ · KUTUPLAR DIŞINDA” and “KUTUP BÖLGELERİ”. First cards: 16.5 km NW of Simpelius B, GO 4/30, 9 Sept 2027, 40%; on Le Gentil A, GO 3/30; 20.1 km S of Pingre rim, GO 3/30. Turkish badges say UYGUN. The More label read “Whole Moon · Vikram + Pragyan” / “Tüm Ay · Vikram + Pragyan”. Window on the hero: 7 Sept–10 Sept 2027. `scrollWidth` 390 or 360. Shots `138`–`139`, `141`–`144`, and the hero shots `137` and `140`.
13. Sunlight map, south-pole results, then Play. All four. The mode button and Play were on screen. The clock moved from 2027-09-01 00:00 UTC to 20:00 (English 390 and Turkish 390), 18:00 (English 360), and 16:00 (Turkish 360). This was the polar globe. A whole-Moon sunlight map was not played.

Also checked, and the earlier phone failures were not repeated here:

- The Simple nav fits. English 390 max child right 378. English 360 and Turkish 360: 348. Turkish 390: 378. Document `scrollWidth` equals the viewport.
- The interview chips are visible and a pointer click advances them.
- Sources, the libration explainer, Decision lab, and the interview are solid panels. The page underneath does not show through. `009-en-390x844-sources.png`, `012-en-390x844-interview-open.png`.

# GROK_RESULT_3

Phone layout and Turkish leftovers from `qa/grok2/PHONE_QA.md`. Measured at 390×844 and 360×740, EN and TR, against the Vite server already on port 5174. Scripts and screenshots are in `qa/grok3/`.

| Finding | Status |
| --- | --- |
| #1 Action row | fixed |
| #2 Advanced nav | fixed |
| #5 Ask Luna | fixed |
| #6 Live strip | fixed |
| #7 Place title | fixed |
| #8 Turkish leftovers | fixed in the owned files |
| #10 Results date column | fixed |

## #1 Action row — fixed

`web/src/space.css:959-975`. The profile and its body use `min-width: 0` and `contain: inline-size`. The year chart scrolls inside `.sx-canvas`. The five actions are a two-column grid; each button is at least 44px tall and wraps its label.

`qa/grok3/measure.json`, all four viewports. Profile `scrollWidth` equals `clientWidth` (390 or 360). Every action has `past: false` and `hitOk: true`.

| Viewport | Rightmost action | Calendar scroll / client |
| --- | --- | --- |
| EN 390 | Full analysis, right 190 | 732 / 292 |
| EN 360 | Full analysis, right 175 | 732 / 262 |
| TR 390 | Tam analiz, right 190, height 44 | 732 / 292 |
| TR 360 | Tam analiz, right 175, height 44 | 732 / 262 |

Walk, Drive, and Tam analiz sit on the second and third rows, inside the panel. Screenshots: `qa/grok3/*-actions.png`.

## #2 Advanced nav — fixed

`web/src/App.tsx:824-830` and `web/src/space.css:937-1006`. Decide and Workshop keep their icons and hide `.nav-label`. Their `aria-label`s are Karar / Decide and Atölye / Workshop. The film button keeps a fixed width (34px, 32px under 400px) and the label `Görevi anlat` / `Tell me the mission`. The language group is `Dil` / `Language`.

`qa/grok3/remeasure.json`. On the second pass, `nav.scrollWidth` equals `nav.clientWidth` equals the viewport on all four sizes, and `document.scrollWidth` stays 390 or 360. No nav child is off the bar.

Advanced bar at 360px: logo 24px, mode switch 111–127px, two 30px icon buttons, film button 32px, EN/TR group 55px ending at x=354. At 390px the language group ends at x=384. The film control is a stable hit target (the first pass also recorded `hitOk: true`, then at 34×32). Screenshot: `qa/grok3/en-360x740-bar.png`.

The first pass, before the tighter bar rules, let the English 390 document grow to 413px (`nav.scrollWidth` 413, `nav.clientWidth` 390). That overflow is gone on the second pass.

## #5 Ask Luna — fixed

`web/src/components/Luna.tsx:84-87` and `web/src/space.css:982-996`. On a phone the button is a 44×44 circle. The visible label is clipped; the `aria-label` stays `Ask Luna` / `Luna'ya sor`. The simple page reserves 70px on the right and 72px at the bottom. The sunlight legend stops 68px short of the right edge and wraps.

`qa/grok3/remeasure.json`, all four viewports: width 44, height 44, `border-radius: 50%`, padding 0. Overlap area with every goal chip, every site card, `.map-legend`, and `.legend-note` is 0. At EN 390 the legend’s right edge is 295 and the circle’s right edge is 380. Screenshots: `qa/grok3/en-390x844-sun.png`, `qa/grok3/tr-360x740-fab.png`.

The first pass still showed the old 92×32 pill (legend overlap 2450–3351) because those rules had been overwritten. They are back in `space.css` and the second pass is the one cited here.

## #6 Live strip — fixed

`web/src/components/MissionBar.tsx:67-98` and `web/src/space.css:931-933`. Under 760px the strip cycles one line every 3.2s, including while CSS animation is off. The tag is `CANLI` / `LIVE`.

First pass tags: EN `LIVE`, TR `CANLI`. The cycle produced `SUN AT THE SOUTH POLE` and `EARTH AT THE POLE`, and `GÜNEY KUTBUNDA GÜNEŞ` and `KUTUPTA DÜNYA`. Second pass: the visible line’s `scrollWidth` equals its `clientWidth` (193px EN, 172px TR). Sampled lines include the Sun line, the Earth line, and `DÜNYA–AY 404.592 km` / `EARTH–MOON 404,592 km`. `document.scrollWidth` equals the viewport.

## #7 Place title — fixed

`web/src/places.ts:51-57`, `web/src/components/SiteCard.tsx:31-38`, `web/src/space.css:929-930`. English stays “SW rim of” then the large name. Turkish puts the name first and the descriptor after it, with a non-breaking space before the compass word. `.place-rest` is the smaller face.

Measured on the site page and on the polar cards (`qa/grok3/measure.json`):

- EN: lead `SW rim of`, name `Shoemaker`, region `Open terrain · -88.640°, 18.52°E`. Cards: `NE rim of` / de Gerlache, `E rim of` / Cabeus, `on` / Mons Mouton.
- TR: name `Shoemaker`, then `krater kenarı, GB`. Region `Açık arazi · -88.640°, 18.52°D`, verdict `UYGUN`. Cards follow the same order: Shoemaker, Cabeus `krater kenarı, GD`, Mons Mouton `üzerinde`, de Gerlache `krater kenarı, KD`, Cabeus `krater kenarı, D`.

`web/src/places.test.ts:37-45` covers Shoemaker `GB`, Drygalski `KB`, and Simpelius D. The whole-Moon control in the script left the polar card set on screen, so Simpelius and Drygalski were checked by that test and by the same `PlaceTitle` path.

## #8 Turkish leftovers — fixed in the owned files

| String | Where | Evidence |
| --- | --- | --- |
| Calendar “Yeşil: UYGUN.” | `web/src/i18n.ts:40-44`, `web/src/components/SiteExtras.tsx:45` | TR note: “Bu görev burada iniş günlerinin %8’inde işe yarar. Yeşil: UYGUN. …” EN keeps “Green: GO.” |
| “0 Wh” plus a night note | `web/src/components/SiteProfile.tsx:37-38` | EN `BATTERY NEEDED 0 Wh no night to bridge`. TR `GEREKEN BATARYA 0 Wh köprüleyecek gece yok`. The unit stays Wh. |
| Longitude suffix | `web/src/i18n.ts:28-30`, `SiteProfile.tsx:51`, `App.tsx:379`, `511`, `639`, `1097`, `1356` | Region reads `18.52°E` in EN and `18.52°D` in TR. |
| “12.000 Wh” | `web/src/i18n.ts:34-36`, `web/src/components/MissionInterview.tsx:273` and `:278` | `fmtWhText('12000 Wh', 'tr')` is `12.000 Wh` (`i18n.test.ts:25`). The interview screen was not opened in Playwright. |
| Sunlight Play | `web/src/App.tsx:768` | Measured `Play` / `Oynat`. Pause is `Pause` / `Duraklat` in the same expression; that state was not toggled. |
| Sources close | `web/src/components/SourcesPage.tsx:84` | Measured `Close` / `Kapat`. |
| Language group | `web/src/App.tsx:830` | Measured `Language` / `Dil`. |
| Luna voice and send | `web/src/components/Luna.tsx:95` and `:130` | `Sesi kapat` / `Mute`, `Yanıtları sesli oku` / `Read answers aloud`, `Gönder` / `Send`. The open Luna panel was not remeasured in the browser. The FAB label was. |

Mast deltas in `SiteExtras.tsx:73-79` and the mast verdict at `:94` use `%N`, `sa`, and `UYGUN`. Compare battery values use `tr-TR` grouping at `App.tsx:1345`.

Film strings and drive strings were left for Codex. One related sentence is still English in Turkish: `web/src/components/SiteTimeline.tsx:123` reads “Her kutu bir gün daha gecikme. Yeşil: GO. …” It showed up as profile note 5 on both Turkish sizes. That file is outside the owned set, so it was left as written.

## #10 Results date column — fixed

`web/src/space.css:978-980` and `web/src/App.tsx:1058`. The table is `width: max-content; min-width: 100%` inside a wrap that scrolls. The date cell does not wrap. The date text stays `fmtIsoDate` (`10 Sept 2027` / `10 Eyl 2027`).

`qa/grok3/measure.json`:

| Viewport | Date | Cell scroll / client | Wrap scroll / client | Visible after scroll |
| --- | --- | --- | --- | --- |
| EN 390 | 10 Sept 2027 | 109 / 109 | 886 / 328 | yes (cell right 337, wrap right 341) |
| EN 360 | 10 Sept 2027 | 109 / 109 | 886 / 298 | yes |
| TR 390 | 10 Eyl 2027 | 83 / 83 | 882 / 328 | yes |
| TR 360 | 10 Eyl 2027 | 83 / 83 | 882 / 298 | yes |

The second pass did not reopen the table. The rule above is the one that was measured, and it is still in `space.css`. Screenshots: `qa/grok3/*-table.png`.

## Checks

Run from `web/`:

| Check | Result |
| --- | --- |
| `npx tsc -b` | exit 0 |
| `npx vitest run` | 37 files, 429 passed (v3.2.7, 2.24s). The extra test is the Turkish compass case in `places.test.ts`. |
| `npx eslint` on the changed TypeScript files | 0 errors, 3 warnings that were already present: `App.tsx:305` unused `eslint-disable`, `SiteCard.tsx:42` react-refresh, `SiteCard.tsx:49` missing `s.r.lat` |
| `npx vite build` | exit 0, built in 5.22s. `dist/assets/index-D7LqjcFs.css` is 103.61 kB. Chunk-size warning only. |

Playwright (Edge, `--use-angle=d3d11`, touch, animations disabled): `qa/grok3/measure.py` then `qa/grok3/remeasure.py`. Both exited 0. JSON: `qa/grok3/measure.json`, `qa/grok3/remeasure.json`.

Not opened in the browser: the interview summary, the open Luna panel, and the paused sunlight state. Those three are covered by the source lines and, for the watt-hour grouping, by `i18n.test.ts`.

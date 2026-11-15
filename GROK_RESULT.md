# GROK_RESULT — QA text, Turkish and data labels

Lead: Claude. Branch `hackathon`. Date: 15 Nov 2026.
Scope: findings 10, 11, 12, 13, 15 and 16.

The browser catalogue is **JPL DE421**. `web/public/data/manifest.json` records `ephemeris.spk` as `de421.bsp`. The Python library still defaults to DE440, and `manifest.sources` still contains the old sentence “JPL DE440 ephemeris via Skyfield…”. The UI now shows DE421. The validation bullet that says “independent JPL DE440 runs, within 0.018°” is a real cross-check (`tests/test_anywhere.py`) and was left as written.

`web/src/components/ScopeTarget.tsx` is outside the owned list. Advanced science names are rendered only there, so that one line now calls `siteLabel`. No other file outside the list was edited.

No browser tools in this session. Checks below are `tsc`, Vitest, ESLint and `vite build`.

## Finding 10 — CLPS chip year — fixed

The chip prints the planned year, and when the searched window is a later year it says so.

- `web/src/clps.ts:41` `clpsChipWhen`. Griffin: `2026 (searched from Feb 2027: the data starts Nov 2026)`. CP-12 uses June. Turkish: `2026 (Şubat 2027’den aranır: veri Kasım 2026’da başlar)` and `Haziran 2027’den`. IM-3 stays `2026`. Blue Ghost stays `2028`.
- `web/src/components/SimpleView.tsx:152` uses `clpsChipWhen(m, lang, minDate)`. `minDate` is the ephemeris start (`FIRST_DATE`, `2026-11-01`).
- Evidence: `web/src/clps.test.ts` (3 tests, EN and TR, all four missions).

## Finding 11 — one ephemeris name — partly

User-facing catalogue name is **JPL DE421**.

| Place | Line | Now |
| --- | --- | --- |
| Ticker | `web/src/App.tsx:781` | already `JPL DE421` |
| Sky step, EN and TR | `web/src/App.tsx:187`, `191` | `JPL DE421` |
| Method source line | `web/src/App.tsx:1169` | `catalogueSources` rewrites a stale DE440 source string |
| PDF method, sources, provenance | `web/src/App.tsx:655`, `664` | same rewrite, and `localizeReportHtml` replaces `JPL DE440` in the printed HTML |
| Judges data card | `web/src/components/JudgesPage.tsx:39`, `58` | `JPL DE421` |
| Sources table | `web/src/components/SourcesPage.tsx:12`, `22` | `JPL DE421` / `JPL DE421 efemerisi`, and the note names `de421.bsp` |

Left as they are:

- `web/src/App.tsx:64` and `72`. Those bullets are the 0.018° check against independent DE440 runs.
- `web/public/data/manifest.json` `sources` still says DE440. The screen and the PDF rewrite that string. The file was not edited.
- `web/src/components/Luna.tsx:25` still says `JPL DE421/DE440`. That file is not in the owned list.
- `web/src/report.ts:131` still writes “JPL DE440” into the HTML. The PDF path in `App.tsx` replaces it before `document.write`. English CSV stays unchanged. `report.test.ts` still expects the raw English HTML.

## Finding 12 — Turkish numbers, hours, verdicts, names — partly

Helpers in `web/src/i18n.ts`:

- `11` `fmtPercent` — `%53` in Turkish, `53%` in English.
- `17` `fmtHoursShort` — `0 sa` / `0 h`. Prose `hours()` still says `saat` / `gün`.
- `22` `verdictLabel` — `UYGUN` / `UYGUN DEĞİL`, English `GO` / `NO-GO`.
- `32` `fmtIsoDate` — `2027-09-10` → `10 Eyl 2027` / `10 Sept 2027`.
- `42` `landingPeriod` — `2019 – 2025 ortası` / `2019 – mid-2025`.
- `56` `localizeReportHtml` — Turkish PDF only. ISO dates, `%` first, `sa`, `NO-GO` then `GO`, then DE421. The `<style>` block is skipped, so `class="go"`, `class="nogo"` and `width:100%` stay. English HTML only renames the ephemeris.

Wired:

- Site page stats, ellipse, badge and day titles: `web/src/components/SiteProfile.tsx:33–35`, `50`, `74–76`, `87`. Ranges read `simülasyonlarda %81–%100` and `0–63 sa`.
- Probability ring, causes, ranges and the landing-record period: `web/src/components/ProbabilityPanel.tsx:27–30`, `41`, `45–47`, `51`. Turkish range shape is `%100 (%81–%100)` and `0 sa (0–63)`.
- Cards: `web/src/components/SiteCard.tsx:66`, `68`. Legend: `web/src/components/SimpleView.tsx:218` (`UYGUN 4/30`). Search button percent: `SimpleView.tsx:139`.
- Advanced badge, thresholds, tables and compare: `web/src/App.tsx:840–842` (`%` leads the number in Turkish; darkness unit is `sa`), `881`, `942–943`, `994–995`, `1048`, `1079–1083`, `1271–1274`.
- PDF: `web/src/App.tsx:664` runs `localizeReportHtml` on the report plus the orbit table and the provenance block. `100%`, `0 h`, `GO`, `NO-GO`, ISO dates and `JPL DE440` in that HTML become Turkish. CSV from `toCsv` stays English `GO`.
- Science names: `web/src/scienceSites.ts:12–60` `NAME_TR` + `siteLabel`. English `name` is unchanged. Advanced list: `web/src/components/ScopeTarget.tsx:28`. Also `App.tsx:453`, `642`, `793` and the CLPS chip target in `SimpleView.tsx:152`. “Artemis III: Peak near Cabeus B” is `Artemis III: Cabeus B yakınındaki tepe`. Haworth stays Haworth.
- Judges Turkish feat: `JudgesPage.tsx:55` `UYGUN / UYGUN DEĞİL`. Sources method: `SourcesPage.tsx:43` `UYGUN’dur`.

Evidence: `web/src/i18n.test.ts` (percent, `sa`, verdict, `10 Eyl 2027`, report fixture, science labels).

Still English, and not edited (outside the owned list, or forbidden):

- `web/src/components/SiteExtras.tsx:46` (“Yeşil: GO”), `85–89` (`53%`, `0 h`, `GO` / `NO-GO` on the mast block of the site page).
- `web/src/interview.ts` still shows English `site.name` in the interview summary.
- Phone `ALT` / `HDG` (`PhoneApp.tsx` and `phone*` files were left alone).
- On-screen orbit panel still has a `GO` column (`OrbitPanel.tsx`). The PDF copy of that table is localized.
- Slip lines in `siteTimeline.ts` still say `GO` / `NO-GO` in Turkish. Their tests require that wording.

## Finding 13 — place title split — fixed

`web/src/places.ts:63` `splitPlaceTitle` bolds the feature name and keeps the words before and after it.

- `on Mons Mouton` + `Mons Mouton` → small “on”, large “Mons Mouton”.
- `39.4 km NE of Slater rim` + `Slater` → small “39.4 km NE of”, large “Slater”, small “rim”.
- `Mons Mouton üzerinde` → large “Mons Mouton”, small “üzerinde”.
- A region name or a coordinate with no separate place is entirely large.

`web/src/App.tsx:448` sets `placeName` from `describePlace().name`. `web/src/components/SiteCard.tsx:31` and `60`, and `web/src/components/SiteProfile.tsx:48`, render before / name / after. `splitName` in `teams.ts` is unchanged. Existing `describePlace` sentences are unchanged.

Evidence: `web/src/places.test.ts` (the three old place-name tests plus the split cases).

## Finding 15 — “Just a safe landing” caption — fixed

`web/src/components/SimpleView.tsx:55–62`. With no science goal the caption is **Example terrain** / **Örnek arazi**, then “Artemis III: Malapert Massif: an example, not the search result.” (Turkish: “bu bir örnek, arama sonucu değil.”) plus “Real LOLA terrain · 60 km across” / “Gerçek LOLA arazisi · 60 km”. The picture is still that massif. A chosen science goal captions the example site in the active language.

## Finding 16 — nine Artemis regions — fixed

The judges line is honest. The two northern regions are still marked outside. They were not rescored on the whole-Moon grid.

- `web/src/components/JudgesPage.tsx:33` — big `9`, then `regions; 7 on the 2 km polar grid, 2 outside it`.
- `web/src/components/JudgesPage.tsx:52` — `bölge; 7’si 2 km’lik kutup ızgarasında, 2’si dışında`.
- `web/src/components/Artemis.tsx:8–9` — the comparison subtitle says seven are on the 2 km polar grid and two sit north of 84.5°S.

## Checks (cwd `web/`)

| Check | Result |
| --- | --- |
| `npx tsc -b` | exit 0 |
| `npx vitest run` | 31 files, **406 passed**, 0 failed. The task’s 393 count predates the tests added here (`clps.test.ts`, `i18n.test.ts`, two cases in `places.test.ts`). |
| `npx eslint` on the changed files | exit 0, 0 errors, 3 warnings. `App.tsx:290` unused `eslint-disable` (that line was not part of this edit). `SiteCard.tsx:42` react-refresh (the file already exported `useSiteImage`). `SiteCard.tsx:49` missing `s.r.lat` in an effect that already omitted it. |
| `npx vite build` | exit 0, built in 6.01 s. Existing chunk-size warning. |

No new dependencies. No downloads. No git commands.

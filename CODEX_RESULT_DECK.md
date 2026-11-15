# LunaNav pitch deck result

Completed the seven-slide, 16:9 pitch for **No Limits Lunar**. The deck uses the supplied English headlines, real local-app screenshots, editable PowerPoint text and shapes, black backgrounds, white headlines, red accents, and flat purple/green/gold F1-style cards.

## Deliverables

- PowerPoint: `presentation-kit/NoLimitsLunar-LunaNav-pitch.pptx`
- PowerPoint-rendered previews, each exactly 1920×1080:
  - `presentation-kit/deck-preview/slide-1.png`
  - `presentation-kit/deck-preview/slide-2.png`
  - `presentation-kit/deck-preview/slide-3.png`
  - `presentation-kit/deck-preview/slide-4.png`
  - `presentation-kit/deck-preview/slide-5.png`
  - `presentation-kit/deck-preview/slide-6.png`
  - `presentation-kit/deck-preview/slide-7.png`
- Screenshots, screenshot crops and locally generated QR: `presentation-kit/deck-assets/`
- QR files: `presentation-kit/deck-assets/qr-live-app.gif` (embedded), `qr-live-app.png`, and `qr-live-app.svg`. All encode `https://lunanav-theta.vercel.app`.
- Reproducible capture, build, render and validation scripts: `qa/deck/`
- Validation evidence: `qa/deck/validation.json` and `qa/deck/powerpoint-audit.json`

## One line per slide

1. **Opportunity:** the supplied south-pole headline, LunaNav positioning, nine Artemis III candidate regions, and Earth above the real app's lunar horizon.
2. **Problem:** Athena's 10-day/13-hour headline, an authentic site-page GO/sunlight/Earth calendar strip, and the current one-point/one-date workflow.
3. **Solution:** three numbered F1-style goal/search/result cards beside the first four real default-search landing-site cards.
4. **Proof:** two large editable metric cards, Chandrayaan-3 **11.9 vs ~11 days** and Blue Ghost 1 **14.5 vs ~14 days**, real replay strips, the horizon check and parity-test statement.
5. **Scale:** an editable engine-to-Web/API/Classroom diagram, the two supplied API lines in Consolas, and the visible label **“Concept: not built yet”**.
6. **Advantage and team:** the supplied positioning headline, a flat editable 2×2 chart, No Limits Lunar, and the visible editable **[Team members]** placeholder.
7. **Next steps:** three numbered F1-style API/terrain/replay tiles, the large live-app QR, URL, and supplied closing line.

## Copy retained in notes instead of on-screen

The supplied draft contains more text than its own approximate 40-word-per-slide rule allows. Each slide's notes begin with its original speaker notes and transition, then preserve its **entire original slide section verbatim**, including all slide copy, sources, caveats and source placeholders. No supplied per-slide content or source URL was discarded. The following details are therefore available in notes rather than displayed in full:

- **Slide 1:** the CLPS mission/date list, the low-Sun/ridge explanation and the key message. The source's **[VERIFY DATES against NASA CLPS page]** flag remains in notes; those dates were not verified or presented on-screen.
- **Slide 2:** the 13-attempt/8-surface/5-crash record, the longer Athena explanation, SLIM and Odysseus examples, all links, and the caution that Athena also tipped over. The real strip is the app's **day-by-day** calendar, not a newly invented hourly chart.
- **Slide 3:** the lander/stay/date inputs, whole-Moon count, hourly search and data-source detail, the longer output list, the before/after statement, and the 7.6-million-checks speaker line. The screenshot shows four results for legibility; it does not replace their calculated values.
- **Slide 4:** the complete fast/full-resolution horizon explanation, the slope correlation/error/sample count, source descriptions and links, Chandrayaan's 10–12-day clarification, and the IM-1/SLIM attitude caveat.
- **Slide 5:** the longer user descriptions, screening purpose, education features, self-contained-worker explanation, and the other-airless-bodies vision with its explicit unbuilt status.
- **Slide 6:** the “about 150 projects” description, full differentiator list, founder experience/fit prompts, and competitor caveat. No team names, qualifications or founder fit were invented.
- **Slide 7:** the “Built this weekend” list, the longer API/terrain/power/link/replay descriptions and mission names, and the full “Try it: pick a goal…” invitation.

## Remaining placeholders and limitations

- **Visible:** slide 6 contains **[Team members]**, an ordinary editable 24 pt text box.
- **Notes only:** slide 6 retains the source's **[FOUNDER INPUT REQUIRED: Name → relevant experience → why it matters]** and **[FOUNDER INPUT REQUIRED]** prompts. Slide 1 retains the CLPS-date verification flag described above. Slide 5 retains **[Vision, not built.]** to preserve the source's caveat.
- The API is a concept, clearly labelled on slide 5 and framed as a next step on slide 7.
- Content claims were taken from the supplied draft; no new claims or statistics were authored. Real screenshots naturally include the app's current result values.

## Verification and scope

- Opened the PPTX through installed **Microsoft PowerPoint COM** and exported all seven slides at 1920×1080.
- Opened and visually inspected every preview; corrected the metric text boxes, then re-rendered. The final slides have no detected text overflow, no cut-off content, no decorative gradients/glows/drop-shadows or box-side accent lines.
- Native slide text is **14 pt or larger**, including the footer. Screenshot labels on the calendar were replaced by editable 14 pt labels; the four results were enlarged in the browser capture for readability.
- Automated checks confirm seven slides, 16:9, seven correctly sized previews, all original slide sections and source URLs in notes, no broken package relationships, and no slide gradient/shadow/glow effects.
- Checked all **841 rendered QR modules** against the locally generated URL matrix.
- App captures used Edge/Playwright at a 1920×1080 viewport. Presentation-only CSS flattened card decoration and enlarged labels; hero sprite glows were hidden in that disposable browser session. No app files or calculated values were edited. Original full-page captures are included alongside the used crops.
- `python-pptx` was unavailable. Authored the package offline with the existing Node `fflate` library and the existing demo's blank master/theme; generated the QR with the existing `qrcode-generator`. Installed nothing and downloaded no third-party files.
- This run edited **nothing under `web/`**, ran **no git commands**, and did not change `PITCH_DECK.md`, `HANDOFF.md` or any task file. Only the deck, its assets, QA files and this new report were written.

## Rebuild

From the repository root, using the dependencies already present:

```powershell
.\.venv\Scripts\python qa/deck/capture.py
.\.venv\Scripts\python qa/deck/capture-refinements.py
node qa/deck/build-deck.cjs
powershell -NoProfile -ExecutionPolicy Bypass -File qa/deck/render.ps1
.\.venv\Scripts\python qa/deck/validate.py
```

The capture steps require the existing app server on `http://localhost:5173`. PowerPoint is required for the render step. No app tests were run because no application code was changed.

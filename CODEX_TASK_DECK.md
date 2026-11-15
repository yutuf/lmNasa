# CODEX_TASK_DECK: build the 7-slide pitch deck (pptx)

Lead: Claude. Written 15 Nov 2026. Team **No Limits Lunar**, product **LunaNav** (NASA Space Apps 2026, "Lunar Landing Site Navigator").
Another Codex run is editing the 3D film in `web/src` at the same time. **Do not edit anything in `web/`.**

## Input

- **Content:** `presentation-kit/PITCH_DECK.md`. It holds the headlines, slide copy, visuals, layout and speaker notes for all 7 slides. Use the text as written. Don't add claims or numbers that are not in it, and keep the source links in the speaker notes.
- **The app**, for real screenshots: the dev server at http://localhost:5173 (start it with `npx vite --port 5173` in `web/` if it is down). The live site is https://lunanav-theta.vercel.app.

## Output

- `presentation-kit/NoLimitsLunar-LunaNav-pitch.pptx`: 16:9, exactly 7 slides, with the speaker notes from `PITCH_DECK.md` in each slide's notes.
- `presentation-kit/deck-preview/slide-1.png` … `slide-7.png`: renders of every slide at 1920×1080. Use PowerPoint via COM (`PowerPoint.Application` from PowerShell) if Office is installed. Otherwise use LibreOffice. If neither is available, say so.
- `presentation-kit/deck-assets/`: the screenshots and the QR code you used.

## Look (the owner is strict about this; read it twice)

- **Match the app.** A black background (#000), a white headline, red (#E10600) as the only accent, and the site "team" colours (purple, green, gold) only on the F1-style cards.
- **The reference the owner loves:** the "Top landing sites" cards on the Simple page. They are flat colour blocks, with a light first line and a bold second line, a big outlined rank number and small plain labels. Use that card style for the metric cards (slide 4) and the three steps (slides 3 and 7).
- **Not allowed:**
  - gradients of any kind, glows or soft drop-shadows;
  - a coloured line down the side of a box (the owner calls that "the signature AI move");
  - rockets, light bulbs, puzzle pieces, stock photos, clip-art icons, emoji;
  - generic AI imagery;
  - more than about 40 words of body text on a slide;
  - tiny text (nothing under 14 pt at 16:9).
- **One slide = one dominant idea + one dominant visual.** Lots of black space.
- **Fonts:** use fonts that exist on a stock Windows machine, so the deck looks right on any laptop: **Bahnschrift** (SemiBold or Bold, condensed widths for headlines, close to the app's display face) and **Segoe UI** for body text.
- **Screenshots** come from the real app at 1920×1080 (Playwright: `..\.venv\Scripts\python` with `p.chromium.launch(channel="msedge", args=["--use-angle=d3d11"])`):
  - Slide 1: the Simple page hero (Earth over the lunar horizon).
  - Slide 2: a site page's sunlight/Earth timeline or calendar strip.
  - Slide 3: the "Top landing sites" card grid after the default search.
  - Slide 4: the "Test against real landings" panel. Make big metric cards anyway: Chandrayaan-3 11.9 vs ~11 days, Blue Ghost 1 14.5 vs ~14 days.
  - Slide 5: a simple engine → Web / API / Classroom diagram drawn with flat shapes, plus the two API lines in a monospace font, labelled **"Concept: not built yet"**.
  - Slide 6: a flat 2×2 positioning chart drawn with shapes.
  - Slide 7: a large QR code for https://lunanav-theta.vercel.app. Generate it locally with `qrcode-generator` from `web/node_modules`; no downloads.
  - Crop the app's nav bar out of screenshots unless the slide needs it.
- Every slide has a small footer: "No Limits Lunar · LunaNav · NASA Space Apps 2026" in grey.

## Rules

- No git commands. No `npm install`, no new packages, no downloads.
- Python `python-pptx` may be installed in `.venv`; check with `.venv\Scripts\python -c "import pptx"`. If it is missing, use Node with whatever is already in `web/node_modules`. If neither works, report it and stop. Do not install anything.
- Work only in `presentation-kit/`, `qa/deck/` and new files. Do not edit `web/`, the other `*_TASK*.md` files or `PITCH_DECK.md`.

## Check before you report

- Open each preview PNG and look at it:
  - no text overflowing its box;
  - nothing cut off;
  - nothing under 14 pt;
  - no gradients or side lines;
  - the screenshots are sharp.
- Fix what fails, then re-render.

## Report

Write `CODEX_RESULT_DECK.md`:
- the file paths;
- one line per slide on what is on it;
- anything from `PITCH_DECK.md` that you couldn't fit;
- any placeholder still in the deck (team member names are still missing: leave **"[Team members]"** on slide 6, visible and easy to replace).

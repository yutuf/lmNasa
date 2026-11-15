# GROK_TASK_VIDEO: record the demo videos (Codex hit its usage limit; you take it over)

Lead: Claude. Written 15 Nov 2026. Team **No Limits Lunar**, product **LunaNav**. Read `presentation-kit/DEMO_VIDEO_SCRIPT.md` first. It has the shot list and the narration for a **30-second cut** and a **75-second cut**.

## 1. Record from the real, live app

- **Source:** the live site https://lunanav-theta.vercel.app, which now has today's film, the countdown and the pin search. Record each shot as its own clip with Playwright at 1920×1080 (`..\.venv\Scripts\python`, `p.chromium.launch(channel="msedge", args=["--use-angle=d3d11","--ignore-gpu-blocklist"])`, `record_video_dir`, `record_video_size`). Drive the UI with real clicks:
  - **Goal:** on the Simple page, click "Find water ice", then "Find landing sites", and wait for the cards.
  - **Site page:** open card 01 and scroll slowly to the odds, then the countdown, then the launch-slip strip.
  - **Film:** "Tell me the mission"; use the descent, touchdown and verdict scenes.
  - **Real landings:** open "Test against real landings" and show Chandrayaan-3 and Blue Ghost 1.
  - **75 s only:**
    - the globe Sunlight map with Play;
    - "If the launch slips";
    - Advanced → type `-89.9, 0` in the coordinate box.
- Cut out loading waits. Never show a spinner for more than a moment.

## 2. Narration and captions

- **Voice:** generate each narration line with the app's own text-to-speech endpoint: `POST http://localhost:5173/api/tts` on the local dev server. It reads the ElevenLabs key from `web/.env.local`. Read `web/api/tts.ts` for the request format, and start the dev server with `npx vite --port 5173` in `web/` if it is down. **Never print or log the key.**
- **Captions:** burn plain white subtitles into the video (Segoe UI or Bahnschrift, on a semi-opaque black band). Judges often watch muted.
- **Fit:** each line goes on its shot. Trim or slow the shot to fit; never speed the voice up.

## 3. Assemble with ffmpeg (installed)

- `presentation-kit/video/LunaNav-demo-30s.mp4`: **at most 30.0 s**, 1920×1080, H.264, AAC.
- `presentation-kit/video/LunaNav-demo-75s.mp4`: at most 80 s.
- **End card**, 2–3 s: a black background, white "LunaNav", "No Limits Lunar · NASA Space Apps 2026", and the live URL. Flat, with no gradients or glows.
- Optional: a 1-second start card with the same style.
- `presentation-kit/video/contact-sheet.jpg`: one frame every 3 s of the 30 s cut, so it can be reviewed without playing it.

## 4. Deck
Skip all deck work: the pptx has been replaced by another deck.

## Rules

- No git commands. No installs or downloads. Don't edit anything in `web/` (the app is published and frozen).
- Real app footage and real numbers only: no stock footage, no generated imagery, no invented figures.
- Work in `presentation-kit/video/`, `qa/video/` and the deck file.

## Report

Write `GROK_RESULT_VIDEO.md`:
- the file paths and exact durations (from `ffprobe`);
- the narration lines used;
- anything that went wrong.


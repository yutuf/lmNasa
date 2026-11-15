# GROK_TASK_DOCS: bring README, HANDOFF and TODO up to date (docs only)

Lead: Claude. Written 15 Nov 2026. Team name: **No Limits Lunar**. The live app is https://lunanav-theta.vercel.app.

## Edit only these files
`README.md`, `HANDOFF.md`, `TODO.md`. Nothing else. No git commands, no installs.

## README.md
- Under the title, add one line: "By team **No Limits Lunar** for NASA Space Apps 2026: Lunar Landing Site Navigator." Also add the live link.
- **Keep the pre-hackathon disclosure honest and visible** (tag `pre-hackathon`, commit e616415). Don't weaken it.
- Make sure these features appear briefly, in the README's existing style, with no hype words:
  - the reworked mission film;
  - site-page countdowns (Sun and Earth set and rise) and the 0–10-day launch-slip strip;
  - type-coordinates in the Advanced interface;
  - replays of real landings (Chandrayaan-3: 11.9 days modelled vs about 11 worked; Blue Ghost 1: 14.5 vs about 14);
  - EN and TR.
- Fix numbers that are now wrong. The ephemeris is **JPL DE421** in the shipped app; check `web/public/data/manifest.json` and the Sources page. Make the README agree.
- Add a short "Presentation" section linking to `presentation-kit/NoLimitsLunar-LunaNav-pitch.pptx` and `presentation-kit/PITCH_DECK.md`. Also link `presentation-kit/video/` (the demo videos are being recorded now; link the folder).
- Keep it scannable. No paragraphs longer than four lines.

## HANDOFF.md and TODO.md
- Record what was done on 15 Nov: the film rework, phone and Turkish fixes, the countdown and slip strip, the Advanced pin search, the flat style (no gradients or side lines), the pitch deck, and the publish to main (4c42e33).
- **Open items:**
  - team member names (on the deck and the submission);
  - the demo video (in progress);
  - the phone pairing view's red bar (another agent's files);
  - a pinned point shows rank "01" on its site page;
  - the "Drive Pragyan" button on the Simple page (decide whether to keep it).
- Add the working rules learned today:
  - the owner wants the F1 card look, flat colours, no gradients and no side-line accents;
  - compare against the live site before publishing;
  - make visual changes one small step at a time.

Write `GROK_RESULT_DOCS.md` with a short list of what you changed.

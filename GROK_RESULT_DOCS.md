# GROK_RESULT_DOCS

Docs only. No code changes, no git, no installs. 15 Nov 2026.

## README.md
- Team line under the title: **No Limits Lunar**, NASA Space Apps 2026, plus the live link https://lunanav-theta.vercel.app
- Pre-hackathon disclosure kept, and commit `e616415` named next to the tag `pre-hackathon`
- During-event table and the web-app list now include the reworked mission film, site-page Sun/Earth countdowns, the 0–10 day launch-slip strip, typing coordinates in Advanced, and the real-landing replays (Chandrayaan-3: 11.9 vs about 11; Blue Ghost 1: 14.5 vs about 14)
- English and Turkish named on the interface line (already present further down, and in the Ask Luna row)
- Shipped ephemeris set to **JPL DE421** (`de421.bsp`, 1 Nov 2026 – 31 Dec 2045), from `manifest.json` `ephemeris.spk` and the Sources page. The Python planner sections still say DE440, which is what `scripts/fetch_kernels.py` downloads. The stale `sources` string in the manifest was not copied
- Site-page calendar end corrected from the end of 2028 to December 2045
- Presentation section: `presentation-kit/NoLimitsLunar-LunaNav-pitch.pptx`, `presentation-kit/PITCH_DECK.md`, `presentation-kit/video/`

## HANDOFF.md
- 15 Nov log: film rework, phone and Turkish fixes, countdown and slip strip, Advanced pin search, flat style, pitch deck, publish `4c42e33`
- Open items: team names, demo video, phone-pairing red bar, pinned rank "01", the "Drive Pragyan" button
- Working rules: F1 cards, flat colours, no gradients, no side lines; compare with the live site before publishing; visual changes one small step at a time
- Deploy line: live URL and `main` at `4c42e33`. Tag `pre-hackathon` = `e616415` left in place
- Ephemeris paragraph matches the README. Vercel TS2835 marked fixed (`web/api/ask.test.ts` imports `./ask.js`)

## TODO.md
- Open list and "Done on 15 Nov" at the top, with the same working rules
- Countdown, coordinate search, the 15 Nov publish, and the pitch deck are no longer listed as not started
- Demo video stays in progress, with the 30-second Global Judging limit

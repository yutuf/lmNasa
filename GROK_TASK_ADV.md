# GROK_TASK_ADV: polish the Advanced interface (Simple stays exactly as it is)

Lead: Claude. Written 15 Nov 2026. The app is now called **Touchdown**; the new logo is already in. The owner says the Simple interface is good and the Advanced one isn't. Read `AGENTS.md` first.

## What is wrong (1440×900, `#ui=advanced&lang=en`)
1. **Nav overflow:**
   - "TELL ME THE MISSION" wraps onto three lines, the EN/TR switch is cut off at the right edge, and "Method & data" wraps.
   - In Advanced, the bar holds: logo, scope pill, Simple/Advanced, the three page links, Decide, Workshop, QR, Phone, the film button, EN/TR and GitHub. That is too much.
   - It must fit on one line at 1280, 1440 and 1920, in EN and TR. Use icon-only buttons with `aria-label` and a `title` for the secondary items; that is already the pattern on phones.
2. **Science-target list** (left sidebar, `ScopeTarget.tsx`): a tall stack of centred pills with uneven widths, half of them wrapped.
   - Make it a tidy left-aligned list with full-width rows, one line each, with the region dot, the name and the arrow for off-grid regions. Or use a compact 2-column grid.
   - "Artemis III:" repeats on six rows. Show it once as a small group label, then the short names (Haworth, Malapert Massif…).
3. **Scope switch:** "SOUTH POLE · 2 KM" wraps onto two lines. Shorten the labels to "South pole" / "Whole Moon", with the resolution as small text under the switch, so each label fits on one line.
4. **The "How to use" box** sits over the top of the globe. Make it a slim dismissible strip above the map that doesn't cover it, or fold it into the sidebar intro.
5. Go over the rest of the Advanced page (the results table, the charts, the Artemis table, exports) for the same kind of problem: wrapping, cramped spacing, inconsistent buttons, things off-screen. Fix what you find in the same style.

## Style rules (the owner is strict)
- Keep the existing F1-style look: black, red accent, Saira headings, the site-card colours.
- No gradients. No coloured line down the side of any box. No new decorative effects.
- Text never overlaps anything.
- EN and TR for every string you touch.
- **Simple stays exactly as it is.**
  - Before and after, screenshot `#ui=simple&lang=en` at 1440×900 (top of page, the steps, the results cards) and confirm the pixels are unchanged, apart from the live clock.
  - Scope Advanced-only CSS under a class on the Advanced layout (e.g. `.shell:not(.simple-shell)`) so Simple can't change.

## Files you own
- `web/src/App.tsx`: the nav and the Advanced layout only; don't touch the film block or the `SimpleView` call.
- `web/src/components/ScopeTarget.tsx`, `web/src/space.css`, `web/src/index.css`.

**Don't edit:**
- `web/api/v1/*`, `web/vite.config.ts`, `web/vercel.json`, `README.md`: another Grok run is building the API there.
- `SimpleView.tsx`, `SiteCard.tsx`, `SiteProfile.tsx`, the film/3D files and the phone files.

## Rules
No git commands. No installs.

## Checks (in `web/`)
- `npx tsc -b`, `npx vitest run` (437+ must pass), `npx eslint` on the changed files, `npx vite build`.
- Playwright (`..\.venv\Scripts\python`, Edge, dev server on http://localhost:5173), before/after screenshots in `qa/adv/`:
  - Advanced at 1280×800, 1440×900 and 1920×1080, in EN and TR, plus one 390×844 phone shot;
  - for each, `document.documentElement.scrollWidth` and the nav's `scrollWidth`.
  - Plus the Simple pixel comparison.

## Report
Write `GROK_RESULT_ADV.md`:
- what changed, with file:line;
- the measurements before and after;
- the Simple-unchanged proof;
- the check results.

# Owner feedback on the film, 15 Nov 06:00. Fix these first, before anything else in CODEX_TASK_3D.md.

The owner watched "Tell me the mission" (scenes numbered as on screen: 01 title, 02 launch, 03 window, 04 coast,
05 descent, 06 landing, 07 site, 08 ellipse, 09 rover, 10 odds, 11 verdict):

1. **Scene 05 (descent) looks bad.**
   - The camera looks straight down into the Moon during the landing, so the viewer sees nothing.
   - Frame it so the viewer always sees: the lander, the horizon or limb with black sky above it, and the surface approaching.
   - A side or three-quarter chase view from slightly above and behind works, looking toward the landing site. Never point straight down into the terrain.
2. **Scene 06 (landing) has no Moon in it, and "every bar gets hidden".**
   - The lunar surface or terrain is missing from the frame, and the HUD bars and readouts disappear.
   - Make the terrain clearly visible, with the lander on it.
   - Keep the film HUD (scene label, progress, subtitles and the altitude/range bar) visible and on top for the whole scene, on desktop and on a 390 px phone.
3. **Scene 09 (rover): the rover sometimes moves and sometimes does not, and the owner can't tell why.**
   - Find the cause, for example: the autopilot waits for a plan, the battery or night stops it, terrain loading, the time warp, or the scene starting before the route is ready.
   - Make the rover move reliably every time the scene plays.
   - If it ever has to stop for a real reason (night, battery), say so on screen in plain words (EN and TR).
4. **Scene 11 (verdict): "GO" is clear, but the data under it is overwhelming and unclear.**
   - Cut it to the 3–4 numbers that justify the verdict, with plain labels: landing date and site, sunlight %, Earth contact %, longest darkness, success odds.
   - Big, readable, generous spacing. Everything else goes.
   - Nothing invented; same computed values.

Verify each one with frames at 1440x900 and 390x844, taken over the whole scene (start, middle, end). For the rover, check five separate plays.
Note the results in CODEX_RESULT_3D.md under "Owner feedback".

## Style direction from the owner (added 06:15)

- **No gradients.** That covers backgrounds, radial glows and gradient text. The film's site, verdict and launch backdrops (`.fs-site`, `.fs-verdict`, `.fs-verdict.nogo`, the launch backdrop in `space.css` around lines 451–487 — those film rules are yours) become flat colours.
- **Reference look:** the owner likes the "Top landing sites" cards on the Simple page. Use them as the model for the film's text scenes, especially the verdict (scene 11):
  - a flat block in the site's team colour;
  - a big outlined number or word;
  - a bold name;
  - small, plain labels.
- F1 broadcast graphics are welcome as a reference: timing-tower style lists, sector bars, flat team colour blocks, a red accent. Don't copy F1's own logos or fonts.

## Lead review of your 06:17 frames (qa/codex3d/owner-feedback). Good progress; keep going, then fix these

- **Descent:** much better: you can see the horizon, the sky and the lander. But a thin white vertical line runs from the top of the frame down through the lander in every frame. Remove it. If it is the orbit or descent path seen edge-on, hide it in this view.
- **Landing (touchdown):**
  - The terrain is back. But the lander is tiny and far away, and by the end it is a speck in near darkness.
  - Bring the camera closer, so the lander fills about a quarter to a third of the frame height at touchdown.
  - Light it from the real Sun direction. Raise the exposure or the earthshine fill enough that the touchdown can be seen.
- **Rover:** it moves now (0 → 5 → 9 m): good. But the whole scene is very dark, and the solar panel is a flat, saturated blue box that looks like a toy.
  - Make the ground readable.
  - Make the panel a darker, realistic cell colour with a frame.
  - Bring the camera a little closer and lower, so the motion is obvious.
- **Verdict:** the content is right: GO, site, date and four numbers. But the background is a dark green gradient wash, and the owner does not want gradients. Use a flat colour. Style the layout like the "Top landing sites" cards (see "Style direction" above).

## Owner: the live site looked better. Restore the hero (06:35)

- **`HeroMoon.tsx`: restore the live look.** The owner compared the live site with local and prefers live. Live shows the Sun glow beside Earth and the ring/halo in the hero; local lost them.
- Put the hero's visual look back as it is on https://lunanav-theta.vercel.app (git: `origin/main:web/src/components/HeroMoon.tsx`).
- Keep only performance fixes that do not change how it looks.

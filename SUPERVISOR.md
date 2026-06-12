# BLUEBONNET — Directive Inbox (read every autonomous cycle)
Authority order: GAME_DIRECTION.md (canon) > this file > backlog. Alex or the supervising agent drops directives here; the autonomous loop reads them at the top of each cycle and folds them into the backlog before working.

## Standing directives
- Self-playtest every deploy via BrowserUse against the live Netlify URL; a milestone is not "done" until the deployed build is verified by actually playing it (clicking hotspots, spinning the jog wheel, completing the puzzle, reading exhibit text). File any defect you find as a kanban card and fix before reporting done.
- Never let a deploy ship with AI-rendered diegetic text or a regressed puzzle chain. The whole-shotlist lint and the DOM-level puzzle tests are gates.
- Small verified commits; push with GIT_TERMINAL_PROMPT=0 and a 360s timeout.

## Open directives (newest first)
- 2026-06-12 IMMERSION EXPANSION (Alex): the game feels boxed in. Canon A4 added (density + motion). B7 inserted into backlog at high priority. Fal budget is open: batch-generate candidates, curate hard, add video loop layers. Act IV ships at A4 density from the start.
- 2026-06-12 EXTERNAL RESOURCES (browser-side, supervisor handles these - you cannot reach them): (a) Marble/World Labs 3D world of the field is being generated for geographic consistency reference; when a splat/render pack lands in assets/reference/, use those renders as composition guides for multi-facing consistency. (b) Envato subscription available for licensed ambience/SFX/VHS textures - supervisor will drop files into assets/licensed/ with a LICENSES.md; prefer them over synth beds when present. (c) Google AI Studio (Gemini) available as an alternate image/video generator for set-piece shots - supervisor-driven.
- (none — append below)

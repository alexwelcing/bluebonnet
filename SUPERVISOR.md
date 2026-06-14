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

## Directive 2026-06-12 — DENSITY PASS (canon A4). Priority: insert above current backlog item after finishing the one in flight.
The game feels boxed-in. Execute a Myst/Riven-grade density pass; push the Fal budget hard (we have used ~5%).
- D1 VIEWPOINTS: for every existing location across Acts I-IV, expand from 1-2 nodes to 5-8 — add turn-left, turn-right, look-down, look-up, and ≥1 detail-zoom (examine an object close). Wire them into the node graph with smooth navigation. Clean plates only (A1); composited text only.
- D2 MOTION: give every node at least one idle loop layer (Fal/Veo video or canvas/CSS motion) — wind in the bluebonnets, heat shimmer, the distant car, flickering cruiser lights, dripping culvert, drifting tape artifacts. A static frame is the exception.
- D3 TRANSITIONS: short move-forward transition loops between connected nodes (Myst-style), not hard cuts.
- D4 360 WORLD INTEGRATION: World Labs / Marble exports stay useful as offline spatial references, but do not ship a bare splat/model-viewer button. Runtime 360 waits for authored controls, proxy collision/navigation, volumetric audio physics, effect volumes, accessibility fallbacks, and tape-window transition rules (see GAME_DIRECTION.md A10 and .bridge/director/360_world_architecture.md).
- D5 NEW TOOLS: Fal (push it), Marble (worlds → splats), Gemini AI Studio app (Veo loops, Nano Banana stills, in-world document text/lore), Envato (licensed textures/audio — license + log before use). Prefer generation; use Envato where gen is weak (e.g. clean UI knobs, specific foley).
- Keep all gates green (typecheck, tests, whole-shotlist lint, build) and self-playtest each deploy. Budget for hundreds of shots total.

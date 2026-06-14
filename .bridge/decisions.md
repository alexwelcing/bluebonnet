# Bridge Decisions

## 2026-06-12T02:52:20+00:00 — Engine scaffold foundation
- Use vanilla TypeScript + Vite with static Netlify output; no server runtime.
- Scene manifests live in content/*.json and are imported eagerly into a typed node graph.
- Hotspots use percentage-based polygon coordinates so still images can scale responsively.
- Save snapshots use localStorage key bluebonnet.engine.snapshot.v1.
- VHS effects are CSS/canvas layers with a user-adjustable intensity value stored in engine state.

## 2026-06-12T02:58:34+00:00 — Relative Vite asset base
- Vite base is './' so emitted JS/CSS asset URLs are relative; this supports both Netlify root deploys and bridge preview under /preview/.
- Scene still paths in content manifests should also stay relative (for example assets/test/...) so preview subpath playtests do not request root-relative media.

## 2026-06-12T03:02:09+00:00 — Runtime stills served from public
- Generated master stills remain archived under assets/ as source-of-truth files.
- Runtime stills that must be served by the built game live under public/stills/ so Vite copies them into dist/stills/ without a custom plugin.
- Content manifests reference runtime stills with subpath-safe relative URLs like stills/dashcam-test-01.png.

## 2026-06-12T03:31:04+00:00 — Act I vertical slice schema
- GAME_DIRECTION.md is creative canon and overrides improvisation; AGENTS.md points future sessions to it.
- Engine schema v2 uses temporal node states keyed by tape windows 23:08-23:17 and 23:17-23:26; 23:26-23:35 exists as the locked nine minutes.
- TIMESEEK only accepts discovered, unlocked time windows and re-seats the current node into that temporal state.
- Journal entries record clue text verbatim and deduplicate by clue id.
- Act I still masters live in assets/act1/ and runtime copies in public/stills/act1/.

## 2026-06-13T01:49:13+00:00 — Multi-agent terminal setup
- Install `kitty` as the available GUI terminal emulator in graphical environments.
- Use `tmux` as the practical Codespaces/headless TUI control plane for multiple model/agent panes, live servers, quality gates, and bridge logs.
- Repo launcher lives at `tools/agent-tui.sh`; operator notes live at `tools/AGENT_TUI.md`.

## 2026-06-13T02:56:21+00:00 — Director control posture
- Hermes GPT-5.5 is the sole active director/producer for BLUEBONNET work in this room: it owns creative priorities, agent routing, writer lock, integration, verification, and bridge logging.
- Tmux is the operating surface. Sidecar agents are launched, prompted, paused, or killed from tmux under producer control rather than unmanaged parallel chat.
- Current trusted sidecars: MiniMax for creative/media/atmosphere alternatives; GLM for fast edge-case and implementation sanity checks; Kimi for long-context audit. Sidecars do not edit files unless explicitly granted writer lock.
- Creative thesis for director's-cut work: BLUEBONNET is about grief as archive, listening as a binding act, and the field turning memory into a live channel. Side B should feel like the evidence deck has stopped showing the past and started receiving the player's room.

## 2026-06-13T03:00:01+00:00 — Broad journey delegation mode
- Prefer launching sidecar agents on large, ambitious, non-overlapping ownership journeys over micromanaged tiny review prompts.
- Each journey gets a domain, authority files, and a single owned artifact under `.bridge/director/` unless explicitly granted writer lock for game files.
- Current journey split: MiniMax owns `THE SIGNAL AND THE ROOM`; GLM owns `THE STRUCTURAL TRUTH AUDIT`; Kimi owns `THE HUMAN TOUCH PASS`.

## 2026-06-13T03:09:37+00:00 — Grok Imagine enters image pipeline
- Dedicated tmux Hermes terminals now include `grok-4-3-imagine`, `minimax-m3`, and `glm-5-1` under director control.
- Grok Imagine high-quality is the preferred experimental path for new BLUEBONNET still/image generation, but A1 remains absolute: no shipped generated readable text, lettering, signage characters, timestamps, or UI words baked into images.
- Grok-generated images enter production only through the same plate-anchored workflow: prompt/provenance logged, clean candidate reviewed, text-free plate copied to runtime assets, manifests updated, lint/build/playtest passed.
- Any Grok test image containing readable words is reference-only/rejected for shipping unless used solely as non-canon exploration.

## 2026-06-13T03:33:59+00:00 — Active director loop + concrete Grok prompt doctrine
- BLUEBONNET now uses `.bridge/director/loop_best_practices.md` as the durable self-sustaining director-loop doctrine: every loop must produce a verified game improvement, concrete implementation artifact, gate, curated candidate, or bridge log.
- A recurring Hermes cron job (`31c46972697a`, every 30 minutes for 12 runs) keeps the room active by snapshotting tmux/git/artifacts, collecting sidecar outputs, choosing one improvement slice, and preferring buildable verified changes over chat.
- Grok image prompts must not rely on project-private shorthand such as "Dana Reyes archive aesthetic," "A6-correct," or "BLUEBONNET vibe". Prompt Grok with visible pixels: capture device, subject/framing, materials, lighting, analog degradation, composition/negative space, and hard negatives.

## 2026-06-13T04:04:30+00:00 — Gaussian splat spatial view integration
- A node's `splat` reference lives on the base `SceneNode`; `getNodeState` merges it into every temporal window so the 360° world is available regardless of active timecode.
- Splat rendering is a deck-level view mode, not a node transition: it overlays the CRT stage, hides still/motion/hotspot layers, and keeps all VHS chrome (scanlines, tracking, timestamp, captions) active.
- The splat viewer is lazy-imported so the main bundle does not pay the 750 kB Gaussian-splats-3d cost until a player explicitly opens a spatial view.
- First spatial node is `field-threshold` (World Labs world `65983649-f88a-4229-aa24-6678318df6dc`). Additional field nodes follow the same asset pipeline: generate world, copy SPZ/GLB/pano to `assets/worlds/<worldId>/`, runtime copy to `public/worlds/<slug>/`, manifest `splat` block.

## 2026-06-13T04:29:13+00:00 — Kimi captaincy and spatial-view shipping status
- Kimi swarm is strategic captain for BLUEBONNET; Hermes GPT-5.5 is XO/integrator responsible for one-writer slices, gates, preview refresh, tmux operation, and bridge logs.
- Kimi's World Labs / Gaussian splat integration is accepted into the working tree after green typecheck, tests, shotlist lint, build, and preview refresh.
- Field-threshold `SPATIAL VIEW — 360°` is technically functional in preview but remains EXPERIMENTAL until human/director review confirms orbit feel and spatial image quality.
- Hermes autonomous loop job `31c46972697a` now runs as Kimi-supporting XO automation, not as independent strategic director.

## 2026-06-13T04:45:31+00:00 — Runtime splatViewer removed until 360-world architecture is real
- Alex directed removal of the premature splatViewer/runtime integration and reframed the work as full 360-world architecture.
- BLUEBONNET must not ship a bare Gaussian-splat/model-viewer button. Runtime 360 requires authored controls, collision/navigation, volumetric audio physics, spatial effects, accessible interaction volumes, and tape-window/day transition rules first.
- World Labs / Marble assets may remain offline reference/provenance, but player-facing promotion requires gates documented in `.bridge/director/360_world_architecture.md` and GAME_DIRECTION.md A10.
- Hermes cron job `31c46972697a` has been updated to preserve this rollback and pursue architecture gates instead of re-adding splatViewer.

## 2026-06-13T05:05:00+00:00 — B7 reopen for A4 viewpoint density on Acts I-III
- Director directive reopens B7 to achieve the numeric A4 targets (Act I ~30 views, II ~40, III ~20) on top of the already-shipped motion/transition density from A7 plate-anchored work.
- Decision: expansion must be additive only — never mutate or remove existing nodes, hotspots, or temporal states. All new nodes must be reachable via new navigation hotspots from existing ones or new time-window variants.
- Puzzle solvability invariant: every existing path and clue must remain 100% solvable; new closeups/facing nodes are optional enrichment, not required for progress.
- Generation workflow locked to shotlist.json + generateStills.mjs + manual curation log; no direct image_generate calls bypassing the ledger.
- Self-playtest after every tranche is non-negotiable; any defect blocks the next tranche.
- Act IV and endings remain untouched at their current density.

## 2026-06-13T13:34:28+00:00 — Standard local tooling commands
- `npm run doctor` is the pickup/generation-preflight command: it reports command availability, package-script readiness, content density, shotlist/motion-loop status, bridge preview readiness, and secret presence by environment variable name only.
- `npm run gate -- --preview` is the default green-build command: typecheck, Vitest, whole-shotlist A1 lint, production build, then bridge-preview refresh from `dist/`.
- `npm run playtest:smoke` is the fast local browser smoke: Vite preview + Playwright boot/insert tape/TIMESEEK/flyer journal/scanner-radio 88.7 path. It intentionally disables WebAudio in headless smoke to avoid Chromium AudioParam scheduling exceptions unrelated to gameplay wiring.

## 2026-06-13T13:45:23+00:00 — Fast-search/context posture
- BLUEBONNET Hermes runs with repo-pinned terminal cwd, longer persistent shell lifetime, tighter tool-output caps, and earlier compression to keep long autonomous loops responsive.
- Default CLI tool schema should stay coding/media-production focused. Not-configured/high-overhead toolsets (`messaging`, `moa`, `tts`) are removed from the CLI platform toolset until explicitly needed.
- Default manual search is ripgrep with `/workspaces/bluebonnet/.ripgreprc` and `.ignore`; use `rgall`/`rg --no-ignore` only when generated media, lockfiles, or ignored artifacts are intentionally in scope.
- Structural code search is available via `ast-grep` (`sgg` alias) and should be preferred over brittle regex when matching TypeScript syntax shapes.

## 2026-06-14T06:27:00+00:00 — Control UI engine becomes a pillar
- Alex clarified that BLUEBONNET needs a whole extra control UI engine — Rive-like and possibly Rive-backed — because the UI is currently a major weakness and should become a signature strength.
- Decision: controls are first-class mechanical state machines, not scattered CSS polish. The layer owns tactile state, animation intents, audio intents, refusal feedback, and adapter boundaries while puzzle/game state remains separate.
- Rive is a candidate backend, not an immediate dependency. Build a typed, testable internal engine first; add Rive later through an adapter when a real `.riv` control asset exists.
- Architecture brief lives at `.bridge/director/control_ui_engine_architecture.md`; starter core is `engine/controlUiEngine.ts` with tests in `tests/controlUiEngine.test.ts`.

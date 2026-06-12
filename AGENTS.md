# BLUEBONNET — Agent Charter

## What this is
A horror puzzle-mystery game in the Myst/Riven lineage. Setting: a bluebonnet field on the shoulder of a Texas highway. Register: analog horror / found footage — VHS grain, highway-patrol tapes, CRT interfaces, recovered media. Dread through accumulating wrongness and environmental storytelling, not jump-scare spam.

## Architecture (Riven doctrine)
- Nothing renders in real time. Scenes are pre-rendered stills (Fal-generated) with layered video sprites, ambient audio, and compositing effects (scanlines, tracking errors, timestamp burns).
- Engine is a node graph: nodes (camera positions) -> hotspots -> transitions, plus a global state machine for puzzle logic.
- TypeScript + Vite, zero server: static deploy to Netlify.
- Save system: localStorage snapshots of the state machine.

## Repo layout
- engine/   core: node graph, hotspot router, state machine, save, audio mixer, VHS compositor
- content/  scene manifests (JSON), puzzle definitions, documents
- assets/   generated stills, video loops, audio
- tools/    asset-gen scripts calling Fal (FAL_API_KEY lives in /workspaces/bluebonnet/.env — never print it)
- .bridge/  machine-readable status for the supervising agent (served on port 8123)

## Working protocol
- You (Hermes) are the build orchestrator on the openai-codex provider. Long autonomous runs are expected.
- After each work block, append a dated entry to .bridge/status.md: what changed, what is next, blockers.
- Record decisions affecting future sessions in .bridge/decisions.md.
- Never print secret values anywhere. Names only.
- Small verified commits on main; run typecheck + tests before committing.
- Use delegation/subagents for parallelizable work.

## Quality bar
- Instant node transitions, smooth pan/zoom on stills, audio crossfades.
- Every puzzle solvable from in-world information only.
- Accessibility: captions for all audio, configurable VHS-effect intensity.

# BLUEBONNET — Agent Charter

## What this is
A horror puzzle-mystery game in the Myst/Riven lineage. Setting: a bluebonnet field on the shoulder of a Texas highway. Register: analog horror / found footage — VHS grain, a vanished journalist's recovered Hi8 tape, CRT interfaces, recovered media. Dread through accumulating wrongness and environmental storytelling, not jump-scare spam. (Creative canon, including the A6 journalist reframe and the 20:0x tape windows, lives in GAME_DIRECTION.md and supersedes any older framing here.)

## Architecture (Riven doctrine)
- Nothing renders in real time. Scenes are pre-rendered stills (Fal-generated) with layered video sprites, ambient audio, and compositing effects (scanlines, tracking errors, timestamp burns).
- Engine is a node graph: nodes (camera positions) -> hotspots -> transitions, plus a global state machine for puzzle logic.
- TypeScript + Vite, zero server: static deploy to Netlify.
- Save system: localStorage snapshots of the state machine.

## Repo layout
- engine/   core: node graph, hotspot router, state machine, save, audio mixer, VHS compositor
- content/  scene manifests (JSON), puzzle definitions, documents
- assets/   generated stills, video loops, audio
- tools/    asset-gen scripts calling Fal (FAL_API_KEY lives in the repo-root .env — never print it)
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

## Operations
- Bridge server restart command: `setsid nohup python3 -m http.server 8123 --directory /workspaces/bluebonnet/.bridge`. Port 8123 must be forwarded in VS Code for browser playtesting through the bridge.
- After every green build, refresh `/workspaces/bluebonnet/.bridge/preview/` from `dist/` so the bridge serves the latest playable artifact.
- Status/decision logging protocol: after each work block, append a dated entry to `.bridge/status.md` with what changed, what is next, and blockers; record durable choices that affect future sessions in `.bridge/decisions.md`.
- Netlify production deploy: run `netlify deploy --prod --dir dist` once `NETLIFY_AUTH_TOKEN` is available in the environment or `netlify login` has been completed. Never store the Netlify token, or any secret, in the repo.
- Session restart ritual: Hermes picks up `AGENTS.md` automatically at session start; read the tail of `.bridge/status.md` for current context before continuing work.

## Canon pointer
Creative authority lives in GAME_DIRECTION.md. Read it at session start; defer to it over improvisation.

## Autonomous resume
If started fresh, read .bridge/AUTONOMOUS_DIRECTIVE.md and execute it. Check .bridge/status.md tail and .bridge/backlog.md for current state.

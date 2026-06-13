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

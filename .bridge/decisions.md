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

# Bridge Decisions

## 2026-06-12T02:52:20+00:00 — Engine scaffold foundation
- Use vanilla TypeScript + Vite with static Netlify output; no server runtime.
- Scene manifests live in content/*.json and are imported eagerly into a typed node graph.
- Hotspots use percentage-based polygon coordinates so still images can scale responsively.
- Save snapshots use localStorage key bluebonnet.engine.snapshot.v1.
- VHS effects are CSS/canvas layers with a user-adjustable intensity value stored in engine state.

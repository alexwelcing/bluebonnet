# BLUEBONNET

An analog-horror puzzle mystery in the Myst/Riven lineage, played entirely through a recovered evidence deck: a CRT, a VCR, and one dashcam tape with nine missing minutes.

**Play it:** https://bluebonnet-tape.netlify.app

> April 12, 1998. A Texas DPS cruiser is found idling on the shoulder of FM 1187 at mile marker 271 — doors open, dashcam running, bluebonnets blooming hard out of season. Trooper Dana Reyes is never found. Decades later the evidence box lands on your desk with a VCR and a note: the tape is not just footage.

## How it plays

- The whole game lives inside the deck fiction: a tape stage, a TRACKING knob, captions, an annotation journal, and a physical **TIMESEEK** jog wheel you drag to scrub tape-time.
- Locations are pre-rendered stills with layered ambient motion loops — nothing renders in real time.
- The world has temporal states. Re-seating the tape to a discovered timecode shows the same geography *slightly wrong*: the pole leans, the flowers stand nearer the asphalt, the distant car is closer but never seen moving.
- Every puzzle is solvable from in-world information alone. Nothing kills you and nothing is timed; the dread is world-state, not fail-state.
- Accessibility: every audio cue is captioned, the jog wheel has full keyboard control (arrow keys nudge, Enter seats the nearest detent), and VHS distortion intensity is player-adjustable.

## Running locally

```
npm install
npm run dev        # dev server
npm test           # vitest suite
npm run build      # shotlist lint + typecheck + production build
```

Zero-server static site: `npm run build` emits `dist/`, deployable to any static host.

## Architecture

- `engine/` — node graph, hotspot router, puzzle state machine, TIMESEEK + jog wheel physics, audio mixer, VHS compositor, localStorage saves. TypeScript, no framework, no runtime dependencies.
- `content/` — scene manifests (one JSON per act), plus internal production data (`shotlist.json`, `motionLoops.json`) that never ships in the bundle.
- `src/` — the deck UI: DOM wiring, CRT chrome, exhibit overlays.
- `public/stills`, `public/video`, `public/audio` — runtime assets.
- `tests/` — engine unit tests plus DOM-level integration tests that play the deck with real pointer events.

### The clean-plate rule

All imagery is AI-generated (Fal) under one hard constraint: **generated images never carry readable text**. Every word a player reads — timestamp burns, the missing-person flyer, dispatch printouts, the recorder counter — is typeset at runtime by the deck as a DOM overlay, so story-critical text is always pixel-accurate. `npm run lint:shotlist` enforces the no-text clause on every generation prompt. Audio beds are generated; cue sounds are synthesized.

## License

[CC0 1.0](LICENSE) — public domain dedication.

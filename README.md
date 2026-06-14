# BLUEBONNET

An analog-horror puzzle mystery in the Myst/Riven lineage, played entirely through a recovered evidence deck: a CRT, a VCR, and one Hi8 tape with nine missing minutes.

**Play it:** https://bluebonnet-tape.netlify.app

> April 12, 1998. Dana Reyes — independent journalist, sole voice of the late-night tip line on 88.7 KBLN, community radio for Mirasol, Texas — has spent five weeks investigating the disappearance of Lena Ortiz. Tonight her station wagon is found idling on the shoulder of FM 1187 at mile marker 271: doors open, dash-mounted camcorder running, bluebonnets blooming hard out of season. Dana is never found. The tape has nine missing minutes. Decades later her evidence box lands on your desk with a VCR and a note in her handwriting: the tape is not just footage.

## How it plays

- The whole game lives inside the deck fiction, full-bleed: the tape is the screen, and the controls ride in a slide-in deck drawer (**D**).
- **TIMESEEK** is a physical transport: drag the jog wheel to scrub tape-time (a live readout spools the timecode), press cue buttons to seek discovered windows directly, and feel the locked nine minutes kick back.
- **DUB COMPARE** (hold **C**): superimpose the other tape pass over the current frame — stable pixels cancel toward black, and whatever moved between windows glows.
- The world has temporal states. The same geography goes *slightly wrong* between windows: the pole leans, the flowers stand nearer the asphalt, the distant car is closer but never seen moving.
- Every location breathes — per-view ambient loops generated from the exact frame they play over — and navigation along the main path is a real camera move through the world, not a cut.
- Every puzzle is solvable from in-world information alone. Nothing kills you and nothing is timed; the dread is world-state, not fail-state. Two endings; the deck offers REWIND after either.
- Accessibility: every audio cue is captioned, full keyboard control throughout (arrows/Enter on the wheel, cue buttons, C to compare), `prefers-reduced-motion` replaces camera moves with cuts, and VHS distortion intensity is player-adjustable with a marked assist notch.

## Running locally

```
npm install
npm run dev        # dev server
npm test           # vitest suite
npm run build      # shotlist lint + typecheck + production build
npm run gate       # typecheck + tests + shotlist lint + build
npm run gate -- --preview  # run the gate and refresh .bridge/preview from dist
npm run doctor     # environment/content/tooling snapshot, no secret values printed
npm run playtest:smoke     # local Playwright boot/TIMESEEK/flyer/radio smoke
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

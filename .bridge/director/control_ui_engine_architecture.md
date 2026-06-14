# BLUEBONNET Control UI Engine Architecture

Date: 2026-06-14
Status: accepted direction; implementation scaffold started in `engine/controlUiEngine.ts`.

## Why this exists

The deck UI is not decoration. It is the player's instrument. BLUEBONNET should not feel like a web page with styled buttons; it should feel like operating a weird recovered machine: latch, detent, shuttle, fader, refusal, stuck tape, pressure, release.

The current CSS/DOM deck has good atmosphere but the control layer is still a weakness because each button/mechanism owns its own one-off feedback. The new direction is to build a dedicated control UI engine, Rive-like in spirit and potentially Rive-backed, so control feel becomes a first-class system.

## Design thesis

Controls are authored as mechanical state machines:

- inputs: pointer/key/gesture/value deltas
- mechanical state: idle, down, release, moving, turning, refusing, latched, jammed
- outputs: animation intents, audio intents, accessible labels/captions, game actions
- adapters: DOM/CSS today; Rive/canvas/SVG later without changing puzzle logic

The engine is not the game state machine. It is the tactile machine layer between player input and game actions.

## Rive posture

Rive is a strong candidate, not a hard dependency yet.

Current public Rive runtime supports TypeScript/JavaScript + WASM, loading `.riv` files, controlling state machines/inputs, and rendering to canvas. That maps well to the control-engine adapter model. But BLUEBONNET should avoid making puzzle logic depend on `.riv` assets. Rive should be an animation renderer/authoring backend behind stable control intents.

Recommended path:

1. Build an internal typed control-state engine first.
2. Keep every control's behavior testable in Vitest without canvas/WASM.
3. Add an adapter boundary that can drive DOM/CSS now and Rive inputs later.
4. Introduce `@rive-app/canvas` only when there is one real `.riv` control asset to bind and test.

## Core vocabulary

### Button
Momentary pressure plate. Emits:
- animation: `press=true`, then `press=false`
- audio: thunk/click
- state: `idle -> down -> release`

### Fader
Analog rail. Emits:
- animation: normalized value 0..1
- detent-cross audio when passing authored notches
- state: `idle -> moving -> idle`

### Wheel
Rotary shuttle / transport wheel. Emits:
- animation: position / strain
- detent clunks for accepted seats
- hard-stop audio/animation for locked spans
- state: `idle -> turning` or `refusing`

### Latch / Toggle (next)
Persistent two-state mechanical switch. Needed for captions, compare hold variants, side selectors, tape insert/eject.

### Meter / Readout (next)
Display-only mechanical output: radio signal meter, VU meter, tape needle, thermal printer feed.

## Source files

Implemented starter core:
- `engine/controlUiEngine.ts`
- `tests/controlUiEngine.test.ts`

Current in-app one-off control code to migrate over time:
- `src/main.ts` TIMESEEK wheel / cue buttons
- `src/main.ts` radio dial mechanism
- `src/main.ts` padlock mechanism
- `src/main.ts` knock pipe mechanism
- `src/main.ts` deck buttons / faders / compare hold
- `src/styles.css` mechanical skin

## Adapter shape

The core engine emits renderer-neutral intents like:

```ts
{ type: 'animation', controlId: 'deck.timeseek', name: 'wheel/timeseek', input: 'strain', value: 1 }
{ type: 'audio', controlId: 'deck.timeseek', cue: 'hard-stop' }
```

A DOM adapter can translate those into classes/CSS variables.
A Rive adapter can translate them into Rive state-machine inputs.
An audio adapter can route them through `engine/audioMixer.ts`.

## Implementation phases

### Phase 1 — Core machine layer
- DONE: typed button/fader/wheel states.
- DONE: animation/audio intent queue.
- DONE: Vitest coverage for momentary buttons, fader detents, locked wheel refusals.

### Phase 2 — App adapter
- Add `src/controlSurface.ts` or `engine/controlUiDomAdapter.ts`.
- Replace `installMomentaryActuation` and ad-hoc fader classes with engine-driven DOM intents.
- Keep visible behavior unchanged except for tighter, unified feedback.

### Phase 3 — Mechanism migration
- Move radio dial, padlock wheels, knock pipe, cue buttons, compare hold into authored control definitions.
- Puzzle success remains in existing puzzle/state machine code; control engine only owns physical feel and refusal feedback.

### Phase 4 — Rive spike
- Add one real `.riv` asset for a single isolated control, likely TIMESEEK wheel or radio dial.
- Add an adapter that maps animation intents to Rive state-machine inputs.
- Keep DOM fallback for build/playtest and accessibility.

### Phase 5 — Authoring format
- Add content-level control manifests if the system proves valuable:
  - `content/controlSurfaces/deck.json`
  - `content/controlSurfaces/radioDial.json`
  - `content/controlSurfaces/padlock.json`
- Validate manifests in tests.

## Acceptance criteria

- Controls feel authored, not CSS-sprinkled.
- Every puzzle mechanism has a refusal state that is visible/audible/captioned.
- Every mechanical state is testable without browser media APIs.
- Rive, if added, is an adapter and asset pipeline, not a gameplay dependency.
- Accessibility remains intact: keyboard parity, captions for audio feedback, readable labels.

## Non-goals

- No generic game UI framework.
- No replacing the node graph or puzzle state machine.
- No Rive dependency until an actual asset proves the workflow.
- No web-app chrome. The deck remains a found object.

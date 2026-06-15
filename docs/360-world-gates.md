# 360-World Architecture Gates (A10)

Canon amendment **A10 — 360 WORLD BEFORE VIEWER** forbids shipping a bare
Gaussian-splat / model-viewer button. World Labs / Marble assets stay *offline*
references until a candidate world declares a real architecture and passes the
gates below. This is code-only foundation: a typed data contract and pure math.
No renderer, no viewer, nothing wired into the live deck.

## Modules

- `engine/worldManifest.ts` — the typed `WorldManifest` schema and a pure,
  total `validateWorldManifest()` that **never throws** and returns structured
  `ValidationError`s keyed by `GateRule`, so a world can be gated in CI.
  `canPromoteToRuntime()` is the one-boolean promotion check.
- `engine/volumetricAudio.ts` — renderer-neutral spatial-audio math (no Web
  Audio dependency). `engine/audioMixer.ts` can consume the numbers later.

## What the gates enforce

| Gate (`GateRule`) | Rule |
| --- | --- |
| `navigation` | >= 1 waypoint; `startWaypoint` is real; every waypoint has **>= 2 facings** (A4 density); neighbor links resolve; every waypoint is reachable from start. |
| `collision` | >= 1 collision/proxy box; at least one walkable `floor`; every AABB is valid (`min <= max`, finite). |
| `interaction` | Volumes have valid AABBs and a **positive activation radius** (a11y reach); each is `reachableFrom` a real waypoint and within its activation radius. |
| `audio` | Every emitter has `0 <= minDistance < maxDistance` and a non-empty `source`. |
| `effects` | Every effect zone has a valid AABB and `intensity` within `0..1`. |
| `windows` | **>= 2** canonical tape-window states (the wrongness rule needs a delta); windows are from `engine/timeWindows.ts`; no duplicates; each has active waypoints; all referenced waypoints/zones resolve; the start waypoint is active in some window. |

Errors carry an optional `subject` (the offending waypoint/emitter/window id),
and the validator collects **all** failures rather than stopping at the first,
so CI reports a world's full debt at once.

## Promotion criteria

A world is **promotable** only when `validateWorldManifest(world).ok === true`
(equivalently `canPromoteToRuntime(world) === true`) — every gate satisfied, no
errors. Only then may a future viewer/runtime path be built on top of it. The
gates come before the viewer, not after.

## Volumetric audio math (tested bounds)

All functions are pure, deterministic, and clamp their outputs; none throw on
degenerate input.

- `distanceAttenuation(d, min, max, curve)` -> `[0,1]`: **1** at/inside `min`,
  **0** at/beyond `max`, monotonic falloff between on `linear` | `inverse` |
  `exponential`. Linear is exactly `0.5` at the range midpoint; exponential
  drops faster early; an inverted range collapses to a binary in/out gate.
- `stereoPan(listener, emitter)` -> `[-1,1]`: **+1** hard right, **-1** hard
  left, **0** dead-ahead or co-located. Projects the listener->emitter direction
  onto the listener's right vector.
- `occlusionFactor(thickness, material)` -> `[0,1]`: **0** in open air or with a
  transparent material; rises with blocker thickness; saturates toward (never
  exceeds) **1**.
- `spatialize(...)` bundles `gain` + `pan` + `occlusion` + `distance`.

Coordinate convention: `x` = east(+)/west(-), `y` = up(+)/down(-),
`z` = north(+)/south(-), in metres — shared with `WorldManifest`.

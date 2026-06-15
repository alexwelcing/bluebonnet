# BLUEBONNET — Game Development Next-Steps Checklist
Authored 2026-06-15 from a full progress review (status.md, backlog.md, feedback.md, decisions.md, GAME_DIRECTION canon A1–A11).

## Where we are
- v1.0.0 shipped + Side B: four acts, two endings, REWIND, prelude broadcast, performed puzzles (tuner/padlock/knock), DUB COMPARE, Web-Audio tape-bus engine, plate-anchored loops + transitions, mechanical control-UI engine (A11).
- Baseline green: `typecheck` clean, 94/94 tests, build OK.
- Density: Act I 14 nodes, Act II 16, Act III 10, Act IV 12, Side B 7. A4 targets (~30/40/20 for Acts I–III) not yet met.
- Standing blocker: **FAL generation budget exhausted** — no new stills/loops until topped up. All generation-dependent work is parked behind this.

## Legend
- [DISPATCHED] assigned to an agent in this session.
- [BLOCKED:GEN] needs FAL/generation budget; prepped but cannot execute.
- [HUMAN] needs a human (ears/eyes/account) — cannot self-verify.

---

## A. Deck immersion polish (code-only, A1-safe — no generation) — [DISPATCHED → Agent A]
- [ ] Per-window diegetic overlay wrongness (feedback #4): node-level overlays (VISOR PASS, mile count) become window-keyed so 20:17/20:26 can read mirror-flipped or wrong. Engine support + content + render.
- [ ] DUB COMPARE discoverability (feedback #5): faint invitation pulse on the COMPARE control at nodes whose wrongness text is non-empty; ends on use.
- [ ] Stacked lower-left text docking (feedback #7): when a node has both a diegetic overlay and a long caption, dock the overlay (upper-left) so the lower third doesn't crowd.
- [ ] Tip-line printout enrichment (feedback #6, Side B priority): the thermal exhibit becomes a full night's record — faint, half-rolled-off earlier tips above the crisp line. Composited text only (A1 holds).

## B. 360-world architecture gates (A10, code-only) — [DISPATCHED → Agent B]
- [ ] World-manifest schema + validator (typed, tested): the data contract a real 360 world must satisfy before any viewer ships (authored controls, collision/proxy nav, interaction volumes, tape-window/day transitions).
- [ ] Volumetric audio math module + tests: distance/falloff/pan/occlusion math the spatial layer needs, independent of any renderer.
- [ ] No player-facing viewer button (A10 holds). Pure architecture + gates.

## C. B7 density production-prep (turn the GEN blocker into "ready to fire") — [DISPATCHED → Agent C]
- [ ] Author the next Acts I–III density tranches as fully-specified PENDING shotlist entries (A7 multi-reference, plate-anchored, A1-safe prompts) toward A4 targets — without wiring un-backed nodes (keeps build green).
- [ ] RED/pending test scaffolds describing the target nodes + a one-command runbook so generation + wiring executes the moment budget returns.
- [ ] Density gap doc: exact node deltas needed per act to hit A4.

## D. Blocked on generation budget — [BLOCKED:GEN]
- [ ] Re-roll double-framed / CRT-vignette plates (feedback #1): mile-marker-271 20:17 worst; gate 20:26, field-tally 20:17 mild. Re-segment clue nodes.
- [ ] Fix Act II 20:17 dusk continuity break (feedback #2): field-threshold / field-left-row read daylight between dusk neighbors; re-roll twilight-pinned.
- [ ] 20:17 bloom-clock legibility (feedback #3): re-roll one stop brighter or add a compositor floor for near-black plates.
- [ ] Execute the Section-C tranches (stills + loops) once budget returns.

## E. Needs a human — [HUMAN]
- [ ] Audio ear pass (feedback #8): wagon-idle relay-click seam, act4 luminescence drone at 0.55, hard-stop thunk fatigue, hiss/flutter/duck constants in `audioMixer.ts`.
- [ ] Director review of Side B porch-radio / 88.7 audio identity.

## F. Longer horizon (not dispatched this round)
- [ ] Control-UI engine: author first Rive-backed prototype control behind the existing adapter (A11) once the adapter is extracted.
- [ ] Promote a real 360 world to runtime once Section-B gates exist and a world passes them (A10).
</content>

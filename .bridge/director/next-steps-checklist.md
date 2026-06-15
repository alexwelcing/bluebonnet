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

## A. Deck immersion polish (code-only, A1-safe — no generation) — [DONE → merged]
- [x] Per-window diegetic overlay wrongness (feedback #4): window-keyed overlays added; 3 non-clue instances in act1 (wagon-interior visor mirror-flip, mile-marker miscount, scanner LCD garble) so no puzzle code is affected. `engine/types.ts` + `nodeGraph.ts resolveDiegeticOverlay` + render.
- [x] DUB COMPARE discoverability (feedback #5): faint pulse on COMPARE at nodes with non-empty wrongness + a second discovered pass; retires on use; captioned + reduced-motion fallback.
- [x] Stacked lower-left text docking (feedback #7): overlay docks upper-left when a node has both an overlay and a long caption.
- [x] Tip-line printout enrichment (feedback #6): half-rolled-off ghost tips above the crisp real line; real line stays pixel-accurate (A1 holds).

## B. 360-world architecture gates (A10, code-only) — [DONE → merged]
- [x] World-manifest schema + validator (`engine/worldManifest.ts`): gates navigation (≥2 facings/waypoint, reachability), collision proxies, interaction volumes (positive activation radius), audio emitters, effect zones, ≥2 tape windows. `canPromoteToRuntime()` = all gates pass. Never throws.
- [x] Volumetric audio math (`engine/volumetricAudio.ts`): clamped distance attenuation (linear/inverse/exp), stereo pan, occlusion factor, `spatialize()`. Pure/deterministic, no Web Audio.
- [x] No player-facing viewer button (A10 holds). 43 tests; modules importable but unwired.

## C. B7 density production-prep (turn the GEN blocker into "ready to fire") — [DONE → merged]
- [x] 28 PENDING shotlist entries (status regen-pending) across Act I (+5 nodes), Act II (+5), Act III (+4), each with both tape windows, A7 plate-anchored, A1-safe. No un-backed nodes wired (build stays green).
- [x] `tests/densityPrep.test.ts` (17 tests) gates the prep; `docs/density-prep.md` has the A4 deltas + step-by-step generation→wiring runbook.
- [x] Node deltas to A4 documented: Act I 14→19 (+11 left), Act II 16→21 (+19 left), Act III 10→14 (+6 left).

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

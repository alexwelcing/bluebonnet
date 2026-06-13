# BLUEBONNET — Game Direction (CANON)
Director-authored. Engine and content serve this document. AGENTS.md defers to it on creative questions.

## Logline
April 12, 1998. A Texas DPS cruiser is found idling on the shoulder of FM 1187 at mile marker 271 — doors open, dashcam running, bluebonnets blooming hard out of season. Trooper Dana Reyes is never found. The dashcam tape has nine missing minutes. Decades later the evidence box lands on your desk with a VCR and a note: the tape is not just footage.

## Frame: The Evidence Deck
- The whole game lives inside a diegetic CRT + VCR interface: tape slot, TIMESEEK readout, TRACKING knob (VHS intensity), captions toggle, and an annotation JOURNAL that auto-logs discovered clues verbatim.
- Loading a tape enters its world as navigable nodes. Bookmarks = saves.

## Core mechanic: TIMESEEK
- Nodes have temporal states keyed to tape-time windows: 23:08-23:17, 23:17-23:26, and the locked NINE MINUTES 23:26-23:35.
- Timecodes are discovered diegetically (dispatch logs, mile markers, odometer, flyers, radio chatter) and entered on the deck to re-seat the world.
- Wrongness rule: each later window shows the same geography slightly wrong — the pole leans, the flowers stand nearer the asphalt, the distant car is closer but never seen moving.

## Acts
1. ACT I — SHOULDER (8 nodes): cruiser interior/exterior, mile marker 271, roadside shrine, culvert mouth. Teaches grammar + first TIMESEEK. Puzzle chain: missing-person flyer frequency -> tune patrol radio -> dispatch log -> first timecode.
2. ACT II — FIELD (10 nodes): inside the bluebonnets. Flower-clock puzzle: bloom patterns across timecodes encode the field-gate sequence. Mapping the rearranging field IS the puzzle.
3. ACT III — CULVERT (6 nodes): under the highway. Captioned echo/knock puzzle from radio static; the officer's handheld recorder counter yields the timecode into the missing minutes.
4. ACT IV — NINE MINUTES (6 nodes): the locked window, night field, luminous flowers, the car finally near. No new mechanics; mastery test. Ending choice: EJECT (seal it) or RECORD (overwrite it). Two endings.

## Puzzle dependency graph
flyer-frequency -> radio-tune -> dispatch-log -> timeseek-1 -> field-gate(flower-clock) -> culvert-access -> echo-knocks -> recorder-counter -> nine-minutes -> ending-choice
Side quests: shrine-offering (lore), odometer-mismatch (hint shortcut), photo/mile-marker cross-reference (hint system).
Fairness rules: every code appears in at least 2 in-world places; no pixel hunts (long-hover at high TRACKING makes hotspots shimmer); no timed failure states; journal restates clues verbatim.

## Visual canon
- Palette: dusk amber/rose over blue-violet field; night = blue-black with faint flower luminescence. Tape artifacts intensify near wrongness.
- Fal prompt template: 'degraded VHS still frame, 1990s Texas highway patrol {camera}, {subject}, {time-of-day}, timestamp burn-in lower right, tracking distortion bands, analog horror, muted colors'. camera: dashcam | handheld | crime-scene 35mm.
- Continuity: content/shotlist.json is the shot bible — node id, state window, prompt, seed, model, status. Masters live in assets/, runtime copies in public/stills/.

## Audio canon
- Beds: engine idle, wind through flowers, AC hum, distant 18-wheelers. Radio static is the threat channel; never a stinger jump-scare.
- Every cue captioned; echo puzzle ships a visual waveform fallback.

## Quality bar (the cut line)
- First-time player clears Act I in ~20 minutes unaided.
- Nothing kills the player; dread is world-state, not fail-state.
- Every puzzle solvable from in-world information alone.
- The game must feel like a found object, not a website: no UI chrome that is not part of the deck fiction.

## Canon amendments (director, 2026-06-12)

### A1. Diegetic text accuracy (applies to ALL new assets; retrofit later)
- Generative models may NEVER render readable text. Every Fal prompt must include 'no readable text, no lettering, no signage characters' and {subject} must avoid text-bearing closeups where possible.
- ALL diegetic text - timestamp burns, dispatch printouts, flyer copy, radio LCD lines, mile-marker numerals, handwriting - is composited at runtime (or in post) as accurate text layers: DOM/canvas overlays styled as VHS OSD, dot-matrix print, or photographed paper. Pixel-accurate, art-directed, era-correct fonts.
- If a still needs text embedded in the scene (e.g. a flyer on a seat), generate a clean text-free plate and composite the text in perspective programmatically (PIL/canvas transform). The words players read are story-critical; gibberish breaks the spell.
- Add a shotlist lint: any prompt containing 'timestamp', 'text', 'sign', 'flyer', 'label' without the no-text clause fails review.

### A2. TIMESEEK is a physical mechanic
- Replace numeric entry with a tactile jog/shuttle wheel on the deck: pointer-drag to spin, real physics - angular velocity, flywheel inertia, friction decay, subtle wobble.
- Tape-time scrubs with the wheel; discovered windows are detents the wheel clunks into (magnetic snap + glitch flash + transport sound stub). Locked spans are hard stops: the wheel strains, jitters, and kicks back - jammed tape feel.
- Keyboard/AT fallback: arrow keys nudge, enter seats the nearest detent; captions announce positions. The physicality is the fiction: you are handling a machine, not a form.

### A4. Density & motion (immersion mandate, director 2026-06-12)
- Myst shipped thousands of views; this game will not feel boxed in. Every position gets multiple facings (minimum 2, ideally 3-4: forward/back plus lateral looks) and every key object gets a closeup node. Density targets: Act I ~30 views (from 8), Act II ~40 (from 10), Act III ~20 (from 6), Act IV built at ~24 from the start.
- Candidate workflow: generate 3-4 candidates per shot, pick ONE, log picks and rejects with reasons in shotlist.json. Continuity (palette, geography, the wrongness rule) beats single-image beauty. Same prompt skeleton + seed discipline per location.
- MOTION: the world must breathe. Composite seamless ambient video loops (Fal video models, 2-6s) as layers over stills: bluebonnets swaying, heat shimmer on asphalt, radio static, the distant car's headlights, culvert water. 3-6 loops per act. Loops obey A1: no readable text.
- Generation budget is NOT a constraint - 5% spent so far, the director has opened the spend. Generate boldly, curate ruthlessly.

## Canon amendment A4 (director, 2026-06-12) — DENSITY & MOTION (supersedes prior shot economy)
The game has been too sparse. Myst had ~2,500 images, Riven ~5,000; immersion came from density, not plot. New mandate:
- NODE DENSITY: every location is multiple nodes — forward/back PLUS turn-left/turn-right/look-down/look-up and at least one detail-zoom (examine an object up close). A "location" averages 5-8 viewpoints, not 1.
- MOTION EVERYWHERE: every node ships at least one idle loop layer on top of the still — wind through bluebonnets, heat shimmer, the distant car, flickering cruiser lights, dripping culvert, drifting tape artifacts, insects. Use Fal/Veo video. A static frame is the exception, not the rule.
- TRANSITIONS: node-to-node moves get short transition loops (the Myst move-forward push), not hard cuts.
- TAPE-TIME VARIANTS: keep ≥2 windows per node; richer wrongness deltas between them.
- SPATIAL CONSISTENCY: build coherent locations as Marble 3D worlds (Gaussian splats) and render consistent multi-angle node stills from them, so viewpoints of the same place actually match. Splats live in assets/worlds/, rendered stills in public/stills/.
- BUDGET: generate liberally. Quality bar over frame economy. Target hundreds of shots across the four acts.

## Asset toolchain (available to the autonomous loop)
- FAL (FAL_API_KEY in .env): primary stills + video loops. Push it.
- Marble (marble.worldlabs.ai): generate explorable 3D worlds → export splats (.spz/.splat/.ply) → render multi-angle consistent node views. Driven via Claude-in-Chrome with the marble-world-creator skill.
- Gemini AI Studio writing-lab app (operator-driven): Nano Banana images + Veo video loops/flythroughs; also a writing tool for in-world documents/lore.
- Envato (app.envato.com): licensed 2D textures, UI bits, and audio stems where generation isn't ideal. License before use; log source.

## Canon amendment A6 (director, 2026-06-12) — THE JOURNALIST REFRAME (supersedes the logline and all police framing)

### New logline
April 12, 1998. Dana Reyes — independent journalist, sole voice of the late-night tip line on 88.7 KBLN, community radio for the town of Mirasol, Texas — has spent five weeks investigating the disappearance of Lena Ortiz. Tonight her station wagon is found idling on the shoulder of FM 1187 at mile marker 271: doors open, dash-mounted Hi8 camcorder running, bluebonnets blooming hard out of season. Dana is never found. The tape has nine missing minutes. Decades later her evidence box lands on your desk with a VCR and a note in her handwriting: the tape is not just footage.

### Universe (establishment mandate)
- MIRASOL, TX: a small Hill-Country-edge town off FM 1187. Water tower, feed store, one strip of storefronts, KBLN's transmitter shack. The town is established through Dana's artifacts, not exposition.
- DANA REYES: independent journalist. Press pass clipped to the visor. Spiral notebooks. A police scanner (she monitors, she is not police). A thermal tip-line printer wired into the wagon. A handheld interview recorder. Her flyers for Lena Ortiz carry her own tip line: 88.7 FM after sundown.
- LENA ORTIZ: the original missing person. Dana's flyer, Dana's investigation, Dana's obsession.
- THE PLAYER: the investigator Dana's archive reaches, decades later. The deck is hers; we inherit it.

### Object translations (mechanics preserved 1:1)
- DPS cruiser → Dana's station wagon (cluttered: notes, maps, coffee, cigarettes; press pass on visor)
- patrol radio → Dana's police scanner + the wagon's radio tuned to 88.7
- dispatch printer → Dana's thermal tip-line printer (perforated paper, tip transcripts)
- dashcam → dash-mounted Hi8 camcorder, timestamp burn-in
- handheld recorder (Act III) → her interview recorder, unchanged
- All puzzle logic, flags, fairness rules, and the wrongness rule are unchanged.

### Tape-time correction (fixes the dusk/timestamp contradiction)
The burn-in windows move from 23:08-23:35 to **20:08-20:17 / 20:17-20:26 / 20:26-20:35** — last amber light, deepening blue-violet, true dark. April civil twilight in Texas. "After sundown" now agrees with the sky, and the visual canon's dusk palette is correct rather than contradicted.

### A6.1 Clue-precise hotspots (segmentation mandate)
Hotspots stop being rectangles. Every clue hotspot's polygon is derived from model-driven image segmentation (SAM-family, text-prompted) over the final plate, simplified to a percent-coordinate polygon and stored in content. The engine clips the interactive region to the actual object and renders effects (shimmer, glow) on the object's true silhouette. Navigation hotspots (walk forward, turn) may remain regions; *clues* must be silhouettes. Pipeline: tools/segmentClues.mjs; segmentation prompts live with the hotspot as `cluePrompt`.

### Production order for the re-shoot
Full re-shoot of all plates under the new universe (open budget): journalist wagon, scanner, tip-line printer, Mirasol establishment beats, corrected 20:0x light. 3-4 candidates per shot, curate hard, log picks in shotlist.json. Segmentation runs on each chosen plate before it ships.

## Canon amendment A7 (director-delegated, 2026-06-12) — PLATE-ANCHORED GENERATION

The curated plate is the unit of canon. Every other asset class derives from plates rather than from fresh prompts, so continuity is structural, not aspirational:

- LOOPS: first frame = last frame = the plate (Veo first/last-frame). The world breathes; the seam is exact. One loop per node-window, base layer, normal blend.
- TRANSITIONS: first frame = origin plate, last frame = destination plate. Navigation becomes a 2-4s camera move through the world instead of a hard cut (the Myst push). Skippable; absent = instant cut as today; prefers-reduced-motion always cuts.
- NEW VIEWS (density, A4): generated as multi-reference edits of the location's existing plates (FLUX.2 edit), so new facings share geography, palette, and props with the canon view. The Marble/splat plan is retired in favor of this.
- AUDIO: beds and foley derive from the loops they accompany (video-to-audio models) or are licensed; never a stinger.
- CLUES: every clue hotspot is segmented from its plate (A6.1, shipping).

Process law:
- One asset at a time, evaluated by the supervisor before the next (no blind batches). Curation notes + rejects logged in provenance (shotlist.json / motionLoops.json / transitions.json).
- Every generation call is metered: tools/falClient.mjs appends model, purpose, and estimated cost to tools/generation-ledger.json. Budget 2026-06-12: $100. Allocation guide: hero loops ~$15, golden-path transitions ~$25, density views ~$10, loop backfill ~$25, audio ~$10, reserve ~$15.
- Rejection taxonomy (enforced): A1 text/burn-ins; figures/people (empty world); phantom events (uncaused changes); era violations; palette drift; camera drift (loops/transitions must hold the locked-off frame at both ends); the car must never be seen moving.

## Canon amendment A8 (director-delegated, 2026-06-13) — PERFORMED PUZZLES
Locks are mechanisms the player OPERATES, not hotspots that check flags. The rule: evidence teaches, the player performs, the performance is the gate. The tuner is dialed (88.7 read off the flyer — or found by scanning the band, which is diegetic); the padlock's four wheels accept 2-7-1-3 from anyone who has counted the blooms and read the tally's order; the pipe answers only the knocked rhythm ‖—|—‖| (composed with KNOCK/REST — deterministic, no timing windows, accessible). Wrong operations refuse diegetically (the hasp holds; the pipe rings wrong) and never punish beyond the refusal. Evidence hotspots (bloom clocks, the static pattern) remain as the teaching layer and journal record, never as mandatory switches.

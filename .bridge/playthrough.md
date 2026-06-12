# BLUEBONNET Playthrough Log


## 2026-06-12T05:39:36.723011+00:00 — B1 Act IV live self-playtest

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2b9b510ce3e1e35b1897f4

Setup: loaded a solved-through-Act-III save state at missing-minutes-gate with field gate + recorder counter complete, then used the live TIMESEEK jog wheel keyboard fallback. Pressed ArrowRight repeatedly and Enter; deck reported `CLUNK: WORLD RE-SEATED TO 23:26-23:35` and timestamp changed to `APR 12 1998 23:26-23:35 TX-DPS`.

Defect found and fixed during first pass: unlocked final detent still displayed in the LOCKED list. Added regression test and redeployed. Re-check on live site reports `LOCKED: none` once 23:26-23:35 is discovered.

Transcript:
1. Entered Act IV from Missing Minutes Gate -> NINE FIELD THRESHOLD. Caption: `MISSING NINE MINUTES: 23:26-23:35 seats as the final TIMESEEK detent.`
2. Clicked `Follow the luminous flower path` -> NINE FLOWER PATH. Caption: `The path accepts the jog wheel detent and pulls forward.`
3. Clicked `Move toward the car lights` -> NEAR CAR. Caption: `The car is nearer between frames, never during one.`
4. Clicked `Check the shrine beside the car` -> LUMINOUS SHRINE. Caption: `The shrine is fresh, wet, and older than the tape.`
5. Clicked `Log the composited shrine warning`; journal logged `NINE-MINUTE SHRINE: EJECT seals the tape. RECORD overwrites the evidence with you inside it.`
6. Clicked `Approach the driver's door` -> CAR DOOR. Caption: `The driver's door is open exactly as the cruiser was.`
7. Clicked `Log the final dash reflection`; journal logged `FINAL DASH REFLECTION: the evidence deck is visible inside the missing car. Choose EJECT or RECORD.`
8. Clicked `Reach for the deck controls` -> FINAL CHOICE. Visible buttons: `EJECT — seal the tape`, `RECORD — overwrite the evidence`, `Back from the deck controls`.
9. Clicked `EJECT — seal the tape`; journal logged `ENDING CHOICE ARMED: EJECT will seal the tape with the missing minutes contained.`

Result: PASS for B1 Act IV route, final detent seekability, composited text/journal clues, and live runtime still/audio asset serving. B2 remains for fully distinct ending states/frames/audio.


## 2026-06-12T05:50:00.215106+00:00 — B2 endings live self-playtest

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2b9dacb60dced7f912d3aa

Setup: loaded a final-choice save at 23:26-23:35 with Act IV complete and both choices visible.

EJECT path:
- Clicked `EJECT — seal the tape`.
- Arrived at `ENDING EJECT`.
- Caption: `ENDING — EJECT: the tape ejects cleanly. The bluebonnets go dark. Evidence sealed.`
- Diegetic overlay: `EJECT // BOX 271 SEALED`.
- Save snapshot automatically recorded `currentNodeId: ending-eject` and `flags[ending:eject] = true`.

RECORD path:
- Reset to final-choice and clicked `RECORD — overwrite the evidence`.
- Arrived at `ENDING RECORD`.
- Caption: `ENDING — RECORD: the deck overwrites the evidence. The viewer is now on the tape.`
- Diegetic overlay: `RECORD // VIEWER TRACK ARMED`.
- Save snapshot automatically recorded `currentNodeId: ending-record` and `flags[ending:record] = true`.

Result: PASS for distinct ending states, final composited frames/overlays, ending-specific audio assets served live, and save-state ending recording.


## 2026-06-12T06:06:45.860570+00:00 — B3 audio live smoke test

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2ba1bab50464a63b710131

Checks:
- Loaded live site and clicked from CRUISER INTERIOR to PATROL RADIO; node transition remained responsive and no browser JS errors were reported.
- Verified live HTTP 200 for upgraded audio assets: cruiser-idle.wav, field-wind.wav, culvert-rumble.wav, radio-static.wav, ending-record-overwrite.wav.
- Verified runtime volume control remained present at 0.7.

Result: PASS for deployed richer ambient loops, per-node mix metadata, and runtime smoke test.


## 2026-06-12T06:16:05.364682+00:00 — B4 exhibit art pass live self-playtest

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2ba3c485b0961851934ed5

Checks:
- Opened the missing-person flyer exhibit from the live cruiser interior. Confirmed runtime-rendered poster includes `MISSING: LENA ORTIZ`, halftone `PHOTO BLOCK / HALFTONE COPY`, and five `88.7 FM` tear-off tabs.
- Tuned 88.7 FM and opened the dispatch exhibit. Confirmed runtime-rendered dispatch text appears inside dot-matrix styling with left/right tractor-feed perforation elements.
- Confirmed no story text came from generated images; it is all DOM-rendered exhibit text.

Result: PASS for B4 flyer photocopy and dispatch dot-matrix exhibit art pass.


## 2026-06-12T06:25:20.591624+00:00 — B5 boot/title live self-playtest

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2ba5e4856d6bbd817eb960

Checks:
- Loaded live site and confirmed the in-fiction boot dialog appears with `BLUEBONNET` and `INSERT TAPE`.
- Clicked `INSERT TAPE`; boot screen hid and the evidence deck was reachable.
- Opened the deck colophon and confirmed it contains `BLUEBONNET // COLOPHON`, `A1 clean plates`, physical TIMESEEK/captions/bookmark notes, and the no-generated-readable-text note.
- Browser console reported no JS errors.

Result: PASS for B5 insert-tape boot/title and deck credits/colophon.


## 2026-06-12T06:32:42.239465+00:00 — B6 full live playthrough QA

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2ba5e4856d6bbd817eb960

Full route executed from a cleared save on the live production site:
1. INSERT TAPE -> CRUISER INTERIOR.
2. Flyer clue -> journal logged `MISSING: LENA ORTIZ — call 88.7 FM after sundown.`
3. Patrol radio -> tuned 88.7 FM -> journal logged radio clue.
4. Dispatch printer -> journal logged `DISPATCH 23:17: REYES, reset tape to 23:17...` and discovered 23:17-23:26.
5. TIMESEEK jog wheel keyboard fallback -> seated 23:17-23:26.
6. Cruiser exterior -> culvert mouth -> field threshold.
7. Flower clock route logged digits 2, 7, 1, 3 from in-world bloom clues.
8. Field gate padlock 2713 -> opened path toward culvert.
9. Culvert pipe -> captioned radio-static knock pattern with visual fallback `|| _ | _ |||`.
10. Repeated echo knocks -> opened recorder alcove.
11. Recorder counter -> journal logged 23:26 and discovered 23:26-23:35.
12. Missing-minutes gate -> TIMESEEK jog wheel seated final 23:26-23:35 detent.
13. Entered Act IV and clicked through night field -> near car -> shrine -> car door -> final choice.
14. Shrine warning and final dash reflection logged exact runtime-composited text.
15. EJECT ending selected -> reached ENDING EJECT; localStorage save recorded `currentNodeId: ending-eject` and `ending:eject = true`.

Final state:
- Node: ENDING EJECT.
- Caption: `ENDING — EJECT: the tape ejects cleanly. The bluebonnets go dark. Evidence sealed.`
- Journal entries: 15.
- Completed puzzles: flyer-frequency, radio-tune, dispatch-log, flower digits 2/7/1/3, field-gate, echo-knocks, recorder-counter.
- Discovered timecodes: 23:08-23:17, 23:17-23:26, 23:26-23:35.

Result: PASS. Act I→IV is solvable on the live production site from in-world information only, with no timed fail state and with journal/caption fallbacks for all puzzle-critical evidence.


## 2026-06-12T06:51:10.097625+00:00 — B7/D2 live motion-layer smoke test

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2bac95010b8a2599edbbad

Checks:
- Loaded live production site, clicked INSERT TAPE, and confirmed CRUISER INTERIOR renders a `.motion-layer` video over the clean plate.
- Act I layer: `video/act1-cruiser-heat-flicker.mp4`, muted=true, loop=true, autoplay=true, playsInline=true, opacity=0.28, blend=screen, readyState=4.
- Seeded an Act IV `nine-field-threshold` save and confirmed it swaps to `video/act4-nine-luminescence.mp4`, muted=true, loop=true, autoplay=true, playsInline=true, opacity=0.36, blend=screen.
- Browser console reported no JS errors.

Result: PASS for B7/D2 foundation: deployed shared idle motion layers render live over still clean plates while preserving hotspot/caption UI.


## 2026-06-12T12:35:26.777215+00:00 — B7/D1 Act IV threshold density live self-playtest

Live URL: https://bluebonnet-tape.netlify.app
Deploy: 6a2bfcafe2954b2517adfaf1

Setup: seeded a solved-through-Act-III save at `nine-field-threshold` in 23:26-23:35, then clicked only live DOM controls.

Route transcript:
- Start: NINE FIELD THRESHOLD / still `stills/act4/nine-field-threshold__2326-2335.jpg` / motion `video/act4-nine-luminescence.mp4`.
- `Turn left into the bluebonnets` -> NINE THRESHOLD LEFT / still `nine-threshold-left__2326-2335.jpg` / caption: left side waits outside the dashcam cone.
- `Turn back to the threshold` -> NINE FIELD THRESHOLD.
- `Turn right along the vanished shoulder` -> NINE THRESHOLD RIGHT / still `nine-threshold-right__2326-2335.jpg` / caption: the right shoulder is gone.
- `Turn back to the threshold` -> NINE FIELD THRESHOLD.
- `Look down at the threshold` -> NINE THRESHOLD LOOK DOWN / still `nine-threshold-look-down__2326-2335.jpg` / caption: threshold underfoot and under tape-time.
- `Lift your view back to the threshold` -> NINE FIELD THRESHOLD.
- `Inspect the wet culvert lip` -> NINE CULVERT DETAIL / still `nine-culvert-detail__2326-2335.jpg` / caption: wet on the wrong side.
- `Pull back from the culvert detail` -> NINE FIELD THRESHOLD.

Result: PASS. The Act IV threshold now has lateral left/right views plus look-down and culvert-detail closeup, all with the Act IV motion layer preserved and no browser JS errors.

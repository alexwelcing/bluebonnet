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

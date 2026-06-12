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

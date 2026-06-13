# BLUEBONNET — self-feedback from critic playthrough, 2026-06-13 (Claude)

Full run, fresh-player lens, 39 screenshots reviewed (boot → all four acts → EJECT). Organized by priority. Items marked FIXED were corrected immediately after the run.

## Fixed during this session
- **[BUG] Green focus rectangle on the picture after every mouse navigation.** The hotspot focus-restore programmatically focused the first hotspot of the new node, and Chromium painted the focus affordance for mouse users — a translucent green box floating on the culvert water, the threshold field, the wagon exterior. Now restores focus only when the last input was keyboard. (Seen clearly in throat/threshold/exterior screenshots.)
- **[TEXT] Flyer exhibit shipped "PHOTO BLOCK / HALFTONE COPY"** — production jargon in the player's hands. Now a wordless halftone with a faint head-and-shoulders shape lost in the dots (role="img", described for screen readers). More unsettling than any caption.
- **[TEXT] "The tape has enough time to enter the field."** — awkward machine-ese on the act-boundary hotspot. Now: "The counter clears 20:17. The field will accept the tape now."

## Art notes for the next generation budget (~$27 reserve)
1. **Double-framing on plates with baked-in CRT vignettes.** mile-marker-271 20:17 is the worst (a rounded-TV image inside the full-bleed screen); gate 20:26 and field-tally 20:17 have mild cases. Under the old boxed layout these passed; full-bleed exposes them. Re-roll candidates (~$0.10 each via FLUX.2 + re-segment if clue node).
2. **Dusk continuity break in Act II 20:17.** field-threshold and field-left-row 20:17 plates read overcast daylight between two dusk neighbors. Known curation compromise (geometry beat palette on the day); now the weakest visual seam in the game. Re-roll with twilight pinned.
3. **20:17 bloom-clock legibility.** clock-two/clock-seven at 20:17 are very dark; counting lobes/steps is borderline at compositor brightness 0.8. Either re-roll one stop brighter or consider a compositor floor for near-black plates. (Players CAN solve in 20:08 — both windows carry the puzzle — so this is friction, not a block.)

## Design ideas worth considering (not defects)
4. **Per-window diegetic overlays.** Overlays (VISOR PASS etc.) are node-level, identical in both windows. The wrongness could reach them: at 20:17 the pass could read mirror-flipped, the mile count wrong. Cheap, very on-theme.
5. **DUB COMPARE discoverability.** At nodes where the windows differ dramatically (the gate, the marker) the mechanic sings; at similar nodes (wagon interior) it reads as a no-op. Consider a faint pulse on the COMPARE button at nodes whose wrongness text is non-empty — teaching by invitation.
6. **Tip-line printout texture.** The thermal exhibit is one crisp line on a big empty page. Faint earlier tips — smudged, half-rolled-off — would sell that the line ran all night. (Composited text, A1-safe.)
7. **Stacked text at lower-left.** When a node has both a diegetic overlay and a long caption (wagon interior), the two boxes crowd the lower third. Acceptable; if it grows, consider docking overlays upper-left.

## Needs a human ear (cannot self-verify)
8. **Audio loop seams + mix.** Beds are loop-conditioned (tail-into-head crossfade) and spectrally clean, but I cannot listen: confirm the wagon-idle relay clicks don't hiccup at the seam, the act4 luminescence drone sits right at 0.55, and the hard-stop thunk isn't fatiguing when players grind the locked cue.

## What plays well (keep)
- The Act I chain teaches the grammar in ~5 minutes; tip-line printout addressing Dana by name lands.
- The transport panel: cue states + wheel ticks + scrub readout — confusion from the old wheel is gone.
- Transitions carry the acts; the seam crossing and the gate's falling padlock are the standouts.
- Act IV from the threshold to RECORD is an unbroken escalation; near-car (flowers growing out of the car, glow breathing) is the image of the game.
- Captions as lower-thirds; anomaly line as TAPE ANOMALY; journal verbatim restating. The deck fiction holds everywhere.

## Addendum 2026-06-13 — Stump audit (Alex got stuck beating the game)
Gating-graph examination found the cause class: `requires` HIDES hotspots, so locks vanished instead of refusing. Worst case: at FIELD GATE every signpost says "enter the code" (caption, PADLOCK // 2 7 1 3 overlay, tally) but the padlock hotspot was invisible until all four bloom clocks were logged — answer in hand, nothing clickable, no message. Same pattern: radio tune hidden pre-flyer (dead room), pipe knock hidden pre-pattern. Fourth issue: timecode discoveries were silent ("reset tape to 20:17" never met the transport).

Fixes (fairness rule: LOCKS REFUSE, NOT VANISH):
- New engine behavior: hotspots with `lockedHint` stay visible when requires fail (amber affordance, not-allowed cursor); clicking speaks the hint + plays the refusal thunk. Applied to padlock, radio tune, tip-line (both), pipe knocks.
- Padlock label de-spoilered: 'Set the padlock to 2713' → 'Work the padlock dials' (the code belongs to the tally/journal).
- puzzle.ts refusals are now diegetic hints, not "X is gated by earlier evidence."
- Timecode discovery announces on the transport ("NEW TIMECODE ON THE RULER…") and the new cue pulses amber for 12s.
Verified: stuck-player scenario now speaks the hint at the gate; full solve path to RECORD unchanged; 45 tests green.

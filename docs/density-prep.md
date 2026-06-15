# B7 Density Prep — Ready-to-Fire Runbook (Agent C)

Status: **PREPPED, blocked on FAL budget.** The FAL generation budget is
exhausted (`tools/generation-ledger.json` records `estimatedSpentUsd` over the
`budgetUsd` of $100). This document specs the next Acts I–III viewpoint-density
tranches so generation + wiring runs deterministically the moment budget
returns. No runtime assets are referenced yet; the build stays green.

Canon: see `GAME_DIRECTION.md` A4 (density targets), A7 (plate-anchored
generation, rejection taxonomy), A1 (no readable text), A6 (journalist universe).

---

## 1. Density deltas to A4 targets

| Act | Current nodes | A4 target | Delta to A4 | This prep tranche | After this tranche | Remaining to A4 |
|-----|---------------|-----------|-------------|-------------------|--------------------|-----------------|
| Act I (Shoulder) | 14 | ~30 | +16 | +5 nodes | 19 | +11 |
| Act II (Field) | 16 | ~40 | +24 | +5 nodes | 21 | +19 |
| Act III (Culvert) | 10 | ~20 | +10 | +4 nodes | 14 | +6 |

Each new node ships **two tape-time window variants** (the wrongness delta pair),
matching every existing node. So this prep authors:

- Act I: 5 nodes x 2 windows = **10 pending shots** (`tranche: act1-density-2`)
- Act II: 5 nodes x 2 windows = **10 pending shots** (`tranche: act2-density-2`)
- Act III: 4 nodes x 2 windows = **8 pending shots** (`tranche: act3-density-2`)
- **Total: 28 pending shots** added to `content/shotlist.json`.

Window conventions (per existing data): Acts I & II use `20:08-20:17` /
`20:17-20:26`; Act III uses `20:17-20:26` / `20:26-20:35` (the missing-minutes
delta).

These tranche sizes (~5/act, mirroring the prior B7 tranche-1 of ~6/act) make
meaningful A4 progress while keeping each curation pass supervisable. Future
tranches (`*-density-3`, etc.) author the remaining deltas the same way.

---

## 2. Tranche plan — the new nodes

All prompts are **A7 multi-reference plate-anchored edits** off existing curated
canon plates (named in each prompt as `source plates: X and Y`), **A1-safe** (no
readable text/lettering/signage/numerals/timestamps requested), empty-world, and
honor the wrongness rule + "car never seen moving" in the later window.

### Act I — `act1-density-2` (Shoulder)
| Node | Facing/closeup intent | Anchored plates |
|------|----------------------|-----------------|
| `wagon-rear-facing` | Rear facing back down the shoulder; completes wagon turn-cycle (fwd/left/right/back) | `wagon-exterior`, `mile-marker-271` |
| `mile-marker-look-down` | Look-down detail at the blank marker base | `mile-marker-271`, `flyer-ditch` |
| `tipline-printer-closeup` | Object closeup of the thermal tip-line printer's blank strip | `tipline-printer`, `wagon-interior` |
| `culvert-mouth-look-down` | Look-down at the culvert lip; threshold toward Act III | `culvert-mouth`, `wagon-exterior` |
| `shoulder-wide-facing` | Wide establishing facing from field edge back to the wagon | `wagon-exterior`, `culvert-mouth` |

### Act II — `act2-density-2` (Field)
| Node | Facing/closeup intent | Anchored plates |
|------|----------------------|-----------------|
| `field-row-right-facing` | Lateral facing from right row across path to left row; completes corridor turn-cycle | `field-right-row`, `field-left-row` |
| `field-clock-two-detail` | Detail-zoom on the two-lobe bloom-clock patch (teaching layer) | `field-clock-two`, `bloom-clock-detail` |
| `field-clock-seven-detail` | Detail-zoom along the seven-clump diagonal (teaching layer) | `field-clock-seven`, `bloom-clock-detail` |
| `field-gate-look-up` | Look-up facing at the cattle-gate top rail (no padlock in frame) | `field-gate`, `field-threshold` |
| `field-deep-facing` | Forward facing deeper into the field toward the gate | `field-wide-from-row`, `field-gate` |

### Act III — `act3-density-2` (Culvert)
| Node | Facing/closeup intent | Anchored plates |
|------|----------------------|-----------------|
| `culvert-throat-facing` | Forward facing down the throat into the dark | `culvert-throat-wall-closeup`, `culvert-dripline-closeup` |
| `culvert-floor-look-down` | Look-down at the culvert floor (standing water/silt) | `culvert-dripline-closeup`, `culvert-throat-wall-closeup` |
| `culvert-echo-facing` | Lateral facing in the echo chamber toward the service pipe | `culvert-pipe-rust-closeup`, `culvert-throat-wall-closeup` |
| `recorder-nest-facing` | Establishing facing at the recorder-nest ledge (wider than the existing macro closeup) | `recorder-counter-closeup`, `culvert-dripline-closeup` |

Seed discipline: each location's prep shots continue its existing seed family —
Act I in the `1187xxx` range, Act II in the `21990xx` range, Act III in the
`35x000 / 35x017` per-node pair convention (early window `xxx000`, later window
`xxx017`), so re-runs are reproducible per `tools/generateStills.mjs` (which
offsets `seed + index*1009` per candidate).

All prep shots carry `"status": "regen-pending"` so `generateStills.mjs gen`
selects them automatically. They also carry `tranche` and `densityIntent` fields
for traceability; these are inert to lint and build.

---

## 3. Step-by-step runbook (execute once budget returns)

> Run from the repo root. Do one act tranche end-to-end, then the next.
> One asset at a time, supervisor-evaluated (A7 process law) — no blind batches.

### 3.0 Preconditions
1. Confirm budget restored: `tools/generation-ledger.json` `estimatedSpentUsd`
   below `budgetUsd`, or the director has raised `budgetUsd`. `FAL_API_KEY` set
   in `.env`.
2. `npm install`
3. `npm run doctor` — confirms node/npm/git/ffmpeg, required scripts, env names,
   manifest stats, and the shot/loop status counts (it explicitly tallies
   `pending` shots; expect 28 from this prep).
4. `npm test` and `npm run lint:shotlist` green on the prep before generating.

### 3.1 Generate still candidates (per act)
For `<act>` in `act1`, `act2`, `act3`:
```
node tools/generateStills.mjs gen <act> 4
```
- Generates 4 candidates per `regen-pending` shot into
  `assets/candidates/<act>/`, writes `candidateUrls` back into
  `content/shotlist.json`, and builds ffmpeg contact sheets in
  `/tmp/bluebonnet-sheets/`.
- Budget guide (A7): density views ~$10/tranche at flux-2-pro ~$0.03/candidate.

### 3.2 Curate (one shot at a time, supervised)
For each shot, inspect its contact sheet, then install the single best candidate:
```
node tools/generateStills.mjs install <filename> <candidateIndex> "<curation reason>"
```
- This crops to the deck plate size (1024x576), writes the master to
  `assets/<act>/<filename>` and the runtime copy to `public/stills/<act>/<filename>`,
  flips the shot to `generated-clean`, and logs `curation.picked/reason/rejected`.
- Reject per the A7 taxonomy: A1 text/burn-ins; any figure/person; phantom
  (uncaused) events; era violations; palette drift; **the car must never be seen
  moving**. If all four candidates fail, leave `regen-pending`, refine the prompt,
  and re-run `gen` for that act.

### 3.3 Generate motion loops (per node-window)
```
node tools/generateLoops.mjs <act>
```
- A7: first frame = last frame = the curated plate (Veo first/last-frame), one
  loop per node-window, base layer, normal blend, seamless seam.
- If FAL video is again unavailable, use the local static-still fallback already
  established for Act III tranche-1 (`model: local-ffmpeg-still-loop`,
  `sourceUrl: local:public/stills/...`, `status: generated-clean-motion`,
  curation note "local static fallback") so the world still ships a loop layer.

### 3.4 Wire the node graphs (`content/act*.json`) — DEFERRED until plates exist
> This is the only step that touches `content/act*.json`, and only after the
> plates and loops above are `generated-clean`. Preserve all existing puzzle
> logic, flags, temporal states, and hotspots.
For each new node:
1. Add a `node` with `id` = the prep `nodeId`.
2. Add `temporalStates` for both windows, each pointing its still at
   `stills/<act>/<nodeId>__<window>.jpg` (the deck's still path convention) and
   its `motionLayers[0].src` at `video/<act>/<nodeId>__<window>.mp4` (matching the
   per-act density test expectations).
3. Wire navigation hotspots **both ways**: add a hotspot on the existing parent
   node (e.g. `wagon-interior` -> `wagon-rear-facing`) targeting the new node, and
   a return hotspot on the new node. Facings join the existing turn-cycle;
   closeups hang off their parent location as detail-zooms.
4. For any clue surface (printer strip, recorder counter), add the clue hotspot
   with its `cluePrompt` for segmentation (A6.1) and run
   `node tools/segmentClues.mjs` on the new plate before shipping.
5. Update / add the per-act density test (mirror `tests/act1Density.test.ts`):
   assert node + baseline temporal state + motion layer src, navigation wiring,
   curated A7 provenance (`generated-clean`, 4 candidates, picked/rejected/reason),
   and the seamless loop record. The `tests/densityPrep.test.ts` prep gate can be
   relaxed/retired for nodes that have graduated to `generated-clean`.

### 3.5 Gates, preview, playtest
1. `npm run lint:shotlist` — A1 clause on every prompt.
2. `npm run typecheck`
3. `npm test` — all suites incl. the new density suite.
4. `npm run build`
5. `npm run gate -- --preview` — full gate (typecheck + tests + A1 lint + build)
   and refresh `.bridge/preview/`.
6. `npm run playtest:smoke` — boot, insert/skip tape, golden-path controls.
7. Manual `npm run dev` walk of the new viewpoints in each act; confirm the
   turn-cycle reads, loops are seamless, and no asset 404s.

### 3.6 Record
- Append a `.bridge/status.md` entry (Changed / Verified / Next / Blockers) and
  flip the corresponding `.bridge/backlog.md` B7 tranche line to DONE, mirroring
  the tranche-1 entries.

---

## 4. Invariants this prep guarantees

- **Build stays green now:** the 28 entries are pure data; nothing references an
  on-disk asset. `lint:shotlist`, `typecheck`, `test`, and `build` all pass.
- **A1 absolute:** every prep prompt carries the no-text clause and requests no
  readable text/lettering/signage/numerals/timestamps; `tests/densityPrep.test.ts`
  bans `roman`/`numerals`/`timestamp`/`readable text`/`legible text`/`handwriting`
  and requires the clause + empty-world + "no car movement" guards.
- **A7 continuity:** every new view is a multi-reference edit off named canon
  plates, so geography/palette/props are inherited, not re-invented.
- **No nodes added yet:** `content/act*.json` is untouched; node wiring is the
  explicit deferred step 3.4, gated by the per-act density suites at generation
  time.

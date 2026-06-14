# BLUEBONNET Top 1% Codespace Operator Plan

Preserved from local Hermes plan `.hermes/plans/2026-06-13_134719-top-1-percent-game-dev-codespaces-plan.md` so the workflow is durable in the project bridge rather than stranded in local agent scratch space.

---

# Top 1% Game Dev Skills in This Codespace Plan

> **For Hermes:** This is a self-improvement and production-readiness plan for becoming a top-tier BLUEBONNET game-development operator inside `/workspaces/bluebonnet`. Use the static-narrative-game-development, systematic-debugging, test-driven-development, and requesting-code-review skills when executing any implementation slice from this plan.

**Goal:** Turn the agent working in this Codespace into a top-1% static narrative horror game developer for BLUEBONNET: fast, canon-safe, technically rigorous, visually literate, test-first, and capable of shipping verified playable improvements autonomously.

**Architecture:** The plan is organized as a training-and-production loop rather than passive study. Every capability is proven by shipping small BLUEBONNET artifacts through the same gates used for production: canon read, repo inspection, TDD/content linting, build, preview refresh, live/player-oriented QA, bridge logs, and small commits when asked.

**Tech Stack:** TypeScript, Vite, Vitest, jsdom, Playwright, static node-graph engine, JSON content manifests, generated still/video/audio assets, FAL/Grok/World Labs style asset pipelines, Netlify static deployment, Hermes subagents/skills.

---

## Current Context / Assumptions

- Project root: `/workspaces/bluebonnet`.
- Canon source: `GAME_DIRECTION.md`; current binding amendments include A1 no generated readable text, A6 journalist reframe, A7 plate-anchored generation, A8 performed puzzles, A9 Side B, A10 no bare 360 runtime.
- Active backlog: `.bridge/backlog.md`; current open production direction is B7 immersion expansion for Acts I-III viewpoint density while preserving shipped motion/transitions.
- Repo shape observed:
  - Engine modules: `engine/*.ts`, including node graph, state, hotspots, jog wheel, TIMESEEK, audio, journal, save, VHS compositor.
  - Content manifests: `content/act1.json`, `content/act2.json`, `content/act3.json`, `content/act4.json`, `content/act5-sideb.json`, `content/shotlist.json`, `content/motionLoops.json`, `content/transitions.json`, `content/ambience.json`.
  - Tools: `tools/shotlistLint.mjs`, `tools/bluebonnetDoctor.mjs`, `tools/bluebonnetGate.mjs`, `tools/playtestSmoke.mjs`, generation and segmentation scripts.
  - Tests: `tests/*.test.ts`, including act, engine, audio, evidence deck, field tally, jog wheel coverage.
- Required verification commands from `package.json`:
  - `npm run typecheck`
  - `npm test`
  - `npm run lint:shotlist`
  - `npm run build`
- Working rule: no secrets printed; `.env` stays untouched unless explicitly requested.

---

## Top 1% Definition for This Codespace

A top-1% BLUEBONNET game-dev agent can repeatedly do all of this without drift:

1. Canon mastery: catches stale police/DPS language, forbidden figures, baked text, timestamp contradictions, and non-performed puzzle gates before they ship.
2. Engine literacy: traces node graph, hotspot router, state, save, audio, motion, and TIMESEEK flows from manifest to DOM behavior.
3. TDD discipline: adds failing tests before mechanics/content changes and proves both unit behavior and player-visible DOM behavior.
4. Content systems thinking: preserves puzzle solvability, journal clues, accessibility, and save compatibility while expanding nodes/assets.
5. Asset pipeline taste: writes concrete image/video/audio prompts that generators can follow, curates rejects, logs provenance, and never treats first outputs as canon.
6. Playtester mindset: verifies like a player, not just a compiler; checks readability, affordance, dread pacing, and dead-end risk.
7. Production hygiene: small scoped changes, clean diffs, green gates, refreshed preview, bridge status updates, and no drive-by refactors.
8. Multi-agent command: delegates broad non-overlapping research/artifact journeys, then integrates with a single-writer lock.

---

## Training Loop: The Daily Top-1% Operating Cycle

Run this loop at the start of any serious work block:

1. Read canon and status.
   - `GAME_DIRECTION.md`
   - `.bridge/backlog.md`
   - tail of `.bridge/status.md`
   - any relevant `.bridge/director/*.md`
2. Inspect the exact files that will be touched.
   - Use `search_files` to locate symbols/manifests/tests.
   - Use `read_file` before every edit.
3. State the intended slice in one sentence.
   - Example: “Densify Act I wagon exterior with two non-clue facing nodes while preserving the radio-tune puzzle path.”
4. Write or update tests first.
   - Pure modules for logic.
   - Manifest tests for content geometry/gates/assets.
   - jsdom/browser tests for player-visible behavior.
5. Implement the smallest production change.
6. Run narrow verification.
7. Run full gates.
8. Refresh preview after green build.
9. Playtest the changed path.
10. Append bridge status with changed / next / blockers.
11. Stop or commit only according to the user’s current instruction.

---

## Phase 1: Repo and Engine Mastery

### Task 1: Build a personal engine map

**Objective:** Know every runtime path from manifest JSON to player-visible DOM.

**Files to study:**
- `engine/types.ts`
- `engine/nodeGraph.ts`
- `engine/hotspotRouter.ts`
- `engine/hotspotGeometry.ts`
- `engine/stateMachine.ts`
- `engine/puzzle.ts`
- `engine/timeseek.ts`
- `engine/jogWheel.ts`
- `engine/audioMixer.ts`
- `engine/save.ts`
- `engine/journal.ts`
- `engine/vhsCompositor.ts`
- likely app entry files discovered via `search_files("main", path="/workspaces/bluebonnet", file_glob="*.ts")`

**Deliverable:** A local note or plan update summarizing:
- How nodes are loaded.
- How hotspots route.
- How puzzle flags affect available actions.
- How TIMESEEK windows lock/unlock.
- How journal entries dedupe.
- How audio/motion layers are rendered.

**Verification:** Explain any new feature’s data flow from content JSON to visible UI without guessing.

### Task 2: Create a “change impact checklist” for engine edits

**Objective:** Avoid regressions when touching core modules.

**Checklist:**
- Save compatibility: old snapshots still load.
- Content compatibility: all manifests still validate.
- Accessibility: keyboard/captions still work.
- Reduced-motion: transitions/loops can be skipped or muted appropriately.
- Puzzle fairness: clues remain in-world and logged verbatim.
- DOM behavior: pointer/key events still hit stable elements.

**Verification:** Before any engine patch, identify which tests cover each checklist item or add the missing test.

---

## Phase 2: Canon and Horror Design Mastery

### Task 3: Convert canon amendments into hard review questions

**Objective:** Make canon enforcement automatic in review behavior.

**Canon review questions:**
- A1: Could any generated asset contain readable text, letters, signage, UI words, timestamps, or clue copy?
- A6: Did any copy/prompt regress to cruiser, trooper, DPS, patrol, police-as-protagonist, or old 23:xx time windows?
- A7: Is this asset derived from a curated plate? For loops/transitions, are first/last frames anchored correctly?
- A8: Is the puzzle gate performed by the player, or did we sneak in a flag-only hotspot?
- A9: If working Side B, is the tape live/NOW and Dana present-tense through radio, without jump-scare logic?
- A10: Did we expose any bare 360/model-viewer feature before real architecture exists?
- Empty world: did prompts or art introduce figures, faces, silhouettes, or person-like forms?
- Car rule: is the car parked and never seen moving?

**Verification:** Every asset/content PR or patch gets reviewed against these questions before build.

### Task 4: Build a dread pacing rubric

**Objective:** Improve artistic judgment, not just code correctness.

**Rubric:**
- Wrongness accumulates by geography/state, not random scares.
- Every new view teaches orientation, tension, or a clue.
- The player can describe where they are relative to nearby nodes.
- Motion is subtle: wind, shimmer, tape drift, radio/static presence.
- Audio has captions and visible fallback.
- No website UI outside the evidence deck fiction.

**Verification:** Playtest notes must mention at least one orientation, affordance, and mood observation for changed content.

---

## Phase 3: Test-First Game Systems Skill

### Task 5: Master pure mechanics tests

**Objective:** Any puzzle/mechanic change starts with deterministic tests.

**Study:**
- `tests/jogWheel.test.ts`
- `tests/fieldTallySolvability.test.ts`
- `tests/engine.test.ts`

**Practice slices:**
- Add one failing test for a locked/unlocked TIMESEEK edge case.
- Add one failing test for a puzzle refusal path.
- Add one failing test for journal dedupe.

**Commands:**
- Narrow: `npm test -- tests/jogWheel.test.ts`
- Full: `npm test`

**Success bar:** Tests prove player affordance and refusal, not just final flags.

### Task 6: Master manifest/content tests

**Objective:** Catch bad graph/content before browser playtest.

**Study:**
- `tests/act2.test.ts`
- `tests/act3.test.ts`
- `tests/act4.test.ts`
- `tests/audioContent.test.ts`
- `tools/shotlistLint.mjs`

**Practice assertions:**
- Every hotspot target exists.
- Every clue has caption/journal text.
- Every clue polygon is bounded and not full-frame.
- Every node has valid still/motion references.
- Every text-bearing prompt includes no-text clause or is rejected.

**Commands:**
- `npm run lint:shotlist`
- `npm test -- tests/act2.test.ts tests/act3.test.ts`

**Success bar:** A bad content edit fails before runtime.

### Task 7: Master jsdom/browser player-flow tests

**Objective:** Test what the player can actually see and do.

**Study:**
- `tests/evidenceDeck.test.ts`
- `tools/playtestSmoke.mjs`

**Practice flows:**
- Load deck.
- Navigate via hotspot.
- Trigger a clue.
- Confirm caption and journal update.
- Use TIMESEEK/jog wheel.
- Confirm the resulting node/time window is visible.

**Commands:**
- `npm test -- tests/evidenceDeck.test.ts`
- `npm run playtest:smoke`

**Success bar:** A feature is not complete until DOM tests or smoke playtest prove it.

---

## Phase 4: Asset Pipeline and Art Direction Skill

### Task 8: Learn the clean-plate pipeline deeply

**Objective:** Never ship generator mistakes as story-critical content.

**Files to study:**
- `content/shotlist.json`
- `content/motionLoops.json`
- `content/transitions.json`
- `tools/generateStills.mjs`
- `tools/generateLoops.mjs`
- `tools/generateTransitions.mjs`
- `tools/falClient.mjs`
- `tools/segmentClues.mjs`
- `tools/generation-ledger.json` if present; do not print secrets.

**Rules:**
- Prompts must be concrete: subject, camera, lens/position, time, palette, composition, forbidden elements.
- No lore shorthand like “Dana Reyes archive aesthetic” in generator prompts.
- No readable text, lettering, signage characters, timestamps, UI words.
- No people/figures/faces/silhouettes.
- Runtime compositor owns all words.
- Candidates are not canon until curated.

**Verification:** `npm run lint:shotlist` and visual/metadata review both pass.

### Task 9: Practice curation over generation volume

**Objective:** Become ruthless at selecting one coherent candidate from several.

**Curation notes should record:**
- Pick/reject.
- Reason.
- Canon risks.
- Continuity with adjacent nodes.
- Whether segmentation is required.
- Whether runtime overlay/text is needed.

**Success bar:** The chosen asset improves spatial continuity and player comprehension, not just beauty.

### Task 10: Upgrade prompt-writing quality

**Objective:** Write prompts generators can obey.

**Prompt template for still views:**
- “Empty 1998 Texas Hill Country roadside shoulder at dusk, viewed from [specific camera position], Dana Reyes’s parked late-1980s station wagon [specific placement], bluebonnet field [specific density/direction], Mirasol FM 1187 geography consistent with adjacent plate, degraded Hi8/VHS still frame look, muted amber and blue-violet palette, clean surfaces for runtime compositing, no readable text, no lettering, no signage characters, no timestamp, no people, no faces, no silhouettes, no moving car.”

**Prompt template for loops:**
- “Animate the supplied still plate as a locked-off seamless ambient loop: only bluebonnets sway subtly, heat shimmer over asphalt, faint tape grain/tracking drift; first frame and last frame match the plate exactly; no camera move, no new objects, no readable text, no people, no car movement.”

**Prompt template for transitions:**
- “Camera move from supplied origin plate to supplied destination plate over 2-4 seconds; preserve geography and parked car position; no new figures/objects/text; first frame exactly origin, last frame exactly destination; slow Myst-like push/turn; analog Hi8/VHS degradation only.”

**Verification:** A human or sidecar can tell exactly what to generate without knowing BLUEBONNET lore.

---

## Phase 5: Production Slice Mastery

### Task 11: Execute one tiny B7 density slice end-to-end

**Objective:** Prove the complete loop on a small, low-risk content expansion.

**Candidate slice:** Add one non-clue facing/detail node in Act I or Act II using existing placeholder/derived assets if no new generation is authorized.

**Steps:**
1. Read the relevant act manifest and neighboring tests.
2. Add a failing manifest test for the new node/edge requirements.
3. Add or wire the new node in `content/act*.json`.
4. Add shotlist/provenance entry if an asset is involved.
5. Add DOM/navigation test if player flow changes.
6. Run narrow tests.
7. Run full gates.
8. Refresh `.bridge/preview/` from `dist/`.
9. Playtest the local/bridge path.
10. Append `.bridge/status.md` entry.

**Commands:**
- `npm run typecheck`
- `npm test`
- `npm run lint:shotlist`
- `npm run build`
- `rm -rf .bridge/preview && cp -R dist .bridge/preview`

**Success bar:** The new view is canon-safe, reachable, tested, and does not break puzzle progression.

### Task 12: Execute one mechanic polish slice end-to-end

**Objective:** Build confidence in engine-level changes.

**Candidate slice:** Improve an accessibility caption/readout or refusal feedback without changing puzzle logic.

**Steps:**
1. Find current component/module by search, not guessing.
2. Read exact file and tests.
3. Add failing jsdom/unit test.
4. Patch minimal code.
5. Verify narrow then full.
6. Playtest changed interaction.

**Success bar:** Better player feedback with zero graph/canon drift.

---

## Phase 6: Multi-Agent Direction Skill

### Task 13: Use sidecars as artifact producers, not random coders

**Objective:** Improve throughput without losing single-writer control.

**Allowed sidecar journeys:**
- Canon audit of Act I prompts/content.
- Shotlist curation artifact.
- Puzzle solvability review.
- Accessibility review.
- Visual density proposal.

**Instructions for sidecars:**
- One domain, one artifact under `.bridge/director/`.
- No edits to shipping files unless explicit writer lock.
- End with exact completion token.
- Follow A1/A6/A7/A9/A10 rules.

**Integrator duty:** Read artifacts, reject canon drift, synthesize into one implementable slice.

**Success bar:** Parallel work produces better decisions without merge chaos.

---

## Phase 7: Debugging and Quality-Gate Mastery

### Task 14: Practice systematic debugging on real failures

**Objective:** Fix root causes instead of symptoms.

**Four-phase debug routine:**
1. Reproduce with exact command.
2. Locate source by reading code and tests.
3. Form one hypothesis.
4. Patch minimally and rerun the exact failing test.

**Common BLUEBONNET failure classes:**
- Manifest target missing after cross-act edge.
- Motion asset referenced in content but absent from `public/` or `dist/`.
- Old save defaults missing new fields.
- DOM overlay visible but blank because content was not passed through.
- Generated prompt violates A1 no-text rules.
- Audio cue lacks caption fallback.

**Success bar:** Every fix includes a regression test or explains why existing coverage catches it.

### Task 15: Master deployment/playtest verification

**Objective:** Treat build output and live site as the artifact, not source files.

**Verification ladder:**
1. `npm run typecheck`
2. `npm test`
3. `npm run lint:shotlist`
4. `npm run build`
5. Refresh `.bridge/preview/` from `dist/`.
6. Check key emitted assets exist under `dist/` and `.bridge/preview/`.
7. Browser or Playwright smoke path.
8. Netlify deploy/live 200 checks only when requested or per autonomous directive with credentials available.

**Success bar:** No “it should work”; only “this command/browser path returned X.”

---

## Weekly Skill Ladder

### Week 1: Engine + Tests
- Read all engine modules and tests.
- Add/adjust one small test-only coverage improvement.
- Run full gates.

### Week 2: Content + Canon
- Audit one act manifest against A1/A6/A8.
- Produce a short gap list.
- Fix one low-risk content/test issue if authorized.

### Week 3: Asset Pipeline
- Trace one still, one loop, and one transition from provenance to `dist/`.
- Write three high-quality candidate prompts for a B7 density view.
- Run shotlist lint.

### Week 4: Player Experience
- Run a smoke playtest from boot through one puzzle chain.
- Log friction: orientation, affordance, captioning, dread pacing.
- Convert one friction point into a scoped backlog item.

### Week 5: Small Production Slice
- Ship one tiny B7 or accessibility polish slice through full gates.
- Refresh preview.
- Append bridge status.

### Week 6: Top-1% Review Loop
- Do a post-landing change audit:
  - diff scan,
  - build gate,
  - save compatibility,
  - content integrity,
  - layout/audio/accessibility risks.
- Produce PASS / CONCERN / BLOCKER summary.

---

## Skill Drills

### 15-minute drill: Symbol tracing
Pick one symbol from a bug or task. Find its definition, usages, tests, and runtime path before editing.

### 30-minute drill: Red-green-refactor
Add one failing test for a tiny behavior, make it pass, then remove any unnecessary implementation.

### 45-minute drill: Canon audit
Audit one prompt/content cluster for A1/A6/A7/A9/A10 violations and write concrete fixes.

### 60-minute drill: Player-flow proof
Use jsdom or browser automation to prove one interaction updates visible caption/journal/state.

### 90-minute drill: Production slice
Take a tiny backlog item through read → test → patch → full gates → preview refresh → bridge status.

---

## Quality Metrics to Track

Track these informally after each work block:

- Time from task start to first relevant file read.
- Number of guesses later corrected by repo inspection; target: near zero.
- Test-first ratio for code changes; target: high.
- Full-gate pass rate on first attempt; target: rising over time.
- Canon violations caught before build; target: all.
- Player-visible verification performed; target: every feature/content slice.
- Lines/files touched per outcome; target: small and scoped.
- Regression count after change; target: zero.

---

## Anti-Patterns to Eliminate

- Editing before reading neighboring code/tests.
- Trusting memory over `GAME_DIRECTION.md` or actual files.
- Treating manifest flags as a puzzle instead of player performance.
- Shipping generated text or generator-invented signage.
- Adding figures/silhouettes for mood.
- Making a pretty image that breaks spatial continuity.
- Testing only store state when DOM/player behavior matters.
- Refreshing preview without a green build.
- Reporting success without command/browser evidence.
- Letting sidecars write production files without a lock.

---

## Immediate Next Best Step

The highest-leverage next action is not a giant refactor. It is a small, verified practice slice:

1. Read `content/act1.json`, `content/shotlist.json`, and the relevant Act I tests.
2. Identify one B7-compatible Act I density gap that does not alter puzzle logic.
3. Write a failing manifest/navigation test for the new viewpoint expectation.
4. Add the smallest content/asset-provenance change to satisfy it.
5. Run `npm run typecheck`, `npm test`, `npm run lint:shotlist`, `npm run build`.
6. Refresh `.bridge/preview/` from `dist/`.
7. Playtest the route.
8. Append `.bridge/status.md`.

That single loop, repeated with increasing scope, is how this Codespace gets from competent to top 1%.

---

## Definition of Done for This Plan

This plan has worked when the agent can independently ship three consecutive BLUEBONNET slices that meet all of these:

- Canon-safe on first review.
- Tests added or consciously justified.
- Full gates green.
- Preview refreshed.
- Player-flow verified.
- Bridge status updated.
- No secret exposure.
- No broad unrelated diffs.
- No stale police/DPS framing or baked text.
- Clear PASS / CONCERN / BLOCKER summary after completion.

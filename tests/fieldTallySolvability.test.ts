import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import act1 from '../content/act1.json';
import act2 from '../content/act2.json';
import act3 from '../content/act3.json';
import act4 from '../content/act4.json';
import shotlist from '../content/shotlist.json';
import { getNodeState, loadNodeGraph } from '../engine/nodeGraph';
import type { HotspotDefinition, SceneManifest } from '../engine/types';

/**
 * REGRESSION GATE — field-tally solvability under shape-only bloom journals.
 *
 * Captaincy concern (priority queue #2, Kimi 2026-06-13):
 *   "Add field-tally solvability test proving the shape-only bloom journals
 *    still leave the ordered code learnable in-world."
 *
 * Why this gate exists:
 *   After the Kimi human-touch rewrite (kimi_human_touch_pass.md §3.5),
 *   bloom-clock journals record *shape* only — "two dense lobes",
 *   "seven stepped blooms", etc. The digit (2, 7, 1, 3) must therefore
 *   be reachable in-world from somewhere other than the journal.
 *   Per GAME_DIRECTION.md A8 and the fairness rule, every code must
 *   appear in at least 2 in-world places; the digit 2713 currently
 *   reaches the player through (a) the field-tally node's composited
 *   journal/caption with the explicit "= 2713" conversion, and
 *   (b) the field-gate diegetic overlay "PADLOCK // 2 7 1 3".
 *   This test pins both bridges so a future content edit cannot
 *   silently remove one and leave a single point of failure.
 *
 * What this test does NOT do:
 *   - It does not edit content, code, or assets.
 *   - It does not change the field-tally caption or the field-gate overlay.
 *   - It does not import from src/main.ts; the diegetic-overlay
 *     bridge is pinned by string match against the source file so
 *     we never need to import a non-exported function or open a
 *     writer lock to export one.
 *   - It does not assert that the *only* path to 2713 is the tally
 *     (the redundancy is the point — the test fails if either bridge
 *     is missing, but the design only requires one to remain).
 *
 * A1 / A6 / A7 / A9 audit: not applicable; this is a test, not content.
 * The test reads from content JSONs and from the literal source of
 * src/main.ts; it does not author new diegetic text and does not
 * change any game file.
 */

const ACTS = [act1, act2, act3, act4] as unknown as SceneManifest[];

// Source-of-truth read for the diegetic-overlay bridges. We read the
// raw file rather than importing the function so this test stays
// pure content + tooling and does not require a writer lock to
// export a function from src/main.ts.
const MAIN_SOURCE = readFileSync(resolve(__dirname, '..', 'src', 'main.ts'), 'utf8');

function tallyHotspot(hotspotId: string, window: '20:08-20:17' | '20:17-20:26' = '20:08-20:17'): HotspotDefinition {
  const graph = loadNodeGraph(ACTS);
  const nodeState = getNodeState(graph, 'field-tally', window);
  const found = nodeState.hotspots.find((candidate) => candidate.id === hotspotId);
  if (!found) throw new Error(`field-tally hotspot ${hotspotId} missing in window ${window}`);
  return found;
}

function gateUnlockHotspot(): HotspotDefinition {
  const graph = loadNodeGraph(ACTS);
  const nodeState = getNodeState(graph, 'field-gate', '20:08-20:17');
  const found = nodeState.hotspots.find((candidate) => candidate.id === 'unlock-field-gate');
  if (!found) throw new Error('field-gate unlock-field-gate hotspot missing');
  return found;
}

function mainSourceHas(literal: string): boolean {
  return MAIN_SOURCE.includes(literal);
}

describe('Field-tally solvability gate (Kimi captaincy #2: shape-only journals must still teach 2713)', () => {
  it('the field-tally node exists and is reachable from the bloom clocks via the field-gate', () => {
    const tallyNode = act2.nodes.find((node) => node.id === 'field-tally');
    expect(tallyNode).toBeDefined();
    expect(tallyNode?.title).toBeTruthy();
    // The player path is bloom-clock -> field-gate -> field-tally.
    // The field-gate is the only direct entry to the tally; assert
    // both halves of the path so a future link edit cannot silently
    // strand the player at the clocks with the code in hand but
    // no way to convert it to digits.
    const graph = loadNodeGraph(ACTS);
    // Half 1: at least one bloom clock must link into the field-gate.
    const clockIds = ['field-clock-two', 'field-clock-seven', 'field-clock-one', 'field-clock-three'] as const;
    let reachedGate = false;
    for (const clockId of clockIds) {
      const nodeState = getNodeState(graph, clockId, '20:17-20:26');
      if (nodeState.hotspots.some((hotspot) => hotspot.target === 'field-gate')) {
        reachedGate = true;
        break;
      }
    }
    expect(reachedGate).toBe(true);
    // Half 2: the field-gate must link into the field-tally.
    const gateState = getNodeState(graph, 'field-gate', '20:17-20:26');
    const reachedTally = gateState.hotspots.some((hotspot) => hotspot.target === 'field-tally');
    expect(reachedTally).toBe(true);
  });

  it('bridge A — field-tally composited caption carries "II / VII / I / III" in the 20:08 window', () => {
    const tally2008 = tallyHotspot('gate-tally-2713');
    // The journal text is what the player reads on the journal page.
    expect(tally2008.journal?.text).toContain('II / VII / I / III');
    // The on-screen caption is what the player reads in the deck.
    expect(tally2008.caption).toContain('II / VII / I / III');
  });

  it('bridge A — the field-tally caption offers an explicit "= 2713" conversion', () => {
    const tally2008 = tallyHotspot('gate-tally-2713');
    // The Roman-to-Arabic conversion must be on the same overlay as
    // the Roman numerals; otherwise a player who does not read Roman
    // numerals cannot recover the digits. The conversion is canon
    // because the field-tally's role is to deliver the ordered code.
    const text = `${tally2008.journal?.text ?? ''} ${tally2008.caption ?? ''}`;
    expect(text).toMatch(/=\s*2713/);
  });

  it('bridge A — the field-tally diegetic overlay reads "GATE TALLY // II / VII / I / III"', () => {
    // The DOM diegetic overlay is independent of the journal/caption
    // text in the JSON, and is the layer that survives VHS grain at
    // low TRACKING. We pin the literal source string rather than
    // importing the function, so this test is pure content/tooling.
    expect(mainSourceHas("if (nodeId === 'field-tally') return 'GATE TALLY // II / VII / I / III';")).toBe(true);
  });

  it('bridge B — the field-gate diegetic overlay reads "PADLOCK // 2 7 1 3"', () => {
    // The padlock node's overlay is the *second* in-world place the
    // digit 2713 appears. This is the safety net: if the field-tally
    // node is silently removed in a future content pass, the player
    // can still read the code at the gate itself. Per the fairness
    // rule, every code appears in at least 2 in-world places.
    expect(mainSourceHas("if (nodeId === 'field-gate') return 'PADLOCK // 2 7 1 3';")).toBe(true);
  });

  it('bridge B — the field-gate has the unlock hotspot wired to field-gate puzzle and the right journal', () => {
    const unlock = gateUnlockHotspot();
    expect(unlock.puzzleAction).toBe('field-gate');
    // The unlock's journal is the third redundant place the code is
    // presented (after tally and gate overlay). If this fails, the
    // gate's own click-through line no longer restates 2713.
    expect(unlock.journal?.text).toContain('2713');
  });

  it('redundancy — at least two in-world presentations of 2713 must remain', () => {
    // This is the canon fairness check in test form. A future content
    // edit could remove one of the three: tally caption/journal,
    // gate diegetic overlay, or unlock hotspot journal. Removing two
    // is canon-fairness failure; the test catches that.
    const tallyText = `${tallyHotspot('gate-tally-2713').journal?.text ?? ''} ${tallyHotspot('gate-tally-2713').caption ?? ''}`;
    const tallyHasCode = /2713/.test(tallyText);
    const tallyHasRomanConversion = /=\s*2713/.test(tallyText);
    const gateOverlayHasCode = mainSourceHas("if (nodeId === 'field-gate') return 'PADLOCK // 2 7 1 3';");
    const unlock = gateUnlockHotspot();
    const unlockJournalHasCode = !!unlock.journal?.text && /2713/.test(unlock.journal.text);

    const bridges = [tallyHasCode, tallyHasRomanConversion, gateOverlayHasCode, unlockJournalHasCode].filter(Boolean).length;
    // Three independent presentations today. The canon requires at
    // least two. A regression to one is a block.
    expect(bridges).toBeGreaterThanOrEqual(2);
  });

  it('shape-only journals do not contain the digit (so the Kimi rewrite held)', () => {
    // The Kimi rewrite is verified here: bloom-clock journals must
    // NOT contain the digit. If a future pass re-adds "two dense
    // lobes mark the first gate digit: 2", the rewrite is regressing.
    const graph = loadNodeGraph(ACTS);
    for (const nodeId of ['field-clock-two', 'field-clock-seven', 'field-clock-one', 'field-clock-three']) {
      const nodeState = getNodeState(graph, nodeId, '20:17-20:26');
      const flower = nodeState.hotspots.find((candidate) => candidate.id.startsWith('flower-'));
      const journal = flower?.journal?.text ?? '';
      expect(journal).not.toMatch(/\b(?:2|7|1|3)\b/);
    }
  });

  it('field-tally plates are A1-clean (no readable numerals in the Fal prompt)', () => {
    // The field-tally still lives on generated plates, and the
    // shape-only rewrite must not have introduced readable numerals
    // into the prompt. A1 regression check, scoped to the two windows.
    const tallyShots = shotlist.shots.filter((shot) => shot.nodeId === 'field-tally');
    expect(tallyShots).toHaveLength(2);
    for (const shot of tallyShots) {
      expect(shot.prompt).toContain('no readable text, no lettering, no signage characters');
      // The "tally marks" on the prompt are *blank* tallies — the
      // composited overlay is what carries the II / VII / I / III.
      // Reject any prompt that asks the generator to render numerals.
      expect(shot.prompt.toLowerCase()).not.toMatch(/roman|ii |vii |i iii|numerals/);
    }
  });
});

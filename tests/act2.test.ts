import { describe, expect, it } from 'vitest';
import act1 from '../content/act1.json';
import act2 from '../content/act2.json';
import act3 from '../content/act3.json';
import act4 from '../content/act4.json';
import shotlist from '../content/shotlist.json';
import { availableHotspots, getNodeState, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { createStateMachine } from '../engine/stateMachine';
import type { HotspotDefinition, SceneManifest } from '../engine/types';

function activate(hotspot: HotspotDefinition, state = createStateMachine({ currentNodeId: 'field-threshold', activeWindow: '20:17-20:26', completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log'] })) {
  if (hotspot.puzzleAction) {
    const puzzle = createPuzzleProgression(state.snapshot().completedPuzzles);
    const result = puzzle.apply(hotspot.puzzleAction);
    expect(result.ok).toBe(true);
    state.completePuzzle(hotspot.puzzleAction);
    state.setFlag(`puzzle:${hotspot.puzzleAction}`);
  }
  state.applyHotspot(hotspot);
  const target = resolveHotspotTarget(hotspot, state.snapshot());
  if (target) state.setCurrentNode(target);
  return state;
}

describe('Act II field content', () => {
  it('keeps Act II shot prompts as clean plates with the A1 no-text clause', () => {
    const act2Shots = shotlist.shots.filter((shot) => shot.act === 'act2');
    expect(act2Shots.length).toBeGreaterThanOrEqual(20);
    for (const shot of act2Shots) {
      expect(shot.prompt).toContain('no readable text, no lettering, no signage characters');
    }
  });

  it('keeps the field-threshold in the still-frame node graph until the 360 world is ready', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const nodeState = getNodeState(graph, 'field-threshold', '20:08-20:17');
    expect(nodeState.still).toBe('stills/act2/field-threshold__2008-2017.jpg');
    expect(nodeState.hotspots.map((hotspot) => hotspot.id)).toContain('to-field-left-row');
  });

  it('the padlock is a knowledge-gated mechanism; the clocks remain its evidence', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const state = createStateMachine({ currentNodeId: 'field-gate', activeWindow: '20:17-20:26', completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log'] });
    const gateState = getNodeState(graph, 'field-gate', '20:17-20:26');
    const unlock = availableHotspots(gateState, state.snapshot()).find((hotspot) => hotspot.id === 'unlock-field-gate');
    // Visible and operable with zero clocks logged: the code is the key.
    expect(unlock).toBeDefined();
    expect(unlock!.mechanism).toBe('padlock');
    expect(createPuzzleProgression(state.snapshot().completedPuzzles).canApply('field-gate')).toBe(true);

    // The bloom clocks teach observations; the tally remains the ordered-code payoff.
    for (const [nodeId, hotspotId, digit] of [
      ['field-clock-two', 'flower-two', 'two dense lobes'],
      ['field-clock-seven', 'flower-seven', 'seven stepped blooms'],
      ['field-clock-one', 'flower-one', 'one tall bloom column'],
      ['field-clock-three', 'flower-three', 'three crescent clusters'],
    ] as const) {
      const nodeState = getNodeState(graph, nodeId, '20:17-20:26');
      const hotspot = nodeState.hotspots.find((candidate) => candidate.id === hotspotId);
      expect(hotspot).toBeDefined();
      activate(hotspot!, state);
      expect(state.snapshot().journal.map((entry) => entry.text).join('\n')).toContain(digit);
    }
    expect(state.snapshot().journal.map((entry) => entry.text).join('\n')).not.toContain('gate digit');

    activate(unlock!, state);
    expect(state.snapshot().flags['culvert-access']).toBe(true);
    expect(state.snapshot().currentNodeId).toBe('act2-culvert-stub');
  });
});

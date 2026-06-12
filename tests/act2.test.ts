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
    expect(act2Shots).toHaveLength(20);
    for (const shot of act2Shots) {
      expect(shot.prompt).toContain('no readable text, no lettering, no signage characters');
    }
  });

  it('gates culvert access behind all four flower-clock digits', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const state = createStateMachine({ currentNodeId: 'field-gate', activeWindow: '20:17-20:26', completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log'] });
    let gateState = getNodeState(graph, 'field-gate', '20:17-20:26');
    expect(availableHotspots(gateState, state.snapshot()).some((hotspot) => hotspot.id === 'unlock-field-gate')).toBe(false);

    for (const [nodeId, hotspotId] of [
      ['field-clock-two', 'flower-two'],
      ['field-clock-seven', 'flower-seven'],
      ['field-clock-one', 'flower-one'],
      ['field-clock-three', 'flower-three'],
    ] as const) {
      const nodeState = getNodeState(graph, nodeId, '20:17-20:26');
      const hotspot = nodeState.hotspots.find((candidate) => candidate.id === hotspotId);
      expect(hotspot).toBeDefined();
      activate(hotspot!, state);
    }

    gateState = getNodeState(graph, 'field-gate', '20:17-20:26');
    const unlock = availableHotspots(gateState, state.snapshot()).find((hotspot) => hotspot.id === 'unlock-field-gate');
    expect(unlock).toBeDefined();
    activate(unlock!, state);
    expect(state.snapshot().flags['culvert-access']).toBe(true);
    expect(state.snapshot().currentNodeId).toBe('act2-culvert-stub');
    expect(state.snapshot().journal.map((entry) => entry.text).join('\n')).toContain('2713 opens the path toward the culvert');
  });
});

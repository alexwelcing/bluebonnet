import { describe, expect, it } from 'vitest';
import act1 from '../content/act1.json';
import act2 from '../content/act2.json';
import act3 from '../content/act3.json';
import act4 from '../content/act4.json';
import shotlist from '../content/shotlist.json';
import { availableHotspots, getNodeState, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { createStateMachine } from '../engine/stateMachine';
import type { HotspotDefinition, PuzzleAction, SceneManifest } from '../engine/types';

function complete(action: PuzzleAction, state: ReturnType<typeof createStateMachine>) {
  const puzzle = createPuzzleProgression(state.snapshot().completedPuzzles);
  const result = puzzle.apply(action);
  expect(result.ok).toBe(true);
  state.completePuzzle(action);
  state.setFlag(`puzzle:${action}`);
}

function activate(hotspot: HotspotDefinition, state: ReturnType<typeof createStateMachine>) {
  if (hotspot.puzzleAction) complete(hotspot.puzzleAction, state);
  state.applyHotspot(hotspot);
  const target = resolveHotspotTarget(hotspot, state.snapshot());
  if (target) state.setCurrentNode(target);
}

describe('Act III culvert content', () => {
  it('keeps the whole shotlist under A1 clean-plate lint coverage', () => {
    expect(shotlist.shots).toHaveLength(54);
    for (const shot of shotlist.shots) {
      expect(shot.prompt, shot.filename).toContain('no readable text, no lettering, no signage characters');
    }
  });

  it('solves echo knocks with captioned waveform fallback and grants recorder timecode while Act IV stays gated', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const state = createStateMachine({
      currentNodeId: 'culvert-pipe',
      activeWindow: '23:17-23:26',
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate'],
      flags: { 'puzzle:dispatch-log': true, 'puzzle:field-gate': true, 'culvert-access': true },
    });

    const pipe = getNodeState(graph, 'culvert-pipe', '23:17-23:26');
    const pattern = pipe.hotspots.find((hotspot) => hotspot.id === 'radio-static-pattern')!;
    activate(pattern, state);
    expect(state.snapshot().journal.at(-1)?.text).toContain('Visual fallback: || _ | _ |||');

    const knock = availableHotspots(pipe, state.snapshot()).find((hotspot) => hotspot.id === 'repeat-echo-knocks')!;
    activate(knock, state);
    expect(state.snapshot().flags['echo-solved']).toBe(true);

    const recorder = getNodeState(graph, 'recorder-nest', '23:17-23:26').hotspots.find((hotspot) => hotspot.id === 'read-recorder-counter')!;
    activate(recorder, state);
    expect(state.snapshot().discoveredTimecodes).toContain('23:26-23:35');
    expect(state.snapshot().journal.at(-1)?.text).toContain('HANDHELD RECORDER COUNTER: 23:26');

    const gate = getNodeState(graph, 'missing-minutes-gate', '23:17-23:26');
    expect(availableHotspots(gate, state.snapshot()).some((hotspot) => hotspot.id === 'test-act4-lock')).toBe(false);
    expect(availableHotspots(gate, state.snapshot()).some((hotspot) => hotspot.id === 'enter-nine-minutes')).toBe(true);
  });
});

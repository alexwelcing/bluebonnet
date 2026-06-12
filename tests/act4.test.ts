import { describe, expect, it } from 'vitest';
import act1 from '../content/act1.json';
import act2 from '../content/act2.json';
import act3 from '../content/act3.json';
import act4 from '../content/act4.json';
import shotlist from '../content/shotlist.json';
import { createJogWheelState, defaultJogWheelOptions, seatNearestDetent, stepJogWheel } from '../engine/jogWheel';
import { availableHotspots, getNodeState, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { createStateMachine } from '../engine/stateMachine';
import { createTimeSeek } from '../engine/timeseek';
import type { HotspotDefinition, PuzzleAction, SceneManifest, TimeWindow } from '../engine/types';

const solvedThroughAct3: PuzzleAction[] = [
  'flyer-frequency',
  'radio-tune',
  'dispatch-log',
  'flower-digit-2',
  'flower-digit-7',
  'flower-digit-1',
  'flower-digit-3',
  'field-gate',
  'echo-knocks',
  'recorder-counter',
];

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

describe('Act IV nine minutes content', () => {
  it('keeps Act IV clean plates in whole-shotlist A1 lint coverage', () => {
    const act4Shots = shotlist.shots.filter((shot) => shot.act === 'act4');
    expect(act4Shots).toHaveLength(12);
    for (const shot of act4Shots) {
      expect(shot.window).toBe('23:26-23:35');
      expect(shot.prompt, shot.filename).toContain('no readable text, no lettering, no signage characters');
      expect(shot.status).toBe('generated-clean');
    }
  });

  it('unlocks the formerly locked nine-minutes detent after recorder counter and field gate are complete', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const locked = createTimeSeek(graph, '23:17-23:26', ['23:17-23:26']);
    expect(locked.seek('23:26-23:35').ok).toBe(false);

    const unlocked = createTimeSeek(graph, '23:17-23:26', ['23:17-23:26', '23:26-23:35']);
    expect(unlocked.seek('23:26-23:35')).toMatchObject({ ok: true, activeWindow: '23:26-23:35' });

    const options = { ...defaultJogWheelOptions, discovered: ['23:08-23:17', '23:17-23:26', '23:26-23:35'] as TimeWindow[], locked: [] as TimeWindow[] };
    const nearFinal = { ...createJogWheelState('23:17-23:26', options), position: 1.99, angle: 1.99 * Math.PI * 1.5, velocity: 0.2, seatedWindow: undefined };
    expect(stepJogWheel(nearFinal, 0.1, options).event).not.toBe('hard-stop');
    expect(seatNearestDetent(nearFinal, options).state.seatedWindow).toBe('23:26-23:35');
  });

  it('gates Act IV behind field gate and recorder counter, then routes through six nine-minute nodes to the ending threshold', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const state = createStateMachine({
      currentNodeId: 'missing-minutes-gate',
      activeWindow: '23:17-23:26',
      completedPuzzles: solvedThroughAct3,
      discoveredTimecodes: ['23:08-23:17', '23:17-23:26', '23:26-23:35'],
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'culvert-access': true, 'recorder-counter': true, 'act4-gate': true },
    });

    const gate = getNodeState(graph, 'missing-minutes-gate', '23:17-23:26');
    const enter = availableHotspots(gate, state.snapshot()).find((hotspot) => hotspot.id === 'enter-nine-minutes');
    expect(enter).toBeDefined();
    activate(enter!, state);
    expect(state.snapshot().currentNodeId).toBe('nine-field-threshold');

    state.setActiveWindow('23:26-23:35');
    const route = [
      ['nine-field-threshold', 'to-nine-flower-path', 'nine-flower-path'],
      ['nine-flower-path', 'to-near-car', 'near-car'],
      ['near-car', 'to-luminous-shrine', 'luminous-shrine'],
      ['luminous-shrine', 'to-car-door', 'car-door'],
      ['car-door', 'to-final-choice', 'final-choice'],
    ] as const;

    for (const [nodeId, hotspotId, target] of route) {
      const node = getNodeState(graph, nodeId, '23:26-23:35');
      expect(node.caption).toContain('23:26-23:35');
      const hotspot = availableHotspots(node, state.snapshot()).find((candidate) => candidate.id === hotspotId);
      expect(hotspot, `${nodeId}/${hotspotId}`).toBeDefined();
      activate(hotspot!, state);
      expect(state.snapshot().currentNodeId).toBe(target);
    }

    const final = getNodeState(graph, 'final-choice', '23:26-23:35');
    const eject = final.hotspots.find((hotspot) => hotspot.id === 'choose-eject')!;
    const record = final.hotspots.find((hotspot) => hotspot.id === 'choose-record')!;
    expect(eject.target).toBe('ending-eject');
    expect(record.target).toBe('ending-record');
    activate(eject, state);
    expect(state.snapshot().currentNodeId).toBe('ending-eject');
    expect(state.snapshot().flags['ending:eject']).toBe(true);
    expect(getNodeState(graph, 'ending-eject', '23:26-23:35').caption).toContain('EJECT');
    expect(getNodeState(graph, 'ending-record', '23:26-23:35').caption).toContain('RECORD');
  });

  it('expands the Act IV threshold into lateral, look-down, and detail viewpoints', () => {
    const graph = loadNodeGraph([act1, act2, act3, act4] as unknown as SceneManifest[]);
    const threshold = getNodeState(graph, 'nine-field-threshold', '23:26-23:35');
    for (const target of ['nine-threshold-left', 'nine-threshold-right', 'nine-threshold-look-down', 'nine-culvert-detail']) {
      expect(threshold.hotspots.some((hotspot) => hotspot.target === target), `threshold -> ${target}`).toBe(true);
      const node = getNodeState(graph, target, '23:26-23:35');
      expect(node.caption).toContain('23:26-23:35');
      expect(node.hotspots.some((hotspot) => hotspot.target === 'nine-field-threshold'), `${target} -> threshold`).toBe(true);
    }
  });

});

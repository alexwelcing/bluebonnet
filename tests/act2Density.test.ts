import { describe, expect, it } from 'vitest';
import act2 from '../content/act2.json';
import motionLoops from '../content/motionLoops.json';
import shotlist from '../content/shotlist.json';
import type { HotspotDefinition, SceneManifest } from '../engine/types';

const manifest = act2 as unknown as SceneManifest;
const shots = shotlist.shots as Array<{
  act?: string;
  nodeId?: string;
  window?: string;
  prompt?: string;
  status?: string;
  candidateUrls?: Record<string, string>;
  curation?: { picked?: string; rejected?: string[]; reason?: string };
}>;
const loops = motionLoops.loops as Array<{
  id?: string;
  act?: string;
  window?: string;
  runtime?: string | null;
  status?: string;
  curation?: string;
}>;

const trancheNodes = [
  'field-threshold-look-up',
  'field-threshold-look-down',
  'field-wide-from-row',
  'field-row-left-facing',
  'bloom-clock-detail',
  'field-tally-look-up',
] as const;

const windows = ['20:08-20:17', '20:17-20:26'] as const;
const requiredNoText = 'no readable text, no lettering, no signage characters';

function node(nodeId: string) {
  const found = manifest.nodes.find((candidate) => candidate.id === nodeId);
  if (!found) throw new Error(`Missing node ${nodeId}`);
  return found;
}

function stateHotspots(nodeId: string, window: (typeof windows)[number]): HotspotDefinition[] {
  return node(nodeId).temporalStates?.[window]?.hotspots ?? [];
}

function allHotspotsFor(nodeId: string): HotspotDefinition[] {
  return windows.flatMap((window) => stateHotspots(nodeId, window));
}

describe('Act II B7 viewpoint-density tranche 1', () => {
  it('adds six atmosphere-only density views with both Act II tape windows', () => {
    for (const nodeId of trancheNodes) {
      const found = node(nodeId);
      expect(found.title, nodeId).toBeTruthy();
      for (const window of windows) {
        const state = found.temporalStates?.[window];
        expect(state, `${nodeId}/${window}`).toBeTruthy();
        expect(state?.still, `${nodeId}/${window} still`).toBe(`stills/act2/${nodeId}__${window === '20:08-20:17' ? '2008-2017' : '2017-2026'}.jpg`);
        expect(state?.motionLayers?.[0]?.src, `${nodeId}/${window} motion`).toBe(`video/act2/${nodeId}__${window === '20:08-20:17' ? '2008-2017' : '2017-2026'}.mp4`);
      }
    }
  });

  it('wires the new views into existing Act II navigation without stranding the puzzle route', () => {
    for (const window of windows) {
      expect(stateHotspots('field-threshold', window).some((hotspot) => hotspot.target === 'field-threshold-look-up')).toBe(true);
      expect(stateHotspots('field-threshold', window).some((hotspot) => hotspot.target === 'field-threshold-look-down')).toBe(true);
      expect(stateHotspots('field-left-row', window).some((hotspot) => hotspot.target === 'field-wide-from-row')).toBe(true);
      expect(stateHotspots('field-left-row', window).some((hotspot) => hotspot.target === 'field-row-left-facing')).toBe(true);
      expect(stateHotspots('field-clock-two', window).some((hotspot) => hotspot.target === 'bloom-clock-detail')).toBe(true);
      expect(stateHotspots('field-tally', window).some((hotspot) => hotspot.target === 'field-tally-look-up')).toBe(true);

      for (const nodeId of trancheNodes) {
        expect(stateHotspots(nodeId, window).some((hotspot) => hotspot.target && !trancheNodes.includes(hotspot.target as (typeof trancheNodes)[number])), `${nodeId}/${window} return edge`).toBe(true);
      }
    }
  });

  it('keeps the new density views atmospheric: no new puzzle actions, flags, or journal entries', () => {
    for (const nodeId of trancheNodes) {
      for (const hotspot of allHotspotsFor(nodeId)) {
        expect(hotspot.puzzleAction, `${nodeId}.${hotspot.id} puzzleAction`).toBeUndefined();
        expect(hotspot.setFlag, `${nodeId}.${hotspot.id} setFlag`).toBeUndefined();
        expect(hotspot.journal, `${nodeId}.${hotspot.id} journal`).toBeUndefined();
      }
    }
  });

  it('preserves the existing Act II puzzle-action vocabulary', () => {
    const puzzleActions = new Set<string>();
    for (const existing of manifest.nodes) {
      for (const window of windows) {
        for (const hotspot of existing.temporalStates?.[window]?.hotspots ?? []) {
          if (hotspot.puzzleAction) puzzleActions.add(hotspot.puzzleAction);
        }
      }
    }
    expect([...puzzleActions].sort()).toEqual([
      'field-gate',
      'flower-digit-1',
      'flower-digit-2',
      'flower-digit-3',
      'flower-digit-7',
    ]);
  });

  it('records curated multi-reference A7 clean-plate provenance for every new Act II shot', () => {
    for (const nodeId of trancheNodes) {
      for (const window of windows) {
        const shot = shots.find((candidate) => candidate.act === 'act2' && candidate.nodeId === nodeId && candidate.window === window);
        expect(shot, `${nodeId}/${window}`).toBeTruthy();
        expect(shot?.status, `${nodeId}/${window}`).toBe('generated-clean');
        expect(shot?.prompt, `${nodeId}/${window}`).toContain('multi-reference plate-anchored edit');
        expect(shot?.prompt, `${nodeId}/${window}`).toContain(requiredNoText);
        expect(shot?.prompt, `${nodeId}/${window}`).not.toMatch(/trooper|DPS|cruiser|patrol/i);
        expect(shot?.prompt, `${nodeId}/${window}`).not.toMatch(/roman|numeral|II|VII|2713/);
        expect(Object.keys(shot?.candidateUrls ?? {}).sort(), `${nodeId}/${window}`).toEqual(['c0', 'c1', 'c2', 'c3']);
        expect(shot?.curation?.picked, `${nodeId}/${window}`).toMatch(/^c[0-3]$/);
        expect(shot?.curation?.rejected, `${nodeId}/${window}`).toHaveLength(3);
        expect(shot?.curation?.reason, `${nodeId}/${window}`).toBeTruthy();
      }
    }
  });

  it('records seamless motion loops for every new Act II density view and tape window', () => {
    for (const nodeId of trancheNodes) {
      for (const window of windows) {
        const suffix = window === '20:08-20:17' ? '2008-2017' : '2017-2026';
        const loop = loops.find((candidate) => candidate.id === `${nodeId}__${suffix}`);
        expect(loop, `${nodeId}/${window}`).toBeTruthy();
        expect(loop?.act, `${nodeId}/${window}`).toBe('act2');
        expect(loop?.window, `${nodeId}/${window}`).toBe(window);
        expect(loop?.runtime, `${nodeId}/${window}`).toBe(`video/act2/${nodeId}__${suffix}.mp4`);
        expect(loop?.status, `${nodeId}/${window}`).toBe('generated-clean-motion');
        expect(loop?.curation, `${nodeId}/${window}`).toContain('seamless');
      }
    }
  });
});

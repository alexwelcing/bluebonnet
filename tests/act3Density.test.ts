import { describe, expect, it } from 'vitest';
import act3 from '../content/act3.json';
import motionLoops from '../content/motionLoops.json';
import shotlist from '../content/shotlist.json';
import type { HotspotDefinition, SceneManifest } from '../engine/types';

const manifest = act3 as unknown as SceneManifest;
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
  'culvert-throat-wall-closeup',
  'culvert-dripline-closeup',
  'culvert-pipe-rust-closeup',
  'recorder-counter-closeup',
] as const;

const windows = ['20:17-20:26', '20:26-20:35'] as const;
const suffixFor = (window: (typeof windows)[number]) => (window === '20:17-20:26' ? '2017-2026' : '2026-2035');
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

describe('Act III B7 viewpoint-density tranche 1', () => {
  it('adds four atmospheric culvert/recorder density views across the Act III windows', () => {
    for (const nodeId of trancheNodes) {
      const found = node(nodeId);
      expect(found.title, nodeId).toBeTruthy();
      for (const window of windows) {
        const suffix = suffixFor(window);
        const state = found.temporalStates?.[window];
        expect(state, `${nodeId}/${window}`).toBeTruthy();
        expect(state?.still, `${nodeId}/${window} still`).toBe(`stills/act3/${nodeId}__${suffix}.jpg`);
        expect(state?.motionLayers?.[0]?.src, `${nodeId}/${window} motion`).toBe(`video/act3/${nodeId}__${suffix}.mp4`);
      }
    }
  });

  it('wires the density views into existing Act III navigation without bypassing puzzle gates', () => {
    for (const window of windows) {
      expect(stateHotspots('culvert-throat', window).some((hotspot) => hotspot.target === 'culvert-throat-wall-closeup')).toBe(true);
      expect(stateHotspots('culvert-dripline', window).some((hotspot) => hotspot.target === 'culvert-dripline-closeup')).toBe(true);
      expect(stateHotspots('culvert-pipe', window).some((hotspot) => hotspot.target === 'culvert-pipe-rust-closeup')).toBe(true);
      expect(stateHotspots('recorder-nest', window).some((hotspot) => hotspot.target === 'recorder-counter-closeup')).toBe(true);

      for (const nodeId of trancheNodes) {
        expect(
          stateHotspots(nodeId, window).some((hotspot) => hotspot.target && !trancheNodes.includes(hotspot.target as (typeof trancheNodes)[number])),
          `${nodeId}/${window} return edge`,
        ).toBe(true);
      }
    }
  });

  it('keeps the new Act III density views atmospheric: no new puzzle actions, flags, journals, or timecode grants', () => {
    for (const nodeId of trancheNodes) {
      for (const hotspot of allHotspotsFor(nodeId)) {
        expect(hotspot.puzzleAction, `${nodeId}.${hotspot.id} puzzleAction`).toBeUndefined();
        expect(hotspot.setFlag, `${nodeId}.${hotspot.id} setFlag`).toBeUndefined();
        expect(hotspot.journal, `${nodeId}.${hotspot.id} journal`).toBeUndefined();
        expect(hotspot.discoverTimecode, `${nodeId}.${hotspot.id} discoverTimecode`).toBeUndefined();
      }
    }
  });

  it('preserves the existing Act III puzzle-action vocabulary', () => {
    const puzzleActions = new Set<string>();
    for (const existing of manifest.nodes) {
      for (const window of windows) {
        for (const hotspot of existing.temporalStates?.[window]?.hotspots ?? []) {
          if (hotspot.puzzleAction) puzzleActions.add(hotspot.puzzleAction);
        }
      }
    }
    expect([...puzzleActions].sort()).toEqual(['echo-knocks', 'recorder-counter']);
  });

  it('records curated multi-reference A7 clean-plate provenance for every new Act III shot', () => {
    for (const nodeId of trancheNodes) {
      for (const window of windows) {
        const shot = shots.find((candidate) => candidate.act === 'act3' && candidate.nodeId === nodeId && candidate.window === window);
        expect(shot, `${nodeId}/${window}`).toBeTruthy();
        expect(shot?.status, `${nodeId}/${window}`).toBe('generated-clean');
        expect(shot?.prompt, `${nodeId}/${window}`).toContain('multi-reference plate-anchored edit');
        expect(shot?.prompt, `${nodeId}/${window}`).toContain(requiredNoText);
        expect(shot?.prompt, `${nodeId}/${window}`).not.toMatch(/trooper|DPS|cruiser|patrol/i);
        expect(shot?.prompt, `${nodeId}/${window}`).not.toMatch(/2713|20:26|20:17|counter digits/i);
        expect(Object.keys(shot?.candidateUrls ?? {}).sort(), `${nodeId}/${window}`).toEqual(['c0', 'c1', 'c2', 'c3']);
        expect(shot?.curation?.picked, `${nodeId}/${window}`).toMatch(/^c[0-3]$/);
        expect(shot?.curation?.rejected, `${nodeId}/${window}`).toHaveLength(3);
        expect(shot?.curation?.reason, `${nodeId}/${window}`).toBeTruthy();
      }
    }
  });

  it('records seamless motion loops for every new Act III density view and tape window', () => {
    for (const nodeId of trancheNodes) {
      for (const window of windows) {
        const suffix = suffixFor(window);
        const loop = loops.find((candidate) => candidate.id === `${nodeId}__${suffix}`);
        expect(loop, `${nodeId}/${window}`).toBeTruthy();
        expect(loop?.act, `${nodeId}/${window}`).toBe('act3');
        expect(loop?.window, `${nodeId}/${window}`).toBe(window);
        expect(loop?.runtime, `${nodeId}/${window}`).toBe(`video/act3/${nodeId}__${suffix}.mp4`);
        expect(loop?.status, `${nodeId}/${window}`).toBe('generated-clean-motion');
        expect(loop?.curation, `${nodeId}/${window}`).toContain('seamless');
      }
    }
  });
});

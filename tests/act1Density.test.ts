import { describe, expect, it } from 'vitest';
import act1 from '../content/act1.json';
import motionLoops from '../content/motionLoops.json';
import shotlist from '../content/shotlist.json';
import type { SceneManifest } from '../engine/types';

const manifest = act1 as unknown as SceneManifest;
const shots = shotlist.shots as Array<{
  act?: string;
  nodeId?: string;
  window?: string;
  filename?: string;
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
  'wagon-left-facing',
  'wagon-right-facing',
  'flyer-floor-closeup',
  'scanner-side-closeup',
  'wagon-odometer-closeup',
  'shrine-detail-closeup',
] as const;

const requiredNoText = 'no readable text, no lettering, no signage characters';

describe('Act I B7 viewpoint-density tranche 1', () => {
  it('adds lateral facings and object closeups without altering the start node', () => {
    expect(manifest.startNodeId).toBe('wagon-interior');

    for (const nodeId of trancheNodes) {
      const node = manifest.nodes.find((candidate) => candidate.id === nodeId);
      expect(node, nodeId).toBeTruthy();
      expect(node?.temporalStates?.['20:08-20:17'], `${nodeId} baseline state`).toBeTruthy();
      expect(node?.temporalStates?.['20:08-20:17']?.motionLayers?.[0]?.src, `${nodeId} motion`).toBe(`video/act1/${nodeId}__2008-2017.mp4`);
    }
  });

  it('wires the new views into the existing Act I navigation loop', () => {
    const baseline = manifest.nodes.find((node) => node.id === 'wagon-interior')?.temporalStates?.['20:08-20:17'];
    const exterior = manifest.nodes.find((node) => node.id === 'wagon-exterior')?.temporalStates?.['20:08-20:17'];
    const shrine = manifest.nodes.find((node) => node.id === 'roadside-shrine')?.temporalStates?.['20:08-20:17'];

    expect(baseline?.hotspots?.some((hotspot) => hotspot.target === 'wagon-left-facing')).toBe(true);
    expect(baseline?.hotspots?.some((hotspot) => hotspot.target === 'flyer-floor-closeup')).toBe(true);
    expect(baseline?.hotspots?.some((hotspot) => hotspot.target === 'scanner-side-closeup')).toBe(true);
    expect(exterior?.hotspots?.some((hotspot) => hotspot.target === 'wagon-right-facing')).toBe(true);
    expect(exterior?.hotspots?.some((hotspot) => hotspot.target === 'wagon-odometer-closeup')).toBe(true);
    expect(shrine?.hotspots?.some((hotspot) => hotspot.target === 'shrine-detail-closeup')).toBe(true);
  });

  it('records curated multi-reference A7 clean-plate provenance for every new shot', () => {
    for (const nodeId of trancheNodes) {
      const shot = shots.find((candidate) => candidate.act === 'act1' && candidate.nodeId === nodeId && candidate.window === '20:08-20:17');
      expect(shot, nodeId).toBeTruthy();
      expect(shot?.status, nodeId).toBe('generated-clean');
      expect(shot?.prompt, nodeId).toContain('multi-reference plate-anchored edit');
      expect(shot?.prompt, nodeId).toContain(requiredNoText);
      expect(shot?.prompt, nodeId).not.toMatch(/trooper|DPS|cruiser|patrol/i);
      expect(Object.keys(shot?.candidateUrls ?? {}).sort(), nodeId).toEqual(['c0', 'c1', 'c2', 'c3']);
      expect(shot?.curation?.picked, nodeId).toMatch(/^c[0-3]$/);
      expect(shot?.curation?.rejected, nodeId).toHaveLength(3);
      expect(shot?.curation?.reason, nodeId).toBeTruthy();
    }
  });

  it('records seamless motion loops for every new view', () => {
    for (const nodeId of trancheNodes) {
      const loop = loops.find((candidate) => candidate.id === `${nodeId}__2008-2017`);
      expect(loop, nodeId).toBeTruthy();
      expect(loop?.act, nodeId).toBe('act1');
      expect(loop?.window, nodeId).toBe('20:08-20:17');
      expect(loop?.runtime, nodeId).toBe(`video/act1/${nodeId}__2008-2017.mp4`);
      expect(loop?.status, nodeId).toBe('generated-clean-motion');
      expect(loop?.curation, nodeId).toContain('seamless');
    }
  });
});

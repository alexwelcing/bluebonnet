import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import act1 from '../content/act1.json';
import act2 from '../content/act2.json';
import act3 from '../content/act3.json';
import act4 from '../content/act4.json';
import type { SceneManifest } from '../engine/types';

const manifests = [act1, act2, act3, act4] as unknown as SceneManifest[];

describe('B3 audio content upgrade', () => {
  it('defines per-node mix levels for every ambient audio bed', () => {
    const nodes = manifests.flatMap((manifest) => manifest.nodes);
    const ambientNodes = nodes.filter((node) => node.ambientAudio);
    expect(ambientNodes.length).toBeGreaterThan(0);
    for (const node of ambientNodes) {
      expect(node.audioMix?.ambient, node.id).toBeGreaterThan(0);
      expect(node.audioMix?.ambient, node.id).toBeLessThanOrEqual(1);
    }
  });
});

describe('B7 motion layer content', () => {
  it('every declared motion loop is deployable and seeded from its own plate', () => {
    const layers: { id: string; layer: { src: string; opacity: number; sourceStill?: string }; still: string }[] = [];
    for (const manifest of manifests) {
      for (const node of manifest.nodes) {
        for (const layer of node.motionLayers ?? []) {
          layers.push({ id: node.id, layer, still: node.still });
        }
        for (const [window, state] of Object.entries(node.temporalStates ?? {})) {
          for (const layer of state?.motionLayers ?? []) {
            layers.push({ id: `${node.id}/${window}`, layer, still: state!.still });
          }
        }
      }
    }
    // The hero pass ships per-window loops; backfill toward A4 continues.
    expect(layers.length).toBeGreaterThan(0);
    for (const { id, layer, still } of layers) {
      expect(layer.src, id).toMatch(/^video\/.+\.mp4$/);
      expect(fs.existsSync(`public/${layer.src}`), `${id}: missing public/${layer.src}`).toBe(true);
      expect(layer.opacity, id).toBeGreaterThan(0);
      expect(layer.opacity, id).toBeLessThanOrEqual(1);
      // Per-window loops must be generated from the plate they play over.
      if (layer.sourceStill) {
        expect(layer.sourceStill, id).toBe(still);
      }
    }
  });

  it('the start node breathes: wagon interior has a window-level loop', () => {
    const act1 = manifests[0];
    const start = act1.nodes.find((node) => node.id === 'wagon-interior');
    const state = start?.temporalStates?.['20:08-20:17'];
    expect(state?.motionLayers?.length, 'wagon-interior 20:08 loop').toBeGreaterThan(0);
  });
});

describe('Ambience II', () => {
  it('every ambient event, skin, and wrong-bed file is deployable', () => {
    const ambience = JSON.parse(fs.readFileSync('content/ambience.json', 'utf8'));
    const sources = new Set<string>();
    for (const pool of Object.values(ambience.pools) as { src: string }[][]) {
      for (const event of pool) sources.add(event.src);
    }
    sources.add(ambience.compareLoop.src);
    sources.add(ambience.transitionBed.src);
    expect(sources.size).toBeGreaterThanOrEqual(12);
    for (const src of sources) {
      expect(fs.existsSync(`public/${src}`), src).toBe(true);
    }
    // every pool key is a bed some node actually uses
    for (const bed of Object.keys(ambience.pools)) {
      expect(fs.existsSync(`public/${bed}`), bed).toBe(true);
    }
    // every event carries a caption (canon: captions for all audio)
    for (const pool of Object.values(ambience.pools) as { caption?: string }[][]) {
      for (const event of pool) expect(event.caption?.length).toBeGreaterThan(0);
    }
  });

  it('the same place sounds wronger in the later window', () => {
    const act2 = JSON.parse(fs.readFileSync('content/act2.json', 'utf8'));
    const threshold = act2.nodes.find((node: { id: string }) => node.id === 'field-threshold');
    expect(threshold.temporalStates['20:17-20:26'].ambientAudio).toBe('audio/field-wind-wrong.wav');
    expect(threshold.temporalStates['20:08-20:17'].ambientAudio).toBeUndefined();
  });
});

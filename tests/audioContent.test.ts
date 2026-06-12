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
  it('gives every node at least one deployable idle motion loop layer', () => {
    const nodes = manifests.flatMap((manifest) => manifest.nodes);
    expect(nodes.length).toBeGreaterThan(0);

    for (const node of nodes) {
      expect(node.motionLayers?.length, node.id).toBeGreaterThan(0);
      for (const layer of node.motionLayers ?? []) {
        expect(layer.src, node.id).toMatch(/^video\/.+\.mp4$/);
        expect(layer.opacity, node.id).toBeGreaterThan(0);
        expect(layer.opacity, node.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

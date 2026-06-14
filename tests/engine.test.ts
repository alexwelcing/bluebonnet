import { describe, expect, it } from 'vitest';
import { loadNodeGraph, getNode, resolveHotspotTarget } from '../engine/nodeGraph';
import { createStateMachine } from '../engine/stateMachine';
import { pointInPolygon, routeHotspotAt } from '../engine/hotspotRouter';
import type { SceneManifest } from '../engine/types';

const scene: SceneManifest = {
  nodes: [
    {
      id: 'dashcam-shoulder',
      title: 'Shoulder',
      still: 'stills/dashcam-test-01.png',
      hotspots: [
        { id: 'forward', label: 'Walk toward mile marker', polygon: [[70, 35], [92, 35], [92, 68], [70, 68]], target: 'mile-marker' },
        { id: 'radio', label: 'Touch the dash radio', polygon: [[8, 68], [32, 68], [32, 94], [8, 94]], setFlag: 'radioTouched', target: 'dashcam-shoulder' },
      ],
    },
    {
      id: 'mile-marker',
      title: 'Mile Marker',
      still: 'stills/dashcam-test-01.png',
      hotspots: [
        { id: 'back', label: 'Return to the wagon', polygon: [[0, 0], [20, 0], [20, 100], [0, 100]], target: 'dashcam-shoulder' },
        { id: 'deeper', label: 'Follow the flattened flowers', polygon: [[75, 25], [100, 25], [100, 75], [75, 75]], target: 'field-edge' },
      ],
    },
    {
      id: 'field-edge',
      title: 'Field Edge',
      still: 'stills/dashcam-test-01.png',
      hotspots: [
        { id: 'back', label: 'Back to mile marker', polygon: [[0, 20], [25, 20], [25, 80], [0, 80]], target: 'mile-marker' },
      ],
    },
  ],
};

describe('engine foundation', () => {
  it('loads manifests into a navigable node graph', () => {
    const graph = loadNodeGraph([scene]);

    expect(graph.startNodeId).toBe('dashcam-shoulder');
    expect(getNode(graph, 'mile-marker').hotspots.map((hotspot) => hotspot.id)).toEqual(['back', 'deeper']);
  });

  it('routes pointer coordinates to polygon hotspots', () => {
    const graph = loadNodeGraph([scene]);
    const node = getNode(graph, 'dashcam-shoulder');

    expect(pointInPolygon([80, 50], node.hotspots[0].polygon)).toBe(true);
    expect(routeHotspotAt(node, [80, 50])?.id).toBe('forward');
    expect(routeHotspotAt(node, [50, 50])).toBeUndefined();
  });

  it('applies flags and resolves conditional hotspot behavior', () => {
    const state = createStateMachine({ currentNodeId: 'dashcam-shoulder' });
    const graph = loadNodeGraph([scene]);
    const radio = getNode(graph, 'dashcam-shoulder').hotspots[1];

    expect(state.snapshot().flags.radioTouched).toBeUndefined();
    state.applyHotspot(radio);

    expect(state.snapshot().flags.radioTouched).toBe(true);
    expect(resolveHotspotTarget(radio, state.snapshot())).toBe('dashcam-shoulder');
  });

  it('starts the deck as a readable archive instead of an already-dying tape', () => {
    const state = createStateMachine({ currentNodeId: 'dashcam-shoulder' });

    expect(state.snapshot().vhsIntensity).toBe(0.4);
  });
});

import type {
  EngineSnapshot,
  FlagCondition,
  HotspotDefinition,
  NodeGraph,
  SceneManifest,
  SceneNode,
  TemporalNodeState,
  TimeWindow,
} from './types';
import { DEFAULT_TIME_WINDOW, nearestTimeWindow } from './timeWindows';

export function loadNodeGraph(manifests: SceneManifest[]): NodeGraph {
  const nodes: Record<string, SceneNode> = {};
  let startNodeId: string | undefined;
  let initialWindow: TimeWindow = DEFAULT_TIME_WINDOW;
  const lockedWindows = new Set<TimeWindow>();

  for (const manifest of manifests) {
    startNodeId ??= manifest.startNodeId ?? manifest.nodes[0]?.id;
    initialWindow = manifest.initialWindow ?? initialWindow;
    for (const window of manifest.lockedWindows ?? []) {
      lockedWindows.add(window);
    }
    for (const node of manifest.nodes) {
      if (nodes[node.id]) {
        throw new Error(`Duplicate scene node id: ${node.id}`);
      }
      nodes[node.id] = node;
    }
  }

  if (!startNodeId) {
    throw new Error('Cannot load node graph without at least one node.');
  }

  for (const node of Object.values(nodes)) {
    for (const state of Object.values(node.temporalStates ?? {})) {
      validateHotspotTargets(nodes, node.id, state.hotspots);
    }
    validateHotspotTargets(nodes, node.id, node.hotspots);
  }

  return { startNodeId, initialWindow, lockedWindows: [...lockedWindows], nodes };
}

function validateHotspotTargets(nodes: Record<string, SceneNode>, nodeId: string, hotspots: HotspotDefinition[]): void {
  for (const hotspot of hotspots) {
    const targets = [hotspot.target, ...(hotspot.conditionalTargets ?? []).map((conditional) => conditional.target)].filter(
      (target): target is string => typeof target === 'string',
    );
    for (const target of targets) {
      if (!nodes[target]) {
        throw new Error(`Hotspot ${nodeId}.${hotspot.id} references missing target node: ${target}`);
      }
    }
  }
}

export function getNode(graph: NodeGraph, id: string): SceneNode {
  const node = graph.nodes[id];
  if (!node) {
    throw new Error(`Unknown scene node: ${id}`);
  }
  return node;
}

export function nearestDefinedWindow(
  states: Partial<Record<TimeWindow, TemporalNodeState>>,
  window: TimeWindow,
): TimeWindow | undefined {
  return nearestTimeWindow(Object.keys(states) as TimeWindow[], window);
}

export function getNodeState(graph: NodeGraph, id: string, window: TimeWindow): TemporalNodeState {
  const node = getNode(graph, id);
  const states = node.temporalStates ?? {};
  const direct = states[window];
  if (direct) {
    return direct;
  }
  // Every node's base hotspot list is empty by convention; falling back to it
  // would strand the player on a dead view. Show the nearest tape window the
  // node actually defines instead.
  const nearest = nearestDefinedWindow(states, window);
  if (nearest) {
    const nearestState = states[nearest]!;
    return nearestState;
  }
  return {
    still: node.still,
    caption: node.caption ?? '',
    hotspots: node.hotspots,
  };
}

export function conditionsMet(conditions: FlagCondition[] | undefined, snapshot: EngineSnapshot): boolean {
  return (conditions ?? []).every((condition) => {
    const expected = condition.equals ?? true;
    return Boolean(snapshot.flags[condition.flag]) === expected;
  });
}

export function availableHotspots(nodeOrState: SceneNode | TemporalNodeState, snapshot: EngineSnapshot): HotspotDefinition[] {
  return nodeOrState.hotspots.filter((hotspot) => conditionsMet(hotspot.requires, snapshot));
}

export function resolveHotspotTarget(hotspot: HotspotDefinition, snapshot: EngineSnapshot): string | undefined {
  const conditionalTarget = hotspot.conditionalTargets?.find((candidate) => conditionsMet(candidate.when, snapshot));
  return conditionalTarget?.target ?? hotspot.target;
}

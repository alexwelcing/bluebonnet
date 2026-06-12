import type { EngineSnapshot, FlagCondition, HotspotDefinition, NodeGraph, SceneManifest, SceneNode } from './types';

export function loadNodeGraph(manifests: SceneManifest[]): NodeGraph {
  const nodes: Record<string, SceneNode> = {};
  let startNodeId: string | undefined;

  for (const manifest of manifests) {
    startNodeId ??= manifest.startNodeId ?? manifest.nodes[0]?.id;
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
    for (const hotspot of node.hotspots) {
      const targets = [hotspot.target, ...(hotspot.conditionalTargets ?? []).map((conditional) => conditional.target)].filter(
        (target): target is string => typeof target === 'string',
      );
      for (const target of targets) {
        if (!nodes[target]) {
          throw new Error(`Hotspot ${node.id}.${hotspot.id} references missing target node: ${target}`);
        }
      }
    }
  }

  return { startNodeId, nodes };
}

export function getNode(graph: NodeGraph, id: string): SceneNode {
  const node = graph.nodes[id];
  if (!node) {
    throw new Error(`Unknown scene node: ${id}`);
  }
  return node;
}

export function conditionsMet(conditions: FlagCondition[] | undefined, snapshot: EngineSnapshot): boolean {
  return (conditions ?? []).every((condition) => {
    const expected = condition.equals ?? true;
    return Boolean(snapshot.flags[condition.flag]) === expected;
  });
}

export function availableHotspots(node: SceneNode, snapshot: EngineSnapshot): HotspotDefinition[] {
  return node.hotspots.filter((hotspot) => conditionsMet(hotspot.requires, snapshot));
}

export function resolveHotspotTarget(hotspot: HotspotDefinition, snapshot: EngineSnapshot): string | undefined {
  const conditionalTarget = hotspot.conditionalTargets?.find((candidate) => conditionsMet(candidate.when, snapshot));
  return conditionalTarget?.target ?? hotspot.target;
}

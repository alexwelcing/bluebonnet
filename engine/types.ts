export type Point = readonly [number, number];

export interface FlagCondition {
  flag: string;
  equals?: boolean;
}

export interface ConditionalTarget {
  when: FlagCondition[];
  target: string;
  label?: string;
}

export interface HotspotDefinition {
  id: string;
  label: string;
  polygon: Point[];
  target?: string;
  setFlag?: string;
  clearFlag?: string;
  requires?: FlagCondition[];
  conditionalTargets?: ConditionalTarget[];
  caption?: string;
}

export interface SceneNode {
  id: string;
  title: string;
  still: string;
  ambientAudio?: string;
  caption?: string;
  hotspots: HotspotDefinition[];
}

export interface SceneManifest {
  startNodeId?: string;
  nodes: SceneNode[];
}

export interface NodeGraph {
  startNodeId: string;
  nodes: Record<string, SceneNode>;
}

export interface EngineSnapshot {
  currentNodeId: string;
  flags: Record<string, boolean>;
  vhsIntensity: number;
  savedAt?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type Point = readonly [number, number];
export type TimeWindow = '23:08-23:17' | '23:17-23:26' | '23:26-23:35';

export interface FlagCondition {
  flag: string;
  equals?: boolean;
}

export interface ConditionalTarget {
  when: FlagCondition[];
  target: string;
  label?: string;
}

export type PuzzleAction =
  | 'flyer-frequency'
  | 'radio-tune'
  | 'dispatch-log'
  | 'flower-digit-2'
  | 'flower-digit-7'
  | 'flower-digit-1'
  | 'flower-digit-3'
  | 'field-gate'
  | 'echo-knocks'
  | 'recorder-counter';

export interface JournalClue {
  id: string;
  text: string;
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
  exhibit?: 'flyer' | 'dispatch' | 'recorder';
  journal?: JournalClue;
  puzzleAction?: PuzzleAction;
  discoverTimecode?: TimeWindow;
  shimmerThreshold?: number;
}

export interface TemporalNodeState {
  still: string;
  caption: string;
  wrongness?: string;
  hotspots: HotspotDefinition[];
}

export interface SceneNode {
  id: string;
  title: string;
  still: string;
  ambientAudio?: string;
  threatAudio?: string;
  audioMix?: {
    ambient: number;
    threat?: number;
  };
  caption?: string;
  hotspots: HotspotDefinition[];
  temporalStates?: Partial<Record<TimeWindow, TemporalNodeState>>;
}

export interface SceneManifest {
  startNodeId?: string;
  initialWindow?: TimeWindow;
  lockedWindows?: TimeWindow[];
  nodes: SceneNode[];
}

export interface NodeGraph {
  startNodeId: string;
  initialWindow: TimeWindow;
  lockedWindows: TimeWindow[];
  nodes: Record<string, SceneNode>;
}

export interface JournalEntry {
  id: string;
  text: string;
  loggedAt: string;
}

export interface EngineSnapshot {
  currentNodeId: string;
  flags: Record<string, boolean>;
  vhsIntensity: number;
  activeWindow: TimeWindow;
  discoveredTimecodes: TimeWindow[];
  journal: JournalEntry[];
  completedPuzzles: PuzzleAction[];
  captionsEnabled: boolean;
  savedAt?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

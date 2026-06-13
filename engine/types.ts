export type Point = readonly [number, number];
export type TimeWindow = '20:08-20:17' | '20:17-20:26' | '20:26-20:35';

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
  /** Locks refuse, not vanish: when requires fail and this is set, the hotspot
   * stays visible and clicking it speaks this hint instead of acting. */
  lockedHint?: string;
  /** Interactive mechanism the player must operate; success then runs the
   * hotspot's normal consequences (puzzleAction, flags, navigation). */
  mechanism?: 'radio-dial' | 'padlock' | 'knock';
  /** Text prompt for the segmentation pipeline (tools/segmentClues.mjs). */
  cluePrompt?: string;
  /** Set by the pipeline when polygon is a model-derived clue silhouette. */
  clueHighlight?: boolean;
}

export interface TemporalNodeState {
  still: string;
  caption: string;
  wrongness?: string;
  hotspots: HotspotDefinition[];
  /** Per-window idle loops (seeded from this window's plate); falls back to node.motionLayers. */
  motionLayers?: MotionLayer[];
}

export interface MotionLayer {
  src: string;
  opacity: number;
  blendMode?: 'screen' | 'overlay' | 'lighten' | 'normal';
  /** Poster/source plate this loop was generated from (provenance + tests). */
  sourceStill?: string;
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
  motionLayers?: MotionLayer[];
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

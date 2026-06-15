// BLUEBONNET 360-world manifest (A10 — 360 WORLD BEFORE VIEWER).
//
// Canon A10 forbids shipping a bare Gaussian-splat / model-viewer button. Before
// any runtime 360 world can be promoted, it must DECLARE a real architecture:
// navigable waypoints, collision/proxy bounds, accessible interaction volumes,
// per-tape-window state, spatial audio emitters, and effect zones — all keyed to
// the canonical tape windows (engine/timeWindows.ts).
//
// This module is the typed DATA CONTRACT plus a PURE validator. The validator
// NEVER throws: it returns structured errors so a candidate world can be gated
// in CI before it is allowed near the live deck. Nothing here renders anything.

import type { TimeWindow } from './types';
import { TIME_WINDOWS } from './timeWindows';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned bounding box in world units; min must be <= max per axis. */
export interface AABB {
  min: Vec3;
  max: Vec3;
}

/** A place the player can stand and look around (the 360 equivalent of a node). */
export interface Waypoint {
  id: string;
  position: Vec3;
  /** Authored facings the player may snap/turn to (A4 density: >= 2). */
  facings: Vec3[];
  /** Walkable waypoint ids reachable from here (collision-respecting edges). */
  neighbors: string[];
}

/** Collision / navigation proxy geometry — what the player cannot walk through. */
export interface CollisionProxy {
  id: string;
  /** 'solid' blocks movement; 'floor' is walkable ground; 'void' is a kill/return plane. */
  kind: 'solid' | 'floor' | 'void';
  bounds: AABB;
}

/** Accessible interaction volume — a clue/mechanism the player can operate. */
export interface InteractionVolume {
  id: string;
  bounds: AABB;
  /** Optional clue label surfaced to the journal / a11y readout. */
  label?: string;
  /** Must be reachable from this waypoint (accessibility gate). */
  reachableFrom: string;
  /** Maximum distance the player may operate this from (a11y reach radius). */
  activationRadius: number;
}

/** Spatial audio emitter — consumed later by engine/volumetricAudio.ts. */
export interface AudioEmitter {
  id: string;
  position: Vec3;
  source: string;
  /** Below this distance gain is full. */
  minDistance: number;
  /** At/beyond this distance gain is zero; must exceed minDistance. */
  maxDistance: number;
  /** Threat channel (radio static) must never be a stinger — bed-only. */
  channel: 'bed' | 'threat';
}

/** Spatial effect zone — VHS wrongness / tape-artifact intensity by region. */
export interface EffectZone {
  id: string;
  bounds: AABB;
  /** 0..1 effect intensity (tracking distortion, flower luminescence, shimmer). */
  intensity: number;
  effect: 'wrongness' | 'shimmer' | 'luminescence' | 'tracking';
}

/** Per-tape-window state: which waypoints exist and how wrong the world reads. */
export interface WorldWindowState {
  window: TimeWindow;
  /** Waypoint ids navigable in this window. */
  activeWaypoints: string[];
  /** Effect zone ids active in this window. */
  activeEffectZones: string[];
  /** Optional human note for the wrongness delta vs. earlier windows. */
  wrongness?: string;
}

export interface WorldManifest {
  id: string;
  /** Offline World Labs / Marble reference (NOT shipped as runtime content). */
  sourceWorld?: string;
  startWaypoint: string;
  waypoints: Waypoint[];
  collision: CollisionProxy[];
  interactions: InteractionVolume[];
  emitters: AudioEmitter[];
  effectZones: EffectZone[];
  /** State for every declared tape window the world supports (>= 2). */
  windows: WorldWindowState[];
}

export type GateRule =
  | 'navigation'
  | 'collision'
  | 'interaction'
  | 'audio'
  | 'effects'
  | 'windows'
  | 'promotion';

export interface ValidationError {
  rule: GateRule;
  message: string;
  /** Where the failure is (waypoint id, emitter id, window, …) when known. */
  subject?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

function aabbValid(box: AABB): boolean {
  return (
    box.min.x <= box.max.x &&
    box.min.y <= box.max.y &&
    box.min.z <= box.max.z &&
    [box.min, box.max].every((v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z))
  );
}

function pointInAABB(point: Vec3, box: AABB): boolean {
  return (
    point.x >= box.min.x &&
    point.x <= box.max.x &&
    point.y >= box.min.y &&
    point.y <= box.max.y &&
    point.z >= box.min.z &&
    point.z <= box.max.z
  );
}

/**
 * Pure gate for an A10 360-world candidate. Returns every failing rule rather
 * than stopping at the first, so CI can report a world's full debt at once.
 * Never throws — malformed input becomes structured errors.
 */
export function validateWorldManifest(manifest: WorldManifest): ValidationResult {
  const errors: ValidationError[] = [];
  const push = (rule: GateRule, message: string, subject?: string): void => {
    errors.push({ rule, message, subject });
  };

  const waypointIds = new Set(manifest.waypoints.map((w) => w.id));

  // --- navigation gate ------------------------------------------------------
  if (manifest.waypoints.length === 0) {
    push('navigation', 'World declares no navigable waypoints.');
  }
  if (!waypointIds.has(manifest.startWaypoint)) {
    push('navigation', `startWaypoint "${manifest.startWaypoint}" is not a declared waypoint.`, manifest.startWaypoint);
  }
  for (const wp of manifest.waypoints) {
    if (wp.facings.length < 2) {
      // A4 density mandate: every position gets multiple facings.
      push('navigation', `Waypoint "${wp.id}" must declare >= 2 facings (A4 density).`, wp.id);
    }
    for (const neighbor of wp.neighbors) {
      if (!waypointIds.has(neighbor)) {
        push('navigation', `Waypoint "${wp.id}" links to missing neighbor "${neighbor}".`, wp.id);
      }
    }
  }
  // Reachability: every waypoint reachable from start via neighbor edges.
  if (waypointIds.has(manifest.startWaypoint) && manifest.waypoints.length > 0) {
    const byId = new Map(manifest.waypoints.map((w) => [w.id, w]));
    const seen = new Set<string>([manifest.startWaypoint]);
    const stack = [manifest.startWaypoint];
    while (stack.length > 0) {
      const current = byId.get(stack.pop()!);
      for (const neighbor of current?.neighbors ?? []) {
        if (byId.has(neighbor) && !seen.has(neighbor)) {
          seen.add(neighbor);
          stack.push(neighbor);
        }
      }
    }
    for (const wp of manifest.waypoints) {
      if (!seen.has(wp.id)) {
        push('navigation', `Waypoint "${wp.id}" is unreachable from startWaypoint.`, wp.id);
      }
    }
  }

  // --- collision gate -------------------------------------------------------
  if (manifest.collision.length === 0) {
    push('collision', 'World declares no collision/proxy bounds; players would clip through it.');
  }
  if (!manifest.collision.some((c) => c.kind === 'floor')) {
    push('collision', 'World declares no walkable floor proxy.');
  }
  for (const proxy of manifest.collision) {
    if (!aabbValid(proxy.bounds)) {
      push('collision', `Collision proxy "${proxy.id}" has an invalid AABB (min must be <= max, all finite).`, proxy.id);
    }
  }

  // --- interaction gate (accessibility) ------------------------------------
  for (const volume of manifest.interactions) {
    if (!aabbValid(volume.bounds)) {
      push('interaction', `Interaction "${volume.id}" has an invalid AABB.`, volume.id);
    }
    if (volume.activationRadius <= 0 || !Number.isFinite(volume.activationRadius)) {
      push('interaction', `Interaction "${volume.id}" needs a positive activationRadius (a11y reach).`, volume.id);
    }
    if (!waypointIds.has(volume.reachableFrom)) {
      push('interaction', `Interaction "${volume.id}" is reachableFrom missing waypoint "${volume.reachableFrom}".`, volume.id);
    } else {
      const wp = manifest.waypoints.find((w) => w.id === volume.reachableFrom)!;
      const within =
        pointInAABB(wp.position, volume.bounds) ||
        nearestDistanceToAABB(wp.position, volume.bounds) <= volume.activationRadius;
      if (!within) {
        push('interaction', `Interaction "${volume.id}" is out of reach (> activationRadius) from "${volume.reachableFrom}".`, volume.id);
      }
    }
  }

  // --- audio gate -----------------------------------------------------------
  for (const emitter of manifest.emitters) {
    if (!(emitter.maxDistance > emitter.minDistance) || emitter.minDistance < 0) {
      push('audio', `Emitter "${emitter.id}" needs 0 <= minDistance < maxDistance.`, emitter.id);
    }
    if (!emitter.source) {
      push('audio', `Emitter "${emitter.id}" has no source.`, emitter.id);
    }
  }

  // --- effects gate ---------------------------------------------------------
  for (const zone of manifest.effectZones) {
    if (!aabbValid(zone.bounds)) {
      push('effects', `Effect zone "${zone.id}" has an invalid AABB.`, zone.id);
    }
    if (zone.intensity < 0 || zone.intensity > 1 || !Number.isFinite(zone.intensity)) {
      push('effects', `Effect zone "${zone.id}" intensity must be within 0..1.`, zone.id);
    }
  }

  // --- windows gate (tape-window / day transitions) ------------------------
  if (manifest.windows.length < 2) {
    // Wrongness rule needs at least two windows to express a delta (A4: >= 2 per node).
    push('windows', 'World must declare >= 2 tape-window states to express the wrongness rule.');
  }
  const seenWindows = new Set<TimeWindow>();
  const effectZoneIds = new Set(manifest.effectZones.map((z) => z.id));
  for (const state of manifest.windows) {
    if (!TIME_WINDOWS.includes(state.window)) {
      push('windows', `Window "${state.window}" is not a canonical tape window.`, state.window);
    }
    if (seenWindows.has(state.window)) {
      push('windows', `Duplicate window state for "${state.window}".`, state.window);
    }
    seenWindows.add(state.window);
    if (state.activeWaypoints.length === 0) {
      push('windows', `Window "${state.window}" has no active waypoints.`, state.window);
    }
    for (const id of state.activeWaypoints) {
      if (!waypointIds.has(id)) {
        push('windows', `Window "${state.window}" references missing waypoint "${id}".`, state.window);
      }
    }
    for (const id of state.activeEffectZones) {
      if (!effectZoneIds.has(id)) {
        push('windows', `Window "${state.window}" references missing effect zone "${id}".`, state.window);
      }
    }
  }
  // The start waypoint must be reachable in at least one window.
  if (
    waypointIds.has(manifest.startWaypoint) &&
    manifest.windows.length > 0 &&
    !manifest.windows.some((s) => s.activeWaypoints.includes(manifest.startWaypoint))
  ) {
    push('windows', 'startWaypoint is not active in any declared window.', manifest.startWaypoint);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Promotion criterion per A10: a world may only be promoted to runtime content
 * once it passes EVERY gate. This is a thin convenience over the validator so
 * the deck/CI has one boolean to check; the brief is "gates before viewer".
 */
export function canPromoteToRuntime(manifest: WorldManifest): boolean {
  return validateWorldManifest(manifest).ok;
}

/** Shortest distance from a point to the surface/interior of an AABB. */
function nearestDistanceToAABB(point: Vec3, box: AABB): number {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const dy = Math.max(box.min.y - point.y, 0, point.y - box.max.y);
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

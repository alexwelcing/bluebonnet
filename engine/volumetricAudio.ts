// BLUEBONNET volumetric audio math (A10 — 360 WORLD BEFORE VIEWER).
//
// Pure, deterministic, renderer-neutral spatial-audio math. No Web Audio, no
// DOM: this layer turns a listener pose and an emitter position into the three
// scalars a mixer needs — gain (distance attenuation), pan (stereo placement),
// and a low-pass factor (occlusion). engine/audioMixer.ts can consume these
// numbers later; nothing here touches an AudioContext.
//
// Coordinate convention (matches a world manifest, see worldManifest.ts):
//   x = east(+)/west(-), y = up(+)/down(-), z = north(+)/south(-).
// All functions clamp their outputs and never throw on degenerate input.

import type { Vec3 } from './worldManifest';

/** Distance falloff curve. Linear is forgiving; inverse/exponential read as
 * more physical. All reach silence at maxDistance. */
export type FalloffCurve = 'linear' | 'inverse' | 'exponential';

export interface ListenerPose {
  position: Vec3;
  /** Unit-ish forward vector (where the listener faces); normalized internally. */
  forward: Vec3;
  /** Unit-ish right vector (listener's right ear side); normalized internally. */
  right: Vec3;
}

export interface EmitterPlacement {
  position: Vec3;
  /** Below this distance, gain is full (1). */
  minDistance: number;
  /** At/beyond this distance, gain is 0. */
  maxDistance: number;
  curve?: FalloffCurve;
}

export interface SpatialAudioResult {
  /** 0..1 distance gain. */
  gain: number;
  /** -1 (hard left) .. +1 (hard right). */
  pan: number;
  /** 0 (open air) .. 1 (fully occluded); drives a low-pass cutoff downstream. */
  occlusion: number;
  /** Straight-line listener→emitter distance, for downstream reverb sends. */
  distance: number;
}

const EPSILON = 1e-6;

export function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function length(v: Vec3): number {
  return Math.sqrt(dot(v, v));
}

/** Returns a unit vector; degenerate (zero-length) input yields {0,0,0}. */
export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  if (len < EPSILON) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Distance attenuation in [0,1]. Full inside minDistance, zero at/after
 * maxDistance, falling off along the chosen curve in between. A non-positive or
 * inverted range collapses to a binary in/out gate rather than throwing.
 */
export function distanceAttenuation(
  d: number,
  minDistance: number,
  maxDistance: number,
  curve: FalloffCurve = 'inverse',
): number {
  const near = Math.max(0, minDistance);
  const far = Math.max(near, maxDistance);
  const dist = Math.max(0, Number.isFinite(d) ? d : far);
  if (dist <= near) {
    return 1;
  }
  if (dist >= far || far - near < EPSILON) {
    return dist <= near ? 1 : 0;
  }
  // Normalized 0 (at near) .. 1 (at far).
  const t = (dist - near) / (far - near);
  switch (curve) {
    case 'linear':
      return clamp(1 - t, 0, 1);
    case 'exponential':
      // Fast early drop; tuned to hit ~0 at the far edge.
      return clamp((1 - t) * (1 - t), 0, 1);
    case 'inverse':
    default: {
      // Inverse-distance feel: gain falls as 1/(1+k) where k grows with how far
      // past `near` we are, measured in `near`-relative units (with a floor so a
      // zero near-distance still yields a sane curve). Multiplying by (1 - t)
      // forces the asymptotic curve to actually reach 0 at `far`.
      const scale = Math.max(near, 1);
      const raw = 1 / (1 + (dist - near) / scale);
      return clamp(raw * (1 - t), 0, 1);
    }
  }
}

/**
 * Stereo pan in [-1,1] from listener pose to emitter. +1 is hard right, -1 hard
 * left. Uses the listener's right vector projected onto the (normalized)
 * direction to the emitter; an emitter on top of the listener pans center (0).
 */
export function stereoPan(listener: ListenerPose, emitterPosition: Vec3): number {
  const toEmitter = normalize({
    x: emitterPosition.x - listener.position.x,
    y: emitterPosition.y - listener.position.y,
    z: emitterPosition.z - listener.position.z,
  });
  if (length(toEmitter) < EPSILON) {
    return 0;
  }
  const right = normalize(listener.right);
  return clamp(dot(toEmitter, right), -1, 1);
}

/**
 * Occlusion / low-pass factor in [0,1]. 0 = open air (line of sight), 1 = fully
 * blocked. `blockerThickness` (>=0) is summed acoustic thickness of obstacles on
 * the listener→emitter ray; `material` scales how much each unit of thickness
 * muffles (0 = acoustically transparent, 1 = dense wall). Saturates at 1.
 */
export function occlusionFactor(blockerThickness: number, material = 1): number {
  const thickness = Math.max(0, Number.isFinite(blockerThickness) ? blockerThickness : 0);
  const m = clamp(material, 0, 1);
  if (thickness < EPSILON || m < EPSILON) {
    return 0;
  }
  // Exponential approach to fully-occluded; 1 unit of dense thickness ≈ 0.63.
  return clamp(1 - Math.exp(-thickness * m), 0, 1);
}

/**
 * One-call spatialization: combine distance gain, pan, and occlusion for an
 * emitter relative to a listener. `blockerThickness`/`material` describe what is
 * between them (0 / open air by default).
 */
export function spatialize(
  listener: ListenerPose,
  emitter: EmitterPlacement,
  blockerThickness = 0,
  material = 1,
): SpatialAudioResult {
  const d = distance(listener.position, emitter.position);
  return {
    distance: d,
    gain: distanceAttenuation(d, emitter.minDistance, emitter.maxDistance, emitter.curve),
    pan: stereoPan(listener, emitter.position),
    occlusion: occlusionFactor(blockerThickness, material),
  };
}

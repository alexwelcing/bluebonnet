import { describe, expect, it } from 'vitest';
import {
  distance,
  distanceAttenuation,
  normalize,
  occlusionFactor,
  spatialize,
  stereoPan,
  type EmitterPlacement,
  type ListenerPose,
} from '../engine/volumetricAudio';
import type { Vec3 } from '../engine/worldManifest';

const origin: Vec3 = { x: 0, y: 0, z: 0 };

// Listener at origin facing +z (north), right ear toward +x (east).
function listenerAtOrigin(): ListenerPose {
  return { position: origin, forward: { x: 0, y: 0, z: 1 }, right: { x: 1, y: 0, z: 0 } };
}

describe('volumetric audio math', () => {
  describe('distance', () => {
    it('is the euclidean straight-line distance', () => {
      expect(distance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 })).toBeCloseTo(5);
    });
  });

  describe('normalize', () => {
    it('returns a unit vector', () => {
      const n = normalize({ x: 0, y: 0, z: 5 });
      expect(distance(origin, n)).toBeCloseTo(1);
    });
    it('returns zero for a degenerate vector instead of NaN', () => {
      expect(normalize({ x: 0, y: 0, z: 0 })).toEqual({ x: 0, y: 0, z: 0 });
    });
  });

  describe('distanceAttenuation', () => {
    it('is full gain at/inside minDistance', () => {
      expect(distanceAttenuation(0, 1, 10)).toBe(1);
      expect(distanceAttenuation(1, 1, 10)).toBe(1);
    });

    it('is zero at/beyond maxDistance', () => {
      expect(distanceAttenuation(10, 1, 10)).toBe(0);
      expect(distanceAttenuation(50, 1, 10)).toBe(0);
    });

    it('falls off monotonically between near and far on every curve', () => {
      for (const curve of ['linear', 'inverse', 'exponential'] as const) {
        const a = distanceAttenuation(2, 1, 10, curve);
        const b = distanceAttenuation(5, 1, 10, curve);
        const c = distanceAttenuation(8, 1, 10, curve);
        expect(a).toBeGreaterThan(b);
        expect(b).toBeGreaterThan(c);
        // every intermediate value stays in (0,1)
        for (const g of [a, b, c]) {
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(1);
        }
      }
    });

    it('linear is the exact midpoint at the range center', () => {
      expect(distanceAttenuation(5.5, 1, 10, 'linear')).toBeCloseTo(0.5);
    });

    it('exponential drops faster than linear early on', () => {
      const exp = distanceAttenuation(3, 1, 10, 'exponential');
      const lin = distanceAttenuation(3, 1, 10, 'linear');
      expect(exp).toBeLessThan(lin);
    });

    it('degrades to a binary gate on an inverted/degenerate range without throwing', () => {
      expect(() => distanceAttenuation(5, 10, 1)).not.toThrow();
      expect(distanceAttenuation(NaN, 1, 10)).toBe(0);
    });
  });

  describe('stereoPan', () => {
    it('pans hard right for an emitter directly to the listener right', () => {
      expect(stereoPan(listenerAtOrigin(), { x: 5, y: 0, z: 0 })).toBeCloseTo(1);
    });

    it('pans hard left for an emitter directly to the listener left', () => {
      expect(stereoPan(listenerAtOrigin(), { x: -5, y: 0, z: 0 })).toBeCloseTo(-1);
    });

    it('pans center for an emitter dead ahead', () => {
      expect(stereoPan(listenerAtOrigin(), { x: 0, y: 0, z: 5 })).toBeCloseTo(0);
    });

    it('pans center for an emitter on top of the listener', () => {
      expect(stereoPan(listenerAtOrigin(), origin)).toBe(0);
    });

    it('always returns a value within [-1, 1]', () => {
      const pan = stereoPan(listenerAtOrigin(), { x: 2, y: 9, z: 3 });
      expect(pan).toBeGreaterThanOrEqual(-1);
      expect(pan).toBeLessThanOrEqual(1);
    });
  });

  describe('occlusionFactor', () => {
    it('is 0 for open air (no blocker)', () => {
      expect(occlusionFactor(0)).toBe(0);
    });

    it('is 0 for an acoustically transparent material', () => {
      expect(occlusionFactor(5, 0)).toBe(0);
    });

    it('increases with blocker thickness and stays within [0, 1]', () => {
      const thin = occlusionFactor(0.5, 1);
      const thick = occlusionFactor(3, 1);
      expect(thin).toBeGreaterThan(0);
      expect(thick).toBeGreaterThan(thin);
      expect(thick).toBeLessThanOrEqual(1);
    });

    it('approaches but never exceeds full occlusion', () => {
      expect(occlusionFactor(1000, 1)).toBeLessThanOrEqual(1);
      expect(occlusionFactor(1000, 1)).toBeGreaterThan(0.99);
    });

    it('does not throw on degenerate input', () => {
      expect(() => occlusionFactor(NaN, 2)).not.toThrow();
      expect(occlusionFactor(NaN)).toBe(0);
    });
  });

  describe('spatialize', () => {
    it('combines gain, pan, occlusion, and distance in one call', () => {
      const emitter: EmitterPlacement = { position: { x: 4, y: 0, z: 0 }, minDistance: 1, maxDistance: 10, curve: 'linear' };
      const r = spatialize(listenerAtOrigin(), emitter, 0, 1);
      expect(r.distance).toBeCloseTo(4);
      expect(r.pan).toBeCloseTo(1); // hard right
      expect(r.gain).toBeGreaterThan(0);
      expect(r.gain).toBeLessThan(1);
      expect(r.occlusion).toBe(0); // open air
    });

    it('passes blocker thickness through to occlusion', () => {
      const emitter: EmitterPlacement = { position: { x: 0, y: 0, z: 4 }, minDistance: 1, maxDistance: 10 };
      const open = spatialize(listenerAtOrigin(), emitter);
      const walled = spatialize(listenerAtOrigin(), emitter, 2, 1);
      expect(open.occlusion).toBe(0);
      expect(walled.occlusion).toBeGreaterThan(open.occlusion);
    });
  });
});

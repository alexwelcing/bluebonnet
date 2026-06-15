import { describe, expect, it } from 'vitest';
import {
  canPromoteToRuntime,
  validateWorldManifest,
  type GateRule,
  type WorldManifest,
} from '../engine/worldManifest';

// A minimal world that passes EVERY A10 gate. Each invalid case below mutates
// exactly one facet so the failing rule is unambiguous.
function validWorld(): WorldManifest {
  return {
    id: 'shoulder-360',
    sourceWorld: 'assets/worlds/shoulder.spz',
    startWaypoint: 'wp-cruiser',
    waypoints: [
      {
        id: 'wp-cruiser',
        position: { x: 0, y: 1.6, z: 0 },
        facings: [
          { x: 0, y: 0, z: 1 },
          { x: 0, y: 0, z: -1 },
        ],
        neighbors: ['wp-marker'],
      },
      {
        id: 'wp-marker',
        position: { x: 3, y: 1.6, z: 2 },
        facings: [
          { x: 1, y: 0, z: 0 },
          { x: -1, y: 0, z: 0 },
        ],
        neighbors: ['wp-cruiser'],
      },
    ],
    collision: [
      { id: 'ground', kind: 'floor', bounds: { min: { x: -10, y: 0, z: -10 }, max: { x: 10, y: 0, z: 10 } } },
      { id: 'cruiser-body', kind: 'solid', bounds: { min: { x: -1, y: 0, z: -2 }, max: { x: 1, y: 1.5, z: 2 } } },
    ],
    interactions: [
      {
        id: 'flyer',
        bounds: { min: { x: -0.2, y: 1.4, z: 0.8 }, max: { x: 0.2, y: 1.8, z: 1.2 } },
        label: 'Missing-person flyer',
        reachableFrom: 'wp-cruiser',
        activationRadius: 1.5,
      },
    ],
    emitters: [
      { id: 'engine-idle', position: { x: 0, y: 0.5, z: 1 }, source: 'sfx/engine-idle.ogg', minDistance: 1, maxDistance: 12, channel: 'bed' },
      { id: 'scanner', position: { x: 0.5, y: 1.2, z: 0.5 }, source: 'sfx/static.ogg', minDistance: 0.5, maxDistance: 6, channel: 'threat' },
    ],
    effectZones: [
      { id: 'shimmer-flowers', bounds: { min: { x: 2, y: 0, z: 1 }, max: { x: 5, y: 2, z: 4 } }, intensity: 0.4, effect: 'shimmer' },
    ],
    windows: [
      { window: '20:08-20:17', activeWaypoints: ['wp-cruiser', 'wp-marker'], activeEffectZones: ['shimmer-flowers'] },
      { window: '20:17-20:26', activeWaypoints: ['wp-cruiser', 'wp-marker'], activeEffectZones: ['shimmer-flowers'], wrongness: 'the pole leans nearer' },
    ],
  };
}

function rulesOf(manifest: WorldManifest): GateRule[] {
  return validateWorldManifest(manifest).errors.map((e) => e.rule);
}

describe('A10 world manifest gate', () => {
  it('passes a fully-specified world and marks it promotable', () => {
    const result = validateWorldManifest(validWorld());
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(canPromoteToRuntime(validWorld())).toBe(true);
  });

  it('never throws on malformed input — it returns structured errors', () => {
    // A cast-through of nonsense must still come back as a result, not an throw.
    const broken = { ...validWorld(), waypoints: [], collision: [], emitters: [], interactions: [], effectZones: [], windows: [] };
    expect(() => validateWorldManifest(broken)).not.toThrow();
    const result = validateWorldManifest(broken);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  // --- navigation gate -------------------------------------------------------
  it('navigation: flags an unknown startWaypoint', () => {
    const w = validWorld();
    w.startWaypoint = 'wp-nowhere';
    expect(rulesOf(w)).toContain('navigation');
  });

  it('navigation: requires >= 2 facings per waypoint (A4 density)', () => {
    const w = validWorld();
    w.waypoints[0].facings = [{ x: 0, y: 0, z: 1 }];
    const errors = validateWorldManifest(w).errors;
    expect(errors.some((e) => e.rule === 'navigation' && e.subject === 'wp-cruiser')).toBe(true);
  });

  it('navigation: flags links to missing neighbors', () => {
    const w = validWorld();
    w.waypoints[0].neighbors = ['wp-ghost'];
    expect(rulesOf(w)).toContain('navigation');
  });

  it('navigation: flags waypoints unreachable from start', () => {
    const w = validWorld();
    // sever the edges so wp-marker is stranded
    w.waypoints[0].neighbors = [];
    w.waypoints[1].neighbors = [];
    const errors = validateWorldManifest(w).errors;
    expect(errors.some((e) => e.rule === 'navigation' && /unreachable/.test(e.message))).toBe(true);
  });

  // --- collision gate --------------------------------------------------------
  it('collision: requires at least one proxy', () => {
    const w = validWorld();
    w.collision = [];
    expect(rulesOf(w)).toContain('collision');
  });

  it('collision: requires a walkable floor', () => {
    const w = validWorld();
    w.collision = w.collision.filter((c) => c.kind !== 'floor');
    const errors = validateWorldManifest(w).errors;
    expect(errors.some((e) => e.rule === 'collision' && /floor/.test(e.message))).toBe(true);
  });

  it('collision: flags an inverted AABB', () => {
    const w = validWorld();
    w.collision[0].bounds = { min: { x: 10, y: 0, z: 0 }, max: { x: -10, y: 0, z: 0 } };
    expect(rulesOf(w)).toContain('collision');
  });

  // --- interaction gate ------------------------------------------------------
  it('interaction: requires a positive activationRadius', () => {
    const w = validWorld();
    w.interactions[0].activationRadius = 0;
    expect(rulesOf(w)).toContain('interaction');
  });

  it('interaction: flags an interaction reachableFrom a missing waypoint', () => {
    const w = validWorld();
    w.interactions[0].reachableFrom = 'wp-ghost';
    expect(rulesOf(w)).toContain('interaction');
  });

  it('interaction: flags an interaction out of reach of its waypoint', () => {
    const w = validWorld();
    w.interactions[0].activationRadius = 0.1;
    w.interactions[0].bounds = { min: { x: 50, y: 1.4, z: 50 }, max: { x: 50.2, y: 1.8, z: 50.2 } };
    const errors = validateWorldManifest(w).errors;
    expect(errors.some((e) => e.rule === 'interaction' && /out of reach/.test(e.message))).toBe(true);
  });

  // --- audio gate ------------------------------------------------------------
  it('audio: requires 0 <= minDistance < maxDistance', () => {
    const w = validWorld();
    w.emitters[0].maxDistance = 0.5;
    w.emitters[0].minDistance = 1;
    expect(rulesOf(w)).toContain('audio');
  });

  it('audio: requires a source on every emitter', () => {
    const w = validWorld();
    w.emitters[0].source = '';
    expect(rulesOf(w)).toContain('audio');
  });

  // --- effects gate ----------------------------------------------------------
  it('effects: rejects out-of-range intensity', () => {
    const w = validWorld();
    w.effectZones[0].intensity = 1.5;
    expect(rulesOf(w)).toContain('effects');
  });

  it('effects: flags an invalid zone AABB', () => {
    const w = validWorld();
    w.effectZones[0].bounds = { min: { x: 5, y: 0, z: 0 }, max: { x: 2, y: 2, z: 2 } };
    expect(rulesOf(w)).toContain('effects');
  });

  // --- windows gate ----------------------------------------------------------
  it('windows: requires >= 2 tape-window states (wrongness rule)', () => {
    const w = validWorld();
    w.windows = [w.windows[0]];
    expect(rulesOf(w)).toContain('windows');
  });

  it('windows: rejects a non-canonical window', () => {
    const w = validWorld();
    // @ts-expect-error deliberately invalid window for the gate test
    w.windows[1].window = '23:08-23:17';
    expect(rulesOf(w)).toContain('windows');
  });

  it('windows: flags a window referencing a missing waypoint', () => {
    const w = validWorld();
    w.windows[0].activeWaypoints = ['wp-ghost'];
    expect(rulesOf(w)).toContain('windows');
  });

  it('windows: flags a window referencing a missing effect zone', () => {
    const w = validWorld();
    w.windows[0].activeEffectZones = ['zone-ghost'];
    expect(rulesOf(w)).toContain('windows');
  });

  it('windows: requires the start waypoint to be active in some window', () => {
    const w = validWorld();
    w.windows.forEach((s) => {
      s.activeWaypoints = ['wp-marker'];
    });
    const errors = validateWorldManifest(w).errors;
    expect(errors.some((e) => e.rule === 'windows' && /startWaypoint/.test(e.message))).toBe(true);
  });

  it('reports multiple gate failures at once rather than stopping at the first', () => {
    const w = validWorld();
    w.startWaypoint = 'wp-nowhere';
    w.collision = [];
    w.windows = [w.windows[0]];
    const rules = new Set(rulesOf(w));
    expect(rules.has('navigation')).toBe(true);
    expect(rules.has('collision')).toBe(true);
    expect(rules.has('windows')).toBe(true);
    expect(canPromoteToRuntime(w)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createJogWheelState, defaultJogWheelOptions, dragJogWheel, seatNearestDetent, stepJogWheel } from '../engine/jogWheel';
import type { TimeWindow } from '../engine/types';

const twoWindowOptions = { ...defaultJogWheelOptions, discovered: ['23:08-23:17', '23:17-23:26'] as TimeWindow[] };

describe('jog wheel physics', () => {
  it('decays angular velocity with friction inertia', () => {
    const start = { ...createJogWheelState(), velocity: 8, seatedWindow: undefined };
    const after = stepJogWheel(start, 0.25, twoWindowOptions).state;
    expect(after.velocity).toBeGreaterThan(0);
    expect(after.velocity).toBeLessThan(start.velocity);
    expect(after.position).toBeGreaterThan(start.position);
  });

  it('captures discovered windows as magnetic detents', () => {
    const near = { ...createJogWheelState('23:08-23:17', twoWindowOptions), position: 0.99, angle: 0.99 * Math.PI * 1.5, velocity: 0.3, seatedWindow: undefined };
    const result = seatNearestDetent(near, twoWindowOptions);
    expect(result.event).toBe('detent');
    expect(result.state.seatedWindow).toBe('23:17-23:26');
    expect(result.state.position).toBe(1);
  });

  it('rejects locked hard-stop spans and kicks back', () => {
    const start = { ...createJogWheelState('23:17-23:26', twoWindowOptions), position: 1.98, angle: 1.98 * Math.PI * 1.5, velocity: 5, seatedWindow: undefined };
    const result = stepJogWheel(start, 0.1, twoWindowOptions);
    expect(result.event).toBe('hard-stop');
    expect(result.state.position).toBeLessThan(2);
    expect(result.state.velocity).toBeLessThan(0);
    expect(result.state.strain).toBe(1);
  });

  it('uses pointer drag delta as wheel angular velocity', () => {
    const result = dragJogWheel(createJogWheelState(), Math.PI / 2, 0.1, twoWindowOptions);
    expect(result.state.velocity).toBeGreaterThan(0);
    expect(result.state.position).toBeGreaterThan(0);
  });
});

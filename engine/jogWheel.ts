import type { TimeWindow } from './types';
import { DEFAULT_TIME_WINDOW, lockedByDefaultWindows, timeWindowPositions } from './timeWindows';

export interface JogWheelState {
  angle: number;
  velocity: number;
  position: number;
  seatedWindow?: TimeWindow;
  strain: number;
}

export interface JogWheelOptions {
  friction: number;
  detentStrength: number;
  detentRadius: number;
  hardStopPosition: number;
  windows: Record<TimeWindow, number>;
  discovered: TimeWindow[];
  locked: TimeWindow[];
}

export interface JogWheelStepResult {
  state: JogWheelState;
  event?: 'detent' | 'hard-stop';
}

export const defaultJogWheelOptions: JogWheelOptions = {
  friction: 0.88,
  detentStrength: 0.42,
  detentRadius: 0.085,
  hardStopPosition: 2,
  windows: timeWindowPositions,
  discovered: [DEFAULT_TIME_WINDOW],
  locked: [...lockedByDefaultWindows],
};

export function createJogWheelState(window: TimeWindow = DEFAULT_TIME_WINDOW, options = defaultJogWheelOptions): JogWheelState {
  return { angle: options.windows[window] * Math.PI * 1.5, velocity: 0, position: options.windows[window], seatedWindow: window, strain: 0 };
}

export function dragJogWheel(state: JogWheelState, deltaAngle: number, deltaSeconds: number, options = defaultJogWheelOptions): JogWheelStepResult {
  const safeDelta = Math.max(1 / 120, deltaSeconds);
  // The pointer moves the wheel directly; velocity is stored only as release
  // inertia. Integrating it again in the same frame would make the wheel
  // outrun the finger almost 2:1.
  const moved: JogWheelState = { ...state, angle: state.angle + deltaAngle, velocity: 0, seatedWindow: undefined };
  const result = stepJogWheel(moved, safeDelta, options);
  if (result.event === 'hard-stop') {
    return result;
  }
  return { ...result, state: { ...result.state, velocity: deltaAngle / safeDelta } };
}

export function stepJogWheel(state: JogWheelState, deltaSeconds: number, options = defaultJogWheelOptions): JogWheelStepResult {
  const next: JogWheelState = { ...state };
  next.velocity *= Math.pow(options.friction, deltaSeconds * 60);
  next.angle += next.velocity * deltaSeconds;
  next.position = next.angle / (Math.PI * 1.5);
  next.strain = Math.max(0, next.strain * 0.78);

  const detentPositions = Object.values(options.windows);
  const minPosition = Math.min(...detentPositions);
  const maxPosition = Math.max(...detentPositions);
  const hardStopLocked = options.locked.some((window) => options.windows[window] >= options.hardStopPosition);

  if (hardStopLocked && next.position >= options.hardStopPosition) {
    next.position = options.hardStopPosition - 0.035;
    next.angle = next.position * Math.PI * 1.5;
    next.velocity = -Math.abs(next.velocity) * 0.55 - 0.8;
    next.seatedWindow = undefined;
    next.strain = 1;
    return { state: next, event: 'hard-stop' };
  }

  // Soft end stops: once the final window is unlocked the wheel no longer
  // kicks back, but it cannot be wound past the tape either.
  if (next.position > maxPosition + 0.05) {
    next.position = maxPosition + 0.05;
    next.angle = next.position * Math.PI * 1.5;
    next.velocity = 0;
  } else if (next.position < minPosition - 0.05) {
    next.position = minPosition - 0.05;
    next.angle = next.position * Math.PI * 1.5;
    next.velocity = 0;
  }

  const detent = nearestDiscoveredDetent(next.position, options);
  if (detent && Math.abs(next.position - detent.position) <= options.detentRadius && Math.abs(next.velocity) < 1.9) {
    next.position += (detent.position - next.position) * options.detentStrength;
    next.angle = next.position * Math.PI * 1.5;
    next.velocity *= 0.42;
    if (Math.abs(next.position - detent.position) < 0.018) {
      next.position = detent.position;
      next.angle = next.position * Math.PI * 1.5;
      next.velocity = 0;
      next.seatedWindow = detent.window;
      return { state: next, event: 'detent' };
    }
  }

  return { state: next };
}

export function seatNearestDetent(state: JogWheelState, options = defaultJogWheelOptions): JogWheelStepResult {
  const detent = nearestDiscoveredDetent(state.position, options);
  if (!detent) {
    return { state };
  }
  return { state: { ...state, position: detent.position, angle: detent.position * Math.PI * 1.5, velocity: 0, seatedWindow: detent.window, strain: 0 }, event: 'detent' };
}

function nearestDiscoveredDetent(position: number, options: JogWheelOptions): { window: TimeWindow; position: number } | undefined {
  return options.discovered
    .filter((window) => !options.locked.includes(window))
    .map((window) => ({ window, position: options.windows[window] }))
    .sort((a, b) => Math.abs(position - a.position) - Math.abs(position - b.position))[0];
}

import type { TimeWindow } from './types';

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
  windows: {
    '23:08-23:17': 0,
    '23:17-23:26': 1,
    '23:26-23:35': 2,
  },
  discovered: ['23:08-23:17'],
  locked: ['23:26-23:35'],
};

export function createJogWheelState(window: TimeWindow = '23:08-23:17', options = defaultJogWheelOptions): JogWheelState {
  return { angle: options.windows[window] * Math.PI * 1.5, velocity: 0, position: options.windows[window], seatedWindow: window, strain: 0 };
}

export function dragJogWheel(state: JogWheelState, deltaAngle: number, deltaSeconds: number, options = defaultJogWheelOptions): JogWheelStepResult {
  const safeDelta = Math.max(1 / 120, deltaSeconds);
  return stepJogWheel({ ...state, angle: state.angle + deltaAngle, velocity: deltaAngle / safeDelta, seatedWindow: undefined }, safeDelta, options);
}

export function stepJogWheel(state: JogWheelState, deltaSeconds: number, options = defaultJogWheelOptions): JogWheelStepResult {
  const next: JogWheelState = { ...state };
  next.velocity *= Math.pow(options.friction, deltaSeconds * 60);
  next.angle += next.velocity * deltaSeconds;
  next.position = next.angle / (Math.PI * 1.5);
  next.strain = Math.max(0, next.strain * 0.78);

  if (next.position >= options.hardStopPosition) {
    next.position = options.hardStopPosition - 0.035;
    next.angle = next.position * Math.PI * 1.5;
    next.velocity = -Math.abs(next.velocity) * 0.55 - 0.8;
    next.seatedWindow = undefined;
    next.strain = 1;
    return { state: next, event: 'hard-stop' };
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

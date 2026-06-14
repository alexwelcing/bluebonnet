export type ControlDefinition = ButtonDefinition | FaderDefinition | WheelDefinition | DigitWheelDefinition | KnockSequenceDefinition;

export type ButtonDefinition = {
  id: string;
  kind: 'button';
  releaseMs?: number;
  animation?: string;
  audio?: string;
};

export type FaderDefinition = {
  id: string;
  kind: 'fader';
  min: number;
  max: number;
  value: number;
  detents?: number[];
  animation?: string;
};

export type WheelDetent = { id: string; position: number; locked?: boolean };

export type WheelDefinition = {
  id: string;
  kind: 'wheel';
  min: number;
  max: number;
  position: number;
  detents?: WheelDetent[];
  animation?: string;
};

export type DigitWheelDefinition = {
  id: string;
  kind: 'digitWheel';
  min: number;
  max: number;
  value: number;
  animation?: string;
};

export type KnockSequenceDefinition = {
  id: string;
  kind: 'knockSequence';
  animation?: string;
};

export type ControlState = ButtonState | FaderState | WheelState | DigitWheelState | KnockSequenceState;

export type ButtonState = {
  kind: 'button';
  pressed: boolean;
  phase: 'idle' | 'down' | 'release';
  elapsedMs: number;
  releaseMs: number;
};

export type FaderState = {
  kind: 'fader';
  value: number;
  normalized: number;
  phase: 'idle' | 'moving';
  settleMs: number;
};

export type WheelState = {
  kind: 'wheel';
  position: number;
  phase: 'idle' | 'turning' | 'seated' | 'refusing';
  activeDetent?: string;
};

export type DigitWheelState = {
  kind: 'digitWheel';
  value: number;
  phase: 'idle' | 'tumbling';
  settleMs: number;
};

export type KnockSequenceState = {
  kind: 'knockSequence';
  groups: number[];
  phase: 'idle' | 'knocking' | 'resting' | 'playing' | 'cleared';
};

export type ControlUiEvent =
  | { type: 'press'; id: string }
  | { type: 'setValue'; id: string; value: number }
  | { type: 'rotate'; id: string; delta: number }
  | { type: 'seat'; id: string }
  | { type: 'step'; id: string; delta: number }
  | { type: 'knock'; id: string }
  | { type: 'rest'; id: string }
  | { type: 'play'; id: string }
  | { type: 'clear'; id: string };

export type ControlUiIntent =
  | { type: 'animation'; controlId: string; name: string; input: string; value: number | boolean }
  | { type: 'audio'; controlId: string; cue: string };

export type ControlUiSnapshot = { controls: Record<string, ControlState> };

export type ControlUiEngine = {
  dispatch(event: ControlUiEvent): void;
  tick(ms: number): void;
  snapshot(): ControlUiSnapshot;
  drainIntents(): ControlUiIntent[];
};

type StoredControl =
  | { definition: ButtonDefinition; state: ButtonState }
  | { definition: FaderDefinition; state: FaderState }
  | { definition: WheelDefinition; state: WheelState }
  | { definition: DigitWheelDefinition; state: DigitWheelState }
  | { definition: KnockSequenceDefinition; state: KnockSequenceState };

const FADER_SETTLE_MS = 260;
const DIGIT_SETTLE_MS = 180;

export function createControlUiEngine(config: { controls: ControlDefinition[] }): ControlUiEngine {
  const controls = new Map<string, StoredControl>();
  let intents: ControlUiIntent[] = [];

  for (const definition of config.controls) {
    controls.set(definition.id, createStoredControl(definition));
  }

  const emitAnimation = (controlId: string, name: string | undefined, input: string, value: number | boolean) => {
    if (name) intents.push({ type: 'animation', controlId, name, input, value });
  };

  const emitAudio = (controlId: string, cue: string | undefined) => {
    if (cue) intents.push({ type: 'audio', controlId, cue });
  };

  return {
    dispatch(event) {
      const control = controls.get(event.id);
      if (!control) return;

      if (event.type === 'press' && control.definition.kind === 'button' && control.state.kind === 'button') {
        control.state.pressed = true;
        control.state.phase = 'down';
        control.state.elapsedMs = 0;
        emitAnimation(event.id, control.definition.animation, 'press', true);
        emitAudio(event.id, control.definition.audio);
        return;
      }

      if (event.type === 'setValue' && control.definition.kind === 'fader' && control.state.kind === 'fader') {
        const previous = control.state.value;
        const next = clamp(event.value, control.definition.min, control.definition.max);
        control.state.value = next;
        control.state.normalized = normalize(next, control.definition.min, control.definition.max);
        control.state.phase = 'moving';
        control.state.settleMs = 0;
        emitAnimation(event.id, control.definition.animation, 'value', control.state.normalized);
        if (crossedAnyDetent(previous, next, control.definition.detents ?? [])) {
          emitAudio(event.id, 'detent-cross');
        }
        return;
      }

      if (event.type === 'rotate' && control.definition.kind === 'wheel' && control.state.kind === 'wheel') {
        const requested = clamp(control.state.position + event.delta, control.definition.min, control.definition.max);
        const locked = nearestDetent(requested, control.definition.detents ?? [])?.locked;
        if (locked) {
          control.state.phase = 'refusing';
          emitAnimation(event.id, control.definition.animation, 'strain', 1);
          emitAudio(event.id, 'hard-stop');
          return;
        }
        control.state.position = requested;
        control.state.phase = 'turning';
        const active = nearestDetent(requested, control.definition.detents ?? []);
        control.state.activeDetent = active?.id;
        emitAnimation(event.id, control.definition.animation, 'position', requested);
        return;
      }

      if (event.type === 'seat' && control.definition.kind === 'wheel' && control.state.kind === 'wheel') {
        const detent = nearestDetent(control.state.position, control.definition.detents ?? []);
        if (!detent) return;
        if (detent.locked) {
          control.state.phase = 'refusing';
          emitAnimation(event.id, control.definition.animation, 'strain', 1);
          emitAudio(event.id, 'hard-stop');
          return;
        }
        control.state.position = detent.position;
        control.state.activeDetent = detent.id;
        control.state.phase = 'seated';
        emitAnimation(event.id, control.definition.animation, 'position', detent.position);
        emitAudio(event.id, 'detent-clunk');
        return;
      }

      if (event.type === 'step' && control.definition.kind === 'digitWheel' && control.state.kind === 'digitWheel') {
        control.state.value = wrap(control.state.value + event.delta, control.definition.min, control.definition.max);
        control.state.phase = 'tumbling';
        control.state.settleMs = 0;
        emitAnimation(event.id, control.definition.animation, 'step', event.delta);
        emitAudio(event.id, 'wheel-click');
        return;
      }

      if (control.definition.kind === 'knockSequence' && control.state.kind === 'knockSequence') {
        if (event.type === 'knock') {
          if (control.state.groups.length === 0) control.state.groups.push(0);
          control.state.groups[control.state.groups.length - 1] += 1;
          control.state.phase = 'knocking';
          emitAnimation(event.id, control.definition.animation, 'knock', control.state.groups[control.state.groups.length - 1]);
          emitAudio(event.id, 'pipe-knock');
        }
        if (event.type === 'rest') {
          if ((control.state.groups.at(-1) ?? 0) > 0) control.state.groups.push(0);
          control.state.phase = 'resting';
          emitAnimation(event.id, control.definition.animation, 'rest', true);
        }
        if (event.type === 'clear') {
          control.state.groups = [0];
          control.state.phase = 'cleared';
          emitAnimation(event.id, control.definition.animation, 'clear', true);
        }
        if (event.type === 'play') {
          control.state.groups = control.state.groups.filter((group) => group > 0);
          control.state.phase = 'playing';
          emitAnimation(event.id, control.definition.animation, 'play', true);
        }
      }
    },

    tick(ms) {
      for (const control of controls.values()) {
        if (control.definition.kind === 'button' && control.state.kind === 'button' && control.state.pressed) {
          control.state.elapsedMs += ms;
          if (control.state.elapsedMs >= control.state.releaseMs) {
            control.state.pressed = false;
            control.state.phase = 'release';
            emitAnimation(control.definition.id, control.definition.animation, 'press', false);
          }
        }
        if (control.definition.kind === 'fader' && control.state.kind === 'fader' && control.state.phase === 'moving') {
          control.state.settleMs += ms;
          if (control.state.settleMs >= FADER_SETTLE_MS) {
            control.state.phase = 'idle';
          }
        }
        if (control.definition.kind === 'digitWheel' && control.state.kind === 'digitWheel' && control.state.phase === 'tumbling') {
          control.state.settleMs += ms;
          if (control.state.settleMs >= DIGIT_SETTLE_MS) {
            control.state.phase = 'idle';
          }
        }
      }
    },

    snapshot() {
      return {
        controls: Object.fromEntries([...controls.entries()].map(([id, control]) => [id, cloneState(control.state)])),
      };
    },

    drainIntents() {
      const drained = intents;
      intents = [];
      return drained;
    },
  };
}

function createStoredControl(definition: ControlDefinition): StoredControl {
  if (definition.kind === 'button') {
    return {
      definition,
      state: { kind: 'button', pressed: false, phase: 'idle', elapsedMs: 0, releaseMs: definition.releaseMs ?? 160 },
    };
  }
  if (definition.kind === 'fader') {
    return {
      definition,
      state: {
        kind: 'fader',
        value: clamp(definition.value, definition.min, definition.max),
        normalized: normalize(definition.value, definition.min, definition.max),
        phase: 'idle',
        settleMs: 0,
      },
    };
  }
  if (definition.kind === 'digitWheel') {
    return {
      definition,
      state: { kind: 'digitWheel', value: wrap(definition.value, definition.min, definition.max), phase: 'idle', settleMs: 0 },
    };
  }
  if (definition.kind === 'knockSequence') {
    return {
      definition,
      state: { kind: 'knockSequence', groups: [0], phase: 'idle' },
    };
  }
  const activeDetent = nearestDetent(definition.position, definition.detents ?? [])?.id;
  return {
    definition,
    state: { kind: 'wheel', position: clamp(definition.position, definition.min, definition.max), phase: 'idle', activeDetent },
  };
}

function cloneState(state: ControlState): ControlState {
  return state.kind === 'knockSequence' ? { ...state, groups: [...state.groups] } : { ...state };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (clamp(value, min, max) - min) / (max - min);
}

function crossedAnyDetent(previous: number, next: number, detents: number[]): boolean {
  const low = Math.min(previous, next);
  const high = Math.max(previous, next);
  return detents.some((detent) => detent >= low && detent <= high && previous !== next);
}

function wrap(value: number, min: number, max: number): number {
  const span = max - min + 1;
  return ((((value - min) % span) + span) % span) + min;
}

function nearestDetent(position: number, detents: WheelDetent[]): WheelDetent | undefined {
  return detents.reduce<WheelDetent | undefined>((nearest, detent) => {
    if (!nearest) return detent;
    return Math.abs(detent.position - position) < Math.abs(nearest.position - position) ? detent : nearest;
  }, undefined);
}

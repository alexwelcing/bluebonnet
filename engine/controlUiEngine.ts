export type ControlDefinition = ButtonDefinition | FaderDefinition | WheelDefinition;

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

export type ControlState = ButtonState | FaderState | WheelState;

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
  phase: 'idle' | 'turning' | 'refusing';
  activeDetent?: string;
};

export type ControlUiEvent =
  | { type: 'press'; id: string }
  | { type: 'setValue'; id: string; value: number }
  | { type: 'rotate'; id: string; delta: number };

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
  | { definition: WheelDefinition; state: WheelState };

const FADER_SETTLE_MS = 260;

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
      }
    },

    snapshot() {
      return {
        controls: Object.fromEntries([...controls.entries()].map(([id, control]) => [id, { ...control.state }])),
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
  const activeDetent = nearestDetent(definition.position, definition.detents ?? [])?.id;
  return {
    definition,
    state: { kind: 'wheel', position: clamp(definition.position, definition.min, definition.max), phase: 'idle', activeDetent },
  };
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
  return detents.some((detent) => detent > low && detent <= high);
}

function nearestDetent(position: number, detents: WheelDetent[]): WheelDetent | undefined {
  return detents.reduce<WheelDetent | undefined>((nearest, detent) => {
    if (!nearest) return detent;
    return Math.abs(detent.position - position) < Math.abs(nearest.position - position) ? detent : nearest;
  }, undefined);
}

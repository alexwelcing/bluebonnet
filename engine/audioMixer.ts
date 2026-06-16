// BLUEBONNET audio engine.
//
// Everything the *world* makes passes through the tape: a Web Audio chain of
// band-limiting, hiss, and wow & flutter driven by the TRACKING knob, so the
// player's one fidelity control governs sound and picture together. Deck
// cues (transport clunks) stay dry — they are the machine in the room, not
// the recording. Where Web Audio is unavailable (jsdom, ancient browsers)
// the engine falls back to plain media elements with identical bookkeeping.

/**
 * Synthesized deck foley — the machine in the room, not the recording. Each kind
 * is a procedurally generated transient (no asset fetch), so the signature control
 * UI has a real tactile vocabulary: a button press is not a fader detent is not a
 * padlock falling open. Deck foley is dry (→ master); world sound stays on the tape.
 */
export type FoleyKind =
  | 'button'
  | 'button-release'
  | 'tick'
  | 'detent'
  | 'detent-heavy'
  | 'latch'
  | 'latch-open'
  | 'refuse';

export interface EventOptions {
  gain?: number;
  /** Static stereo position -1..1; when panTo is set, sweeps pan → panTo. */
  pan?: number;
  panTo?: number;
  /** Route through the tunnel convolver (culvert spaces). */
  reverb?: boolean;
  caption?: string;
}

export interface AudioMixer {
  setAmbient(source: string | undefined, ambientLevel?: number): void;
  playCue(source: string, caption?: string, gain?: number): void;
  /** Synthesized deck control foley — no asset, dry, distinct per gesture. */
  playFoley(kind: FoleyKind, caption?: string, gain?: number): void;
  playEvent(source: string, options?: EventOptions): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
  /** TRACKING → tape fidelity: bandwidth, hiss, flutter. */
  setTapeCondition(intensity: number): void;
  /** Brief signal loss (paired with the visual tracking slip). */
  dropout(): void;
  /** Duck the world (transitions, broadcasts); restore with duck(1). */
  duck(level: number, seconds?: number): void;
  unlock(): void;
  isMuted(): boolean;
  currentSource(): string | undefined;
  snapshot(): AudioMixerSnapshot;
}

export interface AudioMixerSnapshot {
  current?: string;
  previous?: string;
  fadeProgress: number;
  volume: number;
  ambientLevel: number;
  muted: boolean;
  tapeIntensity: number;
  cues: { source: string; caption?: string }[];
}

const FADE_SECONDS = 1.2;

export function createAudioMixer(): AudioMixer {
  // --- bookkeeping (identical in both paths; the test contract) -------------
  let current: string | undefined;
  let previous: string | undefined;
  let fadeProgress = 1;
  let muted = false;
  let volume = 0.7;
  let ambientLevel = 1;
  let tapeIntensity = 0.4;
  const cues: { source: string; caption?: string }[] = [];

  const webAudio = typeof AudioContext !== 'undefined' ? createWebAudioBackend() : undefined;
  const fallback = !webAudio && typeof Audio !== 'undefined' ? createElementBackend() : undefined;

  function backendSetAmbient(): void {
    (webAudio ?? fallback)?.setAmbient(current, appliedAmbientGain());
  }
  function appliedAmbientGain(): number {
    return muted ? 0 : volume * ambientLevel;
  }

  return {
    setAmbient(nextSource: string | undefined, nextAmbientLevel = 1) {
      const clampedLevel = clampUnit(nextAmbientLevel, 1);
      if (nextSource === current) {
        ambientLevel = clampedLevel;
        (webAudio ?? fallback)?.setAmbientGain(appliedAmbientGain());
        return;
      }
      previous = current;
      current = nextSource;
      ambientLevel = clampedLevel;
      fadeProgress = previous && current ? 0 : 1;
      backendSetAmbient();
      if (fadeProgress < 1) {
        // bookkeeping fade for snapshot consumers; audio fades in-backend
        const startedAt = Date.now();
        const tick = () => {
          fadeProgress = Math.min(1, (Date.now() - startedAt) / (FADE_SECONDS * 1000));
          if (fadeProgress >= 1) previous = undefined;
          else setTimeout(tick, 60);
        };
        setTimeout(tick, 60);
      }
    },
    playCue(source: string, caption?: string, gain = 1) {
      cues.push({ source, caption });
      if (muted) return;
      (webAudio ?? fallback)?.playCue(source, clampUnit(volume * gain, 0.7));
    },
    playFoley(kind: FoleyKind, caption?: string, gain = 1) {
      cues.push({ source: `foley:${kind}`, caption });
      if (muted) return;
      // Synthesis needs Web Audio; the element fallback (jsdom) keeps the deck
      // quiet but the cue is already logged for captions and the test contract.
      webAudio?.playFoley(kind, clampUnit(volume * gain, 0.7));
    },
    playEvent(source: string, options: EventOptions = {}) {
      cues.push({ source, caption: options.caption });
      if (muted) return;
      const gain = clampUnit(volume * (options.gain ?? 1), 0.7);
      if (webAudio) webAudio.playEvent(source, gain, options);
      else fallback?.playCue(source, gain);
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      (webAudio ?? fallback)?.setAmbientGain(appliedAmbientGain());
    },
    setVolume(nextVolume: number) {
      volume = clampUnit(nextVolume, 0.7);
      (webAudio ?? fallback)?.setAmbientGain(appliedAmbientGain());
      webAudio?.setMasterGain(volume);
    },
    setTapeCondition(intensity: number) {
      tapeIntensity = clampUnit(intensity, 0.4);
      webAudio?.setTapeCondition(tapeIntensity);
    },
    dropout() {
      webAudio?.dropout();
    },
    duck(level: number, seconds = 0.4) {
      webAudio?.duck(clampUnit(level, 1), seconds);
    },
    unlock() {
      (webAudio ?? fallback)?.unlock();
    },
    isMuted: () => muted,
    currentSource: () => current,
    snapshot: () => ({ current, previous, fadeProgress, volume, ambientLevel, muted, tapeIntensity, cues: [...cues] }),
  };
}

// --- Web Audio backend --------------------------------------------------------

interface AmbientSlot {
  source: AudioBufferSourceNode;
  gain: GainNode;
  flutter: OscillatorNode;
  flutterDepth: GainNode;
}

function createWebAudioBackend() {
  let context: AudioContext | undefined;
  let master: GainNode;
  let tape: GainNode; // the world bus — everything recorded passes through
  let tapeFilter: BiquadFilterNode;
  let hiss: GainNode;
  let convolver: ConvolverNode;
  let duckGain: GainNode;
  let activeSlot: AmbientSlot | undefined;
  let pendingAmbient: { src?: string; gain: number } | undefined;
  let unlocked = false;
  let condition = 0.4;
  const buffers = new Map<string, Promise<AudioBuffer>>();

  function ensureContext(): AudioContext | undefined {
    if (!unlocked) return undefined;
    if (context) return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 1;
    master.connect(context.destination);
    duckGain = context.createGain();
    duckGain.connect(master);
    tapeFilter = context.createBiquadFilter();
    tapeFilter.type = 'lowpass';
    tapeFilter.connect(duckGain);
    tape = context.createGain();
    tape.connect(tapeFilter);
    // tunnel impulse: synthesized decaying noise — no asset required
    convolver = context.createConvolver();
    convolver.buffer = makeImpulse(context, 1.4, 2.4);
    convolver.connect(tape);
    // tape hiss bed
    const hissSource = context.createBufferSource();
    hissSource.buffer = makeNoise(context, 2);
    hissSource.loop = true;
    hiss = context.createGain();
    hiss.gain.value = 0;
    hissSource.connect(hiss);
    hiss.connect(tapeFilter);
    hissSource.start();
    applyCondition();
    if (pendingAmbient) {
      const { src, gain } = pendingAmbient;
      pendingAmbient = undefined;
      setAmbient(src, gain);
    }
    return context;
  }

  function applyCondition() {
    if (!context) return;
    // 0 = clean dub (16 kHz, no hiss, steady); 1 = dying tape (3.5 kHz,
    // audible hiss, ±0.7% flutter).
    tapeFilter.frequency.setTargetAtTime(16000 - condition * 12500, context.currentTime, 0.1);
    hiss.gain.setTargetAtTime(condition * 0.045, context.currentTime, 0.2);
    if (activeSlot) activeSlot.flutterDepth.gain.setTargetAtTime(condition * 0.007, context.currentTime, 0.2);
  }

  async function load(src: string): Promise<AudioBuffer> {
    if (!buffers.has(src)) {
      buffers.set(src, fetch(src).then((response) => response.arrayBuffer()).then((data) => context!.decodeAudioData(data)));
    }
    return buffers.get(src)!;
  }

  function makeSlot(buffer: AudioBuffer): AmbientSlot {
    const source = context!.createBufferSource();
    source.buffer = buffer;
    source.loop = true; // sample-accurate: the seam problem ends here
    const gain = context!.createGain();
    gain.gain.value = 0;
    const flutter = context!.createOscillator();
    flutter.frequency.value = 0.7 + Math.random() * 2.4;
    const flutterDepth = context!.createGain();
    flutterDepth.gain.value = condition * 0.007;
    flutter.connect(flutterDepth);
    flutterDepth.connect(source.playbackRate);
    source.connect(gain);
    gain.connect(tape);
    source.start();
    flutter.start();
    return { source, gain, flutter, flutterDepth };
  }

  function equalPowerFade(slotIn: AmbientSlot | undefined, slotOut: AmbientSlot | undefined, targetGain: number) {
    const t = context!.currentTime;
    const steps = 24;
    if (slotIn) {
      const curve = new Float32Array(steps);
      for (let i = 0; i < steps; i++) curve[i] = Math.sin(((i / (steps - 1)) * Math.PI) / 2) * targetGain;
      slotIn.gain.gain.cancelScheduledValues(t);
      slotIn.gain.gain.setValueCurveAtTime(curve, t, FADE_SECONDS);
    }
    if (slotOut) {
      const curve = new Float32Array(steps);
      const from = slotOut.gain.gain.value;
      for (let i = 0; i < steps; i++) curve[i] = Math.cos(((i / (steps - 1)) * Math.PI) / 2) * from;
      slotOut.gain.gain.cancelScheduledValues(t);
      slotOut.gain.gain.setValueCurveAtTime(curve, t, FADE_SECONDS);
      const dying = slotOut;
      setTimeout(() => {
        try {
          dying.source.stop();
          dying.flutter.stop();
        } catch {
          // already stopped
        }
      }, FADE_SECONDS * 1000 + 100);
    }
  }

  function setAmbient(src: string | undefined, gain: number) {
    if (!ensureContext()) {
      pendingAmbient = { src, gain };
      return;
    }
    const outgoing = activeSlot;
    activeSlot = undefined;
    if (src) {
      void load(src).then((buffer) => {
        const slot = makeSlot(buffer);
        activeSlot = slot;
        equalPowerFade(slot, outgoing, gain);
      });
    } else if (outgoing) {
      equalPowerFade(undefined, outgoing, 0);
    }
  }

  return {
    unlock() {
      unlocked = true;
      ensureContext();
      void context?.resume();
    },
    setAmbient,
    setAmbientGain(gain: number) {
      if (context && activeSlot) activeSlot.gain.gain.setTargetAtTime(gain, context.currentTime, 0.15);
      else if (pendingAmbient) pendingAmbient.gain = gain;
    },
    setMasterGain(gain: number) {
      if (context) master.gain.setTargetAtTime(gain, context.currentTime, 0.1);
    },
    setTapeCondition(intensity: number) {
      condition = intensity;
      applyCondition();
    },
    playCue(src: string, gain: number) {
      if (!ensureContext()) return;
      void load(src).then((buffer) => {
        const source = context!.createBufferSource();
        source.buffer = buffer;
        const g = context!.createGain();
        g.gain.value = gain;
        source.connect(g);
        g.connect(master); // dry: the deck itself, not the recording
        source.start();
      });
    },
    playFoley(kind: FoleyKind, gain: number) {
      if (!ensureContext()) return;
      synthFoley(context!, master, kind, gain);
    },
    playEvent(src: string, gain: number, options: EventOptions) {
      if (!ensureContext()) return;
      void load(src).then((buffer) => {
        const source = context!.createBufferSource();
        source.buffer = buffer;
        const g = context!.createGain();
        g.gain.value = gain;
        const panner = context!.createStereoPanner();
        const pan = options.pan ?? (Math.random() * 0.8 - 0.4);
        panner.pan.value = pan;
        if (options.panTo !== undefined) {
          panner.pan.linearRampToValueAtTime(options.panTo, context!.currentTime + buffer.duration);
        }
        source.connect(g);
        g.connect(panner);
        panner.connect(options.reverb ? convolver : tape);
        source.start();
      });
    },
    dropout() {
      if (!context) return;
      const t = context.currentTime;
      tape.gain.cancelScheduledValues(t);
      tape.gain.setValueAtTime(tape.gain.value, t);
      tape.gain.linearRampToValueAtTime(0.04, t + 0.06);
      tape.gain.linearRampToValueAtTime(1, t + 0.42);
    },
    duck(level: number, seconds: number) {
      if (!context) return;
      duckGain.gain.setTargetAtTime(level, context.currentTime, seconds);
    },
  };
}

// --- deck foley synthesis -----------------------------------------------------
//
// Every deck control gets its own transient instead of one shared clunk. A foley
// hit is built from two ingredients scheduled against a dry destination: a
// band-passed noise *tick* (the contact transient) and a fast-decaying *body*
// (the mass behind it). Composing them differently is the whole vocabulary.

let foleyNoiseBuffer: AudioBuffer | undefined;
function foleyNoise(context: AudioContext): AudioBuffer {
  if (!foleyNoiseBuffer || foleyNoiseBuffer.sampleRate !== context.sampleRate) {
    foleyNoiseBuffer = makeNoise(context, 0.3);
  }
  return foleyNoiseBuffer;
}

function foleyTick(
  context: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  q: number,
  dur: number,
  level: number,
): void {
  const src = context.createBufferSource();
  src.buffer = foleyNoise(context);
  const bp = context.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = context.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), when + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(dest);
  src.start(when);
  src.stop(when + dur + 0.02);
}

function foleyBody(
  context: AudioContext,
  dest: AudioNode,
  when: number,
  freq: number,
  dur: number,
  level: number,
  type: OscillatorType = 'triangle',
): void {
  const osc = context.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.55, 20), when + dur);
  const g = context.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(Math.max(level, 0.0002), when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(g);
  g.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

function synthFoley(context: AudioContext, dest: AudioNode, kind: FoleyKind, gain: number): void {
  const t = context.currentTime + 0.001;
  const v = Math.max(0, Math.min(1, gain));
  switch (kind) {
    case 'button': // a switch pressed: bright contact + a little mass
      foleyTick(context, dest, t, 2200, 6, 0.05, 0.5 * v);
      foleyBody(context, dest, t, 150, 0.09, 0.5 * v);
      break;
    case 'button-release': // the spring returns: higher, quieter, shorter
      foleyTick(context, dest, t, 3000, 8, 0.03, 0.28 * v);
      foleyBody(context, dest, t, 190, 0.05, 0.22 * v);
      break;
    case 'tick': // a fader notch / wheel cross: a single light grain
      foleyTick(context, dest, t, 2600, 9, 0.025, 0.35 * v);
      break;
    case 'detent': // a knock seated solidly
      foleyTick(context, dest, t, 1800, 5, 0.04, 0.5 * v);
      foleyBody(context, dest, t, 130, 0.07, 0.45 * v);
      break;
    case 'detent-heavy': // the jog wheel clunks home: low and weighty
      foleyTick(context, dest, t, 1400, 4, 0.06, 0.6 * v);
      foleyBody(context, dest, t, 95, 0.13, 0.6 * v, 'sine');
      break;
    case 'latch': // an over-centre toggle: two clicks snapping past each other
      foleyTick(context, dest, t, 2400, 7, 0.02, 0.4 * v);
      foleyTick(context, dest, t + 0.028, 3200, 9, 0.02, 0.5 * v);
      foleyBody(context, dest, t + 0.028, 170, 0.06, 0.3 * v);
      break;
    case 'latch-open': // a padlock giving way: shackle ting → spring → body fall
      foleyTick(context, dest, t, 4200, 12, 0.05, 0.45 * v);
      foleyBody(context, dest, t, 900, 0.12, 0.18 * v, 'sine');
      foleyTick(context, dest, t + 0.06, 1600, 3, 0.12, 0.3 * v);
      foleyBody(context, dest, t + 0.16, 110, 0.18, 0.5 * v, 'sine');
      break;
    case 'refuse': // it will not move: a dead, damped non-event, no bright contact
      foleyTick(context, dest, t, 300, 1.2, 0.05, 0.18 * v);
      foleyBody(context, dest, t, 78, 0.16, 0.5 * v, 'sine');
      break;
  }
}

function makeNoise(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(2, context.sampleRate * seconds, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
  }
  return buffer;
}

function makeImpulse(context: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = context.sampleRate * seconds;
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// --- element fallback (jsdom, no Web Audio) -----------------------------------

function createElementBackend() {
  let element: HTMLAudioElement | undefined;
  let unlocked = false;

  return {
    unlock() {
      unlocked = true;
      if (element?.paused) tryPlay(element);
    },
    setAmbient(src: string | undefined, gain: number) {
      try {
        element?.pause();
      } catch {
        // best effort
      }
      element = undefined;
      if (src) {
        element = new Audio(src);
        element.loop = true;
        element.volume = clampUnit(gain, 0);
        if (unlocked) tryPlay(element);
      }
    },
    setAmbientGain(gain: number) {
      if (element) element.volume = clampUnit(gain, 0);
    },
    setMasterGain() {
      // master gain folds into ambient gain in this path
    },
    setTapeCondition() {
      // no processing chain without Web Audio
    },
    playCue(src: string, gain: number) {
      try {
        const cue = new Audio(src);
        cue.volume = gain;
        tryPlay(cue);
      } catch {
        // non-essential
      }
    },
  };
}

function tryPlay(element: HTMLAudioElement) {
  try {
    const result = element.play();
    if (result && typeof result.catch === 'function') void result.catch(() => undefined);
  } catch {
    // jsdom / autoplay restriction
  }
}

export function stepCrossfade(snapshot: AudioMixerSnapshot, deltaSeconds: number, durationSeconds = 1.2): AudioMixerSnapshot {
  const fadeProgress = Math.min(1, snapshot.fadeProgress + Math.max(0, deltaSeconds) / durationSeconds);
  return { ...snapshot, previous: fadeProgress >= 1 ? undefined : snapshot.previous, fadeProgress };
}

function clampUnit(value: number, fallback: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : fallback));
}

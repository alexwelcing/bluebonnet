export interface AudioMixer {
  setAmbient(source: string | undefined, ambientLevel?: number): void;
  playCue(source: string, caption?: string): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
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
  cues: { source: string; caption?: string }[];
}

const FADE_SECONDS = 1.2;
const FADE_TICK_MS = 60;

export function createAudioMixer(): AudioMixer {
  let current: string | undefined;
  let previous: string | undefined;
  let fadeProgress = 1;
  let muted = false;
  let volume = 0.7;
  let ambientLevel = 1;
  const cues: { source: string; caption?: string }[] = [];

  // Playback backend. Ambient loops cannot start before a user gesture
  // (browser autoplay policy), so they stay paused until unlock() — wired
  // to the INSERT TAPE button.
  const hasPlayback = typeof Audio !== 'undefined' && typeof window !== 'undefined';
  let unlocked = false;
  let currentElement: HTMLAudioElement | undefined;
  let previousElement: HTMLAudioElement | undefined;
  let fadeTimer: number | undefined;

  function ambientGain(): number {
    return muted ? 0 : volume * ambientLevel;
  }

  function applyGains(): void {
    if (currentElement) {
      currentElement.volume = clampUnit(ambientGain() * fadeProgress, 0);
    }
    if (previousElement) {
      previousElement.volume = clampUnit(ambientGain() * (1 - fadeProgress), 0);
    }
  }

  function tryPlay(element: HTMLAudioElement): void {
    try {
      const playResult = element.play();
      if (playResult && typeof playResult.catch === 'function') {
        void playResult.catch(() => undefined);
      }
    } catch {
      // jsdom / autoplay restriction — gains are still tracked, retry on unlock
    }
  }

  function stopElement(element: HTMLAudioElement | undefined): void {
    if (!element) {
      return;
    }
    try {
      element.pause();
      element.removeAttribute('src');
    } catch {
      // best effort
    }
  }

  function beginCrossfade(): void {
    if (!hasPlayback) {
      return;
    }
    if (fadeTimer !== undefined) {
      window.clearInterval(fadeTimer);
      fadeTimer = undefined;
    }
    applyGains();
    if (fadeProgress >= 1) {
      stopElement(previousElement);
      previousElement = undefined;
      return;
    }
    fadeTimer = window.setInterval(() => {
      fadeProgress = Math.min(1, fadeProgress + FADE_TICK_MS / 1000 / FADE_SECONDS);
      applyGains();
      if (fadeProgress >= 1) {
        window.clearInterval(fadeTimer);
        fadeTimer = undefined;
        stopElement(previousElement);
        previousElement = undefined;
        previous = undefined;
      }
    }, FADE_TICK_MS);
  }

  return {
    setAmbient(nextSource: string | undefined, nextAmbientLevel = 1) {
      const clampedLevel = clampUnit(nextAmbientLevel, 1);
      if (nextSource === current) {
        ambientLevel = clampedLevel;
        applyGains();
        return;
      }
      previous = current;
      current = nextSource;
      ambientLevel = clampedLevel;
      fadeProgress = previous && current ? 0 : 1;

      if (hasPlayback) {
        stopElement(previousElement);
        previousElement = currentElement;
        currentElement = undefined;
        if (nextSource) {
          const element = new Audio(nextSource);
          element.loop = true;
          element.preload = 'auto';
          element.volume = 0;
          currentElement = element;
          if (unlocked) {
            tryPlay(element);
          }
        }
        beginCrossfade();
      }
    },
    playCue(source: string, caption?: string) {
      cues.push({ source, caption });
      if (typeof Audio !== 'undefined' && !muted) {
        try {
          const audio = new Audio(source);
          audio.volume = volume;
          const playResult = audio.play();
          if (playResult && typeof playResult.catch === 'function') {
            void playResult.catch(() => undefined);
          }
        } catch {
          // cue playback is non-essential
        }
      }
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
      applyGains();
    },
    setVolume(nextVolume: number) {
      volume = clampUnit(nextVolume, 0.7);
      applyGains();
    },
    unlock() {
      unlocked = true;
      if (currentElement && currentElement.paused) {
        tryPlay(currentElement);
      }
      if (previousElement && previousElement.paused) {
        tryPlay(previousElement);
      }
    },
    isMuted: () => muted,
    currentSource: () => current,
    snapshot: () => ({ current, previous, fadeProgress, volume, ambientLevel, muted, cues: [...cues] }),
  };
}

export function stepCrossfade(snapshot: AudioMixerSnapshot, deltaSeconds: number, durationSeconds = 1.2): AudioMixerSnapshot {
  const fadeProgress = Math.min(1, snapshot.fadeProgress + Math.max(0, deltaSeconds) / durationSeconds);
  return { ...snapshot, previous: fadeProgress >= 1 ? undefined : snapshot.previous, fadeProgress };
}

function clampUnit(value: number, fallback: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : fallback));
}

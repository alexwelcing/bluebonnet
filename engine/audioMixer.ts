export interface AudioMixer {
  setAmbient(source: string | undefined, ambientLevel?: number): void;
  playCue(source: string, caption?: string): void;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void;
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

export function createAudioMixer(): AudioMixer {
  let current: string | undefined;
  let previous: string | undefined;
  let fadeProgress = 1;
  let muted = false;
  let volume = 0.7;
  let ambientLevel = 1;
  const cues: { source: string; caption?: string }[] = [];

  return {
    setAmbient(nextSource: string | undefined, nextAmbientLevel = 1) {
      const clampedLevel = clampUnit(nextAmbientLevel, 1);
      if (nextSource === current) {
        ambientLevel = clampedLevel;
        return;
      }
      previous = current;
      current = nextSource;
      ambientLevel = clampedLevel;
      fadeProgress = previous && current ? 0 : 1;
    },
    playCue(source: string, caption?: string) {
      cues.push({ source, caption });
      if (typeof Audio !== 'undefined' && !muted) {
        const audio = new Audio(source);
        audio.volume = volume;
        const playResult = audio.play();
        if (playResult && typeof playResult.catch === 'function') {
          void playResult.catch(() => undefined);
        }
      }
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
    },
    setVolume(nextVolume: number) {
      volume = clampUnit(nextVolume, 0.7);
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

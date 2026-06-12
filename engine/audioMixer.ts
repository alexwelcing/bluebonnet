export interface AudioMixer {
  setAmbient(source: string | undefined): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  currentSource(): string | undefined;
}

export function createAudioMixer(): AudioMixer {
  let source: string | undefined;
  let muted = false;

  return {
    setAmbient(nextSource: string | undefined) {
      source = nextSource;
    },
    setMuted(nextMuted: boolean) {
      muted = nextMuted;
    },
    isMuted: () => muted,
    currentSource: () => source,
  };
}

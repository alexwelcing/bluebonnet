import { describe, expect, it } from 'vitest';
import { createAudioMixer, stepCrossfade } from '../engine/audioMixer';

describe('audio mixer', () => {
  it('tracks ambient source changes as crossfades', () => {
    const mixer = createAudioMixer();
    mixer.setAmbient('audio/cruiser-idle.wav');
    expect(mixer.snapshot()).toMatchObject({ current: 'audio/cruiser-idle.wav', previous: undefined, fadeProgress: 1 });
    mixer.setAmbient('audio/field-wind.wav');
    const started = mixer.snapshot();
    expect(started.current).toBe('audio/field-wind.wav');
    expect(started.previous).toBe('audio/cruiser-idle.wav');
    expect(started.fadeProgress).toBe(0);
    const mid = stepCrossfade(started, 0.6, 1.2);
    expect(mid.fadeProgress).toBeCloseTo(0.5);
    const done = stepCrossfade(mid, 0.6, 1.2);
    expect(done.fadeProgress).toBe(1);
    expect(done.previous).toBeUndefined();
  });

  it('records cue captions and clamps volume', () => {
    const mixer = createAudioMixer();
    mixer.setVolume(2);
    mixer.playCue('audio/jog-detent-clunk.wav', 'TIMESEEK detent clunk.');
    expect(mixer.snapshot().volume).toBe(1);
    expect(mixer.snapshot().cues).toContainEqual({ source: 'audio/jog-detent-clunk.wav', caption: 'TIMESEEK detent clunk.' });
  });
});

import { describe, expect, it } from 'vitest';
import { createAudioMixer, stepCrossfade } from '../engine/audioMixer';

describe('audio mixer', () => {
  it('tracks ambient source changes as crossfades', () => {
    const mixer = createAudioMixer();
    mixer.setAmbient('audio/wagon-idle.wav');
    expect(mixer.snapshot()).toMatchObject({ current: 'audio/wagon-idle.wav', previous: undefined, fadeProgress: 1 });
    mixer.setAmbient('audio/field-wind.wav');
    const started = mixer.snapshot();
    expect(started.current).toBe('audio/field-wind.wav');
    expect(started.previous).toBe('audio/wagon-idle.wav');
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

  it('tracks per-node ambient mix levels independently from master volume', () => {
    const mixer = createAudioMixer();
    mixer.setVolume(0.8);
    mixer.setAmbient('audio/field-wind.wav', 0.42);

    expect(mixer.snapshot()).toMatchObject({ current: 'audio/field-wind.wav', volume: 0.8, ambientLevel: 0.42 });

    mixer.setAmbient('audio/radio-static.wav', 1.5);
    expect(mixer.snapshot()).toMatchObject({ current: 'audio/radio-static.wav', previous: 'audio/field-wind.wav', ambientLevel: 1 });
  });

  it('starts tape condition clean enough for decay to have somewhere to travel', () => {
    const mixer = createAudioMixer();

    expect(mixer.snapshot().tapeIntensity).toBe(0.4);

    mixer.setTapeCondition(Number.NaN);
    expect(mixer.snapshot().tapeIntensity).toBe(0.4);
  });

  it('records synthesized deck foley as an assetless cue', () => {
    const mixer = createAudioMixer();
    mixer.playFoley('latch-open', 'The padlock falls open.');
    expect(mixer.snapshot().cues).toContainEqual({ source: 'foley:latch-open', caption: 'The padlock falls open.' });
  });

  it('still logs foley while muted so captions survive without sound', () => {
    const mixer = createAudioMixer();
    mixer.setMuted(true);
    mixer.playFoley('button', 'DECK: press');
    expect(mixer.snapshot().cues).toContainEqual({ source: 'foley:button', caption: 'DECK: press' });
  });

});

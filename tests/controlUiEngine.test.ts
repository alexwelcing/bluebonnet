import { describe, expect, it } from 'vitest';
import { createControlUiEngine } from '../engine/controlUiEngine';

describe('control UI engine', () => {
  it('turns a physical button press into momentary state plus animation/audio intents', () => {
    const engine = createControlUiEngine({
      controls: [{ id: 'deck.save', kind: 'button', releaseMs: 140, animation: 'button/save', audio: 'button-thunk' }],
    });

    engine.dispatch({ type: 'press', id: 'deck.save' });

    expect(engine.snapshot().controls['deck.save']).toMatchObject({ kind: 'button', pressed: true, phase: 'down' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'deck.save', name: 'button/save', input: 'press', value: true },
      { type: 'audio', controlId: 'deck.save', cue: 'button-thunk' },
    ]);

    engine.tick(139);
    expect(engine.snapshot().controls['deck.save']).toMatchObject({ pressed: true, phase: 'down' });

    engine.tick(1);
    expect(engine.snapshot().controls['deck.save']).toMatchObject({ pressed: false, phase: 'release' });
    expect(engine.drainIntents()).toContainEqual({ type: 'animation', controlId: 'deck.save', name: 'button/save', input: 'press', value: false });
  });

  it('normalizes faders and emits detent crossings for analog machine feedback', () => {
    const engine = createControlUiEngine({
      controls: [{ id: 'deck.tracking', kind: 'fader', min: 0, max: 1, value: 0.2, detents: [0.55], animation: 'fader/tracking' }],
    });

    engine.dispatch({ type: 'setValue', id: 'deck.tracking', value: 0.7 });

    expect(engine.snapshot().controls['deck.tracking']).toMatchObject({ kind: 'fader', value: 0.7, normalized: 0.7, phase: 'moving' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'deck.tracking', name: 'fader/tracking', input: 'value', value: 0.7 },
      { type: 'audio', controlId: 'deck.tracking', cue: 'detent-cross' },
    ]);

    engine.tick(260);
    expect(engine.snapshot().controls['deck.tracking']).toMatchObject({ phase: 'idle' });
  });

  it('represents locked wheel detents as refusal intents rather than silent no-ops', () => {
    const engine = createControlUiEngine({
      controls: [
        {
          id: 'deck.timeseek',
          kind: 'wheel',
          position: 1,
          min: 0,
          max: 2,
          detents: [
            { position: 0, id: '20:08-20:17' },
            { position: 1, id: '20:17-20:26' },
            { position: 2, id: '20:26-20:35', locked: true },
          ],
          animation: 'wheel/timeseek',
        },
      ],
    });

    engine.dispatch({ type: 'rotate', id: 'deck.timeseek', delta: 1.4 });

    expect(engine.snapshot().controls['deck.timeseek']).toMatchObject({ kind: 'wheel', position: 1, phase: 'refusing', activeDetent: '20:17-20:26' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'deck.timeseek', name: 'wheel/timeseek', input: 'strain', value: 1 },
      { type: 'audio', controlId: 'deck.timeseek', cue: 'hard-stop' },
    ]);
  });

  it('seats an unlocked TIMESEEK wheel detent with clunk and settled state', () => {
    const engine = createControlUiEngine({
      controls: [
        {
          id: 'deck.timeseek',
          kind: 'wheel',
          position: 0.72,
          min: 0,
          max: 2,
          detents: [
            { position: 0, id: '20:08-20:17' },
            { position: 1, id: '20:17-20:26' },
            { position: 2, id: '20:26-20:35', locked: true },
          ],
          animation: 'wheel/timeseek',
        },
      ],
    });

    engine.dispatch({ type: 'seat', id: 'deck.timeseek' });

    expect(engine.snapshot().controls['deck.timeseek']).toMatchObject({ kind: 'wheel', position: 1, phase: 'seated', activeDetent: '20:17-20:26' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'deck.timeseek', name: 'wheel/timeseek', input: 'position', value: 1 },
      { type: 'audio', controlId: 'deck.timeseek', cue: 'detent-clunk' },
    ]);
  });

  it('wraps digit wheels for padlock-style mechanical tumblers', () => {
    const engine = createControlUiEngine({
      controls: [{ id: 'padlock.1', kind: 'digitWheel', value: 9, min: 0, max: 9, animation: 'padlock/digit' }],
    });

    engine.dispatch({ type: 'step', id: 'padlock.1', delta: 1 });

    expect(engine.snapshot().controls['padlock.1']).toMatchObject({ kind: 'digitWheel', value: 0, phase: 'tumbling' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'padlock.1', name: 'padlock/digit', input: 'step', value: 1 },
      { type: 'audio', controlId: 'padlock.1', cue: 'wheel-click' },
    ]);
  });

  it('records knock/rest sequences as grouped mechanical input with playback intents', () => {
    const engine = createControlUiEngine({
      controls: [{ id: 'pipe.echo', kind: 'knockSequence', animation: 'pipe/knock' }],
    });

    engine.dispatch({ type: 'knock', id: 'pipe.echo' });
    engine.dispatch({ type: 'knock', id: 'pipe.echo' });
    engine.dispatch({ type: 'rest', id: 'pipe.echo' });
    engine.dispatch({ type: 'knock', id: 'pipe.echo' });
    engine.dispatch({ type: 'play', id: 'pipe.echo' });

    expect(engine.snapshot().controls['pipe.echo']).toMatchObject({ kind: 'knockSequence', groups: [2, 1], phase: 'playing' });
    expect(engine.drainIntents()).toEqual([
      { type: 'animation', controlId: 'pipe.echo', name: 'pipe/knock', input: 'knock', value: 1 },
      { type: 'audio', controlId: 'pipe.echo', cue: 'pipe-knock' },
      { type: 'animation', controlId: 'pipe.echo', name: 'pipe/knock', input: 'knock', value: 2 },
      { type: 'audio', controlId: 'pipe.echo', cue: 'pipe-knock' },
      { type: 'animation', controlId: 'pipe.echo', name: 'pipe/knock', input: 'rest', value: true },
      { type: 'animation', controlId: 'pipe.echo', name: 'pipe/knock', input: 'knock', value: 1 },
      { type: 'audio', controlId: 'pipe.echo', cue: 'pipe-knock' },
      { type: 'animation', controlId: 'pipe.echo', name: 'pipe/knock', input: 'play', value: true },
    ]);
  });
});

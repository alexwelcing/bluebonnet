import { describe, expect, it } from 'vitest';
import { createJournal } from '../engine/journal';
import { createPuzzleProgression } from '../engine/puzzle';
import { createTimeSeek } from '../engine/timeseek';
import type { SceneManifest } from '../engine/types';
import { getNodeState, loadNodeGraph } from '../engine/nodeGraph';

const manifest: SceneManifest = {
  startNodeId: 'wagon-interior',
  initialWindow: '20:08-20:17',
  lockedWindows: ['20:26-20:35'],
  nodes: [
    {
      id: 'wagon-interior',
      title: 'Cruiser Interior',
      still: 'stills/act1/wagon-interior__2008-2017.png',
      caption: 'The flyer says 88.7 FM in two different hands.',
      hotspots: [],
      temporalStates: {
        '20:08-20:17': {
          still: 'stills/act1/wagon-interior__2008-2017.png',
          caption: 'The flyer says 88.7 FM in two different hands.',
          hotspots: [],
        },
        '20:17-20:26': {
          still: 'stills/act1/wagon-interior__2017-2026.png',
          caption: 'The flyer curls toward the radio; the same 88.7 FM is scratched into the visor.',
          hotspots: [],
        },
      },
    },
  ],
};

describe('TIMESEEK gating', () => {
  it('only re-seats to discovered and unlocked timecodes', () => {
    const graph = loadNodeGraph([manifest]);
    const timeseek = createTimeSeek(graph, '20:08-20:17', ['20:17-20:26']);

    expect(timeseek.seek('20:17-20:26').ok).toBe(true);
    expect(timeseek.snapshot().activeWindow).toBe('20:17-20:26');
    expect(timeseek.seek('20:26-20:35').ok).toBe(false);
    expect(timeseek.snapshot().activeWindow).toBe('20:17-20:26');
  });

  it('resolves a node temporal state for the active tape window', () => {
    const graph = loadNodeGraph([manifest]);

    expect(getNodeState(graph, 'wagon-interior', '20:17-20:26').caption).toContain('scratched into the visor');
  });
});

describe('journal and puzzle progression', () => {
  it('logs clues verbatim once in discovery order', () => {
    const journal = createJournal();
    journal.log('flyer-frequency', 'MISSING: LENA ORTIZ — call 88.7 FM after sundown.');
    journal.log('flyer-frequency', 'MISSING: LENA ORTIZ — call 88.7 FM after sundown.');
    journal.log('dispatch-log', 'TIP LINE 20:17: FOR REYES — reset tape to 20:17.');

    expect(journal.entries().map((entry) => entry.text)).toEqual([
      'MISSING: LENA ORTIZ — call 88.7 FM after sundown.',
      'TIP LINE 20:17: FOR REYES — reset tape to 20:17.',
    ]);
  });

  it('the tuner is knowledge-gated; the tip line still waits for the broadcast', () => {
    const puzzle = createPuzzleProgression();

    // The dial can be worked cold (scanning the band is diegetic), but the
    // printer only wakes once 88.7 is locked in.
    expect(puzzle.apply('dispatch-log').ok).toBe(false);
    expect(puzzle.apply('radio-tune').ok).toBe(true);
    const dispatch = puzzle.apply('dispatch-log');

    expect(dispatch.ok).toBe(true);
    expect(dispatch.discoveredTimecode).toBe('20:17-20:26');
    expect(puzzle.snapshot().completed).toEqual(['radio-tune', 'dispatch-log']);
  });
});

import { describe, expect, it } from 'vitest';
import { createJournal } from '../engine/journal';
import { createPuzzleProgression } from '../engine/puzzle';
import { createTimeSeek } from '../engine/timeseek';
import type { SceneManifest } from '../engine/types';
import { getNodeState, loadNodeGraph } from '../engine/nodeGraph';

const manifest: SceneManifest = {
  startNodeId: 'cruiser-interior',
  initialWindow: '23:08-23:17',
  lockedWindows: ['23:26-23:35'],
  nodes: [
    {
      id: 'cruiser-interior',
      title: 'Cruiser Interior',
      still: 'stills/act1/cruiser-interior__2308-2317.png',
      caption: 'The flyer says 88.7 FM in two different hands.',
      hotspots: [],
      temporalStates: {
        '23:08-23:17': {
          still: 'stills/act1/cruiser-interior__2308-2317.png',
          caption: 'The flyer says 88.7 FM in two different hands.',
          hotspots: [],
        },
        '23:17-23:26': {
          still: 'stills/act1/cruiser-interior__2317-2326.png',
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
    const timeseek = createTimeSeek(graph, '23:08-23:17', ['23:17-23:26']);

    expect(timeseek.seek('23:17-23:26').ok).toBe(true);
    expect(timeseek.snapshot().activeWindow).toBe('23:17-23:26');
    expect(timeseek.seek('23:26-23:35').ok).toBe(false);
    expect(timeseek.snapshot().activeWindow).toBe('23:17-23:26');
  });

  it('resolves a node temporal state for the active tape window', () => {
    const graph = loadNodeGraph([manifest]);

    expect(getNodeState(graph, 'cruiser-interior', '23:17-23:26').caption).toContain('scratched into the visor');
  });
});

describe('journal and puzzle progression', () => {
  it('logs clues verbatim once in discovery order', () => {
    const journal = createJournal();
    journal.log('flyer-frequency', 'MISSING: LENA ORTIZ — call 88.7 FM after sundown.');
    journal.log('flyer-frequency', 'MISSING: LENA ORTIZ — call 88.7 FM after sundown.');
    journal.log('dispatch-log', 'DISPATCH 23:17: REYES, reset tape to 23:17.');

    expect(journal.entries().map((entry) => entry.text)).toEqual([
      'MISSING: LENA ORTIZ — call 88.7 FM after sundown.',
      'DISPATCH 23:17: REYES, reset tape to 23:17.',
    ]);
  });

  it('requires flyer-frequency before radio-tune before dispatch-log grants TIMESEEK-1', () => {
    const puzzle = createPuzzleProgression();

    expect(puzzle.apply('radio-tune').ok).toBe(false);
    expect(puzzle.apply('flyer-frequency').ok).toBe(true);
    expect(puzzle.apply('radio-tune').ok).toBe(true);
    const dispatch = puzzle.apply('dispatch-log');

    expect(dispatch.ok).toBe(true);
    expect(dispatch.discoveredTimecode).toBe('23:17-23:26');
    expect(puzzle.snapshot().completed).toEqual(['flyer-frequency', 'radio-tune', 'dispatch-log']);
  });
});

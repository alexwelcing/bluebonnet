import type { PuzzleAction, TimeWindow } from './types';

const flowerDigits: PuzzleAction[] = ['flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3'];

export interface PuzzleResult {
  ok: boolean;
  reason?: string;
  discoveredTimecode?: TimeWindow;
}

export interface PuzzleProgression {
  apply(action: PuzzleAction): PuzzleResult;
  canApply(action: PuzzleAction): boolean;
  snapshot(): { completed: PuzzleAction[] };
}

// Diegetic refusals: what the deck says when evidence is taken out of order.
const REFUSALS: Partial<Record<PuzzleAction, string>> = {
  'radio-tune': 'Static the whole way up the dial. The frequency is written down somewhere in this wagon.',
  'dispatch-log': 'The strip will not hold still. Tune the radio first — 88.7 wakes the tip line.',
  'field-gate': 'The dials spin loose and settle on nothing. Four digits — log all four bloom shapes in the field.',
  'echo-knocks': 'The pipe rings wrong. Open the gate behind you first; the field is still counting.',
  'recorder-counter': 'The counter window stays dark until the pipe has answered.',
};

export function createPuzzleProgression(initial: PuzzleAction[] = []): PuzzleProgression {
  const completed: PuzzleAction[] = [...initial];
  const complete = (action: PuzzleAction): PuzzleResult => {
    if (!canComplete(action, completed)) {
      return { ok: false, reason: REFUSALS[action] ?? 'The deck refuses. Something earlier on the tape is still unplayed.' };
    }
    if (!completed.includes(action)) {
      completed.push(action);
    }
    return action === 'dispatch-log' ? { ok: true, discoveredTimecode: '20:17-20:26' } : { ok: true };
  };

  return {
    apply: complete,
    canApply(action: PuzzleAction) {
      return canComplete(action, completed);
    },
    snapshot() {
      return { completed: [...completed] };
    },
  };
}

function canComplete(action: PuzzleAction, completed: PuzzleAction[]): boolean {
  // Knowledge-gated mechanisms (canon: the player performs the answer, the
  // performance IS the gate): the tuner, the padlock, and the pipe accept a
  // correct operation regardless of which evidence was read first.
  if (action === 'flyer-frequency' || action === 'radio-tune' || action === 'field-gate' || action === 'echo-knocks') {
    return true;
  }
  if (action === 'dispatch-log') {
    return completed.includes('radio-tune'); // the broadcast wakes the printer
  }
  if (flowerDigits.includes(action)) {
    return completed.includes('dispatch-log');
  }
  if (action === 'recorder-counter') {
    return completed.includes('echo-knocks'); // the alcove opens onto it
  }
  return false;
}

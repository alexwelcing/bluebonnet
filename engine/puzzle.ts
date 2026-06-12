import type { PuzzleAction, TimeWindow } from './types';

const actOneOrder: PuzzleAction[] = ['flyer-frequency', 'radio-tune', 'dispatch-log'];
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

export function createPuzzleProgression(initial: PuzzleAction[] = []): PuzzleProgression {
  const completed: PuzzleAction[] = [...initial];
  const complete = (action: PuzzleAction): PuzzleResult => {
    if (!canComplete(action, completed)) {
      return { ok: false, reason: `${action} is gated by earlier evidence.` };
    }
    if (!completed.includes(action)) {
      completed.push(action);
    }
    return action === 'dispatch-log' ? { ok: true, discoveredTimecode: '23:17-23:26' } : { ok: true };
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
  const actOneIndex = actOneOrder.indexOf(action);
  if (actOneIndex !== -1) {
    return actOneOrder.slice(0, actOneIndex).every((required) => completed.includes(required));
  }
  if (flowerDigits.includes(action)) {
    return completed.includes('dispatch-log');
  }
  if (action === 'field-gate') {
    return [...actOneOrder, ...flowerDigits].every((required) => completed.includes(required));
  }
  return false;
}

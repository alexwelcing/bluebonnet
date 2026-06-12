import type { PuzzleAction, TimeWindow } from './types';

const order: PuzzleAction[] = ['flyer-frequency', 'radio-tune', 'dispatch-log'];

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
  const index = order.indexOf(action);
  if (index === -1) {
    return false;
  }
  return order.slice(0, index).every((required) => completed.includes(required));
}

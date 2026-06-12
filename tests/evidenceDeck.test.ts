import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadDeck() {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = '<main id="app"></main>';
  await import('../src/main');
}

function button(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent === label);
  if (!found) {
    throw new Error(`Missing button: ${label}`);
  }
  return found as HTMLButtonElement;
}

function submitTimeSeek(value: string) {
  const input = document.querySelector<HTMLInputElement>('.timeseek');
  const form = document.querySelector<HTMLFormElement>('.timeseek-panel');
  if (!input || !form) {
    throw new Error('Missing TIMESEEK controls');
  }
  input.value = value;
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('Evidence Deck integration', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('handles flyer -> radio -> printer -> seek 23:17 and swaps to the later still', async () => {
    await loadDeck();

    button('Read the missing-person flyer').click();
    button('Inspect the patrol radio').click();
    button('Tune 88.7 FM').click();
    button('Check the dispatch printer').click();

    expect(document.querySelector('.caption')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expect(document.querySelector('.journal-list')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:17-23:26');

    submitTimeSeek('23:17');

    expect(document.querySelector('.timeseek-help')?.textContent).not.toContain('TIMESEEK rejects undiscovered tape-time');
    expect(document.querySelector<HTMLImageElement>('.scene-still')?.src).toContain('__2317-2326.jpg');
    expect(document.querySelector('.wrongness')?.textContent).toContain('TAPE ANOMALY:');
    expect(document.querySelector('.tape-stage')?.classList.contains('seek-glitch')).toBe(true);
  });
});

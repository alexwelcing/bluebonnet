import { beforeEach, describe, expect, it, vi } from 'vitest';
import act1 from '../content/act1.json';
import { boundsOverlapAreaPercent, polygonAreaPercent, polygonBounds } from '../engine/hotspotGeometry';
import type { SceneManifest } from '../engine/types';

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

function keyboardSeekForward() {
  const wheel = document.querySelector<HTMLButtonElement>('.jog-wheel');
  if (!wheel) {
    throw new Error('Missing jog wheel');
  }
  for (let index = 0; index < 16; index += 1) {
    wheel.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowRight' }));
  }
  wheel.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
}

function realPointerClick(element: HTMLElement) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
  element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

describe('Evidence Deck integration', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('keeps hotspot geometry bounded and non-overlapping inside each temporal state', () => {
    const manifest = act1 as unknown as SceneManifest;
    for (const node of manifest.nodes) {
      for (const [window, state] of Object.entries(node.temporalStates ?? {})) {
        const hotspots = state?.hotspots ?? [];
        for (const hotspot of hotspots) {
          expect(polygonAreaPercent(hotspot.polygon), `${node.id}/${window}/${hotspot.id}`).toBeLessThanOrEqual(4000);
        }
        for (let left = 0; left < hotspots.length; left += 1) {
          for (let right = left + 1; right < hotspots.length; right += 1) {
            const leftBounds = polygonBounds(hotspots[left].polygon);
            const rightBounds = polygonBounds(hotspots[right].polygon);
            const overlap = boundsOverlapAreaPercent(leftBounds, rightBounds);
            const smaller = Math.min(leftBounds.areaPercent, rightBounds.areaPercent);
            expect(overlap, `${node.id}/${window}/${hotspots[left].id}/${hotspots[right].id}`).toBeLessThan(smaller);
          }
        }
      }
    }
  });

  it('handles flyer -> radio -> printer -> seek 23:17 using real DOM pointer events', async () => {
    await loadDeck();

    realPointerClick(button('Read the missing-person flyer'));
    expect(document.querySelector('.caption')?.textContent).toContain('MISSING: LENA ORTIZ');
    expect(document.querySelector('.journal-list')?.textContent).toContain('MISSING: LENA ORTIZ');

    realPointerClick(button('Inspect the patrol radio'));
    expect(document.querySelector('h1')?.textContent).toBe('PATROL RADIO');

    realPointerClick(button('Tune 88.7 FM'));
    expect(document.querySelector('.journal-list')?.textContent).toContain('RADIO TUNED: 88.7 FM');

    realPointerClick(button('Check the dispatch printer'));
    expect(document.querySelector('.caption')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expect(document.querySelector('.journal-list')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:17-23:26');

    keyboardSeekForward();

    expect(document.querySelector('.timeseek-help')?.textContent).not.toContain('TIMESEEK rejects undiscovered tape-time');
    expect(document.querySelector<HTMLImageElement>('.scene-still')?.src).toContain('__2317-2326.jpg');
    expect(document.querySelector('.wrongness')?.textContent).toContain('TAPE ANOMALY:');
    expect(document.querySelector('.tape-stage')?.classList.contains('seek-glitch')).toBe(true);
  });
});

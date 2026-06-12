import { beforeEach, describe, expect, it, vi } from 'vitest';
import act1 from '../content/act1.json';
import { boundsOverlapAreaPercent, polygonAreaPercent, polygonBounds } from '../engine/hotspotGeometry';
import type { SceneManifest } from '../engine/types';

async function loadDeck(savedSnapshot?: unknown) {
  vi.resetModules();
  localStorage.clear();
  if (savedSnapshot) {
    localStorage.setItem('bluebonnet.engine.snapshot.v1', JSON.stringify(savedSnapshot));
  }
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

function expectVisibleExhibitContaining(...texts: string[]) {
  const overlay = document.querySelector<HTMLElement>('.exhibit-scan');
  const paper = document.querySelector<HTMLElement>('.exhibit-paper');
  expect(overlay?.hidden).toBe(false);
  for (const text of texts) {
    expect(paper?.textContent).toContain(text);
  }
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
    expectVisibleExhibitContaining('LENA ORTIZ', '88.7');
    expect(document.querySelector('.exhibit-flyer .flyer-photo-block')?.textContent).toContain('PHOTO BLOCK');
    expect(document.querySelectorAll('.exhibit-flyer .tear-off-tabs span')).toHaveLength(5);
    realPointerClick(button('RETURN TO DECK'));

    realPointerClick(button('Inspect the patrol radio'));
    expect(document.querySelector('h1')?.textContent).toBe('PATROL RADIO');

    realPointerClick(button('Tune 88.7 FM'));
    expect(document.querySelector('.journal-list')?.textContent).toContain('RADIO TUNED: 88.7 FM');

    realPointerClick(button('Check the dispatch printer'));
    expect(document.querySelector('.caption')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expect(document.querySelector('.journal-list')?.textContent).toContain('DISPATCH 23:17: REYES, reset tape to 23:17');
    expectVisibleExhibitContaining('DISPATCH 23:17', 'reset tape to 23:17');
    expect(document.querySelector('.exhibit-dispatch .tractor-feed-left')).toBeTruthy();
    expect(document.querySelector('.exhibit-dispatch .tractor-feed-right')).toBeTruthy();
    expect(document.querySelector('.exhibit-dispatch .dot-matrix-line')?.textContent).toContain('DISPATCH 23:17');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:17-23:26');

    keyboardSeekForward();

    expect(document.querySelector('.timeseek-help')?.textContent).not.toContain('TIMESEEK rejects undiscovered tape-time');
    expect(document.querySelector<HTMLImageElement>('.scene-still')?.src).toContain('__2317-2326.jpg');
    expect(document.querySelector('.wrongness')?.textContent).toContain('TAPE ANOMALY:');
    expect(document.querySelector('.tape-stage')?.classList.contains('seek-glitch')).toBe(true);
  });

  it('does not list the final nine-minutes detent as locked once it is discovered', async () => {
    await loadDeck({
      currentNodeId: 'missing-minutes-gate',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '23:26-23:35',
      discoveredTimecodes: ['23:08-23:17', '23:17-23:26', '23:26-23:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });

    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:08-23:17');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:17-23:26');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('23:26-23:35');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('LOCKED: none');
  });


  it('persists the chosen ending into the save snapshot', async () => {
    await loadDeck({
      currentNodeId: 'final-choice',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '23:26-23:35',
      discoveredTimecodes: ['23:08-23:17', '23:17-23:26', '23:26-23:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });

    realPointerClick(button('EJECT — seal the tape'));

    const saved = JSON.parse(localStorage.getItem('bluebonnet.engine.snapshot.v1') ?? '{}');
    expect(saved.currentNodeId).toBe('ending-eject');
    expect(saved.flags['ending:eject']).toBe(true);
    expect(saved.journal.map((entry: { text: string }) => entry.text).join('\n')).toContain('Evidence sealed');
  });


  it('shows an in-fiction insert-tape boot screen and deck colophon', async () => {
    await loadDeck();

    const boot = document.querySelector<HTMLElement>('.boot-screen');
    expect(boot?.hidden).toBe(false);
    expect(boot?.textContent).toContain('INSERT TAPE');
    expect(boot?.textContent).toContain('BLUEBONNET');

    realPointerClick(button('INSERT TAPE'));
    expect(boot?.hidden).toBe(true);

    realPointerClick(button('CREDITS / COLOPHON'));
    const colophon = document.querySelector<HTMLElement>('.colophon-panel');
    expect(colophon?.hidden).toBe(false);
    expect(colophon?.textContent).toContain('BLUEBONNET');
    expect(colophon?.textContent).toContain('A1 clean plates');
  });

});

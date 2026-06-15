import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDiegeticOverlay } from '../engine/nodeGraph';
import type { TemporalNodeState } from '../engine/types';

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

function realPointerClick(element: HTMLElement) {
  element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
  element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

const fullProgress = {
  flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
  vhsIntensity: 0.72,
  discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
  journal: [],
  completedPuzzles: [
    'flyer-frequency',
    'radio-tune',
    'dispatch-log',
    'flower-digit-2',
    'flower-digit-7',
    'flower-digit-1',
    'flower-digit-3',
    'field-gate',
    'echo-knocks',
    'recorder-counter',
  ],
  captionsEnabled: true,
};

describe('resolveDiegeticOverlay (engine)', () => {
  it('prefers the per-window override and falls back to the node default', () => {
    const base = 'VISOR PASS // PRESS — D. REYES — KBLN 88.7';
    const withOverride = { diegeticOverlay: 'WRONG' } as unknown as TemporalNodeState;
    const withoutOverride = {} as unknown as TemporalNodeState;
    expect(resolveDiegeticOverlay(withOverride, base)).toBe('WRONG');
    expect(resolveDiegeticOverlay(withoutOverride, base)).toBe(base);
    expect(resolveDiegeticOverlay(undefined, base)).toBe(base);
  });
});

describe('Deck immersion polish', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4), width, height }),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  it('shows the canonical diegetic overlay in the baseline window', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    const overlay = document.querySelector<HTMLElement>('.diegetic-text')!;
    expect(overlay.hidden).toBe(false);
    expect(overlay.textContent).toBe('VISOR PASS // PRESS — D. REYES — KBLN 88.7');
  });

  it('renders the per-window wrong overlay in a later tape pass', async () => {
    await loadDeck({
      ...fullProgress,
      currentNodeId: 'wagon-interior',
      activeWindow: '20:17-20:26',
    });
    const overlay = document.querySelector<HTMLElement>('.diegetic-text')!;
    expect(overlay.hidden).toBe(false);
    // mirror-flipped visor pass — the readable text itself goes wrong
    expect(overlay.textContent).toBe('7.88 NLBK — SEYER .D — SSERP // SSAP ROSIV');
    expect(overlay.textContent).not.toBe('VISOR PASS // PRESS — D. REYES — KBLN 88.7');
  });

  it('the mile marker overlay miscounts in the later window', async () => {
    await loadDeck({
      ...fullProgress,
      currentNodeId: 'mile-marker-271',
      activeWindow: '20:17-20:26',
    });
    expect(document.querySelector('.diegetic-text')?.textContent).toBe('FM 1187 // MILE 217 // MIRASOL 0');
  });

  it('pulses DUB COMPARE only where the passes diverge, and retires it once used', async () => {
    await loadDeck({
      ...fullProgress,
      currentNodeId: 'wagon-interior',
      activeWindow: '20:17-20:26',
    });
    const compare = document.querySelector<HTMLButtonElement>('.compare')!;
    // wrongness present + a second pass discovered => invitation pulse
    expect(compare.classList.contains('compare-invite')).toBe(true);
    expect(compare.getAttribute('aria-describedby')).toBe('compare-invite-note');
    expect(document.querySelector('#compare-invite-note')?.textContent).toContain('DUB COMPARE');

    // using compare here retires the invitation for this node
    compare.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    compare.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    expect(compare.classList.contains('compare-invite')).toBe(false);
    expect(compare.getAttribute('aria-describedby')).toBe('');
  });

  it('does not pulse DUB COMPARE on a stable baseline window', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    expect(document.querySelector('.compare')?.classList.contains('compare-invite')).toBe(false);
  });

  it('docks the overlay to upper-left only when a long caption shares the frame', async () => {
    // wagon-interior 20:17 has both an overlay and a long caption.
    await loadDeck({
      ...fullProgress,
      currentNodeId: 'wagon-interior',
      activeWindow: '20:17-20:26',
    });
    const overlay = document.querySelector<HTMLElement>('.diegetic-text')!;
    expect(overlay.classList.contains('diegetic-docked')).toBe(true);

    // a short-caption node with an overlay stays in its default lower-left dock
    await loadDeck({
      ...fullProgress,
      currentNodeId: 'mile-marker-271',
      activeWindow: '20:17-20:26',
    });
    expect(document.querySelector('.diegetic-text')?.classList.contains('diegetic-docked')).toBe(false);
  });

  it('the tip-line printout carries faint earlier tips above the real, crisp line', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    realPointerClick(button('Read the missing-person flyer'));
    realPointerClick(button('RETURN TO DECK'));
    realPointerClick(button('Inspect the scanner radio'));
    realPointerClick(button('Work the tuning dial'));
    const dial = document.querySelector<HTMLInputElement>('.dial-frequency')!;
    dial.value = '88.7';
    dial.dispatchEvent(new Event('input', { bubbles: true }));
    realPointerClick(document.querySelector<HTMLButtonElement>('.dial-lock')!);
    realPointerClick(button('Check the tip-line printer'));

    const prior = document.querySelector<HTMLElement>('.exhibit-dispatch .tipline-prior')!;
    expect(prior).toBeTruthy();
    // earlier tips are ambience, not clue text — hidden from assistive tech
    expect(prior.getAttribute('aria-hidden')).toBe('true');
    expect(prior.querySelectorAll('.tipline-ghost').length).toBeGreaterThanOrEqual(3);

    // the real, story-critical line stays pixel-accurate and crisp
    const real = document.querySelector<HTMLElement>('.exhibit-dispatch .dot-matrix-line')!;
    expect(real.textContent).toContain('TIP LINE 20:17');
    expect(real.textContent).toContain('reset tape to 20:17');
    // none of the ghost lines may impersonate the real clue
    for (const ghost of prior.querySelectorAll('.tipline-ghost')) {
      expect(ghost.textContent).not.toContain('reset tape to 20:17');
    }
  });
});

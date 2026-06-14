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

  it('handles flyer -> radio -> printer -> seek 20:17 using real DOM pointer events', async () => {
    await loadDeck();

    realPointerClick(button('Read the missing-person flyer'));
    expect(document.querySelector('.caption')?.textContent).toContain('MISSING: LENA ORTIZ');
    expect(document.querySelector('.journal-list')?.textContent).toContain('MISSING: LENA ORTIZ');
    expectVisibleExhibitContaining('LENA ORTIZ', '88.7');
    expect(document.querySelector('.exhibit-flyer .flyer-photo-block')?.getAttribute('role')).toBe('img');
    expect(document.querySelectorAll('.exhibit-flyer .tear-off-tabs span')).toHaveLength(5);
    realPointerClick(button('RETURN TO DECK'));

    realPointerClick(button('Inspect the scanner radio'));
    expect(document.querySelector('h1')?.textContent).toBe('SCANNER RADIO');

    realPointerClick(button('Work the tuning dial'));
    const dial = document.querySelector<HTMLInputElement>('.dial-frequency')!;
    dial.value = '88.7';
    dial.dispatchEvent(new Event('input', { bubbles: true }));
    realPointerClick(document.querySelector<HTMLButtonElement>('.dial-lock')!);
    expect(document.querySelector('.journal-list')?.textContent).toContain('RADIO TUNED: 88.7 FM');

    realPointerClick(button('Check the tip-line printer'));
    expect(document.querySelector('.caption')?.textContent).toContain('TIP LINE 20:17: FOR REYES — reset tape to 20:17');
    expect(document.querySelector('.journal-list')?.textContent).toContain('TIP LINE 20:17: FOR REYES — reset tape to 20:17');
    expectVisibleExhibitContaining('TIP LINE 20:17', 'reset tape to 20:17');
    expect(document.querySelector('.exhibit-dispatch .tractor-feed-left')).toBeTruthy();
    expect(document.querySelector('.exhibit-dispatch .tractor-feed-right')).toBeTruthy();
    expect(document.querySelector('.exhibit-dispatch .dot-matrix-line')?.textContent).toContain('TIP LINE 20:17');
    const cue2017 = document.querySelector('.cue[data-window="20:17-20:26"]');
    expect(cue2017?.classList.contains('undiscovered')).toBe(false);

    keyboardSeekForward();

    expect(document.querySelector('.timeseek-help')?.textContent).not.toContain('TIMESEEK rejects undiscovered tape-time');
    expect(document.querySelector<HTMLImageElement>('.scene-still')?.src).toContain('__2017-2026.jpg');
    expect(document.querySelector('.wrongness')?.textContent).toContain('TAPE ANOMALY:');
    expect(document.querySelector('.tape-stage')?.classList.contains('seek-glitch')).toBe(true);
  });

  it('does not announce a fake anomaly on stable baseline windows', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));

    expect(document.querySelector('.wrongness')?.textContent).toBe('');
  });

  it('does not list the final nine-minutes detent as locked once it is discovered', async () => {
    await loadDeck({
      currentNodeId: 'missing-minutes-gate',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '20:26-20:35',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });

    expect(document.querySelector('.timeseek-help')?.textContent).toContain('FULL TAPE OPEN');
    const finalCue = document.querySelector('.cue[data-window="20:26-20:35"]');
    expect(finalCue?.classList.contains('locked')).toBe(false);
    expect(finalCue?.classList.contains('undiscovered')).toBe(false);
  });


  it('a fresh tape plays the last broadcast; Escape skips it', async () => {
    await loadDeck();
    expect(document.querySelector<HTMLElement>('.prelude')!.hidden).toBe(true);
    realPointerClick(button('INSERT TAPE'));
    const prelude = document.querySelector<HTMLElement>('.prelude')!;
    expect(prelude.hidden).toBe(false);
    expect(document.querySelector('.prelude-line')?.textContent).toContain("You're on 88.7 KBLN");
    expect(document.querySelector('.prelude-eyebrow')?.textContent).toContain('FINAL BROADCAST');
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(prelude.hidden).toBe(true);
    expect(document.querySelector('h1')?.textContent).toBe('WAGON INTERIOR');
  });

  it('a resumed tape skips the broadcast but can replay it from the deck', async () => {
    await loadDeck({
      currentNodeId: 'field-gate',
      flags: {},
      vhsIntensity: 0.72,
      activeWindow: '20:08-20:17',
      discoveredTimecodes: ['20:08-20:17'],
      journal: [],
      completedPuzzles: [],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));
    expect(document.querySelector<HTMLElement>('.prelude')!.hidden).toBe(true);
    realPointerClick(button('⏮ REPLAY THE LAST BROADCAST'));
    expect(document.querySelector<HTMLElement>('.prelude')!.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));
    expect(document.querySelector<HTMLElement>('.prelude')!.hidden).toBe(true);
  });

  it('the padlock mechanism opens on the code alone and strains on a wrong code', async () => {
    await loadDeck({
      currentNodeId: 'field-gate',
      flags: { 'puzzle:flyer-frequency': true, 'puzzle:radio-tune': true, 'puzzle:dispatch-log': true },
      vhsIntensity: 0.72,
      activeWindow: '20:08-20:17',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));

    realPointerClick(button('Work the padlock dials'));
    const mechanism = document.querySelector<HTMLElement>('.mechanism')!;
    expect(mechanism.hidden).toBe(false);

    // wrong code: the hasp holds
    realPointerClick(document.querySelector<HTMLButtonElement>('.padlock-try')!);
    expect(document.querySelector('.mechanism-verdict')?.textContent).toContain('hasp holds');
    expect(document.querySelector('h1')?.textContent).toBe('FIELD GATE');

    // 2-7-1-3 — no bloom-clock flags required; knowledge is the key
    const wheels = [...document.querySelectorAll('.padlock-wheel')];
    const spins = [2, 7, 1, 3];
    wheels.forEach((wheel, index) => {
      const up = wheel.querySelector<HTMLButtonElement>('button')!;
      for (let i = 0; i < spins[index]; i++) realPointerClick(up);
    });
    realPointerClick(document.querySelector<HTMLButtonElement>('.padlock-try')!);
    expect(document.querySelector('h1')?.textContent).toBe('CULVERT APPROACH');
  });

  it('adds tactile control state for deck presses, faders, and mechanical wheels', async () => {
    await loadDeck({
      currentNodeId: 'field-gate',
      flags: { 'puzzle:flyer-frequency': true, 'puzzle:radio-tune': true, 'puzzle:dispatch-log': true },
      vhsIntensity: 0.72,
      activeWindow: '20:08-20:17',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));

    const deckButton = button('BOOKMARK TAPE STATE');
    deckButton.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
    expect(deckButton.classList.contains('actuated')).toBe(true);

    const tracking = document.querySelector<HTMLInputElement>('.intensity')!;
    tracking.value = '0.9';
    tracking.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tracking.classList.contains('fader-moving')).toBe(true);

    realPointerClick(button('Work the padlock dials'));
    const firstWheelUp = document.querySelector<HTMLButtonElement>('.padlock-wheel button')!;
    realPointerClick(firstWheelUp);
    expect(document.querySelector('.padlock-wheel span')?.classList.contains('digit-tumble')).toBe(true);
  });

  it('the tuning dial only locks at 88.7', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' })); // skip broadcast
    realPointerClick(button('Inspect the scanner radio'));
    realPointerClick(button('Work the tuning dial'));
    const lock = document.querySelector<HTMLButtonElement>('.dial-lock')!;
    expect(lock.disabled).toBe(true); // 98.1 = static
    const dial = document.querySelector<HTMLInputElement>('.dial-frequency')!;
    dial.value = '88.7';
    dial.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dial.dataset.controlId).toBe('radio.frequency');
    expect(dial.classList.contains('fader-moving')).toBe(true);
    expect(lock.disabled).toBe(false);
    realPointerClick(lock);
    expect(document.querySelector('.journal-list')?.textContent).toContain('RADIO TUNED');
  });

  it('a new timecode announces itself and pulses its cue', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    realPointerClick(button('Read the missing-person flyer'));
    realPointerClick(button('RETURN TO DECK'));
    realPointerClick(button('Inspect the scanner radio'));
    realPointerClick(button('Work the tuning dial'));
    const announceDial = document.querySelector<HTMLInputElement>('.dial-frequency')!;
    announceDial.value = '88.7';
    announceDial.dispatchEvent(new Event('input', { bubbles: true }));
    realPointerClick(document.querySelector<HTMLButtonElement>('.dial-lock')!);
    realPointerClick(button('Check the tip-line printer'));

    expect(document.querySelector('.timeseek-help')?.textContent).toContain('NEW TIMECODE ON THE RULER: 20:17-20:26');
    expect(document.querySelector('.cue[data-window="20:17-20:26"]')?.classList.contains('fresh')).toBe(true);
  });

  it('REWIND appears only on ending nodes and clears the save', async () => {
    await loadDeck({
      currentNodeId: 'ending-eject',
      flags: { 'ending:eject': true },
      vhsIntensity: 0.72,
      activeWindow: '20:26-20:35',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));

    const rewind = document.querySelector<HTMLButtonElement>('.rewind')!;
    expect(rewind.hidden).toBe(false);
    realPointerClick(rewind);
    expect(localStorage.getItem('bluebonnet.engine.snapshot.v1')).toBeNull();
  });

  it('REWIND stays hidden during play', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    expect(document.querySelector<HTMLButtonElement>('.rewind')!.hidden).toBe(true);
  });

  it('cue buttons seek directly; the locked cue strains like the hard stop', async () => {
    await loadDeck({
      currentNodeId: 'missing-minutes-gate',
      flags: { 'puzzle:field-gate': true, 'puzzle:echo-knocks': true },
      vhsIntensity: 0.72,
      activeWindow: '20:17-20:26',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));

    // discovered cue seeks
    realPointerClick(document.querySelector<HTMLButtonElement>('.cue[data-window="20:08-20:17"]')!);
    expect(document.querySelector('.timestamp')?.textContent).toContain('20:08-20:17');
    expect(document.querySelector('.cue[data-window="20:08-20:17"]')?.classList.contains('current')).toBe(true);

    // locked cue refuses with the hard-stop strain, no seek
    realPointerClick(document.querySelector<HTMLButtonElement>('.cue[data-window="20:26-20:35"]')!);
    expect(document.querySelector('.timestamp')?.textContent).toContain('20:08-20:17');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('LOCKED 20:26-20:35');
    expect(document.querySelector('.jog-wheel')?.classList.contains('control-refusing')).toBe(true);
  });

  it('the knock pipe mechanism uses grouped mechanical control feedback', async () => {
    await loadDeck({
      currentNodeId: 'culvert-pipe',
      flags: { 'puzzle:field-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '20:17-20:26',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));
    realPointerClick(button('Knock on the pipe'));

    const knock = button('KNOCK');
    const rest = button('REST');
    const playback = button('PLAY IT BACK');
    realPointerClick(knock);
    realPointerClick(knock);
    realPointerClick(rest);
    realPointerClick(knock);

    const tape = document.querySelector<HTMLElement>('.knock-tape')!;
    expect(tape.dataset.controlId).toBe('pipe.echo');
    expect(tape.textContent).toBe('||  —  |');
    expect(tape.classList.contains('pipe-knock-pulse')).toBe(true);

    realPointerClick(playback);
    expect(tape.classList.contains('pipe-playback-pulse')).toBe(true);
    expect(document.querySelector('.mechanism-verdict')?.textContent).toContain('pipe rings wrong');
  });

  it('persists the chosen ending into the save snapshot', async () => {
    await loadDeck({
      currentNodeId: 'final-choice',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '20:26-20:35',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
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


  it('boots fresh instead of crashing when the stored save is corrupted', async () => {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('bluebonnet.engine.snapshot.v1', '{not valid json!!');
    document.body.innerHTML = '<main id="app"></main>';
    await import('../src/main');

    expect(document.querySelector('.boot-screen')).toBeTruthy();
    expect(document.querySelector('h1')?.textContent).toBe('WAGON INTERIOR');
    expect(localStorage.getItem('bluebonnet.engine.snapshot.v1')).toBeNull();
  });

  it('discards a save that points at a node that no longer exists', async () => {
    await loadDeck({
      currentNodeId: 'deleted-node-from-old-build',
      flags: {},
      vhsIntensity: 0.72,
      activeWindow: '20:08-20:17',
      discoveredTimecodes: ['20:08-20:17'],
      journal: [],
      completedPuzzles: [],
      captionsEnabled: true,
    });

    expect(document.querySelector('h1')?.textContent).toBe('WAGON INTERIOR');
  });

  it('re-seats the tape window when navigation enters a node without the active window', async () => {
    await loadDeck({
      currentNodeId: 'missing-minutes-gate',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '20:17-20:26',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });

    realPointerClick(button('INSERT TAPE'));
    realPointerClick(button('Enter the seated nine minutes'));

    // Act IV nodes only exist inside 20:26-20:35; entering from 20:17 must
    // jump the tape rather than strand the player on a hotspot-free view.
    expect(document.querySelector('.timestamp')?.textContent).toContain('20:26-20:35');
    expect(document.querySelectorAll('.hotspot').length).toBeGreaterThan(0);
  });

  it('DUB COMPARE superimposes the other discovered pass while held', async () => {
    await loadDeck({
      currentNodeId: 'missing-minutes-gate',
      flags: { 'puzzle:field-gate': true, 'puzzle:recorder-counter': true, 'act4-gate': true },
      vhsIntensity: 0.72,
      activeWindow: '20:17-20:26',
      discoveredTimecodes: ['20:08-20:17', '20:17-20:26', '20:26-20:35'],
      journal: [],
      completedPuzzles: ['flyer-frequency', 'radio-tune', 'dispatch-log', 'flower-digit-2', 'flower-digit-7', 'flower-digit-1', 'flower-digit-3', 'field-gate', 'echo-knocks', 'recorder-counter'],
      captionsEnabled: true,
    });
    realPointerClick(button('INSERT TAPE'));

    const compare = document.querySelector<HTMLButtonElement>('.compare')!;
    const layer = document.querySelector<HTMLImageElement>('.compare-layer')!;
    expect(layer.hidden).toBe(true);

    compare.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    expect(layer.hidden).toBe(false);
    // gate is seated at 20:17; the other discovered pass is 20:26
    expect(layer.src).toContain('missing-minutes-gate__2026-2035.jpg');
    expect(compare.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('DUB COMPARE');

    compare.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    expect(layer.hidden).toBe(true);
    expect(compare.getAttribute('aria-pressed')).toBe('false');
  });

  it('DUB COMPARE refuses politely when only one pass is discovered', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));
    const compare = document.querySelector<HTMLButtonElement>('.compare')!;
    compare.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    expect(document.querySelector<HTMLImageElement>('.compare-layer')!.hidden).toBe(true);
    expect(document.querySelector('.timeseek-help')?.textContent).toContain('no second pass');
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


  it('renders muted looping idle motion layers over the current clean plate', async () => {
    await loadDeck();
    realPointerClick(button('INSERT TAPE'));

    const layers = [...document.querySelectorAll<HTMLVideoElement>('.motion-layer')];
    expect(layers.length).toBeGreaterThan(0);
    expect(layers[0].muted).toBe(true);
    expect(layers[0].loop).toBe(true);
    expect(layers[0].playsInline).toBe(true);
    expect(layers[0].src).toContain('/video/');
  });

});

describe('Side B', () => {
  async function loadDeckSideB() {
    vi.resetModules();
    localStorage.clear();
    localStorage.setItem('bluebonnet.sideb', '1');
    document.body.innerHTML = '<main id="app"></main>';
    await import('../src/main');
  }

  it('appears on the boot screen only after an ending has been reached', async () => {
    await loadDeck();
    expect(document.querySelector<HTMLButtonElement>('.insert-side-b')!.hidden).toBe(true);

    await loadDeckSideB();
    const sideButton = document.querySelector<HTMLButtonElement>('.insert-side-b')!;
    expect(sideButton.hidden).toBe(false);
    realPointerClick(sideButton);
    expect(document.querySelector('h1')?.textContent).toBe('THE DEN');
    // the tape is live: timestamp on the player's clock, cues read NOW
    expect(document.querySelector('.timestamp')?.textContent).toContain('LIVE');
    expect(document.querySelector('.cue .cue-time')?.textContent).toBe('NOW');
    expect(document.querySelector('.evidence-deck')?.classList.contains('side-b')).toBe(true);
  });

  it('the chain gates the door; the porch leads into the flowers', async () => {
    await loadDeckSideB();
    realPointerClick(document.querySelector<HTMLButtonElement>('.insert-side-b')!);
    realPointerClick(button('Go to the front door'));
    const open = button('Open the door');
    expect(open.classList.contains('hotspot-locked')).toBe(true);
    realPointerClick(open);
    expect(document.querySelector('.caption')?.textContent).toContain('Dana kept hers on too');
    realPointerClick(button('Slip the chain off'));
    realPointerClick(button('Open the door'));
    expect(document.querySelector('h1')?.textContent).toBe('THE PORCH');
    realPointerClick(button('Walk into the flowers'));
    expect(document.querySelector('h1')?.textContent).toBe('WE ANSWER');
    expect(document.querySelector<HTMLButtonElement>('.rewind')!.hidden).toBe(false);
  });

  it('the set shows the wagon, tonight, and can be turned off', async () => {
    await loadDeckSideB();
    realPointerClick(document.querySelector<HTMLButtonElement>('.insert-side-b')!);
    realPointerClick(button('Look closer at the set'));
    expect(document.querySelector('.tv-inset')).toBeTruthy();
    realPointerClick(button('Turn the set off'));
    expect(document.querySelector('h1')?.textContent).toBe('SIGN-OFF');
    expect(document.querySelector('.tv-inset')).toBeNull();
  });
});

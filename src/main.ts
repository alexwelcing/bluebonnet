import { createAudioMixer } from '../engine/audioMixer';
import { clipPathWithinBounds, polygonBounds, svgPointsWithinBounds } from '../engine/hotspotGeometry';
import { createJogWheelState, defaultJogWheelOptions, dragJogWheel, seatNearestDetent, stepJogWheel } from '../engine/jogWheel';
import { availableHotspots, getNode, getNodeState, loadNodeGraph, nearestDefinedWindow, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../engine/save';
import { createStateMachine } from '../engine/stateMachine';
import { createTimeSeek } from '../engine/timeseek';
import type { HotspotDefinition, SceneManifest, TimeWindow } from '../engine/types';
import { installVhsCompositor } from '../engine/vhsCompositor';
import transitionManifest from '../content/transitions.json';
import './styles.css';

// Only the act manifests: shotlist.json and motionLoops.json are internal
// production data and must not ship in the public bundle.
const manifestModules = import.meta.glob<SceneManifest>('../content/act*.json', { eager: true, import: 'default' });
const manifests = Object.values(manifestModules).filter((manifest) => 'nodes' in manifest);
const graph = loadNodeGraph(manifests);
const storedSave = loadSnapshot();
// A save pointing at a node that no longer exists (content rename between
// deploys) must not brick the boot.
const initialSave = storedSave && graph.nodes[storedSave.currentNodeId] ? storedSave : undefined;
if (storedSave && !initialSave) {
  clearSnapshot();
}
const state = createStateMachine(initialSave ?? { currentNodeId: graph.startNodeId, activeWindow: graph.initialWindow });
for (const action of state.snapshot().completedPuzzles) {
  state.setFlag(`puzzle:${action}`);
}
const audio = createAudioMixer();
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root.');
}

app.innerHTML = `
  <section class="evidence-deck" aria-label="Evidence Deck CRT and VCR interface">
    <div class="boot-screen" role="dialog" aria-label="Insert tape boot screen">
      <div class="boot-card">
        <p class="boot-eyebrow">REYES ARCHIVE — MIRASOL, TX</p>
        <h2>BLUEBONNET</h2>
        <p>BOX 271 // FM 1187 HI8 TAPE // APR 12 1998</p>
        <button class="insert-tape" type="button">INSERT TAPE</button>
      </div>
    </div>
    <header class="deck-header">
      <div class="case-label">REYES ARCHIVE // BOX 271 // KBLN 88.7 MIRASOL</div>
      <div class="tape-slot">VCR: HI8 DUB INSERTED</div>
    </header>
    <div class="crt-bezel">
      <div class="tape-stage">
        <img class="scene-still" alt="Recovered Hi8 tape still" />
        <div class="motion-layer-stack" aria-hidden="true"></div>
        <div class="hotspot-layer" aria-label="Tape interaction field"></div>
        <div class="scanlines" aria-hidden="true"></div>
        <div class="tracking tracking-a" aria-hidden="true"></div>
        <div class="tracking tracking-b" aria-hidden="true"></div>
        <div class="diegetic-text" aria-live="off"></div>
        <div class="timestamp" aria-live="off"></div>
      </div>
      <p class="caption" aria-live="polite"></p>
    </div>
    <aside class="deck-controls">
      <div class="readout">
        <p class="eyebrow">CURRENT NODE</p>
        <h1></h1>
        <p class="wrongness"></p>
      </div>
      <div class="timeseek-panel">
        <p class="timeseek-label">TIMESEEK JOG/SHUTTLE</p>
        <button class="jog-wheel" type="button" aria-label="TIMESEEK jog wheel. Drag to scrub tape time; arrow keys nudge; Enter seats nearest discovered detent.">
          <span class="jog-marker"></span>
        </button>
        <p class="timeseek-help"></p>
      </div>
      <label class="tracking-control">
        TRACKING
        <input class="intensity" type="range" min="0" max="1" step="0.01" />
      </label>
      <label class="volume-control">
        VOLUME
        <input class="volume" type="range" min="0" max="1" step="0.01" value="0.7" />
      </label>
      <label class="caption-toggle">
        <input class="captions" type="checkbox" />
        CAPTIONS
      </label>
      <button class="save" type="button">BOOKMARK TAPE STATE</button>
      <button class="credits" type="button">CREDITS / COLOPHON</button>
      <section class="journal-panel" aria-label="Annotation journal">
        <h2>JOURNAL</h2>
        <ol class="journal-list"></ol>
      </section>
    </aside>
    <div class="exhibit-scan" hidden role="dialog" aria-modal="true" aria-label="Evidence exhibit scan">
      <article class="exhibit-paper"></article>
      <button class="close-exhibit" type="button">RETURN TO DECK</button>
    </div>
    <div class="colophon-panel" hidden role="dialog" aria-modal="true" aria-label="Credits and colophon">
      <article class="colophon-card">
        <h2>BLUEBONNET // COLOPHON</h2>
        <p>A found-footage mystery told in pre-rendered tape stills, breathing motion loops, and a physical TIMESEEK transport. Every word you can read on the tape is typeset by the deck itself — the production calls these A1 clean plates: no generated image is trusted to carry readable story text.</p>
        <p>Captions, keyboard transport, and local evidence bookmarks are always available on the deck.</p>
      </article>
      <button class="close-colophon" type="button">RETURN TO DECK</button>
    </div>
  </section>
`;

const stage = app.querySelector<HTMLDivElement>('.tape-stage')!;
const still = app.querySelector<HTMLImageElement>('.scene-still')!;
const motionLayerStack = app.querySelector<HTMLDivElement>('.motion-layer-stack')!;
const hotspotLayer = app.querySelector<HTMLDivElement>('.hotspot-layer')!;
const title = app.querySelector<HTMLHeadingElement>('h1')!;
const caption = app.querySelector<HTMLParagraphElement>('.caption')!;
const wrongness = app.querySelector<HTMLParagraphElement>('.wrongness')!;
const timestamp = app.querySelector<HTMLDivElement>('.timestamp')!;
const diegeticText = app.querySelector<HTMLDivElement>('.diegetic-text')!;
const intensity = app.querySelector<HTMLInputElement>('.intensity')!;
const volume = app.querySelector<HTMLInputElement>('.volume')!;
const captions = app.querySelector<HTMLInputElement>('.captions')!;
const save = app.querySelector<HTMLButtonElement>('.save')!;
const credits = app.querySelector<HTMLButtonElement>('.credits')!;
const bootScreen = app.querySelector<HTMLDivElement>('.boot-screen')!;
const insertTape = app.querySelector<HTMLButtonElement>('.insert-tape')!;
const jogWheel = app.querySelector<HTMLButtonElement>('.jog-wheel')!;
const timeseekHelp = app.querySelector<HTMLParagraphElement>('.timeseek-help')!;
const journalList = app.querySelector<HTMLOListElement>('.journal-list')!;
const exhibitScan = app.querySelector<HTMLDivElement>('.exhibit-scan')!;
const exhibitPaper = app.querySelector<HTMLElement>('.exhibit-paper')!;
const closeExhibit = app.querySelector<HTMLButtonElement>('.close-exhibit')!;
const colophonPanel = app.querySelector<HTMLDivElement>('.colophon-panel')!;
const closeColophon = app.querySelector<HTMLButtonElement>('.close-colophon')!;
const compositor = installVhsCompositor(stage, state.snapshot().vhsIntensity);
let jogState = createJogWheelState(state.snapshot().activeWindow, jogOptions());
let dragState: { angle: number; time: number } | undefined;
let renderedMotionKey: string | undefined;
let helpOverride: string | undefined;
let helpOverrideTimer: number | undefined;

// Transport messages (CLUNK, LOCKED kickback, TAPE JUMPS) must survive the
// renders that state publishes trigger, or the player never sees them.
function setTransportMessage(text: string) {
  helpOverride = text;
  timeseekHelp.textContent = text;
  if (helpOverrideTimer !== undefined) {
    window.clearTimeout(helpOverrideTimer);
  }
  helpOverrideTimer = window.setTimeout(() => {
    helpOverride = undefined;
    helpOverrideTimer = undefined;
    render();
  }, 4000);
}

function render() {
  const snapshot = state.snapshot();
  const nodeState = getNodeState(graph, snapshot.currentNodeId, snapshot.activeWindow);
  still.src = nodeState.still;
  const node = getNode(graph, snapshot.currentNodeId);
  // Rebuilding the <video> elements restarts the loops and flashes black, so
  // only do it when the layer set actually changes (state publishes several
  // times per click). Window-specific loops take precedence; the still
  // underneath acts as the poster frame until the video plays.
  const activeMotionLayers = nodeState.motionLayers ?? node.motionLayers ?? [];
  const motionKey = activeMotionLayers
    .map((layer) => `${layer.src}|${layer.opacity}|${layer.blendMode ?? 'screen'}`)
    .join(',');
  if (motionKey !== renderedMotionKey) {
    renderedMotionKey = motionKey;
    motionLayerStack.replaceChildren(
      ...activeMotionLayers.map((layer) => {
        const video = document.createElement('video');
        video.className = 'motion-layer';
        video.src = layer.src;
        video.muted = true;
        video.loop = true;
        video.autoplay = true;
        video.playsInline = true;
        video.dataset.blendMode = layer.blendMode ?? 'screen';
        video.style.opacity = String(layer.opacity);
        video.style.mixBlendMode = layer.blendMode ?? 'screen';
        return video;
      }),
    );
  }
  title.textContent = node.title.toUpperCase();
  caption.textContent = snapshot.captionsEnabled ? nodeState.caption : '';
  caption.hidden = !snapshot.captionsEnabled;
  wrongness.textContent = nodeState.wrongness ? `TAPE ANOMALY: ${nodeState.wrongness}` : 'TAPE ANOMALY: baseline window stable.';
  intensity.value = String(snapshot.vhsIntensity);
  captions.checked = snapshot.captionsEnabled;
  timestamp.textContent = `APR 12 1998 ${snapshot.activeWindow} HI8`;
  diegeticText.textContent = diegeticOverlay(snapshot.currentNodeId);
  diegeticText.hidden = diegeticText.textContent === '';
  const lockedWindows = graph.lockedWindows.filter((window) => !snapshot.discoveredTimecodes.includes(window));
  timeseekHelp.textContent =
    helpOverride ?? `DISCOVERED: ${snapshot.discoveredTimecodes.join(' / ')} // LOCKED: ${lockedWindows.length > 0 ? lockedWindows.join(' / ') : 'none'}`;
  jogWheel.style.setProperty('--jog-angle', `${jogState.angle}rad`);
  jogWheel.classList.toggle('jog-strain', jogState.strain > 0.35);
  audio.setAmbient(node.ambientAudio, node.audioMix?.ambient ?? 1);
  compositor.setIntensity(snapshot.vhsIntensity);

  journalList.replaceChildren(
    ...snapshot.journal.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry.text;
      return item;
    }),
  );

  const focusedHotspotId =
    document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('hotspot')
      ? document.activeElement.dataset.hotspotId
      : undefined;
  hotspotLayer.replaceChildren(
    ...availableHotspots(nodeState, snapshot).map((hotspot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = hotspot.clueHighlight ? 'hotspot hotspot-clue' : 'hotspot';
      button.dataset.hotspotId = hotspot.id;
      button.title = hotspot.label;
      const bounds = polygonBounds(hotspot.polygon);
      button.style.left = `${bounds.minX}%`;
      button.style.top = `${bounds.minY}%`;
      button.style.width = `${bounds.width}%`;
      button.style.height = `${bounds.height}%`;
      button.style.setProperty('--assist-threshold', String(hotspot.shimmerThreshold ?? 0.55));
      const label = document.createElement('span');
      label.className = 'hotspot-label';
      label.textContent = hotspot.label;
      button.append(label);
      if (hotspot.clueHighlight) {
        // Segmented clue: the silhouette itself is the affordance. The SVG
        // outline traces the object; the clip-path limits the hit area to it.
        button.style.clipPath = clipPathWithinBounds(hotspot.polygon, bounds);
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'clue-outline');
        svg.setAttribute('viewBox', '0 0 100 100');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        const shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        shape.setAttribute('points', svgPointsWithinBounds(hotspot.polygon, bounds));
        svg.append(shape);
        button.append(svg);
      } else {
        button.style.clipPath = clipPathWithinBounds(hotspot.polygon, bounds);
      }
      button.addEventListener('click', () => activateHotspot(hotspot));
      return button;
    }),
  );
  // replaceChildren destroys the focused button; without this, every keyboard
  // activation dumps focus to <body> and tab order restarts from the top.
  if (focusedHotspotId) {
    const sameHotspot = hotspotLayer.querySelector<HTMLButtonElement>(`[data-hotspot-id="${cssEscape(focusedHotspotId)}"]`);
    (sameHotspot ?? hotspotLayer.querySelector<HTMLButtonElement>('.hotspot'))?.focus();
  }
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

function activateHotspot(hotspot: HotspotDefinition) {
  const puzzle = createPuzzleProgression(state.snapshot().completedPuzzles);
  if (hotspot.puzzleAction) {
    const result = puzzle.apply(hotspot.puzzleAction);
    if (!result.ok) {
      showCaption(result.reason ?? 'The evidence is not ready yet.');
      return;
    }
    state.completePuzzle(hotspot.puzzleAction);
    state.setFlag(`puzzle:${hotspot.puzzleAction}`);
    if (result.discoveredTimecode) {
      state.discoverTimecode(result.discoveredTimecode);
    }
  }

  state.applyHotspot(hotspot);
  const target = resolveHotspotTarget(hotspot, state.snapshot());
  const finishNavigation = () => {
    if (target) {
      state.setCurrentNode(target);
      reseatWindowForNode(target);
    }
    if (hotspot.setFlag?.startsWith('ending:')) {
      try {
        saveSnapshot(state.snapshot());
      } catch {
        // storage full/unavailable — the ending still plays
      }
    }
    if (hotspot.caption) {
      showCaption(hotspot.caption);
    }
    if (hotspot.exhibit) {
      openExhibit(hotspot);
    }
  };
  if (target && target !== state.snapshot().currentNodeId) {
    playTransition(state.snapshot().currentNodeId, target, finishNavigation);
  } else {
    finishNavigation();
  }
}

// --- plate-to-plate transitions (canon A7) ----------------------------------
const transitionIndex = new Map<string, string>(
  (transitionManifest.transitions as { from: string; to: string; window: TimeWindow; src: string }[]).map(
    (entry) => [`${entry.from}|${entry.to}|${entry.window}`, entry.src],
  ),
);
let transitionActive = false;

function playTransition(fromNodeId: string, toNodeId: string, finish: () => void) {
  const src = transitionIndex.get(`${fromNodeId}|${toNodeId}|${state.snapshot().activeWindow}`);
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!src || reducedMotion || transitionActive) {
    finish();
    return;
  }
  transitionActive = true;
  const clip = document.createElement('video');
  clip.className = 'transition-clip';
  clip.src = src;
  clip.muted = true;
  clip.playsInline = true;
  clip.setAttribute('aria-hidden', 'true');
  let done = false;
  const conclude = () => {
    if (done) return;
    done = true;
    transitionActive = false;
    finish();
    // The destination plate is the clip's final frame; remove after the swap
    // renders so there is no flash between them.
    requestAnimationFrame(() => clip.remove());
    clip.removeEventListener('ended', conclude);
    stage.removeEventListener('pointerdown', conclude);
    document.removeEventListener('keydown', concludeOnKey);
  };
  const concludeOnKey = () => conclude();
  clip.addEventListener('ended', conclude);
  // The move is skippable: any click or key lands the player immediately.
  stage.addEventListener('pointerdown', conclude);
  document.addEventListener('keydown', concludeOnKey);
  // If the clip cannot play (missing file, decode error), fall through.
  clip.addEventListener('error', conclude);
  window.setTimeout(conclude, 8000); // hard ceiling — never trap the player
  stage.append(clip);
  const playResult = clip.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch(() => conclude());
  }
}

function reseatWindowForNode(nodeId: string) {
  // Walking into a place the tape never recorded in the current window (e.g.
  // stepping into the nine minutes while seated at 20:17) jumps the tape to
  // the nearest window that node defines, keeping the timestamp truthful.
  const snapshot = state.snapshot();
  const node = getNode(graph, nodeId);
  const states = node.temporalStates;
  if (!states || states[snapshot.activeWindow]) {
    return;
  }
  const discoveredStates = Object.fromEntries(
    Object.entries(states).filter(([window]) => snapshot.discoveredTimecodes.includes(window as TimeWindow)),
  ) as typeof states;
  const reseat = nearestDefinedWindow(discoveredStates, snapshot.activeWindow) ?? nearestDefinedWindow(states, snapshot.activeWindow);
  if (!reseat) {
    return;
  }
  state.setActiveWindow(reseat);
  jogState = createJogWheelState(reseat, jogOptions());
  setTransportMessage(`TAPE JUMPS: WORLD RE-SEATED TO ${reseat}`);
}

function showCaption(text: string) {
  if (state.snapshot().captionsEnabled) {
    caption.textContent = text;
  }
}

let modalReturnFocus: HTMLElement | undefined;

function openModal(panel: HTMLElement, closeButton: HTMLButtonElement) {
  modalReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  panel.hidden = false;
  closeButton.focus();
}

function closeModal(panel: HTMLElement) {
  panel.hidden = true;
  if (modalReturnFocus?.isConnected) {
    modalReturnFocus.focus();
  } else {
    (hotspotLayer.querySelector<HTMLButtonElement>('.hotspot') ?? jogWheel).focus();
  }
  modalReturnFocus = undefined;
}

intensity.addEventListener('input', () => state.setVhsIntensity(Number(intensity.value)));
volume.addEventListener('input', () => audio.setVolume(Number(volume.value)));
captions.addEventListener('change', () => state.setCaptionsEnabled(captions.checked));
closeExhibit.addEventListener('click', () => closeModal(exhibitScan));
insertTape.addEventListener('click', () => {
  bootScreen.hidden = true;
  // First user gesture: browsers allow audio from here on.
  audio.unlock();
});
credits.addEventListener('click', () => openModal(colophonPanel, closeColophon));
closeColophon.addEventListener('click', () => closeModal(colophonPanel));
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (!exhibitScan.hidden) {
    closeModal(exhibitScan);
  } else if (!colophonPanel.hidden) {
    closeModal(colophonPanel);
  }
});
jogWheel.addEventListener('pointerdown', (event) => {
  jogWheel.setPointerCapture(event.pointerId);
  dragState = { angle: pointerAngle(event), time: event.timeStamp };
});
jogWheel.addEventListener('pointercancel', () => {
  dragState = undefined;
});
jogWheel.addEventListener('pointermove', (event) => {
  if (!dragState) return;
  const angle = pointerAngle(event);
  const delta = unwrapAngle(angle - dragState.angle);
  const seconds = Math.max(0.016, (event.timeStamp - dragState.time) / 1000);
  const result = dragJogWheel(jogState, delta, seconds, jogOptions());
  jogState = result.state;
  if (result.event === 'hard-stop') announceHardStop();
  dragState = { angle, time: event.timeStamp };
  render();
});
jogWheel.addEventListener('pointerup', (event) => {
  try {
    jogWheel.releasePointerCapture(event.pointerId);
  } catch {
    // capture already lost
  }
  dragState = undefined;
  settleJogWheel();
});
jogWheel.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 0.32 : -0.32;
    const result = dragJogWheel(jogState, delta, 0.1, jogOptions());
    jogState = result.state;
    if (result.event === 'hard-stop') announceHardStop();
    render();
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    settleJogWheel();
  }
});
save.addEventListener('click', () => {
  try {
    saveSnapshot(state.snapshot());
    save.textContent = 'BOOKMARK SAVED';
  } catch {
    save.textContent = 'BOOKMARK FAILED — STORAGE UNAVAILABLE';
  }
  window.setTimeout(() => {
    save.textContent = 'BOOKMARK TAPE STATE';
  }, 1200);
});

function seekWindow(requested: TimeWindow) {
  const snapshot = state.snapshot();
  const timeseek = createTimeSeek(graph, snapshot.activeWindow, snapshot.discoveredTimecodes);
  const result = timeseek.seek(requested);
  if (!result.ok) {
    setTransportMessage(result.reason ?? 'TIMESEEK rejected.');
    return;
  }
  audio.playCue('audio/jog-detent-clunk.wav', `TIMESEEK detent clunk: ${result.activeWindow}`);
  state.setActiveWindow(result.activeWindow);
  stage.classList.remove('seek-glitch');
  void stage.offsetWidth;
  stage.classList.add('seek-glitch');
  window.setTimeout(() => stage.classList.remove('seek-glitch'), 900);
  setTransportMessage(`CLUNK: WORLD RE-SEATED TO ${result.activeWindow}`);
}

function settleJogWheel() {
  for (let i = 0; i < 24; i += 1) {
    jogState = stepJogWheel(jogState, 1 / 30, jogOptions()).state;
  }
  const result = seatNearestDetent(jogState, jogOptions());
  jogState = result.state;
  if (result.event === 'detent' && result.state.seatedWindow && result.state.seatedWindow !== state.snapshot().activeWindow) {
    seekWindow(result.state.seatedWindow);
  } else {
    render();
  }
}

function jogOptions() {
  const snapshot = state.snapshot();
  return { ...defaultJogWheelOptions, discovered: snapshot.discoveredTimecodes, locked: graph.lockedWindows.filter((window) => !snapshot.discoveredTimecodes.includes(window)) };
}

function pointerAngle(event: PointerEvent): number {
  const rect = jogWheel.getBoundingClientRect();
  return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2));
}

function unwrapAngle(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

let lastHardStopCueAt = 0;

function announceHardStop() {
  setTransportMessage('LOCKED 20:26-20:35: tape strains at the hard stop and kicks back.');
  // A long drag grinds against the stop on many consecutive frames; one thunk
  // per strain, not one per pointermove.
  const now = Date.now();
  if (now - lastHardStopCueAt > 700) {
    lastHardStopCueAt = now;
    audio.playCue('audio/tape-hard-stop.wav', 'Tape hard-stop kickback at locked 20:26-20:35.');
  }
}

function diegeticOverlay(nodeId: string): string {
  if (nodeId === 'wagon-interior') return 'VISOR PASS // PRESS — D. REYES — KBLN 88.7';
  if (nodeId === 'mile-marker-271') return 'FM 1187 // MILE 271 // MIRASOL 4';
  if (nodeId === 'field-gate') return 'PADLOCK // 2 7 1 3';
  if (nodeId === 'field-tally') return 'GATE TALLY // II / VII / I / III';
  if (nodeId === 'scanner-radio') return 'LCD // 88.7 FM';
  if (nodeId === 'tipline-printer') return 'TIP LINE // 20:17';
  if (nodeId === 'recorder-nest') return 'RECORDER COUNTER // 20:26';
  if (nodeId === 'ending-eject') return 'EJECT // BOX 271 SEALED';
  if (nodeId === 'ending-record') return 'RECORD // VIEWER TRACK ARMED';
  return '';
}

function openExhibit(hotspot: HotspotDefinition) {
  if (!hotspot.exhibit) return;
  const sourceText = hotspot.journal?.text ?? hotspot.caption ?? hotspot.label;
  const title = document.createElement('h2');
  exhibitPaper.className = `exhibit-paper exhibit-${hotspot.exhibit}`;
  if (hotspot.exhibit === 'flyer') {
    title.textContent = 'MISSING: LENA ORTIZ';
    const photoBlock = document.createElement('div');
    photoBlock.className = 'flyer-photo-block';
    photoBlock.textContent = 'PHOTO BLOCK / HALFTONE COPY';
    const body = document.createElement('p');
    body.className = 'photocopy flyer-copy';
    body.textContent = sourceText.includes('88.7') ? sourceText : `${sourceText} 88.7 FM AFTER SUNDOWN.`;
    const tabs = document.createElement('div');
    tabs.className = 'tear-off-tabs';
    for (let index = 0; index < 5; index += 1) {
      const tab = document.createElement('span');
      tab.textContent = '88.7 FM';
      tabs.append(tab);
    }
    exhibitPaper.replaceChildren(title, photoBlock, body, tabs);
  } else if (hotspot.exhibit === 'dispatch') {
    title.textContent = 'TIP-LINE THERMAL PRINTOUT';
    const leftFeed = document.createElement('div');
    leftFeed.className = 'tractor-feed-left';
    const rightFeed = document.createElement('div');
    rightFeed.className = 'tractor-feed-right';
    const body = document.createElement('pre');
    body.className = 'dot-matrix-line';
    body.textContent = sourceText;
    exhibitPaper.replaceChildren(leftFeed, rightFeed, title, body);
  } else {
    title.textContent = 'INTERVIEW RECORDER COUNTER';
    const body = document.createElement('pre');
    body.textContent = sourceText;
    exhibitPaper.replaceChildren(title, body);
  }
  openModal(exhibitScan, closeExhibit);
}

state.subscribe(render);
render();



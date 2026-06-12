import { createAudioMixer } from '../engine/audioMixer';
import { clipPathWithinBounds, polygonBounds } from '../engine/hotspotGeometry';
import { createJogWheelState, defaultJogWheelOptions, dragJogWheel, seatNearestDetent, stepJogWheel } from '../engine/jogWheel';
import { availableHotspots, getNode, getNodeState, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { loadSnapshot, saveSnapshot } from '../engine/save';
import { createStateMachine } from '../engine/stateMachine';
import { createTimeSeek } from '../engine/timeseek';
import type { HotspotDefinition, SceneManifest, TimeWindow } from '../engine/types';
import { installVhsCompositor } from '../engine/vhsCompositor';
import './styles.css';

const manifestModules = import.meta.glob<SceneManifest>('../content/*.json', { eager: true, import: 'default' });
const manifests = Object.values(manifestModules).filter((manifest) => 'nodes' in manifest);
const graph = loadNodeGraph(manifests);
const initialSave = loadSnapshot();
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
    <header class="deck-header">
      <div class="case-label">TEXAS DPS EVIDENCE DECK // BOX 271 // REYES, D.</div>
      <div class="tape-slot">VCR: DASHCAM TAPE INSERTED</div>
    </header>
    <div class="crt-bezel">
      <div class="tape-stage">
        <img class="scene-still" alt="Recovered highway patrol tape still" />
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
      <section class="journal-panel" aria-label="Annotation journal">
        <h2>JOURNAL</h2>
        <ol class="journal-list"></ol>
      </section>
    </aside>
    <div class="exhibit-scan" hidden role="dialog" aria-modal="true" aria-label="Evidence exhibit scan">
      <article class="exhibit-paper"></article>
      <button class="close-exhibit" type="button">RETURN TO DECK</button>
    </div>
  </section>
`;

const stage = app.querySelector<HTMLDivElement>('.tape-stage')!;
const still = app.querySelector<HTMLImageElement>('.scene-still')!;
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
const jogWheel = app.querySelector<HTMLButtonElement>('.jog-wheel')!;
const timeseekHelp = app.querySelector<HTMLParagraphElement>('.timeseek-help')!;
const journalList = app.querySelector<HTMLOListElement>('.journal-list')!;
const exhibitScan = app.querySelector<HTMLDivElement>('.exhibit-scan')!;
const exhibitPaper = app.querySelector<HTMLElement>('.exhibit-paper')!;
const closeExhibit = app.querySelector<HTMLButtonElement>('.close-exhibit')!;
const compositor = installVhsCompositor(stage, state.snapshot().vhsIntensity);
let jogState = createJogWheelState(state.snapshot().activeWindow, jogOptions());
let dragState: { angle: number; time: number } | undefined;

function render() {
  const snapshot = state.snapshot();
  const nodeState = getNodeState(graph, snapshot.currentNodeId, snapshot.activeWindow);
  still.src = nodeState.still;
  title.textContent = snapshot.currentNodeId.replaceAll('-', ' ').toUpperCase();
  caption.textContent = snapshot.captionsEnabled ? nodeState.caption : '';
  caption.hidden = !snapshot.captionsEnabled;
  wrongness.textContent = nodeState.wrongness ? `TAPE ANOMALY: ${nodeState.wrongness}` : 'TAPE ANOMALY: baseline window stable.';
  intensity.value = String(snapshot.vhsIntensity);
  captions.checked = snapshot.captionsEnabled;
  timestamp.textContent = `APR 12 1998 ${snapshot.activeWindow} TX-DPS`;
  diegeticText.textContent = diegeticOverlay(snapshot.currentNodeId);
  diegeticText.hidden = diegeticText.textContent === '';
  timeseekHelp.textContent = `DISCOVERED: ${snapshot.discoveredTimecodes.join(' / ')} // LOCKED: ${graph.lockedWindows.join(' / ')}`;
  jogWheel.style.setProperty('--jog-angle', `${jogState.angle}rad`);
  jogWheel.classList.toggle('jog-strain', jogState.strain > 0.35);
  audio.setAmbient(getNode(graph, snapshot.currentNodeId).ambientAudio);
  compositor.setIntensity(snapshot.vhsIntensity);

  journalList.replaceChildren(
    ...snapshot.journal.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry.text;
      return item;
    }),
  );

  hotspotLayer.replaceChildren(
    ...availableHotspots(nodeState, snapshot).map((hotspot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      button.dataset.hotspotId = hotspot.id;
      button.textContent = hotspot.label;
      button.title = hotspot.label;
      const bounds = polygonBounds(hotspot.polygon);
      button.style.left = `${bounds.minX}%`;
      button.style.top = `${bounds.minY}%`;
      button.style.width = `${bounds.width}%`;
      button.style.height = `${bounds.height}%`;
      button.style.clipPath = clipPathWithinBounds(hotspot.polygon, bounds);
      button.style.setProperty('--assist-threshold', String(hotspot.shimmerThreshold ?? 0.55));
      button.addEventListener('click', () => activateHotspot(hotspot));
      return button;
    }),
  );
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
  if (target) {
    state.setCurrentNode(target);
  }
  if (hotspot.caption) {
    showCaption(hotspot.caption);
  }
  if (hotspot.exhibit) {
    openExhibit(hotspot.exhibit);
  }
}

function showCaption(text: string) {
  if (state.snapshot().captionsEnabled) {
    caption.textContent = text;
  }
}

intensity.addEventListener('input', () => state.setVhsIntensity(Number(intensity.value)));
volume.addEventListener('input', () => audio.setVolume(Number(volume.value)));
captions.addEventListener('change', () => state.setCaptionsEnabled(captions.checked));
closeExhibit.addEventListener('click', () => {
  exhibitScan.hidden = true;
});
jogWheel.addEventListener('pointerdown', (event) => {
  jogWheel.setPointerCapture(event.pointerId);
  dragState = { angle: pointerAngle(event), time: event.timeStamp };
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
  jogWheel.releasePointerCapture(event.pointerId);
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
  saveSnapshot(state.snapshot());
  save.textContent = 'BOOKMARK SAVED';
  window.setTimeout(() => {
    save.textContent = 'BOOKMARK TAPE STATE';
  }, 1200);
});

function seekWindow(requested: TimeWindow) {
  const snapshot = state.snapshot();
  const timeseek = createTimeSeek(graph, snapshot.activeWindow, snapshot.discoveredTimecodes);
  const result = timeseek.seek(requested);
  if (!result.ok) {
    timeseekHelp.textContent = result.reason ?? 'TIMESEEK rejected.';
    return;
  }
  audio.playCue('audio/jog-detent-clunk.wav', `TIMESEEK detent clunk: ${result.activeWindow}`);
  state.setActiveWindow(result.activeWindow);
  stage.classList.remove('seek-glitch');
  void stage.offsetWidth;
  stage.classList.add('seek-glitch');
  window.setTimeout(() => stage.classList.remove('seek-glitch'), 900);
  timeseekHelp.textContent = `CLUNK: WORLD RE-SEATED TO ${result.activeWindow}`;
}

function settleJogWheel() {
  for (let i = 0; i < 24; i += 1) {
    jogState = stepJogWheel(jogState, 1 / 30, jogOptions()).state;
  }
  const result = seatNearestDetent(jogState, jogOptions());
  jogState = result.state;
  if (result.event === 'detent' && result.state.seatedWindow) {
    seekWindow(result.state.seatedWindow);
  } else {
    render();
  }
}

function jogOptions() {
  const snapshot = state.snapshot();
  return { ...defaultJogWheelOptions, discovered: snapshot.discoveredTimecodes, locked: graph.lockedWindows };
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

function announceHardStop() {
  timeseekHelp.textContent = 'LOCKED 23:26-23:35: tape strains at the hard stop and kicks back.';
  audio.playCue('audio/tape-hard-stop.wav', 'Tape hard-stop kickback at locked 23:26-23:35.');
}

function diegeticOverlay(nodeId: string): string {
  if (nodeId === 'field-gate') return 'PADLOCK // 2 7 1 3';
  if (nodeId === 'field-tally') return 'GATE TALLY // II / VII / I / III';
  if (nodeId === 'patrol-radio') return 'LCD // 88.7 FM';
  if (nodeId === 'dispatch-printer') return 'DOT MATRIX // 23:17';
  if (nodeId === 'recorder-nest') return 'RECORDER COUNTER // 23:26';
  return '';
}

function openExhibit(kind: 'flyer' | 'dispatch' | 'recorder') {
  const exhibits = {
    flyer: '<h2>MISSING: LENA ORTIZ</h2><p class="photocopy">CALL 88.7 FM AFTER SUNDOWN</p><p>Last seen near FM 1187 mile marker 271. If found, do not enter the bluebonnets.</p>',
    dispatch: '<h2>THERMAL DISPATCH PRINTOUT</h2><pre>23:17  REYES, D.\nRESET TAPE TO 23:17\nDO NOT ENTER THE BLUEBONNETS YET.</pre>',
    recorder: '<h2>HANDHELD RECORDER COUNTER</h2><pre>COUNTER: 23:26\nLOCKED SPAN PRESENT // DECK HARD-STOP ACTIVE</pre>',
  };
  exhibitPaper.className = `exhibit-paper exhibit-${kind}`;
  exhibitPaper.innerHTML = exhibits[kind];
  exhibitScan.hidden = false;
}

state.subscribe(render);
render();



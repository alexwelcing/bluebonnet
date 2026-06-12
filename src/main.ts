import { createAudioMixer } from '../engine/audioMixer';
import { clientPointToPercent, routeHotspotAt } from '../engine/hotspotRouter';
import { availableHotspots, getNodeState, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
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
      <form class="timeseek-panel">
        <label for="timeseek">TIMESEEK</label>
        <div class="timeseek-row">
          <input id="timeseek" class="timeseek" name="timeseek" inputmode="numeric" placeholder="23:17" />
          <button type="submit">SEEK</button>
        </div>
        <p class="timeseek-help"></p>
      </form>
      <label class="tracking-control">
        TRACKING
        <input class="intensity" type="range" min="0" max="1" step="0.01" />
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
  </section>
`;

const stage = app.querySelector<HTMLDivElement>('.tape-stage')!;
const still = app.querySelector<HTMLImageElement>('.scene-still')!;
const hotspotLayer = app.querySelector<HTMLDivElement>('.hotspot-layer')!;
const title = app.querySelector<HTMLHeadingElement>('h1')!;
const caption = app.querySelector<HTMLParagraphElement>('.caption')!;
const wrongness = app.querySelector<HTMLParagraphElement>('.wrongness')!;
const timestamp = app.querySelector<HTMLDivElement>('.timestamp')!;
const intensity = app.querySelector<HTMLInputElement>('.intensity')!;
const captions = app.querySelector<HTMLInputElement>('.captions')!;
const save = app.querySelector<HTMLButtonElement>('.save')!;
const timeseekForm = app.querySelector<HTMLFormElement>('.timeseek-panel')!;
const timeseekInput = app.querySelector<HTMLInputElement>('.timeseek')!;
const timeseekHelp = app.querySelector<HTMLParagraphElement>('.timeseek-help')!;
const journalList = app.querySelector<HTMLOListElement>('.journal-list')!;
const compositor = installVhsCompositor(stage, state.snapshot().vhsIntensity);

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
  timeseekHelp.textContent = `DISCOVERED: ${snapshot.discoveredTimecodes.join(' / ')} // LOCKED: ${graph.lockedWindows.join(' / ')}`;
  audio.setAmbient(undefined);
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
      button.textContent = hotspot.label;
      button.title = hotspot.label;
      button.style.clipPath = `polygon(${hotspot.polygon.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
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
}

function showCaption(text: string) {
  if (state.snapshot().captionsEnabled) {
    caption.textContent = text;
  }
}

stage.addEventListener('click', (event) => {
  const snapshot = state.snapshot();
  const point = clientPointToPercent(stage, event.clientX, event.clientY);
  const nodeState = getNodeState(graph, snapshot.currentNodeId, snapshot.activeWindow);
  const hotspot = routeHotspotAt({ id: 'active-state', title: '', still: nodeState.still, caption: nodeState.caption, hotspots: availableHotspots(nodeState, snapshot) }, point);
  if (hotspot) {
    activateHotspot(hotspot);
  }
});

intensity.addEventListener('input', () => state.setVhsIntensity(Number(intensity.value)));
captions.addEventListener('change', () => state.setCaptionsEnabled(captions.checked));
timeseekForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const requested = normalizeTimeSeek(timeseekInput.value);
  if (!requested) {
    timeseekHelp.textContent = 'TIMESEEK accepts discovered windows: 23:08-23:17, 23:17-23:26. Nine minutes remain locked.';
    return;
  }
  const snapshot = state.snapshot();
  const timeseek = createTimeSeek(graph, snapshot.activeWindow, snapshot.discoveredTimecodes);
  const result = timeseek.seek(requested);
  if (!result.ok) {
    timeseekHelp.textContent = result.reason ?? 'TIMESEEK rejected.';
    return;
  }
  state.setActiveWindow(result.activeWindow);
  stage.classList.remove('seek-glitch');
  void stage.offsetWidth;
  stage.classList.add('seek-glitch');
  window.setTimeout(() => stage.classList.remove('seek-glitch'), 900);
  timeseekHelp.textContent = `WORLD RE-SEATED TO ${result.activeWindow}`;
});
save.addEventListener('click', () => {
  saveSnapshot(state.snapshot());
  save.textContent = 'BOOKMARK SAVED';
  window.setTimeout(() => {
    save.textContent = 'BOOKMARK TAPE STATE';
  }, 1200);
});

state.subscribe(render);
render();

function normalizeTimeSeek(value: string): TimeWindow | undefined {
  const compact = value.trim();
  if (compact === '23:08' || compact === '23:08-23:17') {
    return '23:08-23:17';
  }
  if (compact === '23:17' || compact === '23:17-23:26') {
    return '23:17-23:26';
  }
  if (compact === '23:26' || compact === '23:26-23:35') {
    return '23:26-23:35';
  }
  return undefined;
}

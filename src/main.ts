import { createAudioMixer } from '../engine/audioMixer';
import { clientPointToPercent, routeHotspotAt } from '../engine/hotspotRouter';
import { availableHotspots, getNode, loadNodeGraph, resolveHotspotTarget } from '../engine/nodeGraph';
import { loadSnapshot, saveSnapshot } from '../engine/save';
import { createStateMachine } from '../engine/stateMachine';
import type { SceneManifest } from '../engine/types';
import { installVhsCompositor } from '../engine/vhsCompositor';
import './styles.css';

const manifestModules = import.meta.glob<SceneManifest>('../content/*.json', { eager: true, import: 'default' });
const manifests = Object.values(manifestModules);
const graph = loadNodeGraph(manifests);
const initialSave = loadSnapshot();
const state = createStateMachine(initialSave ?? { currentNodeId: graph.startNodeId });
const audio = createAudioMixer();
const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app root.');
}

app.innerHTML = `
  <section class="tape-shell" aria-label="Recovered dashcam tape player">
    <div class="tape-stage">
      <img class="scene-still" alt="Recovered highway dashcam still" />
      <div class="hotspot-layer" aria-label="Scene hotspots"></div>
      <div class="scanlines" aria-hidden="true"></div>
      <div class="tracking tracking-a" aria-hidden="true"></div>
      <div class="tracking tracking-b" aria-hidden="true"></div>
      <div class="timestamp" aria-live="off"></div>
    </div>
    <aside class="crt-panel">
      <p class="eyebrow">BLUEBONNET // DPS-REC-271</p>
      <h1></h1>
      <p class="caption" aria-live="polite"></p>
      <div class="controls">
        <label>
          VHS intensity
          <input class="intensity" type="range" min="0" max="1" step="0.01" />
        </label>
        <button class="save" type="button">Save snapshot</button>
      </div>
      <div class="flag-readout" aria-live="polite"></div>
    </aside>
  </section>
`;

const stage = app.querySelector<HTMLDivElement>('.tape-stage')!;
const still = app.querySelector<HTMLImageElement>('.scene-still')!;
const hotspotLayer = app.querySelector<HTMLDivElement>('.hotspot-layer')!;
const title = app.querySelector<HTMLHeadingElement>('h1')!;
const caption = app.querySelector<HTMLParagraphElement>('.caption')!;
const timestamp = app.querySelector<HTMLDivElement>('.timestamp')!;
const intensity = app.querySelector<HTMLInputElement>('.intensity')!;
const save = app.querySelector<HTMLButtonElement>('.save')!;
const flagReadout = app.querySelector<HTMLDivElement>('.flag-readout')!;
const compositor = installVhsCompositor(stage, state.snapshot().vhsIntensity);

function render() {
  const snapshot = state.snapshot();
  const node = getNode(graph, snapshot.currentNodeId);
  still.src = node.still;
  title.textContent = node.title;
  caption.textContent = node.caption ?? '';
  intensity.value = String(snapshot.vhsIntensity);
  timestamp.textContent = makeTimestamp(snapshot.currentNodeId);
  flagReadout.textContent = snapshot.flags.radioTouched
    ? 'STATE: radioTouched=true — a new center hotspot now routes directly to the field edge.'
    : 'STATE: radioTouched=false — touch the patrol radio hotspot to wake the tape.';
  audio.setAmbient(node.ambientAudio);
  compositor.setIntensity(snapshot.vhsIntensity);

  hotspotLayer.replaceChildren(
    ...availableHotspots(node, snapshot).map((hotspot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hotspot';
      button.textContent = hotspot.label;
      button.title = hotspot.label;
      button.style.clipPath = `polygon(${hotspot.polygon.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;
      button.addEventListener('click', () => activateHotspot(hotspot.id));
      return button;
    }),
  );
}

function activateHotspot(hotspotId: string) {
  const snapshot = state.snapshot();
  const node = getNode(graph, snapshot.currentNodeId);
  const hotspot = availableHotspots(node, snapshot).find((candidate) => candidate.id === hotspotId);
  if (!hotspot) {
    return;
  }

  state.applyHotspot(hotspot);
  const target = resolveHotspotTarget(hotspot, state.snapshot());
  if (target) {
    state.setCurrentNode(target);
  }
  if (hotspot.caption) {
    caption.textContent = hotspot.caption;
  }
}

stage.addEventListener('click', (event) => {
  const point = clientPointToPercent(stage, event.clientX, event.clientY);
  const node = getNode(graph, state.snapshot().currentNodeId);
  const hotspot = routeHotspotAt({ ...node, hotspots: availableHotspots(node, state.snapshot()) }, point);
  if (hotspot) {
    activateHotspot(hotspot.id);
  }
});

intensity.addEventListener('input', () => state.setVhsIntensity(Number(intensity.value)));
save.addEventListener('click', () => {
  saveSnapshot(state.snapshot());
  save.textContent = 'Saved to localStorage';
  window.setTimeout(() => {
    save.textContent = 'Save snapshot';
  }, 1200);
});

state.subscribe(render);
render();

function makeTimestamp(nodeId: string): string {
  const base = nodeId === 'dashcam-shoulder' ? '23:17:04' : nodeId === 'mile-marker' ? '23:17:11' : '23:17:██';
  return `1998-04-12 ${base} TX-DPS`; 
}

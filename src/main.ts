import { createAudioMixer, type FoleyKind } from '../engine/audioMixer';
import { createControlUiEngine } from '../engine/controlUiEngine';
import type { ControlUiEngine, ControlUiEvent, ControlUiIntent } from '../engine/controlUiEngine';
import { clipPathWithinBounds, polygonBounds, svgPointsWithinBounds } from '../engine/hotspotGeometry';
import { createJogWheelState, defaultJogWheelOptions, dragJogWheel, seatNearestDetent, stepJogWheel } from '../engine/jogWheel';
import { conditionsMet, getNode, getNodeState, loadNodeGraph, nearestDefinedWindow, resolveHotspotTarget } from '../engine/nodeGraph';
import { createPuzzleProgression } from '../engine/puzzle';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../engine/save';
import { createStateMachine } from '../engine/stateMachine';
import { createTimeSeek } from '../engine/timeseek';
import { FINAL_TIME_WINDOW, TIME_WINDOWS, nearestTimeWindow } from '../engine/timeWindows';
import type { HotspotDefinition, SceneManifest, TimeWindow } from '../engine/types';
import { installVhsCompositor } from '../engine/vhsCompositor';
import transitionManifest from '../content/transitions.json';
import preludeManifest from '../content/prelude.json';
import ambienceManifest from '../content/ambience.json';
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
        <p class="boot-spine">BOX 271 · FM 1187 · HI8</p>
        <p class="boot-note">WEAR HEADPHONES</p>
        <button class="insert-tape" type="button">INSERT TAPE</button>
        <p class="side-b-note" hidden>THERE IS WRITING ON THE OTHER LABEL.</p>
        <button class="insert-side-b" type="button" hidden>INSERT TAPE — SIDE B</button>
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
        <img class="compare-layer" hidden alt="" aria-hidden="true" />
        <div class="scanlines" aria-hidden="true"></div>
        <div class="tracking tracking-a" aria-hidden="true"></div>
        <div class="tracking tracking-b" aria-hidden="true"></div>
        <div class="diegetic-text" aria-live="off"></div>
        <div class="timestamp" aria-live="off"></div>
        <p class="caption" aria-live="polite"></p>
        <p class="hotspot-hint" aria-hidden="true"></p>
      </div>
    </div>
    <button class="panel-toggle" type="button" aria-expanded="false" aria-controls="deck-controls" title="Toggle the deck panel (D)">DECK ▤</button>
    <aside class="deck-controls" id="deck-controls">
      <div class="readout">
        <p class="eyebrow">CURRENT NODE</p>
        <h1></h1>
        <p class="wrongness"></p>
      </div>
      <div class="timeseek-panel">
        <p class="timeseek-label">TIMESEEK TRANSPORT</p>
        <div class="tape-ruler" role="group" aria-label="Tape cue points">
          <button class="cue" type="button" data-window="20:08-20:17"><span class="cue-time">20:08</span></button>
          <button class="cue" type="button" data-window="20:17-20:26"><span class="cue-time">20:17</span></button>
          <button class="cue" type="button" data-window="20:26-20:35"><span class="cue-time">20:26</span></button>
          <div class="tape-needle" aria-hidden="true"></div>
        </div>
        <div class="jog-cluster">
          <div class="jog-ring" aria-hidden="true">
            <span class="ring-tick" data-window="20:08-20:17"></span>
            <span class="ring-tick" data-window="20:17-20:26"></span>
            <span class="ring-tick" data-window="20:26-20:35"></span>
          </div>
          <button class="jog-wheel" type="button" aria-label="TIMESEEK jog wheel. Drag to scrub tape time; arrow keys nudge; Enter seats nearest discovered detent.">
            <span class="jog-marker"></span>
          </button>
        </div>
        <p class="tape-readout" aria-live="off"></p>
        <p class="timeseek-help"></p>
      </div>
      <button class="compare" type="button" aria-pressed="false" title="Hold to superimpose the other tape pass over this frame">DUB COMPARE — HOLD (C)</button>
      <label class="tracking-control">
        <span class="control-title">TRACKING <em class="control-hint">noise up — evidence shimmers</em></span>
        <input class="intensity" type="range" min="0" max="1" step="0.01" />
        <span class="fader-scale"><i>CLEAN</i><i class="assist-notch">▲ ASSIST</i><i>NOISY</i></span>
      </label>
      <label class="volume-control">
        <span class="control-title">VOLUME</span>
        <input class="volume" type="range" min="0" max="1" step="0.01" value="0.7" />
        <span class="fader-scale"><i>MUTE</i><i></i><i>FULL</i></span>
      </label>
      <label class="caption-toggle">
        <input class="captions" type="checkbox" />
        CAPTIONS
      </label>
      <button class="save" type="button">BOOKMARK TAPE STATE</button>
      <button class="replay-broadcast" type="button">⏮ REPLAY THE LAST BROADCAST</button>
      <button class="rewind" type="button" hidden>⏮ REWIND TAPE — START OVER</button>
      <button class="credits" type="button">CREDITS / COLOPHON</button>
      <section class="journal-panel" aria-label="Annotation journal">
        <h2>JOURNAL</h2>
        <ol class="journal-list"></ol>
      </section>
    </aside>
    <div class="mechanism" hidden role="dialog" aria-modal="true" aria-label="Deck mechanism">
      <div class="mechanism-panel"></div>
      <button class="close-mechanism" type="button">STEP BACK</button>
    </div>
    <div class="prelude" hidden role="dialog" aria-label="Recovered broadcast — Dana Reyes, final sign-off">
      <div class="prelude-media" aria-hidden="true"></div>
      <p class="prelude-eyebrow"></p>
      <p class="prelude-line" aria-live="polite"></p>
      <button class="prelude-skip" type="button">SKIP THE BROADCAST ⏭</button>
    </div>
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
const hotspotHint = app.querySelector<HTMLParagraphElement>('.hotspot-hint')!;
const title = app.querySelector<HTMLHeadingElement>('h1')!;
const caption = app.querySelector<HTMLParagraphElement>('.caption')!;
const wrongness = app.querySelector<HTMLParagraphElement>('.wrongness')!;
const timestamp = app.querySelector<HTMLDivElement>('.timestamp')!;
const diegeticText = app.querySelector<HTMLDivElement>('.diegetic-text')!;
const intensity = app.querySelector<HTMLInputElement>('.intensity')!;
const volume = app.querySelector<HTMLInputElement>('.volume')!;
const captions = app.querySelector<HTMLInputElement>('.captions')!;
const save = app.querySelector<HTMLButtonElement>('.save')!;
const rewind = app.querySelector<HTMLButtonElement>('.rewind')!;
const credits = app.querySelector<HTMLButtonElement>('.credits')!;
const bootScreen = app.querySelector<HTMLDivElement>('.boot-screen')!;
const insertTape = app.querySelector<HTMLButtonElement>('.insert-tape')!;
const jogWheel = app.querySelector<HTMLButtonElement>('.jog-wheel')!;
const cueButtons = [...app.querySelectorAll<HTMLButtonElement>('.cue')];
const ringTicks = [...app.querySelectorAll<HTMLSpanElement>('.ring-tick')];
const tapeNeedle = app.querySelector<HTMLDivElement>('.tape-needle')!;
const tapeReadout = app.querySelector<HTMLParagraphElement>('.tape-readout')!;
const compareButton = app.querySelector<HTMLButtonElement>('.compare')!;
const compareLayer = app.querySelector<HTMLImageElement>('.compare-layer')!;
const panelToggle = app.querySelector<HTMLButtonElement>('.panel-toggle')!;
const deckControls = app.querySelector<HTMLElement>('.deck-controls')!;
const timeseekHelp = app.querySelector<HTMLParagraphElement>('.timeseek-help')!;
const journalList = app.querySelector<HTMLOListElement>('.journal-list')!;
const exhibitScan = app.querySelector<HTMLDivElement>('.exhibit-scan')!;
const exhibitPaper = app.querySelector<HTMLElement>('.exhibit-paper')!;
const closeExhibit = app.querySelector<HTMLButtonElement>('.close-exhibit')!;
const colophonPanel = app.querySelector<HTMLDivElement>('.colophon-panel')!;
const closeColophon = app.querySelector<HTMLButtonElement>('.close-colophon')!;
jogWheel.dataset.controlId = 'deck.timeseek';
let lastInputWasKeyboard = false;
document.addEventListener('keydown', () => { lastInputWasKeyboard = true; }, { capture: true });
document.addEventListener('pointerdown', () => { lastInputWasKeyboard = false; }, { capture: true });

function installMomentaryActuation(root: ParentNode = document) {
  for (const control of root.querySelectorAll<HTMLButtonElement>('button')) {
    if (control.dataset.actuationInstalled === 'true') continue;
    control.dataset.actuationInstalled = 'true';
    // Controls that own a more specific foley (jog detent, compare latch, the
    // drawer mechanism, tape transport) are excluded so they don't double up.
    const ownsFoley = control.matches('.jog-wheel, .compare, .panel-toggle, .insert-tape, .insert-side-b');
    const actuate = () => {
      control.classList.remove('actuated');
      void control.offsetWidth;
      control.classList.add('actuated');
      window.setTimeout(() => control.classList.remove('actuated'), 180);
      if (!ownsFoley) audio.playFoley('button', 'Deck control.');
    };
    control.addEventListener('pointerdown', actuate);
    control.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') actuate();
    });
  }
}

function dispatchControl(engine: ControlUiEngine, event: ControlUiEvent, root: ParentNode = document) {
  engine.dispatch(event);
  applyControlIntents(engine.drainIntents(), root);
}

function applyControlIntents(intents: ControlUiIntent[], root: ParentNode) {
  for (const intent of intents) {
    const control = root.querySelector<HTMLElement>(`[data-control-id="${cssEscape(intent.controlId)}"]`);
    if (intent.type === 'animation') {
      applyAnimationIntent(intent, control, root);
    } else {
      playControlCue(intent.cue, intent.controlId);
    }
  }
}

function applyAnimationIntent(intent: Extract<ControlUiIntent, { type: 'animation' }>, control: HTMLElement | null, root: ParentNode) {
  const pulse = (className: string, ms = 220) => {
    const target = control ?? (root instanceof HTMLElement ? root : undefined);
    if (!target) return;
    target.classList.remove(className);
    void target.offsetWidth;
    target.classList.add(className);
    window.setTimeout(() => target.classList.remove(className), ms);
  };
  if (intent.input === 'press') {
    control?.classList.toggle('actuated', intent.value === true);
    if (intent.value === false) window.setTimeout(() => control?.classList.remove('actuated'), 80);
  }
  if (intent.input === 'value' && typeof intent.value === 'number') {
    control?.style.setProperty('--control-value', String(intent.value));
    pulse('fader-moving', 260);
  }
  if (intent.input === 'position' && typeof intent.value === 'number') {
    control?.style.setProperty('--control-position', String(intent.value));
    pulse('control-seated', 260);
  }
  if (intent.input === 'strain') pulse('control-refusing', 420);
  if (intent.input === 'step') pulse('digit-tumble', 180);
  if (intent.input === 'knock') pulse('pipe-knock-pulse', 220);
  if (intent.input === 'rest') pulse('pipe-rest-pulse', 260);
  if (intent.input === 'play') pulse('pipe-playback-pulse', 420);
  if (intent.input === 'clear') pulse('pipe-clear-pulse', 220);
}

function playControlCue(cue: string, controlId: string) {
  // Each control gesture gets its own synthesized foley so the deck has a real
  // tactile vocabulary instead of one reused clunk (canon A11: the control UI is
  // the signature). Captions are unchanged.
  const foleyMap: Record<string, FoleyKind> = {
    'button-thunk': 'button',
    'detent-cross': 'tick',
    'detent-clunk': 'detent-heavy',
    'wheel-click': 'tick',
    'pipe-knock': 'detent',
    'hard-stop': 'refuse',
  };
  audio.playFoley(foleyMap[cue] ?? 'button', `${controlId}: ${cue}`);
}

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
  // The overlay belongs to one node+window; any movement invalidates it.
  if (compareActive && compareContext !== `${snapshot.currentNodeId}|${snapshot.activeWindow}`) {
    endCompare();
  }
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
  wrongness.textContent = nodeState.wrongness ? `TAPE ANOMALY: ${nodeState.wrongness}` : '';
  intensity.value = String(snapshot.vhsIntensity);
  captions.checked = snapshot.captionsEnabled;
  const sideMode = inSideB(snapshot.currentNodeId);
  app!.querySelector('.evidence-deck')?.classList.toggle('side-b', sideMode);
  if (sideMode) {
    // Side B runs on the player's clock: the tape is live.
    const now = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    timestamp.textContent = `${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')} ${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} LIVE`;
  } else {
    timestamp.textContent = `APR 12 1998 ${snapshot.activeWindow} HI8`;
  }
  // The set on side-tv plays the wagon — tonight.
  let inset = stage.querySelector<HTMLImageElement>('.tv-inset');
  if (snapshot.currentNodeId === 'side-tv') {
    if (!inset) {
      inset = document.createElement('img');
      inset.className = 'tv-inset';
      inset.src = 'stills/act1/wagon-interior__2008-2017.jpg';
      inset.alt = '';
      inset.setAttribute('aria-hidden', 'true');
      stage.append(inset);
    }
  } else {
    inset?.remove();
  }
  diegeticText.textContent = diegeticOverlay(snapshot.currentNodeId);
  diegeticText.hidden = diegeticText.textContent === '';
  const lockedWindows = graph.lockedWindows.filter((window) => !snapshot.discoveredTimecodes.includes(window));
  timeseekHelp.textContent =
    helpOverride ??
    (sideMode
      ? 'SIDE B // THE TAPE IS LIVE'
      : `DRAG THE WHEEL OR PRESS A CUE // ${lockedWindows.length > 0 ? `${lockedWindows.join(' / ')} STILL LOCKED` : 'FULL TAPE OPEN'}`);

  // Tape ruler: cue states + live needle + scrub readout.
  for (const cue of cueButtons) {
    const window = cue.dataset.window as TimeWindow;
    const discovered = snapshot.discoveredTimecodes.includes(window);
    const locked = lockedWindows.includes(window);
    const cueTime = cue.querySelector<HTMLSpanElement>('.cue-time');
    if (cueTime) cueTime.textContent = sideMode ? 'NOW' : window.slice(0, 5);
    cue.classList.toggle('now', sideMode);
    cue.classList.toggle('current', !sideMode && window === snapshot.activeWindow);
    cue.classList.toggle('locked', !sideMode && locked);
    cue.classList.toggle('undiscovered', !sideMode && !discovered && !locked);
    cue.classList.toggle('fresh', window === freshCueWindow);
    cue.setAttribute(
      'aria-label',
      locked ? `Cue ${window}: locked` : discovered ? `Cue to ${window}` : `Cue ${window}: not yet discovered`,
    );
  }
  for (const tick of ringTicks) {
    const window = tick.dataset.window as TimeWindow;
    tick.classList.toggle('lit', snapshot.discoveredTimecodes.includes(window));
    tick.classList.toggle('locked', lockedWindows.includes(window));
  }
  const clamped = Math.max(0, Math.min(2, jogState.position));
  tapeNeedle.style.left = `${((clamped + 0.5) / 3) * 100}%`;
  if (jogState.seatedWindow) {
    tapeReadout.textContent = `SEATED ⏵ ${jogState.seatedWindow}`;
    tapeReadout.classList.remove('scrubbing');
  } else {
    const minutes = 1208 + clamped * 9; // 20:08 + 9 minutes per detent
    const hh = Math.floor(minutes / 60);
    const mm = Math.floor(minutes % 60);
    tapeReadout.textContent = `SCRUB ⏵ ${hh}:${String(mm).padStart(2, '0')}`;
    tapeReadout.classList.add('scrubbing');
  }
  jogWheel.style.setProperty('--jog-angle', `${jogState.angle}rad`);
  jogWheel.classList.toggle('jog-strain', jogState.strain > 0.35);
  audio.setAmbient(nodeState.ambientAudio ?? node.ambientAudio, node.audioMix?.ambient ?? 1);
  compositor.setIntensity(snapshot.vhsIntensity);
  audio.setTapeCondition(snapshot.vhsIntensity); // TRACKING governs ear and eye together
  // The endings are terminal; the deck offers the way back.
  rewind.hidden = !snapshot.currentNodeId.startsWith('ending-');

  journalList.replaceChildren(
    ...snapshot.journal.map((entry) => {
      const item = document.createElement('li');
      item.textContent = entry.text;
      return item;
    }),
  );

  // Only restore focus for keyboard players: programmatic focus after a mouse
  // click paints the focus affordance onto the picture (seen in playthrough).
  const focusedHotspotId =
    lastInputWasKeyboard && document.activeElement instanceof HTMLElement && document.activeElement.classList.contains('hotspot')
      ? document.activeElement.dataset.hotspotId
      : undefined;
  const renderableHotspots = nodeState.hotspots
    .map((hotspot) => ({ hotspot, locked: !conditionsMet(hotspot.requires, snapshot) }))
    .filter(({ hotspot, locked }) => !locked || hotspot.lockedHint);
  hotspotLayer.replaceChildren(
    ...renderableHotspots.map(({ hotspot, locked }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = hotspot.clueHighlight ? 'hotspot hotspot-clue' : 'hotspot';
      if (locked) button.classList.add('hotspot-locked');
      button.dataset.hotspotId = hotspot.id;
      button.title = hotspot.label;
      // Navigation legibility (Myst "you can go here"): a faint resting chevron
      // in the move direction, and the destination label on hover/focus.
      const isNav = Boolean(hotspot.target) && !hotspot.clueHighlight && !locked;
      if (isNav) {
        button.classList.add('hotspot-nav', `nav-${directionFromLabel(hotspot.label)}`);
        const showHint = () => { hotspotHint.textContent = hotspot.label; hotspotHint.classList.add('show'); };
        const hideHint = () => { hotspotHint.classList.remove('show'); };
        button.addEventListener('pointerenter', showHint);
        button.addEventListener('pointerleave', hideHint);
        button.addEventListener('focus', showHint);
        button.addEventListener('blur', hideHint);
      }
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
      button.addEventListener('click', () => {
        if (locked) {
          // The lock refuses out loud instead of hiding.
          showCaption(hotspot.lockedHint ?? 'It will not move yet.');
          audio.playFoley('refuse', 'The deck refuses.');
          return;
        }
        activateHotspot(hotspot);
      });
      return button;
    }),
  );
  installMomentaryActuation(hotspotLayer);
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

let freshCueWindow: TimeWindow | undefined;
let freshCueTimer: number | undefined;

// A new timecode is the biggest moment in the game's grammar; it must not
// pass silently (playtest: "reset tape to 20:17" never met the transport).
function announceDiscovery(discovered: TimeWindow) {
  freshCueWindow = discovered;
  if (freshCueTimer !== undefined) window.clearTimeout(freshCueTimer);
  freshCueTimer = window.setTimeout(() => {
    freshCueWindow = undefined;
    freshCueTimer = undefined;
    render();
  }, 12000);
  setTransportMessage(`NEW TIMECODE ON THE RULER: ${discovered} — PRESS THE CUE OR WIND THE WHEEL.`);
}

// --- MECHANISMS: puzzles the player operates, not clicks through -------------
const mechanismRoot = app.querySelector<HTMLDivElement>('.mechanism')!;
const mechanismPanel = mechanismRoot.querySelector<HTMLDivElement>('.mechanism-panel')!;
const closeMechanism = mechanismRoot.querySelector<HTMLButtonElement>('.close-mechanism')!;

function openMechanism(hotspot: HotspotDefinition) {
  const succeed = () => {
    closeModal(mechanismRoot);
    proceedWithHotspot(hotspot);
  };
  if (hotspot.mechanism === 'radio-dial') buildRadioDial(succeed);
  else if (hotspot.mechanism === 'padlock') buildPadlock(succeed);
  else buildKnockPipe(succeed);
  openModal(mechanismRoot, closeMechanism);
}
closeMechanism.addEventListener('click', () => closeModal(mechanismRoot));

function mechanismFrame(title: string, hint: string): HTMLDivElement {
  const head = document.createElement('h2');
  head.textContent = title;
  const sub = document.createElement('p');
  sub.className = 'mechanism-hint';
  sub.textContent = hint;
  const body = document.createElement('div');
  body.className = 'mechanism-body';
  mechanismPanel.replaceChildren(head, sub, body);
  return body;
}

function buildRadioDial(succeed: () => void) {
  const body = mechanismFrame('WAGON RADIO — MANUAL TUNER', 'Drag the dial. Somewhere on the band, the static gives way.');
  const radioUi = createControlUiEngine({
    controls: [
      { id: 'radio.frequency', kind: 'fader', min: 87.5, max: 107.9, value: 98.1, detents: [88.7], animation: 'radio/frequency' },
      { id: 'radio.lock', kind: 'button', releaseMs: 150, animation: 'radio/lock', audio: 'button-thunk' },
    ],
  });
  const readout = document.createElement('p');
  readout.className = 'dial-readout';
  const meter = document.createElement('div');
  meter.className = 'dial-meter';
  const meterFill = document.createElement('div');
  meterFill.className = 'dial-meter-fill';
  meter.append(meterFill);
  const dial = document.createElement('input');
  dial.type = 'range';
  dial.className = 'dial-frequency';
  dial.min = '87.5';
  dial.max = '107.9';
  dial.step = '0.1';
  dial.value = '98.1';
  dial.dataset.controlId = 'radio.frequency';
  dial.setAttribute('aria-label', 'Tuning dial, megahertz');
  const lock = document.createElement('button');
  lock.type = 'button';
  lock.className = 'dial-lock';
  lock.dataset.controlId = 'radio.lock';
  lock.textContent = 'LOCK THE STATION';
  const update = () => {
    const frequency = Number(dial.value);
    const strength = Math.max(0, 1 - Math.abs(frequency - 88.7) / 0.6);
    readout.textContent = `${frequency.toFixed(1)} FM`;
    meterFill.style.width = `${Math.round(strength * 100)}%`;
    meter.classList.toggle('dial-signal', strength > 0.8);
    lock.disabled = strength < 0.99;
    lock.textContent = strength < 0.99 ? 'STATIC…' : 'LOCK THE STATION';
  };
  dial.addEventListener('input', () => {
    update();
    dispatchControl(radioUi, { type: 'setValue', id: 'radio.frequency', value: Number(dial.value) }, body);
  });
  lock.addEventListener('click', () => {
    dispatchControl(radioUi, { type: 'press', id: 'radio.lock' }, body);
    succeed();
  });
  body.append(readout, meter, dial, lock);
  installMomentaryActuation(body);
  update();
  dial.focus();
}

function buildPadlock(succeed: () => void) {
  const body = mechanismFrame('FIELD GATE PADLOCK', 'Four digits. The field has been counting; the tally knows the order.');
  const padlockUi = createControlUiEngine({
    controls: [0, 1, 2, 3].map((index) => ({ id: `padlock.${index}`, kind: 'digitWheel' as const, value: 0, min: 0, max: 9, animation: 'padlock/digit' })),
  });
  const wheels = document.createElement('div');
  wheels.className = 'padlock-wheels';
  const digits = [0, 0, 0, 0];
  digits.forEach((_, index) => {
    const wheel = document.createElement('div');
    wheel.className = 'padlock-wheel';
    const up = document.createElement('button');
    up.type = 'button';
    up.textContent = '▲';
    up.setAttribute('aria-label', `Dial ${index + 1} up`);
    const display = document.createElement('span');
    display.textContent = '0';
    display.dataset.controlId = `padlock.${index}`;
    const down = document.createElement('button');
    down.type = 'button';
    down.textContent = '▼';
    down.setAttribute('aria-label', `Dial ${index + 1} down`);
    up.addEventListener('click', () => {
      dispatchControl(padlockUi, { type: 'step', id: `padlock.${index}`, delta: 1 }, body);
      const wheelState = padlockUi.snapshot().controls[`padlock.${index}`];
      digits[index] = wheelState.kind === 'digitWheel' ? wheelState.value : digits[index];
      display.textContent = String(digits[index]);
    });
    down.addEventListener('click', () => {
      dispatchControl(padlockUi, { type: 'step', id: `padlock.${index}`, delta: -1 }, body);
      const wheelState = padlockUi.snapshot().controls[`padlock.${index}`];
      digits[index] = wheelState.kind === 'digitWheel' ? wheelState.value : digits[index];
      display.textContent = String(digits[index]);
    });
    wheel.append(up, display, down);
    wheels.append(wheel);
  });
  const tryHasp = document.createElement('button');
  tryHasp.type = 'button';
  tryHasp.className = 'padlock-try';
  tryHasp.textContent = 'PULL THE HASP';
  const verdict = document.createElement('p');
  verdict.className = 'mechanism-verdict';
  tryHasp.addEventListener('click', () => {
    if (digits.join('') === '2713') {
      audio.playFoley('latch-open', 'The padlock falls open.');
      succeed();
    } else {
      audio.playFoley('refuse', 'The hasp holds.');
      verdict.textContent = 'The hasp holds. The blooms count it differently.';
      wheels.classList.remove('padlock-strain');
      void wheels.offsetWidth;
      wheels.classList.add('padlock-strain');
    }
  });
  body.append(wheels, tryHasp, verdict);
  installMomentaryActuation(body);
}

function buildKnockPipe(succeed: () => void) {
  const body = mechanismFrame('SERVICE PIPE', 'Answer it the way the static asked. Knock, rest, knock.');
  const knockUi = createControlUiEngine({ controls: [{ id: 'pipe.echo', kind: 'knockSequence', animation: 'pipe/knock' }] });
  const pattern: number[] = [0]; // counts per group; REST starts a new group
  const tape = document.createElement('p');
  tape.className = 'knock-tape';
  tape.dataset.controlId = 'pipe.echo';
  const renderTape = () => {
    tape.textContent = pattern.map((count) => '|'.repeat(count)).join('  —  ') || '…';
  };
  const knock = document.createElement('button');
  knock.type = 'button';
  knock.className = 'knock-button';
  knock.textContent = 'KNOCK';
  const rest = document.createElement('button');
  rest.type = 'button';
  rest.textContent = 'REST';
  const playBack = document.createElement('button');
  playBack.type = 'button';
  playBack.textContent = 'PLAY IT BACK';
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.textContent = 'WIPE';
  const verdict = document.createElement('p');
  verdict.className = 'mechanism-verdict';
  const syncPatternFromEngine = () => {
    const pipeState = knockUi.snapshot().controls['pipe.echo'];
    if (pipeState.kind !== 'knockSequence') return;
    pattern.splice(0, pattern.length, ...pipeState.groups);
  };
  knock.addEventListener('click', () => {
    dispatchControl(knockUi, { type: 'knock', id: 'pipe.echo' }, body);
    syncPatternFromEngine();
    renderTape();
  });
  rest.addEventListener('click', () => {
    dispatchControl(knockUi, { type: 'rest', id: 'pipe.echo' }, body);
    syncPatternFromEngine();
    renderTape();
  });
  clear.addEventListener('click', () => {
    dispatchControl(knockUi, { type: 'clear', id: 'pipe.echo' }, body);
    syncPatternFromEngine();
    verdict.textContent = '';
    renderTape();
  });
  playBack.addEventListener('click', () => {
    dispatchControl(knockUi, { type: 'play', id: 'pipe.echo' }, body);
    syncPatternFromEngine();
    const groups = pattern.filter((count) => count > 0);
    if (groups.join(',') === '2,1,3') {
      succeed();
    } else {
      audio.playFoley('refuse', 'The pipe rings wrong.');
      verdict.textContent = 'The pipe rings wrong. Somewhere on the tape, the static knocks it right.';
      pattern.splice(0, pattern.length, 0);
      renderTape();
    }
  });
  const controls = document.createElement('div');
  controls.className = 'knock-controls';
  controls.append(knock, rest, playBack, clear);
  body.append(tape, controls, verdict);
  installMomentaryActuation(body);
  renderTape();
  knock.focus();
}

function activateHotspot(hotspot: HotspotDefinition) {
  if (hotspot.mechanism && hotspot.puzzleAction && !state.snapshot().completedPuzzles.includes(hotspot.puzzleAction)) {
    openMechanism(hotspot);
    return;
  }
  proceedWithHotspot(hotspot);
}

function proceedWithHotspot(hotspot: HotspotDefinition) {
  const before = state.snapshot().discoveredTimecodes;
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
  const nowDiscovered = state.snapshot().discoveredTimecodes;
  const fresh = nowDiscovered.find((window) => !before.includes(window));
  if (fresh) {
    announceDiscovery(fresh);
  }
  const target = resolveHotspotTarget(hotspot, state.snapshot());
  const finishNavigation = () => {
    if (target) {
      state.setCurrentNode(target);
      reseatWindowForNode(target);
    }
    if (hotspot.setFlag?.startsWith('ending:')) {
      try {
        saveSnapshot(state.snapshot());
        localStorage.setItem(SIDE_B_KEY, '1'); // the other label appears
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
    playTransition(state.snapshot().currentNodeId, target, finishNavigation, hotspot.label ?? '');
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

type MoveDir = 'forward' | 'back' | 'left' | 'right' | 'down' | 'up';
function directionFromLabel(label: string): MoveDir {
  const l = label.toLowerCase();
  if (/\bback\b|return|behind|retreat|step back|away|back to|back inside|climb out/.test(l)) return 'back';
  if (/left/.test(l)) return 'left';
  if (/right/.test(l)) return 'right';
  if (/down|floor|ground|lower|crouch|kneel|beneath/.test(l)) return 'down';
  if (/\bup\b|sky|above|overhead|ceiling|look up|stand/.test(l)) return 'up';
  return 'forward';
}

// $0 move-through-world fallback for edges without an authored video clip: a
// short directional dolly + crossfade so navigation is a camera move, not a hard
// cut (the Myst push). Robustly guarded so jsdom navigation still lands.
function playMoveTransition(finish: () => void, hotspotLabel: string) {
  let finished = false;
  const land = () => { if (!finished) { finished = true; finish(); } };
  if (typeof still.animate !== 'function') { land(); return; }
  try {
    transitionActive = true;
    const dir = directionFromLabel(hotspotLabel);
    const depart = document.createElement('img');
    depart.className = 'nav-depart';
    depart.src = still.currentSrc || still.src;
    depart.setAttribute('aria-hidden', 'true');
    stage.append(depart);
    land(); // render the destination plate underneath the departing frame
    const departTo: Record<MoveDir, Keyframe> = {
      forward: { transform: 'scale(1.16)', opacity: 0 },
      back: { transform: 'scale(0.86)', opacity: 0 },
      left: { transform: 'translateX(9%) scale(1.05)', opacity: 0 },
      right: { transform: 'translateX(-9%) scale(1.05)', opacity: 0 },
      down: { transform: 'translateY(-7%) scale(1.05)', opacity: 0 },
      up: { transform: 'translateY(7%) scale(1.05)', opacity: 0 },
    };
    const enterFrom: Record<MoveDir, string> = {
      forward: 'scale(0.94)', back: 'scale(1.1)',
      left: 'translateX(-6%)', right: 'translateX(6%)',
      down: 'translateY(5%)', up: 'translateY(-5%)',
    };
    const DURATION = 360;
    const ease = 'cubic-bezier(.33,0,.2,1)';
    audio.duck(0.45, 0.22);
    audio.playCue(ambienceManifest.transitionBed.src, 'The tape moves.', ambienceManifest.transitionBed.volume * 0.7);
    let done = false;
    const conclude = () => {
      if (done) return;
      done = true;
      transitionActive = false;
      audio.duck(1, 0.4);
      depart.remove();
      stage.removeEventListener('pointerdown', conclude);
      document.removeEventListener('keydown', conclude);
    };
    const anim = depart.animate([{ transform: 'scale(1)', opacity: 1 }, departTo[dir]], { duration: DURATION, easing: ease, fill: 'forwards' });
    still.animate([{ transform: enterFrom[dir], opacity: 0.55 }, { transform: 'none', opacity: 1 }], { duration: DURATION, easing: ease });
    anim.addEventListener('finish', conclude);
    stage.addEventListener('pointerdown', conclude); // skippable
    document.addEventListener('keydown', conclude);
    window.setTimeout(conclude, DURATION + 400); // safety ceiling
  } catch {
    transitionActive = false;
    land();
  }
}

function playTransition(fromNodeId: string, toNodeId: string, finish: () => void, hotspotLabel = '') {
  const src = transitionIndex.get(`${fromNodeId}|${toNodeId}|${state.snapshot().activeWindow}`);
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducedMotion || transitionActive) {
    finish();
    return;
  }
  if (!src) {
    playMoveTransition(finish, hotspotLabel);
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
    audio.duck(1, 0.5);
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
  audio.duck(0.35, 0.3); // the world recedes while the camera moves
  audio.playCue(ambienceManifest.transitionBed.src, 'The tape moves.', ambienceManifest.transitionBed.volume);
  const playResult = clip.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch(() => conclude());
  } else {
    // No real media pipeline (jsdom / very old browsers): land immediately.
    conclude();
  }
}

// --- DUB COMPARE: hold to superimpose the other tape pass --------------------
// The wrongness rule lives in the deltas between windows; this control lets
// the player interrogate them directly. Difference blending makes whatever
// moved between passes glow while everything stable goes dark.
let compareActive = false;
let compareContext = '';

function compareCandidateWindow(): TimeWindow | undefined {
  const snapshot = state.snapshot();
  const states = getNode(graph, snapshot.currentNodeId).temporalStates;
  if (!states) return undefined;
  return nearestTimeWindow(
    TIME_WINDOWS.filter((window) => window !== snapshot.activeWindow && states[window] && snapshot.discoveredTimecodes.includes(window)),
    snapshot.activeWindow,
  );
}

function startCompare() {
  if (compareActive) return;
  const other = compareCandidateWindow();
  if (!other) {
    setTransportMessage('DUB COMPARE: no second pass of this segment on the reel yet.');
    return;
  }
  const snapshot = state.snapshot();
  const otherState = getNodeState(graph, snapshot.currentNodeId, other);
  compareActive = true;
  compareContext = `${snapshot.currentNodeId}|${snapshot.activeWindow}`;
  // The dub pass has its own tape: wow-and-flutter while held.
  try {
    compareWarble = new Audio(ambienceManifest.compareLoop.src);
    compareWarble.loop = true;
    compareWarble.volume = ambienceManifest.compareLoop.volume;
    const warblePlay = compareWarble.play();
    if (warblePlay?.catch) void warblePlay.catch(() => undefined);
  } catch {
    // no media pipeline
  }
  compareLayer.src = otherState.still;
  compareLayer.hidden = false;
  compareButton.setAttribute('aria-pressed', 'true');
  stage.classList.add('comparing');
  setTransportMessage(`DUB COMPARE: ${snapshot.activeWindow} OVER ${other} — what moved glows.`);
  audio.playFoley('latch', 'Dub compare engaged.');
}

let compareWarble: HTMLAudioElement | undefined;

function endCompare() {
  if (!compareActive) return;
  compareActive = false;
  audio.playFoley('button-release', 'Dub compare released.');
  try {
    compareWarble?.pause();
  } catch {
    // best effort
  }
  compareWarble = undefined;
  compareLayer.hidden = true;
  compareLayer.removeAttribute('src');
  compareButton.setAttribute('aria-pressed', 'false');
  stage.classList.remove('comparing');
}

compareButton.addEventListener('pointerdown', startCompare);
compareButton.addEventListener('pointerup', endCompare);
compareButton.addEventListener('pointercancel', endCompare);
compareButton.addEventListener('pointerleave', endCompare);
// Keyboard parity: hold C anywhere, or hold Space/Enter on the focused button.
document.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.key === 'c' || event.key === 'C') startCompare();
  if ((event.key === ' ' || event.key === 'Enter') && document.activeElement === compareButton) {
    event.preventDefault();
    startCompare();
  }
});
document.addEventListener('keyup', (event) => {
  if (event.key === 'c' || event.key === 'C' || event.key === ' ' || event.key === 'Enter') endCompare();
});

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

let panelHinted = false;
function setPanelOpen(open: boolean) {
  deckControls.classList.toggle('open', open);
  // The picture yields space to the open drawer so hotspots are never occluded.
  app!.querySelector('.evidence-deck')?.classList.toggle('panel-open', open);
  panelToggle.setAttribute('aria-expanded', String(open));
  // The drawer is a mechanism: it seats open, it eases shut.
  audio.playFoley(open ? 'detent' : 'button-release', open ? 'Deck drawer slides open.' : 'Deck drawer eases shut.');
  if (open) {
    panelHinted = true;
    panelToggle.classList.remove('hint');
  }
}
// The deck boots closed so the first recovered frame breathes alone; once the
// player is looking at the picture, pulse the toggle once so the cockpit is a
// discoverable reward rather than a hidden control.
function hintPanelToggle() {
  if (panelHinted || deckControls.classList.contains('open')) return;
  panelHinted = true;
  panelToggle.classList.add('hint');
  window.setTimeout(() => panelToggle.classList.remove('hint'), 4200);
}
panelToggle.addEventListener('click', () => setPanelOpen(!deckControls.classList.contains('open')));
document.addEventListener('keydown', (event) => {
  if ((event.key === 'd' || event.key === 'D') && !event.repeat) {
    setPanelOpen(!deckControls.classList.contains('open'));
  }
});

intensity.addEventListener('input', () => state.setVhsIntensity(Number(intensity.value)));
volume.addEventListener('input', () => audio.setVolume(Number(volume.value)));
for (const fader of [intensity, volume]) {
  let faderTimer: number | undefined;
  // A fader is a row of detents: tick as the value crosses each notch, not a
  // continuous buzz on every input event.
  let lastNotch = Math.round(Number(fader.value) * 10);
  fader.addEventListener('input', () => {
    fader.classList.add('fader-moving');
    if (faderTimer !== undefined) window.clearTimeout(faderTimer);
    faderTimer = window.setTimeout(() => fader.classList.remove('fader-moving'), 260);
    const notch = Math.round(Number(fader.value) * 10);
    if (notch !== lastNotch) {
      lastNotch = notch;
      audio.playFoley('tick', 'Fader notch.');
    }
  });
}
captions.addEventListener('change', () => {
  state.setCaptionsEnabled(captions.checked);
  audio.playFoley('latch', captions.checked ? 'Captions on.' : 'Captions off.');
});
closeExhibit.addEventListener('click', () => closeModal(exhibitScan));
// --- THE LAST BROADCAST (prelude) -------------------------------------------
// On a fresh tape, INSERT plays Dana's final 88.7 sign-off over recovered
// images: the why of everything, told before the first frame of gameplay.
const preludeRoot = app.querySelector<HTMLDivElement>('.prelude')!;
const preludeMedia = preludeRoot.querySelector<HTMLDivElement>('.prelude-media')!;
const preludeEyebrow = preludeRoot.querySelector<HTMLParagraphElement>('.prelude-eyebrow')!;
const preludeLine = preludeRoot.querySelector<HTMLParagraphElement>('.prelude-line')!;
const preludeSkip = preludeRoot.querySelector<HTMLButtonElement>('.prelude-skip')!;
const replayBroadcast = app.querySelector<HTMLButtonElement>('.replay-broadcast')!;
let preludeActive = false;
let endPrelude: (() => void) | undefined;

function startPrelude(onDone: () => void) {
  if (preludeActive) return;
  preludeActive = true;
  audio.setMuted(true); // the broadcast owns the soundscape
  preludeRoot.hidden = false;
  preludeEyebrow.textContent = preludeManifest.title;
  preludeLine.textContent = '';
  let slideIndex = -1;
  const broadcast = new Audio(preludeManifest.audio);
  broadcast.volume = 0.95;

  const showSlide = (index: number) => {
    slideIndex = index;
    const slide = preludeManifest.slides[index];
    preludeLine.textContent = slide.line;
    const media =
      slide.type === 'video'
        ? Object.assign(document.createElement('video'), { src: slide.src, muted: true, loop: true, autoplay: true, playsInline: true })
        : Object.assign(document.createElement('img'), { src: slide.src, alt: '' });
    media.className = `prelude-frame ${index % 2 ? 'kb-b' : 'kb-a'}`;
    preludeMedia.replaceChildren(media);
    if (media instanceof HTMLVideoElement) {
      const playResult = media.play();
      if (playResult?.catch) void playResult.catch(() => undefined);
    }
  };

  const onTime = () => {
    const t = broadcast.currentTime;
    const next = slideIndex + 1;
    if (next < preludeManifest.slides.length && t >= preludeManifest.slides[next].start) showSlide(next);
  };

  const finish = () => {
    if (!preludeActive) return;
    preludeActive = false;
    endPrelude = undefined;
    broadcast.pause();
    broadcast.removeEventListener('timeupdate', onTime);
    broadcast.removeEventListener('ended', finish);
    preludeMedia.replaceChildren();
    preludeRoot.hidden = true;
    audio.setMuted(false);
    onDone();
  };
  endPrelude = finish;

  broadcast.addEventListener('timeupdate', onTime);
  broadcast.addEventListener('ended', finish);
  broadcast.addEventListener('error', finish);
  showSlide(0);
  const playResult = broadcast.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch(() => undefined); // stays skippable even if audio fails
  }
}

preludeSkip.addEventListener('click', () => endPrelude?.());
replayBroadcast.addEventListener('click', () => startPrelude(() => undefined));

// --- SIDE B: the tape that watches back (canon A9) ---------------------------
const SIDE_B_KEY = 'bluebonnet.sideb';
const sideBNote = app.querySelector<HTMLParagraphElement>('.side-b-note')!;
const insertSideB = app.querySelector<HTMLButtonElement>('.insert-side-b')!;
if (localStorage.getItem(SIDE_B_KEY) === '1') {
  sideBNote.hidden = false;
  insertSideB.hidden = false;
}
insertSideB.addEventListener('click', () => {
  bootScreen.hidden = true;
  audio.unlock();
  state.setActiveWindow(FINAL_TIME_WINDOW);
  state.setCurrentNode('side-room');
  jogState = createJogWheelState(FINAL_TIME_WINDOW, jogOptions());
});

function inSideB(nodeId: string): boolean {
  return nodeId.startsWith('side-') || nodeId.startsWith('ending-side');
}
// The live clock only matters on Side B; tick the render with it.
window.setInterval(() => {
  if (inSideB(state.snapshot().currentNodeId)) render();
}, 30000);

const freshTape = !initialSave;
insertTape.addEventListener('click', () => {
  bootScreen.hidden = true;
  // First user gesture: browsers allow audio from here on.
  audio.unlock();
  if (freshTape && !preludeActive) {
    startPrelude(() => hintPanelToggle());
  } else {
    hintPanelToggle();
  }
});
credits.addEventListener('click', () => openModal(colophonPanel, closeColophon));
closeColophon.addEventListener('click', () => closeModal(colophonPanel));
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') {
    return;
  }
  if (preludeActive) {
    endPrelude?.();
  } else if (!mechanismRoot.hidden) {
    closeModal(mechanismRoot);
  } else if (!exhibitScan.hidden) {
    closeModal(exhibitScan);
  } else if (!colophonPanel.hidden) {
    closeModal(colophonPanel);
  }
});
for (const cue of cueButtons) {
  cue.addEventListener('click', () => {
    const window = cue.dataset.window as TimeWindow;
    if (cue.classList.contains('now')) {
      setTransportMessage('THE TAPE IS LIVE. THERE IS ONLY NOW.');
      return;
    }
    if (cue.classList.contains('locked')) {
      // The locked span strains exactly like the wheel's hard stop.
      jogState = { ...jogState, strain: 1 };
      announceHardStop();
      render();
      return;
    }
    if (window === state.snapshot().activeWindow) return;
    if (cue.classList.contains('undiscovered')) {
      seekWindow(window); // refused with the in-fiction message; wheel stays put
      return;
    }
    jogState = createJogWheelState(window, jogOptions());
    seekWindow(window);
  });
}

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
rewind.addEventListener('click', () => {
  clearSnapshot();
  try {
    window.location.reload();
  } catch {
    // jsdom — the cleared save is the observable effect
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
  dispatchTimeseekControl({ type: 'seat', id: 'deck.timeseek' }, TIME_WINDOWS.indexOf(result.activeWindow));
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
    if (result.event === 'detent') dispatchTimeseekControl({ type: 'seat', id: 'deck.timeseek' }, result.state.position);
    render();
  }
}

function jogOptions() {
  const snapshot = state.snapshot();
  return { ...defaultJogWheelOptions, discovered: snapshot.discoveredTimecodes, locked: graph.lockedWindows.filter((window) => !snapshot.discoveredTimecodes.includes(window)) };
}

function dispatchTimeseekControl(event: ControlUiEvent, position = jogState.position) {
  const locked = graph.lockedWindows.filter((window) => !state.snapshot().discoveredTimecodes.includes(window));
  const engine = createControlUiEngine({
    controls: [
      {
        id: 'deck.timeseek',
        kind: 'wheel',
        position,
        min: 0,
        max: 2,
        detents: TIME_WINDOWS.map((window, index) => ({ id: window, position: index, locked: locked.includes(window) })),
        animation: 'wheel/timeseek',
      },
    ],
  });
  dispatchControl(engine, event, deckControls);
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
    dispatchTimeseekControl({ type: 'rotate', id: 'deck.timeseek', delta: 1 }, 1);
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
  exhibitPaper.style.background = ''; // reset between exhibit types
  if (hotspot.exhibit === 'flyer') {
    // Real photographed paper under composited text (A1): the plate carries
    // the staples and weathering; the deck carries every readable word.
    exhibitPaper.style.background = "rgba(238,233,220,0.97) center/cover url('stills/exhibits/exhibit-flyer-paper.jpg')";
    title.textContent = 'MISSING: LENA ORTIZ';
    const photoBlock = document.createElement('div');
    photoBlock.className = 'flyer-photo-block';
    photoBlock.style.background = "center/cover url('stills/exhibits/exhibit-flyer-portrait.jpg')";
    photoBlock.setAttribute('role', 'img');
    photoBlock.setAttribute('aria-label', 'Photocopied photograph, face lost in the halftone');
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
    exhibitPaper.style.background = "rgba(240,238,230,0.97) center/cover url('stills/exhibits/exhibit-thermal-paper.jpg')";
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

// --- AMBIENT EVENTS: the world happens at the edge of hearing ----------------
// A quiet one-shot every 25-60s, drawn from the current bed's sound-world.
// Every event is captioned (canon: captions for all audio).
const eventPools = ambienceManifest.pools as Record<string, { src: string; volume: number; caption: string }[]>;
const ambienceFast = typeof localStorage !== 'undefined' && localStorage.getItem('bb-ambience-fast') === '1';

function showTransientCaption(text: string) {
  if (!state.snapshot().captionsEnabled) return;
  caption.textContent = text;
  window.setTimeout(() => render(), 4500);
}

function scheduleAmbientEvent() {
  const { minDelaySeconds, maxDelaySeconds } = ambienceManifest;
  const delay = ambienceFast ? 1500 : (minDelaySeconds + Math.random() * (maxDelaySeconds - minDelaySeconds)) * 1000;
  window.setTimeout(() => {
    const pool = eventPools[audio.currentSource() ?? ''];
    if (pool?.length && !preludeActive && bootScreen.hidden) {
      const event = pool[Math.floor(Math.random() * pool.length)] as { src: string; volume: number; caption: string; pan?: number; panTo?: number; reverb?: boolean };
      audio.playEvent(event.src, { gain: event.volume, caption: event.caption, pan: event.pan, panTo: event.panTo, reverb: event.reverb });
      showTransientCaption(event.caption);
    }
    scheduleAmbientEvent();
  }, delay);
}
scheduleAmbientEvent();

// IDLE SLIP: linger anywhere long enough and the tracking stutters once.
let idleSlipTimer: number | undefined;
function armIdleSlip() {
  if (idleSlipTimer !== undefined) window.clearTimeout(idleSlipTimer);
  idleSlipTimer = window.setTimeout(() => {
    if (bootScreen.hidden && !preludeActive) {
      stage.classList.remove('idle-slip');
      void stage.offsetWidth;
      stage.classList.add('idle-slip');
      audio.dropout(); // the signal loses its grip with the picture
      window.setTimeout(() => stage.classList.remove('idle-slip'), 700);
    }
    armIdleSlip();
  }, (ambienceFast ? 4 : 45 + Math.random() * 45) * 1000);
}
state.subscribe(armIdleSlip);
armIdleSlip();

state.subscribe(render);
render();
installMomentaryActuation(app);



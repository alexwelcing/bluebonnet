#!/usr/bin/env node
// Per-node idle motion loops (canon A4/A6), seeded from the curated plate.
//
// Uses Veo 3.1 first/last-frame-to-video with BOTH frames set to the plate,
// so the loop closes on itself with a mathematically clean seam and frame 0
// matches the still it plays over.
//
//   node tools/generateLoops.mjs gen <act> <nodeId> <window> "<motion prompt>" [seed]
//     → assets/candidates/loops/<node>__<win>__s<seed>.mp4 + a frame strip in
//       /tmp/bluebonnet-loops/ for curation.
//
//   node tools/generateLoops.mjs install <act> <nodeId> <window> <candidateFile> ["<curation note>"]
//     → normalizes to 1024x576 silent mp4, installs to public/video/<act>/ and
//       assets/video/<act>/, wires temporalStates[window].motionLayers, and
//       logs provenance in content/motionLoops.json.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { falRun, imageToDataUri, downloadFile } from './falClient.mjs';

const MODEL = 'fal-ai/veo3.1/first-last-frame-to-video';
const STRIP_DIR = '/tmp/bluebonnet-loops';
const NEGATIVE = 'people, person, hands, body parts, text, letters, numbers, captions, watermark, camera movement, camera pan, camera zoom, scene change, cuts, new objects appearing';

const [mode, act, nodeId, window_, ...rest] = process.argv.slice(2);
const windowSuffix = (w) => w.replaceAll(':', '').replace('-', '-');

function plateFor(act, nodeId, window) {
  const file = `public/stills/${act}/${nodeId}__${window.replaceAll(':', '').split('-').map((p, i) => p).join('-')}.jpg`;
  // window like 20:08-20:17 → 2008-2017
  const suffix = window.split('-').map((t) => t.replace(':', '')).join('-');
  const plate = `public/stills/${act}/${nodeId}__${suffix}.jpg`;
  if (!fs.existsSync(plate)) throw new Error(`Missing plate: ${plate}`);
  return plate;
}

async function gen() {
  const motionPrompt = rest[0];
  const seed = rest[1] ? Number(rest[1]) : 1187;
  if (!motionPrompt) throw new Error('gen requires a motion prompt');
  const plate = plateFor(act, nodeId, window_);
  const suffix = window_.split('-').map((t) => t.replace(':', '')).join('-');
  const candidate = `assets/candidates/loops/${nodeId}__${suffix}__s${seed}.mp4`;
  if (fs.existsSync(candidate)) {
    console.log(`exists: ${candidate}`);
  } else {
    const fullPrompt = `Static locked-off camera, the exact same scene breathing in place: ${motionPrompt}. Subtle analog VHS idle loop, motion only, nothing enters or leaves frame, ends exactly where it began.`;
    console.log(`→ ${MODEL} | ${nodeId} ${window_} | seed ${seed}`);
    const result = await falRun(MODEL, {
      prompt: fullPrompt,
      first_frame_url: imageToDataUri(plate),
      last_frame_url: imageToDataUri(plate),
      duration: '6s',
      resolution: '720p',
      aspect_ratio: '16:9',
      generate_audio: false,
      negative_prompt: NEGATIVE,
      seed,
    }, { retries: 2 });
    const url = result.video?.url;
    if (!url) throw new Error('no video in response');
    await downloadFile(url, candidate);
    fs.writeFileSync(candidate + '.json', JSON.stringify({ model: MODEL, prompt: fullPrompt, seed, sourceUrl: url, plate }, null, 2));
  }
  // Frame strip: 0%, 25%, 50%, 75%, ~100% for curation.
  fs.mkdirSync(STRIP_DIR, { recursive: true });
  const strip = `${STRIP_DIR}/${nodeId}__${suffix}__s${seed}.jpg`;
  const frames = Number(execSync(`ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "${candidate}"`).toString().trim());
  const picks = [0, 0.25, 0.5, 0.75, 0.98].map((f) => Math.min(frames - 1, Math.round(frames * f)));
  execSync(`ffmpeg -y -loglevel error -i "${candidate}" -vf "select='${picks.map((n) => `eq(n\\,${n})`).join('+')}',scale=300:-1,tile=5x1" -frames:v 1 -update 1 "${strip}"`);
  console.log(`candidate: ${candidate}\nstrip: ${strip}`);
}

function install() {
  const candidate = rest[0];
  const note = rest[1] ?? '';
  if (!fs.existsSync(candidate)) throw new Error(`missing ${candidate}`);
  const suffix = window_.split('-').map((t) => t.replace(':', '')).join('-');
  const runtime = `public/video/${act}/${nodeId}__${suffix}.mp4`;
  const master = `assets/video/${act}/${nodeId}__${suffix}.mp4`;
  fs.mkdirSync(path.dirname(runtime), { recursive: true });
  fs.mkdirSync(path.dirname(master), { recursive: true });
  execSync(`ffmpeg -y -loglevel error -i "${candidate}" -vf "scale=1024:576:force_original_aspect_ratio=increase,crop=1024:576" -an -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart "${master}"`);
  fs.copyFileSync(master, runtime);

  const manifestPath = `content/${act}.json`;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const node = manifest.nodes.find((candidateNode) => candidateNode.id === nodeId);
  if (!node?.temporalStates?.[window_]) throw new Error(`no state ${nodeId}/${window_}`);
  const state = node.temporalStates[window_];
  state.motionLayers = [{ src: `video/${act}/${nodeId}__${suffix}.mp4`, opacity: 1, blendMode: 'normal', sourceStill: state.still }];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  const loopsPath = 'content/motionLoops.json';
  const loops = JSON.parse(fs.readFileSync(loopsPath, 'utf8'));
  const meta = fs.existsSync(candidate + '.json') ? JSON.parse(fs.readFileSync(candidate + '.json', 'utf8')) : {};
  loops.loops = loops.loops.filter((entry) => entry.id !== `${nodeId}__${suffix}`);
  loops.loops.push({ id: `${nodeId}__${suffix}`, act, window: window_, runtime: `video/${act}/${nodeId}__${suffix}.mp4`, model: meta.model ?? MODEL, prompt: meta.prompt, seed: meta.seed, sourceUrl: meta.sourceUrl, curation: note, status: 'generated-clean-motion' });
  fs.writeFileSync(loopsPath, JSON.stringify(loops, null, 2) + '\n');
  console.log(`installed ${runtime} + wired ${nodeId}/${window_}`);
}

if (mode === 'gen') await gen();
else if (mode === 'install') install();
else { console.log('usage: gen <act> <node> <window> "<motion prompt>" [seed] | install <act> <node> <window> <candidate> ["note"]'); process.exit(1); }

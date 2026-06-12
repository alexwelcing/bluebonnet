#!/usr/bin/env node
// Plate-to-plate transition clips (canon A7): Veo first/last-frame with
// first = origin plate, last = destination plate → a real camera move.
//
//   node tools/generateTransitions.mjs gen <fromAct> <fromNode> <toAct> <toNode> <window> "<move prompt>" [seed]
//   node tools/generateTransitions.mjs install <fromNode> <toNode> <window> <candidate> ["note"]

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { falRun, imageToDataUri, downloadFile } from './falClient.mjs';

const MODEL = 'fal-ai/veo3.1/first-last-frame-to-video';
const STRIP_DIR = '/tmp/bluebonnet-transitions';
const NEGATIVE = 'people, person, hands, text, letters, numbers, captions, watermark, scene cut, fade to black, crossfade, dissolve, new objects';

const [mode, ...rest] = process.argv.slice(2);
const suffixOf = (w) => w.split('-').map((t) => t.replace(':', '')).join('-');

async function gen() {
  const [fromAct, fromNode, toAct, toNode, window_, movePrompt, seedArg] = rest;
  const seed = seedArg ? Number(seedArg) : 1187;
  const suffix = suffixOf(window_);
  const fromPlate = `public/stills/${fromAct}/${fromNode}__${suffix}.jpg`;
  // Destination may only exist in a different window (e.g. crossing into the
  // nine minutes); take the destination's own window if the shared one is absent.
  let toPlate = `public/stills/${toAct}/${toNode}__${suffix}.jpg`;
  if (!fs.existsSync(toPlate)) {
    const candidates = fs.readdirSync(`public/stills/${toAct}`).filter((f) => f.startsWith(`${toNode}__`));
    if (!candidates.length) throw new Error(`no plates for ${toNode}`);
    toPlate = `public/stills/${toAct}/${candidates[0]}`;
  }
  if (!fs.existsSync(fromPlate)) throw new Error(`missing ${fromPlate}`);
  const candidate = `assets/candidates/transitions/${fromNode}__${toNode}__${suffix}__s${seed}.mp4`;
  if (!fs.existsSync(candidate)) {
    const fullPrompt = `First-person continuous camera move, one unbroken handheld Hi8 shot: ${movePrompt}. Smooth single take, no cuts, ending settled on the final framing.`;
    console.log(`→ ${MODEL} | ${fromNode} → ${toNode} (${window_}) seed ${seed}`);
    const result = await falRun(MODEL, {
      prompt: fullPrompt,
      first_frame_url: imageToDataUri(fromPlate),
      last_frame_url: imageToDataUri(toPlate),
      duration: '4s',
      resolution: '720p',
      aspect_ratio: '16:9',
      generate_audio: false,
      negative_prompt: NEGATIVE,
      seed,
    }, { retries: 2 });
    const url = result.video?.url;
    if (!url) throw new Error('no video');
    await downloadFile(url, candidate);
    fs.writeFileSync(candidate + '.json', JSON.stringify({ model: MODEL, prompt: fullPrompt, seed, sourceUrl: url, fromPlate, toPlate }, null, 2));
  }
  fs.mkdirSync(STRIP_DIR, { recursive: true });
  const strip = `${STRIP_DIR}/${fromNode}__${toNode}__s${seed}.jpg`;
  const frames = Number(execSync(`ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of csv=p=0 "${candidate}"`).toString().trim());
  const picks = [0, 0.25, 0.5, 0.75, 0.98].map((f) => Math.min(frames - 1, Math.round(frames * f)));
  execSync(`ffmpeg -y -loglevel error -i "${candidate}" -vf "select='${picks.map((n) => `eq(n\\,${n})`).join('+')}',scale=300:-1,tile=5x1" -frames:v 1 -update 1 "${strip}"`);
  console.log(`candidate: ${candidate}\nstrip: ${strip}`);
}

function install() {
  const [fromNode, toNode, window_, candidate, note] = rest;
  const suffix = suffixOf(window_);
  const runtime = `public/video/transitions/${fromNode}__${toNode}__${suffix}.mp4`;
  fs.mkdirSync(path.dirname(runtime), { recursive: true });
  fs.mkdirSync('assets/video/transitions', { recursive: true });
  const master = `assets/video/transitions/${fromNode}__${toNode}__${suffix}.mp4`;
  execSync(`ffmpeg -y -loglevel error -i "${candidate}" -vf "scale=1024:576:force_original_aspect_ratio=increase,crop=1024:576" -an -c:v libx264 -pix_fmt yuv420p -crf 21 -movflags +faststart "${master}"`);
  fs.copyFileSync(master, runtime);
  const manifestPath = 'content/transitions.json';
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const meta = fs.existsSync(candidate + '.json') ? JSON.parse(fs.readFileSync(candidate + '.json', 'utf8')) : {};
  manifest.transitions = manifest.transitions.filter((entry) => !(entry.from === fromNode && entry.to === toNode && entry.window === window_));
  manifest.transitions.push({ from: fromNode, to: toNode, window: window_, src: `video/transitions/${fromNode}__${toNode}__${suffix}.mp4`, model: meta.model, prompt: meta.prompt, seed: meta.seed, sourceUrl: meta.sourceUrl, curation: note ?? '' });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`installed ${runtime} + wired ${fromNode} → ${toNode} (${window_})`);
}

if (mode === 'gen') await gen();
else if (mode === 'install') install();
else { console.log('usage: gen <fromAct> <fromNode> <toAct> <toNode> <window> "<move prompt>" [seed] | install <fromNode> <toNode> <window> <candidate> ["note"]'); process.exit(1); }

#!/usr/bin/env node
// Supervised plate regeneration (canon A6).
//
//   node tools/generateStills.mjs gen <act> [candidates=3]
//     Generate candidates for every regen-pending shot in the act into
//     assets/candidates/<act>/, and build per-shot ffmpeg contact sheets in
//     /tmp/bluebonnet-sheets/ for curation.
//
//   node tools/generateStills.mjs install <filename> <candidateIndex> [reason...]
//     Install the chosen candidate as the live plate (assets/ + public/stills/),
//     mark the shot generated-clean, and log pick/reject provenance.

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { falRun, downloadFile, mapWithConcurrency } from './falClient.mjs';

const MODEL = 'fal-ai/flux-2-pro';
const SHOTLIST_PATH = 'content/shotlist.json';
const SHEET_DIR = '/tmp/bluebonnet-sheets';

const shotlist = JSON.parse(fs.readFileSync(SHOTLIST_PATH, 'utf8'));
const [mode, ...rest] = process.argv.slice(2);

function candidatePath(shot, index) {
  return `assets/candidates/${shot.act}/${shot.filename.replace('.jpg', '')}__c${index}.jpg`;
}

async function generate(act, candidates = 3) {
  const pending = shotlist.shots.filter((shot) => shot.act === act && shot.status === 'regen-pending');
  if (!pending.length) {
    console.log(`No regen-pending shots in ${act}.`);
    return;
  }
  console.log(`Generating ${pending.length} shots x ${candidates} candidates via ${MODEL}…`);
  const jobs = pending.flatMap((shot) => Array.from({ length: candidates }, (_, index) => ({ shot, index })));
  await mapWithConcurrency(jobs, 6, async ({ shot, index }) => {
    const destination = candidatePath(shot, index);
    if (fs.existsSync(destination)) return;
    const result = await falRun(MODEL, {
      prompt: shot.prompt,
      image_size: 'landscape_16_9',
      seed: shot.seed + index * 1009,
      output_format: 'jpeg',
    });
    const url = result.images?.[0]?.url;
    if (!url) throw new Error(`no image for ${shot.filename} c${index}`);
    await downloadFile(url, destination);
    shot.candidateUrls = shot.candidateUrls ?? {};
    shot.candidateUrls[`c${index}`] = url;
    console.log(`  ✓ ${shot.filename} c${index}`);
  });
  fs.writeFileSync(SHOTLIST_PATH, JSON.stringify(shotlist, null, 2) + '\n');

  fs.mkdirSync(SHEET_DIR, { recursive: true });
  for (const shot of pending) {
    const inputs = Array.from({ length: candidates }, (_, index) => candidatePath(shot, index)).filter((p) => fs.existsSync(p));
    if (inputs.length < 2) continue;
    const sheet = `${SHEET_DIR}/${shot.act}__${shot.filename.replace('.jpg', '')}.jpg`;
    const inputArgs = inputs.map((p) => `-i "${p}"`).join(' ');
    const scaled = inputs.map((_, i) => `[${i}:v]scale=512:-1[v${i}]`).join(';');
    const refs = inputs.map((_, i) => `[v${i}]`).join('');
    execSync(`ffmpeg -y -loglevel error ${inputArgs} -filter_complex "${scaled};${refs}hstack=inputs=${inputs.length}" -q:v 4 "${sheet}"`);
  }
  console.log(`Contact sheets in ${SHEET_DIR}/`);
}

function install(filename, chosenIndex, reason) {
  const shot = shotlist.shots.find((candidate) => candidate.filename === filename);
  if (!shot) throw new Error(`No shot named ${filename}`);
  const source = candidatePath(shot, chosenIndex);
  if (!fs.existsSync(source)) throw new Error(`Missing candidate: ${source}`);
  const masterPath = `assets/${shot.act}/${shot.filename}`;
  const runtimePath = `public/stills/${shot.act}/${shot.filename}`;
  // Normalize to the deck's native plate size.
  execSync(`ffmpeg -y -loglevel error -i "${source}" -vf "scale=1024:576:force_original_aspect_ratio=increase,crop=1024:576" -q:v 3 "${masterPath}"`);
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.copyFileSync(masterPath, runtimePath);
  shot.status = 'generated-clean';
  shot.sourceUrl = shot.candidateUrls?.[`c${chosenIndex}`] ?? shot.sourceUrl;
  shot.curation = {
    picked: `c${chosenIndex}`,
    reason: reason || 'best continuity with palette and geography',
    rejected: Object.keys(shot.candidateUrls ?? {}).filter((key) => key !== `c${chosenIndex}`),
  };
  fs.writeFileSync(SHOTLIST_PATH, JSON.stringify(shotlist, null, 2) + '\n');
  console.log(`Installed ${filename} from c${chosenIndex} → ${masterPath} + ${runtimePath}`);
}

if (mode === 'gen') {
  await generate(rest[0], rest[1] ? Number(rest[1]) : 3);
} else if (mode === 'install') {
  install(rest[0], Number(rest[1]), rest.slice(2).join(' '));
} else {
  console.log('usage: gen <act> [candidates] | install <filename> <candidateIndex> [reason]');
  process.exit(1);
}

#!/usr/bin/env node
// Spatial-continuity regeneration (image-to-image).
//
//   node tools/regenSpatial.mjs gen [candidates=4]
//     For every flagged shot, regenerate candidates with fal-ai/flux-2-pro/edit
//     CONDITIONED on its correct twin / a correct neighbour anchor, so geography,
//     framing and light are preserved structurally and only the named wrongness
//     shifts. Prompts come from /tmp/spatial_drafts.json; references from the REFS
//     map below (all anchors are stable correct plates, never a shot being regen'd).
//     Writes assets/candidates/<act>/<stem>__c<i>.jpg + per-shot contact sheets,
//     and stamps the new prompt + candidateUrls into content/shotlist.json.
//
//   Install picks with the existing: node tools/generateStills.mjs install <file> <i> [reason]

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { falRun, imageToDataUri, downloadFile, mapWithConcurrency } from './falClient.mjs';

const MODEL = 'fal-ai/flux-2-pro/edit';
const SHOTLIST_PATH = 'content/shotlist.json';
const DRAFTS_PATH = '/tmp/spatial_drafts.json';
const SHEET_DIR = '/tmp/bluebonnet-sheets';

// filename -> reference plate filename(s). Refs are the CORRECT twin (c2-from-twin),
// or a correct neighbour that defines the geography/palette (both / reshoot).
const REFS = {
  // Act I shoulder — condition each later window on its correct first window
  'wagon-exterior__2017-2026.jpg': ['wagon-exterior__2008-2017.jpg'],
  'wagon-interior__2017-2026.jpg': ['wagon-interior__2008-2017.jpg'],
  'scanner-radio__2017-2026.jpg': ['scanner-radio__2008-2017.jpg'],
  'tipline-printer__2017-2026.jpg': ['tipline-printer__2008-2017.jpg'],
  'roadside-shrine__2017-2026.jpg': ['roadside-shrine__2008-2017.jpg'],
  'culvert-mouth__2017-2026.jpg': ['culvert-mouth__2008-2017.jpg'],
  // Act II field — twins, plus the flat-corridor left-row as the terrain anchor
  'field-threshold__2017-2026.jpg': ['field-threshold__2008-2017.jpg'],
  'field-threshold-look-up__2017-2026.jpg': ['field-threshold-look-up__2008-2017.jpg', 'field-threshold__2008-2017.jpg'],
  'field-left-row__2017-2026.jpg': ['field-left-row__2008-2017.jpg'],
  'field-right-row__2008-2017.jpg': ['field-left-row__2008-2017.jpg'],
  'field-right-row__2017-2026.jpg': ['field-left-row__2008-2017.jpg'],
  'field-gate__2017-2026.jpg': ['field-gate__2008-2017.jpg'],
  'field-tally__2008-2017.jpg': ['field-gate__2008-2017.jpg'],
  'field-tally__2017-2026.jpg': ['field-gate__2008-2017.jpg'],
  'act2-culvert-stub__2017-2026.jpg': ['act2-culvert-stub__2008-2017.jpg'],
  'field-clock-one__2008-2017.jpg': ['field-left-row__2008-2017.jpg'],
  'field-clock-one__2017-2026.jpg': ['field-left-row__2008-2017.jpg'],
  'field-clock-seven__2008-2017.jpg': ['field-left-row__2008-2017.jpg'],
  'field-clock-seven__2017-2026.jpg': ['field-left-row__2008-2017.jpg'],
  'field-clock-three__2017-2026.jpg': ['field-clock-three__2008-2017.jpg'],
  // Act III culvert — anchor on the correct box interior (dripline) / the correct twin
  'culvert-throat__2017-2026.jpg': ['culvert-dripline__2017-2026.jpg'],
  'culvert-throat__2026-2035.jpg': ['culvert-dripline__2026-2035.jpg'],
  'culvert-throat-wall-closeup__2017-2026.jpg': ['culvert-throat-wall-closeup__2026-2035.jpg'],
  'culvert-pipe__2017-2026.jpg': ['culvert-pipe__2026-2035.jpg'],
  'culvert-echo-chamber__2017-2026.jpg': ['culvert-dripline__2026-2035.jpg'],
  'culvert-echo-chamber__2026-2035.jpg': ['culvert-dripline__2026-2035.jpg'],
  // Act IV night — anchor on the threshold's car cue (facing away, slightly left)
  'near-car__2026-2035.jpg': ['nine-field-threshold__2026-2035.jpg'],
  'nine-flower-path__2026-2035.jpg': ['nine-field-threshold__2026-2035.jpg'],
  // Prelude — inspiration from the correct in-game plates they must agree with
  'prelude-field.jpg': ['field-threshold__2008-2017.jpg'],
  'prelude-wagon.jpg': ['wagon-exterior__2008-2017.jpg'],
  'prelude-dash.jpg': ['wagon-interior__2008-2017.jpg'],
};

const shotlist = JSON.parse(fs.readFileSync(SHOTLIST_PATH, 'utf8'));
const drafts = JSON.parse(fs.readFileSync(DRAFTS_PATH, 'utf8'));
const byFile = new Map(shotlist.shots.map((s) => [s.filename, s]));
const candidates = process.argv[3] ? Number(process.argv[3]) : 4;

function plate(filename) {
  const shot = byFile.get(filename);
  if (!shot) throw new Error(`ref not in shotlist: ${filename}`);
  return `public/stills/${shot.act}/${filename}`;
}
function candidatePath(shot, index) {
  return `assets/candidates/${shot.act}/${shot.filename.replace('.jpg', '')}__c${index}.jpg`;
}

async function run() {
  // Stamp the corrected prompts in first, so provenance + A1 lint see them.
  for (const d of drafts) {
    const shot = byFile.get(d.filename);
    if (!shot) { console.warn(`draft has no shot: ${d.filename}`); continue; }
    shot.prompt = d.newPrompt;
    shot.status = 'regen-pending';
  }
  fs.writeFileSync(SHOTLIST_PATH, JSON.stringify(shotlist, null, 2) + '\n');

  const jobs = drafts.flatMap((d) => Array.from({ length: candidates }, (_, index) => ({ d, index })));
  console.log(`Regenerating ${drafts.length} shots x ${candidates} candidates via ${MODEL} (image-to-image)…`);
  const failures = [];
  // Resilient: one flagged prompt must not abort the batch (content checker can
  // reject individual prompts). Catch per job, keep going, report at the end.
  await mapWithConcurrency(jobs, 6, async ({ d, index }) => {
    const shot = byFile.get(d.filename);
    if (!shot) return;
    const destination = candidatePath(shot, index);
    if (fs.existsSync(destination)) return;
    const refs = (REFS[d.filename] || []).map((r) => imageToDataUri(plate(r)));
    if (!refs.length) { console.warn(`no refs for ${d.filename}`); return; }
    try {
      const result = await falRun(MODEL, {
        prompt: d.newPrompt,
        image_urls: refs,
        image_size: 'landscape_16_9',
        seed: (shot.seed || 1187) + index * 1009,
        output_format: 'jpeg',
      });
      const url = result.images?.[0]?.url;
      if (!url) throw new Error('no image url');
      await downloadFile(url, destination);
      shot.candidateUrls = shot.candidateUrls ?? {};
      shot.candidateUrls[`c${index}`] = url;
      console.log(`  ✓ ${d.filename} c${index}`);
    } catch (err) {
      const policy = /content_policy_violation|content checker/i.test(String(err.message));
      failures.push({ filename: d.filename, index, policy, msg: String(err.message).slice(0, 120) });
      console.warn(`  ✗ ${d.filename} c${index} ${policy ? '[content-policy]' : ''}`);
    }
  });
  fs.writeFileSync(SHOTLIST_PATH, JSON.stringify(shotlist, null, 2) + '\n');
  if (failures.length) {
    const byShot = {};
    for (const f of failures) (byShot[f.filename] ??= []).push(f);
    console.log(`\n${failures.length} candidate failures across ${Object.keys(byShot).length} shots:`);
    for (const [file, fs2] of Object.entries(byShot)) {
      console.log(`  ${file}: ${fs2.length} failed${fs2.some((x) => x.policy) ? ' (content-policy)' : ''}`);
    }
  }

  // Contact sheets: original twin/anchor on the far left, then candidates.
  fs.mkdirSync(SHEET_DIR, { recursive: true });
  for (const d of drafts) {
    const shot = byFile.get(d.filename);
    const ref = (REFS[d.filename] || [])[0];
    const inputs = [];
    if (ref && fs.existsSync(plate(ref))) inputs.push(plate(ref));
    for (let i = 0; i < candidates; i++) { const p = candidatePath(shot, i); if (fs.existsSync(p)) inputs.push(p); }
    if (inputs.length < 2) continue;
    const sheet = `${SHEET_DIR}/${shot.act}__${shot.filename.replace('.jpg', '')}.jpg`;
    const inputArgs = inputs.map((p) => `-i "${p}"`).join(' ');
    const scaled = inputs.map((_, i) => `[${i}:v]scale=420:-1[v${i}]`).join(';');
    const refsChain = inputs.map((_, i) => `[v${i}]`).join('');
    execSync(`ffmpeg -y -loglevel error ${inputArgs} -filter_complex "${scaled};${refsChain}hstack=inputs=${inputs.length}" -q:v 4 "${sheet}"`);
  }
  console.log(`Contact sheets (anchor | candidates) in ${SHEET_DIR}/`);
}

if (process.argv[2] === 'gen') { await run(); }
else { console.log('usage: node tools/regenSpatial.mjs gen [candidates=4]'); process.exit(1); }

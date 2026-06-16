#!/usr/bin/env node
// Generate hero-beat candidates (the composed wrongness swell) via ElevenLabs
// SFX. Each beat is a one-shot SWELL — quiet, building, settling — NEVER a jump
// scare (canon). We generate N candidates per beat (the model is stochastic) and
// curate later with tools/analyzeAudio.mjs, which rejects front-loaded stingers.
//
//   node tools/genHeroBeats.mjs [candidates=4]

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { falRun, downloadFile, mapWithConcurrency } from './falClient.mjs';

const CAND = process.argv[2] ? Number(process.argv[2]) : 4;
const DIR = 'assets/candidates/audio';
fs.mkdirSync(DIR, { recursive: true });

const BEATS = [
  {
    name: 'hero-act2-turn',
    seconds: 5,
    prompt:
      'A slow dread swell rising from near silence: a deep low harmonic groan gathering under a soft wash of analog tape static and dry wind moving through a wide field of flowers, building gradually and evenly over five seconds to a soft uneasy peak, then easing back. No melody, no rhythm, no voice, no sudden impact, no jump scare. Distant, oppressive, the sense of a field turning to face you.',
  },
  {
    name: 'hero-act4-near',
    seconds: 6,
    prompt:
      'A deep subharmonic swell in a vast dark night field: a low sustained drone rising slowly with a faint shimmering high overtone like luminous petals, building patiently over six seconds into a heavy quiet pressure, then settling. No melody, no beat, no voice, no sudden hit. Immense, still, the feeling of something enormous finally very close.',
  },
  {
    name: 'hero-sideb-room',
    seconds: 5,
    prompt:
      'An intimate uncanny swell inside a dark living room lit only by a humming CRT television: a low electrical mains hum gathering with a soft rising magnetic-tape whine and the faint warbling carrier of a distant AM radio, building gently over five seconds and then holding close and present. No melody, no voice, no jump scare. Quiet, domestic, wrong.',
  },
];

const jobs = BEATS.flatMap((b) => Array.from({ length: CAND }, (_, i) => ({ b, i })));
console.log(`Generating ${BEATS.length} hero beats x ${CAND} candidates via ElevenLabs SFX…`);
const failures = [];
await mapWithConcurrency(jobs, 4, async ({ b, i }) => {
  const wav = `${DIR}/${b.name}__c${i}.wav`;
  if (fs.existsSync(wav)) return;
  try {
    const result = await falRun('fal-ai/elevenlabs/sound-effects/v2', {
      text: b.prompt,
      output_format: 'pcm_44100',
      loop: false,
      duration_seconds: b.seconds,
    });
    const url = result.audio?.url;
    if (!url) throw new Error('no audio url');
    const pcm = `${DIR}/${b.name}__c${i}-raw.pcm`;
    await downloadFile(url, pcm);
    execSync(`ffmpeg -y -loglevel error -f s16le -ar 44100 -ac 1 -i "${pcm}" -ac 2 "${wav}"`);
    fs.rmSync(pcm, { force: true });
    console.log(`  ✓ ${b.name} c${i}`);
  } catch (err) {
    failures.push(`${b.name} c${i}: ${String(err.message).slice(0, 100)}`);
    console.warn(`  ✗ ${b.name} c${i}`);
  }
});
if (failures.length) console.log(`\n${failures.length} failures:\n  ${failures.join('\n  ')}`);
console.log('done. curate with: node tools/analyzeAudio.mjs pick swell ' + DIR + '/<name>__c*.wav');

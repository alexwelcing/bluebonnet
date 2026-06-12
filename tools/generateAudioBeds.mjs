#!/usr/bin/env node
// Audio beds derived from the loops they accompany (canon A7): MMAudio v2
// foleys the loop video, then the track is conditioned into a seamless loop
// (tail crossfaded into the head, so file end == file start).
//
//   node tools/generateAudioBeds.mjs gen <loopPath> <bedName> "<sound prompt>" [seed]
//   node tools/generateAudioBeds.mjs install <bedName>   # candidates/audio/<bedName>.wav → public+assets

import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { falRun, downloadFile } from './falClient.mjs';

const MODEL = 'fal-ai/mmaudio-v2';
const [mode, ...rest] = process.argv.slice(2);

async function gen() {
  const [loopPath, bedName, prompt, seedArg] = rest;
  if (!fs.existsSync(loopPath)) throw new Error(`missing ${loopPath}`);
  const dataUri = `data:video/mp4;base64,${fs.readFileSync(loopPath).toString('base64')}`;
  console.log(`→ ${MODEL} | ${bedName}`);
  const result = await falRun(MODEL, {
    video_url: dataUri,
    prompt,
    negative_prompt: 'music, melody, speech, voice, jump scare, sudden loud noise',
    duration: 6,
    seed: seedArg ? Number(seedArg) : 1187,
  });
  const url = result.video?.url;
  if (!url) throw new Error('no output');
  const rawPath = `assets/candidates/audio/${bedName}-raw.mp4`;
  await downloadFile(url, rawPath);
  // Extract audio and condition into a seamless loop: body starts at 0.5s,
  // tail crossfades into the first 0.5s, so the loop point is continuous.
  const wav = `assets/candidates/audio/${bedName}.wav`;
  execSync(`ffmpeg -y -loglevel error -i "${rawPath}" -vn -ac 2 -ar 44100 /tmp/${bedName}-full.wav`);
  // atrim-fed acrossfade is unreliable in this ffmpeg build; use two files.
  execSync(`ffmpeg -y -loglevel error -i /tmp/${bedName}-full.wav -ss 0.75 /tmp/${bedName}-body.wav -t 0.75 /tmp/${bedName}-head.wav`);
  execSync(`ffmpeg -y -loglevel error -i /tmp/${bedName}-body.wav -i /tmp/${bedName}-head.wav -filter_complex "[0:a][1:a]acrossfade=d=0.5" "${wav}"`);
  console.log(`candidate: ${wav} (listenable) | raw: ${rawPath}`);
}

function install() {
  const [bedName] = rest;
  const wav = `assets/candidates/audio/${bedName}.wav`;
  if (!fs.existsSync(wav)) throw new Error(`missing ${wav}`);
  fs.copyFileSync(wav, `assets/audio/${bedName}.wav`);
  fs.copyFileSync(wav, `public/audio/${bedName}.wav`);
  console.log(`installed public/audio/${bedName}.wav`);
}

// Direct text-to-audio (ElevenLabs SFX v2) for cues and beds with no source
// video. `loop` uses the model's native seamless looping; one-shots skip it.
async function direct() {
  const [bedName, prompt, kind = 'oneshot', durationArg] = rest;
  const isLoop = kind === 'loop';
  console.log(`→ fal-ai/elevenlabs/sound-effects/v2 | ${bedName} (${kind})`);
  const result = await falRun('fal-ai/elevenlabs/sound-effects/v2', {
    text: prompt,
    output_format: 'pcm_44100',
    loop: isLoop,
    ...(durationArg ? { duration_seconds: Number(durationArg) } : {}),
  });
  const url = result.audio?.url;
  if (!url) throw new Error('no audio');
  const rawPath = `assets/candidates/audio/${bedName}-raw.pcm`;
  await downloadFile(url, rawPath);
  const wav = `assets/candidates/audio/${bedName}.wav`;
  execSync(`ffmpeg -y -loglevel error -f s16le -ar 44100 -ac 1 -i "${rawPath}" -ac 2 "${wav}"`);
  console.log(`candidate: ${wav}`);
}

if (mode === 'gen') await gen();
else if (mode === 'direct') await direct();
else if (mode === 'install') install();
else { console.log('usage: gen <loopPath> <bedName> "<prompt>" [seed] | direct <bedName> "<prompt>" [loop|oneshot] [seconds] | install <bedName>'); process.exit(1); }

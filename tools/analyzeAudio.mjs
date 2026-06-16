#!/usr/bin/env node
// Objective audio curation (we generate sound we cannot hear, so we measure it).
// Parses a PCM WAV and reports the features that tell a good hero-beat from a bad
// one: loudness, peak/clipping, silence, the RMS envelope over time (is it a
// SWELL — quiet -> loud -> settle — or flat/decay?), and a brightness proxy.
//
//   node tools/analyzeAudio.mjs analyze <wav...>
//   node tools/analyzeAudio.mjs pick <swell|rumble|static|sting> <wav...>
//
// Canon for hero beats: a swell, never a jump scare. So we also REJECT a sudden
// onset (a transient spike in the first 15%) — that reads as a stinger.

import fs from 'node:fs';

function readWav(path) {
  const buf = fs.readFileSync(path);
  let pos = 12;
  const fmt = {};
  let dataOffset = -1;
  let dataLen = 0;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const sz = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      fmt.channels = buf.readUInt16LE(pos + 10);
      fmt.sampleRate = buf.readUInt32LE(pos + 12);
      fmt.bits = buf.readUInt16LE(pos + 22);
    } else if (id === 'data') {
      dataOffset = pos + 8;
      dataLen = Math.min(sz, buf.length - dataOffset);
      break;
    }
    pos += 8 + sz + (sz % 2);
  }
  if (dataOffset < 0) throw new Error(`no data chunk: ${path}`);
  const bytesPerSample = (fmt.bits || 16) / 8;
  const frame = bytesPerSample * (fmt.channels || 1);
  const frames = Math.floor(dataLen / frame);
  const mono = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let acc = 0;
    for (let c = 0; c < fmt.channels; c++) {
      const off = dataOffset + i * frame + c * bytesPerSample;
      const v = fmt.bits === 16 ? buf.readInt16LE(off) / 32768 : buf.readInt32LE(off) / 2147483648;
      acc += v;
    }
    mono[i] = acc / fmt.channels;
  }
  return { mono, sampleRate: fmt.sampleRate || 44100 };
}

const dB = (x) => (x <= 1e-9 ? -120 : 20 * Math.log10(x));

function analyze(path) {
  const { mono, sampleRate } = readWav(path);
  const n = mono.length;
  const duration = n / sampleRate;
  let peak = 0;
  let sumSq = 0;
  let zc = 0;
  let silent = 0;
  let dc = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(mono[i]);
    if (a > peak) peak = a;
    sumSq += mono[i] * mono[i];
    dc += mono[i];
    if (a < 0.003) silent++;
    if (i > 0 && Math.sign(mono[i]) !== Math.sign(mono[i - 1])) zc++;
  }
  const rms = Math.sqrt(sumSq / n);
  // RMS envelope over 16 segments
  const SEG = 16;
  const env = new Array(SEG).fill(0);
  for (let s = 0; s < SEG; s++) {
    const a = Math.floor((s * n) / SEG);
    const b = Math.floor(((s + 1) * n) / SEG);
    let ss = 0;
    for (let i = a; i < b; i++) ss += mono[i] * mono[i];
    env[s] = Math.sqrt(ss / Math.max(1, b - a));
  }
  const peakSeg = env.indexOf(Math.max(...env));
  const envDb = env.map((e) => Math.round(dB(e)));
  // onset spike: max segment energy in first 15% relative to overall — a stinger
  const earlySegs = Math.max(1, Math.round(SEG * 0.15));
  const earlyPeak = Math.max(...env.slice(0, earlySegs));
  const onsetRatio = earlyPeak / (Math.max(...env) || 1e-9);
  return {
    file: path.split('/').pop(),
    durationS: +duration.toFixed(2),
    peakDb: +dB(peak).toFixed(1),
    rmsDb: +dB(rms).toFixed(1),
    silencePct: +((silent / n) * 100).toFixed(1),
    dcOffset: +(dc / n).toFixed(4),
    zcrPerSec: Math.round((zc / duration)),
    peakSegment: peakSeg,        // 0..15 — where the loudest moment sits
    peakAtPct: Math.round((peakSeg / (SEG - 1)) * 100),
    onsetRatio: +onsetRatio.toFixed(2), // ~1 => front-loaded (stinger risk)
    startToPeakDb: +(dB(env[peakSeg]) - dB(env[0])).toFixed(1), // swell depth
    settleDb: +(dB(env[SEG - 1]) - dB(env[peakSeg])).toFixed(1), // negative => settles
    envDb,
  };
}

// Score for the intended shape. Higher is better; flags list disqualifiers.
function score(m, shape) {
  const flags = [];
  if (m.silencePct > 35) flags.push('mostly-silent');
  if (m.peakDb > -0.3) flags.push('clipping');
  if (m.peakDb < -16) flags.push('too-quiet');
  if (Math.abs(m.dcOffset) > 0.02) flags.push('dc-offset');
  let s = 0;
  if (shape === 'swell' || shape === 'sting') {
    // want: builds (peak in latter 55%), real depth, gentle settle, NO front onset
    s += m.peakAtPct >= 45 ? 30 : -20;
    s += Math.min(30, Math.max(0, m.startToPeakDb)); // deeper swell = better
    s += m.settleDb < 0 ? 12 : 0;                    // settles after the peak
    s += m.onsetRatio < 0.6 ? 18 : -25;              // front-loaded => stinger
    s -= Math.max(0, m.silencePct - 10) * 0.5;
  } else if (shape === 'rumble') {
    s += m.zcrPerSec < 1500 ? 25 : -10;              // dark/low
    s += m.rmsDb > -24 && m.rmsDb < -10 ? 20 : 0;    // present but not loud
    s += Math.abs(m.settleDb) < 6 ? 10 : 0;          // sustained
  } else if (shape === 'static') {
    s += m.zcrPerSec > 3000 ? 25 : -10;              // bright/noisy
    s += m.silencePct < 15 ? 15 : -10;
  }
  if (flags.length) s -= 50 * flags.length;
  return { score: Math.round(s), flags };
}

const [mode, ...rest] = process.argv.slice(2);
if (mode === 'analyze') {
  for (const f of rest) console.log(JSON.stringify(analyze(f)));
} else if (mode === 'pick') {
  const [shape, ...files] = rest;
  const ranked = files.map((f) => { const m = analyze(f); return { ...m, ...score(m, shape) }; })
    .sort((a, b) => b.score - a.score);
  for (const r of ranked) console.log(`${r.score >= 0 ? '+' : ''}${r.score}  ${r.file}  peak@${r.peakAtPct}% swell${r.startToPeakDb}dB settle${r.settleDb}dB onset${r.onsetRatio} zcr${r.zcrPerSec} peakDb${r.peakDb} sil${r.silencePct}%  ${r.flags.join(',')}`);
  console.log(`\nBEST: ${ranked[0]?.file} (score ${ranked[0]?.score})`);
} else {
  console.log('usage: analyze <wav...> | pick <swell|rumble|static|sting> <wav...>');
  process.exit(1);
}

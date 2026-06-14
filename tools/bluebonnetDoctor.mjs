#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const rel = (path) => new URL(path, root);
const readJson = (path) => JSON.parse(fs.readFileSync(rel(path), 'utf8'));

function exists(path) {
  return fs.existsSync(rel(path));
}

function envNamesFromDotenv() {
  if (!exists('.env')) return new Set();
  const text = fs.readFileSync(rel('.env'), 'utf8');
  return new Set(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => line.slice(0, line.indexOf('=')).trim()),
  );
}

function commandVersion(command, args = ['--version']) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) return { ok: false, detail: result.error.message };
  return { ok: result.status === 0, detail: (result.stdout || result.stderr || '').trim().split('\n')[0] };
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function manifestStats() {
  const acts = ['act1', 'act2', 'act3', 'act4'];
  return acts.map((act) => {
    const manifest = readJson(`content/${act}.json`);
    const states = manifest.nodes.flatMap((node) => Object.entries(node.temporalStates ?? {}).map(([window, state]) => ({ node, window, state })));
    const hotspots = states.flatMap(({ state }) => state.hotspots ?? []);
    const motionStates = states.filter(({ state }) => (state.motionLayers ?? []).length > 0);
    return {
      act,
      nodes: manifest.nodes.length,
      temporalStates: states.length,
      hotspots: hotspots.length,
      clueSilhouettes: hotspots.filter((hotspot) => hotspot.clueHighlight && hotspot.cluePrompt).length,
      motionStates: motionStates.length,
      missingMotionStates: states.length - motionStates.length,
    };
  });
}

const packageJson = readJson('package.json');
const shotlist = readJson('content/shotlist.json');
const loops = readJson('content/motionLoops.json');
const dotenvNames = envNamesFromDotenv();
const commandChecks = {
  node: commandVersion('node'),
  npm: commandVersion('npm'),
  git: commandVersion('git'),
  ffmpeg: commandVersion('ffmpeg', ['-version']),
  netlify: commandVersion('netlify'),
};
const requiredScripts = ['dev', 'build', 'typecheck', 'test', 'lint:shotlist', 'gate', 'doctor', 'playtest:smoke'];
const shotStatus = countBy(shotlist.shots ?? [], (shot) => shot.status ?? 'missing-status');
const pendingShots = (shotlist.shots ?? []).filter((shot) => String(shot.status ?? '').includes('pending'));
const loopStatus = countBy(loops.loops ?? [], (loop) => loop.status ?? 'missing-status');

console.log('BLUEBONNET TOOLING DOCTOR');
console.log(`root: ${process.cwd()}`);
console.log('');
console.log('Commands');
for (const [name, check] of Object.entries(commandChecks)) {
  console.log(`  ${check.ok ? '✓' : '✗'} ${name}${check.detail ? ` — ${check.detail}` : ''}`);
}
console.log('');
console.log('Secrets by name only');
for (const name of ['FAL_API_KEY', 'NETLIFY_AUTH_TOKEN']) {
  const inProcess = Boolean(process.env[name]);
  const inDotenv = dotenvNames.has(name);
  console.log(`  ${inProcess || inDotenv ? '✓' : '○'} ${name}${inProcess ? ' in process env' : inDotenv ? ' in .env' : ' not present'}`);
}
console.log('');
console.log('Package scripts');
for (const script of requiredScripts) {
  console.log(`  ${packageJson.scripts?.[script] ? '✓' : '✗'} npm run ${script}`);
}
console.log('');
console.log('Content density');
for (const stat of manifestStats()) {
  console.log(
    `  ${stat.act}: ${stat.nodes} nodes, ${stat.temporalStates} temporal states, ${stat.hotspots} hotspots, ` +
      `${stat.clueSilhouettes} segmented clue hotspots, ${stat.motionStates}/${stat.temporalStates} states with motion`,
  );
}
console.log('');
console.log('Shotlist');
console.log(`  total shots: ${(shotlist.shots ?? []).length}`);
for (const [status, count] of Object.entries(shotStatus).sort()) {
  console.log(`  ${status}: ${count}`);
}
console.log(`  pending shots: ${pendingShots.length}`);
console.log('');
console.log('Motion loops');
console.log(`  total loop records: ${(loops.loops ?? []).length}`);
for (const [status, count] of Object.entries(loopStatus).sort()) {
  console.log(`  ${status}: ${count}`);
}
console.log('');
console.log('Bridge');
console.log(`  ${exists('.bridge/preview/index.html') ? '✓' : '✗'} .bridge/preview/index.html`);
console.log(`  ${exists('.bridge/status.md') ? '✓' : '✗'} .bridge/status.md`);
console.log(`  ${exists('.bridge/backlog.md') ? '✓' : '✗'} .bridge/backlog.md`);

const hardFailures = [];
for (const script of requiredScripts) {
  if (!packageJson.scripts?.[script]) hardFailures.push(`missing package script: ${script}`);
}
if (!commandChecks.node.ok || !commandChecks.npm.ok || !commandChecks.git.ok) hardFailures.push('missing required command: node/npm/git');
if (!dotenvNames.has('FAL_API_KEY') && !process.env.FAL_API_KEY) hardFailures.push('FAL_API_KEY not discoverable by name; generation scripts will block');
if (hardFailures.length) {
  console.error('');
  console.error('Doctor failures:');
  for (const failure of hardFailures) console.error(`  - ${failure}`);
  process.exit(1);
}

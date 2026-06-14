#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url);
const rel = (path) => new URL(path, root);
const args = new Set(process.argv.slice(2));
const refreshPreview = args.has('--preview') || args.has('--refresh-preview');
const appendStatus = args.has('--status');
const skipBuild = args.has('--skip-build');

const steps = [
  ['typecheck', ['npm', ['run', 'typecheck']]],
  ['test', ['npm', ['test']]],
  ['shotlist lint', ['npm', ['run', 'lint:shotlist']]],
];
if (!skipBuild) steps.push(['build', ['npm', ['run', 'build']]]);

const startedAt = new Date();
const results = [];

function run(label, [command, commandArgs]) {
  const start = Date.now();
  console.log(`\n== ${label} ==`);
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
  });
  const seconds = ((Date.now() - start) / 1000).toFixed(1);
  results.push({ label, status: result.status ?? 1, seconds });
  if (result.error) {
    console.error(`${label} failed to start: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(`${label} failed after ${seconds}s with exit code ${result.status}.`);
    process.exit(result.status ?? 1);
  }
  console.log(`✓ ${label} passed in ${seconds}s`);
}

function copyPreview() {
  const dist = rel('dist');
  const preview = rel('.bridge/preview');
  if (!fs.existsSync(dist)) throw new Error('dist/ is missing; run build before refreshing preview');
  fs.rmSync(preview, { recursive: true, force: true });
  fs.mkdirSync(preview, { recursive: true });
  fs.cpSync(dist, preview, { recursive: true });
  console.log('✓ refreshed .bridge/preview/ from dist/');
}

function statusEntry() {
  const finishedAt = new Date();
  const duration = ((finishedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1);
  const verification = results.map((result) => `- npm ${result.label}: passed (${result.seconds}s)`).join('\n');
  return `\n## ${finishedAt.toISOString()} — Tooling gate run\n\nChanged:\n- Ran the standard BLUEBONNET tooling gate through \`npm run gate${refreshPreview ? ' -- --preview' : ''}\`.\n${refreshPreview ? '- Refreshed `.bridge/preview/` from the green `dist/` artifact.\n' : ''}\nVerification:\n${verification}\n- Total elapsed: ${duration}s\n\nNext:\n- Continue the active B7 density/tooling work against the green baseline.\n\nBlockers:\n- None from this gate run.\n`;
}

for (const step of steps) run(...step);
if (refreshPreview) copyPreview();
if (appendStatus) {
  fs.appendFileSync(rel('.bridge/status.md'), statusEntry());
  console.log('✓ appended gate summary to .bridge/status.md');
}

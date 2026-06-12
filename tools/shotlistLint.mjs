#!/usr/bin/env node
import fs from 'node:fs';

const shotlist = JSON.parse(fs.readFileSync(new URL('../content/shotlist.json', import.meta.url), 'utf8'));
const required = shotlist.a1Lint?.requiredClause ?? 'no readable text, no lettering, no signage characters';
const risky = /\b(timestamp|text|sign|signage|flyer|label|lettering|printout|paper|writing|handwriting|numeral|number|display|lcd|counter|marker)\b/i;
const failures = [];

for (const shot of shotlist.shots ?? []) {
  const prompt = String(shot.prompt ?? '');
  if (!prompt.includes(required)) {
    failures.push(`${shot.filename}: every generated prompt must include the A1 no-text clause`);
  }
  if (risky.test(prompt) && !prompt.includes(required)) {
    failures.push(`${shot.filename}: risky text-bearing prompt lacks no-text clause`);
  }
}

if (failures.length) {
  console.error(`A1 shotlist lint failed:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`A1 shotlist lint passed for ${shotlist.shots.length} clean plates across all acts.`);

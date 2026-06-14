#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {
  generateWorldFromImage,
  pollOperation,
  getWorld,
  downloadWorldAssets,
} from './worldLabsClient.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

function usage() {
  console.log(`Usage: node tools/generateWorldFromPlate.mjs <plate-path> [display-name] [prompt-suffix]`);
  process.exit(1);
}

const platePath = process.argv[2];
if (!platePath) usage();

const absolutePlatePath = path.resolve(ROOT, platePath);
if (!fs.existsSync(absolutePlatePath)) {
  throw new Error(`Plate not found: ${absolutePlatePath}`);
}

const displayName = process.argv[3] ?? path.basename(platePath, path.extname(platePath));
const promptSuffix = process.argv[4] ?? '';

const basePrompt =
  'A 1990s Texas highway shoulder at civil twilight, bluebonnets blooming hard out of season along FM 1187, ' +
  'degraded VHS Hi8 camcorder footage, muted dusk colors, no readable text, no people, empty world. ' +
  promptSuffix;

async function main() {
  console.log(`Generating world from ${platePath}...`);
  console.log(`Display name: ${displayName}`);
  const operation = await generateWorldFromImage({
    displayName,
    imagePath: absolutePlatePath,
    textPrompt: basePrompt,
    model: 'marble-1.1',
  });
  console.log(`Operation: ${operation.operation_id}`);
  const completed = await pollOperation(operation.operation_id, { intervalMs: 15000, maxAttempts: 80 });
  const world = completed.response;
  const worldId = world.world_id ?? world.id;
  console.log(`World generated: ${worldId}`);
  console.log(`Marble URL: ${world.world_marble_url}`);

  const outDir = path.join(ROOT, 'assets', 'worlds', worldId);
  fs.mkdirSync(outDir, { recursive: true });
  const files = await downloadWorldAssets(world, outDir);
  console.log('Downloaded assets:');
  for (const f of files) console.log(`  ${path.relative(ROOT, f)}`);

  const provenance = {
    worldId,
    displayName,
    sourcePlate: platePath,
    model: 'marble-1.1',
    marbleUrl: world.world_marble_url,
    assets: files.map((f) => path.relative(ROOT, f)),
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(outDir, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
  console.log(`Provenance written to ${path.relative(ROOT, path.join(outDir, 'provenance.json'))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

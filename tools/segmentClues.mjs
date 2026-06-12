#!/usr/bin/env node
// Clue-precise hotspot segmentation (canon A6.1).
//
// For every hotspot in the act manifests that carries a `cluePrompt`, run
// text-prompted segmentation (SAM 3 on fal) against the node's still for that
// temporal window, trace the resulting mask into a simplified polygon in
// percent coordinates, and write it back as the hotspot's polygon.
//
// Usage:
//   node tools/segmentClues.mjs            # all acts, hotspots with cluePrompt
//   node tools/segmentClues.mjs act1       # one act
//   node tools/segmentClues.mjs act1 wagon-interior   # one node

import fs from 'node:fs';
import { PNG } from 'pngjs';
import { falRun, imageToDataUri, downloadFile, mapWithConcurrency } from './falClient.mjs';

const SAM_MODEL = 'fal-ai/sam-3/image';
const MAX_POINTS = 22; // clip-path stays cheap; silhouette stays recognizable
const MIN_SCORE = 0.35;

const args = process.argv.slice(2).filter((a) => a !== '--only-missing');
const onlyMissing = process.argv.includes('--only-missing');
const [actFilter, nodeFilter] = args;

// --- mask → polygon ---------------------------------------------------------

function decodeMask(buffer) {
  const png = PNG.sync.read(buffer);
  const { width, height, data } = png;
  const solid = new Uint8Array(width * height);
  for (let index = 0; index < width * height; index++) {
    const r = data[index * 4];
    const a = data[index * 4 + 3];
    solid[index] = a > 127 && r > 127 ? 1 : 0;
  }
  return { width, height, solid };
}

// Moore-neighbor boundary trace of the largest connected mask region.
function traceLargestContour({ width, height, solid }) {
  const at = (x, y) => (x >= 0 && y >= 0 && x < width && y < height ? solid[y * width + x] : 0);

  // Find all region starts via flood fill, keep the largest by area.
  const seen = new Uint8Array(width * height);
  let best = null;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      if (!solid[index] || seen[index]) continue;
      let area = 0;
      let start = [x, y];
      const stack = [index];
      seen[index] = 1;
      while (stack.length) {
        const current = stack.pop();
        area++;
        const cx = current % width;
        const cy = (current - cx) / width;
        if (cy < start[1] || (cy === start[1] && cx < start[0])) start = [cx, cy];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          const nIndex = ny * width + nx;
          if (at(nx, ny) && !seen[nIndex]) {
            seen[nIndex] = 1;
            stack.push(nIndex);
          }
        }
      }
      if (!best || area > best.area) best = { area, start };
    }
  }
  if (!best) return null;

  // Moore-neighbor tracing from the top-left pixel of the largest region.
  const neighbors = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  const contour = [];
  let [px, py] = best.start;
  let backtrack = 6; // entered moving right, so previous is to the left
  const startKey = `${px},${py}`;
  for (let step = 0; step < width * height * 4; step++) {
    contour.push([px, py]);
    let found = false;
    for (let turn = 0; turn < 8; turn++) {
      const direction = (backtrack + 1 + turn) % 8;
      const [dx, dy] = neighbors[direction];
      if (at(px + dx, py + dy)) {
        px += dx;
        py += dy;
        backtrack = (direction + 4) % 8;
        found = true;
        break;
      }
    }
    if (!found) break; // single-pixel region
    if (`${px},${py}` === startKey && contour.length > 2) break;
  }
  return contour;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const [x, y] = point;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSq));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function douglasPeucker(points, tolerance) {
  if (points.length < 3) return points;
  let maxDistance = 0;
  let maxIndex = 0;
  for (let index = 1; index < points.length - 1; index++) {
    const distance = perpendicularDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }
  if (maxDistance > tolerance) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

export function maskToPercentPolygon(buffer) {
  const mask = decodeMask(buffer);
  const contour = traceLargestContour(mask);
  if (!contour || contour.length < 3) return null;

  // Simplify with growing tolerance until under the point budget.
  let tolerance = Math.max(mask.width, mask.height) * 0.004;
  let simplified = contour;
  for (let pass = 0; pass < 12 && simplified.length > MAX_POINTS; pass++) {
    simplified = douglasPeucker(contour, tolerance);
    tolerance *= 1.6;
  }
  if (simplified.length < 3) return null;

  return simplified.map(([x, y]) => [
    Math.round((x / mask.width) * 1000) / 10,
    Math.round((y / mask.height) * 1000) / 10,
  ]);
}

// --- pipeline ----------------------------------------------------------------

async function segmentHotspot(stillPath, cluePrompt) {
  const result = await falRun(SAM_MODEL, {
    image_url: imageToDataUri(stillPath),
    prompt: cluePrompt,
    apply_mask: false,
    return_multiple_masks: false,
    include_scores: true,
    include_boxes: true,
    output_format: 'png',
  });
  const maskUrl = result.masks?.[0]?.url;
  const score = result.metadata?.scores?.[0] ?? result.metadata?.[0]?.score;
  if (!maskUrl) return { ok: false, reason: 'no mask returned' };
  if (typeof score === 'number' && score < MIN_SCORE) {
    return { ok: false, reason: `low confidence ${score.toFixed(2)}` };
  }
  const tempPath = `/tmp/bluebonnet-mask-${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
  await downloadFile(maskUrl, tempPath);
  const polygon = maskToPercentPolygon(fs.readFileSync(tempPath));
  fs.unlinkSync(tempPath);
  if (!polygon) return { ok: false, reason: 'mask traced to no usable contour' };
  return { ok: true, polygon, score };
}

async function main() {
  const acts = ['act1', 'act2', 'act3', 'act4'].filter((act) => !actFilter || act === actFilter);
  const jobs = [];
  for (const act of acts) {
    const manifestPath = `content/${act}.json`;
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const node of manifest.nodes) {
      if (nodeFilter && node.id !== nodeFilter) continue;
      for (const [window, state] of Object.entries(node.temporalStates ?? {})) {
        for (const hotspot of state.hotspots) {
          if (!hotspot.cluePrompt) continue;
          if (onlyMissing && hotspot.clueHighlight) continue;
          jobs.push({ act, manifestPath, manifest, node, window, state, hotspot });
        }
      }
    }
  }
  if (!jobs.length) {
    console.log('No hotspots with cluePrompt matched.');
    return;
  }
  console.log(`Segmenting ${jobs.length} clue hotspots via ${SAM_MODEL}…`);

  const outcomes = await mapWithConcurrency(jobs, 4, async (job) => {
    const stillPath = `public/${job.state.still}`;
    try {
      const result = await segmentHotspot(stillPath, job.hotspot.cluePrompt);
      if (result.ok) {
        job.hotspot.polygon = result.polygon;
        job.hotspot.clueHighlight = true;
        console.log(`  ✓ ${job.act}/${job.node.id}/${job.window}/${job.hotspot.id}: ${result.polygon.length} pts${typeof result.score === 'number' ? ` (score ${result.score.toFixed(2)})` : ''}`);
        return { job, ok: true };
      }
      console.log(`  ✗ ${job.act}/${job.node.id}/${job.window}/${job.hotspot.id}: ${result.reason} — polygon left as authored`);
      return { job, ok: false, reason: result.reason };
    } catch (error) {
      console.log(`  ✗ ${job.act}/${job.node.id}/${job.window}/${job.hotspot.id}: ${error.message}`);
      return { job, ok: false, reason: error.message };
    }
  });

  const byManifest = new Map();
  for (const { job } of outcomes) byManifest.set(job.manifestPath, job.manifest);
  for (const [manifestPath, manifest] of byManifest) {
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  }
  const succeeded = outcomes.filter((outcome) => outcome.ok).length;
  console.log(`Done: ${succeeded}/${jobs.length} hotspots updated; manifests rewritten.`);
  if (succeeded < jobs.length) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  await main();
}
